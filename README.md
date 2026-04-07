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
| **Save and recall across sessions** | .md knowledge base that compounds across agents and devices | Your agent saves with `save`, searches with `wiki_search`, browses with `wiki_list`, ingests content with `wiki_ingest` |
| **Plan and track work** | Tasks, execution plans, progress tracking, server-side execution | Your agent claims tasks, drafts plans with assumptions and risks, logs progress, triggers agent execution and polls status |
| **Run full analyses** | End-to-end crowd analysis with streaming results | `run_analysis` triggers the full pipeline on the backend; `continue_analysis` for follow-ups |
| **Get specs from crowd feedback** | Turn crowd intelligence into implementation-ready specs | Specs include evidence citations, acceptance criteria, and confidence scores |
| **Extract from any website** | Screenshot any URL and get structured data back | Vision mode sends screenshots to an LLM — works on forums, paywalled sites, anything with a URL |

## How It Works

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

Your agent starts with **8 core tools** and activates skill packs on demand (~28 tools total across all packs). No restart required — new tools appear instantly via `tools/list_changed`.

**Task Execution** — Trigger server-side AI agent execution (Amp, Claude Code, Codex, Gemini CLI) and poll progress via MCP. Calls `execute_task` to dispatch work and `get_execution_status` to track completion.

### Skill Packs

| Pack | Tools | What it does |
|------|:-----:|---|
| **core** (always on) | 8 | Wiki knowledge base (save/wiki_*/skills), skill discovery |
| **social-listening** | 5 | Search Reddit, TikTok, YouTube, Twitter, Instagram, Xiaohongshu |
| **audience-analysis** | 3 | Opinion clustering, insight extraction, content analysis |
| **planning** | 6 | Tasks, execution, progress tracking, server-side agent execution |
| **analysis** | 5 | Run full analyses, generate specs from results |
| **crowd-intelligence** | 1 | Async crowd research with job polling |

Plus 9 **workflow packs** that deliver expert methodology via SKILL.md when activated:
- knowledge-base, competitive-analysis, content-strategy, content-creator, data-storytelling, heuristic-evaluation, market-research-reports, user-stories, ux-researcher

Full tool reference: **[docs/TOOLS.md](docs/TOOLS.md)**

### Knowledge Base

Every agent interaction compounds knowledge. The unified `pages` table stores all knowledge with path-based identity — like a filesystem in the cloud.

```
 save()          Supabase `pages`       ~/.crowdlisten/kb/
───────→  UNIQUE(user_id, path)  sync→  ├── notes/auth-approach.md
                                        ├── projects/cl/topics/...
 wiki_search()   ↑                      └── documents/thesis/ch1.md
←────────────────┘
 recall()        semantic search         watch / sync
 wiki_list()     browse by path          auto-sync local folders
```

**How data flows:**

1. **Save** — `save({ title, content, tags })` writes to the `pages` table. Pass `publish: { team_id }` to share with teammates.
2. **Recall** — `recall({ query })` performs semantic search (pgvector cosine similarity) with keyword fallback. Filter by path prefix or tags.
3. **Browse** — `wiki_list()` browses pages. `wiki_read(path)` reads a single page.
4. **Search** — `wiki_search({ query })` performs full-text search across all pages.
5. **Ingest** — `wiki_ingest({ url_or_text })` ingests external content into the knowledge base.
6. **Log** — `wiki_log({ message })` appends timestamped log entries for decisions and progress.
7. **Sync** — `npx @crowdlisten/harness sync ~/folder` syncs a local folder to pages. `watch` mode auto-syncs on file changes.

**Path conventions:** `notes/` for standalone notes, `projects/{slug}/` for project-scoped content, `documents/` for ingested files, `decisions/` for architectural decisions.

**The compounding effect:** After every analysis or research task, the agent saves key takeaways. The wiki and recall tools let agents browse, search, and organize knowledge semantically. The next agent starts with a rich knowledge base instead of a blank slate.

Supabase `pages` table is the source of truth. Local `.md` folders can be synced bidirectionally via the `watch` and `sync` CLI commands.

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
npx @crowdlisten/harness sync ~/kb      # One-shot sync local folder to pages
npx @crowdlisten/harness watch ~/kb     # Auto-sync on file changes (Dropbox-style)

npx crowdlisten search reddit "AI agents" --limit 20
npx crowdlisten vision https://news.ycombinator.com --limit 10
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
