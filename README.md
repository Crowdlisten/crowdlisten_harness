# CrowdListen Harness

> Allow your agent to learn from experience, create an evolving library of context for agent swarms.

[English](README.md) | [中文文档](README-CN.md)

## The Problem With AI Agents Today

AI agents are stateless. Every time you start a new session, your agent starts from scratch. It doesn't remember what it decided yesterday, why it chose one approach over another, or what patterns it discovered in your codebase last week. You end up re-explaining the same context, correcting the same mistakes, and watching it rediscover the same solutions.

This gets worse when you use multiple agents. Your Claude Code session figured out your team's deployment conventions, but when you switch to Cursor for a quick fix, that knowledge is gone. When Gemini CLI picks up a task overnight, it has no idea what happened before it arrived. Every agent is an island.

CrowdListen Harness fixes this. It gives your agents a shared, cloud-synced knowledge base that persists across sessions, across tools, and across agents. Every task your agent completes captures decisions, patterns, and learnings. The next task inherits all of it. Over time, your agents don't just execute — they get smarter.

## What You Get

**A knowledge base that compounds.** When your agent makes an architectural decision, resolves a tricky bug, or discovers a pattern in your codebase, CrowdListen Harness captures it. The next time any agent works on a related task, that knowledge is surfaced automatically. You stop re-explaining context and start building on what came before.

**Plans as first-class artifacts.** Most task trackers treat plans as free-text descriptions. CrowdListen Harness treats them as versioned, reviewable artifacts with a lifecycle: draft, review, approved, executing, done. Your agent drafts a plan. You review it, leave feedback. The agent incorporates your notes, archives the previous version, and proceeds. Every decision and iteration is preserved.

**Context that follows you across agents.** Switch from Claude Code to Cursor to Gemini CLI — the knowledge base comes with you. Cloud-synced through Supabase, so no matter which agent picks up the work, it has the full history of what was tried, what worked, and what didn't.

**Multi-agent coordination.** Run multiple agents on the same task with parallel sessions. Each agent gets shared context and can contribute learnings back. Useful for breaking large tasks into parallel workstreams without losing coherence.

## Try It Now

One command. Your browser opens, you sign in, and your agents are configured automatically:

```bash
npx @crowdlisten/planner login
```

This auto-configures MCP for Claude Code, Cursor, Gemini CLI, Codex, and OpenClaw. It also installs [CrowdListen Insights](https://github.com/Crowdlisten/crowdlisten_insights) for cross-platform audience intelligence. No env vars, no JSON editing, no API keys to manage.

Restart your agent after login, and it can start calling tools immediately.

### Manual Setup

If you prefer to configure manually, add this to your agent's MCP config:

```json
{
  "mcpServers": {
    "crowdlisten/planner": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/planner"]
    }
  }
}
```

Or sign in at [crowdlisten.com](https://crowdlisten.com) and your agent can read [AGENTS.md](AGENTS.md) for the full tool reference.

## How It Works

CrowdListen Harness is an MCP server — your agent calls its 22 tools directly, the same way it calls any other MCP tool. The typical workflow looks like this:

1. **Pick up a task.** Your agent calls `list_tasks` to see what's available, then `claim_task` to start work. When it claims a task, it receives the full context: relevant knowledge base entries, existing plans, and a semantic map of related decisions.

2. **Plan before you build.** For non-trivial work, the agent calls `create_plan` to draft an approach with assumptions, risks, and success criteria. You review the plan, leave feedback, and the agent iterates until you approve. Every version is archived.

3. **Execute with context.** While working, the agent logs progress and records decisions with `add_context`. These aren't throwaway notes — they become searchable knowledge that future tasks can query.

4. **Capture what you learned.** When the task is done, the agent calls `record_learning` to crystallize what it discovered. Promote a learning to project scope and every future agent session can find it.

5. **The next task is smarter.** When the next task starts, `query_context` searches across all accumulated decisions, patterns, and learnings. Your agent doesn't start from scratch — it starts from everything that came before.

Plans are optional. Quick tasks can skip straight to execution. But the knowledge capture always applies, so even small tasks contribute to the growing context.

## The CrowdListen Ecosystem

CrowdListen is two MCP servers that work together:

**Insights** discovers what audiences are saying across social platforms — Reddit, YouTube, TikTok, Twitter, Instagram, Xiaohongshu, and more. **Harness** turns that signal into planned, tracked work with a knowledge base that compounds across every task. Together, your agent can research a topic, plan a response, execute it, and remember what it learned for next time.

```bash
# Install both with one command
npx @crowdlisten/planner login
```

## MCP Tools

### Task Management

| Tool | What it does |
|------|-------------|
| `list_tasks` | List tasks on the board (call first) |
| `get_task` | Full task details |
| `create_task` | Create a new task |
| `update_task` | Change title, description, status, priority |
| `claim_task` | Start work — returns context, workspace, branch |
| `complete_task` | Mark done, auto-complete plan |
| `delete_task` | Permanently remove a task |
| `log_progress` | Log a note to the execution session |

### Planning

| Tool | What it does |
|------|-------------|
| `create_plan` | Create execution plan (approach, assumptions, risks) |
| `get_plan` | Get plan with version history and feedback |
| `update_plan` | Iterate: update approach, status, or add feedback |

### Knowledge Base

| Tool | What it does |
|------|-------------|
| `query_context` | Search decisions, patterns, learnings |
| `add_context` | Write to knowledge base |
| `record_learning` | Capture outcome, optionally promote to project scope |
| `get_or_create_global_board` | Get your global board |

### Multi-Agent Sessions

| Tool | What it does |
|------|-------------|
| `start_session` | Start parallel agent session for multi-agent work |
| `list_sessions` | List sessions for a task |
| `update_session` | Update session status/focus |

### Board Management

| Tool | What it does |
|------|-------------|
| `list_projects` | List accessible projects |
| `list_boards` | List boards for a project |
| `create_board` | Create board with default columns |
| `migrate_to_global_board` | Move all tasks to global board |

Full parameter details: [docs/TOOLS.md](docs/TOOLS.md)

## Supported Agents

**Auto-configured on login:** Claude Code, Cursor, Gemini CLI, Codex, OpenClaw

**Also works with (manual config):** Copilot, Droid, Qwen Code, OpenCode

## Commands

```bash
npx @crowdlisten/planner login    # Sign in + auto-configure agents
npx @crowdlisten/planner setup    # Re-run auto-configure
npx @crowdlisten/planner logout   # Clear credentials
npx @crowdlisten/planner whoami   # Check current user
```

## For Agents

See [AGENTS.md](AGENTS.md) for machine-readable capability descriptions, MCP config, and example workflows.

## Configuration

### Environment Variables

CrowdListen Harness uses sensible defaults. These are only needed if you're self-hosting or overriding the default backend:

| Variable | Default | Description |
|----------|---------|-------------|
| `CROWDLISTEN_URL` | `https://crowdlisten.com` | Supabase project URL |
| `CROWDLISTEN_ANON_KEY` | Built-in default | Supabase anonymous key |
| `CROWDLISTEN_APP_URL` | `https://crowdlisten.com` | Web app URL (used for login redirects) |

### Auto-Executor Detection

When your agent calls `claim_task` or `start_session` without specifying an executor, Harness auto-detects which agent is running by checking environment variables:

| Agent | Detection |
|-------|-----------|
| Claude Code | `CLAUDE_CODE=1` or `CLAUDE_SESSION_ID` |
| Cursor | `CURSOR_SESSION_ID` or `CURSOR_TRACE_ID` |
| Gemini CLI | `GEMINI_CLI` |
| Codex | `CODEX_SESSION_ID` |
| OpenClaw | `OPENCLAW_SESSION` or `OPENCLAW_AGENT` |
| Amp | `AMP_SESSION_ID` |

This means task ownership is automatically attributed to the right agent without any configuration.

## Development

```bash
git clone https://github.com/Crowdlisten/crowdlisten_harness.git
cd crowdlisten_harness
npm install && npm run build
npm test    # 210 tests via Vitest
```

## License

MIT — [crowdlisten.com](https://crowdlisten.com)
