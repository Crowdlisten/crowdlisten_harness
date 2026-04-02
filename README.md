# CrowdListen

> CrowdListen gives AI agents crowd context — analyzed intelligence from what real users say, what markets think, and what communities want. Not just session recall. Analyzed, clustered, decision-ready.

![CrowdListen — Give your agent evidence, not guesses](docs/images/hero.png)

[English](README.md) | [中文文档](README-CN.md) | [한국어](README-KO.md) | [Español](README-ES.md)

## The Problem

AI agents have session memory. They don't have crowd context. Every new session starts from scratch — no awareness of what your audience is actually saying online, no analyzed signal from the platforms where users talk about your product. You end up re-explaining context, manually copy-pasting feedback from Reddit, and watching your agent make decisions without the one input that matters most: what real people think.

CrowdListen closes this gap with a loop from listening to analysis to recall:

1. **Listen** — search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, and forums
2. **Analyze** — cluster opinions by theme, extract pain points, synthesize cross-platform reports
3. **Remember** — save analyzed insights with semantic embeddings, not raw posts
4. **Recall** — any agent retrieves crowd context via natural language, across sessions and devices

```
search_content("cursor vs claude code", platform: "reddit")
→ 20 posts with engagement metrics

cluster_opinions(content_ids)
→ 4 opinion clusters: "Cursor better for refactoring" (38%), "Claude Code better for greenfield" (31%)

save({ title: "Dev tool preferences Q2", content: <clusters>, tags: ["competitive-intel"] })
→ Stored with semantic embedding

recall({ search: "what do developers think about our product vs competitors?" })
→ Returns analyzed clusters, ranked by semantic similarity
```

Any agent — Claude Code, Cursor, Gemini CLI, Codex — can `recall` this later. The intelligence compounds across sessions and across agents. That's crowd context.

## Get Started

One command. Your browser opens, you sign in, and your agents are configured automatically:

```bash
npx @crowdlisten/planner login
```

This auto-configures MCP for **Claude Code, Cursor, Gemini CLI, Codex, Amp, and OpenClaw**. No env vars, no JSON editing, no API keys to manage. Restart your agent after login.

<details>
<summary><strong>Manual setup (stdio)</strong></summary>

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
</details>

<details>
<summary><strong>Remote setup (Streamable HTTP)</strong></summary>

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

Or self-host: `npx @crowdlisten/planner serve` (starts on port 3848).
</details>

### Your Agent Discovers Tools Progressively

On startup, your agent sees **5 core tools** (`save`, `recall`, `list_skill_packs`, `activate_skill_pack`, `set_preferences`) — nothing else. It activates skill packs on demand, and only loads the tools it needs. No restart required — packs activate via `tools/list_changed` and new tools appear instantly.

## What You Can Do

### Search Social Platforms

Search Reddit, YouTube, TikTok, Twitter/X, Instagram, Xiaohongshu, and Moltbook from one tool. Get back structured posts with engagement metrics, timestamps, and author info — same format regardless of platform.

```bash
# Also works as a CLI
npx crowdlisten search reddit "cursor vs claude code" --limit 5
npx crowdlisten vision https://news.ycombinator.com
```

### Analyze Audience Signal

Cluster opinions, run deep analysis (audience segments, competitive signals), and generate cross-platform research reports from a single query. Core extraction is free and open source.

### Save and Recall Across Sessions

Your agent saves context with `save` and retrieves it with `recall` using semantic search, not keyword matching. Ask "how should we handle login security?" and it finds your earlier note about JWT tokens — even though the words don't overlap.

Memories persist in Supabase with pgvector embeddings, so they follow you across agents and devices. Falls back to keyword matching if the embedding API is unavailable, and to local storage if Supabase is down.

### Plan and Track Work

Your agent calls `list_tasks` to see what's available, `claim_task` to start work, and `create_plan` to draft an approach with assumptions and risks. Decisions and learnings are saved via `save`, so future tasks can `recall` them.

### Get Actionable Specs from Crowd Feedback

The full pipeline: crowd feedback is analyzed, insights extracted, and specs generated automatically. Your coding agent browses specs that are ready to implement — each with evidence from real user feedback, acceptance criteria, and a confidence score.

### Extract From Any Website

Vision mode takes a screenshot of any URL, sends it to an LLM (Claude, Gemini, or OpenAI), and returns structured data. Forum without an API? News site with paywalled comments? Just point `extract_url` at it.

## How It Works

![CrowdListen Pipeline — Raw Crowd Signals to Agent Delivery](docs/images/pipeline.jpg)

Each step feeds the next. By the time a coding agent calls `get_specs`, the spec already carries evidence citations from real user feedback, a confidence score, and acceptance criteria derived from the insights.

<details>
<summary><strong>Skill Packs</strong></summary>

Your agent starts with 5 core tools and activates packs on demand:

| Pack | Tools | What it does | Free? |
|------|:-----:|-------------|:-----:|
| **core** (always on) | 5 | Semantic memory, discovery, preferences | Yes |
| **social-listening** | 7 | Search Reddit, TikTok, YouTube, Twitter, Instagram, Xiaohongshu, Moltbook | Yes |
| **audience-analysis** | 6 | Opinion clustering, deep analysis, insight extraction, research synthesis | API key |
| **planning** | 11 | Tasks, execution plans, progress tracking | Yes |
| **spec-delivery** | 3 | Browse and claim actionable specs from crowd feedback | Yes |
| **sessions** | 3 | Multi-agent coordination | Yes |
| **analysis** | 5 | Run full analyses, generate specs from results | API key |
| **content** | 4 | Ingest content, vector search | API key |
| **generation** | 2 | PRD generation | API key |
| **llm** | 2 | Free LLM completion proxy | Yes |
| **agent-network** | 3 | Register agents, discover capabilities | Mixed |

Plus 8 **workflow packs** (competitive-analysis, content-strategy, market-research-reports, ux-researcher, and more) that deliver expert methodology instructions when activated.

Full tool reference with parameters: **[docs/TOOLS.md](docs/TOOLS.md)**
</details>

<details>
<summary><strong>Platforms</strong></summary>

**Works immediately** — Reddit

**Needs Playwright** (`npx playwright install chromium`) — TikTok, Instagram, Xiaohongshu

**Needs credentials in `.env`:**
- Twitter/X — `TWITTER_USERNAME` + `TWITTER_PASSWORD`
- YouTube — `YOUTUBE_API_KEY`
- Moltbook — `MOLTBOOK_API_KEY`

**Vision mode** — needs any one of: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`

**Paid analysis tools** — `CROWDLISTEN_API_KEY` (free tools still work without it)
</details>

## Privacy

- PII redacted locally before LLM calls
- Memories stored in Supabase with row-level security (users can only access their own data)
- Local fallback when Supabase is unavailable
- Your own API keys for LLM extraction
- No data syncs without explicit user action
- MIT open-source and inspectable

---

<details>
<summary><strong>CLI Commands</strong></summary>

```bash
npx @crowdlisten/planner login          # Sign in + auto-configure agents
npx @crowdlisten/planner setup          # Re-run auto-configure
npx @crowdlisten/planner logout         # Clear credentials
npx @crowdlisten/planner whoami         # Check current user
npx @crowdlisten/planner serve          # Start HTTP server on :3848
npx @crowdlisten/planner openapi        # Print OpenAPI 3.0 spec to stdout
npx @crowdlisten/planner context        # Launch skill pack dashboard
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
</details>

<details>
<summary><strong>Transports</strong></summary>

| Transport | Use case | Command |
|-----------|----------|---------|
| **stdio** (default) | Local agent integration | `npx @crowdlisten/planner` |
| **Streamable HTTP** | Remote/cloud agent access | `npx @crowdlisten/planner serve` |
| **OpenAPI/REST** | Any HTTP client | `curl localhost:3848/openapi.json` |

The HTTP transport runs on port 3848 with auth via `Authorization: Bearer <token>` (Supabase JWT or API key). Health check at `GET /health`, OpenAPI spec at `GET /openapi.json`.
</details>

<details>
<summary><strong>Configuration</strong></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `CROWDLISTEN_URL` | `https://crowdlisten.com` | Supabase project URL |
| `CROWDLISTEN_ANON_KEY` | Built-in | Supabase anonymous key |
| `CROWDLISTEN_APP_URL` | `https://crowdlisten.com` | Web app URL (login redirects) |
| `CROWDLISTEN_AGENT_URL` | `https://agent.crowdlisten.com` | Agent backend URL |
| `CROWDLISTEN_API_KEY` | None | API key for paid tools |
</details>

<details>
<summary><strong>Context Extraction</strong></summary>

Upload chat transcripts, get reusable context blocks and skill recommendations. PII is redacted locally before anything reaches an LLM.

**Supported formats:** `.json` (ChatGPT/Claude exports), `.zip`, `.txt`, `.md`, `.pdf`

**LLM providers:** OpenAI (gpt-4o-mini) or Anthropic (Claude Sonnet)
</details>

<details>
<summary><strong>Supported Agents</strong></summary>

**Auto-configured on login:** Claude Code, Cursor, Gemini CLI, Codex, Amp, OpenClaw

**Also works with (manual config):** Copilot, Droid, Qwen Code, OpenCode

CrowdListen auto-detects which agent is running via environment variables when calling `claim_task`, `start_session`, or `start_spec`.
</details>

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
