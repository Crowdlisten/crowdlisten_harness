# Observations: Submit Signals & View Themes

Observations are structured signals — user feedback, bug reports, competitive intel, feature requests. They get clustered into themes automatically.

## Submit Observations

```bash
curl -s -X POST https://agent.crowdlisten.com/api/observations/submit \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "observations": [
      {
        "content": "Users are complaining about slow load times on mobile",
        "type": "feedback",
        "severity": "high",
        "source": "support_tickets",
        "metadata": {}
      }
    ],
    "project_id": "project-uuid"
  }'
```

### Observation Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| `content` | string | yes | The signal text |
| `type` | string | no | `feedback`, `bug`, `feature_request`, `competitive_intel`, `signal` |
| `severity` | string | no | `low`, `medium`, `high`, `critical` |
| `source` | string | no | Where this came from (e.g., `support_tickets`, `slack`, `manual`) |
| `metadata` | object | no | Any extra structured data |

### Batch Submit

You can submit up to 50 observations at once. Deduplication is automatic (content_hash).

## View Feed

```bash
curl -s "https://agent.crowdlisten.com/api/observations/feed?project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

Returns observations ordered by recency with type and severity.

## View Themes

```bash
curl -s "https://agent.crowdlisten.com/api/observations/themes?project_id={pid}" \
  -H "Authorization: Bearer {api_key}"
```

Returns clustered themes with:
- Theme name and description
- Observation count
- Severity distribution
- Trend direction (growing, stable, declining)

## Get Theme Detail

```bash
curl -s "https://agent.crowdlisten.com/api/observations/themes/{theme_id}" \
  -H "Authorization: Bearer {api_key}"
```

## Trigger Processing

Force theme re-clustering:

```bash
curl -s -X POST https://agent.crowdlisten.com/api/observations/process \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "..."}'
```

## Use Cases

- **During analysis**: Submit notable findings as observations for long-term tracking
- **Bug triage**: Submit user-reported bugs with severity for theme clustering
- **Competitive intel**: Submit competitor moves for trend tracking
- **Feature requests**: Capture and cluster user requests by theme
