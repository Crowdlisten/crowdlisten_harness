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
  args: ["-y", "@crowdlisten/harness"],
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
      name: "OpenClaw",
      configPath: path.join(home, ".openclaw", "openclaw.json"),
      mcpKey: "mcpServers",
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
  {
    name: "get_or_create_global_board",
    description: "[Setup] Get (or create) your single global task board. Call once at start of session if you need the board_id. All tasks go here by default.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_projects",
    description: "[Setup] List all projects you have access to. Use to find project_id for scoping tasks and context.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_boards",
    description: "[Setup] List task boards for a project. Most users have one global board — use get_or_create_global_board instead.",
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
    description: "[Setup] Create a new task board for a project with default columns (To Do, In Progress, In Review, Done, Cancelled). Rarely needed — get_or_create_global_board handles this automatically.",
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
      "List tasks on the board. Call this first to see what work is available. Uses global board by default. Filter by status: todo, inprogress, inreview, done, cancelled.",
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
    description: "Get full details of a task including description, status, priority, and labels.",
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
  {
    name: "update_task",
    description: "Update a task's title, description, status, or priority. Pass only the fields you want to change.",
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
      "Claim a task to start working on it. Call this after list_tasks to begin. Moves task to In Progress, creates workspace + session. Returns context (semantic map, knowledge base, existing plan) and branch name. Call query_context next to check existing decisions.",
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
    description: "Mark task done. Call record_learning before this to capture what you learned. Optionally attach a summary of what was accomplished. Auto-completes the plan if one exists.",
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
      "Log a progress note to the task's execution session. Call periodically during execution to track what you're doing. Useful for handoff between agents.",
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
    description: "Permanently delete a task. Cannot be undone.",
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
    description: "[Setup] Migrate all tasks from all boards to the global board. Run once to consolidate if you have tasks spread across multiple boards.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "start_session",
    description:
      "[Advanced] Start a new parallel agent session for a task. Use when multiple agents need to work on different aspects of the same task simultaneously. claim_task already creates one session.",
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
      "[Advanced] List all agent sessions for a task, showing status and what each is working on. Useful for coordinating parallel agents.",
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
      "[Advanced] Update a session's status or focus. Use to mark running/completed/stopped when coordinating parallel agents.",
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

  // ── Planning & Context Tools ─────────────────────────────────────────────

  {
    name: "create_plan",
    description:
      "Create an execution plan for a task. Call after claim_task and query_context. Plans go through draft → review → approved → executing → completed lifecycle. Submit for human review with update_plan(status='review').",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
        approach: { type: "string", description: "How you plan to execute this task" },
        assumptions: {
          type: "array",
          items: { type: "string" },
          description: "Assumptions the plan relies on",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "Known constraints to work within",
        },
        success_criteria: {
          type: "array",
          items: { type: "string" },
          description: "How to know the task is done correctly",
        },
        risks: {
          type: "array",
          items: { type: "string" },
          description: "Potential risks or blockers",
        },
        estimated_steps: { type: "number", description: "Estimated number of steps" },
      },
      required: ["task_id", "approach"],
    },
  },
  {
    name: "get_plan",
    description: "Get the current plan for a task including version history and any pending human feedback. Check this after human review to see feedback.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: { type: "string", description: "Card/task UUID" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "update_plan",
    description:
      "Iterate on a plan: update approach, change status, or add human feedback. Set status='review' to submit for review, status='executing' after approval. Content changes archive the current version. Setting feedback auto-reverts status to draft for revision.",
    inputSchema: {
      type: "object" as const,
      properties: {
        plan_id: { type: "string", description: "Plan UUID (from create_plan or get_plan)" },
        approach: { type: "string", description: "Updated approach" },
        status: {
          type: "string",
          description: "draft, review, approved, executing, completed",
        },
        feedback: { type: "string", description: "Human feedback — auto-reverts plan to draft" },
        assumptions: { type: "array", items: { type: "string" } },
        constraints: { type: "array", items: { type: "string" } },
        success_criteria: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
      },
      required: ["plan_id"],
    },
  },
  // query_context, add_context, record_learning → consolidated into save/recall
  // ─── Context Extraction Tools ──────────────────────────────────────────────
  {
    name: "process_transcript",
    description:
      "[Context] Process text through the context extraction pipeline: PII redaction → LLM extraction → skill matching. Returns extracted context blocks and recommended skills. Requires LLM provider to be configured (run setup-context).",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description:
            "The transcript/chat text to process. PII will be redacted before LLM sees it.",
        },
        source: {
          type: "string",
          description: "Label for the source (e.g. 'slack-export', 'chat-history'). Defaults to 'mcp'.",
        },
        is_chat: {
          type: "boolean",
          description:
            "Whether the text is chat history (uses 4-type extraction: style/insight/pattern/preference). Default true.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_context_blocks",
    description:
      "[Context] Retrieve locally-stored context blocks from previous extractions. Blocks are stored in ~/.crowdlisten/context.json.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "recommend_skills",
    description:
      "[Context] Get CrowdListen skill recommendations based on stored context blocks. Matches block content against the skill catalog using keyword overlap scoring.",
    inputSchema: { type: "object" as const, properties: {} },
  },

  // ─── Skill Discovery Tools ──────────────────────────────────────────────
  {
    name: "discover_skills",
    description:
      "[Context] Context-driven skill discovery — scores all skills (native CrowdListen + 146 community skills from 4 repos) against your extracted context blocks. Returns ranked skills with install instructions. Optionally process new context text first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        context: {
          type: "string",
          description:
            "Optional: raw context text to process through extraction pipeline first. If omitted, uses stored blocks.",
        },
        category: {
          type: "string",
          description:
            "Filter by category: development, data, content, research, automation, design, business, productivity",
        },
        tier: {
          type: "string",
          description: "Filter by tier: crowdlisten (native, need API key) or community (open source)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
    },
  },
  {
    name: "search_skills",
    description:
      "[Context] Text search across all 154 skills (8 native + 146 community). Browse by category or search by name/keyword. Returns matching skills with descriptions and install methods.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (name, keyword, or description text)" },
        tier: { type: "string", description: "Filter: crowdlisten or community" },
        category: {
          type: "string",
          description: "Filter: development, data, content, research, automation, design, business, productivity",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "install_skill",
    description:
      "[Context] Install a skill by ID — copies SKILL.md content to .claude/commands/ for 'copy' type skills, or returns npx/git instructions for other install methods.",
    inputSchema: {
      type: "object" as const,
      properties: {
        skill_id: { type: "string", description: "Skill ID (e.g., 'comm-typescript-expert' or 'competitive-analysis')" },
        target_dir: {
          type: "string",
          description: "Target directory for SKILL.md (default: .claude/commands/)",
        },
      },
      required: ["skill_id"],
    },
  },

  // ─── Core Always-On Tools (Skill Pack Discovery + Memory) ────────────────
  {
    name: "list_skill_packs",
    description:
      "List all available skill packs with status (active/available). Skill packs group related tools — activate a pack to unlock its tools. Start here to see what capabilities are available.",
    inputSchema: {
      type: "object" as const,
      properties: {
        include_virtual: {
          type: "boolean",
          description: "Include SKILL.md workflow packs (default true)",
        },
      },
    },
  },
  {
    name: "activate_skill_pack",
    description:
      "Activate a skill pack to unlock its tools. After activation, the new tools appear in tools/list. For SKILL.md packs, returns the full workflow instructions. Call list_skill_packs first to see available packs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        pack_id: {
          type: "string",
          description: "Pack ID to activate (e.g., 'planning', 'social-listening', 'competitive-analysis')",
        },
      },
      required: ["pack_id"],
    },
  },
  {
    name: "save",
    description:
      "Save context that persists across sessions. Use tags to categorize (e.g. 'decision', 'pattern', 'preference'). Embedding is auto-generated for semantic recall.",
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
      },
      required: ["title", "content"],
    },
  },
  {
    name: "recall",
    description:
      "Search saved memories using semantic similarity. Returns most relevant results ranked by meaning, not just keywords.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Natural language search query",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        project_id: {
          type: "string",
          description: "Filter by project",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
    },
  },
  // ── Spec Delivery ─────────────────────────────────────────────────
  {
    name: "get_specs",
    description:
      "[Specs] List actionable specs generated from crowd feedback analysis. " +
      "These are agent-consumable implementation specs with evidence, acceptance criteria, and priority. " +
      "Filter by status (pending/claimed/in_progress/completed), type, priority, or minimum confidence.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: {
          type: "string",
          description: "Filter by project UUID",
        },
        status: {
          type: "string",
          enum: ["pending", "claimed", "in_progress", "completed", "rejected"],
          description: "Filter by lifecycle status (default: pending)",
        },
        spec_type: {
          type: "string",
          enum: ["feature", "bug_fix", "improvement", "investigation"],
          description: "Filter by spec type",
        },
        min_confidence: {
          type: "number",
          description: "Minimum confidence threshold (0.0-1.0)",
        },
        priority: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Filter by priority level",
        },
        limit: {
          type: "number",
          description: "Max results (default 20)",
        },
      },
    },
  },
  {
    name: "get_spec_detail",
    description:
      "[Specs] Get full spec details including evidence citations, acceptance criteria, " +
      "and implementation context. Read this before starting implementation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: {
          type: "string",
          description: "Spec UUID to retrieve",
        },
      },
      required: ["spec_id"],
    },
  },
  {
    name: "start_spec",
    description:
      "[Specs] Claim an actionable spec and begin implementation. " +
      "Creates a kanban task from the spec, claims it (moves to In Progress), " +
      "and returns workspace context for the coding agent. " +
      "Composes create_task → claim_task internally.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: {
          type: "string",
          description: "Spec UUID to start working on",
        },
        executor: {
          type: "string",
          description: "Coding agent type (auto-detected if omitted)",
        },
      },
      required: ["spec_id"],
    },
  },
  // ── Preferences ─────────────────────────────────────────────────
  {
    name: "set_preferences",
    description:
      "Set user preferences for telemetry, proactive suggestions, and cross-project learnings. " +
      "Telemetry levels: off (no tracking), anonymous (local-only stats), community (anonymous aggregate stats). " +
      "Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        telemetry: {
          type: "string",
          enum: ["off", "anonymous", "community"],
          description: "Telemetry privacy level",
        },
        proactive_suggestions: {
          type: "boolean",
          description: "Enable/disable proactive skill pack suggestions",
        },
        cross_project_learnings: {
          type: "boolean",
          description: "Enable/disable cross-project learning persistence",
        },
      },
    },
  },
  // log_learning, search_learnings → consolidated into save/recall
  ...AGENT_TOOLS,
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
    case "discover_skills": {
      let blocks = getBlocks();

      // If context text provided, process it first
      if (args.context) {
        const result = await runPipeline({
          text: args.context as string,
          source: "discover",
          isChat: true,
        });
        blocks = result.blocks;
      }

      if (blocks.length === 0) {
        return json({
          error: "No context blocks found. Process a transcript first with process_transcript, or provide context text.",
          skills: [],
        });
      }

      const skills = await discoverSkills(blocks, {
        category: args.category as any,
        tier: args.tier as any,
        limit: (args.limit as number) || 10,
      });

      return json({
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

    case "search_skills": {
      const query = args.query as string;
      if (!query) return json({ error: "Missing 'query' parameter" });

      const results = searchSkills(query, {
        tier: args.tier as any,
        category: args.category as any,
      });

      return json({
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
            instructions: `This is a native CrowdListen skill. It requires a CROWDLISTEN_API_KEY.`,
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
    case "list_skill_packs": {
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
        hint: "Call activate_skill_pack with a pack_id to unlock its tools.",
      });
    }

    case "activate_skill_pack": {
      const packId = args.pack_id as string;
      if (!packId) return json({ error: "Missing 'pack_id' parameter" });
      if (!hasPack(packId)) return json({ error: `Pack '${packId}' not found. Use list_skill_packs to see available packs.` });

      const pack = getPack(packId)!;

      // Virtual SKILL.md packs — return content instead of activating tools
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

      // Regular tool pack — activate and signal tools/list_changed
      const state = activatePack(packId);
      const tools = getPackTools(packId).map(t => t.name);

      // Note: server.sendToolListChanged() is called by the index.ts dispatcher
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

    case "save": {
      const title = args.title as string;
      const content = args.content as string;

      if (!title || !content) {
        return json({ error: "Missing required parameters: title, content" });
      }

      const tags = (args.tags as string[]) || [];
      const projectId = (args.project_id as string) || null;
      const taskId = (args.task_id as string) || null;
      const confidence = (args.confidence as number) ?? 1.0;
      const sourceAgent = detectExecutor();

      // Primary: write to Supabase memories table
      let savedToSupabase = false;
      let memoryId: string | null = null;
      try {
        const { data: row, error: sbErr } = await sb
          .from("memories")
          .insert({
            user_id: userId,
            project_id: projectId,
            task_id: taskId,
            title,
            content,
            tags,
            source: "agent",
            source_agent: sourceAgent,
            confidence,
          })
          .select("id")
          .single();
        if (sbErr) throw sbErr;
        savedToSupabase = true;
        memoryId = row!.id;

        // Fire-and-forget: generate embedding via agent backend
        const AGENT_BASE = process.env.CROWDLISTEN_AGENT_URL || "https://agent.crowdlisten.com";
        fetch(`${AGENT_BASE}/agent/v1/content/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `${title}\n${content}` }),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.embedding && memoryId) {
              sb.from("memories")
                .update({ embedding: data.embedding })
                .eq("id", memoryId)
                .then(() => {});
            }
          })
          .catch(() => {
            // Non-blocking — row exists without embedding, keyword fallback on recall
          });

        // Side effect: dual-write to project_insights for frontend visibility
        const knowledgeTags = ["decision", "pattern", "preference", "learning", "principle"];
        if (projectId && tags.some(t => knowledgeTags.includes(t))) {
          try {
            await sb.from("project_insights").insert({
              project_id: projectId,
              user_id: userId,
              title,
              content,
              source: "mcp_save",
              source_agent: sourceAgent,
              category: tags.find(t => knowledgeTags.includes(t)) || "insight",
            });
          } catch {
            // Non-blocking
          }
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

      return json({ saved: true, id: memoryId, title, tags, supabase: savedToSupabase });
    }

    case "recall": {
      const search = args.search as string | undefined;
      const tags = args.tags as string[] | undefined;
      const projectId = args.project_id as string | undefined;
      const limit = (args.limit as number) || 20;

      try {
        // Try semantic search first via agent embedding endpoint
        const AGENT_BASE = process.env.CROWDLISTEN_AGENT_URL || "https://agent.crowdlisten.com";
        let usedSemantic = false;

        if (search) {
          try {
            const embedRes = await fetch(`${AGENT_BASE}/agent/v1/content/embed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: search }),
            });

            if (embedRes.ok) {
              const embedData = await embedRes.json() as { embedding?: number[] };
              if (embedData.embedding) {
                // Use RPC for semantic search
                const rpcArgs: Record<string, unknown> = {
                  p_user_id: userId,
                  p_query_embedding: embedData.embedding,
                  p_match_count: limit,
                };
                if (projectId) rpcArgs.p_project_id = projectId;
                if (tags && tags.length > 0) rpcArgs.p_tags = tags;

                const { data, error: rpcErr } = await sb.rpc("search_memories", rpcArgs);
                if (!rpcErr && data && (data as unknown[]).length > 0) {
                  usedSemantic = true;
                  return json({
                    memories: data,
                    count: (data as unknown[]).length,
                    search_mode: "semantic",
                  });
                }
              }
            }
          } catch {
            // Embedding API unavailable — fall through to keyword search
          }
        }

        // Keyword fallback: ILIKE on title/content
        if (!usedSemantic) {
          let query = sb
            .from("memories")
            .select("id, title, content, tags, source, source_agent, task_id, project_id, confidence, metadata, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (projectId) query = query.eq("project_id", projectId);
          if (tags && tags.length > 0) query = query.overlaps("tags", tags);
          if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

          const { data, error: sbErr } = await query;
          if (sbErr) throw sbErr;

          return json({
            memories: data || [],
            count: (data || []).length,
            search_mode: "keyword",
          });
        }
      } catch {
        // Fallback to local store
        let blocks = getBlocks();
        if (search) {
          const lower = search.toLowerCase();
          blocks = blocks.filter(
            b =>
              b.title.toLowerCase().includes(lower) ||
              b.content.toLowerCase().includes(lower)
          );
        }
        blocks = blocks.slice(-limit);
        return json({
          memories: blocks,
          count: blocks.length,
          search_mode: "local",
        });
      }

      // Should not reach here, but return empty just in case
      return json({ memories: [], count: 0, search_mode: "none" });
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
