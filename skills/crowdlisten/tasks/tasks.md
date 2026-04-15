# Tasks: Create, Start, Complete

Manage research tasks and track work across projects.

## Start a Task

Assign yourself to an existing task card:

```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/tasks/tasks/{card_id}/start \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "card_id": "card-uuid",
    "executor": "SDK_AGENT",
    "base_branch": "main"
  }'
```

**Response**:
```json
{
  "success": true,
  "workspace": { "id": "...", "card_id": "...", "name": "...", "branch_name": "task/abc123" },
  "session": { "id": "...", "workspace_id": "...", "executor": "SDK_AGENT" },
  "card_status": "inprogress"
}
```

## Update Task Status

```bash
curl -s -X PATCH https://agent.crowdlisten.com/agent/v1/tasks/cards/{card_id}/status \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

### Status Values

| Status | Meaning |
|--------|---------|
| `todo` | Not started |
| `inprogress` | Being worked on |
| `inreview` | Awaiting review |
| `done` | Completed |
| `cancelled` | Cancelled |

## Get Workspaces for a Card

```bash
curl -s "https://agent.crowdlisten.com/agent/v1/tasks/cards/{card_id}/workspaces" \
  -H "Authorization: Bearer {api_key}"
```

## Create a Workspace

```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/tasks/workspaces \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "card_id": "card-uuid",
    "name": "Research workspace",
    "base_branch": "main"
  }'
```

## Workflow

1. **Find a task**: Get card_id from the project board
2. **Start it**: POST to `/tasks/{card_id}/start` — creates workspace + session
3. **Do the work**: Run analyses, save knowledge, submit observations
4. **Complete it**: PATCH status to `done`
