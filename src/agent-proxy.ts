/**
 * Agent Proxy — Shared HTTP client for agent.crowdlisten.com
 *
 * All agent-proxied tools route through these helpers.
 * Supports POST, GET, and SSE streaming endpoints.
 */

import { loadAuth } from "./tools.js";

const AGENT_BASE =
  process.env.CROWDLISTEN_AGENT_URL || "https://agent.crowdlisten.com";

// ─── Auth ──────────────────────────────────────────────────────────────────

/**
 * Returns the CROWDLISTEN_API_KEY or throws with a sign-in prompt.
 * Priority: env var override → stored auth from ~/.crowdlisten/auth.json.
 * Login is free — `npx @crowdlisten/harness login` sets this up automatically.
 */
export function requireApiKey(): string {
  const envKey = process.env.CROWDLISTEN_API_KEY;
  if (envKey) return envKey;

  const stored = loadAuth();
  if (stored?.api_key) return stored.api_key;

  throw new Error(
    "Sign in to use this tool: npx @crowdlisten/harness login\n" +
      "Login is free and auto-configures your agent.\n" +
      "Or set CROWDLISTEN_API_KEY env var manually."
  );
}

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) h["Authorization"] = `Bearer ${apiKey}`;
  return h;
}

// ─── POST ──────────────────────────────────────────────────────────────────

export async function agentPost(
  path: string,
  body: Record<string, unknown>,
  apiKey?: string
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent API error ${res.status} on POST ${path}: ${text || res.statusText}`
    );
  }

  return res.json();
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function agentGet(
  path: string,
  apiKey?: string
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers(apiKey),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent API error ${res.status} on GET ${path}: ${text || res.statusText}`
    );
  }

  return res.json();
}

// ─── PUT ──────────────────────────────────────────────────────────────────

export async function agentPut(
  path: string,
  body: Record<string, unknown>,
  apiKey?: string
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent API error ${res.status} on PUT ${path}: ${text || res.statusText}`
    );
  }

  return res.json();
}

// ─── PATCH ─────────────────────────────────────────────────────────────────

export async function agentPatch(
  path: string,
  body: Record<string, unknown>,
  apiKey?: string
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent API error ${res.status} on PATCH ${path}: ${text || res.statusText}`
    );
  }

  return res.json();
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function agentDelete(
  path: string,
  apiKey?: string
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: headers(apiKey),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Agent API error ${res.status} on DELETE ${path}: ${text || res.statusText}`
    );
  }

  return res.json();
}

// ─── SSE Stream → Aggregated Result ────────────────────────────────────────

/**
 * Connects to an SSE endpoint, collects all events, and returns
 * the aggregated result. Used for long-running operations like
 * analysis/run and PRD generation.
 *
 * Collects `data:` lines until the stream closes or times out.
 * If the last event contains a JSON object with a "status" field,
 * that's treated as the final result. Otherwise returns all events.
 */
export async function agentStream(
  path: string,
  body: Record<string, unknown>,
  apiKey?: string,
  timeoutMs = 120_000
): Promise<unknown> {
  const url = `${AGENT_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers(apiKey),
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Agent API error ${res.status} on SSE ${path}: ${text || res.statusText}`
      );
    }

    // Read SSE stream
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from SSE endpoint");

    const decoder = new TextDecoder();
    const events: unknown[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            events.push(JSON.parse(data));
          } catch {
            events.push(data);
          }
        }
      }
    }

    // Return the last event if it looks like a final result, otherwise all events
    if (events.length === 0) return { status: "completed", events: [] };

    const last = events[events.length - 1];
    if (
      typeof last === "object" &&
      last !== null &&
      "status" in (last as Record<string, unknown>)
    ) {
      return last;
    }

    return { status: "completed", events };
  } finally {
    clearTimeout(timer);
  }
}
