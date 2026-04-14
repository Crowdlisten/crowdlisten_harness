# CrowdListen — Agent Reference

Unified MCP server for AI agents. Shared context via structured harnesses — ingest, compile, query, and compound.

## Quick Start

```bash
npx @crowdlisten/harness login
```

Auto-configures MCP for Claude Code, Cursor, Gemini CLI, Codex, OpenClaw, Amp.

### Manual MCP config (stdio)
```json
{ "crowdlisten": { "command": "npx", "args": ["-y", "@crowdlisten/harness"] } }
```

### Remote MCP config (Streamable HTTP)
```json
{
  "crowdlisten": {
    "url": "https://mcp.crowdlisten.com/mcp",
    "headers": {
      "Authorization": "Bearer YOUR_API_KEY"
    }
  }
}
```

## Interfaces

| Interface | Access | Best for |
|-----------|--------|----------|
| MCP stdio | `npx @crowdlisten/harness` — 21 tools | Local agents |
| MCP HTTP | `POST https://mcp.crowdlisten.com/mcp` | Remote agents, cloud |
| REST | `POST https://mcp.crowdlisten.com/tools/{name}` | Non-MCP integrations |
| OpenAPI | `GET https://mcp.crowdlisten.com/openapi.json` | Docs, code gen |
| CLI | `npx @crowdlisten/harness login/setup/serve/openapi` | Auth, config, hosting |
| Web UI | `npx @crowdlisten/harness context` → localhost:3847 | Visual context extraction |

## Progressive Disclosure

You start with **3 tools**. Activate skill packs to unlock more:

```
skills({ action: "list" })                      → see available packs
skills({ action: "activate", pack_id: "planning" }) → unlocks 3 task tools
skills({ action: "activate", pack_id: "social-listening" }) → unlocks 5 social tools
```

After activation, new tools appear automatically via `tools/list_changed`.

## Always-On Tools (3)

- **skills**(action: "list"|"activate", pack_id?) — List all packs or activate one. For SKILL.md packs, returns workflow instructions.
- **save**(title, content, tags?, project_id?, path?, folder?, analysis_id?, publish?: { team_id }) — Save context to the `pages` table in Supabase. Also handles wiki page writes (`path`), folder ingestion (`folder`), and analysis ingest (`analysis_id`).
- **recall**(query?, path?, list?, mode?, log?, recent?, context?, observations?, themes?, project_id?, tags?, limit?) — Retrieve from the knowledge base. Supports semantic search, keyword search, page read, browse, activity log, recent insights, observation feed, and clustered themes.

Note: `wiki_list`, `wiki_read`, `wiki_write`, `wiki_search`, `wiki_log`, `wiki_ingest`, `ingest_folder`, `get_user_context`, `get_recent_insights`, `get_observation_feed`, and `get_theme_insights` are backward-compatible aliases that route to `save` or `recall` with appropriate parameters. They work when called but are hidden from `tools/list`.

## Skill Packs

| Pack | Tools | Description |
|------|-------|-------------|
| **core** (always on) | 3 | Semantic recall, knowledge save, skill discovery |
| **planning** | 3 | Tasks and progress tracking |
| **social-listening** | 5 | Search social platforms |
| **audience-analysis** | 1 | AI analysis + opinion clustering |
| **analysis** | 5 | Full audience analyses + spec generation |
| **crowd-intelligence** | 1 | Context-enriched crowd research |
| **observations** | 3 | Submit observations, manage connectors, track entities |

Plus: 14 native SKILL.md workflow packs (knowledge-base, competitive-analysis, content-creator, content-strategy, context-extraction, crowd-research, data-storytelling, entity-research, heuristic-evaluation, market-research-reports, multi-agent, spec-generation, user-stories, ux-researcher)

## Planning Pack (3 tools)

- **list_tasks**(board_id?, status?, limit?, task_id?, claim?) — List board tasks, get single task details, or pass `claim` to claim a task (moves to In Progress). Aliases: `claim_task` routes here.
- **create_task**(title, description?, priority?) — Create task
- **complete_task**(task_id, summary?, progress?, execute?, executor?, status?, process_id?) — Mark done, log progress, trigger server-side agent execution, or poll execution status. Pass `progress: true` to log a progress note. Pass `execute: true` to dispatch to an agent. Pass `status: true` to poll completion. Aliases: `execute_task` and `get_execution_status` route here.

### Task Execution Workflow

```
list_tasks (claim) → complete_task (execute) → complete_task (status, poll) → complete_task (done)
```

Claim a task, dispatch it to a server-side agent, poll until finished, then mark it complete. The executor runs on the backend — your local agent only needs to poll for results.

## Social Listening Pack (5 tools)

- **search_content**(platform, query, limit?, type?: "user", userId?) — Search posts across platforms. Pass `type: "user"` with `userId` to get a user's recent posts.
- **get_content_comments**(platform, contentId, limit?) — Get comments/replies
- **get_trending_content**(platform, limit?) — Trending posts
- **platform_status**(diagnose?: true) — Available platforms + capabilities. Pass `diagnose: true` for full connectivity health check.
- **extract_url**(url, mode?, limit?) — Vision extraction from any URL

Platforms: reddit, twitter, tiktok, instagram, youtube, moltbook

## Audience Analysis Pack (1 tool)

- **analyze_content**(platform, contentId, analysisDepth?, enrichment?, cluster?, clusterCount?, extract?, categories?) — Sentiment, themes, tensions. Use `analysisDepth: "deep"` or `"comprehensive"` for full audience intelligence. Pass `enrichment: true` for intent/stance analysis. Pass `cluster: true` for opinion clustering. Pass `extract: true` for categorized insight extraction. Aliases: `cluster_opinions` and `extract_insights` route here.

## Crowd Intelligence Pack (1 tool)

Activate: `skills({ action: "activate", pack_id: "crowd-intelligence" })`

- **crowd_research**(action: "start"|"status", query?, platforms?, depth?, context?, job_id?) — Start async crowd research or poll status. Pass `action: "start"` with a query to begin, `action: "status"` with a job_id to poll.

**Platforms:** reddit, twitter, moltbook, xiaohongshu, web (Exa search)
**Depth:** quick (~30s), standard (~90s), deep (~120s)
**Context:** Auto-recalls your saved business context. Override with `context` param.

### Crowd Intelligence Example

```
Agent: skills({ action: "activate", pack_id: "crowd-intelligence" })
Agent: crowd_research({ action: "start", query: "What do users think about AI code editors?", platforms: ["reddit", "twitter"], depth: "standard" })
→ { status: "running", job_id: "abc-123", estimated_seconds: 60 }

[wait 10 seconds]

Agent: crowd_research({ action: "status", job_id: "abc-123" })
→ { status: "running", message: "Analysis still running..." }

[wait 10 seconds]

Agent: crowd_research({ action: "status", job_id: "abc-123" })
→ { status: "complete", takeaway: "...", themes: [...], sentiment: {...} }
```

## Analysis (5 tools)

- **run_analysis**(project_id, question, platforms?, max_results?) — Run audience analysis across Reddit, YouTube, TikTok, Twitter, Instagram, Xiaohongshu. Streams results.
- **continue_analysis**(analysis_id, question) — Follow-up question on existing analysis.
- **get_analysis**(analysis_id) — Get full analysis results with themes, sentiment, quotes.
- **list_analyses**(project_id, limit?) — List analyses for a project.
- **generate_specs**(project_id, analysis_id?, spec_type?) — Generate feature requests, user stories, acceptance criteria from analysis.

## Observations Pack (3 tools)

The observations pack enables agents to submit and query the continuous feedback intelligence pipeline. External agents, bots, and webhooks register as connectors, submit raw observations, and the pipeline auto-classifies them into themes. To query the observation feed or theme insights, use `recall` with `observations: true` or `themes: true` (aliases `get_observation_feed` and `get_theme_insights` also route there).

- **submit_observation**(observations, project_id?) — Submit 1-50 observations from agent conversations. Each observation includes a type (feature_request, bug, pain_point, praise, question, competitive, general), content, and optional metadata. Auto-classified and clustered by the backend pipeline.
- **setup_connector**(name, type?, project_id?) — Register a connector (agent, native_bot, or webhook) and receive an API key for submitting observations.
- **manage_entities**(action, name?, type?, entity_id?, project_id?, ...) — CRUD for tracked entities (companies, competitors, products). Link entities to projects for entity-aware observation tracking.

## Knowledge Base

The knowledge base is a compounding loop built on the unified `pages` table in Supabase with `UNIQUE(user_id, path)` identity — like a filesystem in the cloud. Every agent interaction can enrich it. Saves accumulate, the wiki tools let agents browse and search, and research results get filed back. Over time the knowledge base becomes a rich starting point instead of a blank slate.

### How data flows

```
 save()          Supabase `pages`       ~/.crowdlisten/kb/
───────→  UNIQUE(user_id, path)  sync→  ├── notes/auth-approach.md
                                        ├── projects/cl/topics/...
 recall()       semantic search         └── documents/thesis/ch1.md
 recall(list)   browse by path
←────────────────┘                      watch / sync
                                        auto-sync local folders
```

1. **Save** — `save({ title, content, tags })` writes to the `pages` table in Supabase and renders a `.md` file locally. Pass `publish: { team_id }` to share with teammates.
2. **Recall** — `recall({ query })` performs semantic search using pgvector cosine similarity with ILIKE keyword fallback. Filter by path prefix or tags.
3. **Browse** — `recall({ list: true })` browses the index. `recall({ path })` reads a single page.
4. **Search** — `recall({ query, mode: "keyword" })` performs full-text search across all entries.
5. **Write to path** — `save({ path, title, content })` creates or updates a page at a specific path.
6. **Ingest** — `save({ analysis_id })` ingests an analysis. `save({ folder })` bulk-imports a local folder.
7. **Log** — `recall({ log: true })` returns timestamped log entries for decisions, progress notes, or session journals.
8. **Sync** — `npx @crowdlisten/harness sync ~/folder` syncs a local folder to pages. `watch` mode auto-syncs on file changes.

### The compounding effect

After every analysis or research task, the agent saves key takeaways. The wiki and recall tools let agents browse, search, and organize knowledge semantically. The next agent (or the same agent in a new session) starts with a rich knowledge base instead of a blank slate.

Supabase `pages` table is the source of truth. Local `.md` folders can be synced bidirectionally via the `watch` and `sync` CLI commands.

### Path conventions

Use consistent paths for organization: `notes/` for standalone notes, `projects/{slug}/` for project-scoped content, `documents/` for ingested files, `decisions/` for architectural decisions.

### Tag vocabulary

Use consistent tags so grouping works effectively: `decision`, `pattern`, `insight`, `preference`, `learning`, `principle`, `synthesis`.

## Core Workflow

```
skills({ action: "activate", pack_id: "planning" })
→ list_tasks → list_tasks (claim) → recall (search context)
→ complete_task (execute) → complete_task (status, poll) → save → complete_task (done)
```

## Privacy

- PII redacted locally before LLM calls
- Context stored in Supabase with row-level security + local .md cache at ~/.crowdlisten/context/
- User's own API keys for extraction
- No data syncs without explicit user action
- Agent-proxied tools go through `agent.crowdlisten.com` with your API key
