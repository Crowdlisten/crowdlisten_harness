# CrowdListen Kanban MCP Server

Connect any coding agent to your CrowdListen task board.

## Setup

```bash
npx @crowdlisten/kanban-mcp login
```

That's it. Your browser opens, you sign in to CrowdListen (email, Google, whatever you use), and it **auto-configures** any coding agents on your machine. Just restart your agent.

No env vars. No JSON to copy. No API keys.

## How it works

1. Your browser opens to CrowdListen's sign-in page
2. You log in (email/password or Google)
3. The MCP server auto-detects and configures your coding agents
4. Restart your agent — it can now see your kanban board and work on tasks

## What your agent can do

All tasks go to **one global board** by default. No need to manage projects or boards.

| Tool | Description |
|------|-------------|
| `list_tasks` | List your tasks (uses global board) |
| `create_task` | Add a new task (optionally tag with project_id) |
| `get_task` | Full task details |
| `update_task` | Change title/description/status/priority |
| `claim_task` | Start working — auto-moves to "In Progress" |
| `complete_task` | Mark done with a summary |
| `log_progress` | Log progress notes |
| `delete_task` | Remove a task |
| `get_or_create_global_board` | Get your global board (auto-created) |
| `list_projects` | Show your projects (for tagging) |

## Example

Tell your coding agent:

> "Create a task to fix the login bug"

```
create_task(title: "Fix login bug")
→ { task_id: "xxx", status: "created" }
```

> "Show me my todo tasks"

```
list_tasks(status: "todo")
→ { tasks: [...], count: 5 }
```

> "Claim the top task and start working"

```
claim_task(task_id: "xxx")
→ { status: "claimed", branch: "task/fix-login-bug-xxx" }
```

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
      "args": ["-y", "@crowdlisten/kanban-mcp"]
    }
  }
}
```

## Commands

```bash
npx @crowdlisten/kanban-mcp login    # Sign in + auto-configure agents
npx @crowdlisten/kanban-mcp setup    # Re-run auto-configure
npx @crowdlisten/kanban-mcp logout   # Clear credentials
npx @crowdlisten/kanban-mcp whoami   # Check current user
```

## Troubleshooting

**"command not found" on first run?**
```bash
npm cache clean --force && npx --yes @crowdlisten/kanban-mcp@latest login
```

## Multi-user

Each person logs in with their own CrowdListen account. Row-level security means they only see their own data. Multiple users can work on shared projects simultaneously.
