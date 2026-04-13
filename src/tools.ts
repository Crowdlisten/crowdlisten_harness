/**
 * CrowdListen Tasks — Planning and Delegation Business Logic
 *
 * All pure functions, tool handlers, and Supabase interaction logic.
 * Routes executable work to coding agents with project context intact.
 * Extracted from index.ts for testability.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { runPipeline } from "./context/pipeline.js";
import { getBlocks, addBlocks } from "./context/store.js";
import { matchSkills, discoverSkills, searchSkills, getSkillCategories, getFullCatalog } from "./context/matcher.js";
import { loadUserState, saveUserState, activatePack, deactivatePack } from "./context/user-state.js";
import type { TelemetryLevel } from "./context/user-state.js";
import { listPacks, hasPack, getPack, getSkillMdContent, getPackTools } from "./tools/registry.js";
import type { ContextBlock } from "./context/types.js";
// logLearning/searchLearnings — kept in learnings.ts but no longer imported (consolidated into save/recall)
import { AGENT_TOOLS, isAgentTool, handleAgentTool } from "./agent-tools.js";

// ─── Constants ──────────────────────────────────────────────────────────────

export const AUTH_DIR = path.join(os.homedir(), ".crowdlisten");
export const AUTH_FILE = path.join(AUTH_DIR, "auth.json");

// ─── Auth Persistence ───────────────────────────────────────────────────────

export interface StoredAuth {
  access_token: string;
  refresh_token: string;
  user_id: string;
  email: string;
  expires_at?: number;
  api_key?: string;
}

export function loadAuth(): StoredAuth | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export function clearAuth(): void {
  try {
    fs.unlinkSync(AUTH_FILE);
  } catch {
    // ignore
  }
}

// ─── API Key Auto-Provisioning ────────────────────────────────────────────

const AGENT_BASE =
  process.env.CROWDLISTEN_AGENT_URL || "https://agent.crowdlisten.com";

/**
 * Provision a Research Partner API key using a Supabase JWT.
 * Calls POST /api/user/keys on the agent backend.
 * Returns the `cl_live_*` key on success, or null on failure.
 * Never throws — login must not be blocked by key provisioning.
 */
export async function provisionApiKey(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${AGENT_BASE}/api/user/keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "harness-auto",
        scopes: ["analysis", "research", "context"],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`⚠️  API key provisioning failed (${res.status}): ${text || res.statusText}`);
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    const key = (data.key ?? data.api_key ?? data.token) as string | undefined;
    if (!key || typeof key !== "string") {
      console.error("⚠️  API key provisioning returned unexpected response");
      return null;
    }

    return key;
  } catch (err) {
    // Network error, timeout, or offline — never block login
    console.error(`⚠️  API key provisioning skipped: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── Browser Helper ────────────────────────────────────────────────────────

export function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (process.platform === "win32") {
      execSync(`start "" "${url}"`);
    } else {
      execSync(`xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || echo ""`);
    }
  } catch {
    // Silent fail
  }
}

/**
 * HTML page shown in the browser after auth callback
 */
export function callbackHtml(success: boolean, error?: string): string {
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
  <div class="check">&#10004;</div>
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
  <div class="icon">&#10060;</div>
  <h1>Login failed</h1>
  <p>${error || "Something went wrong. Please try again."}</p>
</div></body></html>`;
}

// ─── Auto-Install MCP Config ────────────────────────────────────────────────

export const MCP_ENTRY = {
  command: "npx",
  args: ["-y", "@crowdlisten/harness"],
};

export interface AgentConfig {
  name: string;
  configPath: string;
  mcpKey: string;
  wrapperKey?: string;
  /** Shell command to install MCP entry (e.g. `codex mcp add`). Skips JSON config parsing when set. */
  cliInstall?: string;
}

export function getAgentConfigs(): AgentConfig[] {
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
      name: "Gemini CLI",
      configPath: path.join(home, ".gemini", "settings.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Codex",
      configPath: path.join(home, ".codex", "config.toml"),
      mcpKey: "mcp_servers",
      cliInstall: "codex mcp add crowdlisten -- npx -y @crowdlisten/harness",
    },
    {
      name: "OpenClaw",
      configPath: path.join(home, ".openclaw", "openclaw.json"),
      mcpKey: "mcpServers",
    },
    {
      name: "Amp",
      configPath: path.join(home, ".config", "amp", "settings.json"),
      mcpKey: "amp.mcpServers",
    },
  ];
}

export async function autoInstallMcp(): Promise<string[]> {
  const installed: string[] = [];

  for (const agent of getAgentConfigs()) {
    try {
      // CLI-based install (e.g. Codex uses TOML config — shell out instead of parsing)
      if (agent.cliInstall) {
        try {
          execSync(agent.cliInstall, { stdio: "pipe", timeout: 15_000 });
          installed.push(agent.name);
        } catch {
          // CLI not found or command failed — skip silently
        }
        continue;
      }

      if (!fs.existsSync(agent.configPath)) continue;

      let config: Record<string, unknown> = {};
      try {
        const raw = fs.readFileSync(agent.configPath, "utf-8");
        config = JSON.parse(raw);
      } catch {
        continue;
      }

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

      let changed = false;
      // Unified server replaces the old two-server setup
      if (!servers["crowdlisten"]) {
        servers["crowdlisten"] = { ...MCP_ENTRY };
        changed = true;
      }
      // Clean up old entries if present
      if (servers["crowdlisten/harness"]) {
        delete servers["crowdlisten/harness"];
        changed = true;
      }
      if (servers["crowdlisten/insights"]) {
        delete servers["crowdlisten/insights"];
        changed = true;
      }
      if (!changed) continue;

      target[leafKey] = servers;

      fs.writeFileSync(agent.configPath, JSON.stringify(config, null, 2) + "\n");
      installed.push(agent.name);
    } catch {
      // Non-fatal
    }
  }

  return installed;
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

export const TOOLS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE (2 tools — always on)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "skills",
    description:
      "List or activate skill packs. action='list' shows available packs. action='activate' enables a pack's tools. SKILL.md packs return workflow instructions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["list", "activate"],
          description: "Action: 'list' to see packs, 'activate' to enable one. Default: 'list'.",
        },
        pack_id: {
          type: "string",
          description: "Pack ID to activate (required for action='activate')",
        },
        include_virtual: {
          type: "boolean",
          description: "Include SKILL.md workflow packs in list (default true)",
        },
      },
    },
  },
  {
    name: "save",
    description:
      "Save context that persists across sessions. Also: write wiki pages (set path), ingest analysis results (set analysis_id), or bulk-import a local folder (set folder). Use tags to categorize. Set publish=true to share with your team.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Short title",
        },
        content: {
          type: "string",
          description: "The content to remember",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Freeform tags (e.g. ['decision', 'auth', 'pattern'])",
        },
        project_id: {
          type: "string",
          description: "Optional project scope",
        },
        task_id: {
          type: "string",
          description: "Optional task association",
        },
        confidence: {
          type: "number",
          description: "Confidence 0-1 (default 1.0)",
        },
        publish: {
          type: "boolean",
          description: "Publish to your team after saving (default false)",
        },
        team_id: {
          type: "string",
          description: "Team UUID (required when publish=true)",
        },
        // ── Absorbed from wiki_write ──
        path: {
          type: "string",
          description: "Explicit page path (e.g. 'notes/auth-approach'). If set, writes to this path instead of auto-generating.",
        },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description: "Write mode for path-based saves. Default: replace.",
        },
        // ── Absorbed from wiki_ingest ──
        analysis_id: {
          type: "string",
          description: "Analysis ID to convert results into knowledge pages.",
        },
        // ── Absorbed from ingest_folder ──
        folder: {
          type: "string",
          description: "Local folder path to sync to knowledge base.",
        },
        extensions: {
          type: "array",
          items: { type: "string" },
          description: "File extensions to include (default [\".md\", \".txt\"]).",
        },
        recursive: {
          type: "boolean",
          description: "Whether to recurse into subdirectories.",
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLANNING (6 tools — activated via pack)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "list_tasks",
    description:
      "List tasks on the board, or get details of a single task. Pass task_id for single-task detail. Filter by status: todo, inprogress, inreview, done, cancelled. Pass claim with a task_id to start working on it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Optional: get full details of a specific task" },
        board_id: { type: "string", description: "Optional: specific board (defaults to global board)" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number", description: "Max results (default 50)" },
        // ── Absorbed from claim_task ──
        claim: { type: "string", description: "Task ID to claim (start working on it)." },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task on the board. Uses global board by default. Optionally tag with a project_id for scoping.",
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
  // claim_task tool definition removed — absorbed into list_tasks (use claim param)
  // Backward-compatible alias handled in TOOL_ALIASES (see index.ts)
  {
    name: "complete_task",
    description: "Mark task done, log progress, execute via agent, or check execution status. Pass progress=true for progress notes, execute=true for agent execution, status=true to check execution status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        summary: { type: "string", description: "Summary of work completed (or progress message)" },
        progress: { type: "boolean", description: "If true, log progress note without completing the task" },
        // ── Absorbed from execute_task ──
        execute: { type: "boolean", description: "Execute task via agent." },
        session_id: { type: "string", description: "Session UUID (from claim_task or start_session)" },
        prompt: { type: "string", description: "Execution prompt for agent." },
        executor: { type: "string", description: "Agent type for execution." },
        // ── Absorbed from get_execution_status ──
        status: { type: "boolean", description: "Check execution status." },
        process_id: { type: "string", description: "Process ID to check status for." },
      },
      required: ["task_id"],
    },
  },

  // ── Wiki tool definitions removed — absorbed into save/recall ──────────────
  // Backward-compatible aliases are handled in TOOL_ALIASES (see index.ts)

  {
    name: "recall",
    description:
      "Search your knowledge base. Also: read a page by path, list pages, keyword search, view activity log, get recent insights, get user context, get observation feed, or get clustered themes. Semantic search by default.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query for semantic search (default) or keyword search.",
        },
        // ── Absorbed from wiki_read ──
        path: {
          type: "string",
          description: "Read a specific page by path.",
        },
        shared_project_id: {
          type: "string",
          description: "Public project UUID — reads from a shared project's knowledge base (no auth required for public projects)",
        },
        // ── Absorbed from wiki_list ──
        list: {
          type: "boolean",
          description: "List/enumerate pages.",
        },
        prefix: {
          type: "string",
          description: "Path prefix filter for listing.",
        },
        // ── Absorbed from wiki_search ──
        mode: {
          type: "string",
          enum: ["semantic", "keyword"],
          description: "Search mode. Default: semantic.",
        },
        // ── Absorbed from wiki_log ──
        log: {
          type: "boolean",
          description: "Return activity log entries.",
        },
        // ── Absorbed from get_recent_insights ──
        recent: {
          type: "boolean",
          description: "Get time-filtered recent insights.",
        },
        days: {
          type: "number",
          description: "Lookback days for recent mode. Default: 7.",
        },
        // ── Absorbed from get_user_context ──
        context: {
          type: "boolean",
          description: "Get synthesized context on a topic.",
        },
        topic: {
          type: "string",
          description: "Topic filter for context mode.",
        },
        // ── Absorbed from get_observation_feed ──
        observations: {
          type: "boolean",
          description: "Get observation feed.",
        },
        type: {
          type: "string",
          description: "Observation type filter.",
        },
        // ── Absorbed from get_theme_insights ──
        themes: {
          type: "boolean",
          description: "Get clustered themes with severity/trends.",
        },
        // ── Existing filters ──
        path_prefix: {
          type: "string",
          description: "Filter by path prefix (e.g. 'notes/', 'documents/', 'projects/my-project/')",
        },
        project_id: {
          type: "string",
          description: "Optional project UUID to scope search",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
    },
  },

  ...AGENT_TOOLS,

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTOR MANAGEMENT (1 tool)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "setup_connector",
    description:
      "Register a new observation connector for a project. Returns an API key that agents use to submit observations via submit_observation. Each connector tracks which agent/bot is writing data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Display name for the connector (e.g., 'Slack Bot - #product-feedback')",
        },
        project_id: {
          type: "string",
          description: "Project UUID to associate observations with",
        },
        connector_type: {
          type: "string",
          enum: ["agent", "native_bot", "webhook"],
          description: "Type of connector (default: agent)",
        },
        platform: {
          type: "string",
          description: "Platform the connector operates on (slack, discord, etc.)",
        },
      },
      required: ["name", "project_id"],
    },
  },
];

// ─── Status <-> Column mapping ────────────────────────────────────────────────

export const STATUS_COLUMN: Record<string, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  inreview: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

export async function getColumnByStatus(
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

export const GLOBAL_BOARD_NAME = "Global Tasks";

export async function getOrCreateGlobalBoard(
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
        description: "Container for your global task board",
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

export async function handleTool(
  sb: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    // ── Core: skills (merged list_skill_packs + activate_skill_pack) ─────
    case "skills": {
      const action = (args.action as string) || "list";

      if (action === "activate") {
        const packId = args.pack_id as string;
        if (!packId) return json({ error: "Missing 'pack_id' parameter" });
        if (!hasPack(packId)) return json({ error: `Pack '${packId}' not found. Use skills({ action: 'list' }) to see available packs.` });

        const pack = getPack(packId)!;

        // Virtual SKILL.md packs — return content
        if (pack.isVirtual) {
          const content = getSkillMdContent(packId);
          if (!content) return json({ error: `SKILL.md not found for pack '${packId}'` });
          return json({
            activated: packId,
            type: "skill_workflow",
            name: pack.name,
            description: pack.description,
            instructions: content,
          });
        }

        // Regular tool pack
        const state = activatePack(packId);
        const tools = getPackTools(packId).map(t => t.name);
        return json({
          activated: packId,
          type: "tool_pack",
          name: pack.name,
          tools,
          toolCount: tools.length,
          totalActivePacks: state.activePacks.length,
          _needsListChanged: true,
        });
      }

      // Default: list
      const includeVirtual = args.include_virtual !== false;
      const state = loadUserState();
      let packList = listPacks(state.activePacks);
      if (!includeVirtual) {
        packList = packList.filter(p => !p.isVirtual);
      }
      return json({
        packs: packList,
        activePacks: state.activePacks.length,
        totalPacks: packList.length,
        hint: "Call skills({ action: 'activate', pack_id: '...' }) to unlock a pack's tools.",
      });
    }

    // ── Legacy: Global Board ─────────────────────────────────────────
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
      const slim = (data || []).map((p: Record<string, unknown>) => ({ id: p.id, name: p.name }));
      return json({ projects: slim, count: slim.length });
    }


    // ── Tasks ─────────────────────────────────────────────────
    case "list_tasks": {
      // ── Absorbed from claim_task ──
      if (args.claim) {
        return handleTool(sb, userId, "claim_task", { task_id: args.claim, executor: args.executor, branch: args.branch });
      }

      // Single-task detail mode (absorbs get_task)
      if (args.task_id) {
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

      // List mode
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

    // Legacy alias — route to list_tasks with task_id
    case "get_task":
      return handleTool(sb, userId, "list_tasks", { task_id: args.task_id });

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

      // Fetch project context if this board belongs to a project
      let projectContext: string | null = null;
      let contextEntries: unknown[] = [];
      let existingPlan: unknown = null;
      try {
        const { data: board } = await sb
          .from("kanban_boards")
          .select("project_id")
          .eq("id", card.board_id)
          .single();

        if (board?.project_id) {
          projectContext = await buildProjectContextMd(sb, board.project_id);

          // Fetch relevant context entries (active decisions, constraints, patterns, etc.)
          const { data: ctx } = await sb
            .from("planning_context")
            .select("id, type, title, body, tags, confidence")
            .eq("user_id", userId)
            .eq("project_id", board.project_id)
            .in("status", ["active", "approved", "executing"])
            .order("updated_at", { ascending: false })
            .limit(20);
          if (ctx) contextEntries = ctx;
        }

        // Fetch existing plan for this task
        const { data: plan } = await sb
          .from("planning_context")
          .select("id, title, body, metadata, status, version")
          .eq("task_id", taskId)
          .eq("type", "plan")
          .not("status", "in", '("completed","archived","superseded")')
          .single();
        if (plan) existingPlan = plan;
      } catch {
        // Non-blocking — proceed without context
      }

      return json({
        task_id: taskId,
        workspace_id: ws!.id,
        session_id: sess?.id,
        branch,
        executor,
        status: "claimed",
        project_context: projectContext,
        context_entries: contextEntries,
        existing_plan: existingPlan,
      });
    }

    // ── Complete (absorbs log_progress, execute_task, get_execution_status) ──────
    case "complete_task": {
      // ── Absorbed from execute_task ──
      if (args.execute) {
        return handleAgentTool("execute_task", {
          session_id: args.session_id,
          prompt: args.prompt,
          executor: args.executor,
          cwd: args.cwd,
          auto_approve: args.auto_approve,
          allowed_tools: args.allowed_tools,
          context: args.context,
        });
      }
      // ── Absorbed from get_execution_status ──
      if (args.status && args.process_id) {
        return handleAgentTool("get_execution_status", { process_id: args.process_id });
      }

      const taskId = args.task_id as string;
      const summary = (args.summary as string) || null;
      const progressOnly = !!(args.progress);

      // Progress mode: log a note without completing
      if (progressOnly) {
        if (summary) {
          await logToSession(sb, userId, taskId, summary, false);
        }
        return json({ task_id: taskId, status: "progress_logged" });
      }

      // Complete mode: move to Done
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

      // Mark active plan as completed
      try {
        await sb
          .from("planning_context")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("task_id", taskId)
          .eq("type", "plan")
          .in("status", ["draft", "review", "approved", "executing"]);
      } catch {
        // Non-blocking
      }

      // Log summary if provided
      if (summary) {
        await logToSession(sb, userId, taskId, summary, true);
      }

      return json({ task_id: taskId, status: "done" });
    }

    // Legacy alias — route to complete_task with progress=true
    case "log_progress":
      return handleTool(sb, userId, "complete_task", { task_id: args.task_id, summary: args.message, progress: true });

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
        workspaceId = existingWs.id;
        branch = existingWs.branch;
      } else {
        const { data: card, error: cardErr } = await sb
          .from("kanban_cards")
          .select("id, board_id, title")
          .eq("id", taskId)
          .single();
        if (cardErr || !card) throw new Error(cardErr?.message || "Task not found");

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

      const { data: workspaces, error: wsErr } = await sb
        .from("kanban_workspaces")
        .select("id, branch, archived, created_at")
        .eq("card_id", taskId)
        .order("created_at", { ascending: false });

      if (wsErr) throw new Error(wsErr.message);
      if (!workspaces || workspaces.length === 0) {
        return json({ sessions: [], count: 0, task_id: taskId });
      }

      const workspaceIds = workspaces.map((w: Record<string, unknown>) => w.id);

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

      const workspaceMap = new Map(workspaces.map((w: Record<string, unknown>) => [w.id, w]));
      const enrichedSessions = (sessions || []).map((s: Record<string, unknown>) => {
        const ws = workspaceMap.get(s.workspace_id) as Record<string, unknown> | undefined;
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

    // ── Planning & Context ────────────────────────────────────

    case "create_plan": {
      const taskId = args.task_id as string;
      const approach = args.approach as string;

      // Build metadata from optional structured fields
      const metadata: Record<string, unknown> = {};
      if (args.assumptions) metadata.assumptions = args.assumptions;
      if (args.constraints) metadata.constraints = args.constraints;
      if (args.success_criteria) metadata.success_criteria = args.success_criteria;
      if (args.risks) metadata.risks = args.risks;
      if (args.estimated_steps) metadata.estimated_steps = args.estimated_steps;

      // Look up project_id from the task's board
      let projectId: string | null = null;
      try {
        const { data: card } = await sb
          .from("kanban_cards")
          .select("board_id")
          .eq("id", taskId)
          .single();
        if (card) {
          const { data: board } = await sb
            .from("kanban_boards")
            .select("project_id")
            .eq("id", card.board_id)
            .single();
          if (board?.project_id) projectId = board.project_id;
        }
      } catch {
        // Non-blocking
      }

      const { data: plan, error: planErr } = await sb
        .from("planning_context")
        .insert({
          user_id: userId,
          project_id: projectId,
          task_id: taskId,
          type: "plan",
          title: `Plan: ${approach.slice(0, 80)}`,
          body: approach,
          metadata,
          status: "draft",
          source: "agent",
          source_agent: detectExecutor(),
        })
        .select("id, status, version")
        .single();
      if (planErr) throw new Error(planErr.message);

      return json({ plan_id: plan!.id, status: plan!.status, version: plan!.version });
    }

    case "get_plan": {
      const taskId = args.task_id as string;

      const { data: plan, error: planErr } = await sb
        .from("planning_context")
        .select("id, title, body, metadata, status, version, source, source_agent, confidence, created_at, updated_at")
        .eq("task_id", taskId)
        .eq("type", "plan")
        .not("status", "in", '("completed","archived","superseded")')
        .single();

      if (planErr || !plan) {
        return json({ plan: null, versions: [], message: "No active plan for this task" });
      }

      const { data: versions } = await sb
        .from("planning_context_versions")
        .select("version, title, body, metadata, status, feedback, created_at")
        .eq("context_id", plan.id)
        .order("version", { ascending: false });

      return json({ plan, versions: versions || [] });
    }

    case "update_plan": {
      const planId = args.plan_id as string;

      // Get current plan state
      const { data: current, error: getErr } = await sb
        .from("planning_context")
        .select("id, title, body, metadata, status, version")
        .eq("id", planId)
        .single();
      if (getErr || !current) throw new Error(getErr?.message || "Plan not found");

      const hasContentChange = args.approach || args.assumptions || args.constraints ||
        args.success_criteria || args.risks;
      const hasFeedback = !!args.feedback;

      // Archive current version if content is changing or feedback given
      if (hasContentChange || hasFeedback) {
        await sb.from("planning_context_versions").insert({
          context_id: planId,
          version: current.version,
          title: current.title,
          body: current.body,
          metadata: current.metadata,
          status: current.status,
          feedback: (args.feedback as string) || null,
        });
      }

      // Build updates
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (args.approach) {
        updates.body = args.approach;
        updates.title = `Plan: ${(args.approach as string).slice(0, 80)}`;
      }

      // Merge metadata fields
      const meta = { ...(current.metadata as Record<string, unknown>) };
      if (args.assumptions) meta.assumptions = args.assumptions;
      if (args.constraints) meta.constraints = args.constraints;
      if (args.success_criteria) meta.success_criteria = args.success_criteria;
      if (args.risks) meta.risks = args.risks;
      if (hasContentChange) updates.metadata = meta;

      // Feedback auto-reverts to draft
      if (hasFeedback) {
        updates.status = "draft";
        const feedbackMeta = { ...meta, feedback: args.feedback };
        updates.metadata = feedbackMeta;
      } else if (args.status) {
        updates.status = args.status;
      }

      if (hasContentChange || hasFeedback) {
        updates.version = current.version + 1;
      }

      const { data: updated, error: upErr } = await sb
        .from("planning_context")
        .update(updates)
        .eq("id", planId)
        .select("id, status, version")
        .single();
      if (upErr) throw new Error(upErr.message);

      return json({ plan_id: updated!.id, version: updated!.version, status: updated!.status });
    }

    // query_context, add_context, record_learning → removed (consolidated into save/recall)

    // ─── Context Extraction Tools ────────────────────────────────────────────
    case "process_transcript": {
      const text = args.text as string;
      const source = (args.source as string) || "mcp";
      const isChat = args.is_chat !== false;

      const result = await runPipeline({ text, source, isChat });
      return json({
        blocks_extracted: result.blocks.length,
        blocks: result.blocks,
        skills: result.skills,
        redaction_stats: result.redactionStats,
        total_redactions: result.totalRedactions,
        chunks_processed: result.chunkCount,
      });
    }

    case "get_context_blocks": {
      const blocks = getBlocks();
      return json({ count: blocks.length, blocks });
    }

    case "recommend_skills": {
      const blocks = getBlocks();
      const skills = await matchSkills(blocks);
      return json({ skills });
    }

    // ─── Skill Discovery Tools ──────────────────────────────────────────────
    case "search_skills": {
      // Context-driven discovery mode
      if (args.context) {
        let blocks = getBlocks();
        const result = await runPipeline({
          text: args.context as string,
          source: "discover",
          isChat: true,
        });
        blocks = result.blocks;

        if (blocks.length === 0) {
          return json({
            error: "No context blocks found. Provide more detailed context text.",
            skills: [],
          });
        }

        const skills = await discoverSkills(blocks, {
          category: args.category as any,
          tier: args.tier as any,
          limit: (args.limit as number) || 10,
        });

        return json({
          mode: "context-discovery",
          total_available: 154,
          results: skills.length,
          skills: skills.map((s) => ({
            id: s.skillId,
            name: s.name,
            description: s.description,
            score: `${Math.round(s.score * 100)}%`,
            tier: s.tier,
            category: s.category,
            install: s.installMethod === "copy" ? `Copy SKILL.md from ${s.installTarget}` : s.installTarget,
            matched_keywords: s.matchedKeywords,
          })),
        });
      }

      // Keyword search mode
      const query = args.query as string;
      if (!query) return json({ error: "Provide either 'query' for keyword search or 'context' for context-driven discovery" });

      const results = searchSkills(query, {
        tier: args.tier as any,
        category: args.category as any,
      });

      return json({
        mode: "keyword-search",
        query,
        results: results.length,
        skills: results.map((s) => ({
          id: s.skillId,
          name: s.name,
          description: s.description,
          score: `${Math.round(s.score * 100)}%`,
          tier: s.tier,
          category: s.category,
          install_method: s.installMethod,
          install_target: s.installTarget,
        })),
      });
    }

    case "install_skill": {
      const skillId = args.skill_id as string;
      if (!skillId) return json({ error: "Missing 'skill_id' parameter" });

      // Search both catalogs for the skill
      const skill = getFullCatalog().find((s) => s.id === skillId);

      if (!skill) {
        return json({ error: `Skill '${skillId}' not found. Use search_skills to find available skills.` });
      }

      if (skill.installMethod === "copy") {
        const targetDir = (args.target_dir as string) || path.join(process.cwd(), ".claude", "commands");
        const skillName = skill.id.replace(/^comm-/, "");

        // For native CrowdListen skills, the installTarget is a crowdlisten: reference
        if (skill.installTarget.startsWith("crowdlisten:")) {
          return json({
            skill: skill.name,
            tier: skill.tier,
            instructions: `This is a native CrowdListen skill.`,
            install: `Add to your .claude/commands/ directory from the crowdlisten_tasks/skills/${skill.id}/ folder.`,
          });
        }

        // Community skill — provide the raw URL
        return json({
          skill: skill.name,
          tier: skill.tier,
          install_method: "copy",
          instructions: [
            `1. Create directory: mkdir -p "${targetDir}"`,
            `2. Download: curl -o "${path.join(targetDir, skillName + ".md")}" "${skill.installTarget}"`,
            `3. Or copy the SKILL.md content from: ${skill.installTarget}`,
          ],
          source: skill.source,
        });
      }

      return json({
        skill: skill.name,
        install_method: skill.installMethod,
        install_target: skill.installTarget,
        instructions: skill.installMethod === "npx"
          ? `Run: npx ${skill.installTarget}`
          : `Clone: git clone ${skill.installTarget}`,
      });
    }

    // ── Core Always-On Tools ─────────────────────────────────────
    // Legacy aliases — route to `skills` handler
    case "list_skill_packs":
      return handleTool(sb, userId, "skills", { action: "list", include_virtual: args.include_virtual });

    case "activate_skill_pack":
      return handleTool(sb, userId, "skills", { action: "activate", pack_id: args.pack_id });

    case "save": {
      // ── Route to absorbed handlers based on params ──
      if (args.folder) {
        // Absorbed from ingest_folder
        return handleTool(sb, userId, "ingest_folder", { path: args.folder, extensions: args.extensions, recursive: args.recursive, project_id: args.project_id });
      }
      if (args.analysis_id) {
        // Absorbed from wiki_ingest
        return handleTool(sb, userId, "wiki_ingest", { project_id: args.project_id, analysis_id: args.analysis_id });
      }
      if (args.path && !args.title) {
        // Path-only save without title → wiki_write shorthand (title defaults to path basename)
        const pathBasename = (args.path as string).split("/").pop() || args.path as string;
        return handleTool(sb, userId, "wiki_write", { path: args.path, title: pathBasename, content: args.content || "", tags: args.tags, project_id: args.project_id, mode: args.mode || "replace" });
      }
      if (args.path && args.title) {
        // Explicit path + title → wiki_write
        return handleTool(sb, userId, "wiki_write", { path: args.path, title: args.title, content: args.content, tags: args.tags, project_id: args.project_id, mode: args.mode || "replace" });
      }

      // ── Default: current save logic (semantic memory + page upsert) ──
      const title = args.title as string;
      const content = args.content as string;

      if (!title || !content) {
        return json({ error: "Missing required parameters: title, content" });
      }

      const tags = (args.tags as string[]) || [];
      const projectId = (args.project_id as string) || null;
      const sourceAgent = detectExecutor();
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      // Build path: projects/{slug}/docs/{title} or notes/{title}
      let pagePath: string;
      if (projectId) {
        // Look up project name for slug
        let projectSlug = projectId.slice(0, 8);
        try {
          const { data: proj } = await sb
            .from("projects")
            .select("name")
            .eq("id", projectId)
            .single();
          if (proj?.name) projectSlug = slugify(proj.name);
        } catch { /* use id prefix as slug */ }
        pagePath = `projects/${projectSlug}/docs/${slugify(title)}`;
      } else {
        pagePath = `notes/${slugify(title)}`;
      }

      // Primary: upsert to `pages` table
      let savedToSupabase = false;
      let pageId: string | null = null;
      try {
        const { data: existing } = await sb
          .from("pages")
          .select("id")
          .eq("user_id", userId)
          .eq("path", pagePath)
          .maybeSingle();

        if (existing) {
          const { error: upErr } = await sb
            .from("pages")
            .update({
              title,
              content,
              tags,
              project_id: projectId,
              source: "agent",
              source_agent: sourceAgent,
              word_count: wordCount,
              metadata: args.task_id ? { task_id: args.task_id } : {},
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (upErr) throw upErr;
          pageId = existing.id;
        } else {
          const { data: row, error: insErr } = await sb
            .from("pages")
            .insert({
              user_id: userId,
              path: pagePath,
              title,
              content,
              tags,
              project_id: projectId,
              source: "agent",
              source_agent: sourceAgent,
              word_count: wordCount,
              metadata: args.task_id ? { task_id: args.task_id } : {},
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          pageId = row!.id;
        }
        savedToSupabase = true;

        // Render to local .md knowledge base (non-blocking)
        try {
          const { renderEntry } = await import("./context/md-store.js");
          renderEntry({ id: pageId!, title, content, tags, source: "agent", source_agent: sourceAgent, project_id: projectId, confidence: 1.0, created_at: new Date().toISOString() });
        } catch {
          // Non-blocking
        }
      } catch (err: any) {
        console.error(`[save] Supabase write failed: ${err?.message || err}`);
        // Fallback to local store
        const block: ContextBlock = {
          type: (tags[0] || "insight") as ContextBlock["type"],
          title,
          content,
          source: "save",
        };
        addBlocks([block], "save");
      }

      return json({ saved: true, id: pageId, path: pagePath, title, tags, supabase: savedToSupabase });
    }

    case "ingest_folder": {
      const folderPath = args.path as string;
      if (!folderPath) return json({ error: "Missing required parameter: path" });

      const resolvedPath = path.resolve(folderPath);
      if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
        return json({ error: `Not a directory: ${resolvedPath}` });
      }

      const extensions = new Set((args.extensions as string[] | undefined) || [".md", ".txt"]);
      const recursive = (args.recursive as boolean) ?? false;
      const projectId = (args.project_id as string) || null;
      const sourceAgent = "folder_ingest";

      // Collect matching files
      const filePaths: string[] = [];
      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && recursive) {
            walk(full);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.has(ext)) filePaths.push(full);
          }
        }
      }
      walk(resolvedPath);

      if (filePaths.length === 0) {
        return json({ error: `No files matching ${[...extensions].join(", ")} found in ${resolvedPath}` });
      }

      const counts = { new: 0, updated: 0, unchanged: 0, errors: 0 };
      const folderName = path.basename(resolvedPath);

      for (const fp of filePaths) {
        try {
          const content = fs.readFileSync(fp, "utf-8");
          const contentHash = createHash("md5").update(content).digest("hex");
          const wordCount = content.split(/\s+/).filter(Boolean).length;

          // Build path: documents/{folder}/{relative-path}
          const relativePath = path.relative(resolvedPath, fp);
          const pagePath = `documents/${folderName}/${relativePath}`.replace(/\\/g, "/");

          // Check for existing by (user_id, path)
          const { data: existing } = await sb
            .from("pages")
            .select("id, metadata")
            .eq("user_id", userId)
            .eq("path", pagePath)
            .maybeSingle();

          if (existing) {
            const oldHash = (existing.metadata as any)?.content_hash;
            if (oldHash === contentHash) {
              counts.unchanged++;
              continue;
            }
            // Update
            await sb
              .from("pages")
              .update({
                content,
                title: path.basename(fp),
                word_count: wordCount,
                metadata: { source_path: fp, source_filename: path.basename(fp), content_hash: contentHash },
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            counts.updated++;
          } else {
            // Insert
            await sb
              .from("pages")
              .insert({
                user_id: userId,
                path: pagePath,
                title: path.basename(fp),
                content,
                tags: ["document", "imported"],
                source: "agent",
                source_agent: sourceAgent,
                word_count: wordCount,
                metadata: { source_path: fp, source_filename: path.basename(fp), content_hash: contentHash },
                ...(projectId && { project_id: projectId }),
              });
            counts.new++;
          }
        } catch (err: any) {
          console.error(`[ingest_folder] Error processing ${fp}: ${err?.message}`);
          counts.errors++;
        }
      }

      const total = filePaths.length;
      return json({
        processed: total,
        new: counts.new,
        updated: counts.updated,
        unchanged: counts.unchanged,
        errors: counts.errors,
        summary: `Processed ${total} files: ${counts.new} new, ${counts.updated} updated, ${counts.unchanged} unchanged${counts.errors ? `, ${counts.errors} errors` : ""}`,
      });
    }

    case "recall": {
      // ── Route to absorbed handlers based on params ──
      if (args.path) {
        // Absorbed from wiki_read
        return handleTool(sb, userId, "wiki_read", { path: args.path, project_id: args.project_id, shared_project_id: args.shared_project_id });
      }
      if (args.list) {
        // Absorbed from wiki_list
        return handleTool(sb, userId, "wiki_list", { project_id: args.project_id, path_prefix: args.prefix || args.path_prefix });
      }
      if (args.log) {
        // Absorbed from wiki_log
        return handleTool(sb, userId, "wiki_log", { project_id: args.project_id, limit: args.limit });
      }
      if (args.mode === "keyword" && args.query) {
        // Absorbed from wiki_search
        return handleTool(sb, userId, "wiki_search", { query: args.query, project_id: args.project_id, path_prefix: args.path_prefix || args.prefix, limit: args.limit });
      }
      if (args.recent) {
        // Absorbed from get_recent_insights (agent-proxied)
        return handleAgentTool("get_recent_insights", { days: args.days || 7, project_id: args.project_id, limit: args.limit });
      }
      if (args.context) {
        // Absorbed from get_user_context (agent-proxied)
        return handleAgentTool("get_user_context", { topic: args.topic || args.query, project_id: args.project_id, limit: args.limit });
      }
      if (args.observations) {
        // Absorbed from get_observation_feed (agent-proxied)
        return handleAgentTool("get_observation_feed", { project_id: args.project_id, type: args.type, days: args.days, limit: args.limit });
      }
      if (args.themes) {
        // Absorbed from get_theme_insights (agent-proxied)
        return handleAgentTool("get_theme_insights", { project_id: args.project_id, limit: args.limit });
      }

      // ── Default: current recall logic (semantic search) ──
      const search = (args.query || args.search) as string | undefined;
      const tags = args.tags as string[] | undefined;
      const projectId = args.project_id as string | undefined;
      const pathPrefix = args.path_prefix as string | undefined;
      const limit = (args.limit as number) || 20;

      // ONE code path: search `pages` table
      try {
        // Try semantic search first if we have a search query
        if (search) {
          try {
            const { requireApiKey, agentPost } = await import("./agent-proxy.js");
            const agentApiKey = requireApiKey();
            const embedResult = await agentPost(
              "/agent/v1/content/embed",
              { text: search },
              agentApiKey
            );
            if ((embedResult as any)?.embedding) {
              const { data: semanticResults, error: semErr } = await sb.rpc("search_pages", {
                p_user_id: userId,
                p_query_embedding: (embedResult as any).embedding,
                p_match_count: limit,
                p_project_id: projectId || null,
                p_path_prefix: pathPrefix || null,
                p_tags: tags || null,
              });
              if (!semErr && semanticResults && semanticResults.length > 0) {
                // Truncate content
                for (const p of semanticResults) {
                  if (p.content?.length > 500) p.content = p.content.slice(0, 500) + "...";
                }
                return json({
                  pages: semanticResults,
                  count: semanticResults.length,
                  search_mode: "semantic",
                });
              }
            }
          } catch {
            // Semantic search unavailable — fall through to keyword
          }
        }

        // Keyword search fallback
        const searchTerm = search?.slice(0, 200);
        const results: any[] = [];

        if (searchTerm) {
          // Title matches first
          let titleQ = sb
            .from("pages")
            .select("id, path, title, content, tags, project_id, source, updated_at")
            .eq("user_id", userId)
            .ilike("title", `%${searchTerm}%`)
            .order("updated_at", { ascending: false })
            .limit(limit);
          if (projectId) titleQ = titleQ.eq("project_id", projectId);
          if (pathPrefix) titleQ = titleQ.like("path", `${pathPrefix}%`);
          if (tags && tags.length > 0) titleQ = titleQ.overlaps("tags", tags);
          const { data: titleData } = await titleQ;
          const titleIds = new Set((titleData || []).map((p: any) => p.id));
          results.push(...(titleData || []));

          // Content matches
          let contentQ = sb
            .from("pages")
            .select("id, path, title, content, tags, project_id, source, updated_at")
            .eq("user_id", userId)
            .ilike("content", `%${searchTerm}%`)
            .order("updated_at", { ascending: false })
            .limit(limit);
          if (projectId) contentQ = contentQ.eq("project_id", projectId);
          if (pathPrefix) contentQ = contentQ.like("path", `${pathPrefix}%`);
          if (tags && tags.length > 0) contentQ = contentQ.overlaps("tags", tags);
          const { data: contentData } = await contentQ;

          for (const p of contentData || []) {
            if (!titleIds.has(p.id)) results.push(p);
          }
        } else {
          // No search term — return recent pages
          let recentQ = sb
            .from("pages")
            .select("id, path, title, content, tags, project_id, source, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(limit);
          if (projectId) recentQ = recentQ.eq("project_id", projectId);
          if (pathPrefix) recentQ = recentQ.like("path", `${pathPrefix}%`);
          if (tags && tags.length > 0) recentQ = recentQ.overlaps("tags", tags);
          const { data } = await recentQ;
          results.push(...(data || []));
        }

        // Truncate content
        for (const p of results) {
          if (p.content?.length > 500) p.content = p.content.slice(0, 500) + "...";
        }

        return json({
          pages: results.slice(0, limit),
          count: Math.min(results.length, limit),
          search_mode: "keyword",
        });
      } catch {
        // Fallback: local .md index
        const { searchLocalIndex } = await import("./context/md-store.js");
        const results = searchLocalIndex(search, { tags, limit });
        return json({ pages: results, count: results.length, search_mode: "local_md" });
      }
    }

    // ── Knowledge Base Management ──────────────────────────────────
    case "sync_context": {
      try {
        const { data, error } = await sb
          .from("pages")
          .select("id, path, title, content, tags, source, source_agent, project_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        const allPages = data || [];
        const organize = (args.organize as boolean) ?? false;
        const dryRun = (args.dry_run as boolean) ?? false;

        // Rebuild local .md files
        if (!(organize && dryRun)) {
          const { renderAll } = await import("./context/md-store.js");
          renderAll(allPages);
        }

        if (!organize) {
          const { readMeta } = await import("./context/md-store.js");
          const meta = readMeta();
          return json({
            synced: true,
            page_count: allPages.length,
            index_path: "~/.crowdlisten/context/INDEX.md",
            meta,
          });
        }

        // Organize mode — dedup + topic grouping
        const tagGroups: Record<string, { count: number; titles: string[] }> = {};
        for (const p of allPages) {
          for (const tag of (p.tags || [])) {
            if (!tagGroups[tag]) tagGroups[tag] = { count: 0, titles: [] };
            tagGroups[tag].count++;
            if (tagGroups[tag].titles.length < 5) tagGroups[tag].titles.push(p.title);
          }
        }

        const duplicates: Array<{ a: string; b: string; similarity: number; titleA: string; titleB: string }> = [];
        for (let i = 0; i < allPages.length; i++) {
          const wordsA = new Set(allPages[i].title.toLowerCase().split(/\s+/));
          for (let j = i + 1; j < allPages.length; j++) {
            const wordsB = new Set(allPages[j].title.toLowerCase().split(/\s+/));
            const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
            const union = new Set([...wordsA, ...wordsB]);
            const similarity = union.size > 0 ? intersection.size / union.size : 0;
            if (similarity >= 0.7) {
              duplicates.push({
                a: allPages[i].id,
                b: allPages[j].id,
                similarity: Math.round(similarity * 100) / 100,
                titleA: allPages[i].title,
                titleB: allPages[j].title,
              });
            }
          }
        }

        const topicCandidates = Object.entries(tagGroups)
          .filter(([, g]) => g.count >= 3)
          .map(([tag, g]) => ({ tag, count: g.count, sample_titles: g.titles }));

        const hint = topicCandidates.length > 0
          ? `Consider synthesizing topics: ${topicCandidates.map(t => t.tag).join(", ")}. Read entries for each topic, write a synthesis, save it with tag 'synthesis'.`
          : duplicates.length > 0
            ? "Review and merge duplicate entries to keep the knowledge base clean."
            : "Knowledge base looks clean. No action needed.";

        return json({
          synced: !dryRun,
          total_pages: allPages.length,
          tag_groups: tagGroups,
          topic_candidates: topicCandidates,
          duplicates: duplicates.slice(0, 20),
          dry_run: dryRun,
          hint,
        });
      } catch (err: any) {
        return json({ error: `Sync failed: ${err?.message || err}` });
      }
    }

    // Legacy: publish_context
    case "publish_context": {
      const pageId = (args.memory_id || args.page_id) as string;
      const teamId = args.team_id as string;

      if (!pageId || !teamId) {
        return json({ error: "Missing required parameters: page_id (or memory_id), team_id" });
      }

      try {
        const { error } = await sb
          .from("pages")
          .update({
            is_published: true,  // publish flag
          })
          .eq("id", pageId)
          .eq("user_id", userId);

        // Note: publish to team functionality preserved — metadata tracks publish state
        if (error) throw error;

        return json({ published: true, page_id: pageId, team_id: teamId });
      } catch (err: any) {
        return json({ error: `Publish failed: ${err?.message || err}` });
      }
    }

    // ── Spec Delivery ────────────────────────────────────────────────
    case "get_specs": {
      const statusFilter = (args.status as string) || "pending";
      const limit = (args.limit as number) || 20;

      let query = sb
        .from("actionable_specs")
        .select("id, spec_type, title, objective, priority, confidence, status, project_id, created_at")
        .eq("user_id", userId);

      if (args.project_id) query = query.eq("project_id", args.project_id as string);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (args.spec_type) query = query.eq("spec_type", args.spec_type as string);
      if (args.min_confidence != null) query = query.gte("confidence", args.min_confidence as number);
      if (args.priority) query = query.eq("priority", args.priority as string);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return json({ specs: data || [], count: (data || []).length, filters: { status: statusFilter } });
    }

    case "get_spec_detail": {
      const specId = args.spec_id as string;

      const { data, error } = await sb
        .from("actionable_specs")
        .select("*")
        .eq("id", specId)
        .eq("user_id", userId)
        .single();

      if (error || !data) throw new Error(error?.message || "Spec not found or access denied");

      // Format for agent consumption
      const spec = data;
      const markdown = [
        `# ${spec.title}`,
        `**Type:** ${spec.spec_type} | **Priority:** ${spec.priority} | **Confidence:** ${(spec.confidence * 100).toFixed(0)}%`,
        "",
        `## Objective`,
        spec.objective,
        "",
      ];

      if (spec.description) {
        markdown.push("## Description", spec.description, "");
      }

      const evidence = spec.evidence as Array<{ source: string; excerpt: string; confidence: number }>;
      if (evidence && evidence.length > 0) {
        markdown.push("## Evidence");
        for (const e of evidence) {
          markdown.push(`- [${e.source}] "${e.excerpt}" (confidence: ${((e.confidence || 0) * 100).toFixed(0)}%)`);
        }
        markdown.push("");
      }

      const criteria = spec.acceptance_criteria as string[];
      if (criteria && criteria.length > 0) {
        markdown.push("## Acceptance Criteria");
        for (const c of criteria) {
          markdown.push(`- [ ] ${c}`);
        }
        markdown.push("");
      }

      return json({
        spec: data,
        formatted: markdown.join("\n"),
      });
    }

    case "start_spec": {
      const specId = args.spec_id as string;
      const executor = (args.executor as string) || detectExecutor();

      // 1. Fetch the spec
      const { data: spec, error: specErr } = await sb
        .from("actionable_specs")
        .select("*")
        .eq("id", specId)
        .eq("user_id", userId)
        .single();

      if (specErr || !spec) throw new Error(specErr?.message || "Spec not found or access denied");

      if (spec.status !== "pending") {
        return json({ error: `Spec is already ${spec.status}. Only pending specs can be started.` });
      }

      // 2. Create a kanban task from the spec
      const globalBoard = await getOrCreateGlobalBoard(sb, userId);
      const todoCol = await getColumnByStatus(sb, globalBoard.id, "todo");
      if (!todoCol) throw new Error("Could not find 'To Do' column");

      const { data: lastCard } = await sb
        .from("kanban_cards")
        .select("position")
        .eq("column_id", todoCol)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      // Build task description from spec
      const criteria = spec.acceptance_criteria as string[];
      const evidence = spec.evidence as Array<{ source: string; excerpt: string }>;
      const taskDesc = [
        `**Objective:** ${spec.objective}`,
        spec.description ? `\n${spec.description}` : "",
        criteria?.length ? `\n**Acceptance Criteria:**\n${criteria.map((c: string) => `- [ ] ${c}`).join("\n")}` : "",
        evidence?.length ? `\n**Evidence:**\n${evidence.map((e: { source: string; excerpt: string }) => `- [${e.source}] "${e.excerpt}"`).join("\n")}` : "",
        `\n_Generated from spec ${specId} (${spec.spec_type}, ${spec.priority} priority, ${(spec.confidence * 100).toFixed(0)}% confidence)_`,
      ].filter(Boolean).join("\n");

      const labels: unknown[] = [];
      if (spec.project_id) {
        labels.push({ name: `project:${spec.project_id}`, color: "#6366f1" });
      }
      labels.push({ name: `spec:${spec.spec_type}`, color: "#10b981" });
      labels.push({ name: `priority:${spec.priority}`, color: spec.priority === "critical" ? "#ef4444" : spec.priority === "high" ? "#f59e0b" : "#6b7280" });

      const { data: card, error: cardErr } = await sb
        .from("kanban_cards")
        .insert({
          board_id: globalBoard.id,
          column_id: todoCol,
          user_id: userId,
          title: spec.title,
          description: taskDesc,
          priority: spec.priority,
          labels,
          status: "todo",
          position: (lastCard?.position || 0) + 1,
        })
        .select("id")
        .single();

      if (cardErr || !card) throw new Error(cardErr?.message || "Failed to create task from spec");

      // 3. Claim the task (move to In Progress, create workspace + session)
      const inProgressCol = await getColumnByStatus(sb, globalBoard.id, "inprogress");
      if (inProgressCol) {
        await sb.from("kanban_cards")
          .update({ status: "inprogress", column_id: inProgressCol })
          .eq("id", card.id);
      }

      const branch = `spec/${slugify(spec.title)}-${card.id.slice(0, 8)}`;
      const { data: ws } = await sb
        .from("kanban_workspaces")
        .insert({ card_id: card.id, user_id: userId, branch })
        .select("id")
        .single();

      const { data: sess } = await sb
        .from("kanban_sessions")
        .insert({ workspace_id: ws!.id, user_id: userId, executor })
        .select("id")
        .single();

      // 4. Update spec status to claimed
      await sb.from("actionable_specs")
        .update({ status: "claimed" })
        .eq("id", specId);

      return json({
        spec_id: specId,
        task_id: card.id,
        workspace_id: ws!.id,
        session_id: sess?.id,
        branch,
        executor,
        status: "started",
        spec: {
          title: spec.title,
          spec_type: spec.spec_type,
          priority: spec.priority,
          objective: spec.objective,
          acceptance_criteria: spec.acceptance_criteria,
        },
      });
    }

    // ── Preferences ─────────────────────────────────────────────────
    case "set_preferences": {
      const state = loadUserState();
      const changed: string[] = [];

      if (args.telemetry !== undefined) {
        const level = args.telemetry as TelemetryLevel;
        if (!["off", "anonymous", "community"].includes(level)) {
          return json({ error: "Invalid telemetry level. Use: off, anonymous, community" });
        }
        state.preferences.telemetry = level;
        changed.push(`telemetry → ${level}`);

        // Mark telemetry onboarding complete
        if (!state.onboardingCompleted.includes("telemetry")) {
          state.onboardingCompleted.push("telemetry");
        }
      }

      if (args.proactive_suggestions !== undefined) {
        state.preferences.proactiveSuggestions = !!args.proactive_suggestions;
        changed.push(`proactive_suggestions → ${state.preferences.proactiveSuggestions}`);

        if (!state.onboardingCompleted.includes("proactive")) {
          state.onboardingCompleted.push("proactive");
        }
      }

      if (args.cross_project_learnings !== undefined) {
        state.preferences.crossProjectLearnings = !!args.cross_project_learnings;
        changed.push(`cross_project_learnings → ${state.preferences.crossProjectLearnings}`);

        if (!state.onboardingCompleted.includes("learnings")) {
          state.onboardingCompleted.push("learnings");
        }
      }

      if (changed.length === 0) {
        return json({ message: "No preferences changed. Pass telemetry, proactive_suggestions, or cross_project_learnings." });
      }

      saveUserState(state);
      return json({
        updated: changed,
        preferences: {
          telemetry: state.preferences.telemetry,
          proactiveSuggestions: state.preferences.proactiveSuggestions,
          crossProjectLearnings: state.preferences.crossProjectLearnings,
        },
      });
    }

    // log_learning, search_learnings → removed (consolidated into save/recall)

    // ── Wiki Tools (unified `pages` table) ──────────────────────────────────
    case "wiki_list": {
      const projectId = args.project_id as string | undefined;
      const pathPrefix = args.path_prefix as string | undefined;
      const category = args.category as string | undefined;

      try {
        const { requireApiKey, agentGet } = await import("./agent-proxy.js");
        const agentApiKey = requireApiKey();
        const params = new URLSearchParams();
        if (projectId) params.set("project_id", projectId);
        if (pathPrefix) params.set("prefix", pathPrefix);
        if (category) params.set("category", category);
        const result = await agentGet(`/agent/v1/wiki/pages?${params}`, agentApiKey);
        return json(result);
      } catch (err: any) {
        // Fallback to direct Supabase if agent unavailable
        let query = sb
          .from("pages")
          .select("id, path, title, tags, word_count, is_auto, updated_at, content")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });
        if (projectId) query = query.eq("project_id", projectId);
        if (pathPrefix) query = query.like("path", `${pathPrefix}%`);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const pages = (data || []).map((p: any) => ({
          ...p,
          content: p.content?.length > 200 ? p.content.slice(0, 200) + "..." : p.content,
        }));
        return json({ pages, count: pages.length });
      }
    }

    case "wiki_read": {
      const pagePath = args.path as string;
      const projectId = args.project_id as string | undefined;
      const sharedProjectId = args.shared_project_id as string | undefined;

      try {
        const { requireApiKey, agentGet } = await import("./agent-proxy.js");
        const agentApiKey = requireApiKey();
        const params = new URLSearchParams();
        if (projectId) params.set("project_id", projectId);
        if (sharedProjectId) params.set("shared_project_id", sharedProjectId);
        const result = await agentGet(`/agent/v1/wiki/pages/${encodeURIComponent(pagePath)}?${params}`, agentApiKey);
        return json({ page: result });
      } catch (err: any) {
        // Fallback to direct Supabase if agent unavailable
        if (sharedProjectId) {
          const { data: proj } = await sb.from("projects").select("id, is_public").eq("id", sharedProjectId).maybeSingle();
          if (!proj?.is_public) throw new Error("Project not found or not public");
          const { data: sharedPage } = await sb.from("pages").select("*").eq("project_id", sharedProjectId).eq("path", pagePath).maybeSingle();
          if (!sharedPage) throw new Error(`Page not found in shared project: ${pagePath}`);
          return json({ page: sharedPage });
        }
        let { data, error } = await sb.from("pages").select("*").eq("user_id", userId).eq("path", pagePath).maybeSingle();
        if (!data && projectId) {
          let projectSlug = projectId.slice(0, 8);
          try { const { data: proj } = await sb.from("projects").select("name").eq("id", projectId).single(); if (proj?.name) projectSlug = slugify(proj.name); } catch { /* use id prefix */ }
          const result = await sb.from("pages").select("*").eq("user_id", userId).eq("path", `projects/${projectSlug}/${pagePath}`).maybeSingle();
          data = result.data; error = result.error;
        }
        if (error || !data) throw new Error(`Page not found: ${pagePath}`);
        return json({ page: data });
      }
    }

    case "wiki_write": {
      const pagePath = args.path as string;
      const title = args.title as string;
      const content = args.content as string;
      const projectId = args.project_id as string | undefined;
      const writeTags = (args.tags as string[]) || [];
      const mode = (args.mode as string) || "replace";

      try {
        const { requireApiKey, agentPost } = await import("./agent-proxy.js");
        const agentApiKey = requireApiKey();
        const result = await agentPost("/agent/v1/wiki/pages", {
          project_id: projectId,
          path: pagePath,
          title,
          content,
          tags: writeTags.length > 0 ? writeTags : undefined,
          append: mode === "append",
        }, agentApiKey);
        return json(result);
      } catch (err: any) {
        // Fallback to direct Supabase if agent unavailable
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const { data: existing } = await sb.from("pages").select("id, content").eq("user_id", userId).eq("path", pagePath).maybeSingle();
        if (existing) {
          const newContent = mode === "append" ? existing.content + "\n\n" + content : content;
          const newWordCount = newContent.split(/\s+/).filter(Boolean).length;
          const { error } = await sb.from("pages").update({ title, content: newContent, tags: writeTags.length > 0 ? writeTags : undefined, project_id: projectId || undefined, word_count: newWordCount, updated_at: new Date().toISOString() }).eq("id", existing.id);
          if (error) throw new Error(error.message);
          return json({ action: "updated", path: pagePath, mode, word_count: newWordCount });
        } else {
          const { error } = await sb.from("pages").insert({ user_id: userId, path: pagePath, title, content, tags: writeTags, project_id: projectId || null, word_count: wordCount, is_auto: false });
          if (error) throw new Error(error.message);
          return json({ action: "created", path: pagePath, word_count: wordCount });
        }
      }
    }

    case "wiki_search": {
      const query = args.query as string;
      const projectId = args.project_id as string | undefined;
      const limit = (args.limit as number) || 10;

      try {
        const { requireApiKey, agentGet } = await import("./agent-proxy.js");
        const agentApiKey = requireApiKey();
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (projectId) params.set("project_id", projectId);
        const result = await agentGet(`/agent/v1/wiki/keyword-search?${params}`, agentApiKey);
        return json(result);
      } catch (err: any) {
        // Fallback to direct Supabase if agent unavailable
        const searchTerm = query.slice(0, 200);
        let titleQ = sb.from("pages").select("id, path, title, tags, content, word_count, updated_at").eq("user_id", userId).ilike("title", `%${searchTerm}%`).order("updated_at", { ascending: false }).limit(limit);
        if (projectId) titleQ = titleQ.eq("project_id", projectId);
        const { data: titleData } = await titleQ;
        const titleIds = new Set((titleData || []).map((p: any) => p.id));
        let contentQ = sb.from("pages").select("id, path, title, tags, content, word_count, updated_at").eq("user_id", userId).ilike("content", `%${searchTerm}%`).order("updated_at", { ascending: false }).limit(limit);
        if (projectId) contentQ = contentQ.eq("project_id", projectId);
        const { data: contentData } = await contentQ;
        const pages: any[] = [...(titleData || [])];
        for (const p of contentData || []) { if (!titleIds.has(p.id)) pages.push(p); }
        for (const p of pages) { if (p.content?.length > 300) p.content = p.content.slice(0, 300) + "..."; }
        return json({ pages: pages.slice(0, limit), total: pages.length });
      }
    }

    case "wiki_ingest": {
      const projectId = args.project_id as string;
      const analysisId = args.analysis_id as string;

      // Delegate to agent endpoint
      try {
        const { requireApiKey, agentPost } = await import("./agent-proxy.js");
        const agentApiKey = requireApiKey();
        const result = await agentPost(
          "/agent/v1/wiki/ingest",
          { project_id: projectId, analysis_id: analysisId },
          agentApiKey
        );
        return json(result);
      } catch (err: any) {
        return json({ error: `Wiki ingest failed: ${err?.message || err}` });
      }
    }

    case "wiki_log": {
      const projectId = args.project_id as string;
      const limit = (args.limit as number) || 20;

      // Resolve project slug for log path
      let projectSlug = projectId.slice(0, 8);
      try {
        const { data: proj } = await sb.from("projects").select("name").eq("id", projectId).single();
        if (proj?.name) projectSlug = slugify(proj.name);
      } catch { /* use id prefix */ }

      const logPath = `projects/${projectSlug}/log`;

      // Read the log page
      const { data, error } = await sb
        .from("pages")
        .select("content, updated_at")
        .eq("user_id", userId)
        .eq("path", logPath)
        .maybeSingle();

      if (error || !data) {
        return json({ entries: [], message: "No log page found for this project." });
      }

      // Parse log entries
      const lines = data.content.split("\n");
      const entries: string[] = [];
      let current = "";

      for (const line of lines) {
        if ((line.startsWith("## ") || line.startsWith("- ")) && current) {
          entries.push(current.trim());
          current = line;
        } else {
          current += (current ? "\n" : "") + line;
        }
      }
      if (current.trim()) entries.push(current.trim());

      return json({
        entries: entries.slice(0, limit),
        total: entries.length,
        updated_at: data.updated_at,
      });
    }

    case "crowd_research": {
      // Enrich with page context when available, then delegate
      if (!args.context) {
        try {
          const searchTerm = (args.query as string)?.slice(0, 200);
          if (searchTerm) {
            const { data: contextPages } = await sb
              .from("pages")
              .select("path, title, content")
              .eq("user_id", userId)
              .ilike("content", `%${searchTerm}%`)
              .order("updated_at", { ascending: false })
              .limit(5);

            if (contextPages && contextPages.length > 0) {
              args.context = contextPages
                .map((p: any) => `[${p.path}] ${p.title}\n${p.content?.slice(0, 500)}`)
                .join("\n---\n");
            }
          }
        } catch {
          // Graceful degradation
        }
      }
      return handleAgentTool(name, args);
    }

    case "setup_connector": {
      try {
        const { requireApiKey, agentPost: agPost } = await import("./agent-proxy.js");
        const apiKey = requireApiKey();
        const result = await agPost(
          "/api/connectors",
          {
            name: args.name,
            project_id: args.project_id,
            connector_type: args.connector_type || "agent",
            platform: args.platform,
          },
          apiKey
        );
        const res = result as any;
        return json({
          id: res.id,
          name: res.name,
          api_key: res.api_key,
          connector_type: res.connector_type,
          platform: res.platform,
          project_id: res.project_id,
          _setup_hint: `Use this API key with submit_observation to send observations. The key is shown once — save it now.`,
        });
      } catch (err: any) {
        return json({ error: `Failed to create connector: ${err?.message || err}` });
      }
    }

    default: {
      // Delegate to agent-proxied tools
      if (isAgentTool(name)) {
        return handleAgentTool(name, args);
      }
      throw new Error(`Unknown tool: ${name}`);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function json(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function detectExecutor(): string {
  if (process.env.OPENCLAW_SESSION || process.env.OPENCLAW_AGENT)
    return "OPENCLAW";
  if (process.env.CLAUDE_CODE === "1" || process.env.CLAUDE_SESSION_ID)
    return "CLAUDE_CODE";
  if (process.env.CURSOR_SESSION_ID || process.env.CURSOR_TRACE_ID)
    return "CURSOR";
  if (process.env.CODEX_SESSION_ID) return "CODEX";
  if (process.env.GEMINI_CLI) return "GEMINI";
  if (process.env.AMP_SESSION_ID) return "AMP";
  try {
    const ppid = process.ppid;
    if (ppid) {
      // Best effort
    }
  } catch {
    // ignore
  }
  return "UNKNOWN";
}

export async function logToSession(
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
    const { data: sess } = await sb
      .from("kanban_sessions")
      .select("id, workspace_id")
      .eq("id", sessionId)
      .single();
    if (!sess) return;
    sessId = sess.id;
    wsId = sess.workspace_id;
  } else {
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

  await sb.from("kanban_execution_process_logs").insert({
    execution_process_id: proc.id,
    log_type: "stdout",
    output: message,
    byte_size: Buffer.byteLength(message, "utf-8"),
  });

  if (complete) {
    await sb.from("kanban_coding_agent_turns").insert({
      execution_process_id: proc.id,
      summary: message,
      seen: false,
    });

    await sb
      .from("kanban_workspaces")
      .update({ archived: true })
      .eq("id", wsId);
  }
}

// ─── Project Context Builder ─────────────────────────────────────────────────

/**
 * Build a project context markdown document from Supabase data.
 * No LLM call — pure data assembly with ~8K char cap.
 */
export async function buildProjectContextMd(
  sb: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data: project } = await sb
    .from("projects")
    .select("name, description")
    .eq("id", projectId)
    .single();

  if (!project) return null;

  const sections: string[] = [`# Project Context: ${project.name}\n`];

  if (project.description) {
    sections.push(`## Overview\n${project.description}\n`);
  }

  // PRD (most recent)
  const { data: prd } = await sb
    .from("project_documents")
    .select("content")
    .eq("project_id", projectId)
    .eq("doc_type", "prd")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (prd?.content) {
    const prdText = tiptapToText(prd.content);
    if (prdText) {
      const truncated = prdText.length > 4000 ? prdText.slice(0, 4000) + "\n...(truncated)" : prdText;
      sections.push(`## PRD\n${truncated}\n`);
    }
  }

  // Analyses
  const { data: analyses } = await sb
    .from("analyses")
    .select("question, takeaway, sentiment, themes")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (analyses && analyses.length > 0) {
    const parts = [`## Research Analyses (${analyses.length})\n`];
    for (const a of analyses) {
      let entry = `### ${a.question || "Untitled"}\n`;
      if (a.takeaway) entry += `${a.takeaway}\n`;
      const meta: string[] = [];
      if (a.sentiment) {
        const s = a.sentiment as Record<string, number>;
        const sp = Object.entries(s)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}%`);
        if (sp.length) meta.push(`Sentiment: ${sp.join(", ")}`);
      }
      if (a.themes && Array.isArray(a.themes)) {
        const names = a.themes
          .slice(0, 5)
          .map((t: unknown) => (typeof t === "object" && t !== null && "name" in t ? (t as Record<string, string>).name : String(t)));
        if (names.length) meta.push(`Themes: ${names.join(", ")}`);
      }
      if (meta.length) entry += meta.join(" | ") + "\n";
      parts.push(entry);
    }
    sections.push(parts.join("\n"));
  }

  // Documents
  const { data: docs } = await sb
    .from("project_documents")
    .select("title, doc_type, content")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (docs && docs.length > 0) {
    const parts = [`## Documents (${docs.length})\n`];
    for (const d of docs) {
      const text = d.content ? tiptapToText(d.content) : "";
      const preview = text.length > 500 ? text.slice(0, 500) + "..." : text;
      parts.push(`### ${d.title || "Untitled"} (${d.doc_type || "unknown"})\n${preview}\n`);
    }
    sections.push(parts.join("\n"));
  }

  // Insights
  const { data: insights } = await sb
    .from("project_insights")
    .select("title, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (insights && insights.length > 0) {
    const parts = [`## Insights (${insights.length})\n`];
    for (const i of insights) {
      parts.push(`- **${i.title || "Untitled"}**: ${i.content || ""}\n`);
    }
    sections.push(parts.join("\n"));
  }

  // Planning context (decisions, patterns, principles, learnings)
  try {
    const { data: contextEntries } = await sb
      .from("planning_context")
      .select("type, title, body, confidence")
      .eq("project_id", projectId)
      .in("status", ["active", "approved"])
      .in("type", ["decision", "constraint", "preference", "pattern", "learning", "principle"])
      .order("updated_at", { ascending: false })
      .limit(15);

    if (contextEntries && contextEntries.length > 0) {
      const parts = [`## Knowledge Base (${contextEntries.length})\n`];
      for (const e of contextEntries) {
        const conf = (e.confidence as number) < 1 ? ` (confidence: ${e.confidence})` : "";
        const preview = (e.body as string).length > 200 ? (e.body as string).slice(0, 200) + "..." : e.body;
        parts.push(`- **[${e.type}] ${e.title}**${conf}: ${preview}\n`);
      }
      sections.push(parts.join("\n"));
    }
  } catch {
    // Non-blocking — planning_context table may not exist yet
  }

  let result = sections.join("\n");
  if (result.length > 8000) {
    result = result.slice(0, 7950) + "\n\n...(truncated for length)";
  }

  return result;
}

/**
 * Simple Tiptap JSON to plain text converter.
 */
function tiptapToText(content: unknown): string {
  if (!content || typeof content !== "object") return "";

  function extract(node: unknown): string {
    if (typeof node === "string") return node;
    if (!node || typeof node !== "object") return "";

    const n = node as Record<string, unknown>;
    const type = n.type as string | undefined;
    const children = (n.content as unknown[]) || [];

    if (type === "text") return (n.text as string) || "";
    if (type === "heading") {
      const level = ((n.attrs as Record<string, number>)?.level) || 1;
      return "\n" + "#".repeat(level) + " " + children.map(extract).join("") + "\n";
    }
    if (type === "paragraph") return children.map(extract).join("") + "\n";
    if (type === "bulletList" || type === "orderedList") {
      return children
        .map((item, i) => {
          const prefix = type === "bulletList" ? "- " : `${i + 1}. `;
          const inner = ((item as Record<string, unknown>).content as unknown[] || []).map(extract).join("").trim();
          return prefix + inner;
        })
        .join("\n") + "\n";
    }

    return children.map(extract).join("");
  }

  return extract(content).trim();
}
