/**
 * Telemetry — Opt-in usage tracking with three privacy tiers.
 *
 * Storage: ~/.crowdlisten/telemetry.jsonl (append-only, one JSON line per event)
 *
 * Tiers:
 *  - "off": no recording
 *  - "anonymous": local-only, no installationId
 *  - "community": includes installationId for aggregate insights
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { UserState, TelemetryLevel } from "./context/user-state.js";

const BASE_DIR = path.join(os.homedir(), ".crowdlisten");
const TELEMETRY_FILE = path.join(BASE_DIR, "telemetry.jsonl");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  ts: string;
  event: "tool_call";
  tool: string;
  pack: string;
  duration_ms: number;
  success: boolean;
  installationId?: string;
}

// ─── Onboarding Steps ───────────────────────────────────────────────────────

const ONBOARDING_STEPS = ["telemetry", "proactive", "learnings"] as const;

const ONBOARDING_PROMPTS: Record<string, { title: string; message: string }> = {
  telemetry: {
    title: "Usage Telemetry",
    message:
      "CrowdListen can track tool usage to improve suggestions over time. " +
      "Choose a privacy level:\n" +
      "- **off**: No tracking (default)\n" +
      "- **anonymous**: Local-only usage stats, never shared\n" +
      "- **community**: Anonymous aggregate stats help improve CrowdListen for everyone\n\n" +
      "Set with: set_preferences({ telemetry: 'off' | 'anonymous' | 'community' })",
  },
  proactive: {
    title: "Proactive Skill Suggestions",
    message:
      "CrowdListen can suggest relevant skill packs based on your usage patterns. " +
      "This is enabled by default. Disable with: set_preferences({ proactive_suggestions: false })",
  },
  learnings: {
    title: "Cross-Project Learnings",
    message:
      "CrowdListen can persist insights and patterns across projects, so learnings from one project " +
      "help in future work. Disabled by default.\n\n" +
      "Enable with: set_preferences({ cross_project_learnings: true })",
  },
};

// ─── Functions ──────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

/**
 * Record a telemetry event. Respects the user's telemetry level.
 */
export function recordEvent(
  event: Omit<TelemetryEvent, "ts" | "installationId">,
  level: TelemetryLevel,
  installationId?: string
): void {
  if (level === "off") return;

  ensureDir();

  const record: TelemetryEvent = {
    ...event,
    ts: new Date().toISOString(),
  };

  // Only include installationId at community tier
  if (level === "community" && installationId) {
    record.installationId = installationId;
  }

  fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(record) + "\n");
}

/**
 * Check if there's a pending onboarding step.
 * Returns the step name or null if all complete.
 */
export function shouldOnboard(state: UserState): string | null {
  for (const step of ONBOARDING_STEPS) {
    if (!state.onboardingCompleted.includes(step)) {
      return step;
    }
  }
  return null;
}

/**
 * Get onboarding prompt content for a step.
 */
export function getOnboardingPrompt(
  step: string
): { title: string; message: string } | null {
  return ONBOARDING_PROMPTS[step] || null;
}

/**
 * Build the tool-to-pack mapping from the registry at init time.
 * Used by both telemetry (to tag events) and suggestions.
 */
export function buildToolPackMap(
  packs: Array<{ id: string; toolNames: string[] }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const pack of packs) {
    for (const tool of pack.toolNames) {
      map.set(tool, pack.id);
    }
  }
  return map;
}
