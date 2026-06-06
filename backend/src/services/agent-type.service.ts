export type AgentPlatformType =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'openclaw'
  | 'hermes'
  | 'unknown';

const VALID_TYPES: AgentPlatformType[] = [
  'claude-code',
  'codex',
  'opencode',
  'openclaw',
  'hermes',
  'unknown',
];

interface DetectionRule {
  type: Exclude<AgentPlatformType, 'unknown'>;
  pathPatterns: RegExp[];
  weight: number;
}

const DETECTION_RULES: DetectionRule[] = [
  {
    type: 'claude-code',
    pathPatterns: [/^\.claude\//i, /(^|\/)CLAUDE\.md$/i, /^\.claude\/settings\.json$/i],
    weight: 3,
  },
  {
    type: 'codex',
    pathPatterns: [/^\.codex\//i, /(^|\/)codex\.toml$/i],
    weight: 3,
  },
  {
    type: 'opencode',
    pathPatterns: [/^\.opencode\//i, /(^|\/)opencode\.json$/i],
    weight: 3,
  },
  {
    type: 'openclaw',
    pathPatterns: [/^\.openclaw\//i, /(^|\/)agent\.manifest\.json$/i],
    weight: 3,
  },
  {
    type: 'hermes',
    pathPatterns: [/^\.hermes\//i, /(^|\/)hermes\.(yaml|yml|json)$/i],
    weight: 3,
  },
];

export function normalizeAgentType(value?: string | null): AgentPlatformType {
  if (!value) return 'unknown';
  const v = value.toLowerCase().trim();
  if (VALID_TYPES.includes(v as AgentPlatformType)) {
    return v as AgentPlatformType;
  }
  return 'unknown';
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function stripCommonRootPrefix(paths: string[]): string[] {
  if (paths.length === 0) return paths;

  const parts = paths.map((p) => normalizePath(p).split('/'));
  const root = parts[0][0];
  if (parts.every((seg) => seg.length > 1 && seg[0] === root)) {
    return paths.map((p) => {
      const normalized = normalizePath(p);
      const slashIndex = normalized.indexOf('/');
      return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
    });
  }

  return paths.map(normalizePath);
}

function hasPathSegment(paths: string[], segment: string): boolean {
  const needle = segment.toLowerCase();
  return paths.some((p) =>
    normalizePath(p)
      .split('/')
      .some((part) => part.toLowerCase() === needle)
  );
}

function detectForcedAgentTypeFromPaths(filePaths: string[]): AgentPlatformType {
  const normalized = filePaths.map(normalizePath);
  const stripped = stripCommonRootPrefix(normalized);
  const paths = Array.from(new Set([...normalized, ...stripped]));

  const hasClaude = hasPathSegment(paths, '.claude');
  const hasCodex = hasPathSegment(paths, '.codex');

  if (hasClaude && !hasCodex) return 'claude-code';
  if (hasCodex && !hasClaude) return 'codex';
  return 'unknown';
}

export function detectAgentTypeFromPaths(filePaths: string[]): AgentPlatformType {
  const paths = stripCommonRootPrefix(filePaths.map(normalizePath));

  const scores: Partial<Record<AgentPlatformType, number>> = {};
  for (const rule of DETECTION_RULES) {
    let score = 0;
    for (const p of paths) {
      if (rule.pathPatterns.some((pat) => pat.test(p))) {
        score += rule.weight;
      }
    }
    if (score > 0) scores[rule.type] = score;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'unknown';

  const [top, topScore] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  if (topScore >= 3 && topScore > second) {
    return top as AgentPlatformType;
  }
  return 'unknown';
}

export function resolveAgentType(
  userSelected: string | undefined,
  filePaths: string[],
  manifestType?: string
): AgentPlatformType {
  const fromUser = normalizeAgentType(userSelected);
  if (fromUser !== 'unknown') return fromUser;

  const forcedFromPath = detectForcedAgentTypeFromPaths(filePaths);
  if (forcedFromPath !== 'unknown') return forcedFromPath;

  const fromManifest = normalizeAgentType(manifestType);
  if (fromManifest !== 'unknown') return fromManifest;

  return detectAgentTypeFromPaths(filePaths);
}
