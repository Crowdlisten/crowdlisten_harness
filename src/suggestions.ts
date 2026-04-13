/**
 * Proactive Skill Pack Suggestions — registry-driven keyword heuristics.
 *
 * After each tool call, scans the result text for keywords that map to
 * inactive packs. Suggests activation with cooldown to avoid noise.
 *
 * Trigger keywords are defined in registry.ts pack definitions (triggers array),
 * so adding a new pack with triggers auto-enables suggestion support.
 */

import { getPackTriggers } from "./tools/registry.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Suggestion {
  pack_id: string;
  reason: string;
  activate_command: string;
}

// ─── Cooldown ───────────────────────────────────────────────────────────────

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastSuggested = new Map<string, number>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if a suggestion should be made based on tool result text.
 * Returns a suggestion or null.
 *
 * Uses triggers defined in registry.ts pack definitions for keyword matching.
 */
export function checkSuggestion(
  resultText: string,
  activePacks: string[],
  proactiveSuggestionsEnabled: boolean
): Suggestion | null {
  if (!proactiveSuggestionsEnabled) return null;

  const lower = resultText.toLowerCase();
  const now = Date.now();

  // Pull trigger rules from the registry — single source of truth
  const rules = getPackTriggers();

  for (const rule of rules) {
    // Skip if pack already active
    if (activePacks.includes(rule.pack)) continue;

    // Skip if on cooldown
    const lastTime = lastSuggested.get(rule.pack);
    if (lastTime && now - lastTime < COOLDOWN_MS) continue;

    // Check if any keyword matches
    const matched = rule.triggers.some((kw) => lower.includes(kw));
    if (matched) {
      lastSuggested.set(rule.pack, now);
      return {
        pack_id: rule.pack,
        reason: `Your work relates to ${rule.description.toLowerCase().slice(0, 80)}. Activate to unlock tools.`,
        activate_command: `skills({ action: 'activate', pack_id: '${rule.pack}' })`,
      };
    }
  }

  return null;
}
