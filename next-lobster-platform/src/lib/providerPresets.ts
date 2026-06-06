'use client';

export type ProviderType = 'claude' | 'codex' | 'opencode' | 'openclaw' | 'hermes';

export interface ProviderModelPreset {
  id: string;
  name: string;
  note?: string;
}

export interface ProviderPreset {
  key: string;
  label: string;
  shortLabel: string;
  type: ProviderType;
  protocol: string;
  description: string;
  apiKeyField: string;
  apiKeyUrl?: string;
  baseUrl?: string;
  baseUrlHelp: string;
  docsUrl?: string;
  models: ProviderModelPreset[];
  isCustom?: boolean;
}

export const PROVIDER_TYPES: Array<{ key: ProviderType; label: string }> = [
  { key: 'claude', label: 'Claude Code' },
  { key: 'codex', label: 'Codex' },
  { key: 'opencode', label: 'OpenCode' },
  { key: 'openclaw', label: 'OpenClaw' },
  { key: 'hermes', label: 'Hermes' },
];

const ANTHROPIC_MODELS: ProviderModelPreset[] = [
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
];

const KIMI_CODING_MODELS: ProviderModelPreset[] = [
  { id: 'kimi-for-coding', name: 'Kimi for Coding' },
];

const OPENAI_MODELS: ProviderModelPreset[] = [
  { id: 'gpt-5.5', name: 'GPT-5.5' },
  { id: 'gpt-5.5-pro', name: 'GPT-5.5 Pro' },
  { id: 'gpt-5.5-mini', name: 'GPT-5.5 Mini' },
  { id: 'gpt-5.5-nano', name: 'GPT-5.5 Nano' },
  { id: 'gpt-5.1', name: 'GPT-5.1' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'o4-mini', name: 'o4 Mini' },
];

const DEEPSEEK_MODELS: ProviderModelPreset[] = [
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', note: 'Reasoning model' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', note: 'Reasoning model' },
];

const KIMI_OPENAI_MODELS: ProviderModelPreset[] = [
  { id: 'kimi-k2.6', name: 'Kimi K2.6' },
  { id: 'kimi-k2-turbo-preview', name: 'Kimi K2 Turbo Preview' },
  { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' },
  { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
];

const QWEN_MODELS: ProviderModelPreset[] = [
  { id: 'qwen3-max', name: 'Qwen3 Max' },
  { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus' },
  { id: 'qwen-plus', name: 'Qwen Plus' },
  { id: 'qwen-turbo', name: 'Qwen Turbo' },
];

const GEMINI_MODELS: ProviderModelPreset[] = [
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

const OPENROUTER_MODELS: ProviderModelPreset[] = [
  { id: 'openai/gpt-5.5', name: 'OpenAI GPT-5.5' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek Chat v3.1' },
  { id: 'google/gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
];

const openAiCompatiblePresets = (type: ProviderType): ProviderPreset[] => [
  {
    key: `${type}:openai`,
    label: 'OpenAI',
    shortLabel: 'OpenAI',
    type,
    protocol: 'OpenAI API',
    description: 'Official OpenAI API and model IDs.',
    apiKeyField: 'OPENAI_API_KEY',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    baseUrlHelp: 'Official OpenAI API base URL.',
    docsUrl: 'https://platform.openai.com/docs/models',
    models: OPENAI_MODELS,
  },
  {
    key: `${type}:deepseek`,
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    type,
    protocol: 'OpenAI-compatible',
    description: 'DeepSeek OpenAI-compatible chat API.',
    apiKeyField: 'DEEPSEEK_API_KEY',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com',
    baseUrlHelp: 'DeepSeek OpenAI-compatible base URL.',
    docsUrl: 'https://api-docs.deepseek.com/',
    models: DEEPSEEK_MODELS,
  },
  {
    key: `${type}:moonshot`,
    label: 'Moonshot Kimi',
    shortLabel: 'Kimi',
    type,
    protocol: 'OpenAI-compatible',
    description: 'Moonshot/Kimi OpenAI SDK compatible endpoint.',
    apiKeyField: 'MOONSHOT_API_KEY',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    baseUrl: 'https://api.moonshot.cn/v1',
    baseUrlHelp: 'Moonshot OpenAI-compatible base URL.',
    docsUrl: 'https://platform.moonshot.cn/docs/guide/start-using-kimi-api',
    models: KIMI_OPENAI_MODELS,
  },
  {
    key: `${type}:dashscope`,
    label: 'Alibaba DashScope',
    shortLabel: 'Qwen',
    type,
    protocol: 'OpenAI-compatible',
    description: 'Alibaba Model Studio/DashScope compatible mode.',
    apiKeyField: 'DASHSCOPE_API_KEY',
    apiKeyUrl: 'https://bailian.console.aliyun.com/',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baseUrlHelp: 'DashScope compatible-mode OpenAI base URL.',
    docsUrl: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope',
    models: QWEN_MODELS,
  },
  {
    key: `${type}:gemini`,
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    type,
    protocol: 'OpenAI-compatible',
    description: 'Gemini API through the OpenAI compatibility endpoint.',
    apiKeyField: 'GEMINI_API_KEY',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    baseUrlHelp: 'Gemini OpenAI compatibility base URL.',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    models: GEMINI_MODELS,
  },
  {
    key: `${type}:openrouter`,
    label: 'OpenRouter',
    shortLabel: 'OpenRouter',
    type,
    protocol: 'OpenAI-compatible router',
    description: 'One OpenAI-compatible endpoint for many upstream models.',
    apiKeyField: 'OPENROUTER_API_KEY',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    baseUrlHelp: 'OpenRouter API base URL.',
    docsUrl: 'https://openrouter.ai/docs/api-reference/overview',
    models: OPENROUTER_MODELS,
  },
  {
    key: `${type}:custom-openai-compatible`,
    label: 'Custom OpenAI Compatible',
    shortLabel: 'Custom',
    type,
    protocol: 'OpenAI-compatible',
    description: 'Use a private relay or a provider not listed above.',
    apiKeyField: 'OPENAI_API_KEY',
    baseUrl: '',
    baseUrlHelp: 'Enter the relay or provider base URL.',
    models: [],
    isCustom: true,
  },
];

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    key: 'claude:anthropic',
    label: 'Anthropic',
    shortLabel: 'Anthropic',
    type: 'claude',
    protocol: 'Anthropic API',
    description: 'Official Anthropic endpoint used by Claude Code.',
    apiKeyField: 'ANTHROPIC_API_KEY',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com',
    baseUrlHelp: 'Claude Code reads this as ANTHROPIC_BASE_URL.',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/overview',
    models: ANTHROPIC_MODELS,
  },
  {
    key: 'claude:kimi-coding',
    label: 'Kimi Coding Plan',
    shortLabel: 'Kimi',
    type: 'claude',
    protocol: 'Anthropic-compatible',
    description: 'Kimi Coding endpoint for Claude Code style clients.',
    apiKeyField: 'ANTHROPIC_API_KEY',
    apiKeyUrl: 'https://platform.kimi.com/',
    baseUrl: 'https://api.kimi.com/coding',
    baseUrlHelp: 'Use this for Claude Code, not the Moonshot OpenAI endpoint.',
    docsUrl: 'https://platform.kimi.com/docs/guide/agent-support',
    models: KIMI_CODING_MODELS,
  },
  {
    key: 'claude:custom-anthropic-compatible',
    label: 'Custom Claude Compatible',
    shortLabel: 'Custom',
    type: 'claude',
    protocol: 'Anthropic-compatible',
    description: 'Use an Anthropic-compatible relay for Claude Code.',
    apiKeyField: 'ANTHROPIC_API_KEY',
    baseUrl: '',
    baseUrlHelp: 'Enter the Anthropic-compatible base URL.',
    models: [],
    isCustom: true,
  },
  ...openAiCompatiblePresets('codex'),
  ...openAiCompatiblePresets('opencode'),
  ...openAiCompatiblePresets('openclaw'),
  ...openAiCompatiblePresets('hermes'),
];

export function getProviderTypeLabel(type: string): string {
  return PROVIDER_TYPES.find((item) => item.key === type)?.label || type;
}

export function getPresetsForType(type: string): ProviderPreset[] {
  return PROVIDER_PRESETS.filter((preset) => preset.type === type);
}

export function getPresetByKey(key?: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((preset) => preset.key === key);
}

export function normalizeModelId(model: unknown): string {
  if (typeof model === 'string') return model;
  if (model && typeof model === 'object') {
    const value = model as { id?: unknown; name?: unknown };
    if (typeof value.id === 'string') return value.id;
    if (typeof value.name === 'string') return value.name;
  }
  return '';
}

export function normalizeProviderModels(models: unknown): string[] {
  if (!Array.isArray(models)) return [];
  return models
    .map(normalizeModelId)
    .filter((modelId): modelId is string => Boolean(modelId));
}

export function getModelDisplayName(modelId: string): string {
  for (const preset of PROVIDER_PRESETS) {
    const match = preset.models.find((model) => model.id === modelId);
    if (match) return match.name;
  }
  return modelId;
}

export function findPresetForProvider(
  type: string,
  baseUrl?: string | null,
  models?: unknown
): ProviderPreset | undefined {
  const candidates = getPresetsForType(type);
  const normalizedBaseUrl = (baseUrl || '').replace(/\/+$/, '').toLowerCase();
  const modelIds = normalizeProviderModels(models);
  const customPreset = candidates.find((preset) => preset.isCustom);
  const baseUrlMatch = candidates.find((preset) => {
    const presetBaseUrl = (preset.baseUrl || '').replace(/\/+$/, '').toLowerCase();
    return presetBaseUrl && presetBaseUrl === normalizedBaseUrl;
  });

  if (baseUrlMatch) return baseUrlMatch;

  if (normalizedBaseUrl && customPreset) {
    return customPreset;
  }

  return (
    candidates.find((preset) => preset.models.some((model) => modelIds.includes(model.id))) ||
    customPreset ||
    candidates[0]
  );
}
