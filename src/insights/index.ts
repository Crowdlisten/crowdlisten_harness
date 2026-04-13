/**
 * CrowdListen Insights — Social Platform Tools
 *
 * Tool definitions and handler dispatcher for social listening capabilities.
 * Merged from crowdlisten_sources into the unified MCP server.
 *
 * Retrieval tools: search, comments, trending, user content, platform status, health, vision
 * Analysis tools (API): analyze, cluster, enrich, insights
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
  extractInsights,
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
  // ── Retrieval tools ─────────────────────────────────────────────────────
  {
    name: 'search_content',
    description: 'Search for posts and discussions across social platforms. Supports keyword search or user content retrieval. Use this first to find content, then use get_content_comments on specific results.',
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
        type: {
          type: 'string',
          enum: ['search', 'user'],
          default: 'search',
          description: 'Type of search: "search" for keyword search, "user" to get content from a specific user (requires userId)',
        },
        userId: {
          type: 'string',
          description: 'User ID or username — required when type is "user"',
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
      required: ['platform'],
    },
  },
  {
    name: 'get_content_comments',
    description: 'Get comments/replies for a specific post. Use after search_content to drill into a discussion. Returns raw comment text, authors, timestamps, and engagement metrics.',
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
    description: 'Get currently trending posts from a platform. Useful for discovering what audiences are talking about right now.',
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
    name: 'platform_status',
    description: 'Check which platforms are available, their capabilities, and connectivity health. Combines status listing and health diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        diagnose: {
          type: 'boolean',
          default: false,
          description: 'When true, also runs connectivity checks on each platform (slower but more thorough)',
        },
      },
    },
  },

  // ── Vision extraction — screenshot + LLM analysis ───────────────────────
  {
    name: 'extract_url',
    description: 'Extract content from any URL using vision (screenshot + LLM analysis). Works with any website — social media, forums, news sites, etc. Requires at least one LLM API key (ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY).',
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

  // ── Analysis tools ──────────────────────────────────────────────────────
  {
    name: 'analyze_content',
    description: 'Analyze a post and its comments via the CrowdListen analysis API — sentiment, themes, tension synthesis. Also: set cluster=true for opinion clustering (was cluster_opinions), or extract=true for insight extraction (was extract_insights). Set enrichment=true to add intent detection, stance analysis, and engagement scoring.',
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
        enrichment: {
          type: 'boolean',
          default: false,
          description: 'Also enrich comments with intent detection, stance analysis, engagement scoring, and timestamp hints',
        },
        question: {
          type: 'string',
          description: 'Optional analysis context/question (used when enrichment=true)',
        },
        // ── Absorbed from cluster_opinions ──
        cluster: {
          type: 'boolean',
          description: 'Run opinion clustering (was cluster_opinions).',
        },
        clusterCount: {
          type: 'number',
          default: 5,
          minimum: 2,
          maximum: 15,
          description: 'Number of opinion clusters to generate (default: 5).',
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
        // ── Absorbed from extract_insights ──
        extract: {
          type: 'boolean',
          description: 'Extract categorized insights (was extract_insights).',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Insight categories to extract (e.g. ["pain_points", "feature_requests"]).',
        },
      },
      required: ['platform', 'contentId'],
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
    // ── Retrieval tools ─────────────────────────────────────────────
    case 'search_content': {
      // Merged: type="user" delegates to getUserContent
      if ((args as any).type === 'user' && (args as any).userId) {
        return JSON.stringify(await getUserContent(insightsService, args as any), null, 2);
      }
      return JSON.stringify(await searchContent(insightsService, args as any), null, 2);
    }

    case 'get_content_comments':
      return JSON.stringify(await getContentComments(insightsService, args as any), null, 2);

    case 'get_trending_content':
      return JSON.stringify(await getTrendingContent(insightsService, args as any), null, 2);

    // Merged: platform_status = get_platform_status + health_check
    case 'platform_status': {
      const status = getPlatformStatus(insightsService);
      if ((args as any).diagnose) {
        const health = await healthCheck(insightsService, insightsMonitor ?? undefined);
        return JSON.stringify({ ...status, health }, null, 2);
      }
      return JSON.stringify(status, null, 2);
    }

    // Legacy aliases — route to merged tools
    case 'get_platform_status':
      return JSON.stringify(getPlatformStatus(insightsService), null, 2);
    case 'health_check':
      return JSON.stringify(await healthCheck(insightsService, insightsMonitor ?? undefined), null, 2);
    case 'get_user_content':
      return JSON.stringify(await getUserContent(insightsService, args as any), null, 2);
    case 'enrich_content':
      return JSON.stringify(await enrichContent(insightsService, args as any), null, 2);

    // ── Vision extraction ─────────────────────────────────────────
    case 'extract_url':
      return JSON.stringify(await extractWithVision(args as any), null, 2);

    // ── Analysis tools ──────────────────────────────────────────────
    case 'analyze_content': {
      // ── Route to absorbed handlers based on params ──
      if ((args as any).cluster) {
        // Absorbed from cluster_opinions
        return JSON.stringify(await clusterOpinions(insightsService, args as any), null, 2);
      }
      if ((args as any).extract) {
        // Absorbed from extract_insights
        return JSON.stringify(await extractInsights(args as any), null, 2);
      }
      // Default: sentiment/themes analysis
      const analysisResult = await analyzeContent(insightsService, args as any);
      if ((args as any).enrichment) {
        const enrichResult = await enrichContent(insightsService, args as any);
        return JSON.stringify({ ...analysisResult, enrichment: enrichResult }, null, 2);
      }
      return JSON.stringify(analysisResult, null, 2);
    }

    // Legacy aliases — still handled for backward compatibility
    case 'cluster_opinions':
      return JSON.stringify(await clusterOpinions(insightsService, args as any), null, 2);

    case 'extract_insights':
      return JSON.stringify(await extractInsights(args as any), null, 2);

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
