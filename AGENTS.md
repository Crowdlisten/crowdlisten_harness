# CrowdListen Planner — Agent Reference

Machine-readable capability description for AI agents.

## Ecosystem

CrowdListen is two MCP servers that work together:
- **Sources** ([crowdlisten](https://github.com/Crowdlisten/crowdlisten_sources)) — discovers audience signal from social platforms
- **Planner** (this server) — plans and tracks work with a cloud-synced knowledge base

Install both with one command: `npx @crowdlisten/planner login`

## Onboard

### One command
```bash
npx @crowdlisten/planner login
```
Auto-configures MCP for Claude Code, Cursor, Gemini CLI, Codex, OpenClaw.

### Manual MCP config
```json
{
  "crowdlisten/harness": {
    "command": "npx",
    "args": ["-y", "@crowdlisten/planner"]
  }
}
```

## Interfaces

| Interface | Access | Best for |
|-----------|--------|----------|
| MCP (this server) | Agents call 20 tools via stdio | AI agents — task management, planning, knowledge |
| CLI | `npx @crowdlisten/planner login/setup/logout/whoami` | Authentication and agent config only |

## Core Workflow (7 steps)

```
list_tasks → claim_task → query_context → create_plan → [human review] → execute → record_learning → complete_task
```

1. **list_tasks** — See what's on the board
2. **claim_task(task_id)** — Start work, get context (semantic map + knowledge base + existing plan)
3. **query_context(search="...")** — Check existing decisions, patterns, learnings
4. **create_plan(task_id, approach="...")** — Draft plan with approach, assumptions, risks
5. **update_plan(plan_id, status="review")** — Submit for human review
6. _Human approves or leaves feedback_ → **get_plan** to check, iterate if needed
7. **Execute** — `update_plan(status="executing")`, work, `log_progress`, `add_context`
8. **record_learning(task_id, ...)** — Capture what you learned (promote=true for project-wide)
9. **complete_task(task_id, summary="...")** — Mark done, plan auto-completed

Plans are optional — quick tasks can skip to execution. Knowledge capture still applies.

## Core Tools (15)

### Task Management

- **list_tasks**(board_id?, status?, limit?) — List tasks on the board. Call first to see available work. Filter: todo, inprogress, inreview, done, cancelled.
- **get_task**(task_id) — Full task details including description, status, priority, labels.
- **create_task**(title, description?, priority?, project_id?, board_id?, labels?) — Create a new task. Uses global board by default.
- **update_task**(task_id, title?, description?, status?, priority?) — Update task fields. Pass only what changes.
- **claim_task**(task_id, executor?, branch?) — Start work. Moves to In Progress, creates workspace + session. Returns context and branch name. Call query_context next.
- **complete_task**(task_id, summary?) — Mark done. Call record_learning first. Auto-completes plan.
- **delete_task**(task_id) — Permanently remove a task.
- **log_progress**(task_id, message, session_id?) — Log a progress note during execution. Useful for agent handoff.

### Planning

- **create_plan**(task_id, approach, assumptions?, constraints?, success_criteria?, risks?, estimated_steps?) — Create execution plan. Call after claim_task + query_context. Submit with update_plan(status='review').
- **get_plan**(task_id) — Get plan with version history and pending human feedback.
- **update_plan**(plan_id, approach?, status?, feedback?, assumptions?, constraints?, success_criteria?, risks?) — Iterate on plan. Set status='review' to submit, status='executing' after approval. Setting feedback auto-reverts to draft.

### Knowledge Base

- **query_context**(project_id?, task_id?, type?, search?, tags?, limit?) — Search decisions, constraints, preferences, patterns, learnings, principles. Call after claim_task.
- **add_context**(type, title, body, project_id?, task_id?, tags?, confidence?, supersedes?) — Write to knowledge base during execution. Types: decision, constraint, preference, pattern, learning, principle.
- **record_learning**(task_id, title, body, learning_type?, tags?, promote?) — Capture learning before complete_task. Types: outcome, pattern, mistake, optimization, decision_record. Use promote=true for project-wide visibility.
- **get_or_create_global_board**() — Get your global board. Call once if you need the board_id.

## Advanced Tools (3) — Parallel Sessions

For multi-agent coordination on a single task. claim_task already creates one session.

- **start_session**(task_id, executor?, focus) — Start additional parallel session.
- **list_sessions**(task_id, status?) — List sessions showing status and focus.
- **update_session**(session_id, status?, focus?) — Update session: idle, running, completed, failed, stopped.

## Setup Tools (2) — Board Management

Rarely needed — get_or_create_global_board handles most cases.

- **list_projects**() — List accessible projects.
- **list_boards**(project_id) — List boards for a project.
- **create_board**(project_id, name?) — Create board with default columns.
- **migrate_to_global_board**() — Consolidate all tasks to global board. Run once.

## Example Workflow

```
# 1. See what's available
list_tasks()

# 2. Claim a task
claim_task(task_id="abc-123")
  → returns: context, workspace_id, branch

# 3. Check existing knowledge
query_context(search="auth patterns")
  → returns: relevant decisions, patterns, learnings

# 4. Create a plan
create_plan(task_id="abc-123", approach="Implement JWT auth with refresh tokens", assumptions=["Node.js backend"], risks=["Token storage security"])

# 5. Submit for review
update_plan(plan_id="plan-456", status="review")

# 6. After human approves, start executing
update_plan(plan_id="plan-456", status="executing")

# 7. During work, capture decisions
add_context(type="decision", title="Use httpOnly cookies for refresh tokens", body="More secure than localStorage", project_id="proj-789")

# 8. Log progress
log_progress(task_id="abc-123", message="Auth middleware complete, starting route protection")

# 9. Capture learning
record_learning(task_id="abc-123", title="httpOnly cookies need CORS credentials", body="Set credentials: 'include' on fetch calls", promote=true)

# 10. Complete
complete_task(task_id="abc-123", summary="JWT auth with refresh tokens implemented")
```
