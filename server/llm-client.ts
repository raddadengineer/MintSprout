/**
 * LLM access: Open WebUI (OpenAI-compatible) when configured, else direct Ollama.
 */

import { getAppConfig } from "./app-config";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

type LlmBackend =
  | { kind: "openwebui"; base: string; apiKey: string; model: string }
  | { kind: "ollama"; base: string; model: string };

function resolveBackend(): LlmBackend {
  const cfg = getAppConfig();
  const openWebUiBase = (cfg.openWebUiBaseUrl || "").replace(/\/$/, "");
  const apiKey = cfg.openWebUiApiKey || "";
  if (openWebUiBase && apiKey) {
    return {
      kind: "openwebui",
      base: openWebUiBase,
      apiKey,
      model: cfg.openWebUiModel || "gemma3:kids",
    };
  }
  return {
    kind: "ollama",
    base: (cfg.ollamaBaseUrl || "http://192.168.10.7:11434").replace(/\/$/, ""),
    model: cfg.ollamaModel || "llama3.1:latest",
  };
}

export function llmModelName(): string {
  return resolveBackend().model;
}

export async function checkLlmAvailable(): Promise<boolean> {
  const backend = resolveBackend();
  try {
    if (backend.kind === "openwebui") {
      const r = await fetch(`${backend.base}/api/v1/models`, {
        headers: { Authorization: `Bearer ${backend.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return r.ok;
    }
    const r = await fetch(`${backend.base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function chatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const backend = resolveBackend();
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 256;

  if (backend.kind === "openwebui") {
    const res = await fetch(`${backend.base}/api/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${backend.apiKey}`,
      },
      body: JSON.stringify({
        model: backend.model,
        messages,
        stream: false,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Open WebUI error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Empty response from LLM");
    return reply;
  }

  const res = await fetch(`${backend.base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: backend.model,
      messages,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const reply = data.message?.content?.trim();
  if (!reply) throw new Error("Empty response from LLM");
  return reply;
}
