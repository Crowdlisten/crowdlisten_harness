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
import { hostname, platform, release } from "os";

import {
  loadAuth,
  saveAuth,
  clearAuth,
  openBrowser,
  callbackHtml,
  autoInstallMcp,
  handleTool,
  provisionApiKey,
  detectExecutor,
  TOOLS,
  MCP_ENTRY,
  AUTH_FILE,
  type StoredAuth,
} from "./tools.js";

// ─── Backward-Compatible Tool Aliases ────────────────────────────────────────
// Old tool names route to new consolidated handlers with parameter mapping.
// These are hidden from tools/list but still work when agents call them.
const TOOL_ALIASES: Record<string, { target: string; paramMap?: (args: Record<string, unknown>) => Record<string, unknown> }> = {
  wiki_write:   { target: "save",           paramMap: (a) => ({ ...a, path: a.path || a.key }) },
  wiki_read:    { target: "recall",         paramMap: (a) => ({ path: a.path || a.key, project_id: a.project_id, shared_project_id: a.shared_project_id }) },
  wiki_list:    { target: "recall",         paramMap: (a) => ({ list: true, prefix: a.path_prefix, project_id: a.project_id }) },
  wiki_search:  { target: "recall",         paramMap: (a) => ({ query: a.query, mode: "keyword", project_id: a.project_id, path_prefix: a.path_prefix, limit: a.limit }) },
  wiki_log:     { target: "recall",         paramMap: (a) => ({ log: true, project_id: a.project_id, limit: a.limit }) },
  wiki_ingest:  { target: "save",           paramMap: (a) => ({ analysis_id: a.analysis_id, project_id: a.project_id }) },
  ingest_folder:{ target: "save",           paramMap: (a) => ({ folder: a.path || a.folder, extensions: a.extensions, recursive: a.recursive, project_id: a.project_id }) },
  get_user_context:     { target: "recall", paramMap: (a) => ({ context: true, topic: a.topic, project_id: a.project_id, limit: a.limit }) },
  get_recent_insights:  { target: "recall", paramMap: (a) => ({ recent: true, days: a.days, project_id: a.project_id, limit: a.limit }) },
  get_observation_feed: { target: "recall", paramMap: (a) => ({ observations: true, project_id: a.project_id, type: a.type, days: a.days, limit: a.limit }) },
  get_theme_insights:   { target: "recall", paramMap: (a) => ({ themes: true, project_id: a.project_id, limit: a.limit }) },
  cluster_opinions:     { target: "analyze_content", paramMap: (a) => ({ ...a, cluster: true }) },
  extract_insights:     { target: "analyze_content", paramMap: (a) => ({ ...a, extract: true }) },
  claim_task:           { target: "list_tasks",      paramMap: (a) => ({ claim: a.task_id, executor: a.executor, branch: a.branch }) },
  execute_task:         { target: "complete_task",   paramMap: (a) => ({ ...a, execute: true }) },
  get_execution_status: { target: "complete_task",   paramMap: (a) => ({ ...a, status: true }) },
};

/** Set of tool names that are aliases — hidden from tools/list */
const ALIAS_TOOL_NAMES = new Set(Object.keys(TOOL_ALIASES));
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
import { agentGet, requireApiKey } from "./agent-proxy.js";

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

        // Auto-provision Research Partner API key
        const apiKey = await provisionApiKey(auth.access_token);
        if (apiKey) {
          auth.api_key = apiKey;
          saveAuth(auth);
          console.error("🔑 API key auto-issued for agent tools");
        }

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

// ─── Token-Based Login (for sandboxed environments) ────────────────────────

async function tokenLogin(accessToken: string, refreshToken: string): Promise<StoredAuth> {
  const supabase = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY);
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    console.error("❌ Token login failed:", error?.message || "Invalid tokens");
    process.exit(1);
  }

  const auth: StoredAuth = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: data.user?.id || "",
    email: data.user?.email || "",
    expires_at: data.session.expires_at,
  };

  saveAuth(auth);

  // Auto-provision Research Partner API key
  const apiKey = await provisionApiKey(auth.access_token);
  if (apiKey) {
    auth.api_key = apiKey;
    saveAuth(auth);
    console.error("🔑 API key auto-issued for agent tools");
  }

  console.error(`✅ Logged in as ${auth.email}`);
  console.error(`   Saved to ${AUTH_FILE}\n`);
  return auth;
}

// ─── Authenticated Supabase Client ──────────────────────────────────────────

async function getAuthedClient(): Promise<{
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}> {
  let auth = loadAuth();

  // Fallback: check environment variables (useful in sandboxed environments like Codex)
  if (!auth) {
    const envAccess = process.env.CROWDLISTEN_ACCESS_TOKEN;
    const envRefresh = process.env.CROWDLISTEN_REFRESH_TOKEN;
    if (envAccess && envRefresh) {
      auth = await tokenLogin(envAccess, envRefresh);
    }
  }

  if (!auth) {
    console.error(
      "Not logged in. Run: npx @crowdlisten/harness login"
    );
    console.error(
      "  Or set CROWDLISTEN_ACCESS_TOKEN and CROWDLISTEN_REFRESH_TOKEN env vars."
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

  // Lazy provision: backfill API key for users who logged in before auto-provisioning
  if (!auth.api_key && !process.env.CROWDLISTEN_API_KEY) {
    const apiKey = await provisionApiKey(auth.access_token);
    if (apiKey) {
      auth.api_key = apiKey;
      saveAuth(auth);
      console.error("🔑 API key auto-issued for agent tools");
    }
  }

  return { supabase, userId: auth.user_id };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === "login") {
  if (process.argv[3] === "--token") {
    const accessToken = process.argv[4];
    const refreshToken = process.argv[5];
    if (!accessToken || !refreshToken) {
      console.error("Usage: npx @crowdlisten/harness login --token <access_token> <refresh_token>");
      process.exit(1);
    }
    tokenLogin(accessToken, refreshToken).then(() => process.exit(0));
  } else {
    interactiveLogin().then(() => process.exit(0));
  }
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
} else if (command === "watch" || command === "sync") {
  const targetDir = process.argv[3];
  if (!targetDir) {
    console.error(`Usage: npx @crowdlisten/harness ${command} <folder>`);
    console.error(`Example: npx @crowdlisten/harness ${command} ~/knowledge`);
    process.exit(1);
  }
  import("./watch.js").then(({ runWatchSync }) => {
    runWatchSync(targetDir, { watch: command === "watch" }).catch((err: any) => {
      console.error(`Error: ${err?.message || err}`);
      process.exit(1);
    });
  });
} else if (command === "serve") {
  startHttpServer();
} else if (command === "openapi") {
  printOpenApiSpec();
} else if (command === "help" || command === "--help" || command === "-h") {
  console.error(`
CrowdListen — Unified MCP Server

COMMANDS:
  login                    Sign in via browser + auto-configure agents
  login --token <a> <r>    Sign in with access/refresh tokens (no browser)
  setup          Re-run auto-configure for agent MCP configs
  logout         Clear saved credentials
  whoami         Show current user
  watch <folder> Auto-sync a local folder to your knowledge base (Dropbox-style)
  sync <folder>  One-shot sync a local folder to your knowledge base
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

SANDBOXED / CI ENVIRONMENTS:

  npx @crowdlisten/harness login --token <access_token> <refresh_token>

  Or set env vars: CROWDLISTEN_ACCESS_TOKEN, CROWDLISTEN_REFRESH_TOKEN

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

  // ── Agent Connection Registration ──────────────────────────────────────────
  // Adapted from agent-bridge/cli.js: register in agent_connections so the
  // frontend knows an MCP agent is online.
  let connectionId: string | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const executor = detectExecutor();
  const agentName = `${hostname()} (${executor.toLowerCase()})`;
  const machineInfo = {
    hostname: hostname(),
    platform: platform(),
    release: release(),
    node: process.version,
    transport: "stdio",
  };

  try {
    // Check for existing connection for this user + executor
    const { data: existing } = await sb
      .from("agent_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("executor", executor)
      .maybeSingle();

    if (existing) {
      const { data, error } = await sb
        .from("agent_connections")
        .update({
          status: "online",
          agent_name: agentName,
          machine_info: machineInfo,
          last_heartbeat_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      connectionId = data.id;
    } else {
      const { data, error } = await sb
        .from("agent_connections")
        .insert({
          user_id: userId,
          executor,
          agent_name: agentName,
          status: "online",
          machine_info: machineInfo,
          last_heartbeat_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      connectionId = data.id;
    }

    console.error(`🔌 Agent registered: ${agentName} (${connectionId})`);

    // 30-second heartbeat
    heartbeatTimer = setInterval(async () => {
      try {
        await sb
          .from("agent_connections")
          .update({ last_heartbeat_at: new Date().toISOString() })
          .eq("id", connectionId!);
      } catch {
        // Non-fatal — heartbeat failure doesn't crash the server
      }
    }, 30_000);
  } catch (err: any) {
    // Non-fatal — agent connection registration failure shouldn't prevent MCP from working
    console.error(`⚠️  Agent registration failed: ${err?.message || err}`);
    console.error("   MCP server will still work, but frontend won't show agent as connected.");
  }

  // Initialize the skill pack registry with all tool definitions
  initializeRegistry(SKILLS_DIR);
  registerTools(TOOLS);
  registerTools(INSIGHTS_TOOLS);

  const server = new Server(
    { name: "crowdlisten", version: "1.0.0" },
    { capabilities: { tools: { listChanged: true } } }
  );

  // Dynamic ListTools — returns tools based on active packs, excluding aliases
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const state = loadUserState();
    const allTools = getToolsForPacks(state.activePacks);
    // Filter out absorbed tool names — they still work via alias dispatch but are hidden
    const tools = allTools.filter((t: any) => !ALIAS_TOOL_NAMES.has(t.name));
    return { tools };
  });

  // Build tool→pack mapping for telemetry tagging
  const toolPackMap = buildToolPackMap([
    { id: "core", toolNames: ["skills", "save", "recall", "sync_context", "set_preferences"] },
    { id: "planning", toolNames: ["list_tasks", "create_task", "update_task", "complete_task", "delete_task", "create_plan", "get_plan", "update_plan"] },
    { id: "social-listening", toolNames: ["search_content", "get_content_comments", "get_trending_content", "get_user_content", "get_platform_status", "health_check"] },
    { id: "audience-analysis", toolNames: ["analyze_content", "enrich_content"] },
    { id: "sessions", toolNames: ["start_session", "list_sessions", "update_session"] },
    { id: "setup", toolNames: ["get_or_create_global_board", "list_projects"] },
    { id: "spec-delivery", toolNames: ["get_specs", "get_spec_detail", "start_spec"] },
  ]);

  // ── Context Priming — compiled truth injection on first tool call ──────
  let sessionContextPrimed = false;

  async function getCompiledTruthContext(): Promise<string | null> {
    if (sessionContextPrimed) return null;
    sessionContextPrimed = true;
    try {
      const apiKey = requireApiKey();
      const data = (await agentGet(
        "/agent/v1/knowledge/topics?limit=3&min_confidence=0.5",
        apiKey
      )) as { topics?: Array<{ title: string; confidence: number; content: string }> };
      const topics = data?.topics;
      if (!topics || topics.length === 0) return null;
      const lines = topics.map(
        (t) =>
          `[${t.title}] (confidence: ${Math.round((t.confidence ?? 0) * 100)}%): ${(t.content || "").slice(0, 300)}`
      );
      return `## Compiled Intelligence\n${lines.join("\n\n")}`;
    } catch {
      // Non-fatal — agent may be unreachable or no topics yet
      return null;
    }
  }

  // Unified CallTool handler with telemetry + suggestions interceptor
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: rawName, arguments: toolArgs } = request.params;
    let args = (toolArgs || {}) as Record<string, unknown>;
    const startTime = Date.now();

    // ── Resolve backward-compatible aliases before dispatch ──
    let name = rawName;
    if (TOOL_ALIASES[name]) {
      const alias = TOOL_ALIASES[name];
      args = alias.paramMap ? alias.paramMap(args) : args;
      name = alias.target;
    }

    try {
      let result: string;

      if (isInsightsTool(name)) {
        result = await handleInsightsTool(name, args);
      } else {
        result = await handleTool(sb, userId, name, args);
      }

      // After skills activation, fire tools/list_changed
      if (name === "skills" || name === "activate_skill_pack") {
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

      // Context priming — inject compiled truth on first tool call
      const contextHint = await getCompiledTruthContext();
      if (contextHint) {
        content.push({
          type: "text" as const,
          text: JSON.stringify({ _context_hint: contextHint }),
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

  // Graceful shutdown — set agent offline + cleanup
  const cleanup = async () => {
    console.error("[Shutdown] Cleaning up...");
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (connectionId) {
      try {
        await sb
          .from("agent_connections")
          .update({
            status: "offline",
            last_heartbeat_at: new Date().toISOString(),
          })
          .eq("id", connectionId);
        console.error("🔌 Agent disconnected");
      } catch {
        // Best effort — process is exiting
      }
    }
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
