/**
 * Agent-Proxied Tools — Tools that proxy to agent.crowdlisten.com
 *
 * 4 skill packs, 11 tools. Each tool calls the agent backend via
 * the shared agent-proxy helpers.
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
      "[Analysis] Run an audience analysis on a project. Streams results via SSE — returns the final analysis with themes, sentiment, insights, and recommendations.",
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
      "[Analysis] Continue a previous analysis with a follow-up question. Builds on existing context.",
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
      "[Analysis] Get the full results of a completed analysis including themes, sentiment breakdown, and source quotes.",
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
      "[Analysis] List analyses for a project, newest first.",
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
      "[Analysis] Generate product specifications from analysis results — feature requests, user stories, and acceptance criteria extracted from audience signal.",
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

  // ── Crowd Intelligence Pack (1 tool — merged start + status) ──────────
  {
    name: "crowd_research",
    description:
      "[Crowd Intelligence] Research what the crowd is saying about a topic, or check status of existing research. action='start' (default): submits research and returns job_id. action='status': poll with job_id for results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["start", "status"],
          description: "Action: 'start' to begin research, 'status' to poll for results. Default: 'start'.",
        },
        query: {
          type: "string",
          description:
            "Research question (required for action='start')",
        },
        job_id: {
          type: "string",
          description: "Job ID from a previous crowd_research call (required for action='status')",
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
    },
  },

  // ── Insight Compiler (2 tools) ──────────────────────────────────────
  {
    name: "get_user_context",
    description:
      "[Insight Compiler] Search synthesized user feedback by topic. Returns insight wiki pages matching the query — themes, severity, evidence quotes, and trends compiled from connected channels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "Topic to search for (e.g., 'pricing', 'onboarding', 'mobile app bugs')",
        },
        project_id: {
          type: "string",
          description: "Optional project UUID to scope search",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_recent_insights",
    description:
      "[Insight Compiler] Get recently updated insight pages — synthesized user feedback themes from the last N days. Shows what's trending in user feedback across all connected channels.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Look back N days (default 7, max 90)",
        },
        project_id: {
          type: "string",
          description: "Optional project UUID to scope results",
        },
        limit: {
          type: "number",
          description: "Max results (default 20, max 50)",
        },
      },
    },
  },

  // ── Task Execution (2 tools) ──────────────────────────────────────────
  {
    name: "execute_task",
    description:
      "[Execution] Trigger server-side AI agent execution for a task. The agent runs on the CrowdListen backend using the specified executor (AMP, Claude Code, Codex, Gemini). Returns a process_id to poll with get_execution_status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: { type: "string", description: "Session UUID (from claim_task or start_session)" },
        prompt: { type: "string", description: "Prompt/instructions for the AI agent to execute" },
        executor: {
          type: "string",
          enum: ["CLAUDE_CODE", "CODEX", "GEMINI_CLI", "AMP"],
          description: "AI agent executor to use (default: AMP)",
        },
        cwd: { type: "string", description: "Working directory for execution (optional)" },
        auto_approve: {
          type: "boolean",
          description: "Auto-approve tool calls without human confirmation (default: false)",
        },
        allowed_tools: {
          type: "array",
          items: { type: "string" },
          description: "Restrict which tools the agent can use (optional)",
        },
        context: { type: "string", description: "Additional context to prepend to the prompt (optional)" },
      },
      required: ["session_id", "prompt"],
    },
  },
  {
    name: "get_execution_status",
    description:
      "[Execution] Get the status and recent logs of a server-side AI agent execution. Returns process status (running/completed/failed/killed) and the last 50 log entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        process_id: { type: "string", description: "Process UUID from execute_task" },
      },
      required: ["process_id"],
    },
  },

];

// ─── Agent Tool Names (for dispatch routing) ───────────────────────────────

const AGENT_TOOL_NAMES = new Set(AGENT_TOOLS.map((t) => t.name));

export function isAgentTool(name: string): boolean {
  return AGENT_TOOL_NAMES.has(name);
}

// ─── Handler ───────────────────────────────────────────────────────────────

export async function handleAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const apiKey = requireApiKey();

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
      out._knowledge_base_hint = "Save key insights from this analysis using save(). Run sync_context({ organize: true }) periodically to organize.";
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

    // ── Crowd Intelligence (merged start + status) ─────────────
    case "crowd_research": {
      const action = (args.action as string) || "start";

      // Status polling
      if (action === "status") {
        if (!args.job_id) throw new Error("job_id is required for action='status'");
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
              _knowledge_base_hint: "Save key insights from this research using save().",
            },
            null,
            2
          );
        }

        return JSON.stringify(
          {
            status: poll.status || "running",
            job_id: args.job_id,
            message: "Analysis still running. Call again with action='status' in 10 seconds.",
          },
          null,
          2
        );
      }

      // Start new research
      if (!args.query) throw new Error("query is required for action='start'");

      // Auto-recall business context if not provided
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
          message: `Analysis submitted. Call crowd_research({ action: "status", job_id: "${response.analysis_id}" }) every 10 seconds.`,
        },
        null,
        2
      );
    }

    // Legacy aliases — route to merged handlers
    case "crowd_research_status": {
      const result = await agentGet(
        `/api/agents/analyze/${args.job_id}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "register_agent": {
      const result = await agentPost(
        "/api/agents/register",
        { name: args.name, capabilities: args.capabilities, executor: args.executor },
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_capabilities": {
      const result = await agentGet("/api/agents/capabilities", apiKey);
      return JSON.stringify(result, null, 2);
    }

    // ── Insight Compiler ─────────────────────────────────────
    case "get_user_context": {
      const params = new URLSearchParams();
      if (args.topic) params.set("topic", args.topic as string);
      if (args.project_id) params.set("project_id", args.project_id as string);
      if (args.limit) params.set("limit", String(args.limit));
      const result = await agentGet(
        `/agent/v1/insights/context?${params.toString()}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    case "get_recent_insights": {
      const params = new URLSearchParams();
      if (args.days) params.set("days", String(args.days));
      if (args.project_id) params.set("project_id", args.project_id as string);
      if (args.limit) params.set("limit", String(args.limit));
      const result = await agentGet(
        `/agent/v1/insights/recent?${params.toString()}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    // ── Task Execution ────────────────────────────────────
    case "execute_task": {
      const body: Record<string, unknown> = {
        session_id: args.session_id,
        prompt: args.prompt,
      };
      if (args.executor) body.executor = args.executor;
      if (args.cwd) body.cwd = args.cwd;
      if (args.auto_approve !== undefined) body.auto_approve = args.auto_approve;
      if (args.allowed_tools) body.allowed_tools = args.allowed_tools;
      if (args.context) body.context = args.context;

      const result = await agentPost(
        "/agent/v1/kanban/agents/execute",
        body,
        apiKey
      );
      const response = result as any;
      return JSON.stringify(
        {
          process_id: response.process_id || response.id,
          status: response.status || "running",
          message: `Execution started. Poll with get_execution_status({ process_id: "${response.process_id || response.id}" }) to check progress.`,
        },
        null,
        2
      );
    }

    case "get_execution_status": {
      const result = await agentGet(
        `/agent/v1/kanban/processes/${args.process_id}`,
        apiKey
      );
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown agent tool: ${name}`);
  }
}
