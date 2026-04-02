#!/usr/bin/env node

/**
 * CrowdListen — Unified MCP Server
 *
 * Single server combining planning, social listening, skill packs, and
 * knowledge management with progressive disclosure.
 *
 * Pattern: Start with ~4 discovery tools → activate skill packs on demand
 *          → fire tools/list_changed so the agent sees new tools.
 *
 * First time:  npx @crowdlisten/harness login
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
import * as path from "path";
import { fileURLToPath } from "url";

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
import {
  runSetupContext,
  runContextCLI,
  runContextWeb,
} from "./context/cli.js";
import { loadUserState, saveUserState } from "./context/user-state.js";
import {
  initializeRegistry,
  registerTools,
  getToolsForPacks,
  isInsightsTool,
} from "./tools/registry.js";
import {
  INSIGHTS_TOOLS,
  handleInsightsTool,
  cleanupInsights,
} from "./insights/index.js";
import { recordEvent, shouldOnboard, getOnboardingPrompt, buildToolPackMap } from "./telemetry.js";
import { checkSuggestion } from "./suggestions.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const CROWDLISTEN_SUPABASE_URL =
  process.env.CROWDLISTEN_URL || "https://fnvlxtzonwybshtvrzit.supabase.co";
const CROWDLISTEN_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA";

const CROWDLISTEN_APP_URL =
  process.env.CROWDLISTEN_APP_URL || "https://crowdlisten.com";

// Resolve skills directory relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "..", "skills");

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
          console.error(JSON.stringify({ mcpServers: {
            crowdlisten: MCP_ENTRY,
          } }, null, 2));
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
      "Not logged in. Run: npx @crowdlisten/harness login"
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
    console.error("Session expired. Please login again: npx @crowdlisten/harness login");
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
    console.error("Not logged in. Run: npx @crowdlisten/harness login");
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
      console.error("Supported agents: Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw");
      console.error("If your agent isn't listed, add this to its MCP config:\n");
      console.error(JSON.stringify({
        crowdlisten: MCP_ENTRY,
      }, null, 2));
    }
    process.exit(0);
  });
} else if (command === "context") {
  const fileArg = process.argv[3];
  if (fileArg) {
    runContextCLI(fileArg).then(() => process.exit(0));
  } else {
    runContextWeb();
  }
} else if (command === "setup-context") {
  runSetupContext().then(() => process.exit(0));
} else if (command === "serve") {
  startHttpServer();
} else if (command === "openapi") {
  printOpenApiSpec();
} else if (command === "help" || command === "--help" || command === "-h") {
  console.error(`
CrowdListen — Unified MCP Server

COMMANDS:
  login          Sign in + auto-configure your coding agents
  setup          Re-run auto-configure for agent MCP configs
  logout         Clear saved credentials
  whoami         Show current user
  serve          Start Streamable HTTP transport (port 3848)
  openapi        Print OpenAPI 3.0 spec to stdout
  context        Launch skill pack dashboard (port 3847)
  context <file> Process a file through the context pipeline (CLI mode)
  setup-context  Configure LLM provider for context extraction
  help           Show this help

QUICK START:

  npx @crowdlisten/harness login

  That's it. Login auto-detects and configures Claude Code,
  Cursor, Gemini CLI, Codex, and Amp. Just restart your agent.

  Your agent starts with 4 discovery tools:
    list_skill_packs, activate_skill_pack, remember, recall

  Activate packs to unlock more: planning, social-listening, etc.

REMOTE ACCESS:

  npx @crowdlisten/harness serve           # Start HTTP server on :3848
  curl localhost:3848/health               # Health check
  curl localhost:3848/openapi.json         # OpenAPI spec
`);
  process.exit(0);
} else {
  // Default: run as MCP server (stdio)
  startMcpServer();
}

// ─── MCP Server (stdio, progressive disclosure) ─────────────────────────────

async function startMcpServer() {
  const { supabase: sb, userId } = await getAuthedClient();

  // Initialize the skill pack registry with all tool definitions
  initializeRegistry(SKILLS_DIR);
  registerTools(TOOLS);
  registerTools(INSIGHTS_TOOLS);

  const server = new Server(
    { name: "crowdlisten", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } }
  );

  // Dynamic ListTools — returns tools based on active packs
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const state = loadUserState();
    const tools = getToolsForPacks(state.activePacks);
    return { tools };
  });

  // Build tool→pack mapping for telemetry tagging
  const toolPackMap = buildToolPackMap([
    { id: "core", toolNames: ["list_skill_packs", "activate_skill_pack", "remember", "recall", "set_preferences"] },
    { id: "planning", toolNames: ["list_tasks", "create_task", "get_task", "update_task", "claim_task", "complete_task", "log_progress", "delete_task", "create_plan", "get_plan", "update_plan"] },
    { id: "knowledge", toolNames: ["query_context", "add_context", "record_learning", "log_learning", "search_learnings"] },
    { id: "social-listening", toolNames: ["search_content", "get_content_comments", "get_trending_content", "get_user_content", "get_platform_status", "health_check", "extract_url"] },
    { id: "audience-analysis", toolNames: ["analyze_content", "cluster_opinions", "enrich_content", "deep_analyze", "extract_insights", "research_synthesis"] },
    { id: "sessions", toolNames: ["start_session", "list_sessions", "update_session"] },
    { id: "setup", toolNames: ["get_or_create_global_board", "list_projects", "list_boards", "create_board", "migrate_to_global_board"] },
    { id: "spec-delivery", toolNames: ["get_specs", "get_spec_detail", "start_spec"] },
  ]);

  // Unified CallTool handler with telemetry + suggestions interceptor
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;
    const args = (toolArgs || {}) as Record<string, unknown>;
    const startTime = Date.now();

    try {
      let result: string;

      if (isInsightsTool(name)) {
        result = await handleInsightsTool(name, args);
      } else {
        result = await handleTool(sb, userId, name, args);
      }

      // After activate_skill_pack, fire tools/list_changed
      if (name === "activate_skill_pack") {
        try {
          const parsed = JSON.parse(result);
          if (parsed._needsListChanged) {
            delete parsed._needsListChanged;
            result = JSON.stringify(parsed, null, 2);
            await server.sendToolListChanged();
          }
        } catch {
          // Non-fatal
        }
      }

      // ── POST hooks: telemetry, onboarding, suggestions ──────────
      const state = loadUserState();
      const durationMs = Date.now() - startTime;
      const pack = toolPackMap.get(name) || "unknown";

      // Telemetry recording
      recordEvent(
        { event: "tool_call", tool: name, pack, duration_ms: durationMs, success: true },
        state.preferences.telemetry,
        state.installationId
      );

      // Build response content
      const content: Array<{ type: "text"; text: string }> = [
        { type: "text" as const, text: result },
      ];

      // Onboarding check — append prompt if a step is pending
      const pendingStep = shouldOnboard(state);
      if (pendingStep) {
        const prompt = getOnboardingPrompt(pendingStep);
        if (prompt) {
          content.push({
            type: "text" as const,
            text: JSON.stringify({
              _onboarding: {
                step: pendingStep,
                title: prompt.title,
                message: prompt.message,
              },
            }),
          });
        }
      }

      // Proactive suggestions check
      const suggestion = checkSuggestion(
        result,
        state.activePacks,
        state.preferences.proactiveSuggestions
      );
      if (suggestion) {
        content.push({
          type: "text" as const,
          text: JSON.stringify({ _suggestion: suggestion }),
        });
      }

      return { content };
    } catch (err: unknown) {
      // Record failed telemetry
      const state = loadUserState();
      const durationMs = Date.now() - startTime;
      const pack = toolPackMap.get(name) || "unknown";
      recordEvent(
        { event: "tool_call", tool: name, pack, duration_ms: durationMs, success: false },
        state.preferences.telemetry,
        state.installationId
      );

      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: message }) },
        ],
        isError: true,
      };
    }
  });

  // Graceful shutdown
  const cleanup = async () => {
    console.error("[Shutdown] Cleaning up...");
    await cleanupInsights();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  server.onerror = (error) => console.error("[MCP Error]", error);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CrowdListen unified MCP server running (progressive disclosure)");
}

// ─── HTTP Server (Streamable HTTP) ──────────────────────────────────────────

async function startHttpServer() {
  const { startHttpTransport } = await import("./transport/http.js");
  const port = parseInt(process.argv[3] || "3848", 10);
  await startHttpTransport(port);
}

// ─── OpenAPI Spec ───────────────────────────────────────────────────────────

async function printOpenApiSpec() {
  const { generateOpenApiSpec } = await import("./openapi.js");
  console.log(JSON.stringify(generateOpenApiSpec(), null, 2));
  process.exit(0);
}
