# Entities: Track Companies & Competitors

Track companies, products, and competitors over time. Entities get enriched with crowd data automatically.

## Track a New Entity

```bash
curl -s -X POST https://agent.crowdlisten.com/api/entities \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "type": "company",
    "tags": ["competitor", "series-b"],
    "description": "Direct competitor in the analytics space",
    "project_id": "project-uuid"
  }'
```

## List Entities

```bash
curl -s "https://agent.crowdlisten.com/api/entities?project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

## Enrich an Entity

Trigger crowd research about a specific entity:

```bash
curl -s -X POST https://agent.crowdlisten.com/api/entities/{entity_id}/enrich \
  -H "Authorization: Bearer {api_key}"
```

This runs a background analysis focused on the entity (what people are saying, sentiment, recent news).

## Trigger Research for All Entities

```bash
curl -s -X POST https://agent.crowdlisten.com/api/entities/trigger-research \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "..."}'
```

## Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Entity name |
| `type` | string | no | `company`, `product`, `person`, `topic` |
| `tags` | array | no | Classification tags |
| `description` | string | no | Context about the entity |
| `project_id` | string | no | Associate with a project |

## Use Cases

- **Competitive monitoring**: Track competitors, enrich periodically
- **Market mapping**: Track key players in your space
- **Trend tracking**: Track products/technologies to monitor sentiment over time
