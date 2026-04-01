/**
 * Cross-Project Learnings — JSONL-backed persistent insights.
 *
 * Storage: ~/.crowdlisten/learnings.jsonl (append-only)
 *
 * Confidence decay: 1 point per 30 days for observed/inferred sources.
 * User-stated learnings never decay.
 * Entries below confidence 1 are excluded from search results.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const BASE_DIR = path.join(os.homedir(), ".crowdlisten");
const LEARNINGS_FILE = path.join(BASE_DIR, "learnings.jsonl");

// ─── Types ──────────────────────────────────────────────────────────────────

export type LearningType =
  | "pattern"
  | "pitfall"
  | "preference"
  | "architecture"
  | "tool"
  | "operational";

export type LearningSource = "observed" | "user-stated" | "inferred";

export interface Learning {
  id: string;
  ts: string;
  skill: string;
  type: LearningType;
  key: string;
  insight: string;
  confidence: number;
  source: LearningSource;
  project?: string;
  files?: string[];
}

export interface LearningWithDecay extends Learning {
  effectiveConfidence: number;
  ageInDays: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

/**
 * Compute effective confidence with decay.
 * User-stated learnings don't decay. Others lose 1 point per 30 days.
 * Minimum effective confidence is 0 (entries below 1 are excluded from results).
 */
function computeEffectiveConfidence(learning: Learning): number {
  if (learning.source === "user-stated") return learning.confidence;
  const age = daysSince(learning.ts);
  const decay = age / 30;
  return Math.max(0, learning.confidence - decay);
}

/**
 * Read all learnings from JSONL file.
 */
function readAllLearnings(): Learning[] {
  if (!fs.existsSync(LEARNINGS_FILE)) return [];

  try {
    const raw = fs.readFileSync(LEARNINGS_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line) as Learning);
  } catch {
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Log a new learning. Deduplicates by key — if a learning with the same key
 * exists, the new one supersedes it (both remain in JSONL, search returns latest).
 */
export function logLearning(
  input: Omit<Learning, "id" | "ts">
): Learning {
  ensureDir();

  const learning: Learning = {
    ...input,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
  };

  fs.appendFileSync(LEARNINGS_FILE, JSON.stringify(learning) + "\n");
  return learning;
}

/**
 * Search learnings by keyword query. Returns results with decayed confidence,
 * filtered to effective confidence >= 1, sorted by effective confidence desc.
 */
export function searchLearnings(
  query: string,
  opts?: {
    crossProject?: boolean;
    currentProject?: string;
    limit?: number;
  }
): LearningWithDecay[] {
  const limit = opts?.limit ?? 10;
  const crossProject = opts?.crossProject ?? false;
  const currentProject = opts?.currentProject;

  const all = readAllLearnings();
  const lower = query.toLowerCase();

  // Deduplicate by key — keep the latest entry for each key
  const byKey = new Map<string, Learning>();
  for (const l of all) {
    byKey.set(l.key, l);
  }

  let results: LearningWithDecay[] = [];

  for (const learning of byKey.values()) {
    // Filter by project scope
    if (!crossProject && currentProject && learning.project && learning.project !== currentProject) {
      continue;
    }

    // Keyword matching on key, insight, type, and skill
    const searchable = [learning.key, learning.insight, learning.type, learning.skill]
      .join(" ")
      .toLowerCase();
    if (!searchable.includes(lower)) continue;

    const effectiveConfidence = computeEffectiveConfidence(learning);

    // Exclude stale entries
    if (effectiveConfidence < 1) continue;

    results.push({
      ...learning,
      effectiveConfidence: Math.round(effectiveConfidence * 10) / 10,
      ageInDays: Math.round(daysSince(learning.ts)),
    });
  }

  // Sort by effective confidence descending
  results.sort((a, b) => b.effectiveConfidence - a.effectiveConfidence);

  return results.slice(0, limit);
}

/**
 * Get stats about the learnings store.
 */
export function getLearningsStats(): {
  total: number;
  uniqueKeys: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
} {
  const all = readAllLearnings();
  const byKey = new Map<string, Learning>();
  for (const l of all) byKey.set(l.key, l);

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  for (const l of byKey.values()) {
    byType[l.type] = (byType[l.type] || 0) + 1;
    bySource[l.source] = (bySource[l.source] || 0) + 1;
  }

  return {
    total: all.length,
    uniqueKeys: byKey.size,
    byType,
    bySource,
  };
}
