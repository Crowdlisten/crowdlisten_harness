/**
 * Orchestrator: parse -> redact -> chunk -> extract -> match -> store
 */

import type {
  ContextConfig,
  PipelineResult,
  ContextBlock,
} from "./types.js";
import { redactPII } from "./redactor.js";
import { parseFile, parseTextContent, chunkText } from "./parser.js";
import { extractBlocks } from "./extractor.js";
import { matchSkills } from "./matcher.js";
import { createProvider } from "./providers.js";
import { addBlocks, loadConfig } from "./store.js";

export interface PipelineOpts {
  /** Raw text input (from paste or direct input) */
  text?: string;
  /** File path to process */
  filePath?: string;
  /** Source label for tracking */
  source?: string;
  /** Override config (otherwise loads from ~/.crowdlisten/config.json) */
  config?: ContextConfig;
  /** Whether input is chat history (uses 4-type prompt) */
  isChat?: boolean;
  /** Progress callback */
  onProgress?: (progress: {
    current: number;
    total: number;
    blocksFound: number;
  }) => void;
}

/**
 * Run the full context extraction pipeline.
 */
export async function runPipeline(opts: PipelineOpts): Promise<PipelineResult> {
  const config = opts.config || loadConfig();
  if (!config) {
    throw new Error(
      "No LLM provider configured. Run: npx @crowdlisten/harness setup"
    );
  }

  const provider = createProvider(config);
  const source = opts.source || opts.filePath || "paste";

  // 1. Get raw text
  let rawText = opts.text || "";
  if (opts.filePath) {
    const parsed = await parseFile(opts.filePath);
    rawText = rawText ? rawText + "\n\n---\n\n" + parsed : parsed;
  }

  if (!rawText.trim()) {
    throw new Error("No content to process");
  }

  // 2. PII redaction
  const { redactedText, stats: redactionStats, totalRedactions } =
    redactPII(rawText);

  // 3. Chunk
  const chunks = chunkText(redactedText);
  const total = chunks.length;

  // 4. Extract blocks from each chunk
  const allBlocks: ContextBlock[] = [];
  const isChat = opts.isChat !== false; // default true

  for (let i = 0; i < chunks.length; i++) {
    opts.onProgress?.({ current: i + 1, total, blocksFound: allBlocks.length });
    const blocks = await extractBlocks(provider, chunks[i], source, isChat);
    allBlocks.push(...blocks);
  }

  // 5. Match skills
  const skills = await matchSkills(allBlocks);

  // 6. Store locally
  if (allBlocks.length > 0) {
    addBlocks(allBlocks, source);
  }

  opts.onProgress?.({ current: total, total, blocksFound: allBlocks.length });

  return {
    blocks: allBlocks,
    skills,
    redactionStats,
    totalRedactions,
    chunkCount: total,
  };
}
