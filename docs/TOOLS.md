# Tools Reference

Technical reference for all CrowdListen Harness MCP tools (21 canonical tools across 7 packs plus SKILL.md workflow packs). Organized by feature. Each tool lists its parameters, return shape, and code path.

**Consolidated tool surface (v3.0)**: 16 tools were absorbed into 5 expanded tools (`save`, `recall`, `analyze_content`, `list_tasks`, `complete_task`). Old tool names still work as backward-compatible aliases but are hidden from `tools/list`.

**Skill pack system**: Tools are grouped into packs. Only the `core` pack is always active (3 tools). Call `skills({ action: "list" })` then `skills({ action: "activate", pack_id: "..." })` to unlock others. After activation, new tools appear instantly via `tools/list_changed`.

**Auth model**: All tools authenticate via Supabase session token stored at `~/.crowdlisten/auth.json`. Sign in with `npx @crowdlisten/harness login`.

---

## Canonical Tool Summary (21 tools)

| Pack | Tools | Count |
|------|-------|-------|
| Core (always active) | `skills`, `save`, `recall` | 3 |
| Planning & Tasks | `list_tasks`, `create_task`, `complete_task` | 3 |
| Social Listening | `search_content`, `get_content_comments`, `get_trending_content`, `platform_status`, `extract_url` | 5 |
| Audience Analysis | `analyze_content` | 1 |
| Analysis Engine | `run_analysis`, `continue_analysis`, `get_analysis`, `list_analyses`, `generate_specs` | 5 |
| Crowd Intelligence | `crowd_research` | 1 |
| Observations | `submit_observation`, `setup_connector`, `manage_entities` | 3 |

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
| `tags` | No | Freeform tags |
| `project_id` | No | Project scope |
| `task_id` | No | Task association |
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
| `project_id` | No | Project scope filter |
| `tags` | No | Tag filter |
| `limit` | No | Max results (default: 20) |

**Routing logic**: `path` -> read page. `list` -> list pages. `log` -> activity log. `mode=keyword` -> keyword search. `recent` -> recent insights. `context` -> user context. `observations` -> observation feed. `themes` -> clustered themes. Default -> semantic search.

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
| `labels` | No | Array of `{ name, color }` objects |

### `complete_task`

Mark task done, log progress, execute via agent, or check execution status.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Card/task UUID |
| `summary` | No | Completion summary |
| `progress` | No | Log progress note without completing |
| `execute` | No | Execute task via agent (absorbed from `execute_task`) |
| `session_id` | No | Session UUID for execution |
| `prompt` | No | Execution prompt for agent |
| `executor` | No | Agent type: `CLAUDE_CODE`, `CODEX`, `GEMINI_CLI`, `AMP` |
| `status` | No | Check execution status (absorbed from `get_execution_status`) |
| `process_id` | No | Process ID to check status for |

---

## Social Listening

Pack: `social-listening`

### `search_content`

Search for posts and discussions across social platforms. Pass `type: "user"` with `userId` for user content.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | Platform name or `"all"` |
| `query` | Yes | Search query |
| `limit` | No | Max posts (1-50, default 10) |
| `type` | No | `"user"` for user content mode |
| `userId` | No | User ID/username (required when `type: "user"`) |
| `useVision` | No | Force vision extraction |

### `get_content_comments`

Get comments/replies for a specific post.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | Platform name |
| `contentId` | Yes | Content ID or URL |
| `limit` | No | Max comments (1-100, default 20) |
| `useVision` | No | Force vision extraction |

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
| `diagnose` | No | Run full health check (default: `false`) |

### `extract_url`

Extract content from any URL using vision (screenshot + LLM analysis).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to extract from |
| `mode` | No | `posts`, `comments`, `raw` (default: `posts`) |
| `limit` | No | Max items (1-50, default 10) |

---

## Audience Analysis

Pack: `audience-analysis`

### `analyze_content`

Analyze a post and its comments. Also supports opinion clustering and insight extraction via flags.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `platform` | Yes | Platform name |
| `contentId` | Yes | Content ID |
| `analysisDepth` | No | `surface`, `standard`, `deep`, `comprehensive` |
| `enrichment` | No | Add intent detection, stance analysis |
| `question` | No | Analysis context/question |
| `cluster` | No | Run opinion clustering (absorbed from `cluster_opinions`) |
| `clusterCount` | No | Number of clusters (2-15, default 5) |
| `includeExamples` | No | Include example comments per cluster |
| `weightByEngagement` | No | Weight by likes/replies |
| `extract` | No | Extract categorized insights (absorbed from `extract_insights`) |
| `categories` | No | Insight categories to extract |

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
| `spec_type` | No | `feature_requests`, `user_stories`, `acceptance_criteria`, `all` |

---

## Crowd Intelligence

Pack: `crowd-intelligence`

### `crowd_research`

Research what the crowd says about a topic, or poll job status.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | No | `"start"` or `"status"` (default: `"start"`) |
| `query` | No | Research question (required for `start`) |
| `platforms` | No | `reddit`, `twitter`, `moltbook`, `xiaohongshu`, `web` |
| `depth` | No | `quick`, `standard`, `deep` |
| `context` | No | Business context (auto-recalled if omitted) |
| `job_id` | No | Job ID to poll (required for `status`) |

---

## Observations & Intelligence

Pack: `observations`

### `submit_observation`

Submit observations from agent conversations. Auto-classified and clustered.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `observations` | Yes | Array of `{ content, source_platform?, observation_type?, metadata? }` (1-50) |

### `setup_connector`

Register a connector and receive an API key for submitting observations.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | Yes | Connector name |
| `project_id` | Yes | Project UUID |
| `connector_type` | No | `agent`, `native_bot`, `webhook` (default: `agent`) |
| `platform` | No | Platform the connector operates on |

### `manage_entities`

Manage tracked entities (companies, competitors, products).

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create`, `list`, `get`, `update`, `delete`, `add_product`, `link`, `unlink`, `list_project`, `patch_config`, `trigger_research` |
| `entity_id` | No | Entity UUID (for get/update/delete/link/unlink) |
| `project_id` | No | Project UUID (for link/unlink/list_project) |
| `name` | No | Entity name (for create/add_product) |
| `type` | No | `own_company`, `competitor`, `product` (for create) |
| *(see full schema in code)* | | |

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

| Pack ID | Name | Canonical Tools | Triggers |
|---------|------|-----------------|----------|
| `core` | Core | 3 (always active) | save, remember, recall, knowledge, context, wiki |
| `planning` | Planning & Tasks | 3 | plan, task, milestone, roadmap, backlog |
| `social-listening` | Social Listening | 5 | reddit, twitter, tiktok, social, platform, trending |
| `audience-analysis` | Audience Analysis | 1 | analysis, sentiment, insight, opinion, cluster |
| `analysis` | Analysis Engine | 5 | analyze, research, question, spec, requirement |
| `crowd-intelligence` | Crowd Intelligence | 1 | crowd, research, investigate |
| `observations` | Observations | 3 | observation, connector, entity, competitor, track |
| *(virtual)* | SKILL.md workflow packs | 0 (content only) | -- |
