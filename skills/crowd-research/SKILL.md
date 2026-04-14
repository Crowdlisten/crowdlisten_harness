---
name: crowdlisten:crowd-research
description: Full-cycle crowd intelligence — from research question to compiled truth. Teaches agents WHEN to research, HOW to evaluate evidence, and WHERE to store knowledge so it compounds.
user-invocable: true
allowed-tools:
  - crowd_research
  - run_analysis
  - search_content
  - compile_knowledge
  - list_topics
  - wiki_write
  - wiki_read
  - wiki_list
  - wiki_search
  - save
  - recall
  - manage_entities
metadata:
  openclaw:
    category: research
    tags:
      - crowd-intelligence
      - audience-research
      - compiled-truth
      - social-listening
    requires_api_key: false
---

# Crowd Research

The primary intelligence-gathering skill. Turns research questions into compiled truth that compounds across sessions.

**This skill encodes judgment, not procedures.** Every section teaches you WHEN to act, WHY it matters, and HOW to evaluate quality.

---

## Decision Framework: Which Tool When

Before starting ANY research, decide which tool fits the job. Getting this wrong wastes time and produces inferior results.

### Tool Selection Decision Tree

```
User wants to know something about their audience
  │
  ├─ "What do people think about X?"
  │   └─ run_analysis (structured multi-platform search + synthesis)
  │
  ├─ "Deep dive into X across all channels"
  │   └─ crowd_research (async, comprehensive, multi-round)
  │
  ├─ "Find specific posts/content about X"
  │   └─ search_content (direct search, no synthesis)
  │
  ├─ "What does our wiki already know about X?"
  │   └─ recall or wiki_search (check compiled truth FIRST)
  │
  └─ "Track X over time"
      └─ manage_entities + entity-research skill (scheduled)
```

### When to Use crowd_research

Use `crowd_research` when:
- The question requires comprehensive coverage across platforms
- You need deeper analysis than a single `run_analysis` provides
- The research will take >2 minutes (async job with polling)
- You want the system to decide which platforms and search strategies to use
- The result will feed into a compiled truth page

Do NOT use `crowd_research` when:
- A quick sentiment check suffices → use `run_analysis`
- You need specific posts → use `search_content`
- The wiki already has recent compiled truth → use `recall` first
- The question is about a single platform → use `run_analysis` with `platforms: ["reddit"]`

### When to Use run_analysis

Use `run_analysis` when:
- You need a quick (< 2 min) multi-platform scan
- The question is focused and specific
- You want streaming results (SSE) for real-time feedback
- The result will be one data point among many

### The Golden Rule

**Always check compiled truth before new research.**

```
1. recall("pricing feedback")  ← Check what we already know
2. list_topics({ project_id })  ← See all compiled topics
3. wiki_read({ path: "topics/pricing" })  ← Read the compiled page
4. ONLY THEN: run_analysis or crowd_research if gaps exist
```

If compiled truth is <7 days old and covers the question, DO NOT run new research. Tell the user what we already know and ask if they want fresh data.

---

## Source Precedence

Not all evidence is created equal. When synthesizing findings, weight sources in this order:

### Hierarchy (Highest → Lowest)

1. **Direct customer quotes with context** — A real user describing their experience. Gold standard.
   - "I switched from Competitor X because their API kept timing out during peak hours"
   - Weight: 1.0

2. **Compiled themes across N customers** — When 5+ people independently say the same thing.
   - "Pricing is the #1 concern across Reddit, Twitter, and YouTube"
   - Weight: 0.9

3. **Individual feedback items** — Single data points without corroboration.
   - "One user on Reddit says the mobile app crashes"
   - Weight: 0.5

4. **Expert/influencer opinions** — Industry analysts, tech reviewers.
   - Weight: 0.6 (higher reach but potentially biased by sponsorships)

5. **Competitor marketing claims** — What competitors say about themselves.
   - Weight: 0.2 (treat as adversarial evidence — verify before trusting)

6. **AI-generated summaries without citations** — Summaries that don't trace to sources.
   - Weight: 0.0 (reject entirely — demand citations)

### Applying Precedence

When writing compiled truth:
- Lead with highest-weight evidence
- Note when a finding relies solely on low-weight sources
- Flag when high-weight and low-weight sources contradict

```markdown
## Pricing Perception

**High confidence** (12 independent user reports across 3 platforms):
Users consistently report pricing as "fair for enterprise, expensive for startups."

> "We're a 5-person startup and $99/seat is a non-starter" — Reddit, r/startups, 847 upvotes

**Contradicted by**: Competitor's marketing claims that "we're the most affordable option."
This claim is NOT supported by user evidence.
```

---

## Confidence Scoring

Every compiled topic MUST have a confidence score. Here's how to calculate it:

### Scoring Formula

```
confidence = (agreeing_sources / total_sources) * recency_weight * platform_diversity_bonus
```

Where:
- `agreeing_sources`: Number of independent sources supporting the finding
- `total_sources`: All sources that mention the topic (including contradicting ones)
- `recency_weight`: 1.0 if <7 days, 0.8 if 7-30 days, 0.5 if >30 days
- `platform_diversity_bonus`: 1.0 if 1 platform, 1.1 if 2 platforms, 1.2 if 3+ platforms (cap at 1.0 final score)

### Confidence Thresholds

| Score | Label | Action Guidance |
|-------|-------|-----------------|
| 0.8-1.0 | **High** | Safe to recommend action. Multiple sources agree across platforms. |
| 0.5-0.79 | **Medium** | Report finding but note it needs more evidence. |
| 0.3-0.49 | **Low** | Mention as an emerging signal, not a finding. |
| 0.0-0.29 | **Insufficient** | Do NOT include in compiled truth. Flag as "needs investigation." |

### Iron Laws

- **Never present low-confidence findings as facts.** Always qualify.
- **Only recommend action if confidence >= 0.5 AND 3+ independent sources confirm.**
- **If confidence drops below 0.3 on a previously high-confidence topic, flag staleness.**

---

## Contradiction Protocol

Contradictions are valuable signals, not problems to hide.

### When Sources Disagree

1. **Identify the contradiction explicitly.**
   - "Reddit users say pricing is too high, but YouTube reviewers call it affordable."

2. **Investigate the WHY.** Common causes:
   - **Audience segmentation**: Enterprise users vs. startups see different value
   - **Platform bias**: Reddit skews technical, YouTube skews mainstream
   - **Temporal**: Sentiment shifted after a pricing change
   - **Geographic**: Different markets, different perceptions

3. **Surface both perspectives with evidence.**
   ```markdown
   ## Pricing Perception — CONTRADICTION DETECTED

   **Position A** (8 sources, Reddit + HackerNews):
   "Overpriced for the value delivered."
   > "At $200/mo I expected enterprise features, got a glorified spreadsheet" — r/SaaS

   **Position B** (5 sources, YouTube + Twitter):
   "Great value compared to alternatives."
   > "Half the price of [Competitor] with better UX" — @techreviewer, 12k likes

   **Resolution hypothesis**: Audience segmentation.
   Reddit/HN users are power users expecting enterprise features.
   YouTube/Twitter users are comparing against expensive legacy tools.
   **Both positions are valid for their respective audiences.**
   ```

4. **Never silently resolve contradictions.** The user needs to see both sides.

---

## Research Workflow

### Step 1: Frame the Question

A good research question is:
- **Specific**: "What do React developers think about Next.js App Router?" not "What about Next.js?"
- **Actionable**: The answer should inform a decision
- **Scoped**: Targets a specific audience, time period, or use case

Bad: "Tell me about our competitors"
Good: "What are the top 3 complaints enterprise users have about [Competitor X] in the last 90 days?"

If the user gives a vague question, ask for specifics BEFORE researching.

### Step 2: Check Existing Knowledge

```
recall({ query: "[topic keywords]", project_id: "[project]" })
list_topics({ project_id: "[project]" })
```

If recent compiled truth exists (< 7 days), present it first:
"We have compiled intelligence on this from [date]. Here's what we know: [summary]. Want me to run fresh research or is this sufficient?"

### Step 3: Execute Research

For quick insights:
```
run_analysis({
  project_id: "[project]",
  question: "[specific question]",
  platforms: ["reddit", "youtube", "twitter"]  ← pick 2-3 most relevant
})
```

For comprehensive research:
```
crowd_research({
  action: "start",
  query: "[research question]",
  project_id: "[project]"
})
// Then poll:
crowd_research({ action: "status", job_id: "[id]" })
```

### Step 4: Evaluate Results

Before presenting results, evaluate quality:

| Check | Pass Criteria | Fail Action |
|-------|---------------|-------------|
| Source count | >= 5 sources | Run additional search on underrepresented platforms |
| Platform diversity | >= 2 platforms | Search additional platforms explicitly |
| Recency | Majority < 30 days old | Flag age; ask user if stale data is acceptable |
| Author diversity | No single author > 3 quotes | Cap per-author quotes at 3 |
| Contradiction check | Contradictions surfaced | Run contradiction protocol |
| Engagement validation | High-engagement content included | Re-rank by engagement |

### Step 5: Compile to Wiki

After evaluating results, write compiled truth:

```
wiki_write({
  project_id: "[project]",
  path: "topics/[topic-slug]",
  title: "[Topic Title]",
  content: "[compiled markdown with confidence scores, evidence, contradictions]",
  tags: ["topic", "compiled"]
})
```

Or trigger full compilation:
```
compile_knowledge({
  project_id: "[project]",
  analysis_ids: ["[analysis_id]"]
})
```

### Step 6: Verify Compilation

After writing:
```
list_topics({ project_id: "[project]" })
```

Confirm the new topic appears with correct confidence score.

---

## Engagement Scoring

Social content value = relevance * engagement. A viral post with 10k upvotes about your product is more important than a niche blog post, even if the blog post matches keywords better.

### Platform-Specific Weights

```
Reddit:    score * 0.6 + num_comments * 0.4
Twitter:   likes * 0.55 + retweets * 0.25 + replies * 0.15 + quotes * 0.05
YouTube:   views * 0.50 + likes * 0.35 + comments * 0.15
TikTok:    views * 0.50 + likes * 0.30 + comments * 0.20
```

### Relevance Floor

Content with very high engagement (top 1% for the platform) gets a relevance floor of 0.3, even if keyword match is low. Rationale: if thousands of people engaged with content about your topic, it matters regardless of exact keyword match.

### Per-Author Cap

**Maximum 3 quotes per unique author** in any single research output. This prevents:
- A single vocal user dominating the narrative
- Bot/astroturf campaigns skewing results
- Overweighting prolific commenters

---

## Quality Enforcement

### Before Bulk Processing

**Test 3-5 items before processing a full batch.** Verify:
- Source extraction is working (not empty/truncated)
- Relevance filtering is appropriate (not too broad/narrow)
- Engagement scores are normalizing correctly

### Knowledge Gap Protocol

When information is unavailable or insufficient:
- **State explicitly**: "No data found for [topic] on [platform]."
- **Never hallucinate filler.** Empty results are better than fabricated ones.
- **Suggest alternatives**: "No Reddit data. Consider searching YouTube or running a new analysis."

### Cross-Reference Rule

Every entity mentioned in compiled truth MUST link to its wiki page:
- "[[entities/cursor-ide]] users report..." not just "Cursor users report..."
- If the entity page doesn't exist, create a stub: `wiki_write({ path: "entities/cursor-ide", title: "Cursor IDE", content: "# Cursor IDE\n\nEntity stub — to be enriched." })`

### Temporal Context

Always include temporal context in compiled truth:
- WHEN the evidence was gathered
- Whether it's before or after a major event (product launch, pricing change, outage)
- How sentiment has changed over time if historical data exists

---

## Integration Hooks

### With Knowledge Base Skill

Crowd research feeds the knowledge base:
1. Research produces raw findings
2. `compile_knowledge` synthesizes into topics
3. Knowledge base skill manages the lifecycle (staleness, pruning, merging)

### With Entity Research Skill

For tracked entities:
1. Entity research schedules periodic `crowd_research` runs
2. Results write to `entities/{slug}/research/{date}`
3. `compile_knowledge` merges entity research into topic pages

### With Competitive Analysis Skill

Competitive research is a specialized form of crowd research:
1. Frame competitive questions: "[Brand A] vs [Brand B]"
2. Run research with competitor-specific platforms
3. Write to `entities/{competitor}/competitive/` paths
4. Competitive analysis skill adds strategic interpretation

---

## Anti-Patterns

### Things That Waste Time

1. **Researching without checking wiki first.** Always `recall()` before `crowd_research`.
2. **Running full crowd_research for simple questions.** Use `run_analysis` for quick checks.
3. **Presenting raw analysis output as compiled truth.** Raw output is evidence, not knowledge. Synthesize first.
4. **Ignoring contradictions.** Contradictions are the most valuable signal — surface them.
5. **Research without a project context.** Every research run should be tied to a project so results accumulate.

### Things That Produce Bad Output

1. **No engagement filtering.** A post with 2 upvotes shouldn't carry the same weight as one with 2000.
2. **Single-platform research presented as comprehensive.** Always note which platforms were searched and which weren't.
3. **Outdated compiled truth presented as current.** Always check `compiled_at` timestamp.
4. **Confidence scores without justification.** Every confidence score must cite its source count and platform diversity.

---

## Example: Complete Research Cycle

User: "What do people think about our pricing?"

### 1. Check Existing Knowledge
```
recall({ query: "pricing feedback", project_id: "proj_123" })
→ Found: "topics/pricing" compiled 12 days ago, confidence 0.72
```

Since it's >7 days old, offer to refresh:
"We have pricing intelligence from 12 days ago (confidence: 72%). Key finding: enterprise users find pricing fair, startups find it expensive. Want me to run fresh research to see if this has changed?"

### 2. User Says Yes → Run Research
```
run_analysis({
  project_id: "proj_123",
  question: "What are current user perceptions of our pricing? Focus on complaints, comparisons, and switching intent.",
  platforms: ["reddit", "youtube", "twitter"]
})
```

### 3. Evaluate Results
- 18 sources found across 3 platforms ✓
- No single author > 3 quotes ✓
- Contradiction detected: Reddit says "too expensive," YouTube says "great value" ⚠️
- 14 of 18 sources < 14 days old ✓

### 4. Compile to Wiki
```
compile_knowledge({
  project_id: "proj_123",
  analysis_ids: ["analysis_abc"]
})
```

### 5. Verify
```
list_topics({ project_id: "proj_123" })
→ "topics/pricing" — confidence: 0.78, version: 3, compiled: 2026-04-13
```

### 6. Report to User
"Updated pricing intelligence (confidence: 78%, up from 72%):
- **Enterprise** (8 sources): Pricing seen as fair. No change.
- **Startups** (7 sources): Still the #1 concern. NEW: 3 users mentioned switching to [Competitor].
- **Contradiction**: YouTube reviewers (3 sources) call it 'great value' — likely due to comparison against legacy tools, not direct competitors.

See full compiled page: `wiki_read({ path: 'topics/pricing' })`"

---

## Platform Selection Guide

When the user doesn't specify platforms, pick based on their question:

| Question Type | Primary | Secondary | Avoid |
|---------------|---------|-----------|-------|
| Product feedback | Reddit, YouTube | Twitter, TikTok | — |
| Breaking news | Twitter | Reddit, HackerNews | YouTube (slow) |
| Technical evaluation | Reddit, HackerNews | GitHub | TikTok |
| Consumer sentiment | TikTok, YouTube | Reddit, Twitter | HackerNews |
| Enterprise/B2B | Reddit, Twitter | YouTube | TikTok |
| Pricing/value | Reddit | YouTube, Twitter | — |
| Developer tools | Reddit, HackerNews | GitHub, Twitter | TikTok |
| Design/UX | Twitter, YouTube | Reddit, TikTok | — |

---

## Failure Modes and Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| No results | 0 sources returned | Broaden query, try different platforms, check if topic is too niche |
| All results from one platform | Platform diversity = 1 | Explicitly search additional platforms |
| Stale results only | All sources > 30 days | Note staleness, ask user if acceptable, try real-time search |
| Contradictory evidence | Opposing sentiment clusters | Run contradiction protocol (see above) |
| Low engagement content only | Max engagement < 10 | Lower relevance floor, note in output |
| crowd_research timeout | No result after 10 polls | Fall back to run_analysis, note limitation |
| API errors | 4xx/5xx responses | Retry once, then fall back to alternative tool |

---

## Output Standards

Every research output must include:

1. **Confidence score** with justification
2. **Source count** and platform breakdown
3. **Temporal context** (when evidence was gathered)
4. **Key quotes** with engagement metrics
5. **Contradictions** surfaced (if any)
6. **Knowledge gaps** explicitly stated
7. **Recommended next steps** (what to research next, what to act on)

Output that lacks any of these elements is incomplete. Complete the gaps before presenting to the user.
