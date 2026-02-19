#!/usr/bin/env node

/**
 * CrowdListen Kanban MCP Server
 *
 * Connects any MCP-compatible coding agent (Claude Code, Cursor, Gemini CLI,
 * Codex, OpenClaw, Amp, etc.) to your CrowdListen task board.
 *
 * First time:  npx @crowdlisten/kanban-mcp login
 * Then add to your agent config and go.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import * as http from "http";
import * as crypto from "crypto";
import { execSync } from "child_process";

// ─── Constants ──────────────────────────────────────────────────────────────

// These are your public Supabase project credentials (same as in your frontend).
// The anon key is safe to embed — RLS protects everything.
const CROWDLISTEN_SUPABASE_URL =
  process.env.CROWDLISTEN_URL || "https://fnvlxtzonwybshtvrzit.supabase.co";
const CROWDLISTEN_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA";

const AUTH_DIR = path.join(os.homedir(), ".crowdlisten");
const AUTH_FILE = path.join(AUTH_DIR, "auth.json");

// ─── Auth Persistence ───────────────────────────────────────────────────────

interface StoredAuth {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  expires_at?: number;
}

function loadAuth(): StoredAuth | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

function saveAuth(auth: StoredAuth): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function clearAuth(): void {
  try {
    fs.unlinkSync(AUTH_FILE);
  } catch {
    // ignore
  }
}

// ─── Browser-Based Login ────────────────────────────────────────────────────

const CROWDLISTEN_APP_URL =
  process.env.CROWDLISTEN_APP_URL || "https://crowdlisten.com";

/**
 * Open a URL in the user's default browser.
 */
function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (process.platform === "win32") {
      execSync(`start "" "${url}"`);
    } else {
      // Linux / WSL
      execSync(`xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || echo ""`);
    }
  } catch {
    // Silent fail — we'll show the URL for manual copy
  }
}

/**
 * Login flow:
 * 1. Start a local HTTP server on a random port
 * 2. Open browser to CrowdListen /auth/cli?callback=http://localhost:PORT&state=RANDOM
 * 3. User signs in on the web (email, Google, etc.)
 * 4. CrowdListen redirects to localhost with access_token + refresh_token
 * 5. We save the token and auto-configure agents
 */
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

        // Respond with a nice HTML page
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

        // Verify the token works
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

        // Update with verified data
        auth.user_id = data.user?.id || auth.user_id;
        auth.email = data.user?.email || auth.email;
        auth.expires_at = data.session.expires_at;
        auth.access_token = data.session.access_token;
        auth.refresh_token = data.session.refresh_token;

        saveAuth(auth);

        res.end(callbackHtml(true));
        console.error(`\n✅ Logged in as ${auth.email}`);
        console.error(`   Saved to ${AUTH_FILE}\n`);

        // Auto-install into detected coding agents
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

    // Listen on random port
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

    // Timeout after 5 minutes
    setTimeout(() => {
      console.error("\n⏰ Login timed out. Please try again.");
      server.close();
      reject(new Error("Login timed out"));
    }, 5 * 60 * 1000);
  });
}

/**
 * HTML page shown in the browser after auth callback
 */
function callbackHtml(success: boolean, error?: string): string {
  if (success) {
    return `<!DOCTYPE html>
<html><head><title>CrowdListen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; }
  .card { text-align: center; padding: 3rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 400px; }
  .check { font-size: 3rem; margin-bottom: 1rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #111; }
  p { color: #666; font-size: 0.875rem; margin: 0; }
</style></head>
<body><div class="card">
  <div class="check">✅</div>
  <h1>You're connected!</h1>
  <p>You can close this tab and go back to your terminal.</p>
</div></body></html>`;
  }
  return `<!DOCTYPE html>
<html><head><title>CrowdListen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; }
  .card { text-align: center; padding: 3rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); max-width: 400px; }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #111; }
  p { color: #666; font-size: 0.875rem; margin: 0; }
</style></head>
<body><div class="card">
  <div class="icon">❌</div>
  <h1>Login failed</h1>
  <p>${error || "Something went wrong. Please try again."}</p>
</div></body></html>`;
}

// ─── Auto-Install MCP Config ────────────────────────────────────────────────

const MCP_ENTRY = {
  command: "npx",
  args: ["-y", "@crowdlisten/kanban-mcp"],
};

interface AgentConfig {
  name: string;
  configPath: string;
  mcpKey: string; // JSON path to the mcpServers object
  wrapperKey?: string; // Some agents nest under a top-level key
}

function getAgentConfigs(): AgentConfig[] {
  const home = os.homedir();
  return [
    {
      name: "Claude Code",
      configPath: path.join(home, ".claude.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Cursor",
      configPath: path.join(home, ".cursor", "mcp.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Cursor (project)",
      configPath: path.join(process.cwd(), ".cursor", "mcp.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Gemini CLI",
      configPath: path.join(home, ".gemini", "settings.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Codex",
      configPath: path.join(home, ".codex", "config.json"),
      mcpKey: "mcp_servers",
    },
    {
      name: "Amp",
      configPath: path.join(home, ".amp", "settings.json"),
      mcpKey: "amp.mcpServers",
    },
  ];
}

async function autoInstallMcp(): Promise<string[]> {
  const installed: string[] = [];

  for (const agent of getAgentConfigs()) {
    try {
      // Only install into configs that already exist (don't create files for agents the user doesn't have)
      if (!fs.existsSync(agent.configPath)) continue;

      let config: Record<string, unknown> = {};
      try {
        const raw = fs.readFileSync(agent.configPath, "utf-8");
        config = JSON.parse(raw);
      } catch {
        // File exists but isn't valid JSON — skip to avoid corruption
        continue;
      }

      // Navigate to the mcpServers key (supports dotted paths like "amp.mcpServers")
      const keys = agent.mcpKey.split(".");
      let target: Record<string, unknown> = config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]] || typeof target[keys[i]] !== "object") {
          target[keys[i]] = {};
        }
        target = target[keys[i]] as Record<string, unknown>;
      }
      const leafKey = keys[keys.length - 1];

      if (!target[leafKey] || typeof target[leafKey] !== "object") {
        target[leafKey] = {};
      }
      const servers = target[leafKey] as Record<string, unknown>;

      // Already installed? Skip.
      if (servers.crowdlisten_tasks) continue;

      // Add CrowdListen
      servers.crowdlisten_tasks = { ...MCP_ENTRY };
      target[leafKey] = servers;

      // Write back
      fs.writeFileSync(agent.configPath, JSON.stringify(config, null, 2) + "\n");
      installed.push(agent.name);
    } catch {
      // Non-fatal — skip this agent
    }
  }

  return installed;
}

// ─── Authenticated Supabase Client ──────────────────────────────────────────

async function getAuthedClient(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  let auth = loadAuth();

  if (!auth) {
    console.error(
      "Not logged in. Run: npx @crowdlisten/kanban-mcp login"
    );
    process.exit(1);
  }

  const supabase = createClient(CROWDLISTEN_SUPABASE_URL, CROWDLISTEN_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });

  // Set the stored session
  const { data, error } = await supabase.auth.setSession({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });

  if (error || !data.session) {
    console.error("Session expired. Please login again: npx @crowdlisten/kanban-mcp login");
    clearAuth();
    process.exit(1);
  }

  // If tokens were refreshed, save them
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

// ─── Tool Definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_or_create_global_board",
    description: "Get (or create) your single global kanban board. All tasks go here by default.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_projects",
    description: "List all projects you have access to.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_boards",
    description: "List kanban boards for a project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "create_board",
    description: "Create a new kanban board for a project with default columns (To Do, In Progress, In Review, Done, Cancelled).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        name: { type: "string", description: "Board name (default: 'Tasks')" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks. Uses global board by default. Optional status filter: todo, inprogress, inreview, done, cancelled.",
    inputSchema: {
      type: "object" as const,
      properties: {
        board_id: { type: "string", description: "Optional: specific board (defaults to global board)" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "get_task",
    description: "Get full details of a task including description.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task. Uses global board by default. Optionally tag with a project_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        priority: { type: "string", description: "low, medium, or high" },
        project_id: { type: "string", description: "Optional: tag task with a project" },
        board_id: { type: "string", description: "Optional: specific board (defaults to global board)" },
        labels: {
          type: "array",
          items: { type: "object", properties: { name: { type: "string" }, color: { type: "string" } } },
          description: "Label objects [{name, color}]",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Update a task. Pass only fields to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", description: "todo, inprogress, inreview, done, cancelled" },
        priority: { type: "string", description: "low, medium, high" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "claim_task",
    description:
      "Claim a task to start working. Moves to In Progress, creates workspace + session. Returns workspace_id and branch name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        executor: {
          type: "string",
          description: "Coding agent name: CLAUDE_CODE, CURSOR, GEMINI, CODEX, AMP, OPENCLAW, OPENCODE, COPILOT, DROID, QWEN_CODE",
        },
        branch: { type: "string", description: "Custom branch name (auto-generated if omitted)" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "complete_task",
    description: "Mark task done. Optionally attach a summary of what was accomplished.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        summary: { type: "string", description: "Summary of work completed" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "log_progress",
    description:
      "Log a progress update or note to a task's execution session. Useful for tracking what the agent is doing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        message: { type: "string", description: "Progress message" },
        session_id: {
          type: "string",
          description: "Optional: specific session UUID (defaults to most recent active session)",
        },
      },
      required: ["task_id", "message"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "migrate_to_global_board",
    description: "Migrate all tasks from all boards to the global board. Run once to consolidate.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "start_session",
    description:
      "Start a new parallel agent session for a task. Allows multiple agents to work on different aspects simultaneously.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        executor: {
          type: "string",
          description: "Agent: CLAUDE_CODE, CURSOR, GEMINI, CODEX, AMP, etc.",
        },
        focus: {
          type: "string",
          description: "What this session will work on (e.g., 'implement auth backend')",
        },
      },
      required: ["task_id", "focus"],
    },
  },
  {
    name: "list_sessions",
    description:
      "List all agent sessions for a task, showing status and what each is working on.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        status: {
          type: "string",
          description: "Filter by status: idle, running, completed, failed, stopped",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_session",
    description:
      "Update a session's status or focus. Use to mark running/completed/stopped.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "Session UUID" },
        status: {
          type: "string",
          description: "idle, running, completed, failed, stopped",
        },
        focus: { type: "string", description: "Updated focus description" },
      },
      required: ["session_id"],
    },
  },
];

// ─── Status ↔ Column mapping ────────────────────────────────────────────────

const STATUS_COLUMN: Record<string, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  inreview: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

async function getColumnByStatus(
  sb: SupabaseClient,
  boardId: string,
  status: string
): Promise<string | null> {
  const colName = STATUS_COLUMN[status];
  if (!colName) return null;
  const { data } = await sb
    .from("kanban_columns")
    .select("id")
    .eq("board_id", boardId)
    .eq("name", colName)
    .single();
  return data?.id || null;
}

const GLOBAL_BOARD_NAME = "Global Tasks";

/**
 * Get or create the user's single global kanban board.
 * All tasks go here by default.
 */
async function getOrCreateGlobalBoard(
  sb: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string; created: boolean }> {
  // Look for existing global board
  const { data: existing } = await sb
    .from("kanban_boards")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", GLOBAL_BOARD_NAME)
    .single();

  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }

  // Create a "global" project to house the board (required by schema)
  let projectId: string;
  const { data: globalProject } = await sb
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Global Tasks")
    .single();

  if (globalProject) {
    projectId = globalProject.id;
  } else {
    const { data: newProject, error: projErr } = await sb
      .from("projects")
      .insert({
        user_id: userId,
        name: "Global Tasks",
        description: "Container for your global kanban board",
      })
      .select("id")
      .single();
    if (projErr) throw new Error(`Failed to create global project: ${projErr.message}`);
    projectId = newProject!.id;
  }

  // Create the global board
  const { data: board, error: boardErr } = await sb
    .from("kanban_boards")
    .insert({
      project_id: projectId,
      name: GLOBAL_BOARD_NAME,
      user_id: userId,
    })
    .select("id")
    .single();
  if (boardErr) throw new Error(`Failed to create global board: ${boardErr.message}`);

  // Create default columns
  const defaultColumns = ["To Do", "In Progress", "In Review", "Done", "Cancelled"];
  for (let i = 0; i < defaultColumns.length; i++) {
    await sb.from("kanban_columns").insert({
      board_id: board!.id,
      name: defaultColumns[i],
      position: i,
    });
  }

  return { id: board!.id, name: GLOBAL_BOARD_NAME, created: true };
}

// ─── Tool Handlers ──────────────────────────────────────────────────────────

async function handleTool(
  sb: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // ── Global Board ─────────────────────────────────────────
    case "get_or_create_global_board": {
      const board = await getOrCreateGlobalBoard(sb, userId);
      return json({
        board_id: board.id,
        name: board.name,
        status: board.created ? "created" : "exists",
      });
    }

    // ── Projects ──────────────────────────────────────────────
    case "list_projects": {
      const { data, error } = await sb
        .from("projects")
        .select("id, name, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      const slim = (data || []).map(p => ({ id: p.id, name: p.name }));
      return json({ projects: slim, count: slim.length });
    }

    // ── Boards ────────────────────────────────────────────────
    case "list_boards": {
      const { data, error } = await sb
        .from("kanban_boards")
        .select("id, name, description, created_at")
        .eq("project_id", args.project_id as string)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return json({ boards: data, count: data?.length || 0 });
    }

    case "create_board": {
      const projectId = args.project_id as string;
      const boardName = (args.name as string) || "Tasks";

      // Verify project exists
      const { data: project, error: projErr } = await sb
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .single();
      if (projErr || !project) throw new Error("Project not found");

      // Create board
      const { data: board, error: boardErr } = await sb
        .from("kanban_boards")
        .insert({
          project_id: projectId,
          name: boardName,
          user_id: userId,
        })
        .select("id")
        .single();
      if (boardErr) throw new Error(boardErr.message);

      // Create default columns
      const defaultColumns = ["To Do", "In Progress", "In Review", "Done", "Cancelled"];
      for (let i = 0; i < defaultColumns.length; i++) {
        const { error: colErr } = await sb.from("kanban_columns").insert({
          board_id: board!.id,
          name: defaultColumns[i],
          position: i,
        });
        if (colErr) throw new Error(`Failed to create column '${defaultColumns[i]}': ${colErr.message}`);
      }

      return json({ board_id: board!.id, name: boardName, status: "created", columns: defaultColumns });
    }

    // ── Tasks ─────────────────────────────────────────────────
    case "list_tasks": {
      // Use global board if no board_id specified
      let boardId = args.board_id as string | undefined;
      if (!boardId) {
        const globalBoard = await getOrCreateGlobalBoard(sb, userId);
        boardId = globalBoard.id;
      }

      let query = sb
        .from("kanban_cards")
        .select(
          `id, title, description, status, priority, labels, due_date, position, created_at, updated_at,
           column:column_id(id, name)`
        )
        .eq("board_id", boardId)
        .order("position", { ascending: true });

      if (args.status) query = query.eq("status", args.status as string);
      query = query.limit((args.limit as number) || 50);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return json({ tasks: data, count: data?.length || 0, board_id: boardId });
    }

    case "get_task": {
      const { data, error } = await sb
        .from("kanban_cards")
        .select(
          `id, title, description, status, priority, labels, due_date, position, created_at, updated_at,
           column:column_id(id, name),
           board:board_id(id, name, project_id)`
        )
        .eq("id", args.task_id as string)
        .single();
      if (error) throw new Error(error.message);
      return json({ task: data });
    }

    case "create_task": {
      // Use global board if no board_id specified
      let boardId = args.board_id as string | undefined;
      if (!boardId) {
        const globalBoard = await getOrCreateGlobalBoard(sb, userId);
        boardId = globalBoard.id;
      }

      const colId = await getColumnByStatus(sb, boardId, "todo");
      if (!colId) throw new Error("Could not find 'To Do' column");

      const { data: last } = await sb
        .from("kanban_cards")
        .select("position")
        .eq("column_id", colId)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      // Add project_id as a label if provided
      const labels = (args.labels as unknown[]) || [];
      const projectId = args.project_id as string | undefined;
      if (projectId) {
        labels.push({ name: `project:${projectId}`, color: "#6366f1" });
      }

      const { data, error } = await sb
        .from("kanban_cards")
        .insert({
          board_id: boardId,
          column_id: colId,
          user_id: userId,
          title: args.title as string,
          description: (args.description as string) || null,
          priority: (args.priority as string) || "medium",
          labels,
          status: "todo",
          position: (last?.position || 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return json({ task_id: data!.id, board_id: boardId, status: "created", project_id: projectId || null });
    }

    case "update_task": {
      const taskId = args.task_id as string;
      const updates: Record<string, unknown> = {};
      if (args.title) updates.title = args.title;
      if (args.description !== undefined) updates.description = args.description;
      if (args.priority) updates.priority = args.priority;

      if (args.status) {
        updates.status = args.status;
        const { data: card } = await sb
          .from("kanban_cards")
          .select("board_id")
          .eq("id", taskId)
          .single();
        if (card) {
          const col = await getColumnByStatus(sb, card.board_id, args.status as string);
          if (col) updates.column_id = col;
        }
      }

      const { data, error } = await sb
        .from("kanban_cards")
        .update(updates)
        .eq("id", taskId)
        .select("id, title, status, priority")
        .single();
      if (error) throw new Error(error.message);
      return json({ task: data, status: "updated" });
    }

    // ── Claim (start working) ─────────────────────────────────
    case "claim_task": {
      const taskId = args.task_id as string;
      const executor = (args.executor as string) || detectExecutor();

      // Get card
      const { data: card, error: cardErr } = await sb
        .from("kanban_cards")
        .select("id, board_id, title")
        .eq("id", taskId)
        .single();
      if (cardErr || !card) throw new Error(cardErr?.message || "Task not found");

      // Move to In Progress
      const col = await getColumnByStatus(sb, card.board_id, "inprogress");
      if (col) {
        await sb
          .from("kanban_cards")
          .update({ status: "inprogress", column_id: col })
          .eq("id", taskId);
      }

      // Create workspace
      const branch =
        (args.branch as string) ||
        `task/${slugify(card.title)}-${taskId.slice(0, 8)}`;

      const { data: ws, error: wsErr } = await sb
        .from("kanban_workspaces")
        .insert({ card_id: taskId, user_id: userId, branch })
        .select("id")
        .single();
      if (wsErr) throw new Error(wsErr.message);

      // Create session
      const { data: sess } = await sb
        .from("kanban_sessions")
        .insert({ workspace_id: ws!.id, user_id: userId, executor })
        .select("id")
        .single();

      return json({
        task_id: taskId,
        workspace_id: ws!.id,
        session_id: sess?.id,
        branch,
        executor,
        status: "claimed",
      });
    }

    // ── Complete ──────────────────────────────────────────────
    case "complete_task": {
      const taskId = args.task_id as string;
      const summary = (args.summary as string) || null;

      // Move to Done
      const { data: card } = await sb
        .from("kanban_cards")
        .select("board_id")
        .eq("id", taskId)
        .single();
      if (card) {
        const col = await getColumnByStatus(sb, card.board_id, "done");
        const updates: Record<string, unknown> = { status: "done" };
        if (col) updates.column_id = col;
        await sb.from("kanban_cards").update(updates).eq("id", taskId);
      }

      // Log summary if provided
      if (summary) {
        await logToSession(sb, userId, taskId, summary, true);
      }

      return json({ task_id: taskId, status: "done" });
    }

    // ── Log Progress ──────────────────────────────────────────
    case "log_progress": {
      const taskId = args.task_id as string;
      const message = args.message as string;
      const sessionId = args.session_id as string | undefined;
      await logToSession(sb, userId, taskId, message, false, sessionId);
      return json({ task_id: taskId, session_id: sessionId || null, status: "logged" });
    }

    // ── Delete ────────────────────────────────────────────────
    case "delete_task": {
      const { error } = await sb
        .from("kanban_cards")
        .delete()
        .eq("id", args.task_id as string);
      if (error) throw new Error(error.message);
      return json({ deleted_task_id: args.task_id, status: "deleted" });
    }

    // ── Migration ─────────────────────────────────────────────
    case "migrate_to_global_board": {
      // Get or create global board
      const globalBoard = await getOrCreateGlobalBoard(sb, userId);

      // Get all tasks from ALL boards (except global board)
      const { data: allTasks, error: tasksErr } = await sb
        .from("kanban_cards")
        .select("id, title, status, board_id")
        .eq("user_id", userId)
        .neq("board_id", globalBoard.id);

      if (tasksErr) throw new Error(tasksErr.message);
      if (!allTasks || allTasks.length === 0) {
        return json({ migrated: 0, message: "No tasks to migrate", global_board_id: globalBoard.id });
      }

      // Move each task to global board
      let migrated = 0;
      for (const task of allTasks) {
        // Get the correct column in global board for this task's status
        const colId = await getColumnByStatus(sb, globalBoard.id, task.status || "todo");
        if (!colId) continue;

        const { error: updateErr } = await sb
          .from("kanban_cards")
          .update({ board_id: globalBoard.id, column_id: colId })
          .eq("id", task.id);

        if (!updateErr) migrated++;
      }

      return json({
        migrated,
        total_found: allTasks.length,
        global_board_id: globalBoard.id,
        status: "migration_complete",
      });
    }

    // ── Start Session ─────────────────────────────────────────
    case "start_session": {
      const taskId = args.task_id as string;
      const executor = (args.executor as string) || detectExecutor();
      const focus = args.focus as string;

      // Find existing non-archived workspace for this task
      const { data: existingWs } = await sb
        .from("kanban_workspaces")
        .select("id, branch")
        .eq("card_id", taskId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let workspaceId: string;
      let branch: string;

      if (existingWs) {
        // Reuse existing workspace
        workspaceId = existingWs.id;
        branch = existingWs.branch;
      } else {
        // Create new workspace (first session for this task)
        const { data: card, error: cardErr } = await sb
          .from("kanban_cards")
          .select("id, board_id, title")
          .eq("id", taskId)
          .single();
        if (cardErr || !card) throw new Error(cardErr?.message || "Task not found");

        // Move to In Progress if not already
        const col = await getColumnByStatus(sb, card.board_id, "inprogress");
        if (col) {
          await sb
            .from("kanban_cards")
            .update({ status: "inprogress", column_id: col })
            .eq("id", taskId);
        }

        branch = `task/${slugify(card.title)}-${taskId.slice(0, 8)}`;

        const { data: ws, error: wsErr } = await sb
          .from("kanban_workspaces")
          .insert({ card_id: taskId, user_id: userId, branch })
          .select("id")
          .single();
        if (wsErr) throw new Error(wsErr.message);

        workspaceId = ws!.id;
      }

      // Create new session with focus and status
      const { data: sess, error: sessErr } = await sb
        .from("kanban_sessions")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          executor,
          focus,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id, executor, focus, status, started_at")
        .single();
      if (sessErr) throw new Error(sessErr.message);

      return json({
        session_id: sess!.id,
        workspace_id: workspaceId,
        executor: sess!.executor,
        focus: sess!.focus,
        status: sess!.status,
        started_at: sess!.started_at,
        branch,
      });
    }

    // ── List Sessions ─────────────────────────────────────────
    case "list_sessions": {
      const taskId = args.task_id as string;
      const statusFilter = args.status as string | undefined;

      // Find all workspaces for this task (including archived for history)
      const { data: workspaces, error: wsErr } = await sb
        .from("kanban_workspaces")
        .select("id, branch, archived, created_at")
        .eq("card_id", taskId)
        .order("created_at", { ascending: false });

      if (wsErr) throw new Error(wsErr.message);
      if (!workspaces || workspaces.length === 0) {
        return json({ sessions: [], count: 0, task_id: taskId });
      }

      const workspaceIds = workspaces.map((w) => w.id);

      // Get all sessions for these workspaces
      let sessionQuery = sb
        .from("kanban_sessions")
        .select("id, workspace_id, executor, focus, status, started_at, completed_at, created_at")
        .in("workspace_id", workspaceIds)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        sessionQuery = sessionQuery.eq("status", statusFilter);
      }

      const { data: sessions, error: sessErr } = await sessionQuery;
      if (sessErr) throw new Error(sessErr.message);

      // Enrich sessions with workspace info
      const workspaceMap = new Map(workspaces.map((w) => [w.id, w]));
      const enrichedSessions = (sessions || []).map((s) => {
        const ws = workspaceMap.get(s.workspace_id);
        return {
          session_id: s.id,
          workspace_id: s.workspace_id,
          branch: ws?.branch,
          workspace_archived: ws?.archived,
          executor: s.executor,
          focus: s.focus,
          status: s.status,
          started_at: s.started_at,
          completed_at: s.completed_at,
          created_at: s.created_at,
        };
      });

      return json({
        sessions: enrichedSessions,
        count: enrichedSessions.length,
        task_id: taskId,
      });
    }

    // ── Update Session ────────────────────────────────────────
    case "update_session": {
      const sessionId = args.session_id as string;
      const updates: Record<string, unknown> = {};

      if (args.status) {
        updates.status = args.status;
        // If completed, set completed_at timestamp
        if (args.status === "completed") {
          updates.completed_at = new Date().toISOString();
        }
      }

      if (args.focus !== undefined) {
        updates.focus = args.focus;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No updates provided. Specify status or focus.");
      }

      const { data: sess, error: sessErr } = await sb
        .from("kanban_sessions")
        .update(updates)
        .eq("id", sessionId)
        .select("id, workspace_id, executor, focus, status, started_at, completed_at")
        .single();

      if (sessErr) throw new Error(sessErr.message);

      return json({
        session: sess,
        status: "updated",
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Auto-detect which coding agent is running based on env vars / process info.
 */
function detectExecutor(): string {
  // OpenClaw sets these
  if (process.env.OPENCLAW_SESSION || process.env.OPENCLAW_AGENT)
    return "OPENCLAW";
  // Claude Code sets CLAUDE_CODE
  if (process.env.CLAUDE_CODE === "1" || process.env.CLAUDE_SESSION_ID)
    return "CLAUDE_CODE";
  // Cursor
  if (process.env.CURSOR_SESSION_ID || process.env.CURSOR_TRACE_ID)
    return "CURSOR";
  // Codex
  if (process.env.CODEX_SESSION_ID) return "CODEX";
  // Gemini
  if (process.env.GEMINI_CLI) return "GEMINI";
  // Amp
  if (process.env.AMP_SESSION_ID) return "AMP";
  // Fallback: check parent process name
  try {
    const ppid = process.ppid;
    if (ppid) {
      // Best effort — doesn't matter if this fails
    }
  } catch {
    // ignore
  }
  return "UNKNOWN";
}

/**
 * Log a message to a session for a task.
 * If sessionId is provided, logs to that specific session.
 * Otherwise, logs to the most recent active session for the task.
 */
async function logToSession(
  sb: SupabaseClient,
  userId: string,
  taskId: string,
  message: string,
  complete: boolean,
  sessionId?: string
): Promise<void> {
  let sessId: string;
  let wsId: string;

  if (sessionId) {
    // Use provided session directly
    const { data: sess } = await sb
      .from("kanban_sessions")
      .select("id, workspace_id")
      .eq("id", sessionId)
      .single();
    if (!sess) return;
    sessId = sess.id;
    wsId = sess.workspace_id;
  } else {
    // Find active workspace for this task
    const { data: ws } = await sb
      .from("kanban_workspaces")
      .select("id")
      .eq("card_id", taskId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!ws) return;
    wsId = ws.id;

    // Find most recent session
    const { data: sess } = await sb
      .from("kanban_sessions")
      .select("id")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!sess) return;
    sessId = sess.id;
  }

  // Create execution process
  const { data: proc } = await sb
    .from("kanban_execution_processes")
    .insert({
      session_id: sessId,
      run_reason: "codingagent",
      status: complete ? "completed" : "running",
      ...(complete ? { completed_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (!proc) return;

  // Log the message
  await sb.from("kanban_execution_process_logs").insert({
    execution_process_id: proc.id,
    log_type: "stdout",
    output: message,
    byte_size: Buffer.byteLength(message, "utf-8"),
  });

  // If completing, also add a coding agent turn with summary
  if (complete) {
    await sb.from("kanban_coding_agent_turns").insert({
      execution_process_id: proc.id,
      summary: message,
      seen: false,
    });

    // Archive workspace
    await sb
      .from("kanban_workspaces")
      .update({ archived: true })
      .eq("id", wsId);
  }
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
    console.error("Not logged in. Run: npx @crowdlisten/kanban-mcp login");
  }
  process.exit(0);
} else if (command === "setup") {
  // Manual setup into specific agent or re-run auto-install
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
CrowdListen Kanban MCP Server

COMMANDS:
  login     Sign in + auto-configure your coding agents
  setup     Re-run auto-configure for agent MCP configs
  logout    Clear saved credentials
  whoami    Show current user
  help      Show this help

QUICK START:

  npx @crowdlisten/kanban-mcp login

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
