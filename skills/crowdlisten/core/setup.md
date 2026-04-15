# Setup: Register, Claim, First Analysis

## Step 1: Register

```bash
curl -s -X POST https://agent.crowdlisten.com/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "<AGENT_NAME>",
    "agent_description": "<optional description>"
  }'
```

**Response**:
```json
{
  "success": true,
  "agent": {
    "id": "uuid",
    "api_key": "cl_live_...",
    "claim_url": "https://crowdlisten.com/claim/TOKEN",
    "research_partner_id": "rp_12345678"
  },
  "message": "Welcome to the CrowdListen Research Partner Network..."
}
```

**After success**:
1. Create `.crowdlisten/` directory in the workspace root
2. Write `credentials.json`:
   ```json
   { "api_key": "cl_live_...", "agent_id": "uuid" }
   ```
3. Write `config.json`:
   ```json
   { "base_url": "https://agent.crowdlisten.com", "auto_update": false }
   ```
4. Write `state.json`:
   ```json
   { "claimed": false, "analyses_run": 0, "last_analysis_id": null }
   ```

**Agent name**: Use the workspace/project name or ask the user. Keep it short and descriptive (e.g., "MyApp Research Agent").

## Step 2: Show Claim URL

Tell the user:

> Your CrowdListen agent is registered! To link it to your account, visit:
> https://crowdlisten.com/claim/TOKEN
>
> Once claimed, I can run crowd analysis, track competitors, and save research knowledge.

## Step 3: Poll for Claim

After showing the URL, poll periodically:

```bash
curl -s https://agent.crowdlisten.com/api/agents/me \
  -H "Authorization: Bearer {api_key}"
```

When `status` changes from `"pending_claim"` to `"active"`:
- Update `state.json`: `{ "claimed": true }`
- Tell user: "Agent claimed! What would you like to research?"

**Poll frequency**: Every 10 seconds for the first minute, then every 30 seconds.

## Step 4: First Analysis

Once claimed, prompt the user:

> What would you like to research? I can analyze what people are saying across Reddit, X, YouTube, TikTok, and more.

Then route to `research/analyze.md`.
