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
  // Core — always on (5 tools)
  packs.set("core", {
    id: "core",
    name: "Core",
    description: "Discovery + memory — list skill packs, activate packs, save and recall context with semantic search",
    toolNames: ["list_skill_packs", "activate_skill_pack", "save", "recall", "set_preferences"],
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

  // Knowledge pack removed — consolidated into core save/recall

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

  // ── Agent-Proxied Packs (proxy to agent.crowdlisten.com) ────────────

  // Analysis — run full audience analysis, continue, list results
  packs.set("analysis", {
    id: "analysis",
    name: "Analysis Engine",
    description: "Run audience analyses, continue with follow-ups, list results, generate specs. Requires CROWDLISTEN_API_KEY.",
    toolNames: [
      "run_analysis", "continue_analysis", "get_analysis",
      "list_analyses", "generate_specs",
    ],
  });

  // Content & Vectors — ingest, search, manage content
  packs.set("content", {
    id: "content",
    name: "Content & Vectors",
    description: "Ingest content for vector storage, semantic search, stats, deletion. Requires CROWDLISTEN_API_KEY.",
    toolNames: ["ingest_content", "search_vectors", "get_content_stats", "delete_content"],
  });

  // Document Generation — PRDs from analysis
  packs.set("generation", {
    id: "generation",
    name: "Document Generation",
    description: "Generate PRDs from analysis results, update sections. Requires CROWDLISTEN_API_KEY.",
    toolNames: ["generate_prd", "update_prd_section"],
  });

  // LLM Proxy — free completion and model listing
  packs.set("llm", {
    id: "llm",
    name: "LLM Proxy",
    description: "Free LLM completion proxy — no API key needed. List available models and run completions.",
    toolNames: ["llm_complete", "list_llm_models"],
  });

  // Crowd Intelligence — context-enriched crowd research
  packs.set("crowd-intelligence", {
    id: "crowd-intelligence",
    name: "Crowd Intelligence",
    description: "Research what the crowd says about any topic — social listening with business context enrichment. Async: submit research, poll for results. Requires CROWDLISTEN_API_KEY.",
    toolNames: ["crowd_research", "crowd_research_status"],
  });

  // Insight Pipeline — promote insights to kanban
  packs.set("insight-pipeline", {
    id: "insight-pipeline",
    name: "Insight Pipeline",
    description: "Promote extracted insights to kanban task cards — single or batch promote, list pending insights. Review mode with dedup. Requires CROWDLISTEN_API_KEY.",
    toolNames: ["promote_insight", "batch_promote_insights", "get_pending_insights"],
  });

  // Agent Network — register, discover, share
  packs.set("agent-network", {
    id: "agent-network",
    name: "Agent Network",
    description: "Register agents, discover capabilities, submit analysis results to the network.",
    toolNames: ["register_agent", "get_capabilities", "submit_analysis"],
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
