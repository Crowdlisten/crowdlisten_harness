# CrowdListen

> Give your AI agents shared context — structured harnesses compiled from your organization's conversations, feedback, and decisions.

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## The Problem

AI agents don't share context. Every session starts from scratch — no awareness of prior decisions, no access to customer feedback, no understanding of what's been tried. You end up pasting context into every prompt and watching agents build without the one thing that matters: shared organizational understanding.

CrowdListen fixes this with a four-step loop:

1. **Ingest** — connect Slack, Discord, Reddit, support tools, internal discussions
2. **Compile** — AI distills signal into structured harnesses: themes, evidence, severity, trends
3. **Execute** — agents inherit harnesses as context, building with full organizational knowledge
4. **Learn** — agents write back observations, enriching harnesses for the next build

Any agent — Claude Code, Cursor, Gemini CLI, Codex — reads and writes harnesses. Context compounds across sessions and across agents. That's how you align builds at scale.

## Get Started

One command. Your browser opens, you sign in, and your agents are configured automatically:

```bash
npx @crowdlisten/harness login
```

Auto-configures MCP for **Claude Code, Cursor, Gemini CLI, Codex, and Amp**. No env vars, no JSON editing, no API keys to manage. Restart your agent after login.

### Manual Setup

Add to your agent's MCP config:

```json
{
  "mcpServers": {
    "crowdlisten": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/harness"]
    }
  }
}
```

For remote access, use the HTTP transport:

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

## What You Can Do

| Capability | What it does | How it works |
|---|---|---|
| **Search social platforms** | Search 16+ platforms — Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, Polymarket, Truth Social, Hacker News, Bluesky, Product Hunt, Threads, GitHub, and more | Returns structured posts with engagement metrics, timestamps, and author info — same format regardless of platform. Intelligent query planning auto-selects platforms by intent and generates platform-optimized queries. When a platform is unavailable, results from other platforms still return with a `platforms_skipped` field explaining why. |
| **Compile organizational signal** | AI distills conversations into structured harnesses — themes, evidence, severity, and trends | AI groups comments by theme, scores sentiment, identifies competitive signals. `compile_knowledge` merges findings across analyses, detects contradictions, and ranks evidence with confidence scores. |
| **Shared context layer** | Harnesses persist across agents and sessions — query via semantic search or browse directly | Your agent saves with `save` and retrieves with `recall`. Semantic search uses pgvector cosine similarity with keyword fallback. Browse pages, filter by path or tags, read activity logs, and sync local folders. |
| **Track entities** | Define companies, competitors, and products as tracked entities with keywords and aliases | `manage_entities` supports full CRUD plus project linking. Entity IDs flow into observations for attribution — see what the crowd says about each competitor. |
| **Submit observations** | Agents and bots submit raw feedback (feature requests, bugs, pain points, praise) that auto-classify into themes | `submit_observation` accepts user JWT or connector API keys. Observations support `entity_id` for entity tagging and `signal_type` for official vs. reception signals. |
| **Plan and track work** | Tasks, execution plans, progress tracking, server-side execution | Your agent claims tasks, drafts plans with assumptions and risks, logs progress, triggers agent execution (Amp, Claude Code, Codex, Gemini CLI) and polls status |
| **Run full analyses** | End-to-end crowd analysis with streaming results | `run_analysis` triggers the full pipeline on the backend; `continue_analysis` streams parsed follow-up responses |
| **Crowd research** | Async multi-platform research with job polling | `crowd_research` dispatches deep research across 16+ platforms with intent-aware query planning and weighted RRF fusion — poll status until complete |
| **From harnesses to specs** | Turn harnesses into implementation-ready specs with evidence citations and acceptance criteria | Specs include evidence citations, acceptance criteria, and confidence scores |
| **Decompose goals** | Break complex goals into subtasks with dependencies | `decompose_goal` creates a structured plan with subtasks, optionally executing immediately |

## How It Works

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

Your agent starts with **5 core tools** and activates skill packs on demand (22 canonical tools total across 7 packs, plus 16 backward-compatible aliases). No restart required — new tools appear instantly via `tools/list_changed`.

**Task Execution** — Trigger server-side AI agent execution (Amp, Claude Code, Codex, Gemini CLI) and poll progress via MCP. Use `complete_task` with `execute: true` to dispatch work and `status: true` to track completion.

**Observation Pipeline** — External agents, bots, and webhooks register as connectors, submit raw observations (feature requests, bugs, pain points, praise), and the pipeline auto-classifies and clusters them into themes with severity scoring and trend detection. Observations can be tagged with `entity_id` to attribute feedback to specific companies or products.

**Structured Errors** — Every tool failure returns `{ error, suggestion, docs }` so your agent knows what happened, what to do next, and where to find help.

**Graceful Degradation** — When a platform is unavailable (missing API key, Playwright not installed), `search_content` returns results from available platforms and includes `platforms_skipped` explaining what's missing and why.

### Skill Packs

| Pack | Tools | What it does |
|------|:-----:|---|
| **core** (always on) | 5 | Semantic recall, knowledge save, skill discovery, knowledge compilation, topic listing |
| **social-listening** | 4 | Search 16+ platforms (Reddit, TikTok, YouTube, Twitter, Instagram, Polymarket, Truth Social, etc.) with structured results and engagement metrics |
| **audience-analysis** | 1 | Opinion clustering, insight extraction, content analysis with configurable depth |
| **planning** | 4 | Create tasks, list and filter tasks, mark complete with progress logging, decompose goals into subtasks |
| **analysis** | 5 | Run full analyses, continue with follow-ups, retrieve results, list history, generate specs |
| **crowd-intelligence** | 1 | Async multi-platform crowd research with job polling |
| **observations** | 2 | Submit entity-tagged observations from agents/bots, manage tracked entities (companies, competitors, products) |

Plus 17 **workflow packs** that deliver expert methodology via SKILL.md when activated:
- autopilot-research, competitive-analysis, content-creator, content-strategy, context-extraction, crowd-research, crowdlisten, data-storytelling, entity-research, heuristic-evaluation, knowledge-base, market-research-reports, multi-agent, spec-generation, task-planning, user-stories, ux-researcher

Full tool reference: **[docs/TOOLS.md](docs/TOOLS.md)**

### Knowledge Base

Every agent interaction compounds knowledge. The unified `pages` table stores all knowledge with path-based identity — like a filesystem in the cloud.

```
 save()          Supabase `pages`       ~/.crowdlisten/kb/
───────→  UNIQUE(user_id, path)  sync→  ├── notes/auth-approach.md
                                        ├── projects/cl/topics/...
 recall()        ↑                      └── documents/thesis/ch1.md
←────────────────┘
 recall()        semantic search         watch / sync
 recall(list)    browse by path          auto-sync local folders
```

**How data flows:**

1. **Save** — `save({ title, content, tags })` writes to the `pages` table. Pass `publish: { team_id }` to share with teammates.
2. **Recall** — `recall({ query })` performs semantic search (pgvector cosine similarity) with keyword fallback. Filter by path prefix or tags.
3. **Browse** — `recall({ list: true })` browses pages. `recall({ path })` reads a single page.
4. **Search** — `recall({ query, mode: "keyword" })` performs full-text search across all pages.
5. **Compile** — `compile_knowledge({ project_id })` merges analyses into canonical topic pages with confidence scores.
6. **Topics** — `list_topics({ project_id })` shows compiled topics with staleness indicators.
7. **Ingest** — `save({ analysis_id })` ingests an analysis into the knowledge base. `save({ folder })` bulk-imports a local folder.
8. **Log** — `recall({ log: true })` returns timestamped log entries for decisions and progress.
9. **Sync** — `npx @crowdlisten/harness sync ~/folder` syncs a local folder to pages. `watch` mode auto-syncs on file changes.

**Path conventions:** `notes/` for standalone notes, `projects/{slug}/` for project-scoped content, `documents/` for ingested files, `decisions/` for architectural decisions.

**The compounding effect:** After every analysis or research task, the agent saves key takeaways. The recall tool lets agents browse, search, and organize knowledge semantically. `compile_knowledge` synthesizes multiple analyses into canonical topic pages with ranked evidence and confidence scores. The next agent starts with a rich knowledge base instead of a blank slate.

Supabase `pages` table is the source of truth. Local `.md` folders can be synced bidirectionally via the `watch` and `sync` CLI commands.

### Platforms

| Platform | Setup | Notes |
|---|---|---|
| Reddit | None | Works immediately -- search, trending, comments |
| TikTok | `npx playwright install chromium` | Browser-based extraction via API interception |
| Instagram | `npx playwright install chromium` | Browser-based extraction via API interception |
| Xiaohongshu | `npx playwright install chromium` | Browser-based extraction via API interception |
| Twitter/X | `TWITTER_USERNAME` + `TWITTER_PASSWORD` in `.env` | Works without login for public content; credentials enable additional features |
| YouTube | `YOUTUBE_API_KEY` in `.env` | API key required |
| Web/Exa | None (agent-side) | Semantic search across forums, news, blogs -- available via `crowd_research` (handled by agent backend) |

When a platform is unavailable, `search_content` with `platform: "all"` gracefully degrades — returning results from available platforms and a `platforms_skipped` field listing what's missing and why.

### Supported Agents

**Auto-configured on login:** Claude Code, Cursor, Gemini CLI, Codex, Amp

**Also works with (manual config):** OpenClaw, Copilot, Droid, Qwen Code, OpenCode

## CLI

```bash
npx @crowdlisten/harness login          # Sign in + auto-configure agents
npx @crowdlisten/harness logout         # Clear saved credentials
npx @crowdlisten/harness whoami         # Show current user
npx @crowdlisten/harness setup          # Re-run auto-configure
npx @crowdlisten/harness serve          # Start HTTP server on :3848
npx @crowdlisten/harness openapi        # Print OpenAPI 3.0 spec to stdout
npx @crowdlisten/harness sync ~/kb      # One-shot sync local folder to pages
npx @crowdlisten/harness watch ~/kb     # Auto-sync on file changes (Dropbox-style)
npx @crowdlisten/harness context        # Launch skill pack dashboard (port 3847)
npx @crowdlisten/harness context file   # Process a file through context pipeline

npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten trending reddit --limit 10
```

### Watch Mode

`watch` monitors a local folder and syncs changes to the `pages` table in real time:

```bash
npx @crowdlisten/harness watch ~/Desktop/knowledge
# Watching ~/Desktop/knowledge... (12 files synced)
# [14:32] Updated: notes/auth-approach.md
# [14:35] Updated: decisions/db-choice.md
```

Files are synced using content hashing (MD5) — unchanged files are skipped. The `sync` command does a one-shot sync without watching.

## Privacy

- PII redacted locally before LLM calls
- Memories stored with row-level security — users can only access their own data
- Local fallback when cloud is unavailable
- Your own API keys for LLM extraction
- No data syncs without explicit action
- MIT open-source and inspectable

## Development

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 210+ tests via Vitest
```

For agent-readable capability descriptions and example workflows, see [AGENTS.md](AGENTS.md).

## Contributing

Highest-value contributions: new platform adapters (Threads, Bluesky, Hacker News, Product Hunt, Mastodon) and extraction fixes.

## License

MIT — [crowdlisten.com](https://crowdlisten.com)
