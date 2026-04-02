/**
 * LLM provider abstraction: OpenAI, Anthropic, Ollama.
 * Uses the user's own API key — configured via `npx @crowdlisten/harness setup`.
 */

import type { LLMProvider, LLMMessage, LLMOpts, ContextConfig } from "./types.js";

// ─── OpenAI ──────────────────────────────────────────────────────────────────

class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model || "gpt-4o-mini";
  }

  async complete(messages: LLMMessage[], opts?: LLMOpts): Promise<string> {
    const body: Record<string, unknown> = {
      model: opts?.model || this.defaultModel,
      messages,
      temperature: opts?.temperature ?? 0.3,
    };
    if (opts?.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts?.jsonMode) body.response_format = { type: "json_object" };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as any).error?.message || `OpenAI request failed (${res.status})`
      );
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI embeddings failed (${res.status})`);
    }

    const data = (await res.json()) as any;
    return data.data.map((d: any) => d.embedding);
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.defaultModel = model || "claude-sonnet-4-20250514";
  }

  async complete(messages: LLMMessage[], opts?: LLMOpts): Promise<string> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: opts?.model || this.defaultModel,
      max_tokens: opts?.maxTokens || 4096,
      messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as any).error?.message ||
          `Anthropic request failed (${res.status})`
      );
    }

    const data = (await res.json()) as any;
    const textBlock = data.content?.find((c: any) => c.type === "text");
    return textBlock?.text || "";
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createProvider(config: ContextConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
