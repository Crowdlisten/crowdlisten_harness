# Changelog

All notable changes to the CrowdListen Harness.

## [Unreleased] - 2026-04-09

### Added
- **Observations skill pack**: New `observations` pack with 3 canonical tools for the observation intelligence pipeline
- **`submit_observation`** agent tool: Proxies to `POST /api/observations/submit` for agents to submit conversation observations
- **`setup_connector`** tool: Register a new observation connector via `POST /api/connectors`, returns API key for agent integration
- **`manage_entities`** tool: Moved to observations pack — CRUD for tracked entities with project linking and entity-aware observation tracking
- **`recall` observation modes**: Observation feed and theme intelligence are accessible via `recall` — pass `observations: true` (proxies to `GET /api/observations/feed`) or `themes: true` (proxies to `GET /api/observations/themes`). Backward-compatible aliases `get_observation_feed` and `get_theme_insights` route to `recall` with these flags set.

## [2.2.0] - 2026-04-08

### Added
- **Insight Compiler pack**: `get_user_context` and `get_recent_insights` tools for querying synthesized user feedback themes, severity, evidence, and trends from connected channels
- **Token-based login**: `login --token <access> <refresh>` for sandboxed environments (Codex, CI) where browser auth is unavailable
- **Environment variable auth**: `CROWDLISTEN_ACCESS_TOKEN` and `CROWDLISTEN_REFRESH_TOKEN` env vars as login fallback in `getAuthedClient()`

### Fixed
- **Codex TOML config**: `autoInstallMcp()` now shells out to `codex mcp add` instead of parsing JSON at `~/.codex/config.json` (Codex uses TOML)
- **Bin file permissions**: Added `postbuild` and `prepublishOnly` scripts to `chmod +x` dist bin files so `npx` execution works after `tsc` compile

## [2.1.0] - 2026-04-07

### Added
- **Unified `pages` table**: All knowledge (wiki pages, memories, ingested files) now stored in a single `pages` table with path-based identity (`UNIQUE(user_id, path)`)
- **`watch` command**: `npx @crowdlisten/harness watch ~/folder` — auto-syncs local folder to `pages` table with 500ms debounce and content hashing (MD5) for idempotent updates
- **`sync` command**: `npx @crowdlisten/harness sync ~/folder` — one-shot folder sync
- **Semantic recall**: `recall` tool now uses pgvector cosine similarity search with keyword fallback
- **Path-based organization**: Pages use filesystem-like paths (`notes/`, `projects/{slug}/`, `documents/`, `decisions/`)

### Changed
- `save` tool writes to `pages` table instead of dual-writing to `memories` and `wiki_pages`
- `recall` tool uses single code path (search `pages`) instead of branching between memories/wiki
- `ingest_folder` writes to `pages` with path = `documents/{relative-file-path}`
- `wiki_list`, `wiki_read`, `wiki_write`, `wiki_search`, `wiki_log`, `wiki_ingest` all target `pages` table
- `project_id` is now optional on all wiki tools — pages belong to users, not projects
- Knowledge base diagram in README updated to reflect unified architecture

### Fixed
- Missing `recall` tool definition added to core pack in registry
- TypeScript build errors with `embedResult` type casting
- `is_published` flag correctly set on wiki_write operations

## [2.0.0] - 2026-04-05

### Changed
- **CLI-First Architecture Rethink**: Consolidated ~45+ tools to 28 tools across 6 packs
- Merged 8 tool pairs: `skills` (list+activate), `save` (with publish), `list_tasks` (with task_id), `complete_task` (with progress), `search_content` (with type:user), `platform_status` (with diagnose), `analyze_content` (with enrichment), `crowd_research` (with action:start/status)
- Created 3 new SKILL.md workflow packs: multi-agent, spec-generation, context-extraction
- Removed 4 packs: sessions, setup, spec-delivery, agent-network
- De-emphasized remote MCP in landing page, added Gemini CLI to hero

### Removed
- Free/paid tier distinction — all tools now use uniform auth via `npx @crowdlisten/harness login`
- `create_board`, `list_boards`, `research_synthesis` (redundant tools)
- `discover_skills` (merged into `search_skills`), `compile_context` (merged into `sync_context`), `deep_analyze` (removed)
- 12 additional tools: `promote_insight`, `batch_promote_insights`, `get_pending_insights`, `submit_analysis`, `ingest_content`, `search_vectors`, `get_content_stats`, `delete_content`, `generate_prd`, `update_prd_section`, `llm_complete`, `list_llm_models`
- Packs deleted: content, generation, llm, insight-pipeline

## [1.x] - 2026-04-02

### Added
- Unified memory system: `save` and `recall` tools with pgvector semantic search
- Agent `/embed` endpoint for generating embeddings without requiring OpenAI key in harness
- Dual-write to `project_insights` for frontend project board integration

### Removed
- 7 legacy tools replaced by `save`/`recall`: `remember`, `recall` (old), `add_context`, `query_context`, `record_learning`, `log_learning`, `search_learnings`
- Knowledge pack (absorbed into core pack)
