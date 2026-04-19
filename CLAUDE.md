# CrowdListen Harness -- Developer Guide

This is the `@crowdlisten/harness` npm package -- a unified MCP server for AI agents. Version 2.3.0.

## Architecture Overview

```
src/
  index.ts              MCP server entry point, CLI routing, alias dispatch (743 lines)
  tools.ts              Core tool definitions + handlers (save, recall, tasks, etc.) (2790 lines)
  agent-tools.ts        Agent-proxied tool definitions + handlers (686 lines)
  agent-proxy.ts        HTTP helpers for agent.crowdlisten.com proxy calls
  tools/registry.ts     Skill pack registry -- progressive disclosure (267 lines)
  suggestions.ts        Pack activation suggestions based on triggers
  telemetry.ts          Anonymous usage telemetry
  openapi.ts            OpenAPI 3.0 spec generation
  watch.ts              Local folder sync/watch
  server-factory.ts     Shared server factory for stdio/HTTP
  transport/http.ts     Streamable HTTP transport (port 3848)
  insights/             Social platform adapters
    index.ts            Tool definitions + handler dispatcher (350 lines)
    handlers.ts         Platform-specific handler implementations
    cli.ts              CLI commands (search, trending)
    service-config.ts   Platform service configuration
    platforms/          Per-platform adapters (reddit, twitter, tiktok, instagram, youtube, xiaohongshu)
    browser/            BrowserPool + RequestInterceptor for browser-based extraction
    core/               Base adapter, health monitor, data normalizer, URL utils
  context/              Context extraction pipeline
    pipeline.ts         LLM-based context extraction
    cli.ts              Context CLI + web server
    store.ts            Local context block storage
    matcher.ts          Skill matching and discovery
    user-state.ts       User preferences, active packs, telemetry settings
    extractor.ts        Document extraction
    redactor.ts         PII redaction
skills/                 SKILL.md workflow packs (17 packs)
```

## Key Concepts

### Progressive Disclosure (Pack System)

Tools are grouped into packs (`src/tools/registry.ts`). Only the `core` pack (5 tools) is always active. Agents activate packs on demand via `skills()`, which triggers `tools/list_changed` so the agent sees new tools without restart.

**7 tool packs**: core (5), planning (4), social-listening (4), audience-analysis (1), analysis (5), crowd-intelligence (1), observations (2) = 22 canonical tools total.

**17 virtual packs**: SKILL.md workflow packs in `skills/`. They deliver expert methodology content, not tools.

### Tool Dispatch Flow

1. Agent calls a tool by name
2. `index.ts` checks if it's a **backward-compatible alias** (15 aliases in `TOOL_ALIASES`). If so, maps parameters and rewrites to canonical name.
3. Routes to handler:
   - `isInsightsTool()` -> `handleInsightsTool()` in `insights/index.ts`
   - Otherwise -> `handleTool()` in `tools.ts`
   - Within `handleTool()`, agent-proxied tools route to `handleAgentTool()` in `agent-tools.ts`
4. Post-hooks: telemetry, onboarding prompts, pack activation suggestions

### Tool Categories

- **Local tools** (in `tools.ts`): `skills`, `save`, `recall`, `list_tasks`, `create_task`, `complete_task`, `decompose_goal`, `setup_connector`. These run locally, hitting Supabase directly.
- **Insights tools** (in `insights/index.ts`): `search_content`, `get_content_comments`, `get_trending_content`, `platform_status`, `analyze_content`. These use local platform adapters.
- **Agent-proxied tools** (in `agent-tools.ts`): `run_analysis`, `continue_analysis`, `get_analysis`, `list_analyses`, `generate_specs`, `crowd_research`, `submit_observation`, `manage_entities`, `compile_knowledge`, `list_topics`. These proxy to `agent.crowdlisten.com`.

### Authentication

- `npx @crowdlisten/harness login` opens browser, completes OAuth via Supabase, stores tokens at `~/.crowdlisten/auth.json`
- API key is auto-provisioned on first login for agent-proxied tools
- Token refresh happens automatically on MCP server startup
- `--token` flag supports CI/headless environments

### Auto-Install

`autoInstallMcp()` in `tools.ts` writes MCP config entries to:
- Claude Code: `~/.claude.json`
- Cursor: `~/.cursor/mcp.json`
- Gemini CLI: `~/.gemini/settings.json`
- Codex: `codex mcp add` CLI command
- Amp: `~/.config/amp/settings.json`

## Conventions

### Adding a New Tool

1. Define the tool schema in `tools.ts` (local) or `agent-tools.ts` (proxied)
2. Add the tool name to the appropriate pack in `tools/registry.ts`
3. Add a handler case in `handleTool()` or `handleAgentTool()`
4. Update `docs/TOOLS.md` with the full parameter reference
5. Update `AGENTS.md` with a one-line description

### Adding a Backward-Compatible Alias

Add to `TOOL_ALIASES` in `index.ts` with a `paramMap` function that converts old parameter names to the canonical tool's parameter format.

### Adding a SKILL.md Pack

Create a new directory under `skills/` with a `SKILL.md` file. The registry auto-discovers it on startup. No code changes required.

### Adding a Platform Adapter

1. Create a new adapter class in `insights/platforms/{name}/` extending `BaseAdapter`
2. Register it in `insights/service-config.ts`
3. Add it to the `platform` enum in `search_content` and `get_content_comments` tool schemas

## Testing

```bash
npm test              # 210+ tests via Vitest
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # E2E tests (separate config)
```

## Build

```bash
npm run build         # TypeScript compilation
npm run build:web     # Vite build for context web UI
npm run build:catalog # Build skill catalog from SKILL.md files
npm run build:all     # All three builds (runs on prepublishOnly)
```

## Common Issues

- **"Not logged in"**: Run `npx @crowdlisten/harness login` or set `CROWDLISTEN_ACCESS_TOKEN` + `CROWDLISTEN_REFRESH_TOKEN` env vars.
- **Agent-proxied tools fail**: Check that `api_key` exists in `~/.crowdlisten/auth.json`. If missing, run `login` again.
- **Platform unavailable**: Install Playwright (`npx playwright install chromium`) for TikTok, Instagram, Xiaohongshu. Set env vars for Twitter and YouTube.
- **Two tool lists**: Aliases are hidden from `tools/list` but still callable. This is intentional for backward compatibility.
