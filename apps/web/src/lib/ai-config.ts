export type AiProviderMode = "browser" | "server";

export interface BrowserAiConfig {
  providerName: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  chatCompletionsPath: string;
  timeoutMs: number;
}

export interface PersistedAiSettings {
  mode: AiProviderMode;
  browserConfig: BrowserAiConfig;
}

export const AI_SETTINGS_STORAGE_KEY = "3d-house-fs:ai-settings";
export const MAX_REFERENCE_IMAGES = 3;

export const DEFAULT_BROWSER_AI_CONFIG: BrowserAiConfig = {
  providerName: "openai-compatible",
  apiKey: "",
  model: "gpt-4.1-mini",
  baseUrl: "https://api.openai.com/v1",
  chatCompletionsPath: "/chat/completions",
  timeoutMs: 20000
};

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeAiProviderMode(value: unknown): AiProviderMode {
  return value === "server" ? "server" : "browser";
}

export function normalizeBrowserAiConfig(value: unknown): BrowserAiConfig {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    providerName: stringValue(record.providerName, DEFAULT_BROWSER_AI_CONFIG.providerName),
    apiKey: stringValue(record.apiKey, DEFAULT_BROWSER_AI_CONFIG.apiKey),
    model: stringValue(record.model, DEFAULT_BROWSER_AI_CONFIG.model),
    baseUrl: stringValue(record.baseUrl, DEFAULT_BROWSER_AI_CONFIG.baseUrl).replace(/\/$/, ""),
    chatCompletionsPath:
      stringValue(record.chatCompletionsPath, DEFAULT_BROWSER_AI_CONFIG.chatCompletionsPath) ||
      DEFAULT_BROWSER_AI_CONFIG.chatCompletionsPath,
    timeoutMs: Math.min(
      60000,
      Math.max(5000, numberValue(record.timeoutMs, DEFAULT_BROWSER_AI_CONFIG.timeoutMs))
    )
  };
}
