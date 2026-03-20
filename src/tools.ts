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
  args: ["-y", "@crowdlisten/kanban"],
};

export interface AgentConfig {
  name: string;
  configPath: string;
  mcpKey: string;
  wrapperKey?: string;
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

export async function autoInstallMcp(): Promise<string[]> {
  const installed: string[] = [];

  for (const agent of getAgentConfigs()) {
    try {
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

      if (servers.crowdlisten_tasks) continue;

      servers.crowdlisten_tasks = { ...MCP_ENTRY };
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

export async function handleTool(
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
      const slim = (data || []).map((p: Record<string, unknown>) => ({ id: p.id, name: p.name }));
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

      // Fetch project context if this board belongs to a project
      let projectContext: string | null = null;
      try {
        const { data: board } = await sb
          .from("kanban_boards")
          .select("project_id")
          .eq("id", card.board_id)
          .single();

        if (board?.project_id) {
          projectContext = await buildProjectContextMd(sb, board.project_id);
        }
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

    default:
      throw new Error(`Unknown tool: ${name}`);
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
    .from("content_insights")
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
