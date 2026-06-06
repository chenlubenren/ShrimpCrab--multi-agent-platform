/**
 * Agent Runner Service - CLI-based Agent Process Management
 * 
 * Manages spawning and communicating with agent CLI processes
 * for platforms: Claude Code, OpenClaw, Codex, Hermes, OpenCode
 * 
 * Supports both Windows and Linux environments
 */

import { spawn, ChildProcess, execFileSync } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

export type AgentPlatform = 'claude-code' | 'openclaw' | 'codex' | 'hermes' | 'opencode';

export interface AgentSession {
  sessionId: string;
  agentId: string;
  platform: AgentPlatform;
  workspacePath: string;
  process: ChildProcess | null;
  status: 'idle' | 'running' | 'waiting' | 'error' | 'stopped';
  startedAt: Date;
  providerConfig?: {
    apiKey: string;
    baseUrl?: string;
    models?: Array<string | { id?: string; name?: string }>;
    stateDir?: string | null;
    providerType?: string;
  };
}

export interface RunnerResponse {
  type: 'output' | 'error' | 'status' | 'done';
  content: string;
  timestamp: Date;
}

export interface CliHealthCheck {
  available: boolean;
  version: string;
  command: string;
  args: string[];
  displayCommand: string;
  usesWsl: boolean;
  errorName?: string;
  errorCode?: string;
  errorMessage?: string;
  status?: number | null;
  signal?: string | null;
  stderr?: string;
  stdout?: string;
}

interface PlatformConfig {
  command: string;
  args: (workspace: string, providerConfig?: ProviderConfig) => string[];
  interactive: boolean;
  workspaceEnv?: string;
  checkCommand: string;
  versionFlag: string;
  useShell?: boolean;
  /** Use --print mode for one-shot queries */
  usePrintMode?: boolean;
  /** Environment variables to set for API key */
  apiKeyEnv?: string;
  baseUrlEnv?: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  models?: Array<string | { id?: string; name?: string }>;
  stateDir?: string | null;
  providerType?: string;
}

// Detect platform
const isWindows = os.platform() === 'win32';
const OPENCLAW_PROXY_PROVIDER_ID = 'openclaw_proxy';
const OPENCLAW_MESSAGE_ARG_PLACEHOLDER = '__OPENCLAW_RUNTIME_MESSAGE__';

function isWindowsDrivePath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(filePath);
}

function isWslMountPath(filePath: string): boolean {
  return /^\/mnt\/[A-Za-z](\/|$)/.test(filePath);
}

function windowsPathToWsl(filePath: string): string {
  return filePath
    .replace(/^([A-Za-z]):[\\/]/, (_match, letter) => `/mnt/${String(letter).toLowerCase()}/`)
    .replace(/\\/g, '/');
}

function wslPathToWindows(filePath: string): string {
  return filePath
    .replace(/^\/mnt\/([A-Za-z])(?:\/|$)/, (_match, letter) => `${String(letter).toUpperCase()}:\\`)
    .replace(/\//g, '\\');
}

function resolveHostPath(filePath: string): string {
  if (isWindows) {
    const hostPath = isWslMountPath(filePath)
      ? wslPathToWindows(filePath)
      : filePath.replace(/[\\/]+/g, '\\');
    return path.isAbsolute(hostPath) ? path.normalize(hostPath) : path.resolve(hostPath);
  }

  const hostPath = isWindowsDrivePath(filePath)
    ? windowsPathToWsl(filePath)
    : filePath.replace(/\\/g, '/');
  return path.posix.isAbsolute(hostPath) ? path.posix.normalize(hostPath) : path.resolve(hostPath);
}

function toWslPath(filePath: string): string {
  if (isWslMountPath(filePath)) {
    return filePath.replace(/\\/g, '/');
  }

  if (isWindowsDrivePath(filePath)) {
    return windowsPathToWsl(filePath);
  }

  const resolvedPath = resolveHostPath(filePath);
  return isWindowsDrivePath(resolvedPath)
    ? windowsPathToWsl(resolvedPath)
    : resolvedPath.replace(/\\/g, '/');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function displayShellArg(value: string): string {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(value)
    ? value
    : `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function getOpenClawStateDir(workspacePath: string, providerConfig?: ProviderConfig): string {
  const stateDir = providerConfig?.stateDir || process.env.OPENCLAW_STATE_DIR;
  return resolveHostPath(stateDir || path.join(workspacePath, '.openclaw'));
}

function getOpenClawConfigPath(workspacePath: string, providerConfig?: ProviderConfig): string {
  return path.join(getOpenClawStateDir(workspacePath, providerConfig), 'openclaw.json');
}

function getOpenClawRuntimeMessageDir(workspacePath: string, providerConfig?: ProviderConfig): string {
  return path.join(getOpenClawStateDir(workspacePath, providerConfig), 'runtime-messages');
}

function writeOpenClawRuntimeMessageFile(
  workspacePath: string,
  providerConfig: ProviderConfig | undefined,
  message: string
): string {
  const messageDir = getOpenClawRuntimeMessageDir(workspacePath, providerConfig);
  fs.mkdirSync(messageDir, { recursive: true });
  const messagePath = path.join(
    messageDir,
    `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.txt`
  );
  fs.writeFileSync(messagePath, message, 'utf-8');
  return messagePath;
}

function deleteOpenClawRuntimeMessageFile(messagePath: string): void {
  try {
    if (fs.existsSync(messagePath)) {
      fs.unlinkSync(messagePath);
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function prepareOpenClawProviderConfig(workspacePath: string, providerConfig?: ProviderConfig): void {
  const model = getFirstModelId(providerConfig);
  if (!providerConfig?.baseUrl || !model) {
    return;
  }
  const api = getOpenClawProviderApi(providerConfig);

  const stateDir = getOpenClawStateDir(workspacePath, providerConfig);
  const configPath = getOpenClawConfigPath(workspacePath, providerConfig);
  const authProfilesPath = path.join(stateDir, 'agents', 'main', 'agent', 'auth-profiles.json');

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.mkdirSync(path.dirname(authProfilesPath), { recursive: true });

  const config = {
    agents: {
      defaults: {
        workspace: toWslPath(workspacePath),
        model: {
          primary: `${OPENCLAW_PROXY_PROVIDER_ID}/${model}`,
        },
      },
    },
    tools: {
      profile: 'coding',
    },
    auth: {
      profiles: {
        [`${OPENCLAW_PROXY_PROVIDER_ID}:default`]: {
          provider: OPENCLAW_PROXY_PROVIDER_ID,
          mode: 'api_key',
        },
      },
    },
    models: {
      mode: 'merge',
      providers: {
        [OPENCLAW_PROXY_PROVIDER_ID]: {
          baseUrl: normalizeBaseUrl(providerConfig.baseUrl),
          api,
          authHeader: true,
          models: [buildOpenClawModelConfig(model, providerConfig)],
        },
      },
    },
  };

  const authProfiles = {
    version: 1,
    profiles: {
      [`${OPENCLAW_PROXY_PROVIDER_ID}:default`]: {
        type: 'api_key',
        provider: OPENCLAW_PROXY_PROVIDER_ID,
        keyRef: {
          source: 'env',
          provider: 'default',
          id: 'OPENAI_API_KEY',
        },
      },
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  fs.writeFileSync(authProfilesPath, JSON.stringify(authProfiles, null, 2), 'utf-8');
}

function buildOpenClawShellScript(
  workspacePath: string,
  providerConfig: ProviderConfig | undefined,
  command: string
): string {
  const wslWorkspace = toWslPath(workspacePath);
  const wslStateDir = toWslPath(getOpenClawStateDir(workspacePath, providerConfig));
  const wslConfigPath = toWslPath(getOpenClawConfigPath(workspacePath, providerConfig));
  const apiKey = providerConfig?.apiKey || process.env.OPENCLAW_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = providerConfig?.baseUrl || process.env.OPENCLAW_BASE_URL || process.env.OPENAI_BASE_URL || '';

  const lines = [
    'set -e',
    `export OPENCLAW_WORKSPACE_DIR=${shellQuote(wslWorkspace)}`,
    `export OPENCLAW_WORKSPACE=${shellQuote(wslWorkspace)}`,
    `export OPENCLAW_STATE_DIR=${shellQuote(wslStateDir)}`,
    `export OPENCLAW_CONFIG_PATH=${shellQuote(wslConfigPath)}`,
  ];

  if (apiKey) {
    lines.push(`export OPENCLAW_API_KEY=${shellQuote(apiKey)}`);
    lines.push(`export OPENAI_API_KEY=${shellQuote(apiKey)}`);
  }

  if (baseUrl) {
    lines.push(`export OPENCLAW_BASE_URL=${shellQuote(baseUrl)}`);
    lines.push(`export OPENAI_BASE_URL=${shellQuote(baseUrl)}`);
  }

  lines.push(`mkdir -p ${shellQuote(wslWorkspace)} ${shellQuote(wslStateDir)}`);
  lines.push(`cd ${shellQuote(wslWorkspace)}`);
  lines.push(command);

  return lines.join('\n');
}

function getBashLauncher(script: string): { command: string; args: string[] } {
  return isWindows
    ? { command: 'wsl', args: ['bash', '-lc', script] }
    : { command: 'bash', args: ['-lc', script] };
}

function getClaudeCommand(): string {
  if (!isWindows) return 'claude';

  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const claudeExePath = path.join(
    appData,
    'npm',
    'node_modules',
    '@anthropic-ai',
    'claude-code',
    'bin',
    'claude.exe'
  );

  return fs.existsSync(claudeExePath) ? claudeExePath : 'claude.exe';
}

function getStringEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';

  if (isWindows) {
    const npmGlobalBin = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm')
      : path.join(os.homedir(), 'AppData', 'Roaming', 'npm');
    const currentPath = env[pathKey] || '';
    env[pathKey] = [npmGlobalBin, currentPath]
      .filter(Boolean)
      .join(path.delimiter);
  } else {
    const home = os.homedir();
    const pathEntries = [
      path.join(home, '.local', 'bin'),
      path.join(home, '.local', 'node-v24.16.0-linux-x64', 'bin'),
      path.join(home, '.npm-global', 'bin'),
      '/usr/local/sbin',
      '/usr/local/bin',
      '/usr/sbin',
      '/usr/bin',
      '/sbin',
      '/bin',
    ];
    const currentPath = env[pathKey] || '';
    env[pathKey] = [...pathEntries, currentPath]
      .filter(Boolean)
      .join(path.delimiter);
  }

  return env;
}

function getFirstModelId(providerConfig?: ProviderConfig): string | undefined {
  const model = providerConfig?.models?.[0];
  if (!model) return undefined;
  return typeof model === 'string' ? model : model.id || model.name;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl || '').trim().replace(/\/+$/, '');
}

function shouldUseOpenAiCompletions(providerConfig?: ProviderConfig): boolean {
  const baseUrl = normalizeBaseUrl(providerConfig?.baseUrl).toLowerCase();
  if (!baseUrl) return false;
  return !baseUrl.includes('api.openai.com');
}

function isDeepSeekProvider(providerConfig?: ProviderConfig): boolean {
  return normalizeBaseUrl(providerConfig?.baseUrl).toLowerCase().includes('deepseek.com');
}

function isKimiCodingProvider(providerConfig?: ProviderConfig): boolean {
  return normalizeBaseUrl(providerConfig?.baseUrl).toLowerCase().includes('api.kimi.com/coding');
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function getOpenClawProviderApi(providerConfig?: ProviderConfig): 'openai-responses' | 'openai-completions' {
  return shouldUseOpenAiCompletions(providerConfig) ? 'openai-completions' : 'openai-responses';
}

function buildOpenClawModelConfig(
  model: string,
  providerConfig?: ProviderConfig
): Record<string, unknown> {
  const api = getOpenClawProviderApi(providerConfig);

  if (isDeepSeekProvider(providerConfig)) {
    return {
      id: model,
      name: model,
      reasoning: true,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 1000000,
      maxTokens: 384000,
      api,
      compat: {
        supportsUsageInStreaming: true,
        supportsReasoningEffort: true,
        maxTokensField: 'max_tokens',
        supportsStrictMode: false,
        thinkingFormat: 'deepseek',
        supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      },
    };
  }

  const modelConfig: Record<string, unknown> = {
    id: model,
    name: model,
    reasoning: api === 'openai-responses',
    input: ['text'],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 1000000,
    maxTokens: 32768,
    api,
  };

  return modelConfig;
}

function cleanCliStderr(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes("Expected '=' in /etc/wsl.conf"))
    .filter((line) => !line.includes('no stdin data received in 3s'))
    .filter((line) => !line.includes('redirect stdin explicitly'))
    .join('\n');
}

function terminateProcessTree(childProcess: ChildProcess): void {
  if (isWindows && childProcess.pid) {
    try {
      execFileSync('taskkill', ['/PID', String(childProcess.pid), '/T', '/F'], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return;
    } catch {
      // Fall back to Node's best-effort kill below.
    }
  }

  childProcess.kill();
}

function buildOpenClawFileMessageCommand(args: string[], messagePath: string): string {
  const nodeWrapper = [
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const args = JSON.parse(process.env.OPENCLAW_RUNTIME_ARGS_JSON || '[]');",
    "const messagePath = process.env.OPENCLAW_RUNTIME_MESSAGE_FILE;",
    "if (!messagePath) { console.error('Missing OPENCLAW_RUNTIME_MESSAGE_FILE'); process.exit(1); }",
    "const messageIndex = args.indexOf('__OPENCLAW_RUNTIME_MESSAGE__');",
    "if (messageIndex === -1) { console.error('Missing runtime message placeholder'); process.exit(1); }",
    "args[messageIndex] = fs.readFileSync(messagePath, 'utf8');",
    "const child = spawn('openclaw', args, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });",
    "child.on('error', (error) => { console.error(error && error.message ? error.message : String(error)); process.exit(1); });",
    "child.on('close', (code, signal) => { if (signal) process.kill(process.pid, signal); process.exit(code ?? 1); });",
  ].join('\n');

  return [
    `export OPENCLAW_RUNTIME_MESSAGE_FILE=${shellQuote(toWslPath(messagePath))}`,
    `export OPENCLAW_RUNTIME_ARGS_JSON=${shellQuote(JSON.stringify(args))}`,
    "node <<'OPENCLAW_MESSAGE_WRAPPER'",
    nodeWrapper,
    'OPENCLAW_MESSAGE_WRAPPER',
  ].join('\n');
}

const PLATFORM_CONFIGS: Record<AgentPlatform, PlatformConfig> = {
  'claude-code': {
    command: getClaudeCommand(),
    args: (workspace) => ['-p', `--add-dir=${workspace}`],
    interactive: true,
    checkCommand: getClaudeCommand(),
    versionFlag: '--version',
    usePrintMode: true,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
  },
  'openclaw': {
    command: isWindows ? 'wsl' : 'bash',
    args: (workspace, providerConfig) => {
      const script = buildOpenClawShellScript(
        workspace,
        providerConfig,
        'exec openclaw tui --local --session main'
      );
      return isWindows ? ['bash', '-lc', script] : ['-lc', script];

      // 转换 Windows 路径为 WSL 路径格式
      // J:\path -> /mnt/j/path
      const wslWorkspace = workspace
        .replace(/^([A-Za-z]):/, (_match, letter) => `/mnt/${String(letter).toLowerCase()}`)
        .replace(/\\/g, '/');

      const apiKey = providerConfig?.apiKey || process.env.OPENCLAW_API_KEY || '';
      const baseUrl = providerConfig?.baseUrl || '';

      // Optional: per-agent isolated state dir
      const stateDir = providerConfig?.stateDir || process.env.OPENCLAW_STATE_DIR || '';
      const stateDirStr = typeof stateDir === 'string' ? stateDir : '';
      const wslStateDir = stateDirStr
        ? stateDirStr
            .replace(/^([A-Za-z]):/, (_match, letter) => `/mnt/${String(letter).toLowerCase()}`)
            .replace(/\\/g, '/')
        : '';

      // 完整的 openclaw 启动流程：
      // 1. 启动 gateway
      // 2. 等待网关就绪
      // 3. 切换到 workspace 目录
      // 4. 启动 tui（会自动使用当前目录作为 workspace）
      return [
        'bash', '-c',
        `export OPENCLAW_API_KEY=\"${apiKey}\" && ` +
        (baseUrl ? `export OPENCLAW_BASE_URL=\"${baseUrl}\" && ` : '') +
        (wslStateDir ? `export OPENCLAW_STATE_DIR=\"${wslStateDir}\" && ` : '') +
        `openclaw gateway & ` +
        `sleep 4 && ` +
        `cd \"${wslWorkspace}\" && ` +
        `openclaw tui`
      ];
    },
    interactive: true,
    workspaceEnv: 'OPENCLAW_WORKSPACE_DIR',
    checkCommand: isWindows ? 'wsl' : 'openclaw',
    versionFlag: '--version',
    useShell: false,
    apiKeyEnv: 'OPENCLAW_API_KEY',
    baseUrlEnv: 'OPENCLAW_BASE_URL',
  },
  'codex': {
    command: isWindows ? 'npx.cmd' : 'npx',
    args: () => ['-y', '@openai/codex', '--print'],
    interactive: false,
    checkCommand: isWindows ? 'npx.cmd' : 'npx',
    versionFlag: '--version',
    usePrintMode: true,
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
  'hermes': {
    command: isWindows ? 'hermes.cmd' : 'hermes',
    args: () => ['-z'],
    interactive: false,
    checkCommand: isWindows ? 'hermes.cmd' : 'hermes',
    versionFlag: 'version',
    usePrintMode: true,
    apiKeyEnv: 'HERMES_API_KEY',
  },
  'opencode': {
    command: 'opencode',
    args: () => ['--print'],
    interactive: false,
    checkCommand: 'opencode',
    versionFlag: '--version',
    usePrintMode: true,
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
  },
};

function getCliHealthInvocation(platform: AgentPlatform): { command: string; args: string[]; usesWsl: boolean } {
  const config = PLATFORM_CONFIGS[platform];
  if (platform === 'openclaw' && isWindows) {
    return {
      command: 'wsl',
      args: ['bash', '-lc', 'command -v openclaw >/dev/null && openclaw --version'],
      usesWsl: true,
    };
  }

  return {
    command: config.checkCommand,
    args: [config.versionFlag],
    usesWsl: false,
  };
}

function redactRuntimeDiagnostic(value: unknown): string {
  const raw = Buffer.isBuffer(value)
    ? value.toString('utf-8')
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value);
  let text = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();

  for (const [name, envValue] of Object.entries(process.env)) {
    if (!envValue || envValue.length < 8) continue;
    if (!/(KEY|TOKEN|SECRET|PASSWORD|AUTH|CREDENTIAL)/i.test(name)) continue;
    text = text.split(envValue).join(`[redacted:${name}]`);
  }

  text = text
    .replace(/\bsk-[A-Za-z0-9_\-]{12,}\b/g, '[redacted:key]')
    .replace(/\b(?:anthropic|claude|openai|cohere|deepseek|kimi|coze)[_-]?[A-Za-z0-9_\-]{16,}\b/gi, '[redacted:token]');

  return text.slice(0, 600);
}

function buildCliHealthResult(
  invocation: { command: string; args: string[]; usesWsl: boolean },
  overrides: Partial<CliHealthCheck>
): CliHealthCheck {
  return {
    available: false,
    version: '',
    command: invocation.command,
    args: invocation.args,
    displayCommand: [invocation.command, ...invocation.args].map(displayShellArg).join(' '),
    usesWsl: invocation.usesWsl,
    ...overrides,
  };
}

export function formatCliHealthFailure(platform: AgentPlatform | string, cli: CliHealthCheck): string {
  const detail = cli.stderr || cli.errorMessage || cli.stdout || '';
  const code = [cli.errorCode, cli.errorName].filter(Boolean).join('/');
  const prefix = `${platform} CLI 不可用`;
  const command = cli.displayCommand ? `检查命令：${cli.displayCommand}` : `命令：${cli.command}`;
  const reason = detail || code || (cli.status != null ? `退出码 ${cli.status}` : '') || '未返回详细错误';
  return `${prefix}。${command}。${code ? `错误：${code}。` : ''}${reason}`;
}

class AgentRunner extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private outputBuffers: Map<string, string> = new Map();

  async checkCliAvailable(platform: AgentPlatform): Promise<CliHealthCheck> {
    const invocation = getCliHealthInvocation(platform);

    try {
      const output = execFileSync(invocation.command, invocation.args, {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: getStringEnv(),
      });
      return buildCliHealthResult(invocation, {
        available: true,
        version: redactRuntimeDiagnostic(output),
      });
    } catch (error) {
      const err = error as Error & {
        code?: string;
        status?: number | null;
        signal?: string | null;
        stderr?: Buffer | string;
        stdout?: Buffer | string;
      };
      return buildCliHealthResult(invocation, {
        available: false,
        version: '',
        errorName: err.name,
        errorCode: typeof err.code === 'string' ? err.code : undefined,
        errorMessage: redactRuntimeDiagnostic(err.message),
        status: typeof err.status === 'number' ? err.status : null,
        signal: typeof err.signal === 'string' ? err.signal : null,
        stderr: redactRuntimeDiagnostic(err.stderr),
        stdout: redactRuntimeDiagnostic(err.stdout),
      });
    }
  }

  async getAvailablePlatforms(): Promise<{ platform: AgentPlatform; available: boolean; version: string }[]> {
    const results = [];
    for (const platform of Object.keys(PLATFORM_CONFIGS) as AgentPlatform[]) {
      const check = await this.checkCliAvailable(platform);
      results.push({ platform, ...check });
    }
    return results;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private extractOpenClawText(rawOutput: string): string {
    const trimmed = rawOutput.trim();
    if (!trimmed) return '';

    const candidates = [trimmed, ...trimmed.split(/\r?\n/).reverse()];
    for (const candidate of candidates) {
      try {
        const parsed: unknown = JSON.parse(candidate);
        const text = this.findStringField(parsed, [
          'content',
          'message',
          'reply',
          'response',
          'text',
          'output',
          'result',
        ]);
        if (text) return text;
      } catch {
        // Try the next candidate.
      }
    }

    return trimmed;
  }

  private findStringField(value: unknown, keys: string[]): string | null {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findStringField(item, keys);
        if (found) return found;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const direct = record[key];
      if (typeof direct === 'string' && direct.trim()) return direct;
      const nested = this.findStringField(direct, keys);
      if (nested) return nested;
    }

    for (const nested of Object.values(record)) {
      const found = this.findStringField(nested, keys);
      if (found) return found;
    }

    return null;
  }

  private extractCliText(rawOutput: string): string {
    const trimmed = rawOutput.trim();
    if (!trimmed) return '';

    const candidates = [trimmed, ...trimmed.split(/\r?\n/).reverse()];
    for (const candidate of candidates) {
      try {
        const parsed: unknown = JSON.parse(candidate);
        const text = this.findStringField(parsed, [
          'result',
          'content',
          'message',
          'reply',
          'response',
          'text',
          'output',
        ]);
        if (text) return text;
      } catch {
        // Try the next candidate.
      }
    }

    return trimmed;
  }

  private buildProviderEnv(
    config: PlatformConfig,
    workspacePath: string,
    providerConfig?: ProviderConfig
  ): Record<string, string> {
    const env = getStringEnv();
    if (config.workspaceEnv) {
      env[config.workspaceEnv] = workspacePath;
    }

    if (providerConfig) {
      if (config.apiKeyEnv) {
        env[config.apiKeyEnv] = providerConfig.apiKey;
      }
      if (config.baseUrlEnv && providerConfig.baseUrl) {
        env[config.baseUrlEnv] = isKimiCodingProvider(providerConfig)
          ? ensureTrailingSlash(normalizeBaseUrl(providerConfig.baseUrl))
          : providerConfig.baseUrl;
      }

      if (config.apiKeyEnv === 'ANTHROPIC_API_KEY' && isKimiCodingProvider(providerConfig)) {
        env.ANTHROPIC_AUTH_TOKEN = providerConfig.apiKey;
      }
    }

    return env;
  }

  private buildOneShotArgs(
    platform: AgentPlatform,
    workspacePath: string,
    message: string,
    providerConfig?: ProviderConfig
  ): string[] {
    const model = getFirstModelId(providerConfig);

    if (platform === 'hermes') {
      return ['-z', message];
    }

    if (platform === 'claude-code') {
      const args = [
        '-p',
        message,
        `--add-dir=${workspacePath}`,
        '--output-format=json',
        '--no-chrome',
      ];
      if (isKimiCodingProvider(providerConfig)) {
        args.push('--bare');
      }
      if (model) {
        args.push('--model', model);
      }
      return args;
    }

    if (platform === 'codex') {
      const args = ['-y', '@openai/codex', '--print'];
      if (model) {
        args.push('--model', model);
      }
      args.push(message);
      return args;
    }

    if (platform === 'opencode') {
      const args = ['--print', message];
      if (model) {
        args.push('--model', model);
      }
      return args;
    }

    return PLATFORM_CONFIGS[platform].args(workspacePath, providerConfig);
  }

  private executeOneShotTurn(session: AgentSession, message: string): Promise<string> {
    const config = PLATFORM_CONFIGS[session.platform];
    const args = this.buildOneShotArgs(
      session.platform,
      session.workspacePath,
      message,
      session.providerConfig
    );
    const env = this.buildProviderEnv(config, session.workspacePath, session.providerConfig);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      const childProcess = spawn(config.command, args, {
        cwd: session.workspacePath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: config.useShell ?? false,
      });

      session.process = childProcess;
      childProcess.stdin?.end();

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code) => {
        session.process = null;
        if (session.status !== 'stopped') {
          session.status = code === 0 ? 'idle' : 'error';
        }

        if (code === 0) {
          resolve(this.extractCliText(output));
        } else {
          const outputText = this.extractCliText(output);
          const stderrText = cleanCliStderr(errorOutput);
          reject(new Error(outputText || stderrText || `${session.platform} exited with code ${code}`));
        }
      });

      childProcess.on('error', (error) => {
        session.process = null;
        session.status = 'error';
        reject(error);
      });
    });
  }

  private executeOpenClawTurn(session: AgentSession, message: string, timeoutMs = 300000): Promise<string> {
    const providerConfig = session.providerConfig;
    const sessionKey = `agent:${session.agentId}:${session.sessionId}`;
    prepareOpenClawProviderConfig(session.workspacePath, providerConfig);
    const messagePath = writeOpenClawRuntimeMessageFile(session.workspacePath, providerConfig, message);

    const configuredModel = getFirstModelId(providerConfig);
    const model = configuredModel && providerConfig?.baseUrl
      ? `${OPENCLAW_PROXY_PROVIDER_ID}/${configuredModel}`
      : configuredModel;
    const commandParts = [
      'agent',
      '--local',
    ];

    if (model) {
      commandParts.push('--model', model);
    }

    commandParts.push(
      '--session-key',
      sessionKey,
      '--message',
      OPENCLAW_MESSAGE_ARG_PLACEHOLDER
    );

    const commandSuffixParts = [
      '--timeout',
      String(Math.max(1, Math.ceil(timeoutMs / 1000))),
      '--json',
    ];

    const script = buildOpenClawShellScript(
      session.workspacePath,
      providerConfig,
      buildOpenClawFileMessageCommand([...commandParts, ...commandSuffixParts], messagePath)
    );
    const launcher = getBashLauncher(script);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let settled = false;

      const childProcess = spawn(launcher.command, launcher.args, {
        cwd: session.workspacePath,
        env: getStringEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      session.process = childProcess;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        session.process = null;
        session.status = 'error';
        terminateProcessTree(childProcess);
        deleteOpenClawRuntimeMessageFile(messagePath);
        reject(new Error(`Command timed out after ${Math.ceil(timeoutMs / 1000)} seconds`));
      }, timeoutMs);

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        session.process = null;
        deleteOpenClawRuntimeMessageFile(messagePath);
        if (session.status !== 'stopped') {
          session.status = code === 0 ? 'idle' : 'error';
        }

        if (code === 0) {
          resolve(this.extractOpenClawText(output));
        } else {
          reject(new Error(errorOutput.trim() || output.trim() || `OpenClaw exited with code ${code}`));
        }
      });

      childProcess.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        session.process = null;
        session.status = 'error';
        deleteOpenClawRuntimeMessageFile(messagePath);
        reject(error);
      });
    });
  }

  /**
   * Execute a single message and return response
   * Used for platforms that work best with one-shot execution
   */
  async executeMessage(
    agentId: string,
    platform: AgentPlatform,
    workspacePath: string,
    message: string,
    providerConfig?: ProviderConfig,
    timeoutMs = 300000
  ): Promise<string> {
    const resolvedWorkspacePath = resolveHostPath(workspacePath);
    const resolvedProviderConfig = providerConfig
      ? {
          ...providerConfig,
          stateDir: providerConfig.stateDir ? resolveHostPath(providerConfig.stateDir) : undefined,
        }
      : undefined;

    if (!fs.existsSync(resolvedWorkspacePath)) {
      throw new Error(`Workspace not found: ${resolvedWorkspacePath}`);
    }

    const cliCheck = await this.checkCliAvailable(platform);
    if (!cliCheck.available) {
      throw new Error(formatCliHealthFailure(platform, cliCheck));
    }

    if (platform === 'openclaw') {
      const session: AgentSession = {
        sessionId: this.generateSessionId(),
        agentId,
        platform,
        workspacePath: resolvedWorkspacePath,
        process: null,
        status: 'waiting',
        startedAt: new Date(),
        providerConfig: resolvedProviderConfig,
      };
      return this.executeOpenClawTurn(session, message, timeoutMs);
    }

    const config = PLATFORM_CONFIGS[platform];
    
    // Build environment
    const env = this.buildProviderEnv(config, resolvedWorkspacePath, resolvedProviderConfig);

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let settled = false;

      const args = this.buildOneShotArgs(platform, resolvedWorkspacePath, message, resolvedProviderConfig);

      console.log(`Executing ${platform} one-shot command with ${args.length} args`);
      console.log(`Workspace: ${resolvedWorkspacePath}`);

      const childProcess = spawn(config.command, args, {
        cwd: resolvedWorkspacePath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: config.useShell ?? false,
      });

      childProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) {
          resolve(this.extractCliText(output));
        } else {
          const outputText = this.extractCliText(output);
          const stderrText = cleanCliStderr(errorOutput);
          reject(new Error(outputText || stderrText || `Process exited with code ${code}`));
        }
      });

      childProcess.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        terminateProcessTree(childProcess);
        reject(new Error(`Command timed out after ${Math.ceil(timeoutMs / 1000)} seconds`));
      }, timeoutMs);
    });
  }

  /**
   * Start a persistent interactive session
   */
  async startSession(
    agentId: string,
    platform: AgentPlatform,
    workspacePath: string,
    providerConfig?: ProviderConfig
  ): Promise<AgentSession> {
    const resolvedWorkspacePath = resolveHostPath(workspacePath);
    const resolvedProviderConfig = providerConfig
      ? {
          ...providerConfig,
          stateDir: providerConfig.stateDir ? resolveHostPath(providerConfig.stateDir) : undefined,
        }
      : undefined;

    if (!fs.existsSync(resolvedWorkspacePath)) {
      throw new Error(`Workspace not found: ${resolvedWorkspacePath}`);
    }

    const cliCheck = await this.checkCliAvailable(platform);
    if (!cliCheck.available) {
      throw new Error(formatCliHealthFailure(platform, cliCheck));
    }

    const sessionId = this.generateSessionId();
    const config = PLATFORM_CONFIGS[platform];

    if (platform === 'openclaw') {
      const session: AgentSession = {
        sessionId,
        agentId,
        platform,
        workspacePath: resolvedWorkspacePath,
        process: null,
        status: 'idle',
        startedAt: new Date(),
        providerConfig: resolvedProviderConfig,
      };

      this.sessions.set(sessionId, session);
      this.outputBuffers.set(sessionId, '');
      this.emit('sessionStart', { sessionId, agentId, platform });

      return session;
    }

    if (config.usePrintMode) {
      const session: AgentSession = {
        sessionId,
        agentId,
        platform,
        workspacePath: resolvedWorkspacePath,
        process: null,
        status: 'idle',
        startedAt: new Date(),
        providerConfig: resolvedProviderConfig,
      };

      this.sessions.set(sessionId, session);
      this.outputBuffers.set(sessionId, '');
      this.emit('sessionStart', { sessionId, agentId, platform });

      return session;
    }

    // Build environment with provider config
    const env = this.buildProviderEnv(config, resolvedWorkspacePath, resolvedProviderConfig);

    // For interactive sessions, just spawn and wait for messages
    const args = config.args(resolvedWorkspacePath, resolvedProviderConfig);

    const childProcess = spawn(config.command, args, {
      cwd: resolvedWorkspacePath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: config.useShell ?? true,
    });

    const session: AgentSession = {
      sessionId,
      agentId,
      platform,
      workspacePath: resolvedWorkspacePath,
      process: childProcess,
      status: 'running',
      startedAt: new Date(),
      providerConfig: resolvedProviderConfig,
    };

    this.sessions.set(sessionId, session);
    this.outputBuffers.set(sessionId, '');

    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.outputBuffers.set(sessionId, this.outputBuffers.get(sessionId)! + text);
      
      this.emit('response', {
        sessionId,
        response: {
          type: 'output',
          content: text,
          timestamp: new Date(),
        } as RunnerResponse,
      });
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      
      this.emit('response', {
        sessionId,
        response: {
          type: 'error',
          content: text,
          timestamp: new Date(),
        } as RunnerResponse,
      });
    });

    childProcess.on('exit', (code) => {
      const sess = this.sessions.get(sessionId);
      if (sess) {
        sess.process = null;
        sess.status = code === 0 ? 'idle' : 'error';
      }
      
      this.emit('response', {
        sessionId,
        response: {
          type: 'done',
          content: `Process exited with code ${code}`,
          timestamp: new Date(),
        } as RunnerResponse,
      });
      
      this.emit('sessionEnd', { sessionId, exitCode: code });
      
      setTimeout(() => {
        this.sessions.delete(sessionId);
        this.outputBuffers.delete(sessionId);
      }, 60000);
    });

    this.emit('sessionStart', { sessionId, agentId, platform });

    return session;
  }

  sendMessage(sessionId: string, message: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.platform === 'openclaw') {
      if (session.status === 'waiting') {
        this.emit('response', {
          sessionId,
          response: {
            type: 'error',
            content: 'OpenClaw is still processing the previous message.',
            timestamp: new Date(),
          } as RunnerResponse,
        });
        return true;
      }

      session.status = 'waiting';
      void this.executeOpenClawTurn(session, message)
        .then((content) => {
          const text = content || 'OpenClaw completed without output.';
          this.outputBuffers.set(sessionId, `${this.outputBuffers.get(sessionId) || ''}${text}`);
          this.emit('response', {
            sessionId,
            response: {
              type: 'output',
              content: text,
              timestamp: new Date(),
            } as RunnerResponse,
          });
        })
        .catch((error: unknown) => {
          const content = error instanceof Error ? error.message : 'OpenClaw failed to process the message.';
          this.emit('response', {
            sessionId,
            response: {
              type: 'error',
              content,
              timestamp: new Date(),
            } as RunnerResponse,
          });
      });
      return true;
    }

    const config = PLATFORM_CONFIGS[session.platform];
    if (config.usePrintMode) {
      if (session.status === 'waiting') {
        this.emit('response', {
          sessionId,
          response: {
            type: 'error',
            content: `${session.platform} is still processing the previous message.`,
            timestamp: new Date(),
          } as RunnerResponse,
        });
        return true;
      }

      session.status = 'waiting';
      void this.executeOneShotTurn(session, message)
        .then((content) => {
          const text = content || `${session.platform} completed without output.`;
          this.outputBuffers.set(sessionId, `${this.outputBuffers.get(sessionId) || ''}${text}`);
          this.emit('response', {
            sessionId,
            response: {
              type: 'output',
              content: text,
              timestamp: new Date(),
            } as RunnerResponse,
          });
        })
        .catch((error: unknown) => {
          const content = error instanceof Error ? error.message : `${session.platform} failed to process the message.`;
          this.emit('response', {
            sessionId,
            response: {
              type: 'error',
              content,
              timestamp: new Date(),
            } as RunnerResponse,
          });
        });
      return true;
    }

    if (!session.process || session.process.stdin === null) {
      return false;
    }

    try {
      session.process.stdin.write(message + '\n');
      session.status = 'waiting';
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  getBufferedOutput(sessionId: string): string {
    return this.outputBuffers.get(sessionId) || '';
  }

  clearBuffer(sessionId: string): void {
    this.outputBuffers.set(sessionId, '');
  }

  async stopSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      if (session.process) {
        session.process.stdin?.write('\x03');
        session.process.stdin?.write('exit\n');
        
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        if (!session.process.killed) {
          session.process.kill('SIGTERM');
        }
        session.process = null;
      }
      
      session.status = 'stopped';
      return true;
    } catch (error) {
      console.error('Failed to stop session:', error);
      return false;
    }
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByAgentId(agentId: string): AgentSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.agentId === agentId) {
        return session;
      }
    }
    return undefined;
  }

  getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'running' || s.status === 'waiting'
    );
  }

  async stopSessionsByAgentId(agentId: string): Promise<number> {
    const sessionIds = Array.from(this.sessions.values())
      .filter((session) => session.agentId === agentId)
      .map((session) => session.sessionId);

    for (const sessionId of sessionIds) {
      await this.stopSession(sessionId);
    }

    return sessionIds.length;
  }

  async stopAll(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.stopSession(sessionId);
    }
  }
}

export const agentRunner = new AgentRunner();

export default agentRunner;
