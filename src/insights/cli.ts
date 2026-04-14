#!/usr/bin/env node

/**
 * CrowdListen CLI
 * Cross-channel feedback analysis + admin backend for AI agents.
 * stdout = data, stderr = status messages/errors.
 *
 * Social listening commands (search, comments, analyze, trending, etc.)
 * Admin commands (project, entity, source, analysis, research)
 */

import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import { createService } from './service-config.js';
import {
  searchContent,
  getContentComments,
  analyzeContent,
  clusterOpinions,
  getTrendingContent,
  getUserContent,
  getPlatformStatus,
  healthCheck,
  extractInsights,
  extractWithVision,
} from './handlers.js';
import {
  agentPost,
  agentGet,
  agentPut,
  agentPatch,
  agentDelete,
  agentStream,
  requireApiKey,
  requireAccessToken,
} from '../agent-proxy.js';
import { loadAuth } from '../tools.js';

// ─── Supabase Client (for direct DB operations) ─────────────────────────────

const SUPABASE_URL =
  process.env.CROWDLISTEN_URL || 'https://fnvlxtzonwybshtvrzit.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA';

async function getAuthedSupabase() {
  const auth = loadAuth();
  if (!auth?.access_token) {
    throw new Error('Not signed in. Run: npx @crowdlisten/harness login');
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await sb.auth.setSession({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  if (error) throw new Error(`Auth failed: ${error.message}`);
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Session expired. Run: npx @crowdlisten/harness login');
  return { sb, userId: user.id, email: user.email };
}

// ─── Program Setup ───────────────────────────────────────────────────────────

const program = new Command();

program
  .name('crowdlisten')
  .description('CrowdListen CLI — social listening + admin backend')
  .version('2.3.0');

// Shared service instance — initialized lazily (for social listening commands)
let service: ReturnType<typeof createService> | null = null;
let initialized = false;

async function getService() {
  if (!service) {
    service = createService();
  }
  if (!initialized) {
    const results = await service.initialize();
    const ok = Object.entries(results).filter(([, s]) => s).map(([p]) => p);
    if (ok.length === 0) {
      console.error('Error: No platforms initialized successfully');
      process.exit(1);
    }
    console.error(`[crowdlisten] Platforms: ${ok.join(', ')}`);
    initialized = true;
  }
  return service;
}

function output(data: any) {
  console.log(JSON.stringify(data, null, 2));
}

async function run(fn: () => Promise<any>) {
  try {
    const result = await fn();
    output(result);
    process.exit(0);
  } catch (err: any) {
    // Try to parse structured errors from agent-proxy
    let msg = err.message || String(err);
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error) {
        console.error(`Error: ${parsed.error}`);
        if (parsed.suggestion) console.error(`Suggestion: ${parsed.suggestion}`);
        process.exit(1);
      }
    } catch { /* not JSON */ }
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Social Listening Commands (existing)
// ═══════════════════════════════════════════════════════════════════════════════

program
  .command('search <platform> <query>')
  .description('Search social media for audience conversations')
  .option('-l, --limit <n>', 'Max results', '10')
  .option('--vision', 'Force vision extraction mode')
  .action(async (platform: string, query: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return searchContent(svc, {
        platform,
        query,
        limit: parseInt(opts.limit),
        useVision: opts.vision || false,
      });
    });
  });

program
  .command('comments <platform> <contentId>')
  .description('Get comments for a specific post/video')
  .option('-l, --limit <n>', 'Max comments', '20')
  .option('--vision', 'Force vision extraction mode')
  .action(async (platform: string, contentId: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return getContentComments(svc, {
        platform,
        contentId,
        limit: parseInt(opts.limit),
        useVision: opts.vision || false,
      });
    });
  });

program
  .command('analyze <platform> <contentId>')
  .description('Full analysis pipeline: comments + clustering + sentiment')
  .option('-d, --depth <level>', 'Analysis depth (surface|standard|deep|comprehensive)', 'standard')
  .option('--no-clustering', 'Disable opinion clustering')
  .action(async (platform: string, contentId: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return analyzeContent(svc, {
        platform,
        contentId,
        analysisDepth: opts.depth,
      });
    });
  });

program
  .command('cluster <platform> <contentId>')
  .description('Cluster opinions from comments using embeddings')
  .option('-n, --clusters <n>', 'Number of clusters', '5')
  .option('--no-examples', 'Exclude example comments')
  .action(async (platform: string, contentId: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return clusterOpinions(svc, {
        platform,
        contentId,
        clusterCount: parseInt(opts.clusters),
        includeExamples: opts.examples !== false,
        weightByEngagement: true,
      });
    });
  });

program
  .command('trending <platform>')
  .description('Get trending content from a platform')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (platform: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return getTrendingContent(svc, { platform, limit: parseInt(opts.limit) });
    });
  });

program
  .command('user <platform> <userId>')
  .description('Get content from a specific user')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (platform: string, userId: string, opts: any) => {
    await run(async () => {
      const svc = await getService();
      return getUserContent(svc, { platform, userId, limit: parseInt(opts.limit) });
    });
  });

program
  .command('vision <url>')
  .description('Extract content from any URL using vision (LLM screenshot analysis)')
  .option('-m, --mode <mode>', 'Extraction mode (posts|comments|raw)', 'posts')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (url: string, opts: any) => {
    await run(async () => {
      return extractWithVision({
        url,
        mode: opts.mode,
        limit: parseInt(opts.limit),
      });
    });
  });

program
  .command('status')
  .description('Show available platforms and capabilities')
  .action(async () => {
    await run(async () => {
      const svc = await getService();
      return getPlatformStatus(svc);
    });
  });

program
  .command('health')
  .description('Check health of all platforms')
  .action(async () => {
    await run(async () => {
      const svc = await getService();
      return healthCheck(svc);
    });
  });

program
  .command('insights <platform> <contentId>')
  .description('Extract structured insights with categorization and confidence')
  .option('-c, --categories <list>', 'Comma-separated insight categories', '')
  .action(async (platform: string, contentId: string, opts: any) => {
    await run(async () => extractInsights({
      platform,
      contentId,
      categories: opts.categories ? opts.categories.split(',') : undefined,
    }));
  });

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Commands — Project, Entity, Source, Analysis, Research
// ═══════════════════════════════════════════════════════════════════════════════

// ─── whoami ──────────────────────────────────────────────────────────────────

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(async () => {
    await run(async () => {
      const { userId, email } = await getAuthedSupabase();
      return { user_id: userId, email };
    });
  });

// ─── Project Commands ────────────────────────────────────────────────────────

const projectCmd = program
  .command('project')
  .description('Manage projects');

projectCmd
  .command('list')
  .description('List all projects')
  .action(async () => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('projects')
        .select('id, name, description, is_public, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { count: data?.length || 0, projects: data };
    });
  });

projectCmd
  .command('create <name>')
  .description('Create a new project')
  .option('-d, --description <text>', 'Project description', '')
  .option('--public', 'Make project public', false)
  .action(async (name: string, opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('projects')
        .insert({
          user_id: userId,
          name,
          description: opts.description || '',
          is_public: opts.public || false,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      console.error(`✅ Project created: ${data.name} (${data.id})`);
      return data;
    });
  });

projectCmd
  .command('get <id>')
  .description('Get project details')
  .action(async (id: string) => {
    await run(async () => {
      const { sb } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('projects')
        .select('*, analyses(id, question, status, created_at)')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    });
  });

projectCmd
  .command('delete <id>')
  .description('Delete a project')
  .action(async (id: string) => {
    await run(async () => {
      const { sb } = await getAuthedSupabase();
      const { error } = await sb.from('projects').delete().eq('id', id);
      if (error) throw new Error(error.message);
      console.error(`🗑️  Project deleted: ${id}`);
      return { deleted: id };
    });
  });

// ─── Entity Commands ─────────────────────────────────────────────────────────

const entityCmd = program
  .command('entity')
  .description('Manage tracked entities (companies, competitors, products)');

entityCmd
  .command('list')
  .description('List all entities')
  .action(async () => {
    await run(async () => {
      const jwt = requireAccessToken();
      return agentGet('/api/entities', jwt);
    });
  });

entityCmd
  .command('create <name>')
  .description('Create a new entity')
  .option('-u, --url <url>', 'Entity website URL')
  .option('-t, --tags <tags>', 'Comma-separated tags (e.g. competitor,cybersecurity)')
  .option('-k, --keywords <words>', 'Comma-separated keywords for search')
  .option('-p, --platforms <platforms>', 'Comma-separated platforms to monitor')
  .option('--industry <industry>', 'Industry category')
  .option('--description <text>', 'Entity description')
  .action(async (name: string, opts: any) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const body: Record<string, unknown> = { name, slug };
      if (opts.url) body.url = opts.url;
      if (opts.tags) body.tags = opts.tags.split(',').map((t: string) => t.trim());
      if (opts.keywords) body.keywords = opts.keywords.split(',').map((k: string) => k.trim());
      if (opts.platforms) body.platforms = opts.platforms.split(',').map((p: string) => p.trim());
      if (opts.industry) body.industry = opts.industry;
      if (opts.description) body.description = opts.description;
      const result = await agentPost('/api/entities', body, jwt);
      console.error(`✅ Entity created: ${name}`);
      return result;
    });
  });

entityCmd
  .command('get <id>')
  .description('Get entity details')
  .action(async (id: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      return agentGet(`/api/entities/${id}`, jwt);
    });
  });

entityCmd
  .command('update <id>')
  .description('Update entity fields')
  .option('-n, --name <name>', 'Entity name')
  .option('-u, --url <url>', 'Entity URL')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('-k, --keywords <words>', 'Comma-separated keywords')
  .option('-p, --platforms <platforms>', 'Comma-separated platforms')
  .option('--industry <industry>', 'Industry')
  .option('--description <text>', 'Description')
  .action(async (id: string, opts: any) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const body: Record<string, unknown> = {};
      if (opts.name) body.name = opts.name;
      if (opts.url) body.url = opts.url;
      if (opts.tags) body.tags = opts.tags.split(',').map((t: string) => t.trim());
      if (opts.keywords) body.keywords = opts.keywords.split(',').map((k: string) => k.trim());
      if (opts.platforms) body.platforms = opts.platforms.split(',').map((p: string) => p.trim());
      if (opts.industry) body.industry = opts.industry;
      if (opts.description) body.description = opts.description;
      const result = await agentPut(`/api/entities/${id}`, body, jwt);
      console.error(`✅ Entity updated: ${id}`);
      return result;
    });
  });

entityCmd
  .command('delete <id>')
  .description('Delete an entity')
  .action(async (id: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const result = await agentDelete(`/api/entities/${id}`, jwt);
      console.error(`🗑️  Entity deleted: ${id}`);
      return result;
    });
  });

entityCmd
  .command('enrich <id>')
  .description('Trigger AI enrichment for an entity')
  .action(async (id: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      console.error(`🔄 Enriching entity ${id}...`);
      const result = await agentPost(`/api/entities/${id}/enrich`, {}, jwt);
      console.error(`✅ Enrichment complete`);
      return result;
    });
  });

entityCmd
  .command('link <entityId> <projectId>')
  .description('Link entity to a project')
  .action(async (entityId: string, projectId: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const result = await agentPost(`/api/entities/${entityId}/link`, { project_id: projectId }, jwt);
      console.error(`🔗 Linked entity ${entityId} to project ${projectId}`);
      return result;
    });
  });

entityCmd
  .command('unlink <entityId> <projectId>')
  .description('Unlink entity from a project')
  .action(async (entityId: string, projectId: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const result = await agentDelete(`/api/entities/${entityId}/link/${projectId}`, jwt);
      console.error(`🔗 Unlinked entity ${entityId} from project ${projectId}`);
      return result;
    });
  });

// ─── Source Commands ─────────────────────────────────────────────────────────

const sourceCmd = program
  .command('source')
  .description('Manage connected data sources (Reddit, Discord, Slack)');

sourceCmd
  .command('list')
  .description('List connected sources')
  .action(async () => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('user_sources')
        .select('id, platform, display_name, config, is_active, last_crawled_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { count: data?.length || 0, sources: data };
    });
  });

sourceCmd
  .command('add-reddit <subreddit>')
  .description('Add a Reddit subreddit source')
  .option('-s, --sort <sort>', 'Sort order (hot|new|top)', 'hot')
  .option('-l, --limit <n>', 'Post limit per crawl', '25')
  .action(async (subreddit: string, opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const clean = subreddit.replace(/^r\//, '');
      const { data, error } = await sb
        .from('user_sources')
        .insert({
          user_id: userId,
          platform: 'reddit',
          config: { subreddit: clean, sort: opts.sort, limit: parseInt(opts.limit) },
          display_name: `r/${clean}`,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      console.error(`✅ Reddit source added: r/${clean}`);
      return data;
    });
  });

sourceCmd
  .command('add-discord <guildId> <channelId>')
  .description('Add a Discord channel source')
  .option('--guild-name <name>', 'Server name')
  .option('--channel-name <name>', 'Channel name')
  .action(async (guildId: string, channelId: string, opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const displayName = opts.channelName
        ? `${opts.guildName || 'Discord'} → #${opts.channelName}`
        : `Discord ${guildId}/${channelId}`;
      const { data, error } = await sb
        .from('user_sources')
        .insert({
          user_id: userId,
          platform: 'discord',
          config: { guild_id: guildId, channel_id: channelId },
          display_name: displayName,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      console.error(`✅ Discord source added: ${displayName}`);
      return data;
    });
  });

sourceCmd
  .command('sync [sourceIds...]')
  .description('Trigger ingestion for sources (all active if none specified)')
  .action(async (sourceIds: string[]) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      let ids = sourceIds;
      if (!ids || ids.length === 0) {
        const { data } = await sb
          .from('user_sources')
          .select('id')
          .eq('user_id', userId)
          .eq('is_active', true);
        ids = (data || []).map((s: any) => s.id);
      }
      if (ids.length === 0) {
        return { message: 'No active sources to sync' };
      }
      console.error(`🔄 Syncing ${ids.length} source(s)...`);
      // Channel ingestion uses JWT auth (require_user on the backend)
      const jwt = requireAccessToken();
      const result = await agentPost('/api/channels/ingest', { source_ids: ids }, jwt);
      console.error(`✅ Sync triggered`);
      return result;
    });
  });

sourceCmd
  .command('toggle <sourceId>')
  .description('Toggle source active/inactive')
  .action(async (sourceId: string) => {
    await run(async () => {
      const { sb } = await getAuthedSupabase();
      const { data: current, error: fetchErr } = await sb
        .from('user_sources')
        .select('is_active')
        .eq('id', sourceId)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);
      const newState = !current.is_active;
      const { data, error } = await sb
        .from('user_sources')
        .update({ is_active: newState })
        .eq('id', sourceId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      console.error(`✅ Source ${sourceId}: ${newState ? 'activated' : 'paused'}`);
      return data;
    });
  });

sourceCmd
  .command('delete <sourceId>')
  .description('Delete a source')
  .action(async (sourceId: string) => {
    await run(async () => {
      const { sb } = await getAuthedSupabase();
      const { error } = await sb.from('user_sources').delete().eq('id', sourceId);
      if (error) throw new Error(error.message);
      console.error(`🗑️  Source deleted: ${sourceId}`);
      return { deleted: sourceId };
    });
  });

// ─── Analysis Commands (agent-proxied) ──────────────────────────────────────

const analysisCmd = program
  .command('analysis')
  .description('Run and manage analyses');

analysisCmd
  .command('run <projectId> <question>')
  .description('Run an audience analysis on a project')
  .option('-p, --platforms <platforms>', 'Comma-separated platforms (reddit,twitter,youtube,tiktok)', 'reddit,twitter')
  .option('-m, --max-results <n>', 'Max results per platform', '10')
  .action(async (projectId: string, question: string, opts: any) => {
    await run(async () => {
      const jwt = requireAccessToken();
      const platforms = opts.platforms.split(',').map((p: string) => p.trim());
      console.error(`🔍 Running analysis: "${question}"`);
      console.error(`   Platforms: ${platforms.join(', ')}`);
      console.error(`   Streaming results...`);
      const result = await agentStream(
        '/agent/v1/analysis/run',
        {
          project_id: projectId,
          question,
          platforms,
          max_results: parseInt(opts.maxResults),
        },
        jwt,
        180_000, // 3 minute timeout for analyses
      );
      console.error(`✅ Analysis complete`);
      return result;
    });
  });

analysisCmd
  .command('list <projectId>')
  .description('List analyses for a project')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (projectId: string, opts: any) => {
    await run(async () => {
      const jwt = requireAccessToken();
      return agentGet(`/agent/v1/projects/${projectId}/analyses?limit=${opts.limit}`, jwt);
    });
  });

analysisCmd
  .command('get <analysisId>')
  .description('Get a specific analysis')
  .action(async (analysisId: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      return agentGet(`/agent/v1/analysis/${analysisId}`, jwt);
    });
  });

analysisCmd
  .command('continue <analysisId> <question>')
  .description('Follow up on a previous analysis')
  .action(async (analysisId: string, question: string) => {
    await run(async () => {
      const jwt = requireAccessToken();
      console.error(`🔍 Continuing analysis: "${question}"`);
      const result = await agentStream(
        `/agent/v1/analysis/${analysisId}/continue`,
        { follow_up_question: question },
        jwt,
        180_000,
      );
      console.error(`✅ Follow-up complete`);
      return result;
    });
  });

// ─── Research Commands (crowd intelligence) ─────────────────────────────────

const researchCmd = program
  .command('research')
  .description('Crowd intelligence research');

researchCmd
  .command('start <query>')
  .description('Start a crowd research job')
  .option('-p, --platforms <platforms>', 'Comma-separated platforms (reddit,twitter,web)', 'reddit,twitter,web')
  .option('-d, --depth <depth>', 'Research depth (quick|standard|deep)', 'standard')
  .option('-e, --entity <entityId>', 'Entity ID for context')
  .action(async (query: string, opts: any) => {
    await run(async () => {
      const apiKey = requireApiKey();
      const platforms = opts.platforms.split(',').map((p: string) => p.trim());
      console.error(`🔬 Starting research: "${query}"`);
      console.error(`   Depth: ${opts.depth}, Platforms: ${platforms.join(', ')}`);
      const result = await agentPost('/api/agents/analyze', {
        query,
        platforms,
        search_mode: opts.depth,
        entity_id: opts.entity || undefined,
      }, apiKey);
      console.error(`✅ Research started`);
      return result;
    });
  });

researchCmd
  .command('status <researchId>')
  .description('Check status of a research job')
  .action(async (researchId: string) => {
    await run(async () => {
      const apiKey = requireApiKey();
      return agentGet(`/api/agents/analyze/${researchId}`, apiKey);
    });
  });

// ─── Task Commands ──────────────────────────────────────────────────────────

const taskCmd = program
  .command('task')
  .description('Manage agent tasks');

taskCmd
  .command('list')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status (queued|running|completed|failed)')
  .option('-l, --limit <n>', 'Max results', '20')
  .action(async (opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      let query = sb
        .from('agent_tasks')
        .select('id, title, prompt, status, executor, created_at, completed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(parseInt(opts.limit));
      if (opts.status) {
        query = query.eq('status', opts.status);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { count: data?.length || 0, tasks: data };
    });
  });

taskCmd
  .command('create <title>')
  .description('Create a new task')
  .option('-p, --prompt <prompt>', 'Task prompt/instructions')
  .option('--project <projectId>', 'Project ID to scope the task')
  .option('--priority <priority>', 'Priority (low|medium|high)', 'medium')
  .action(async (title: string, opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('agent_tasks')
        .insert({
          user_id: userId,
          title,
          prompt: opts.prompt || title,
          status: 'queued',
          project_id: opts.project || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      console.error(`✅ Task created: ${title} (${data.id})`);
      return data;
    });
  });

// ─── Agent Connection Status ────────────────────────────────────────────────

program
  .command('agents')
  .description('Show connected agents')
  .action(async () => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const { data, error } = await sb
        .from('agent_connections')
        .select('id, agent_name, agent_type, executor, status, last_heartbeat_at, capabilities, machine_info, created_at')
        .eq('user_id', userId)
        .order('last_heartbeat_at', { ascending: false });
      if (error) throw new Error(error.message);
      const now = Date.now();
      const enriched = (data || []).map((conn: any) => ({
        ...conn,
        is_online: conn.last_heartbeat_at && conn.status === 'online'
          && (now - new Date(conn.last_heartbeat_at).getTime()) < 60_000,
      }));
      const online = enriched.filter((c: any) => c.is_online).length;
      console.error(`Agents: ${online} online, ${enriched.length} total`);
      return { online, total: enriched.length, agents: enriched };
    });
  });

// ─── Quick Setup Command (end-to-end workflow helper) ───────────────────────

program
  .command('setup-project <name>')
  .description('Quick setup: create project + entities + link them together')
  .option('-e, --entities <names>', 'Comma-separated entity names to create and link')
  .option('-t, --tags <tags>', 'Tags for all entities (e.g. competitor)')
  .option('-s, --subreddits <subs>', 'Comma-separated subreddits to add as sources')
  .action(async (name: string, opts: any) => {
    await run(async () => {
      const { sb, userId } = await getAuthedSupabase();
      const jwt = requireAccessToken();
      const results: Record<string, unknown> = {};

      // 1. Create project
      console.error(`📁 Creating project: ${name}`);
      const { data: project, error: projErr } = await sb
        .from('projects')
        .insert({ user_id: userId, name, description: `Tracking project for ${name}`, is_public: false })
        .select()
        .single();
      if (projErr) throw new Error(`Project creation failed: ${projErr.message}`);
      results.project = project;
      console.error(`   ✅ Project: ${project.id}`);

      // 2. Create entities (uses JWT auth — entity endpoints use require_user)
      if (opts.entities) {
        const entityNames = opts.entities.split(',').map((n: string) => n.trim());
        const tags = opts.tags ? opts.tags.split(',').map((t: string) => t.trim()) : [];
        results.entities = [];
        for (const eName of entityNames) {
          console.error(`🏢 Creating entity: ${eName}`);
          const slug = eName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const entity = await agentPost('/api/entities', {
            name: eName,
            slug,
            tags,
          }, jwt) as any;
          results.entities = [...(results.entities as any[]), entity];
          console.error(`   ✅ Entity: ${entity.id || entity.data?.id}`);

          // Link to project
          const entityId = entity.id || entity.data?.id;
          if (entityId) {
            try {
              await agentPost(`/api/entities/${entityId}/link`, { project_id: project.id }, jwt);
              console.error(`   🔗 Linked to project`);
            } catch (e: any) {
              console.error(`   ⚠️  Link failed: ${e.message}`);
            }
          }
        }
      }

      // 3. Add subreddit sources
      if (opts.subreddits) {
        const subs = opts.subreddits.split(',').map((s: string) => s.trim().replace(/^r\//, ''));
        results.sources = [];
        for (const sub of subs) {
          console.error(`📡 Adding source: r/${sub}`);
          const { data: src, error: srcErr } = await sb
            .from('user_sources')
            .insert({
              user_id: userId,
              platform: 'reddit',
              config: { subreddit: sub, sort: 'hot', limit: 25 },
              display_name: `r/${sub}`,
              is_active: true,
            })
            .select()
            .single();
          if (srcErr) {
            console.error(`   ⚠️  Failed: ${srcErr.message}`);
          } else {
            results.sources = [...(results.sources as any[]), src];
            console.error(`   ✅ Source: ${src.id}`);
          }
        }
      }

      console.error(`\n🎉 Setup complete!`);
      console.error(`\nNext steps:`);
      console.error(`  crowdlisten analysis run ${project.id} "What do people think about ${name}?"`);
      console.error(`  crowdlisten research start "What do people think about ${name}?"`);
      console.error(`  crowdlisten source sync`);
      return results;
    });
  });

// ─── Parse ──────────────────────────────────────────────────────────────────

// CLI only — MCP server is now unified in the parent package's index.ts
if (process.argv.length <= 2 && !process.stdin.isTTY) {
  console.error('CrowdListen CLI. Use --help to see all commands.');
  console.error('  Admin: project, entity, source, analysis, research, task, agents');
  console.error('  Social: search, comments, analyze, trending, cluster, vision');
  console.error('  Setup: setup-project, whoami, status, health');
  process.exit(0);
} else {
  program.parse();
}
