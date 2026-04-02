# CrowdListen

> CrowdListen gives AI agents crowd context — analyzed intelligence from what real users say, what markets think, and what communities want. Not just session recall. Analyzed, clustered, decision-ready.

[English](README.md) | [中文文档](README-CN.md)

## The Problem

AI agents have session memory. They don't have crowd context. Every new session starts from scratch — no awareness of what your audience is actually saying online, no analyzed signal from the seven platforms where users talk about your product. You end up re-explaining context, manually copy-pasting feedback from Reddit, and watching your agent make decisions without the one input that matters most: what real people think.

CrowdListen gives your agent a crowd context — a loop from listening to analysis to recall:

1. **Listen** — search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, forums. Get structured data your agent can reason about. (`search_content`)
2. **Analyze** — cluster opinions by theme, extract pain points and feature requests, synthesize cross-platform reports with confidence scores. (`cluster_opinions`, `extract_insights`, `research_synthesis`)
3. **Remember** — save analyzed crowd intelligence with semantic embeddings. Not raw posts — analyzed, categorized, decision-ready insights. (`save`)
4. **Recall** — any agent retrieves crowd context via natural language query, across sessions, agents, and devices. Ask "what do users think about our onboarding?" and get back clustered opinions with evidence. (`recall`)

The analysis pipeline — clustering, theme extraction, deduplication, confidence scoring — is what makes this crowd *context*, not just crowd *data*. Your agent gets analyzed intelligence, not a firehose of posts.

Your agent starts with 5 core tools (including semantic memory). It activates skill packs on demand — social listening, audience analysis, planning, spec delivery — and only loads the tools it actually needs for the current task.

## Crowd Context

Most agent memory systems store what the agent did. CrowdListen stores what the *crowd* thinks — analyzed and ready for retrieval.

Here's the loop with existing tools:

```
1. search_content("cursor vs claude code", platform: "reddit")
   → 20 posts with engagement metrics

2. cluster_opinions(content_ids)
   → 4 opinion clusters: "Cursor better for refactoring" (38%), "Claude Code better for greenfield" (31%), ...

3. extract_insights(content_ids)
   → Pain points, feature requests, praise — categorized with confidence scores

4. save({ title: "Developer tool preferences Q2 2026", content: <analyzed clusters>, tags: ["competitive-intel", "dev-tools"] })
   → Stored with semantic embedding in pgvector

5. recall({ search: "what do developers think about our product vs competitors?" })
   → Returns analyzed clusters from step 4, ranked by semantic similarity
```

Any agent — Claude Code, Cursor, Gemini CLI, Codex — can `recall` these crowd memories later. The intelligence compounds across sessions and across agents. That's crowd context.

## Try It Now

One command. Your browser opens, you sign in, and your agents are configured automatically:

```bash
npx @crowdlisten/planner login
```

This auto-configures MCP for Claude Code, Cursor, Gemini CLI, Codex, Amp, and OpenClaw. No env vars, no JSON editing, no API keys to manage.

Restart your agent after login, and it can start calling tools immediately.

### Manual Setup (stdio)

Add this to your agent's MCP config:

```json
{
  "mcpServers": {
    "crowdlisten": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/planner"]
    }
  }
}
```

### Remote Setup (Streamable HTTP)

```json
{
  "mcpServers": {
    "crowdlisten": {
      "url": "https://mcp.crowdlisten.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Or self-host:

```bash
npx @crowdlisten/planner serve          # Starts on :3848
curl http://localhost:3848/health        # Health check
curl http://localhost:3848/openapi.json  # OpenAPI spec
```

## How It Works

### Progressive Skill Disclosure

Your agent starts with 5 always-on tools:

```
save({ title: "...", content: "...", tags: [...] })   → save context with semantic embedding
recall({ search: "natural language query" })           → find relevant memories by meaning
list_skill_packs()                                    → see available packs
activate_skill_pack({ pack_id: "planning" })          → unlocks 11 task tools
set_preferences({ ... })                              → configure agent behavior
```

After activation, new tools appear automatically via `tools/list_changed`. No restarts needed.

### Skill Packs

| Pack | Tools | Description | Auth |
|------|-------|-------------|------|
| **core** (always on) | 5 | Discovery + semantic memory | Free |
| **planning** | 11 | Tasks, plans, progress tracking | Free |
| **social-listening** | 7 | Search social platforms | Free |
| **audience-analysis** | 6 | AI-powered analysis | API key |
| **spec-delivery** | 3 | Actionable specs from crowd feedback | Free |
| **sessions** | 3 | Multi-agent coordination | Free |
| **setup** | 5 | Board management | Free |
| **analysis** | 5 | Run analyses, continue, list, generate specs | API key |
| **content** | 4 | Ingest content, vector search, stats | API key |
| **generation** | 2 | PRD generation, section updates | API key |
| **llm** | 2 | Free LLM completion proxy | Free |
| **agent-network** | 3 | Register agents, discover capabilities | Mixed |
| **legacy** | 6 | Previous-gen context extraction tools | Free |

Plus 8 **SKILL.md workflow packs** (competitive-analysis, content-creator, content-strategy, data-storytelling, heuristic-evaluation, market-research-reports, user-stories, ux-researcher) that deliver full methodology instructions when activated — no tools, just expert prompts.

## What You Can Do

### Semantic Memory Across Sessions

Your agent saves context with `save` and retrieves it with `recall`. What makes this different: recall uses semantic search, not keyword matching. Ask "how should we handle login security?" and it finds your earlier note about JWT tokens — even though the words don't overlap.

```
save({ title: "Auth approach", content: "Use JWT with refresh tokens", tags: ["decision", "auth"] })

recall({ search: "how should we handle login security?" })
→ [{ title: "Auth approach", content: "Use JWT with refresh tokens", similarity: 0.89 }]
```

Tag memories however you want — `["decision"]`, `["auth", "backend"]`, `["preference"]` — no fixed categories. Filter by tags or project on recall. Memories persist in Supabase with pgvector embeddings, so they follow you across agents (Claude Code → Cursor → Gemini CLI) and across devices.

If the embedding API is unavailable, recall falls back to keyword matching. If Supabase is down, it falls back to local storage. Saving never fails.

### Plan and Track Work

Your agent calls `list_tasks` to see what's available, `claim_task` to start work, and `create_plan` to draft an approach with assumptions and risks. You review the plan, leave feedback, the agent iterates. Decisions and learnings are saved via `save` with relevant tags, so future tasks can `recall` them.

### Search Social Platforms

Search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, and Moltbook from one tool. Get back structured posts with engagement metrics, timestamps, and author info — same format regardless of platform.

```bash
# Also works as a CLI
npx crowdlisten search reddit "cursor vs claude code" --limit 5
npx crowdlisten vision https://news.ycombinator.com
```

### Extract From Any Website

Vision mode takes a screenshot of any URL, sends it to an LLM (Claude, Gemini, or OpenAI), and returns structured data. Forum without an API? News site with paywalled comments? Just point `extract_url` at it.

### Analyze Audience Signal

The paid API layer adds opinion clustering, deep analysis (audience segments, competitive signals), and research synthesis (cross-platform reports from a single query). Core extraction is free and open source.

### Get Actionable Specs from Crowd Feedback

The full pipeline: crowd feedback channels are analyzed, insights extracted, and specs generated automatically. Your coding agent activates the `spec-delivery` pack and browses specs that are ready to implement — each with evidence from real user feedback, acceptance criteria, and a confidence score.

```
activate_skill_pack({ pack_id: "spec-delivery" })

get_specs({ priority: "high", min_confidence: 0.8 })
→ returns specs with title, type, priority, confidence

get_spec_detail({ spec_id: "..." })
→ formatted markdown: objective, evidence citations, acceptance criteria checklist

start_spec({ spec_id: "..." })
→ creates kanban task, claims it, sets up workspace + branch, returns context
```

`start_spec` composes the existing task management flow internally — it creates a task from the spec, moves it to In Progress, generates a branch name, and returns everything the agent needs to begin coding. No manual setup required.

## End-to-End Walkthrough

Here's what happens when you use CrowdListen from scratch, step by step.

### Step 1: Login and Auto-Configure

```bash
npx @crowdlisten/planner login
```

Your browser opens → you sign in with Google/GitHub → the CLI auto-configures MCP for your agents (Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw). Restart your agent.

### Step 2: Your Agent Discovers Tools

On startup, your agent sees **5 core tools** — nothing else:

```
list_skill_packs          → see available packs
activate_skill_pack       → unlock a pack's tools
save                      → save context with semantic embedding
recall                    → semantic similarity search across memories
set_preferences           → configure telemetry, auto-activate, etc.
```

This is progressive disclosure. Your agent's tool context stays small until it needs more.

### Step 3: Browse and Activate Packs

Your agent calls `list_skill_packs` and sees:

```
✓ active   | core                    |  5 tools | Discovery + semantic memory
  available | planning                | 11 tools | Tasks, plans, progress
  available | social-listening        |  7 tools | Search Reddit, TikTok, YouTube...
  available | analysis                |  5 tools | Run audience analyses (paid)
  available | llm                     |  2 tools | Free LLM completion proxy
  ... 16 more packs
```

To unlock planning tools:

```
activate_skill_pack({ pack_id: "planning" })
→ { "activated": "planning", "newToolCount": 11 }
→ tools/list_changed notification fires
→ Agent now sees 16 tools (5 core + 11 planning)
```

No restart needed — the agent picks up new tools via `tools/list_changed`.

### Step 4: Use the Tools

**Create and manage tasks:**

```
create_task({ title: "Implement user auth", priority: "high" })
→ { "task_id": "dcb80a64-...", "status": "created" }

list_tasks()
→ [{ "id": "dcb80a64-...", "title": "Implement user auth", "status": "To Do", ... }]

claim_task({ task_id: "dcb80a64-..." })
→ { "status": "claimed", "workspace": "...", "branch": "feature/implement-user-auth" }
```

**Save and recall context (semantic search — see above):**

```
save({ title: "Test framework", content: "Use Vitest, not Jest", tags: ["preference"] })
recall({ search: "which testing library?" })
→ [{ "title": "Test framework", "content": "Use Vitest, not Jest", "similarity": 0.91 }]
```

**Search social platforms (after activating social-listening):**

```
activate_skill_pack({ pack_id: "social-listening" })

search_content({ platform: "reddit", query: "cursor vs claude code", limit: 5 })
→ [{ "title": "...", "content": "...", "upvotes": 847, "comments": 234, ... }]
```

### Step 5: Remote Access (HTTP Transport)

For remote agents or multi-tenant setups:

```bash
npx @crowdlisten/planner serve          # Starts on :3848
```

All 54 tools are available via HTTP:

```bash
# Health check
curl http://localhost:3848/health
→ { "status": "ok", "version": "0.6.0", "tools": 54 }

# OpenAPI spec (55 paths, 11 tags)
curl http://localhost:3848/openapi.json

# MCP tool calls (requires auth)
curl -X POST http://localhost:3848/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'
```

Connect any MCP client:

```json
{ "url": "http://localhost:3848/mcp", "headers": { "Authorization": "Bearer YOUR_TOKEN" } }
```

### Step 6: Full Pipeline (Crowd Feedback → Implementation)

The end-to-end pipeline for turning audience signal into code:

```
1. activate_skill_pack("social-listening")
2. search_content({ platform: "reddit", query: "your product name" })
3. activate_skill_pack("audience-analysis")
4. deep_analyze({ content_ids: [...] })               → segments, pain points, signals
5. activate_skill_pack("spec-delivery")
6. get_specs({ priority: "high", min_confidence: 0.8 }) → actionable specs
7. start_spec({ spec_id: "..." })                      → creates task, branch, workspace
8. activate_skill_pack("planning")
9. claim_task({ task_id: "..." })                      → start implementing
```

Each spec carries evidence citations from real user feedback, a confidence score, and acceptance criteria.

## MCP Tools Reference

### Always-On (5 tools)

| Tool | What it does |
|------|-------------|
| `list_skill_packs` | List available packs with status, tool counts |
| `activate_skill_pack` | Activate a pack to unlock its tools |
| `save` | Save context with freeform tags; auto-generates semantic embedding for recall |
| `recall` | Semantic similarity search across all saved memories; keyword fallback if embedding API is unavailable |
| `set_preferences` | Configure telemetry, proactive suggestions, cross-project learnings |

### Planning Pack (11 tools)

| Tool | What it does |
|------|-------------|
| `list_tasks` | List board tasks |
| `get_task` | Full task details |
| `create_task` | Create a new task |
| `update_task` | Change title, description, status, priority |
| `claim_task` | Start work — returns context, workspace, branch |
| `complete_task` | Mark done, auto-complete plan |
| `delete_task` | Permanently remove a task |
| `log_progress` | Log a note to the execution session |
| `create_plan` | Create execution plan (approach, assumptions, risks) |
| `get_plan` | Get plan with version history and feedback |
| `update_plan` | Iterate: update approach, status, or add feedback |

### Social Listening Pack (7 tools, free)

| Tool | What it does |
|------|-------------|
| `search_content` | Search posts across platforms. Supports `useVision` flag. |
| `get_content_comments` | Get comments/replies for a specific post |
| `get_trending_content` | Currently trending posts from a platform |
| `get_user_content` | Recent posts from a specific user |
| `extract_url` | Vision extraction — screenshot any URL, get structured data |
| `get_platform_status` | Which platforms are available and their capabilities |
| `health_check` | Platform connectivity check |

Platforms: reddit, twitter, tiktok, instagram, youtube, xiaohongshu, moltbook

### Audience Analysis Pack (6 tools, requires CROWDLISTEN_API_KEY)

| Tool | What it does |
|------|-------------|
| `analyze_content` | Sentiment + theme analysis on a post and its comments |
| `cluster_opinions` | Group comments into semantic opinion clusters |
| `enrich_content` | Intent detection, stance analysis, engagement scoring |
| `deep_analyze` | Full audience intelligence: segments, pain points, competitive signals |
| `extract_insights` | Categorized insight extraction (pain points, feature requests, praise) |
| `research_synthesis` | Cross-platform research report from a single query |

### Spec Delivery Pack (3 tools)

| Tool | What it does |
|------|-------------|
| `get_specs` | List actionable specs — filter by status, type, priority, min_confidence, project_id |
| `get_spec_detail` | Full spec with formatted evidence citations and acceptance criteria checklist |
| `start_spec` | Claim a spec, create kanban task, set up workspace + branch, return agent context |

Spec statuses: `pending` (ready to start), `claimed` (agent working), `in_progress`, `completed`, `rejected`

Spec types: `feature`, `bug_fix`, `improvement`, `investigation`

### Agent-Proxied Packs

These tools proxy to the CrowdListen compute backend. Free tools require no API key. Paid tools require `CROWDLISTEN_API_KEY`.

#### Analysis (5 tools, paid)

| Tool | What it does |
|------|-------------|
| `run_analysis` | Run a full audience analysis (SSE streaming) |
| `continue_analysis` | Continue an existing analysis with follow-up questions |
| `get_analysis` | Retrieve analysis results by ID |
| `list_analyses` | List analyses for a project |
| `generate_specs` | Generate implementation specs from analysis results |

#### Content & Vectors (4 tools, paid)

| Tool | What it does |
|------|-------------|
| `ingest_content` | Ingest content for vector storage |
| `search_vectors` | Semantic vector search across ingested content |
| `get_content_stats` | Content ingestion statistics |
| `delete_content` | Remove ingested content |

#### Document Generation (2 tools, paid)

| Tool | What it does |
|------|-------------|
| `generate_prd` | Generate a PRD from analysis results (SSE streaming) |
| `update_prd_section` | Update a specific section of a PRD |

#### LLM Proxy (2 tools, free)

| Tool | What it does |
|------|-------------|
| `llm_complete` | LLM completion — no API key required |
| `list_llm_models` | List available LLM models |

#### Agent Network (3 tools, free/mixed)

| Tool | What it does |
|------|-------------|
| `register_agent` | Register an agent in the network (free) |
| `get_capabilities` | List network agent capabilities (free) |
| `submit_analysis` | Submit analysis results to the network (paid) |

### Sessions Pack (3 tools)

| Tool | What it does |
|------|-------------|
| `start_session` | Start parallel agent session for multi-agent work |
| `list_sessions` | List sessions for a task |
| `update_session` | Update session status/focus |

### Setup Pack (5 tools)

| Tool | What it does |
|------|-------------|
| `get_or_create_global_board` | Get your global board |
| `list_projects` | List accessible projects |
| `list_boards` | List boards for a project |
| `create_board` | Create board with default columns |
| `migrate_to_global_board` | Move all tasks to global board |

Full parameter details: [docs/TOOLS.md](docs/TOOLS.md)

## Platform Setup

Most platforms work with zero configuration:

| Platform | Setup | Without it |
|----------|-------|-----------|
| Reddit | Nothing | Works immediately |
| TikTok | `npx playwright install chromium` | Browser not found error |
| Instagram | `npx playwright install chromium` | Browser not found error |
| Xiaohongshu | `npx playwright install chromium` | Browser not found error |
| Twitter/X | `TWITTER_USERNAME` + `TWITTER_PASSWORD` in `.env` | Skipped |
| YouTube | `YOUTUBE_API_KEY` in `.env` | Skipped |
| Moltbook | `MOLTBOOK_API_KEY` in `.env` | Skipped |
| Vision mode | Any of: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | Vision returns error |
| Paid analysis | `CROWDLISTEN_API_KEY` | Free tools still work |

Browser-based platforms (TikTok, Instagram, Xiaohongshu) have built-in rate limits of 3-5 requests per minute to prevent IP blocks.

## How It Works Under the Hood

- **Reddit, YouTube, Moltbook** use direct HTTP APIs.
- **Twitter** uses a cookie-based scraper — no developer account needed.
- **TikTok, Instagram, Xiaohongshu** launch a real browser via Playwright and intercept the platform's own internal API responses.
- **Vision mode** opens a browser, takes a full-page screenshot, and sends it to an LLM with a structured extraction prompt. Works on any website.

### The Pipeline

CrowdListen's end-to-end pipeline turns raw crowd feedback into agent-ready work:

```
Crowd Feedback     →  Analysis        →  Insight          →  Spec           →  MCP Delivery
(Reddit, TikTok,      (sentiment,        Extraction          Generation        to Coding
 YouTube, X, ...)      clustering,        (pain points,       (actionable       Agents
                       segmentation)      feature requests,    specs with        (get_specs →
                                          competitive          evidence +        start_spec →
                                          signals)             criteria)         implement)
```

Each step feeds the next. By the time a coding agent calls `get_specs`, the spec already carries evidence citations from real user feedback, a confidence score based on signal strength, and acceptance criteria derived from the extracted insights.

### Skill Pack Registry

The registry (`src/tools/registry.ts`) implements progressive disclosure following the [GitHub MCP Server pattern](https://github.com/github/github-mcp-server). Instead of exposing 40+ tools on startup, the server starts with 5 core tools. Agents discover available packs via `list_skill_packs` and activate what they need with `activate_skill_pack`. The server fires `notifications/tools/list_changed` so the agent picks up new tools without restarting.

This matters for token efficiency — an agent working on implementation only activates `spec-delivery` and `planning`, keeping its tool context small and focused.

The browser can run locally (default), in Docker, or via a remote CDP endpoint:

```bash
BROWSER_PROVIDER=docker npx crowdlisten search tiktok "AI agents"
BROWSER_PROVIDER=remote BROWSER_CDP_URL=wss://connect.browserbase.com?apiKey=KEY npx crowdlisten search tiktok "AI agents"
```

## Transports

| Transport | Use case | Command |
|-----------|----------|---------|
| **stdio** (default) | Local agent integration | `npx @crowdlisten/planner` |
| **Streamable HTTP** | Remote/cloud agent access | `npx @crowdlisten/planner serve` |
| **OpenAPI/REST** | Any HTTP client | `curl localhost:3848/openapi.json` |

The HTTP transport runs on port 3848 and supports stateless auth via `Authorization: Bearer <token>` (Supabase JWT or API key). All MCP tools are exposed via `POST /mcp`, with health check at `GET /health` and auto-generated OpenAPI spec at `GET /openapi.json`.

## CLI Commands

```bash
npx @crowdlisten/planner login          # Sign in + auto-configure agents
npx @crowdlisten/planner setup          # Re-run auto-configure
npx @crowdlisten/planner logout         # Clear credentials
npx @crowdlisten/planner whoami         # Check current user
npx @crowdlisten/planner serve          # Start HTTP server on :3848
npx @crowdlisten/planner openapi        # Print OpenAPI 3.0 spec to stdout
npx @crowdlisten/planner context        # Launch skill pack dashboard (port 3847)
npx @crowdlisten/planner context <file> # Process file through context pipeline
npx @crowdlisten/planner setup-context  # Configure LLM provider for extraction

# Social listening CLI
npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten comments youtube dQw4w9WgXcQ --limit 100
npx crowdlisten vision https://news.ycombinator.com --limit 10
npx crowdlisten trending reddit --limit 10
npx crowdlisten status
npx crowdlisten health
```

## Supported Agents

**Auto-configured on login:** Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw

**Also works with (manual config):** Copilot, Droid, Qwen Code, OpenCode

## Context Extraction

Upload chat transcripts, get reusable context blocks and skill recommendations. PII is redacted locally before anything reaches an LLM.

```
Upload → Parse → PII Redact → Chunk → LLM Extract → Skill Match → Store
(local)  (local)  (local)     (local)  (user's key)  (local)     (local)
```

### Supported Formats

- `.json` — ChatGPT exports, Claude exports (auto-detected)
- `.zip` — ZIP archives containing JSON exports
- `.txt` / `.md` — Plain text or markdown
- `.pdf` — PDF documents

### LLM Providers

- **OpenAI** — gpt-4o-mini default, supports embeddings
- **Anthropic** — Claude Sonnet default

## Privacy

- PII redacted locally before LLM calls
- Memories stored in Supabase with RLS (users can only access their own data)
- Local fallback (`~/.crowdlisten/`) when Supabase is unavailable
- Your own API keys for LLM extraction
- No data syncs without explicit user action
- Everything is MIT open-source and inspectable

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CROWDLISTEN_URL` | `https://crowdlisten.com` | Supabase project URL |
| `CROWDLISTEN_ANON_KEY` | Built-in default | Supabase anonymous key |
| `CROWDLISTEN_APP_URL` | `https://crowdlisten.com` | Web app URL (login redirects) |
| `CROWDLISTEN_AGENT_URL` | `https://agent.crowdlisten.com` | Agent backend URL |
| `CROWDLISTEN_API_KEY` | None | API key for paid tools (analysis, content, generation) |

### Auto-Executor Detection

When your agent calls `claim_task`, `start_session`, or `start_spec`, CrowdListen auto-detects which agent is running:

| Agent | Detection |
|-------|-----------|
| Claude Code | `CLAUDE_CODE=1` or `CLAUDE_SESSION_ID` |
| Cursor | `CURSOR_SESSION_ID` or `CURSOR_TRACE_ID` |
| Gemini CLI | `GEMINI_CLI` |
| Codex | `CODEX_SESSION_ID` |
| OpenClaw | `OPENCLAW_SESSION` or `OPENCLAW_AGENT` |
| Amp | `AMP_SESSION_ID` |

## For Agents

See [AGENTS.md](AGENTS.md) for machine-readable capability descriptions and example workflows.

## Development

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 210+ tests via Vitest
```

## Contributing

Highest-value contributions: new platform adapters (Threads, Bluesky, Hacker News, Product Hunt, Mastodon) and extraction fixes.

## License

MIT — [crowdlisten.com](https://crowdlisten.com)
