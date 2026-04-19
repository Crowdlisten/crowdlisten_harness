# Tools Reference

Technical reference for all CrowdListen Harness MCP tools (v2.3.0). 22 canonical tools across 7 packs, plus 17 SKILL.md workflow packs and 16 backward-compatible aliases. Organized by pack.

**Consolidated tool surface**: 15 legacy tools were absorbed into 5 expanded tools (`save`, `recall`, `analyze_content`, `list_tasks`, `complete_task`). Old tool names still work as backward-compatible aliases but are hidden from `tools/list`.

**Skill pack system**: Tools are grouped into packs. Only the `core` pack is always active (5 tools). Call `skills({ action: "list" })` then `skills({ action: "activate", pack_id: "..." })` to unlock others. After activation, new tools appear instantly via `tools/list_changed`.

**Auth model**: All tools authenticate via Supabase session token stored at `~/.crowdlisten/auth.json`. Sign in with `npx @crowdlisten/harness login`.

**Error responses**: All tool failures return structured errors with `error` (what happened), `suggestion` (what to do), and `docs` (link to relevant docs).

---

## Canonical Tool Summary (22 tools)

| Pack | Tools | Count |
|------|-------|-------|
| Core (always active) | `skills`, `save`, `recall`, `compile_knowledge`, `list_topics` | 5 |
| Planning & Tasks | `list_tasks`, `create_task`, `complete_task`, `decompose_goal` | 4 |
| Social Listening | `search_content`, `get_content_comments`, `get_trending_content`, `platform_status` | 4 |
| Audience Analysis | `analyze_content` | 1 |
| Analysis Engine | `run_analysis`, `continue_analysis`, `get_analysis`, `list_analyses`, `generate_specs` | 5 |
| Crowd Intelligence | `crowd_research` | 1 |
| Observations | `submit_observation`, `manage_entities` | 2 |

Additionally, `setup_connector` is a standalone tool (not assigned to a pack) used for registering observation connectors.

---

## Core (always active)

### `skills`

List all available skill packs or activate one.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | No | `"list"` or `"activate"` (default: `"list"`) |
| `pack_id` | No | Pack ID to activate (required for `action: "activate"`) |
| `include_virtual` | No | Include SKILL.md workflow packs when listing (default: `true`) |

### `save`

Save context that persists across sessions. Also supports wiki page writes, analysis ingestion, and folder import.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `title` | Yes* | Short title (*not required when `folder` or `analysis_id` is set) |
| `content` | Yes* | The content to remember (*not required when `folder` or `analysis_id` is set) |
| `tags` | No | Freeform tags (e.g. `["decision", "auth", "pattern"]`) |
| `project_id` | No | Project scope |
| `task_id` | No | Task association |
| `confidence` | No | Confidence 0-1 (default: 1.0) |
| `publish` | No | Publish to team (default: false) |
| `team_id` | No | Team UUID (required when `publish=true`) |
| `path` | No | Explicit page path -- writes to wiki page instead of auto-generating (absorbed from `wiki_write`) |
| `mode` | No | `"replace"` or `"append"` for path-based saves (default: `"replace"`) |
| `analysis_id` | No | Analysis ID to convert into knowledge pages (absorbed from `wiki_ingest`) |
| `folder` | No | Local folder path to bulk-import (absorbed from `ingest_folder`) |
| `extensions` | No | File extensions for folder import (default: `[".md", ".txt"]`) |
| `recursive` | No | Recurse into subdirectories for folder import |

**Routing logic**: If `folder` is set, runs folder ingest. If `analysis_id` is set, runs wiki ingest. If `path` is set, writes to wiki page. Otherwise, runs default save (semantic memory + page upsert).

### `recall`

Search your knowledge base. Supports semantic search, keyword search, page reading, listing, activity logs, recent insights, observation feeds, and theme retrieval.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | No | Search query (semantic by default) |
| `path` | No | Read a specific page by path (absorbed from `wiki_read`) |
| `shared_project_id` | No | Public project UUID for reading shared pages |
| `list` | No | List/enumerate pages (absorbed from `wiki_list`) |
| `prefix` | No | Path prefix filter for listing |
| `mode` | No | `"semantic"` or `"keyword"` search mode (default: `"semantic"`) |
| `log` | No | Return activity log entries (absorbed from `wiki_log`) |
| `recent` | No | Get time-filtered recent insights (absorbed from `get_recent_insights`) |
| `days` | No | Lookback days for recent mode (default: 7) |
| `context` | No | Get synthesized context on a topic (absorbed from `get_user_context`) |
| `topic` | No | Topic filter for context mode |
| `observations` | No | Get observation feed (absorbed from `get_observation_feed`) |
| `type` | No | Observation type filter |
| `themes` | No | Get clustered themes (absorbed from `get_theme_insights`) |
| `path_prefix` | No | Filter by path prefix (e.g. `"notes/"`, `"projects/my-project/"`) |
| `project_id` | No | Project scope filter |
| `tags` | No | Tag filter |
| `limit` | No | Max results (default: 20) |

**Routing logic**: `path` -> read page. `list` -> list pages. `log` -> activity log. `mode=keyword` -> keyword search. `recent` -> recent insights. `context` -> user context. `observations` -> observation feed. `themes` -> clustered themes. Default -> semantic search.

### `compile_knowledge`

Compile analyses into canonical topic pages with confidence scores. Merges findings, detects contradictions, ranks evidence. Auto-triggered after analysis, but can be called manually to force recompilation.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project UUID |
| `analysis_ids` | No | Specific analysis UUIDs to compile (default: all recent) |
| `force` | No | Force recompilation even if recently compiled (default: false) |

### `list_topics`

List compiled topics for a project. Returns topics with confidence scores, source counts, and staleness indicators.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project UUID |
| `min_confidence` | No | Minimum confidence threshold 0.0-1.0 (default: 0.0) |
| `stale_only` | No | Only return topics not updated in 7+ days (default: false) |
| `category` | No | Filter by category (default: topic) |

---

## Planning & Tasks

Pack: `planning`

### `list_tasks`

List tasks on a board, get single task details, or claim a task to start working on it.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | No | Get full details of a specific task |
| `board_id` | No | Board UUID (defaults to global board) |
| `status` | No | Filter: `todo`, `inprogress`, `inreview`, `done`, `cancelled` |
| `limit` | No | Max results (default 50) |
| `claim` | No | Task ID to claim -- moves to In Progress, creates workspace + session (absorbed from `claim_task`) |

### `create_task`

Create a new task. Defaults to global board, To Do column.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `title` | Yes | Task title |
| `description` | No | Task description |
| `priority` | No | `low`, `medium`, `high` |
| `project_id` | No | Tag task with a project |
| `board_id` | No | Specific board (defaults to global board) |
| `labels` | No | Array of `{ name, color }` objects |

### `complete_task`

Mark task done, log progress, execute via agent, or check execution status.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Card/task UUID |
| `summary` | No | Completion summary (or progress message) |
| `progress` | No | If true, log progress note without completing the task |
| `execute` | No | Execute task via agent (absorbed from `execute_task`) |
| `session_id` | No | Session UUID for execution |
| `prompt` | No | Execution prompt for agent |
| `executor` | No | Agent type: `CLAUDE_CODE`, `CODEX`, `GEMINI_CLI`, `AMP` |
| `status` | No | Check execution status (absorbed from `get_execution_status`) |
| `process_id` | No | Process ID to check status for |

### `decompose_goal`

Break a complex goal into subtasks with dependencies. Returns a structured plan and optionally executes it. Use for multi-step research, analysis, or product workflows.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `goal` | Yes | The goal to decompose into subtasks |
| `project_id` | No | Project context |
| `max_subtasks` | No | Max subtasks 2-7 (default: 5) |
| `auto_execute` | No | Execute immediately after planning (default: false) |

---

## Social Listening

Pack: `social-listening`

### `search_content`

Search for posts and discussions across social platforms. Pass `type: "user"` with `userId` for user content.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | `tiktok`, `twitter`, `reddit`, `instagram`, `youtube`, or `"all"` |
| `query` | No | Search query (keywords, hashtags, etc.) |
| `type` | No | `"search"` for keyword search (default), `"user"` to get content from a specific user |
| `userId` | No | User ID/username (required when `type: "user"`) |
| `limit` | No | Max posts (1-50, default 10) |

**Response** (when `platform: "all"`): Includes `platforms_searched` (array of platform names that returned results) and `platforms_skipped` (array of `{ platform, reason }` for any platform that failed). Graceful degradation ensures results from available platforms are always returned even when some platforms are down.

### `get_content_comments`

Get comments/replies for a specific post.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | `tiktok`, `twitter`, `reddit`, `instagram`, `youtube` |
| `contentId` | Yes | Content ID or URL |
| `limit` | No | Max comments (1-100, default 20) |

### `get_trending_content`

Get currently trending posts from a platform.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | Platform name or `"all"` |
| `limit` | No | Max posts (1-50, default 10) |

### `platform_status`

Check platform availability and connectivity health.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `diagnose` | No | Run full health check with connectivity testing (default: `false`) |

---

## Audience Analysis

Pack: `audience-analysis`

### `analyze_content`

Analyze a post and its comments. Also supports opinion clustering and insight extraction via flags.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | `tiktok`, `twitter`, `reddit`, `instagram`, `youtube` |
| `contentId` | Yes | Content ID |
| `analysisDepth` | No | `surface`, `standard`, `deep`, `comprehensive` (default: `standard`) |
| `enrichment` | No | Add intent detection, stance analysis, engagement scoring (default: false) |
| `question` | No | Analysis context/question (used when `enrichment=true`) |
| `cluster` | No | Run opinion clustering (absorbed from `cluster_opinions`) |
| `clusterCount` | No | Number of clusters (2-15, default 5) |
| `includeExamples` | No | Include example comments per cluster (default: true) |
| `weightByEngagement` | No | Weight by likes/replies (default: true) |
| `extract` | No | Extract categorized insights (absorbed from `extract_insights`) |
| `categories` | No | Insight categories to extract (e.g. `["pain_points", "feature_requests"]`) |

---

## Analysis Engine

Pack: `analysis`

### `run_analysis`

Run an audience analysis on a project. Streams results via SSE.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project UUID |
| `question` | Yes | Research question |
| `platforms` | No | Platforms to search (default: all) |
| `max_results` | No | Max results per platform (default 20) |

### `continue_analysis`

Continue a previous analysis with a follow-up question.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `analysis_id` | Yes | Analysis UUID |
| `question` | Yes | Follow-up question |

### `get_analysis`

Get full results of a completed analysis.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `analysis_id` | Yes | Analysis UUID |

### `list_analyses`

List analyses for a project, newest first.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project UUID |
| `limit` | No | Max results (default 20) |

### `generate_specs`

Generate product specifications from analysis results.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project UUID |
| `analysis_id` | No | Scope to specific analysis |
| `spec_type` | No | `feature_requests`, `user_stories`, `acceptance_criteria`, `all` (default: `all`) |

---

## Crowd Intelligence

Pack: `crowd-intelligence`

### `crowd_research`

Research what the crowd says about a topic, or poll job status. Async -- returns a `job_id` to poll for results.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | No | `"start"` or `"status"` (default: `"start"`) |
| `query` | No | Research question (required for `start`) |
| `platforms` | No | `reddit`, `twitter`, `xiaohongshu`, `web` |
| `depth` | No | `quick` (~30s), `standard` (~90s), `deep` (~120s). Default: `standard`. |
| `context` | No | Business context to enrich analysis (auto-recalled if omitted) |
| `job_id` | No | Job ID to poll (required for `status`) |

---

## Observations & Intelligence

Pack: `observations`

### `submit_observation`

Submit observations from agent conversations. Auto-classified and clustered into themes.

Auth: Accepts user JWT (from `npx @crowdlisten/harness login`) or connector API key (`cl_obs_*`). JWT auth requires `project_id` in the request.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `observations` | Yes | Array of observation objects (1-50) |
| `observations[].content` | Yes | The observation text (1-10000 chars) |
| `observations[].source_platform` | No | Platform: slack, discord, reddit, etc. |
| `observations[].observation_type` | No | `feature_request`, `bug_report`, `pain_point`, `praise`, `question`, `competitive_intel`, `general` |
| `observations[].entity_id` | No | Entity UUID to tag this observation (from `manage_entities`) |
| `observations[].signal_type` | No | `official` (company announcement) or `reception` (audience reaction) |
| `observations[].metadata` | No | Optional metadata (author, channel, thread_id, etc.) |
| `project_id` | No* | Project UUID (*required when using JWT auth, auto-set for connector auth) |

### `manage_entities`

Manage tracked entities (companies, competitors, products). Entities start with `enrichment_status: "pending"` -- use the entity-research skill to enrich them.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `list`, `get`, `update`, `delete`, `add_product`, `link`, `unlink`, `list_project`, `enrich`, `patch_config`, `trigger_research` |
| `entity_id` | No | Entity UUID (for get/update/delete/link/unlink/enrich) |
| `project_id` | No | Project UUID (for link/unlink/list_project) |
| `name` | No | Entity name (for create/add_product) |
| `tags` | No | Freeform tags: `competitor`, `partner`, `ours`, `product`, `market`, etc. |
| `parent_id` | No | Parent entity UUID (for add_product or product hierarchy) |
| `url` | No | Company/product URL (helps enrichment accuracy) |
| `description` | No | What the entity does (1-2 factual sentences) |
| `industry` | No | Industry classification (e.g. `"Cybersecurity"`, `"Developer Tools"`) |
| `enrichment_status` | No | `pending`, `enriching`, `enriched`, `failed` |
| `keywords` | No | Search keywords for social listening (8-15 terms) |
| `platforms` | No | Platforms to track: `reddit`, `twitter`, `youtube`, `tiktok`, etc. |
| `official_channels` | No | Official channels: `{ blog_rss, twitter_handle, youtube_channel }` |
| `config` | No | Entity config JSONB for `patch_config` or `update` |

**Enrichment**: On `create`, the entity starts with `enrichment_status: "pending"`. Use the `entity-research` SKILL.md pack or the `enrich` action to populate `description`, `industry`, `keywords`, and `suggested_tags` via web search. Entity `enrichment_status` can be: `pending`, `enriching`, `enriched`, `failed`.

---

## Standalone Tools

### `setup_connector`

Register a new observation connector for a project. Returns an API key that agents use to submit observations via `submit_observation`. Each connector tracks which agent/bot is writing data.

This tool is not assigned to a specific pack. It is callable when the observations pack is active.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | Yes | Display name for the connector (e.g. `"Slack Bot - #product-feedback"`) |
| `project_id` | Yes | Project UUID to associate observations with |
| `connector_type` | No | `agent`, `native_bot`, or `webhook` (default: `agent`) |
| `platform` | No | Platform the connector operates on (slack, discord, etc.) |

---

## Backward-Compatible Aliases

The following old tool names still work when called by agents but are hidden from `tools/list`. They route to the consolidated tool with appropriate parameter mapping:

| Old Tool Name | Routes To | Parameter Mapping |
|---------------|-----------|-------------------|
| `wiki_write` | `save` | `path`, `title`, `content` passed through |
| `wiki_read` | `recall` | Sets `path` |
| `wiki_list` | `recall` | Sets `list=true`, `prefix` from `path_prefix` |
| `wiki_search` | `recall` | Sets `mode="keyword"`, `query` passed through |
| `wiki_log` | `recall` | Sets `log=true` |
| `wiki_ingest` | `save` | Sets `analysis_id` |
| `ingest_folder` | `save` | Sets `folder` from `path` |
| `get_user_context` | `recall` | Sets `context=true`, `topic` passed through |
| `get_recent_insights` | `recall` | Sets `recent=true`, `days` passed through |
| `get_observation_feed` | `recall` | Sets `observations=true` |
| `get_theme_insights` | `recall` | Sets `themes=true` |
| `cluster_opinions` | `analyze_content` | Sets `cluster=true` |
| `extract_insights` | `analyze_content` | Sets `extract=true` |
| `claim_task` | `list_tasks` | Sets `claim` from `task_id` |
| `execute_task` | `complete_task` | Sets `execute=true` |
| `get_execution_status` | `complete_task` | Sets `status=true` |

---

## Skill Pack Reference

### Tool Packs

| Pack ID | Name | Canonical Tools | Triggers |
|---------|------|-----------------|----------|
| `core` | Core | 5 (always active) | save, remember, recall, knowledge, context, wiki, page, notes, compile, topics |
| `planning` | Planning & Tasks | 4 | plan, task, milestone, roadmap, backlog, kanban, board, execute, decompose, subtasks |
| `social-listening` | Social Listening | 4 | reddit, twitter, tiktok, social, platform, trending, youtube, instagram |
| `audience-analysis` | Audience Analysis | 1 | analysis, sentiment, insight, opinion, audience, cluster, enrich |
| `analysis` | Analysis Engine | 5 | analyze, research, question, spec, requirement, feature |
| `crowd-intelligence` | Crowd Intelligence | 1 | crowd, research, investigate, discover |
| `observations` | Observations | 2 | observation, entity, competitor, track, signal |

### SKILL.md Workflow Packs (17 virtual packs)

These packs contain no tools -- they deliver expert methodology and step-by-step workflow instructions when activated. The agent receives the SKILL.md content as context.

| Pack ID | Description |
|---------|-------------|
| `autopilot-research` | Automated research workflow |
| `competitive-analysis` | Competitive intelligence methodology |
| `content-creator` | Content creation from audience insights |
| `content-strategy` | Content strategy development |
| `context-extraction` | Context extraction from conversations |
| `crowd-research` | Crowd research methodology |
| `crowdlisten` | CrowdListen platform usage guide |
| `data-storytelling` | Data visualization and narrative |
| `entity-research` | Entity enrichment and research |
| `heuristic-evaluation` | UX heuristic evaluation |
| `knowledge-base` | Knowledge management best practices |
| `market-research-reports` | Market research report generation |
| `multi-agent` | Multi-agent coordination patterns |
| `spec-generation` | Product specification generation |
| `task-planning` | Task decomposition and planning |
| `user-stories` | User story creation methodology |
| `ux-researcher` | UX research methodology |
