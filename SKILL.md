---
name: crowdlisten
description: Audience intelligence, social listening, and planning for AI agents
version: 2.2.0
user-invocable: false
metadata:
  openclaw:
    requires:
      bins: [node, npx]
    optionalEnv: [CROWDLISTEN_AGENT_URL]
    emoji: "📊"
    category: research
    tags: [audience-intelligence, social-listening, planning, knowledge-base, context-extraction]
    transports:
      stdio: "npx @crowdlisten/harness"
      http: "https://mcp.crowdlisten.com/mcp"
---

# CrowdListen Harness

Audience intelligence, social listening, planning, and context extraction for AI agents.

## What It Does

CrowdListen Harness is a single MCP gateway to 21 canonical tools across 7 skill packs (plus 16 backward-compatible aliases):

- **Core** (3 tools, always on) — `skills`, `save`, `recall` (wiki_* tools and others are backward-compatible aliases for save/recall)
- **Planning** (3 tools) — Task management, progress tracking, server-side agent execution
- **Social Listening** (5 tools) — Search Reddit, YouTube, TikTok, Twitter, Instagram, Xiaohongshu
- **Audience Analysis** (1 tool) — Content analysis, opinion clustering, insight extraction
- **Analysis** (5 tools) — Run audience analyses, generate specs from results
- **Crowd Intelligence** (1 tool) — Context-enriched crowd research with async polling
- **Observations** (3 tools) — Submit observations, manage connectors, track entities

## Quick Start

```bash
# Install and auto-configure
npx @crowdlisten/harness login

# Or connect via HTTP
{ "url": "https://mcp.crowdlisten.com/mcp" }
```

## Transports

| Transport | URL | Auth |
|-----------|-----|------|
| stdio | `npx @crowdlisten/harness` | Browser login (stored in ~/.crowdlisten/) |
| HTTP | `https://mcp.crowdlisten.com/mcp` | Bearer token (JWT or API key) |
| REST | `https://mcp.crowdlisten.com/tools/{name}` | Bearer token |

## Core Workflow

```
skills({ action: "activate", pack_id: "planning" })
→ list_tasks → list_tasks (claim) → recall (search context)
→ complete_task (execute) → complete_task (status, poll) → save → complete_task (done)
```

Every task captures decisions, patterns, and learnings via `save`. Use `recall` to find context and browse the knowledge base.

## Links

- Website: https://crowdlisten.com
- GitHub: https://github.com/Crowdlisten/crowdlisten_harness
- OpenAPI: https://mcp.crowdlisten.com/openapi.json
