/**
 * Proactive Skill Pack Suggestions — keyword heuristics on tool results.
 *
 * After each tool call, scans the result text for keywords that map to
 * inactive packs. Suggests activation with cooldown to avoid noise.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Suggestion {
  pack_id: string;
  reason: string;
  activate_command: string;
}

// ─── Keyword → Pack Mapping ─────────────────────────────────────────────────

interface HeuristicRule {
  keywords: string[];
  pack: string;
  reason: string;
}

const HEURISTIC_RULES: HeuristicRule[] = [
  {
    keywords: ["social", "reddit", "twitter", "tiktok", "youtube", "instagram", "platform"],
    pack: "social-listening",
    reason: "Your work mentions social platforms. Activate social-listening to search across 7 platforms.",
  },
  {
    keywords: ["analysis", "sentiment", "insight", "opinion", "audience", "cluster"],
    pack: "audience-analysis",
    reason: "Your work involves analysis. Activate audience-analysis for AI-powered content analysis and opinion clustering.",
  },
  {
    keywords: ["knowledge", "learning", "context", "decision", "pattern", "compile", "synthesize"],
    pack: "knowledge-base",
    reason: "Your work involves knowledge management. Activate the knowledge-base skill for capture-compile-synthesize workflows.",
  },
  {
    keywords: ["plan", "task", "milestone", "roadmap", "backlog"],
    pack: "planning",
    reason: "Your work involves planning. Activate the planning pack for task management and execution tracking.",
  },
  {
    keywords: ["spec", "requirement", "feature", "implementation", "acceptance"],
    pack: "spec-delivery",
    reason: "Your work involves specifications. Activate spec-delivery to browse and implement specs from analysis.",
  },
  {
    keywords: ["session", "agent", "parallel", "coordinate", "delegate"],
    pack: "sessions",
    reason: "Your work involves multi-agent coordination. Activate sessions to coordinate parallel agent sessions.",
  },
];

// ─── Cooldown ───────────────────────────────────────────────────────────────

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastSuggested = new Map<string, number>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if a suggestion should be made based on tool result text.
 * Returns a suggestion or null.
 */
export function checkSuggestion(
  resultText: string,
  activePacks: string[],
  proactiveSuggestionsEnabled: boolean
): Suggestion | null {
  if (!proactiveSuggestionsEnabled) return null;

  const lower = resultText.toLowerCase();
  const now = Date.now();

  for (const rule of HEURISTIC_RULES) {
    // Skip if pack already active
    if (activePacks.includes(rule.pack)) continue;

    // Skip if on cooldown
    const lastTime = lastSuggested.get(rule.pack);
    if (lastTime && now - lastTime < COOLDOWN_MS) continue;

    // Check if any keyword matches
    const matched = rule.keywords.some((kw) => lower.includes(kw));
    if (matched) {
      lastSuggested.set(rule.pack, now);
      return {
        pack_id: rule.pack,
        reason: rule.reason,
        activate_command: `activate_skill_pack({ pack_id: '${rule.pack}' })`,
      };
    }
  }

  return null;
}
