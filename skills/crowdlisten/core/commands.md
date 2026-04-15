# Full Command Reference

## Discovery

### capabilities
```bash
curl -s https://agent.crowdlisten.com/api/agents/capabilities
```
Returns available platforms, search modes, analysis types, skills, and SDK/MCP install info. No auth required.

### status
```bash
curl -s https://agent.crowdlisten.com/api/agents/me \
  -H "Authorization: Bearer {api_key}"
```
Returns: `status`, `agent_name`, `tier`, `analyses_run`, `claim_url` (if unclaimed).

## Research

### analyze
```bash
curl -s -X POST https://agent.crowdlisten.com/api/agents/analyze \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What do people think about ...",
    "platforms": ["reddit", "twitter"],
    "search_mode": "web_only",
    "depth": "standard"
  }'
```
Returns 202 with `analysis_id` and `poll_url`. See `research/analyze.md`.

### poll
```bash
curl -s https://agent.crowdlisten.com/api/agents/analyze/{analysis_id} \
  -H "Authorization: Bearer {api_key}"
```
Returns `status: "processing"` or `status: "complete"` with full results.

### analyze --stream (direct API)
```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/analysis/run \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"question": "...", "project_id": "..."}'
```
SSE stream with real-time analysis progress. See `research/analyze.md`.

## Observations

### observe
```bash
curl -s -X POST https://agent.crowdlisten.com/api/observations/submit \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "observations": [{"content": "...", "type": "feedback", "severity": "medium"}],
    "project_id": "..."
  }'
```

### feed
```bash
curl -s "https://agent.crowdlisten.com/api/observations/feed?project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

### themes
```bash
curl -s "https://agent.crowdlisten.com/api/observations/themes?project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

## Entities

### track
```bash
curl -s -X POST https://agent.crowdlisten.com/api/entities \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Company Name", "tags": ["competitor"]}'
```

### entities
```bash
curl -s https://agent.crowdlisten.com/api/entities \
  -H "Authorization: Bearer {api_key}"
```

### enrich
```bash
curl -s -X POST https://agent.crowdlisten.com/api/entities/{entity_id}/enrich \
  -H "Authorization: Bearer {api_key}"
```

## Memory

### save
```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/context/save \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Key Finding",
    "content": "...",
    "tags": ["research", "competitor"],
    "project_id": "..."
  }'
```

### recall
```bash
curl -s "https://agent.crowdlisten.com/agent/v1/context/recall?query=competitor+pricing&project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

## Tasks

### list tasks
```bash
curl -s "https://agent.crowdlisten.com/agent/v1/tasks/cards/{card_id}/workspaces" \
  -H "Authorization: Bearer {api_key}"
```

### start task
```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/tasks/tasks/{card_id}/start \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"card_id": "...", "executor": "SDK_AGENT"}'
```

### update task status
```bash
curl -s -X PATCH https://agent.crowdlisten.com/agent/v1/tasks/cards/{card_id}/status \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```
