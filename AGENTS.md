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

You start with **8 tools**. Activate skill packs to unlock more:

```
list_skill_packs()                              → see available packs
activate_skill_pack({ pack_id: "planning" })    → unlocks 11 task tools
activate_skill_pack({ pack_id: "social-listening" }) → unlocks 7 social tools
```

After activation, new tools appear automatically via `tools/list_changed`.

## Always-On Tools (8)

- **list_skill_packs**(include_virtual?) — List all packs with status (active/available), tool counts
- **activate_skill_pack**(pack_id) — Activate a pack to unlock its tools. For SKILL.md packs, returns workflow instructions.
- **save**(title, content, tags?, project_id?, confidence?) — Save context to .md knowledge base. Renders to ~/.crowdlisten/context/.
- **recall**(search?, tags?, project_id?, limit?) — Search saved context via keyword matching. For structured browsing, read ~/.crowdlisten/context/INDEX.md.
- **sync_context**(full?) — Pull all context from cloud and rebuild local .md knowledge base.
- **compile_context**(dry_run?) — Organize knowledge base: detect duplicates, group by topic, rebuild INDEX.md.
- **publish_context**(memory_id, team_id) — Share a memory with your team.
- **set_preferences**(...) — Set user preferences.

## Skill Packs

| Pack | Tools | Description |
|------|-------|-------------|
| **core** (always on) | 8 | .md knowledge base + discovery |
| **planning** | 11 | Tasks, plans, progress tracking |
| **social-listening** | 7 | Search social platforms (free) |
| **audience-analysis** | 6 | AI analysis (CROWDLISTEN_API_KEY) |
| **crowd-intelligence** | 2 | Context-enriched crowd research (CROWDLISTEN_API_KEY) |
| **sessions** | 3 | Multi-agent coordination |
| **setup** | 5 | Board management |
| **spec-delivery** | 3 | Actionable specs from crowd feedback |

Plus: 9 native SKILL.md workflow packs (knowledge-base, competitive-analysis, content-creator, etc.)

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

## Knowledge Base

The knowledge base is a compounding loop: every agent interaction can make it better. Raw saves accumulate, compile organizes them into topics, agents browse the index to find what they need, and research results get filed back. Over time the knowledge base becomes a rich starting point instead of a blank slate.

### How data flows

```
 save()          Supabase              ~/.crowdlisten/context/
───────→  memories table  ──render──→  ├── INDEX.md
                                       ├── entries/a1b2c3d4.md
 recall()        ↑                     └── topics/auth.md
←────────────────┘
                                       compile_context()
 sync_context()                        detects duplicates,
 rebuilds local ←──── full pull ────── groups by topic,
 .md cache                             suggests syntheses
```

1. **Save** — `save({ title, content, tags })` writes to Supabase and renders a `.md` file locally with YAML frontmatter (id, title, tags, source_agent, timestamp).
2. **Recall** — `recall({ search })` queries Supabase via keyword matching. For structured browsing, agents read `~/.crowdlisten/context/INDEX.md` directly. INDEX.md groups entries by tag, lists recent entries, and links to topic summaries.
3. **Sync** — `sync_context()` pulls all entries from cloud and rebuilds the entire local `.md` folder. Use after web uploads or switching machines.
4. **Compile** — `compile_context()` scans all entries, detects near-duplicates (Jaccard similarity), identifies topics with 3+ entries, and rebuilds `INDEX.md`. Returns a report telling the agent what to synthesize or prune.
5. **Publish** — `publish_context({ memory_id, team_id })` shares an entry with teammates. Their next `sync_context` pulls it into a `## Shared` section in their INDEX.md.

### The compounding effect

After every analysis or research task, the agent saves 2-3 key insights. Over time, `compile_context` groups these into topics. The agent synthesizes topics into distilled summaries. The next agent (or the same agent in a new session) starts with a rich INDEX.md instead of a blank slate. Each cycle makes the knowledge base more useful.

Supabase is the source of truth. The local `.md` folder is a read-only rendered cache. No sync conflicts, no merge issues.

### Tag vocabulary

Use consistent tags so compile can group effectively: `decision`, `pattern`, `insight`, `preference`, `learning`, `principle`, `synthesis`.

### When to compile

- After accumulating 20+ new entries
- Before starting a new project or research area
- Periodically (weekly) to keep the index fresh

## Core Workflow

```
list_skill_packs → activate_skill_pack("planning")
→ list_tasks → claim_task → recall → create_plan
→ [human review] → execute → save → complete_task
```

## Privacy

- PII redacted locally before LLM calls
- Context stored in Supabase with row-level security + local .md cache at ~/.crowdlisten/context/
- User's own API keys for extraction
- No data syncs without explicit user action
- Agent-proxied tools go through `agent.crowdlisten.com` with your API key
