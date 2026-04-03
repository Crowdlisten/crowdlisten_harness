# CrowdListen — Agent Reference

Unified MCP server for AI agents. Planning, social listening, skill packs, and knowledge management with progressive disclosure.

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
| MCP stdio | `npx @crowdlisten/harness` — ~41 tools | Local agents |
| MCP HTTP | `POST https://mcp.crowdlisten.com/mcp` | Remote agents, cloud |
| REST | `POST https://mcp.crowdlisten.com/tools/{name}` | Non-MCP integrations |
| OpenAPI | `GET https://mcp.crowdlisten.com/openapi.json` | Docs, code gen |
| CLI | `npx @crowdlisten/harness login/setup/serve/openapi` | Auth, config, hosting |
| Web UI | `npx @crowdlisten/harness context` → localhost:3847 | Visual context extraction |

## Progressive Disclosure

You start with **4 tools**. Activate skill packs to unlock more:

```
list_skill_packs()                              → see available packs
activate_skill_pack({ pack_id: "planning" })    → unlocks 11 task tools
activate_skill_pack({ pack_id: "social-listening" }) → unlocks 7 social tools
```

After activation, new tools appear automatically via `tools/list_changed`.

## Always-On Tools (4)

- **list_skill_packs**(include_virtual?) — List all packs with status (active/available), tool counts
- **activate_skill_pack**(pack_id) — Activate a pack to unlock its tools. For SKILL.md packs, returns workflow instructions.
- **remember**(type, title, content) — Save context across sessions. Types: preference, decision, pattern, insight, style
- **recall**(type?, search?, limit?) — Retrieve saved context blocks

## Skill Packs

| Pack | Tools | Description |
|------|-------|-------------|
| **core** (always on) | 4 | Discovery + memory |
| **planning** | 11 | Tasks, plans, progress tracking |
| **knowledge** | 3 | Project knowledge base |
| **social-listening** | 7 | Search social platforms (free) |
| **audience-analysis** | 6 | AI analysis (CROWDLISTEN_API_KEY) |
| **crowd-intelligence** | 2 | Context-enriched crowd research (CROWDLISTEN_API_KEY) |
| **sessions** | 3 | Multi-agent coordination |
| **setup** | 5 | Board management |
| **legacy** | 6 | Previous-gen context extraction |

Plus: 8 native SKILL.md workflow packs (competitive-analysis, content-creator, etc.)

## Planning Pack (11 tools)

- **list_tasks**(board_id?, status?, limit?) — List board tasks
- **get_task**(task_id) — Full task details
- **create_task**(title, description?, priority?) — Create task
- **update_task**(task_id, ...) — Update task fields
- **claim_task**(task_id, executor?, branch?) — Start work, get context
- **complete_task**(task_id, summary?) — Mark done
- **delete_task**(task_id) — Remove task
- **log_progress**(task_id, message) — Track execution
- **create_plan**(task_id, approach, ...) — Draft execution plan
- **get_plan**(task_id) — View plan with history
- **update_plan**(plan_id, ...) — Iterate, submit for review

## Knowledge Pack (3 tools)

- **query_context**(search?, type?, tags?) — Search decisions, patterns, learnings
- **add_context**(type, title, body, ...) — Write to knowledge base
- **record_learning**(task_id, title, body, promote?) — Capture learning

## Social Listening Pack (7 tools, free)

- **search_content**(platform, query, limit?) — Search posts across platforms
- **get_content_comments**(platform, contentId, limit?) — Get comments/replies
- **get_trending_content**(platform, limit?) — Trending posts
- **get_user_content**(platform, userId, limit?) — User's recent posts
- **get_platform_status**() — Available platforms + capabilities
- **health_check**() — Platform connectivity status
- **extract_url**(url, mode?, limit?) — Vision extraction from any URL

Platforms: reddit, twitter, tiktok, instagram, youtube, moltbook

## Audience Analysis Pack (6 tools, CROWDLISTEN_API_KEY)

- **analyze_content**(platform, contentId, analysisDepth?) — Sentiment, themes, tensions
- **cluster_opinions**(platform, contentId, clusterCount?) — Opinion clustering
- **enrich_content**(platform, contentId, question?) — Intent/stance analysis
- **deep_analyze**(platform, contentId, analysisDepth?) — Full audience intelligence
- **extract_insights**(platform, contentId, categories?) — Pain points, feature requests
- **research_synthesis**(query, platforms?, depth?) — Cross-platform research

## Crowd Intelligence Pack (2 tools) — requires CROWDLISTEN_API_KEY

Activate: `activate_skill_pack({ pack_id: "crowd-intelligence" })`

| Tool | Description |
|------|-------------|
| `crowd_research` | Submit async crowd research. Returns job_id. |
| `crowd_research_status` | Poll job status. Returns full analysis when complete. |

**Usage pattern:**
1. `crowd_research({ query: "...", platforms: ["reddit", "twitter"] })`
2. Wait 10s, then poll: `crowd_research_status({ job_id: "..." })`
3. Repeat until status is "complete"

**Platforms:** reddit, twitter, moltbook, xiaohongshu, web (Exa search)
**Depth:** quick (~30s), standard (~90s), deep (~120s)
**Context:** Auto-recalls your saved business context. Override with `context` param.

### Crowd Intelligence Example

```
Agent: activate_skill_pack({ pack_id: "crowd-intelligence" })
Agent: crowd_research({ query: "What do users think about AI code editors?", platforms: ["reddit", "twitter"], depth: "standard" })
→ { status: "running", job_id: "abc-123", estimated_seconds: 60 }

[wait 10 seconds]

Agent: crowd_research_status({ job_id: "abc-123" })
→ { status: "running", message: "Analysis still running..." }

[wait 10 seconds]

Agent: crowd_research_status({ job_id: "abc-123" })
→ { status: "complete", takeaway: "...", themes: [...], sentiment: {...} }
```

## Analysis (5 tools) — requires CROWDLISTEN_API_KEY

- **run_analysis**(project_id, question, platforms?, max_results?) — Run audience analysis across Reddit, YouTube, TikTok, Twitter, Instagram, Xiaohongshu. Streams results.
- **continue_analysis**(analysis_id, question) — Follow-up question on existing analysis.
- **get_analysis**(analysis_id) — Get full analysis results with themes, sentiment, quotes.
- **list_analyses**(project_id, limit?) — List analyses for a project.
- **generate_specs**(project_id, analysis_id?, spec_type?) — Generate feature requests, user stories, acceptance criteria from analysis.

## Content & Vectors (4 tools) — requires CROWDLISTEN_API_KEY

- **ingest_content**(project_id, content, source_url?, title?, metadata?) — Ingest content into vector store.
- **search_vectors**(project_id, query, limit?, threshold?) — Semantic search across ingested content.
- **get_content_stats**(project_id) — Document count, chunks, storage usage.
- **delete_content**(content_id) — Delete content document and embeddings.

## Document Generation (2 tools) — requires CROWDLISTEN_API_KEY

- **generate_prd**(project_id, analysis_ids?, template?, sections?) — Generate PRD from analysis. Templates: standard, lean, technical, marketing.
- **update_prd_section**(document_id, section, instructions?, content?) — Update a specific PRD section.

## Sessions (3 tools) — Parallel Agents

- **start_session**(task_id, executor?, focus) — Start additional parallel session.
- **list_sessions**(task_id, status?) — List sessions showing status and focus.
- **update_session**(session_id, status?, focus?) — Update session: idle, running, completed, failed, stopped.

## LLM Proxy (2 tools) — free, no API key

- **llm_complete**(prompt, model?, max_tokens?, temperature?, system?) — LLM completion through CrowdListen. Default: gpt-4o-mini.
- **list_llm_models**() — List available models and capabilities.

## Agent Network (3 tools) — mixed auth

- **register_agent**(name, capabilities?, executor?) — Register in agent network. Free.
- **get_capabilities**() — List network capabilities. Free.
- **submit_analysis**(agent_id, analysis_id, summary) — Share analysis results. Requires API key.

## Core Workflow

```
list_skill_packs → activate_skill_pack("planning")
→ list_tasks → claim_task → query_context → create_plan
→ [human review] → execute → record_learning → complete_task
```

## Privacy

- PII redacted locally before LLM calls
- Context stored locally (~/.crowdlisten/)
- User's own API keys for extraction
- No data syncs without explicit user action
- Agent-proxied tools go through `agent.crowdlisten.com` with your API key
