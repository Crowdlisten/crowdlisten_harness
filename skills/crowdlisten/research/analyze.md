# Research: Run Crowd Analysis

## Quick Start (Async)

The simplest path: submit a query, poll for results.

### 1. Submit

```bash
curl -s -X POST https://agent.crowdlisten.com/api/agents/analyze \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What do developers think about AI code review tools?",
    "depth": "standard",
    "platforms": ["reddit", "twitter"],
    "search_mode": "web_only"
  }'
```

**Response** (202):
```json
{
  "analysis_id": "7b7d26bf-...",
  "status": "queued",
  "estimated_seconds": 30,
  "poll_url": "https://agent.crowdlisten.com/api/agents/analyze/7b7d26bf-..."
}
```

### 2. Poll

Wait ~10 seconds, then poll:

```bash
curl -s https://agent.crowdlisten.com/api/agents/analyze/{analysis_id} \
  -H "Authorization: Bearer {api_key}"
```

**Response** (processing):
```json
{ "status": "processing", "analysis_id": "..." }
```

**Response** (complete):
```json
{
  "status": "complete",
  "analysis_id": "...",
  "query": "What do developers think about AI code review tools?",
  "summary": "Most feedback highlights productivity gains with caution about false positives.",
  "sentiment": { "positive": 45, "neutral": 40, "negative": 15 },
  "themes": ["workflow speed", "false positives", "privacy concerns"],
  "key_opinions": ["Great for standard checks", "Needs better context handling"],
  "related_questions": ["Which tools handle large repos best?"],
  "source_count": 18,
  "share_url": "https://crowdlisten.com/analysis/..."
}
```

**Poll strategy**: Check every 5 seconds for up to 2 minutes.

### 3. Present Results

Format the results for the user:
- Lead with `summary`
- Show `sentiment` breakdown
- List `themes` as bullet points
- Quote notable `key_opinions`
- Offer `related_questions` as follow-up options
- Mention `source_count` for credibility

## Advanced: Streaming Analysis

For real-time results with progress updates (SSE):

```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/analysis/run \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What do developers think about AI code review tools?",
    "project_id": "optional-project-uuid"
  }'
```

This returns an SSE stream. Each event contains progress updates and partial results.

## Continue Analysis

Follow up on an existing analysis:

```bash
curl -s -X POST https://agent.crowdlisten.com/agent/v1/analysis/{analysis_id}/continue \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{"question": "Dig deeper into the privacy concerns"}'
```

## Get Past Analysis

```bash
curl -s https://agent.crowdlisten.com/agent/v1/analysis/{analysis_id} \
  -H "Authorization: Bearer {api_key}"
```

## List Project Analyses

```bash
curl -s https://agent.crowdlisten.com/agent/v1/projects/{project_id}/analyses \
  -H "Authorization: Bearer {api_key}"
```

## Parameters

| Param | Type | Default | Options |
|-------|------|---------|---------|
| `query` | string | required | Free-text research question |
| `depth` | string | `"standard"` | `"standard"`, `"deep"` |
| `platforms` | array | all defaults | `["reddit", "twitter", "news", "github", "tiktok", "xiaohongshu"]` |
| `search_mode` | string | `"web_only"` | `"web_only"`, `"hybrid"`, `"user_only"`, `"user_first"` |
| `business_context` | string | null | Extra context for synthesis |

## Tips

- **Be specific**: "What do React developers think about Server Components?" beats "React opinions"
- **Use platforms**: Target Reddit for dev discussions, Twitter for real-time takes
- **Business context**: Add context like "We're building a competing tool" for tailored synthesis
- **Follow up**: Use `continue` to drill into specific themes from the initial analysis
