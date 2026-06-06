const API_BASE = process.env.SMOKE_API_BASE || 'http://localhost:3002';
const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const secretValue = `sk-runtime-health-secret-${unique}`;

interface AuthPayload {
  accessToken: string;
}

interface RuntimeHealthPayload {
  health?: {
    checkedAt?: string;
    platforms?: Array<{
      platform?: string;
      label?: string;
      cli?: {
        available?: boolean;
        version?: string;
        command?: string;
        args?: string[];
        displayCommand?: string;
        usesWsl?: boolean;
        errorName?: string;
        errorCode?: string;
        errorMessage?: string;
        stderr?: string;
        stdout?: string;
      };
      provider?: { configuredCount?: number; envConfigured?: boolean; envVarNames?: string[] };
      ready?: boolean;
      issues?: string[];
    }>;
    summary?: {
      total?: number;
      ready?: number;
      missingCli?: number;
      missingProvider?: number;
    };
  };
}

async function request<T>(pathname: string, options: RequestInit = {}): Promise<{ payload: T; raw: string }> {
  const response = await fetch(`${API_BASE}${pathname}`, options);
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) as T : {} as T;
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed: HTTP ${response.status} ${raw}`);
  }
  return { payload, raw };
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function main() {
  const { payload: registerPayload } = await request<AuthPayload>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `runtime-health-${unique}@example.test`,
      username: `rh${unique.slice(-10)}`,
      password: 'smoke-password',
    }),
  });
  const token = registerPayload.accessToken;
  if (!token) throw new Error('Register response did not include accessToken.');

  await request('/api/providers', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: `Runtime Health Smoke ${unique}`,
      type: 'codex',
      apiKey: secretValue,
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-5.1'],
    }),
  });

  const { payload, raw } = await request<RuntimeHealthPayload>('/api/providers/runtime-health', {
    headers: authHeaders(token),
  });

  if (raw.includes(secretValue)) {
    throw new Error('Runtime health response leaked provider API key.');
  }
  const platforms = payload.health?.platforms || [];
  const names = platforms.map((item) => item.platform).sort();
  for (const expected of ['claude-code', 'codex', 'hermes', 'openclaw', 'opencode']) {
    if (!names.includes(expected)) {
      throw new Error(`Runtime health missing platform: ${expected}`);
    }
  }
  for (const platform of platforms) {
    if (!platform.cli?.command || !platform.cli.displayCommand || !Array.isArray(platform.cli.args)) {
      throw new Error(`Runtime health missing CLI diagnostics for ${platform.platform}.`);
    }
    if (typeof platform.cli.usesWsl !== 'boolean') {
      throw new Error(`Runtime health missing usesWsl diagnostic for ${platform.platform}.`);
    }
    const diagnosticText = [
      platform.cli.command,
      platform.cli.displayCommand,
      platform.cli.errorMessage,
      platform.cli.stderr,
      platform.cli.stdout,
    ].filter(Boolean).join('\n');
    if (diagnosticText.includes(secretValue)) {
      throw new Error(`Runtime health CLI diagnostics leaked provider API key for ${platform.platform}.`);
    }
  }
  const codex = platforms.find((item) => item.platform === 'codex');
  if (!codex || (codex.provider?.configuredCount || 0) < 1) {
    throw new Error('Runtime health did not count the configured codex provider.');
  }
  if (payload.health?.summary?.total !== 5) {
    throw new Error(`Expected 5 platforms, got ${payload.health?.summary?.total}`);
  }

  console.log(JSON.stringify({
    apiBase: API_BASE,
    runtimeHealthVerified: true,
    platformCount: platforms.length,
    platforms: names,
    codexProviderCount: codex.provider?.configuredCount,
    secretLeaked: false,
    summary: payload.health?.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
