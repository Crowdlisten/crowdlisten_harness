# CrowdListen

> Give your AI agent crowd context — analyzed intelligence from what real users say, what markets think, and what communities want.

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## The Problem

AI agents don't know what your users think. Every session starts from scratch — no awareness of what people say on Reddit, no signal from TikTok comments, no synthesis of forum discussions. You end up copy-pasting feedback manually and watching your agent make decisions without the one input that matters most: what real people think.

CrowdListen fixes this with a four-step loop:

1. **Listen** — search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, and forums
2. **Analyze** — cluster opinions by theme, extract pain points, synthesize cross-platform reports
3. **Remember** — save analyzed insights with semantic embeddings, not raw posts
4. **Recall** — any agent retrieves crowd context via natural language, across sessions and devices

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
| **Save and recall across sessions** | Semantic memory that follows you across agents and devices | Your agent saves with `save`, retrieves with `recall` using meaning-based search — not keyword matching |
| **Plan and track work** | Tasks, execution plans, progress tracking | Your agent claims tasks, drafts plans with assumptions and risks, logs progress |
| **Get specs from crowd feedback** | Turn crowd intelligence into implementation-ready specs | Specs include evidence citations, acceptance criteria, and confidence scores |
| **Extract from any website** | Screenshot any URL and get structured data back | Vision mode sends screenshots to an LLM — works on forums, paywalled sites, anything with a URL |

## How It Works

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

Your agent starts with **5 core tools** and activates skill packs on demand. No restart required — new tools appear instantly.

### Skill Packs

| Pack | Tools | What it does | Free? |
|------|:-----:|---|:---:|
| **core** (always on) | 5 | Semantic memory, discovery, preferences | Yes |
| **social-listening** | 7 | Search Reddit, TikTok, YouTube, Twitter, Instagram, Xiaohongshu | Yes |
| **audience-analysis** | 6 | Opinion clustering, deep analysis, insight extraction, research synthesis | API key |
| **planning** | 11 | Tasks, execution plans, progress tracking | Yes |
| **spec-delivery** | 3 | Browse and claim actionable specs from crowd feedback | Yes |
| **sessions** | 3 | Multi-agent coordination | Yes |
| **analysis** | 5 | Run full analyses, generate specs from results | API key |
| **content** | 4 | Ingest content, vector search | API key |
| **generation** | 2 | PRD generation | API key |
| **llm** | 2 | Free LLM completion proxy | Yes |
| **agent-network** | 3 | Register agents, discover capabilities | Mixed |

Plus 8 **workflow packs** (competitive-analysis, content-strategy, market-research, ux-research, and more) that deliver expert methodology when activated.

Full tool reference: **[docs/TOOLS.md](docs/TOOLS.md)**

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
