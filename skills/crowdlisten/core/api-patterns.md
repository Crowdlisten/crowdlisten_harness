# API Patterns

## Base URL

```
https://agent.crowdlisten.com
```

## Authentication

All authenticated requests use Bearer token:
```
Authorization: Bearer cl_live_...
```

The API key comes from `.crowdlisten/credentials.json`.

## Request Format

All POST requests use JSON:
```
Content-Type: application/json
```

## Error Responses

All errors follow this envelope:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": null,
    "request_id": "trace-id",
    "retryable": false
  }
}
```

### Common Error Codes

| HTTP | Code | Meaning | Action |
|------|------|---------|--------|
| 401 | AUTH_INVALID | Bad or missing API key | Re-register or check credentials.json |
| 403 | NOT_CLAIMED | Agent not claimed yet | Show claim URL to user |
| 403 | TIER_RESTRICTION | Feature not available at current tier | Run more analyses to upgrade |
| 429 | RATE_LIMIT | Too many requests | Wait and retry (check Retry-After header) |
| 429 | MONTHLY_LIMIT_EXCEEDED | Monthly analysis cap hit | Wait for next month or upgrade tier |
| 500 | DATABASE_ERROR | Server-side error | Retry once |

## Tiers

| Tier | Analyses/Month | Depths | Modes |
|------|---------------|--------|-------|
| verified | 10 | standard | analyze |
| active_partner | 50 | standard, deep | analyze, research |
| research_fellow | unlimited | standard, deep | analyze, research |

Tier upgrades automatically based on `analyses_run` count.

## Retry Strategy

For retryable errors (5xx, 429):
1. Wait 2 seconds
2. Retry once
3. If still failing, report error to user
