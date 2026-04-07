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
  // Core — always on (discovery + knowledge base)
  packs.set("core", {
    id: "core",
    name: "Core",
    description: "Discovery + knowledge — manage skill packs, save/recall context, browse and edit pages",
    toolNames: ["skills", "save", "recall", "ingest_folder", "wiki_list", "wiki_read", "wiki_write", "wiki_search", "wiki_ingest", "wiki_log"],
  });

  // Planning — task management (4 tools)
  packs.set("planning", {
    id: "planning",
    name: "Planning & Tasks",
    description: "Task board for agent coordination — create, claim, and complete tasks. Trigger remote agent execution.",
    toolNames: [
      "list_tasks", "create_task", "claim_task", "complete_task",
      "execute_task", "get_execution_status",
    ],
  });

  // Social listening (5 tools)
  packs.set("social-listening", {
    id: "social-listening",
    name: "Social Listening",
    description: "Search and retrieve content from social platforms — Reddit, Twitter, TikTok, YouTube, Instagram.",
    toolNames: [
      "search_content", "get_content_comments", "get_trending_content",
      "platform_status", "extract_url",
    ],
  });

  // Audience analysis (3 tools)
  packs.set("audience-analysis", {
    id: "audience-analysis",
    name: "Audience Analysis",
    description: "AI-powered content analysis, opinion clustering, and insight extraction.",
    toolNames: [
      "analyze_content", "cluster_opinions", "extract_insights",
    ],
  });

  // ── Agent-Proxied Packs (proxy to agent.crowdlisten.com) ────────────

  // Analysis — run full audience analysis, continue, list results
  packs.set("analysis", {
    id: "analysis",
    name: "Analysis Engine",
    description: "Run audience analyses, continue with follow-ups, list results, generate specs.",
    toolNames: [
      "run_analysis", "continue_analysis", "get_analysis",
      "list_analyses", "generate_specs",
    ],
  });

  // Crowd Intelligence — context-enriched crowd research
  packs.set("crowd-intelligence", {
    id: "crowd-intelligence",
    name: "Crowd Intelligence",
    description: "Research what the crowd says about any topic — social listening with business context enrichment.",
    toolNames: ["crowd_research"],
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
  const insightsToolNames = new Set(INSIGHTS_TOOLS.map((t: any) => t.name));
  return insightsToolNames.has(name);
}
