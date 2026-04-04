# CrowdListen

> Give your AI agent crowd context — analyzed intelligence from what real users say, what markets think, and what communities want.

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## The Problem

AI agents don't know what your users think. Every session starts from scratch — no awareness of what people say on Reddit, no signal from TikTok comments, no synthesis of forum discussions. You end up copy-pasting feedback manually and watching your agent make decisions without the one input that matters most: what real people think.

CrowdListen fixes this with a four-step loop:

1. **Listen** — search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, and forums
2. **Analyze** — cluster opinions by theme, extract pain points, synthesize cross-platform reports
3. **Save** — capture insights into a .md knowledge base that compounds across sessions
4. **Recall** — any agent retrieves context via semantic search or browses INDEX.md directly

Any agent — Claude Code, Cursor, Gemini CLI, Codex — can recall this later. The intelligence compounds across sessions and across agents. That's crowd context.

## Get Started

One command. Your browser opens, you sign in, and your agents are configured automatically:

```bash
npx @crowdlisten/harness login
```

Auto-configures MCP for **Claude Code, Cursor, Gemini CLI, Codex, Amp, and OpenClaw**. No env vars, no JSON editing, no API keys to manage. Restart your agent after login.

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
| **Search social platforms** | Search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu from one tool | Returns structured posts with engagement metrics, timestamps, and author info — same format regardless of platform |
| **Analyze audience signal** | Cluster opinions, extract pain points, generate cross-platform reports | AI groups comments by theme, scores sentiment, identifies competitive signals |
| **Save and recall across sessions** | .md knowledge base that compounds across agents and devices | Your agent saves with `save`, retrieves with `recall`, browses `~/.crowdlisten/context/INDEX.md`, organizes with `sync_context({ organize: true })` |
| **Plan and track work** | Tasks, execution plans, progress tracking, server-side execution | Your agent claims tasks, drafts plans with assumptions and risks, logs progress, triggers agent execution and polls status |
| **Run full analyses** | End-to-end crowd analysis with streaming results | `run_analysis` triggers the full pipeline on the backend; `continue_analysis` for follow-ups |
| **Get specs from crowd feedback** | Turn crowd intelligence into implementation-ready specs | Specs include evidence citations, acceptance criteria, and confidence scores |
| **Extract from any website** | Screenshot any URL and get structured data back | Vision mode sends screenshots to an LLM — works on forums, paywalled sites, anything with a URL |

## How It Works

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

Your agent starts with **7 core tools** and activates skill packs on demand (~30 tools total across all packs). No restart required — new tools appear instantly via `tools/list_changed`.

**Task Execution** — Trigger server-side AI agent execution (Amp, Claude Code, Codex, Gemini CLI) and poll progress via MCP. Calls `execute_task` to dispatch work and `get_execution_status` to track completion.

### Skill Packs

| Pack | Tools | What it does |
|------|:-----:|---|
| **core** (always on) | 7 | .md knowledge base (save/recall/sync/publish), skill discovery, preferences |
| **social-listening** | 7 | Search Reddit, TikTok, YouTube, Twitter, Instagram, Xiaohongshu |
| **audience-analysis** | 4 | Opinion clustering, insight extraction, content enrichment |
| **planning** | 13 | Tasks, execution plans, progress tracking, server-side agent execution |
| **analysis** | 5 | Run full analyses, generate specs from results |
| **crowd-intelligence** | 2 | Async crowd research with job polling |
| **spec-delivery** | 3 | Browse and claim actionable specs from crowd feedback |
| **sessions** | 3 | Multi-agent coordination |
| **setup** | 3 | Board management, project listing, migration |
| **agent-network** | 2 | Register agents, discover capabilities |

Plus 9 **workflow packs** that deliver expert methodology via SKILL.md when activated:
- knowledge-base, competitive-analysis, content-strategy, content-creator, data-storytelling, heuristic-evaluation, market-research-reports, user-stories, ux-researcher

Full tool reference: **[docs/TOOLS.md](docs/TOOLS.md)**

### Knowledge Base

Every agent interaction can make the knowledge base better. The system works as a compounding loop:

```
 save()          Supabase              ~/.crowdlisten/context/
───────→  memories table  ──render──→  ├── INDEX.md
                                       ├── entries/a1b2c3d4.md
 recall()        ↑                     └── topics/auth.md
←────────────────┘
                                       sync_context({ organize: true })
 sync_context()                        detects duplicates,
 rebuilds local ←──── full pull ────── groups by topic,
 .md cache                             suggests syntheses
```

**How data flows:**

1. **Save** — `save({ title, content, tags })` writes to Supabase and renders a `.md` file locally with YAML frontmatter
2. **Recall** — `recall({ search })` queries Supabase via semantic search (pgvector cosine similarity), with keyword fallback. For structured browsing, agents read `~/.crowdlisten/context/INDEX.md` directly
3. **Sync** — `sync_context()` pulls all entries from cloud and rebuilds the entire local `.md` folder. Use after web uploads or switching machines. Pass `organize: true` to also detect near-duplicates (Jaccard similarity), identify topics with 3+ entries, and return a report telling the agent what to synthesize or prune
4. **Publish** — `publish_context({ memory_id, team_id })` shares an entry with teammates. Their next `sync_context` pulls it into a `## Shared` section in their INDEX.md

**The compounding effect:** After every analysis or research task, the agent saves 2-3 key takeaways. Over time, `sync_context({ organize: true })` groups these into topics. The agent synthesizes topics into distilled summaries. The next agent starts with a rich INDEX.md instead of a blank slate.

Supabase is the source of truth. The local `.md` folder is a read-only rendered cache — no sync conflicts, no merge issues.

### Platforms

| Platform | Setup | Notes |
|---|---|---|
| Reddit | None | Works immediately |
| TikTok, Instagram, Xiaohongshu | `npx playwright install chromium` | Browser-based extraction |
| Twitter/X | `TWITTER_USERNAME` + `TWITTER_PASSWORD` in `.env` | Credential-based |
| YouTube | `YOUTUBE_API_KEY` in `.env` | API key required |
| Vision mode (any URL) | Any one of: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` | Screenshots + LLM extraction |

### Supported Agents

**Auto-configured on login:** Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw

**Also works with (manual config):** Copilot, Droid, Qwen Code, OpenCode

## CLI

```bash
npx @crowdlisten/harness login          # Sign in + auto-configure agents
npx @crowdlisten/harness setup          # Re-run auto-configure
npx @crowdlisten/harness serve          # Start HTTP server on :3848

npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten vision https://news.ycombinator.com --limit 10
npx crowdlisten trending reddit --limit 10
```

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
