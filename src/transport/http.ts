#!/usr/bin/env node

/**
 * Streamable HTTP Transport for CrowdListen Harness
 *
 * Exposes the full MCP tool surface over HTTP. Stateless mode —
 * each request extracts auth from Authorization header.
 *
 * Endpoints:
 *   POST   /mcp          — MCP tool calls (StreamableHTTPServerTransport)
 *   GET    /mcp          — SSE connection for streaming
 *   DELETE /mcp          — Session cleanup
 *   GET    /health       — Health check
 *   GET    /openapi.json — Auto-generated OpenAPI spec
 */

import * as http from "http";
import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, createAnonymousMcpServer, SERVER_VERSION } from "../server-factory.js";
import { generateOpenApiSpec } from "../openapi.js";
import { TOOLS } from "../tools.js";

const CROWDLISTEN_SUPABASE_URL =
  process.env.CROWDLISTEN_URL || "https://fnvlxtzonwybshtvrzit.supabase.co";
const CROWDLISTEN_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA";

// ─── Auth Extraction ───────────────────────────────────────────────────────

async function authenticateRequest(
  req: http.IncomingMessage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ supabase: any; userId: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization header required: Bearer <token>");
  }

  const token = authHeader.slice(7);
  const supabase = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try as JWT first
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    // Set session so RLS works — refresh_token must be non-empty
    // for Supabase to properly set the auth context
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: token, // reuse access_token; won't refresh but RLS works
    });
    return { supabase, userId: data.user.id };
  }

  // Could be an API key — look up in api_keys table
  const anonSb = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY);
  const { data: keyRow } = await anonSb
    .from("api_keys")
    .select("user_id")
    .eq("key_hash", hashApiKey(token))
    .eq("revoked", false)
    .single();

  if (keyRow) {
    return { supabase: anonSb, userId: keyRow.user_id };
  }

  throw new Error("Invalid token or API key");
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

// ─── CORS Headers ──────────────────────────────────────────────────────────

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ─── Optional Auth (for ChatGPT anonymous tool discovery) ────────────────────

async function tryAuthenticateRequest(
  req: http.IncomingMessage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ supabase: any; userId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authenticateRequest(req);
}

// ─── HTTP Server ───────────────────────────────────────────────────────────

export async function startHttpTransport(port = 3848): Promise<void> {
  // Cache the OpenAPI spec
  let cachedSpec: string | null = null;

  const httpServer = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // ── Health Check ─────────────────────────────────────────
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          version: SERVER_VERSION,
          tools: TOOLS.length,
          transport: "streamable-http",
        })
      );
      return;
    }

    // ── OpenAPI Spec ─────────────────────────────────────────
    if (url.pathname === "/openapi.json" && req.method === "GET") {
      if (!cachedSpec) {
        cachedSpec = JSON.stringify(generateOpenApiSpec(), null, 2);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(cachedSpec);
      return;
    }

    // ── MCP Endpoints ────────────────────────────────────────
    if (url.pathname === "/mcp") {
      try {
        const auth = await tryAuthenticateRequest(req);
        const server = auth
          ? createMcpServer({ supabase: auth.supabase, userId: auth.userId })
          : createAnonymousMcpServer();

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
        });

        await server.connect(transport);
        await transport.handleRequest(req, res);

        // Clean up after request completes
        await server.close();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes("Authorization") ? 401 : 500;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    // ── 404 ──────────────────────────────────────────────────
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Not found",
        endpoints: ["/mcp", "/health", "/openapi.json"],
      })
    );
  });

  httpServer.listen(port, () => {
    console.error(`
CrowdListen Harness HTTP server running

  MCP:     http://localhost:${port}/mcp
  Health:  http://localhost:${port}/health
  OpenAPI: http://localhost:${port}/openapi.json

  Tools: ${TOOLS.length} across planning, analysis, content, generation, LLM, and agent network

  Connect from any MCP client:
    { "url": "http://localhost:${port}/mcp" }
`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.error("\nShutting down...");
    httpServer.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    httpServer.close(() => process.exit(0));
  });
}
