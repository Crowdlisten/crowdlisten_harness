---
name: crowdlisten
description: Audience intelligence, social listening, and planning for AI agents
version: 1.0.0
user-invocable: false
metadata:
  openclaw:
    requires:
      bins: [node, npx]
    primaryEnv: CROWDLISTEN_API_KEY
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

CrowdListen Harness is a single MCP gateway to ~44 tools across 12 skill packs:

**Free (no API key):**
- **Planning** (11 tools) — Task management, execution plans, progress tracking
- **Sessions** (3 tools) — Multi-agent parallel coordination
- **Setup** (5 tools) — Board and project management
- **Context Extraction** (3 tools) — PII redaction, skill matching from chat transcripts
- **Skill Discovery** (3 tools) — Browse and install 155 skills (9 native + 146 community)
- **LLM Proxy** (2 tools) — Free LLM completions through CrowdListen
- **Agent Network** (2 tools) — Register agents, discover capabilities

**Paid (requires CROWDLISTEN_API_KEY):**
- **Analysis** (5 tools) — Run audience analyses across Reddit, YouTube, TikTok, Twitter, Instagram
- **Crowd Intelligence** (2 tools) — Context-enriched crowd research with async polling
- **Content** (4 tools) — Vector search, content ingestion
- **Generation** (2 tools) — PRD generation from analysis results
- **Agent Network** (1 tool) — Submit cross-agent analysis results

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
list_tasks → claim_task → recall → create_plan → execute → save → complete_task
```

Every task captures decisions, patterns, and learnings via `save`. Run `compile_context` to organize. Browse `~/.crowdlisten/context/INDEX.md` to navigate.

## Links

- Website: https://crowdlisten.com
- GitHub: https://github.com/Crowdlisten/crowdlisten_harness
- OpenAPI: https://mcp.crowdlisten.com/openapi.json
