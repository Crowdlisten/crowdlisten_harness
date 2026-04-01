/**
 * Type definitions for the context extraction pipeline.
 */

export interface RedactionResult {
  redactedText: string;
  stats: Record<string, number>;
  totalRedactions: number;
}

export interface ContextBlock {
  type: "style" | "insight" | "pattern" | "preference" | "decision";
  title: string;
  content: string;
  source?: string;
}

export interface SkillMatch {
  skillId: string;
  name: string;
  description: string;
  score: number;
  matchedKeywords: string[];
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export type SkillTier = "crowdlisten" | "community";
export type SkillCategory =
  | "development"
  | "data"
  | "content"
  | "research"
  | "automation"
  | "design"
  | "business"
  | "productivity";
export type InstallMethod = "copy" | "npx" | "git-clone";

export interface ExtendedSkillCatalogEntry extends SkillCatalogEntry {
  tier: SkillTier;
  category: SkillCategory;
  installMethod: InstallMethod;
  installTarget: string;
  source: string;
  author?: string;
}

export interface ExtendedSkillMatch extends SkillMatch {
  tier: SkillTier;
  category: SkillCategory;
  installMethod: InstallMethod;
  installTarget: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMProvider {
  name: string;
  complete(messages: LLMMessage[], opts?: LLMOpts): Promise<string>;
  embed?(texts: string[]): Promise<number[][]>;
}

export interface ContextConfig {
  provider: "openai" | "anthropic";
  apiKey: string;
  model?: string;
}

export interface PipelineResult {
  blocks: ContextBlock[];
  skills: SkillMatch[];
  redactionStats: Record<string, number>;
  totalRedactions: number;
  chunkCount: number;
}

export interface StoredData {
  blocks: ContextBlock[];
  history: Array<{
    timestamp: string;
    source: string;
    blockCount: number;
  }>;
}
