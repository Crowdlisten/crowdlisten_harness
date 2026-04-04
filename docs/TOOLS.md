# Tools Reference

Full parameter documentation for CrowdListen Harness tools.

## Task Management

### `create_task`
Create a new task on your board.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `title` | Yes | Task title |
| `description` | No | Detailed description |
| `board_id` | No | Target board (defaults to global board) |
| `priority` | No | `low`, `medium`, `high` |
| `project_id` | No | Associate with a project |
| `labels` | No | Label objects `[{name, color}]` |

### `claim_task`
Start working on a task. Moves to In Progress, creates workspace + session.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to claim |
| `executor` | No | Agent type: CLAUDE_CODE, CURSOR, GEMINI, CODEX, AMP, OPENCLAW, etc. |
| `branch` | No | Custom git branch name (auto-generated if omitted) |

**Returns**: `task_id`, `workspace_id`, `session_id`, `branch`, `executor`, `status`, `context_entries[]`, `existing_plan`

### `complete_task`
Mark task as done. Auto-completes any active plan.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to complete |
| `summary` | No | Completion summary |

### `get_task`
Full task details including board and column info.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to retrieve |

### `update_task`
Change title, description, status, or priority.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to update |
| `title` | No | New title |
| `description` | No | New description |
| `status` | No | `todo`, `inprogress`, `inreview`, `done`, `cancelled` |
| `priority` | No | `low`, `medium`, `high` |

### `list_tasks`
List tasks, optionally filtered.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `board_id` | No | Filter by board (defaults to global) |
| `status` | No | Filter by status |
| `limit` | No | Max results (default 50) |

### `delete_task`
Remove a task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to delete |

### `log_progress`
Log a progress note to the execution session.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to log against |
| `message` | Yes | Progress message |
| `session_id` | No | Specific session (defaults to most recent) |

## Planning

### `create_plan`
Create an execution plan for a task. Status starts as `draft`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task this plan is for |
| `approach` | Yes | The proposed approach |
| `assumptions` | No | List of assumptions |
| `constraints` | No | Known constraints |
| `success_criteria` | No | How to know it's done |
| `risks` | No | Identified risks |
| `estimated_steps` | No | Estimated number of steps |

**Returns**: `{ plan_id, status: "draft", version: 1 }`

### `get_plan`
Get the active plan for a task with version history.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to get plan for |

**Returns**: `{ plan, versions[] }` or `{ plan: null, message: "No active plan" }`

### `update_plan`
Iterate on a plan. Content changes archive the current version. Setting feedback auto-reverts status to `draft`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `plan_id` | Yes | Plan to update |
| `approach` | No | Updated approach |
| `status` | No | `draft`, `review`, `approved`, `executing` |
| `feedback` | No | Feedback (auto-reverts to draft) |
| `assumptions` | No | Updated assumptions |
| `constraints` | No | Updated constraints |
| `success_criteria` | No | Updated criteria |
| `risks` | No | Updated risks |

**Returns**: `{ plan_id, version, status }`

## Knowledge Base

Supabase is the source of truth. Local `.md` files at `~/.crowdlisten/context/` are a rendered cache that agents browse via `INDEX.md`.

### `save`
Save context that persists across sessions. Renders to `~/.crowdlisten/context/`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `title` | Yes | Short title |
| `content` | Yes | The content to remember |
| `tags` | No | Freeform tags (e.g. `['decision', 'auth', 'pattern']`) |
| `project_id` | No | Optional project scope |
| `task_id` | No | Optional task association |
| `confidence` | No | 0.0--1.0 (default 1.0) |

**Returns**: `{ saved, id, title, tags, supabase }`

### `recall`
Search saved context using keyword matching.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `search` | No | Search query (matches title and content) |
| `tags` | No | Filter by tags (array) |
| `project_id` | No | Filter by project |
| `limit` | No | Max results (default 20) |

**Returns**: `{ memories[], count, search_mode, index_path }`

For structured browsing, read `~/.crowdlisten/context/INDEX.md` directly.

### `sync_context`
Pull all context from cloud and rebuild local `.md` knowledge base.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `full` | No | Force full rebuild (default: true) |

**Returns**: `{ synced, entry_count, index_path, meta }`

### `compile_context`
Organize knowledge base: detect duplicates, group by topic, rebuild INDEX.md.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `dry_run` | No | Preview only, no file changes (default: false) |

**Returns**: `{ total_entries, tag_groups, topic_candidates, duplicates, hint }`

### `publish_context`
Publish a saved memory to your team.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `memory_id` | Yes | Memory UUID to publish |
| `team_id` | Yes | Team UUID to share with |

**Returns**: `{ published, memory_id, team_id }`

## Sessions & Boards

### `start_session`
Start a parallel agent session with a focus area.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to work on |
| `focus` | Yes | What this session focuses on |

### `list_sessions`
List sessions for a task.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task_id` | Yes | Task to list sessions for |
| `status` | No | Filter: `idle`, `running`, `completed`, `failed`, `stopped` |

### `update_session`
Update session status or focus.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `session_id` | Yes | Session to update |
| `status` | No | New status |
| `focus` | No | Updated focus |

### `get_or_create_global_board`
Get your global board (auto-created on first use). No parameters.

### `list_projects`
List projects you have access to. No parameters.

### `list_boards`
List boards for a project.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project to list boards for |

### `create_board`
Create a new board with default columns.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `project_id` | Yes | Project to create board in |
| `name` | No | Board name (default: "Tasks") |

### `migrate_to_global_board`
Move all tasks to the global board. No parameters.
