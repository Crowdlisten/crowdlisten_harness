# CrowdListen Tasks

> A planning and delegation system for AI agents. Plan before you build, capture knowledge as you go, compound learnings across tasks. Works with Claude Code, Cursor, Gemini CLI, Codex, Amp, and more.

Part of the [CrowdListen](https://crowdlisten.com) system: **Feed** captures cross-channel audience signal → **Workspace** converts signal into validated decisions → **Tasks** (this repo) gives agents a planning harness with cloud-synced context.

## Setup

```bash
npx @crowdlisten/kanban login
```

That's it. Your browser opens, you sign in to [CrowdListen](https://crowdlisten.com) (email, Google, whatever you use), and it **auto-configures** any coding agents on your machine. Just restart your agent.

No env vars. No JSON to copy. No API keys.

## How it works

1. Your browser opens to CrowdListen's sign-in page
2. You log in (email/password or Google)
3. The CLI auto-detects and configures your coding agents
4. Restart your agent — it can now plan, execute, and learn with full project context

## Tools

### Task Management

| Tool | Description |
|------|-------------|
| `list_tasks` | List your tasks (uses global board) |
| `create_task` | Add a new task (optionally tag with project_id) |
| `get_task` | Full task details |
| `update_task` | Change title/description/status/priority |
| `claim_task` | Start working — returns project context, knowledge base entries, and existing plan |
| `complete_task` | Mark done with a summary — auto-completes active plan |
| `log_progress` | Log progress notes |
| `delete_task` | Remove a task |

### Planning

| Tool | Description |
|------|-------------|
| `create_plan` | Create an execution plan for a task (draft → review → approved → executing → completed) |
| `get_plan` | Get the plan for a task with version history and pending feedback |
| `update_plan` | Iterate on a plan — update approach, change status, add feedback. Feedback auto-reverts to draft |

### Knowledge Base

| Tool | Description |
|------|-------------|
| `query_context` | Search decisions, constraints, preferences, patterns, learnings, principles |
| `add_context` | Write to the knowledge base — decisions, patterns, principles discovered during work |
| `record_learning` | Capture a learning from completed work. Optionally promote to project-level context |

### Sessions & Boards

| Tool | Description |
|------|-------------|
| `start_session` | Start a parallel agent session for a task |
| `list_sessions` | List all agent sessions for a task |
| `update_session` | Update session status or focus |
| `get_or_create_global_board` | Get your global board (auto-created) |
| `list_projects` | Show your projects |

## Planning workflow

```
1. create_task("Implement user auth")
2. claim_task → returns semantic map + existing context + plan
3. query_context(search="auth") → existing decisions, patterns
4. create_plan(approach="JWT + refresh tokens",
     assumptions=["Server-side validation preferred"],
     success_criteria=["All tests pass", "RLS policies in place"])
5. update_plan(status="review") → human sees plan
6. Human: update_plan(feedback="Also handle 2FA") → auto-reverts to draft
7. Agent: update_plan(approach="JWT + refresh + TOTP 2FA", status="approved")
8. update_plan(status="executing") → agent works
9. add_context(type="pattern", title="Auth endpoints follow /api/v1/auth/*")
10. record_learning(title="TOTP library X was 3x faster than Y", promote=true)
11. complete_task → plan marked completed
12. NEXT TASK: claim_task → semantic map now includes auth patterns + TOTP learning
```

Plans are optional — for quick tasks just `claim_task → execute → record_learning → complete_task`.

## Supported agents

Auto-configured on login:
- **Claude Code** (`~/.claude.json`)
- **Cursor** (`.cursor/mcp.json`)
- **Gemini CLI** (`~/.gemini/settings.json`)
- **Codex** (`~/.codex/config.json`)
- **Amp** (`~/.amp/settings.json`)

Also works with (manual config):
- **OpenClaw**, **Vibe Kanban**, **Copilot**, **Droid**, **Qwen Code**, **OpenCode**

The server auto-detects which agent is running and logs it.

## Manual configuration

If auto-configure doesn't work, add this to your agent's MCP config:

```json
{
  "mcpServers": {
    "crowdlisten_tasks": {
      "command": "npx",
      "args": ["-y", "@crowdlisten/kanban"]
    }
  }
}
```

## Commands

```bash
npx @crowdlisten/kanban login    # Sign in + auto-configure agents
npx @crowdlisten/kanban setup    # Re-run auto-configure
npx @crowdlisten/kanban logout   # Clear credentials
npx @crowdlisten/kanban whoami   # Check current user
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
npm cache clean --force && npx --yes @crowdlisten/kanban@latest login
```

## Contributing

Issues and PRs welcome. This is part of the [CrowdListen](https://crowdlisten.com) open source ecosystem — see also [crowdlisten_sources](https://github.com/Crowdlisten/crowdlisten_sources) for cross-channel feedback analysis.

## License

MIT
