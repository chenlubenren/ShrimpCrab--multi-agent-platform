const DEFAULT_API_BASE = 'http://localhost:3002';
const DEFAULT_WS_BASE = 'ws://localhost:3003';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export const API_BASE = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE
);

export const WS_BASE = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_BASE
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

export function wsUrl(params: URLSearchParams): string {
  return `${WS_BASE}?${params.toString()}`;
}
