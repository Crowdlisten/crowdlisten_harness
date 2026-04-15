# Memory: Save & Recall Knowledge

Save research findings, decisions, and context. Recall uses semantic search (vector similarity) with keyword fallback.

## Save

```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/context/save \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Competitor pricing analysis",
    "content": "Acme charges $49/mo for basic, $199/mo for pro. Key differentiator is their API access tier.",
    "tags": ["competitor", "pricing", "acme"],
    "project_id": "project-uuid"
  }'
```

### Save Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Short title for the knowledge entry |
| `content` | string | yes | The knowledge content (markdown supported) |
| `tags` | array | no | Classification tags for filtering |
| `project_id` | string | no | Associate with a specific project |

## Recall

```bash
curl -s "https://agent.crowdlisten.com/agent/v1/context/recall?query=competitor+pricing&project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

### Recall Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Search query (semantic + keyword) |
| `project_id` | string | no | Scope to a project |
| `limit` | int | no | Max results (default 10) |

### How Recall Works

1. Generates embedding for your query
2. Finds semantically similar entries (cosine similarity)
3. Falls back to keyword search (ILIKE) if embedding search returns nothing
4. Returns ranked results with relevance scores

## Tips

- **Save after analysis**: After running a crowd analysis, save key findings as knowledge
- **Use tags**: Tag entries consistently for better organization
- **Be specific in titles**: "Acme Q1 2026 pricing" > "pricing info"
- **Recall before analyzing**: Check what you already know before running a new analysis
