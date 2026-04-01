/**
 * Skill Pack Registry — Progressive Disclosure
 *
 * Groups tools into logical skill packs following the GitHub MCP Server pattern.
 * Start with ~4 discovery tools, activate packs on demand, fire tools/list_changed.
 *
 * Pattern: 85-98% token savings vs static tool lists.
 */

import * as fs from "fs";
import * as path from "path";
import { INSIGHTS_TOOLS } from "../insights/index.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkillPack {
  id: string;
  name: string;
  description: string;
  toolNames: string[];
  isVirtual?: boolean;       // true for SKILL.md packs (no tools, just content)
  skillMdPath?: string;      // path to SKILL.md for virtual packs
}

export interface SkillPackInfo {
  id: string;
  name: string;
  description: string;
  toolCount: number;
  status: "active" | "available";
  isVirtual: boolean;
}

// ─── Tool Definitions (imported from other modules) ─────────────────────────

// We store tools in a flat map for lookup
const toolMap = new Map<string, any>();

/**
 * Register a tool definition. Called during server init.
 */
export function registerTool(tool: any): void {
  toolMap.set(tool.name, tool);
}

/**
 * Register an array of tool definitions.
 */
export function registerTools(tools: any[]): void {
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }
}

// ─── Pack Definitions ──────────────────────────────────────────────────────

const packs: Map<string, SkillPack> = new Map();

/**
 * Built-in skill packs grouping tools into logical units.
 */
export function initializeRegistry(skillsDir: string): void {
  // Core — always on (4 tools)
  packs.set("core", {
    id: "core",
    name: "Core",
    description: "Discovery + memory — list skill packs, activate packs, remember and recall context",
    toolNames: ["list_skill_packs", "activate_skill_pack", "remember", "recall", "set_preferences"],
  });

  // Planning — task management
  packs.set("planning", {
    id: "planning",
    name: "Planning & Tasks",
    description: "Task management, planning, and execution tracking — create tasks, build plans, track progress",
    toolNames: [
      "list_tasks", "create_task", "get_task", "update_task",
      "claim_task", "complete_task", "log_progress", "delete_task",
      "create_plan", "get_plan", "update_plan",
    ],
  });

  // Knowledge
  packs.set("knowledge", {
    id: "knowledge",
    name: "Knowledge Base",
    description: "Project knowledge management — query decisions, add context, record learnings",
    toolNames: ["query_context", "add_context", "record_learning", "log_learning", "search_learnings"],
  });

  // Social listening — free tools
  packs.set("social-listening", {
    id: "social-listening",
    name: "Social Listening",
    description: "Search and retrieve content from social platforms — Reddit, Twitter, TikTok, YouTube, Instagram. Free, no API key needed.",
    toolNames: [
      "search_content", "get_content_comments", "get_trending_content",
      "get_user_content", "get_platform_status", "health_check", "extract_url",
    ],
  });

  // Audience analysis — paid tools
  packs.set("audience-analysis", {
    id: "audience-analysis",
    name: "Audience Analysis",
    description: "AI-powered content analysis, opinion clustering, insight extraction, and cross-platform research synthesis. Requires CROWDLISTEN_API_KEY.",
    toolNames: [
      "analyze_content", "cluster_opinions", "enrich_content",
      "deep_analyze", "extract_insights", "research_synthesis",
    ],
  });

  // Sessions — multi-agent coordination
  packs.set("sessions", {
    id: "sessions",
    name: "Multi-Agent Sessions",
    description: "Coordinate parallel agent sessions on shared tasks",
    toolNames: ["start_session", "list_sessions", "update_session"],
  });

  // Setup — board management
  packs.set("setup", {
    id: "setup",
    name: "Setup & Board Management",
    description: "Project and board setup — list projects, create boards, migrate tasks",
    toolNames: [
      "get_or_create_global_board", "list_projects",
      "list_boards", "create_board", "migrate_to_global_board",
    ],
  });

  // Spec Delivery — actionable specs from crowd analysis
  packs.set("spec-delivery", {
    id: "spec-delivery",
    name: "Spec Delivery",
    description: "Actionable specs from crowd feedback — browse, inspect, and start implementing specs generated from analysis",
    toolNames: ["get_specs", "get_spec_detail", "start_spec"],
  });

  // Legacy — context extraction tools (hidden by default for existing users, replaced by remember/recall)
  packs.set("legacy", {
    id: "legacy",
    name: "Legacy Context Extraction",
    description: "Previous-gen context tools — process transcripts, discover skills, install skills. Replaced by remember/recall and list_skill_packs.",
    toolNames: [
      "process_transcript", "get_context_blocks", "recommend_skills",
      "discover_skills", "search_skills", "install_skill",
    ],
  });

  // ── Virtual SKILL.md Packs ────────────────────────────────────────────
  // Each native skill directory becomes a virtual pack
  if (fs.existsSync(skillsDir)) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;

      packs.set(entry.name, {
        id: entry.name,
        name: entry.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        description: `Skill workflow: ${entry.name}. Activate to load SKILL.md instructions.`,
        toolNames: [],
        isVirtual: true,
        skillMdPath: skillMd,
      });
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get tool definitions for a set of active pack IDs.
 * Core pack tools are always included.
 */
export function getToolsForPacks(activePackIds: string[]): any[] {
  const toolNames = new Set<string>();

  // Core is always included
  const corePack = packs.get("core");
  if (corePack) {
    for (const name of corePack.toolNames) toolNames.add(name);
  }

  for (const packId of activePackIds) {
    const pack = packs.get(packId);
    if (!pack || pack.isVirtual) continue;
    for (const name of pack.toolNames) toolNames.add(name);
  }

  const tools: any[] = [];
  for (const name of toolNames) {
    const tool = toolMap.get(name);
    if (tool) tools.push(tool);
  }
  return tools;
}

/**
 * Get tool definitions for a single pack.
 */
export function getPackTools(packId: string): any[] {
  const pack = packs.get(packId);
  if (!pack) return [];
  return pack.toolNames
    .map(name => toolMap.get(name))
    .filter(Boolean);
}

/**
 * List all packs with their metadata and active status.
 */
export function listPacks(activePackIds: string[]): SkillPackInfo[] {
  const result: SkillPackInfo[] = [];
  for (const pack of packs.values()) {
    result.push({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      toolCount: pack.toolNames.length,
      status: activePackIds.includes(pack.id) || pack.id === "core" ? "active" : "available",
      isVirtual: pack.isVirtual || false,
    });
  }
  return result;
}

/**
 * Check if a pack exists.
 */
export function hasPack(packId: string): boolean {
  return packs.has(packId);
}

/**
 * Get a pack by ID.
 */
export function getPack(packId: string): SkillPack | undefined {
  return packs.get(packId);
}

/**
 * Get the SKILL.md content for a virtual pack.
 */
export function getSkillMdContent(packId: string): string | null {
  const pack = packs.get(packId);
  if (!pack?.isVirtual || !pack.skillMdPath) return null;
  try {
    return fs.readFileSync(pack.skillMdPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Check if a tool name belongs to the insights module.
 */
export function isInsightsTool(name: string): boolean {
  const insightsToolNames = new Set(INSIGHTS_TOOLS.map(t => t.name));
  return insightsToolNames.has(name);
}
