import type { Lobster } from '@/types';

type ProviderConfigLike = Lobster['config'] | string | null | undefined;
type ProviderLikeAgent = Pick<Lobster, 'providerId' | 'platform'> & {
  config?: ProviderConfigLike;
};

function normalizeAgentConfig(config: ProviderConfigLike): Lobster['config'] | undefined {
  if (!config) return undefined;
  if (typeof config !== 'string') return config;

  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function hasConfiguredProvider(agent: ProviderLikeAgent): boolean {
  const config = normalizeAgentConfig(agent.config);
  const providerId = agent.providerId || config?.providerId;
  const apiKeys = config?.apiKeys;
  const hasApiKey = apiKeys
    ? Object.values(apiKeys).some((value) => typeof value === 'string' && value.trim().length > 0)
    : false;

  return Boolean(providerId || hasApiKey);
}

export function getProviderStatusLabel(agent: ProviderLikeAgent): string {
  return hasConfiguredProvider(agent) ? '已配置供应商' : '未配置供应商';
}
