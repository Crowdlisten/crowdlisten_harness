/**
 * CrowdListen Insights — Social Platform Tools
 *
 * Tool definitions and handler dispatcher for social listening capabilities.
 * Merged from crowdlisten_sources into the unified MCP server.
 *
 * Free tools (no key): search, comments, trending, user content, platform status, health, vision
 * Paid tools (CROWDLISTEN_API_KEY): analyze, cluster, enrich, deep_analyze, insights, research
 */

import { createService } from './service-config.js';
import { HealthMonitor } from './core/health/HealthMonitor.js';
import { PlatformType } from './core/interfaces/SocialMediaPlatform.js';
import {
  getTrendingContent,
  getUserContent,
  searchContent,
  getContentComments,
  analyzeContent,
  getPlatformStatus,
  healthCheck,
  clusterOpinions,
  enrichContent,
  deepAnalyze,
  extractInsights,
  researchSynthesis,
  extractWithVision,
} from './handlers.js';

// Re-export types for consumers
export { HealthMonitor } from './core/health/HealthMonitor.js';
export type {
  HealthStatus,
  HealthSummary,
  PlatformHealthState,
  HealthCheckFn,
} from './core/health/HealthMonitor.js';

// ─── Tool Definitions ──────────────────────────────────────────────────────

export const INSIGHTS_TOOLS = [
  // ── Free tools — no API key needed ──────────────────────────────────────
  {
    name: 'search_content',
    description: 'Search for posts and discussions across social platforms. Use this first to find content, then use get_content_comments on specific results. Free, no API key needed.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook', 'all'],
          description: 'Platform to search on, or "all" for all platforms',
        },
        query: {
          type: 'string',
          description: 'Search query (keywords, hashtags, etc.)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum number of posts to retrieve',
        },
        useVision: {
          type: 'boolean',
          default: false,
          description: 'Force vision extraction mode (screenshot + LLM analysis). Treats query as a URL.',
        },
      },
      required: ['platform', 'query'],
    },
  },
  {
    name: 'get_content_comments',
    description: 'Get comments/replies for a specific post. Use after search_content to drill into a discussion. Returns raw comment text, authors, timestamps, and engagement metrics. Free, no API key needed.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to get comments for',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum number of comments to retrieve',
        },
        useVision: {
          type: 'boolean',
          default: false,
          description: 'Force vision extraction mode (screenshot + LLM analysis). Treats contentId as a URL.',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'get_trending_content',
    description: 'Get currently trending posts from a platform. Useful for discovering what audiences are talking about right now. Free, no API key needed.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook', 'all'],
          description: 'Platform to get trending content from, or "all" for all platforms',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum number of posts to retrieve',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'get_user_content',
    description: 'Get recent posts from a specific user/creator. Useful for tracking influencers, competitors, or key voices. Free, no API key needed.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform to get user content from',
        },
        userId: {
          type: 'string',
          description: 'User ID or username to get content from',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum number of posts to retrieve',
        },
      },
      required: ['platform', 'userId'],
    },
  },
  {
    name: 'get_platform_status',
    description: 'List which platforms are available and their capabilities. Call this to check what platforms are configured before searching.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'health_check',
    description: 'Check connectivity and health of all configured platforms. Call this to diagnose issues if search or comments return errors.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ── Vision extraction — screenshot + LLM analysis, no API key ────────────
  {
    name: 'extract_url',
    description: 'Extract content from any URL using vision (screenshot + LLM analysis). Works with any website — social media, forums, news sites, etc. Requires at least one LLM API key (ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY). Free, no CROWDLISTEN_API_KEY needed.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to extract content from',
        },
        mode: {
          type: 'string',
          enum: ['posts', 'comments', 'raw'],
          default: 'posts',
          description: 'Extraction mode: posts (structured posts), comments (structured comments), raw (unstructured text)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum items to extract',
        },
      },
      required: ['url'],
    },
  },

  // ── Paid tools — require CROWDLISTEN_API_KEY ─────────────────────────────
  {
    name: 'analyze_content',
    description: 'Analyze a post and its comments via the CrowdListen analysis API — sentiment, themes, tension synthesis. Requires CROWDLISTEN_API_KEY. Get one at crowdlisten.com/api.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to analyze',
        },
        analysisDepth: {
          type: 'string',
          enum: ['surface', 'standard', 'deep', 'comprehensive'],
          default: 'standard',
          description: 'Depth of analysis',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'cluster_opinions',
    description: 'Group comments into engagement-weighted semantic opinion clusters. Identifies recurring themes, consensus, and minority viewpoints. Requires CROWDLISTEN_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to analyze comments from',
        },
        clusterCount: {
          type: 'number',
          default: 5,
          minimum: 2,
          maximum: 15,
          description: 'Number of opinion clusters to generate',
        },
        includeExamples: {
          type: 'boolean',
          default: true,
          description: 'Include example comments for each cluster',
        },
        weightByEngagement: {
          type: 'boolean',
          default: true,
          description: 'Weight clusters by comment engagement (likes, replies)',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'enrich_content',
    description: 'Enrich comments with intent detection, stance analysis, engagement scoring, and timestamp hints. Requires CROWDLISTEN_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to enrich comments for',
        },
        question: {
          type: 'string',
          description: 'Optional analysis context/question',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'deep_analyze',
    description: 'AI-powered deep analysis of content via the CrowdListen analysis API. Returns structured insights including audience segments, pain points, feature requests, and competitive signals. Requires CROWDLISTEN_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to analyze',
        },
        analysisDepth: {
          type: 'string',
          enum: ['deep', 'comprehensive'],
          default: 'deep',
          description: 'deep = structured analysis; comprehensive = full audience intelligence report',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'extract_insights',
    description: 'Extract categorized insights (pain points, feature requests, praise, complaints, suggestions) from content via the CrowdListen analysis API. Requires CROWDLISTEN_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tiktok', 'twitter', 'reddit', 'instagram', 'youtube', 'moltbook'],
          description: 'Platform where the content is located',
        },
        contentId: {
          type: 'string',
          description: 'ID of the content to extract insights from',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter to specific insight categories (e.g. ["pain_points", "feature_requests"])',
        },
      },
      required: ['platform', 'contentId'],
    },
  },
  {
    name: 'research_synthesis',
    description: 'Cross-platform research synthesis — searches multiple platforms, analyzes results, and produces a unified research report. Requires CROWDLISTEN_API_KEY.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Research query or topic to synthesize across platforms',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Platforms to include (default: reddit, twitter, youtube)',
        },
        depth: {
          type: 'string',
          enum: ['quick', 'standard', 'deep'],
          default: 'standard',
          description: 'Research depth — quick (~10 sources), standard (~25), deep (~50+)',
        },
      },
      required: ['query'],
    },
  },
];

// ─── Insights Runtime ──────────────────────────────────────────────────────

let insightsService: ReturnType<typeof createService> | null = null;
let insightsMonitor: HealthMonitor | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (insightsService) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    insightsService = createService();
    const initResults = await insightsService.initialize();

    const successfulPlatforms = Object.entries(initResults)
      .filter(([, success]) => success)
      .map(([platform]) => platform);

    if (successfulPlatforms.length === 0) {
      console.error('[Insights] No platforms initialized');
      return;
    }

    console.error(`[Insights] Initialized: ${successfulPlatforms.join(', ')}`);

    // Start background health monitoring
    const monitoredPlatforms = insightsService.getInitializedPlatforms();
    const healthCheckFn = async (platform: PlatformType) => {
      try {
        const results = await insightsService!.searchContent(platform, 'test', 1);
        return { success: true, resultCount: results.length };
      } catch {
        return { success: false, resultCount: 0 };
      }
    };

    insightsMonitor = new HealthMonitor(healthCheckFn, monitoredPlatforms);
    insightsMonitor.start();
  })();

  await initPromise;
}

/**
 * Handle an insights tool call. Returns a JSON string result.
 * Lazily initializes the social media service on first call.
 */
export async function handleInsightsTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  await ensureInitialized();

  if (!insightsService) {
    throw new Error('Insights service failed to initialize. Check platform credentials.');
  }

  switch (name) {
    // ── Free tools ──────────────────────────────────────────────────
    case 'search_content':
      return JSON.stringify(await searchContent(insightsService, args as any), null, 2);

    case 'get_content_comments':
      return JSON.stringify(await getContentComments(insightsService, args as any), null, 2);

    case 'get_trending_content':
      return JSON.stringify(await getTrendingContent(insightsService, args as any), null, 2);

    case 'get_user_content':
      return JSON.stringify(await getUserContent(insightsService, args as any), null, 2);

    case 'get_platform_status':
      return JSON.stringify(getPlatformStatus(insightsService), null, 2);

    case 'health_check':
      return JSON.stringify(await healthCheck(insightsService, insightsMonitor ?? undefined), null, 2);

    // ── Vision extraction ─────────────────────────────────────────
    case 'extract_url':
      return JSON.stringify(await extractWithVision(args as any), null, 2);

    // ── Paid tools (all delegate to agent API) ──────────────────────
    case 'analyze_content':
      return JSON.stringify(await analyzeContent(insightsService, args as any), null, 2);

    case 'cluster_opinions':
      return JSON.stringify(await clusterOpinions(insightsService, args as any), null, 2);

    case 'enrich_content':
      return JSON.stringify(await enrichContent(insightsService, args as any), null, 2);

    case 'deep_analyze':
      return JSON.stringify(await deepAnalyze(args as any), null, 2);

    case 'extract_insights':
      return JSON.stringify(await extractInsights(args as any), null, 2);

    case 'research_synthesis':
      return JSON.stringify(await researchSynthesis(args as any), null, 2);

    default:
      throw new Error(`Unknown insights tool: ${name}`);
  }
}

/** Tool name set for quick lookup */
export const INSIGHTS_TOOL_NAMES = new Set(INSIGHTS_TOOLS.map(t => t.name));

/** Clean up resources on shutdown */
export async function cleanupInsights(): Promise<void> {
  if (insightsMonitor) {
    insightsMonitor.stop();
    insightsMonitor = null;
  }
  if (insightsService) {
    await insightsService.cleanup();
    insightsService = null;
  }
  initPromise = null;
}
