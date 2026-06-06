import fs from 'fs';
import path from 'path';

export interface PublishRisk {
  path: string;
  reason: string;
}

export interface PublishFileSanitization {
  buffer: Buffer | null;
  risks: PublishRisk[];
  action: 'copy' | 'redact' | 'omit';
}

const MAX_TEXT_SCAN_BYTES = 256 * 1024;

const PUBLISH_SKIP_DIR_NAMES = new Set([
  '.openclaw',
  '.git',
  '.hg',
  '.svn',
  '.chat-assets',
  '.cache',
  '.next',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__pycache__',
]);

const PUBLISH_SKIP_FILE_NAMES = new Set([
  'agent.config.json',
  '.ds_store',
  'thumbs.db',
]);

const SENSITIVE_PATH_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: '环境变量文件', pattern: /(^|\/)\.env($|[./])/i },
  { reason: 'Git 历史目录', pattern: /(^|\/)\.git($|\/)/i },
  { reason: '私钥文件', pattern: /(^|\/)(id_rsa|id_ed25519|id_ecdsa|.*\.(pem|key|p12|pfx|pkcs8))$/i },
  { reason: '凭证文件', pattern: /(^|\/)(secrets?|credentials?|tokens?|api[_-]?keys?)\.(json|ya?ml|toml|ini|env|txt)$/i },
  { reason: 'Agent 本地配置可能包含密钥', pattern: /(^|\/)agent\.config\.json$/i },
  { reason: 'OpenClaw 鉴权配置', pattern: /(^|\/)auth-profiles\.json$/i },
  { reason: 'Codex 鉴权配置', pattern: /(^|\/)\.codex\/(auth|credentials)\.(json|toml)$/i },
  { reason: 'Claude 本地配置', pattern: /(^|\/)\.claude\/settings\.local\.json$/i },
];

const SECRET_CONTENT_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: '私钥内容', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { reason: 'OpenAI 风格 API Key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { reason: 'Anthropic API Key', pattern: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/ },
  { reason: 'GitHub Token', pattern: /\bgh[opusr]_[A-Za-z0-9_]{30,}\b/ },
  { reason: 'Google API Key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { reason: 'JWT Token', pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b/ },
  {
    reason: '疑似密钥变量',
    pattern: /\b(API[_-]?KEY|SECRET|TOKEN|PASSWORD|ACCESS[_-]?KEY)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
  },
];

const SECRET_CONTENT_REDACTION_PATTERNS = SECRET_CONTENT_PATTERNS.map(({ reason, pattern }) => ({
  reason,
  pattern: new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`),
}));

const TEXT_EXTENSIONS = new Set([
  '.env',
  '.json',
  '.toml',
  '.yaml',
  '.yml',
  '.ini',
  '.conf',
  '.txt',
  '.md',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
]);

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function shouldSkipPublishPath(relativePath: string, isDirectory = false): boolean {
  const normalized = normalizeRelativePath(relativePath).replace(/\/+$/, '');
  if (!normalized) return false;

  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => PUBLISH_SKIP_DIR_NAMES.has(segment.toLowerCase()))) {
    return true;
  }

  if (!isDirectory) {
    const basename = path.posix.basename(normalized).toLowerCase();
    if (PUBLISH_SKIP_FILE_NAMES.has(basename)) {
      return true;
    }
  }

  return false;
}

function isTextLike(relativePath: string, buffer: Buffer): boolean {
  if (buffer.length > MAX_TEXT_SCAN_BYTES) return false;
  if (buffer.includes(0)) return false;

  const base = path.posix.basename(normalizeRelativePath(relativePath)).toLowerCase();
  const ext = path.posix.extname(base);
  return TEXT_EXTENSIONS.has(ext) || base === '.env' || base.startsWith('.env.');
}

export function scanPublishPath(relativePath: string): PublishRisk[] {
  const normalized = normalizeRelativePath(relativePath);
  const risks: PublishRisk[] = [];

  for (const { reason, pattern } of SENSITIVE_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      risks.push({ path: normalized, reason });
      return risks;
    }
  }

  return risks;
}

export function scanPublishFile(relativePath: string, buffer?: Buffer): PublishRisk[] {
  const normalized = normalizeRelativePath(relativePath);
  const pathRisks = scanPublishPath(normalized);
  if (pathRisks.length > 0) return pathRisks;
  const risks: PublishRisk[] = [];

  if (!buffer || !isTextLike(normalized, buffer)) {
    return risks;
  }

  const text = buffer.toString('utf-8');
  for (const { reason, pattern } of SECRET_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      risks.push({ path: normalized, reason });
      return risks;
    }
  }

  return risks;
}

export function sanitizePublishFileForMarket(relativePath: string, buffer: Buffer): PublishFileSanitization {
  const normalized = normalizeRelativePath(relativePath);
  const pathRisks = scanPublishPath(normalized);
  if (pathRisks.length > 0) {
    return { buffer: null, risks: pathRisks, action: 'omit' };
  }

  if (!isTextLike(normalized, buffer)) {
    return { buffer, risks: [], action: 'copy' };
  }

  let text = buffer.toString('utf-8');
  const risks: PublishRisk[] = [];
  for (const { reason, pattern } of SECRET_CONTENT_REDACTION_PATTERNS) {
    if (pattern.test(text)) {
      risks.push({ path: normalized, reason });
      text = text.replace(pattern, '[REDACTED_FOR_AGENT_MARKET]');
    }
    pattern.lastIndex = 0;
  }

  return {
    buffer: risks.length > 0 ? Buffer.from(text, 'utf-8') : buffer,
    risks,
    action: risks.length > 0 ? 'redact' : 'copy',
  };
}

export function scanPublishDirectory(rootDir: string): PublishRisk[] {
  const risks: PublishRisk[] = [];
  if (!fs.existsSync(rootDir)) return risks;

  const visit = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);
      const normalized = normalizeRelativePath(relativePath);

      if (shouldSkipPublishPath(normalized, entry.isDirectory()) || entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        const dirRisk = scanPublishFile(`${normalized}/`);
        if (dirRisk.length > 0) {
          risks.push(...dirRisk);
          continue;
        }
        visit(fullPath);
        continue;
      }

      try {
        const stat = fs.statSync(fullPath);
        const buffer = stat.size <= MAX_TEXT_SCAN_BYTES ? fs.readFileSync(fullPath) : undefined;
        risks.push(...scanPublishFile(normalized, buffer));
      } catch {
        risks.push({ path: normalized, reason: 'Cannot read file for market safety scan' });
      }
    }
  };

  visit(rootDir);
  return risks;
}

export function formatPublishRiskMessage(risks: PublishRisk[]): string {
  const preview = risks
    .slice(0, 5)
    .map((risk) => `${risk.path}（${risk.reason}）`)
    .join('、');
  const suffix = risks.length > 5 ? ` 等 ${risks.length} 项` : '';
  return `检测到敏感配置或密钥文件：${preview}${suffix}。请删除这些文件后再上传到 Agent 市场。`;
}

export function formatPublishSanitizationMessage(risks: PublishRisk[]): string {
  const preview = risks
    .slice(0, 5)
    .map((risk) => `${risk.path}（${risk.reason}）`)
    .join('、');
  const suffix = risks.length > 5 ? ` 等 ${risks.length} 项` : '';
  return `已自动脱敏市场副本：${preview}${suffix}。源 Agent 文件未被修改。`;
}
