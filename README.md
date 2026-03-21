# CrowdListen Tasks

> A planning and delegation system for AI agents. Plan before you build, capture knowledge as you go, compound learnings across tasks. Works with Claude Code, Cursor, Gemini CLI, Codex, Amp, and more.

Part of the [CrowdListen](https://crowdlisten.com) system: **Feed** captures cross-channel audience signal → **Workspace** converts signal into validated decisions → **Tasks** (this repo) gives agents a planning harness with cloud-synced context.

## Setup

```bash
npx @crowdlisten/planner login
```

That's it. Your browser opens, you sign in to [CrowdListen](https://crowdlisten.com) (email, Google, whatever you use), and it **auto-configures** any coding agents on your machine. Just restart your agent.

No env vars. No JSON to copy. No API keys.

## The idea

Most agent tooling gives agents a task list and says "go." That's like handing a contractor a list of rooms to paint without telling them the color, the budget, or that the client hates eggshell finish.

CrowdListen Tasks flips this. It's a **planning harness** — not a task board that happens to have plans, but a planning system that happens to have tasks. The identity shift matters:

**Before**: Task → Execute → Hope it's right
**After**: Task → Plan → Get feedback → Execute with context → Capture what you learned → Next task is smarter

### Three layers

```
┌─────────────────────────────────────────────────┐
│  KNOWLEDGE BASE                                 │
│  Decisions, constraints, patterns, principles,  │
│  learnings — persists across all tasks           │
├─────────────────────────────────────────────────┤
│  PLANS                                          │
│  First-class artifacts with lifecycle:           │
│  draft → review → approved → executing → done   │
├─────────────────────────────────────────────────┤
│  TASKS                                          │
│  Executable work units with status tracking     │
└─────────────────────────────────────────────────┘
```

**Knowledge compounds.** When an agent finishes a task and records "TOTP library X was 3x faster than Y," that learning shows up in the context for the next agent that claims a task on the same project. Decisions don't get relitigated. Patterns don't get reinvented. Mistakes don't get repeated.

**Plans are reviewable.** A human can read the plan, leave feedback ("also handle 2FA"), and the plan auto-reverts to draft for the agent to iterate on. No more reviewing 500 lines of code that went in the wrong direction.

**Context is cloud-synced.** The knowledge base lives in Supabase, not in a local file. Claude Code, Cursor, Codex, and any other MCP-compatible agent all read and write to the same context. Start a task in Claude Code, continue it in Cursor — the context follows.

### What's in the knowledge base

Every entry has a **type** that tells you what kind of knowledge it is:

| Type | What it captures | Example |
|------|-----------------|---------|
| `decision` | Choices made and why | "Chose JWT over sessions for stateless API" |
| `constraint` | Hard boundaries | "Must support IE11" / "Budget is $5k/mo" |
| `preference` | Soft preferences | "Use Tailwind" / "Prefer functional style" |
| `pattern` | Conventions discovered | "All API routes follow /api/v1/{resource}" |
| `learning` | Outcomes from work | "Redis caching reduced latency 40%" |
| `principle` | Standing rules | "Never store PII in logs" |

Entries can be scoped to a project (visible to all tasks) or to a specific task. Learnings can be **promoted** from task scope to project scope so future tasks benefit.

Each entry tracks **provenance** — who wrote it (human or agent), which agent, and a confidence score. Entries can be **superseded** (replaced by newer versions) or marked **stale** when they may no longer apply.

### How plans work

Plans are first-class artifacts, not comments on a task. They have:

- **Structured fields**: approach, assumptions, constraints, success criteria, risks
- **A lifecycle**: `draft` → `review` → `approved` → `executing` → `completed`
- **Version history**: every content change or feedback archives the previous version
- **Feedback loop**: setting feedback auto-reverts the plan to `draft`

One active plan per task (enforced by unique index). When the task completes, the plan auto-completes too.

```
Agent creates plan (draft)
  → Agent submits for review
    → Human leaves feedback → plan reverts to draft
      → Agent iterates → submits again
        → Human approves
          → Agent executes
            → Task completes → plan completes
```

## How it flows

### Full planning workflow

```
1.  create_task("Implement user auth")

2.  claim_task(task_id)
    → Returns: project context (semantic map), knowledge base entries,
      existing plan (if any), workspace + session

3.  query_context(search="auth")
    → Returns: existing decisions, patterns, learnings about auth

4.  create_plan(
      task_id,
      approach="JWT + refresh tokens",
      assumptions=["Server-side validation preferred"],
      success_criteria=["All tests pass", "RLS policies in place"]
    )
    → Creates draft plan

5.  update_plan(status="review")
    → Human can now see and review the plan

6.  Human: update_plan(feedback="Also handle 2FA")
    → Plan auto-reverts to draft, feedback stored in metadata

7.  Agent: update_plan(
      approach="JWT + refresh + TOTP 2FA",
      status="approved"
    )
    → Version 1 archived, plan now v2 approved

8.  update_plan(status="executing")
    → Agent starts working

9.  add_context(
      type="pattern",
      title="Auth endpoints follow /api/v1/auth/*",
      body="Login at POST /api/v1/auth/login, refresh at POST /api/v1/auth/refresh..."
    )
    → Pattern persists in knowledge base for future tasks

10. record_learning(
      task_id,
      title="TOTP library X was 3x faster than Y",
      body="Benchmarked totp-generator vs otpauth...",
      promote=true
    )
    → Learning saved to task AND promoted to project level

11. complete_task(task_id, summary="Implemented JWT auth with TOTP 2FA")
    → Task done, plan auto-completed

12. NEXT TASK: claim_task
    → Semantic map now includes auth patterns + TOTP learning
```

### Quick task (no plan needed)

```
claim_task → query_context → execute → record_learning → complete_task
```

Plans are optional. The knowledge base and learning capture still apply.

### Multi-agent collaboration

```
Agent A: create_plan → get approval → update_plan(status=approved)
Agent B: start_session(focus="backend") → query_context → execute
Agent C: start_session(focus="frontend") → query_context → execute
All agents: add_context + record_learning → shared knowledge base
```

## Tools

### Task Management

| Tool | Description |
|------|-------------|
| `list_tasks` | List your tasks (uses global board by default) |
| `create_task` | Create a task, optionally tagged with a project |
| `get_task` | Full task details including board and column |
| `update_task` | Change title, description, status, or priority |
| `claim_task` | Start working — moves to In Progress, returns project context + knowledge base + plan |
| `complete_task` | Mark done with summary — auto-completes active plan |
| `log_progress` | Log a progress note to the execution session |
| `delete_task` | Remove a task |

### Planning

| Tool | Description |
|------|-------------|
| `create_plan` | Create an execution plan for a task with approach, assumptions, criteria, risks |
| `get_plan` | Get the active plan for a task with full version history |
| `update_plan` | Iterate: update approach, change status, add feedback (feedback auto-reverts to draft) |

### Knowledge Base

| Tool | Description |
|------|-------------|
| `query_context` | Search by project, task, type, tags, or full-text. Returns active entries |
| `add_context` | Write a decision, constraint, preference, pattern, or principle |
| `record_learning` | Capture an outcome from work. `promote=true` copies to project level |

### Sessions & Boards

| Tool | Description |
|------|-------------|
| `start_session` | Start a parallel agent session with a focus area |
| `list_sessions` | List sessions for a task with status and focus |
| `update_session` | Update session status or focus |
| `get_or_create_global_board` | Get your global board (auto-created on first use) |
| `list_projects` | List projects you have access to |
| `list_boards` | List boards for a project |
| `create_board` | Create a new board with default columns |
| `migrate_to_global_board` | Move all tasks to the global board |

## Architecture

### Data model

Two tables handle everything:

**`planning_context`** — Every piece of knowledge: plans, decisions, constraints, patterns, learnings, principles. Differentiated by `type`. Scoped to user + optional project + optional task.

**`planning_context_versions`** — Immutable snapshots. When a plan's content changes or feedback is given, the current state is archived here before the update.

### How context flows into tasks

When an agent calls `claim_task`, three things happen:

1. **Semantic map** (`buildProjectContextMd`) assembles markdown from the project's PRD, research analyses, documents, insights, and active knowledge base entries
2. **Context entries** — the raw knowledge base rows (decisions, patterns, etc.) for the project
3. **Existing plan** — if someone already created a plan for this task, it's returned

This is progressive disclosure: the semantic map gives a high-level overview, context entries give structured detail, and `query_context` lets the agent drill deeper.

### Cloud-synced, not local

Everything lives in Supabase with row-level security. Any MCP-compatible agent reads and writes to the same knowledge base. Start planning in Claude Code, execute in Cursor, review in the CrowdListen web app — the context follows.

## Supported agents

Auto-configured on login:
- **Claude Code** (`~/.claude.json`)
- **Cursor** (`.cursor/mcp.json`)
- **Gemini CLI** (`~/.gemini/settings.json`)
- **Codex** (`~/.codex/config.json`)
- **Amp** (`~/.amp/settings.json`)

Also works with (manual config):
- **OpenClaw**, **Copilot**, **Droid**, **Qwen Code**, **OpenCode**

The server auto-detects which agent is running and logs it.

## Manual configuration

If auto-configure doesn't work, add this to your agent's MCP config:

```json
{
  "mcpServers": {
    "crowdlisten_tasks": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/planner"]
    }
  }
}
```

## Commands

```bash
npx @crowdlisten/planner login    # Sign in + auto-configure agents
npx @crowdlisten/planner setup    # Re-run auto-configure
npx @crowdlisten/planner logout   # Clear credentials
npx @crowdlisten/planner whoami   # Check current user
```

## Multi-user

Each person logs in with their own CrowdListen account. Row-level security means they only see their own data. Multiple users can work on shared projects simultaneously.

## Development

```bash
git clone https://github.com/Crowdlisten/crowdlisten_tasks.git
cd crowdlisten_tasks
npm install
npm run build
npm run dev     # Run with tsx
npm test        # Vitest
```

## Troubleshooting

**"command not found" on first run?**
```bash
npm cache clean --force && npx --yes @crowdlisten/planner@latest login
```

## Contributing

Issues and PRs welcome. This is part of the [CrowdListen](https://crowdlisten.com) open source ecosystem — see also [crowdlisten_sources](https://github.com/Crowdlisten/crowdlisten_sources) for cross-channel feedback analysis.

## License

MIT
