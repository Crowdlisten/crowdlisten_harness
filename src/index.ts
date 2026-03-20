#!/usr/bin/env node

/**
 * CrowdListen Tasks — Planning and Task Delegation for AI Agents
 *
 * Decomposes specs into executable work and routes tasks to coding agents
 * (Claude Code, Cursor, Gemini CLI, Codex, OpenClaw, Amp, etc.) with project
 * context intact. Closes the loop between product intent and implementation.
 *
 * First time:  npx @crowdlisten/kanban login
 * Then add to your agent config and go.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import * as http from "http";
import * as crypto from "crypto";

import {
  loadAuth,
  saveAuth,
  clearAuth,
  openBrowser,
  callbackHtml,
  autoInstallMcp,
  handleTool,
  TOOLS,
  MCP_ENTRY,
  AUTH_FILE,
  type StoredAuth,
} from "./tools.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const CROWDLISTEN_SUPABASE_URL =
  process.env.CROWDLISTEN_URL || "https://fnvlxtzonwybshtvrzit.supabase.co";
const CROWDLISTEN_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA";

const CROWDLISTEN_APP_URL =
  process.env.CROWDLISTEN_APP_URL || "https://crowdlisten.com";

// ─── Browser-Based Login ────────────────────────────────────────────────────

async function interactiveLogin(): Promise<StoredAuth> {
  const state = crypto.randomBytes(16).toString("hex");

  return new Promise<StoredAuth>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost`);

      if (url.pathname === "/callback") {
        const accessToken = url.searchParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token");
        const returnedState = url.searchParams.get("state");
        const userId = url.searchParams.get("user_id");
        const email = url.searchParams.get("email");
        const errorMsg = url.searchParams.get("error");

        res.writeHead(200, { "Content-Type": "text/html" });

        if (errorMsg || !accessToken || !refreshToken || returnedState !== state) {
          res.end(callbackHtml(false, errorMsg || "Authentication failed"));
          console.error(`\n❌ Login failed: ${errorMsg || "Invalid callback"}`);
          server.close();
          reject(new Error(errorMsg || "Login failed"));
          return;
        }

        const auth: StoredAuth = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user_id: userId || "",
          email: email || "",
          expires_at: undefined,
        };

        const supabase = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY);
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data.session) {
          res.end(callbackHtml(false, "Token verification failed"));
          console.error("\n❌ Token verification failed");
          server.close();
          reject(new Error("Token verification failed"));
          return;
        }

        auth.user_id = data.user?.id || auth.user_id;
        auth.email = data.user?.email || auth.email;
        auth.expires_at = data.session.expires_at;
        auth.access_token = data.session.access_token;
        auth.refresh_token = data.session.refresh_token;

        saveAuth(auth);

        res.end(callbackHtml(true));
        console.error(`\n✅ Logged in as ${auth.email}`);
        console.error(`   Saved to ${AUTH_FILE}\n`);

        const installed = await autoInstallMcp();
        if (installed.length > 0) {
          console.error(`🔌 Auto-configured MCP for: ${installed.join(", ")}\n`);
          console.error("   Restart your coding agent to connect.\n");
        } else {
          console.error(
            "To connect manually, add this to your agent's MCP config:\n"
          );
          console.error(JSON.stringify({ mcpServers: { crowdlisten_tasks: MCP_ENTRY } }, null, 2));
          console.error("");
        }

        server.close();
        resolve(auth);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local server"));
        return;
      }

      const port = addr.port;
      const callbackUrl = `http://localhost:${port}/callback`;
      const loginUrl = `${CROWDLISTEN_APP_URL}/auth/cli?callback=${encodeURIComponent(callbackUrl)}&state=${state}`;

      console.error("\n🔐 CrowdListen Login\n");
      console.error("Opening your browser to sign in...\n");
      openBrowser(loginUrl);
      console.error(`If the browser didn't open, go to:\n${loginUrl}\n`);
      console.error("Waiting for authentication...");
    });

    setTimeout(() => {
      console.error("\n⏰ Login timed out. Please try again.");
      server.close();
      reject(new Error("Login timed out"));
    }, 5 * 60 * 1000);
  });
}

// ─── Authenticated Supabase Client ──────────────────────────────────────────

async function getAuthedClient(): Promise<{
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}> {
  let auth = loadAuth();

  if (!auth) {
    console.error(
      "Not logged in. Run: npx @crowdlisten/kanban login"
    );
    process.exit(1);
  }

  const supabase = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.setSession({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });

  if (error || !data.session) {
    console.error("Session expired. Please login again: npx @crowdlisten/kanban login");
    clearAuth();
    process.exit(1);
  }

  if (data.session.access_token !== auth.access_token) {
    auth = {
      ...auth,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    };
    saveAuth(auth);
  }

  return { supabase, userId: auth.user_id };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === "login") {
  interactiveLogin().then(() => process.exit(0));
} else if (command === "logout") {
  clearAuth();
  console.error("✅ Logged out. Auth cleared.");
  process.exit(0);
} else if (command === "whoami") {
  const auth = loadAuth();
  if (auth) {
    console.error(`Logged in as: ${auth.email} (${auth.user_id})`);
  } else {
    console.error("Not logged in. Run: npx @crowdlisten/kanban login");
  }
  process.exit(0);
} else if (command === "setup") {
  autoInstallMcp().then((installed) => {
    if (installed.length > 0) {
      console.error(`🔌 Installed MCP config for: ${installed.join(", ")}`);
      console.error("   Restart your coding agent(s) to connect.");
    } else {
      console.error("No new agent configs to update.");
      console.error("Already installed, or no agent config files found.\n");
      console.error("Supported agents: Claude Code, Cursor, Gemini CLI, Codex, Amp");
      console.error("If your agent isn't listed, add this to its MCP config:\n");
      console.error(JSON.stringify({ crowdlisten_tasks: MCP_ENTRY }, null, 2));
    }
    process.exit(0);
  });
} else if (command === "help" || command === "--help" || command === "-h") {
  console.error(`
CrowdListen Kanban CLI

COMMANDS:
  login     Sign in + auto-configure your coding agents
  setup     Re-run auto-configure for agent MCP configs
  logout    Clear saved credentials
  whoami    Show current user
  help      Show this help

QUICK START:

  npx @crowdlisten/kanban login

  That's it. Login auto-detects and configures Claude Code,
  Cursor, Gemini CLI, Codex, and Amp. Just restart your agent.

  Works with any MCP-compatible agent including OpenClaw.
`);
  process.exit(0);
} else {
  // Default: run as MCP server (stdio)
  startMcpServer();
}

// ─── MCP Server ─────────────────────────────────────────────────────────────

async function startMcpServer() {
  const { supabase: sb, userId } = await getAuthedClient();

  const server = new Server(
    { name: "crowdlisten_tasks", version: "0.1.5" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    try {
      const result = await handleTool(
        sb,
        userId,
        name,
        (toolArgs || {}) as Record<string, unknown>
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: message }) },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CrowdListen Kanban MCP server running");
}
