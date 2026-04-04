/**
 * Agent-Proxied Tools — Tools that proxy to agent.crowdlisten.com
 *
 * 6 skill packs, 18 tools. Each tool calls the agent backend via
 * the shared agent-proxy helpers.
 *
 * Free vs Paid:
 *   - Free: llm (2 tools), agent-network (2 tools) — no API key needed
 *   - Paid: analysis (5), content (4), generation (2), crowd-intelligence (2) — require CROWDLISTEN_API_KEY
 */

import {
  agentPost,
  agentGet,
  agentDelete,
  agentStream,
  requireApiKey,
} from "./agent-proxy.js";

// ─── Tool Definitions ──────────────────────────────────────────────────────

export const AGENT_TOOLS = [
  // ── Analysis Pack (5 tools) ────────────────────────────────────────────
  {
    name: "run_analysis",
    description:
      "[Analysis] Run an audience analysis on a project. Streams results via SSE — returns the final analysis with themes, sentiment, insights, and recommendations. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        question: {
          type: "string",
          description:
            "Research question to analyze (e.g., 'What do users think about our pricing?')",
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description:
            "Platforms to search: reddit, youtube, tiktok, twitter, instagram, xiaohongshu. Default: all.",
        },
        max_results: {
          type: "number",
          description: "Max results per platform (default 20)",
        },
      },
      required: ["project_id", "question"],
    },
  },
  {
    name: "continue_analysis",
    description:
      "[Analysis] Continue a previous analysis with a follow-up question. Builds on existing context. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string", description: "Analysis UUID from run_analysis" },
        question: { type: "string", description: "Follow-up question" },
      },
      required: ["analysis_id", "question"],
    },
  },
  {
    name: "get_analysis",
    description:
      "[Analysis] Get the full results of a completed analysis including themes, sentiment breakdown, and source quotes. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        analysis_id: { type: "string", description: "Analysis UUID" },
      },
      required: ["analysis_id"],
    },
  },
  {
    name: "list_analyses",
    description:
      "[Analysis] List analyses for a project, newest first. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "generate_specs",
    description:
      "[Analysis] Generate product specifications from analysis results — feature requests, user stories, and acceptance criteria extracted from audience signal. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        analysis_id: {
          type: "string",
          description: "Optional: scope to a specific analysis",
        },
        spec_type: {
          type: "string",
          description: "Type: feature_requests, user_stories, acceptance_criteria, all. Default: all.",
        },
      },
      required: ["project_id"],
    },
  },

  // ── Content Pack (4 tools) ─────────────────────────────────────────────
  {
    name: "ingest_content",
    description:
      "[Content] Ingest content into the vector store for semantic search. Accepts raw text, URLs, or structured content. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        content: { type: "string", description: "Text content to ingest" },
        source_url: { type: "string", description: "Optional: source URL" },
        title: { type: "string", description: "Optional: content title" },
        metadata: {
          type: "object",
          description: "Optional: key-value metadata",
        },
      },
      required: ["project_id", "content"],
    },
  },
  {
    name: "search_vectors",
    description:
      "[Content] Semantic search across ingested content using vector embeddings. Returns ranked results with relevance scores. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
        threshold: {
          type: "number",
          description: "Minimum similarity score 0-1 (default 0.5)",
        },
      },
      required: ["project_id", "query"],
    },
  },
  {
    name: "get_content_stats",
    description:
      "[Content] Get statistics about ingested content — document count, total chunks, storage usage. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "delete_content",
    description:
      "[Content] Delete a specific content document and its vector embeddings. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content_id: { type: "string", description: "Content document UUID" },
      },
      required: ["content_id"],
    },
  },

  // ── Generation Pack (2 tools) ──────────────────────────────────────────
  {
    name: "generate_prd",
    description:
      "[Generation] Generate a Product Requirements Document from analysis results. Streams the PRD as it's generated. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        analysis_ids: {
          type: "array",
          items: { type: "string" },
          description: "Analysis UUIDs to base the PRD on",
        },
        template: {
          type: "string",
          description:
            "PRD template: standard, lean, technical, marketing. Default: standard.",
        },
        sections: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific sections to generate (default: all). Options: overview, problem, solution, requirements, metrics, timeline",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "update_prd_section",
    description:
      "[Generation] Update a specific section of an existing PRD with new content or instructions. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        document_id: { type: "string", description: "PRD document UUID" },
        section: {
          type: "string",
          description: "Section to update: overview, problem, solution, requirements, metrics, timeline",
        },
        instructions: {
          type: "string",
          description: "Instructions for how to update the section",
        },
        content: {
          type: "string",
          description: "Optional: replacement content (overrides instructions-based generation)",
        },
      },
      required: ["document_id", "section"],
    },
  },

  // ── LLM Pack (2 tools) — FREE ─────────────────────────────────────────
  {
    name: "llm_complete",
    description:
      "[LLM] Send a completion request through CrowdListen's LLM proxy. Free tier — no API key required. Supports multiple models.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prompt: { type: "string", description: "The prompt to complete" },
        model: {
          type: "string",
          description:
            "Model to use (default: gpt-4o-mini). Call list_llm_models for available options.",
        },
        max_tokens: {
          type: "number",
          description: "Max tokens in response (default 1000)",
        },
        temperature: {
          type: "number",
          description: "Temperature 0-2 (default 0.7)",
        },
        system: {
          type: "string",
          description: "Optional system prompt",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "list_llm_models",
    description:
      "[LLM] List available LLM models and their capabilities. Free — no API key required.",
    inputSchema: { type: "object" as const, properties: {} },
  },

  // ── Crowd Intelligence Pack (2 tools) — Paid ──────────────────────────
  {
    name: "crowd_research",
    description:
      "[Crowd Intelligence] Research what the crowd is saying about a topic. Searches social platforms, clusters opinions, and synthesizes structured intelligence enriched with your business context. Returns a job_id — poll with crowd_research_status. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Research question (e.g., 'What do developers think about cursor vs copilot?')",
        },
        platforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["reddit", "twitter", "moltbook", "xiaohongshu", "web"],
          },
          description:
            "Platforms to search. 'web' = Exa semantic search across forums, news, blogs. Default: all.",
        },
        depth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          description:
            "quick = single platform, ~30s. standard = all platforms, ~90s. deep = exhaustive, ~120s. Default: standard.",
        },
        context: {
          type: "string",
          description:
            "Optional business context to enrich analysis. If omitted, auto-recalls saved context via semantic memory.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "crowd_research_status",
    description:
      "[Crowd Intelligence] Poll the status of a crowd_research job. Returns 'queued', 'running', 'complete', or 'error'. When complete, includes the full analysis result with themes, sentiment, insights, and context connections.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: {
          type: "string",
          description: "The job_id returned by crowd_research",
        },
      },
      required: ["job_id"],
    },
  },

  // ── Agent Network Pack (3 tools) — Mixed auth ─────────────────────────
  {
    name: "register_agent",
    description:
      "[Agent Network] Register this agent in the CrowdListen agent network. Free — no API key required. Returns agent_id for future interactions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Agent display name" },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description:
            "Agent capabilities: analysis, planning, coding, research, content",
        },
        executor: {
          type: "string",
          description:
            "Agent runtime: CLAUDE_CODE, CURSOR, GEMINI, CODEX, AMP, OPENCLAW",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_capabilities",
    description:
      "[Agent Network] List capabilities of agents in the network. Free — no API key required.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "submit_analysis",
    description:
      "[Agent Network] Submit an analysis result from this agent to the network for cross-agent synthesis. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agent_id: { type: "string", description: "Your agent_id from register_agent" },
        analysis_id: { type: "string", description: "Analysis UUID to share" },
        summary: { type: "string", description: "Brief summary of findings" },
      },
      required: ["agent_id", "analysis_id", "summary"],
    },
  },

  // ── Insight Pipeline (3 tools) ────────────────────────────────────────
  {
    name: "promote_insight",
    description:
      "[Insight Pipeline] Promote a single pending insight to a kanban card. Creates a card in the To Do column with needs-review label. Deduplicates against existing cards. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        insight_id: { type: "string", description: "Insight UUID to promote" },
        board_id: { type: "string", description: "Target kanban board UUID" },
      },
      required: ["insight_id", "board_id"],
    },
  },
  {
    name: "batch_promote_insights",
    description:
      "[Insight Pipeline] Promote all pending insights for a project to kanban cards. Creates cards in the To Do column with needs-review labels. Deduplicates automatically. Returns counts of promoted, skipped, and errors. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        board_id: { type: "string", description: "Target kanban board UUID" },
      },
      required: ["project_id", "board_id"],
    },
  },
  {
    name: "get_pending_insights",
    description:
      "[Insight Pipeline] List pending insights for a project that haven't been promoted to kanban cards yet. Useful for reviewing what insights are available before promoting. Requires CROWDLISTEN_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project UUID" },
        limit: { type: "number", description: "Max insights to return (default 20)" },
      },
      required: ["project_id"],
    },
  },
];

// ─── Agent Tool Names (for dispatch routing) ───────────────────────────────

const AGENT_TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

export function isAgentTool(name: string): boolean {
  return AGENT_TOOL_NAMES.has(name);
}

// ─── Free tools (no API key required) ──────────────────────────────────────

const FREE_TOOLS = new Set([
  "llm_complete",
  "list_llm_models",
  "register_agent",
  "get_capabilities",
]);

// ─── Handler ───────────────────────────────────────────────────────────────

export async function handleAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const needsKey = !FREE_TOOLS.has(name);
  const apiKey = needsKey ? requireApiKey() : process.env.CROWDLISTEN_API_KEY;

  switch (name) {
    // ── Analysis ───────────────────────────────────────────────
    case "run_analysis": {
      const result = await agentStream(
        "/agent/v1/analysis/run",
        {
          project_id: args.project_id,
          question: args.question,
          platforms: args.platforms,
          max_results: args.max_results,
        },
        apiKey,
        180_000 // 3 min timeout for analysis
      );
      const out: Record<string, unknown> = typeof result === "object" && result !== null ? { ...result as Record<string, unknown> } : { result };
      out._knowledge_base_hint = "Save key insights from this analysis using save(). Run compile_context() periodically to organize.";
      return JSON.stringify(out, null, 2);
    }

    case "continue_analysis": {
      const result = await agentPost(
        `/agent/v1/analysis/${args.analysis_id}/continue`,
        { question: args.question },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_analysis": {
      const result = await agentGet(
        `/agent/v1/analysis/${args.analysis_id}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "list_analyses": {
      const limit = (args.limit as number) || 20;
      const result = await agentGet(
        `/agent/v1/projects/${args.project_id}/analyses?limit=${limit}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "generate_specs": {
      const result = await agentPost(
        "/agent/v1/specs/generate",
        {
          project_id: args.project_id,
          analysis_id: args.analysis_id,
          spec_type: args.spec_type,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    // ── Content ────────────────────────────────────────────────
    case "ingest_content": {
      const result = await agentPost(
        "/agent/v1/content/ingest",
        {
          project_id: args.project_id,
          content: args.content,
          source_url: args.source_url,
          title: args.title,
          metadata: args.metadata,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "search_vectors": {
      const result = await agentPost(
        "/agent/v1/content/search",
        {
          project_id: args.project_id,
          query: args.query,
          limit: args.limit,
          threshold: args.threshold,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_content_stats": {
      const result = await agentGet(
        `/agent/v1/content/stats?project_id=${args.project_id}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "delete_content": {
      const result = await agentDelete(
        `/agent/v1/content/${args.content_id}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    // ── Generation ─────────────────────────────────────────────
    case "generate_prd": {
      const result = await agentStream(
        "/agent/v1/prd/generate",
        {
          project_id: args.project_id,
          analysis_ids: args.analysis_ids,
          template: args.template,
          sections: args.sections,
        },
        apiKey,
        180_000
      );
      return JSON.stringify(result, null, 2);
    }

    case "update_prd_section": {
      const result = await agentPost(
        "/agent/v1/prd/update-section",
        {
          document_id: args.document_id,
          section: args.section,
          instructions: args.instructions,
          content: args.content,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    // ── LLM (Free) ────────────────────────────────────────────
    case "llm_complete": {
      const result = await agentPost(
        "/api/v1/llm/complete",
        {
          prompt: args.prompt,
          model: args.model,
          max_tokens: args.max_tokens,
          temperature: args.temperature,
          system: args.system,
        },
        apiKey // Optional — may be undefined for free tier
      );
      return JSON.stringify(result, null, 2);
    }

    case "list_llm_models": {
      const result = await agentGet("/api/v1/llm/models", apiKey);
      return JSON.stringify(result, null, 2);
    }

    // ── Crowd Intelligence ────────────────────────────────────
    case "crowd_research": {
      // Step 1: Auto-recall business context if not provided
      let businessContext = args.context as string | undefined;
      if (!businessContext) {
        try {
          const recallResult = await agentPost(
            "/agent/v1/content/search",
            { query: args.query as string, limit: 5 },
            apiKey
          );
          const memories = (recallResult as any)?.results || [];
          if (memories.length > 0) {
            businessContext = memories
              .map((m: any) => m.content || m.text || "")
              .filter(Boolean)
              .join("\n---\n");
          }
        } catch {
          // Graceful degradation — run without context
        }
      }

      // Step 2: Submit async analysis via Agent Partners API
      const platforms = args.platforms as string[] | undefined;
      const depth = (args.depth as string) || "standard";

      const result = await agentPost(
        "/api/agents/analyze",
        {
          query: args.query,
          mode: "analyze",
          depth: depth === "deep" ? "deep" : "standard",
          platforms: platforms,
          search_mode: "web_only",
          business_context: businessContext || undefined,
        },
        apiKey
      );

      const response = result as any;
      return JSON.stringify(
        {
          status: "running",
          job_id: response.analysis_id,
          estimated_seconds: response.estimated_seconds || 60,
          message: `Analysis submitted. Poll with crowd_research_status({ job_id: "${response.analysis_id}" }) every 10 seconds.`,
        },
        null,
        2
      );
    }

    case "crowd_research_status": {
      const result = await agentGet(
        `/api/agents/analyze/${args.job_id}`,
        apiKey
      );
      const poll = result as any;

      if (poll.status === "complete") {
        return JSON.stringify(
          {
            status: "complete",
            takeaway: poll.summary,
            sentiment: poll.sentiment,
            themes: poll.themes,
            key_opinions: poll.key_opinions,
            related_questions: poll.related_questions,
            source_count: poll.source_count,
            share_url: poll.share_url,
            _knowledge_base_hint: "Save key insights from this research using save(). Run compile_context() periodically to organize.",
          },
          null,
          2
        );
      }

      return JSON.stringify(
        {
          status: poll.status || "running",
          job_id: args.job_id,
          message: "Analysis still running. Poll again in 10 seconds.",
        },
        null,
        2
      );
    }

    // ── Agent Network ──────────────────────────────────────────
    case "register_agent": {
      const result = await agentPost(
        "/api/agents/register",
        {
          name: args.name,
          capabilities: args.capabilities,
          executor: args.executor,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_capabilities": {
      const result = await agentGet("/api/agents/capabilities", apiKey);
      return JSON.stringify(result, null, 2);
    }

    case "submit_analysis": {
      const result = await agentPost(
        "/api/agents/analyze",
        {
          agent_id: args.agent_id,
          analysis_id: args.analysis_id,
          summary: args.summary,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    // ── Insight Pipeline ────────────────────────────────────
    case "promote_insight": {
      const result = await agentPost(
        `/agent/v1/insights/${args.insight_id}/promote`,
        { board_id: args.board_id },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "batch_promote_insights": {
      const result = await agentPost(
        "/agent/v1/insights/batch-promote",
        {
          project_id: args.project_id,
          board_id: args.board_id,
        },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_pending_insights": {
      const limit = (args.limit as number) || 20;
      const result = await agentGet(
        `/agent/v1/insights/pending/${args.project_id}?limit=${limit}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown agent tool: ${name}`);
  }
}
