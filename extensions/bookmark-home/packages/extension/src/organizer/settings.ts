import type { AgentSettingsV1 } from "./types";

const AGENT_SETTINGS_KEY = "agentSettings";

export const DEFAULT_AGENT_SETTINGS: AgentSettingsV1 = {
  version: 1,
  endpoint: "https://api.openai.com/v1/responses",
  model: "gpt-5.6",
  apiKey: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const loopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (
      (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function endpointOriginPattern(endpoint: string): string | null {
  const normalized = normalizeEndpoint(endpoint);
  return normalized ? `${new URL(normalized).origin}/*` : null;
}

export function sanitizeAgentSettings(value: unknown): AgentSettingsV1 {
  const record = isRecord(value) ? value : {};
  const endpoint =
    typeof record.endpoint === "string"
      ? normalizeEndpoint(record.endpoint)
      : null;
  const model = typeof record.model === "string" ? record.model.trim() : "";
  return {
    version: 1,
    endpoint: endpoint ?? DEFAULT_AGENT_SETTINGS.endpoint,
    model: model.slice(0, 100) || DEFAULT_AGENT_SETTINGS.model,
    apiKey:
      typeof record.apiKey === "string"
        ? record.apiKey.trim().slice(0, 512)
        : "",
  };
}

export class AgentSettingsStore {
  #settings = structuredClone(DEFAULT_AGENT_SETTINGS);

  async load(): Promise<void> {
    const data = await chrome.storage.local.get(AGENT_SETTINGS_KEY);
    this.#settings = sanitizeAgentSettings(data[AGENT_SETTINGS_KEY]);
  }

  get settings(): AgentSettingsV1 {
    return structuredClone(this.#settings);
  }

  async save(settings: AgentSettingsV1): Promise<void> {
    const next = sanitizeAgentSettings(settings);
    await chrome.storage.local.set({ [AGENT_SETTINGS_KEY]: next });
    this.#settings = next;
  }

  async clearKey(): Promise<void> {
    await this.save({ ...this.#settings, apiKey: "" });
  }
}
