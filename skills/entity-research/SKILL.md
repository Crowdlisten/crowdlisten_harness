---
name: crowdlisten/entity-research
description: Automated entity intelligence — discovers social handles and communities, runs crowd research for tracked entities, saves results to entity-scoped wiki pages, handles failures and scheduling. Teaches agents HOW to resolve entities, WHEN to research, and WHERE to store intelligence so it compounds.
user-invocable: true
allowed-tools:
  - manage_entities
  - crowd_research
  - run_analysis
  - search_content
  - wiki_write
  - wiki_read
  - wiki_list
  - wiki_search
  - save
  - recall
  - compile_knowledge
  - list_topics
metadata:
  openclaw:
    category: intelligence
    tags:
      - entity-tracking
      - competitive-intel
      - automated-research
      - entity-resolution
    requires_api_key: false
---

# Entity Research

Automated entity intelligence — the system for tracking companies, products, competitors, and people across the social web. This skill covers the full lifecycle: **resolve** an entity's social presence, **research** what people say about it, **persist** structured intelligence to wiki pages, and **compound** knowledge over time.

**This skill encodes judgment, not procedures.** Every section teaches you WHEN to act, WHY it matters, and HOW to evaluate quality.

---

## Decision Framework: When to Use This Skill

Before starting entity research, decide whether this skill is the right tool.

### Decision Tree

```
User wants to know about a specific company/product/person
  │
  ├─ "What's the latest on [Entity]?"
  │   └─ Check wiki first: wiki_read({ path: "entities/{slug}" })
  │       ├─ Fresh (<7 days): Present existing intelligence
  │       └─ Stale or missing: Run entity research (this skill)
  │
  ├─ "Track [Entity] over time"
  │   └─ manage_entities({ action: "create" }) → enable research → this skill
  │
  ├─ "Compare [Entity A] vs [Entity B]"
  │   └─ competitive-analysis skill (not this skill)
  │
  ├─ "What do people think about [topic]?"
  │   └─ crowd-research skill (not this skill — topics ≠ entities)
  │
  └─ "Find content about [Entity]"
      └─ search_content (quick search, no compilation)
```

### When to Use Entity Research

- Tracking a specific company, product, or person over time
- Initial intelligence gathering on a new competitor or partner
- Refreshing stale entity intelligence (>7 days old)
- After adding new entities that need initial profiling
- Re-enabling research after auto-disable (3 consecutive failures)
- Dream cycle automation (scheduled overnight enrichment)

### When NOT to Use Entity Research

- **General topic research** → Use `crowd-research` skill
- **Competitive comparisons** → Use `competitive-analysis` skill
- **Quick content search** → Use `search_content` directly
- **One-off questions** → Use `run_analysis` for a quick check
- **The wiki already has fresh intelligence** → Present it, don't re-research

---

## Entity Resolution: The Critical First Step

**Entity resolution is the single most important quality factor in entity research.** Without it, you search for "Cursor IDE" as keywords and miss r/cursor, @cursor_ai, and anysphere/cursor. With it, you search the RIGHT communities and get 3x better coverage.

### What Entity Resolution Means

An entity has multiple identities across platforms:
- **Company name**: "Cursor" (ambiguous — could be the CSS property)
- **Product name**: "Cursor IDE" (better, but misses community handles)
- **Twitter/X handle**: @cursor_ai
- **Reddit communities**: r/cursor, r/cursorAI
- **GitHub org**: anysphere/cursor
- **Website domain**: cursor.com
- **Alternative names**: "Anysphere" (parent company)

Entity resolution discovers ALL of these identities before any search fires.

### Resolution Process

#### Step 1: Extract Known Identifiers

Start with what the entity record already has:
```
manage_entities({ action: "list" })
→ Look at entity.keywords, entity.platforms, entity.config
```

If the entity has `keywords: ["@cursor_ai", "r/cursor"]`, you already have platform-specific identifiers. Skip to Step 3.

#### Step 2: Discover Platform Identities

For entities without platform-specific identifiers, resolve them:

```
search_content({
  query: "{entity.name} official site OR twitter OR reddit",
  platforms: ["reddit"],
  limit: 10
})
```

From search results, extract:
- **@handles** from URLs: `twitter.com/cursor_ai` → `@cursor_ai`
- **Subreddits** from URLs: `reddit.com/r/cursor` → `r/cursor`
- **GitHub repos** from URLs: `github.com/anysphere/cursor` → `anysphere/cursor`
- **Hashtags** from content: `#CursorIDE`, `#CursorEditor`

**URL-based extraction is 3x more reliable than text mention extraction.** Always prefer identifiers found in URLs over those mentioned in post text.

#### Step 3: Store Resolved Identifiers

Update the entity with discovered identifiers:
```
manage_entities({
  action: "update",
  entity_id: "{entity.id}",
  keywords: ["{entity.name}", "@cursor_ai", "r/cursor", "anysphere"],
  config: {
    resolved_handles: {
      twitter: "@cursor_ai",
      reddit: ["r/cursor", "r/cursorAI"],
      github: "anysphere/cursor",
      website: "cursor.com"
    },
    resolved_at: "{now_iso}"
  }
})
```

#### Step 4: Construct Platform-Specific Queries

Instead of one generic query, build per-platform queries:

| Platform | Query | Rationale |
|----------|-------|-----------|
| Reddit | `subreddit:cursor OR subreddit:cursorAI OR "Cursor IDE"` | Searches the right communities |
| Twitter | `from:cursor_ai OR @cursor_ai OR "Cursor IDE"` | Captures official + mention threads |
| YouTube | `"Cursor IDE" OR "Cursor editor" review OR tutorial` | Finds review/tutorial content |
| HackerNews | `"Cursor" "IDE" OR "Anysphere"` | Matches HN discussion style |

### Resolution Quality Checks

| Check | Pass Criteria | Fail Action |
|-------|---------------|-------------|
| Platform coverage | Identifiers for ≥2 platforms | Run additional discovery searches |
| Handle verification | @handles return real profiles | Remove unverified handles |
| Disambiguation | No confusion with other entities | Add disambiguating keywords |
| Freshness | Resolved <30 days ago | Re-resolve (handles change) |

### Common Resolution Pitfalls

1. **Ambiguous names**: "Mercury" could be the bank, the browser, the planet. Always add disambiguating context.
2. **Renamed entities**: Companies rebrand. Check if old names still have active communities.
3. **Parent/subsidiary confusion**: "Anysphere" (parent) vs "Cursor" (product). Track both but file under the product.
4. **Regional variants**: Some entities use different handles per region (@cursor_ai vs @cursor_jp).

---

## Enrichment Tiers

Not all entities deserve equal research investment. Classify entities into tiers and allocate resources accordingly.

### Tier Definitions

| Tier | Description | Research Depth | Frequency | Platforms | Example |
|------|-------------|---------------|-----------|-----------|---------|
| **Tier 1** | Active customers, primary competitors | Full pipeline: resolve → research → compile → synthesize | Every 3-7 days | All relevant (3-4 platforms) | Your top 3 competitors |
| **Tier 2** | Secondary competitors, adjacent products | Moderate: resolve → research → save | Every 7-14 days | 2 platforms | Indirect competitors |
| **Tier 3** | Market signals, industry players | Light: search → save notable items | Every 14-30 days | 1 platform | Industry analysts, adjacent markets |

### Tier Assignment Rules

```
New entity added
  │
  ├─ Is it a direct competitor? → Tier 1
  ├─ Is it a customer or key partner? → Tier 1
  ├─ Is it an indirect competitor or adjacent product? → Tier 2
  ├─ Is it an industry influencer or analyst? → Tier 2
  └─ Is it a market signal or peripheral player? → Tier 3
```

### Tier-Specific Workflows

**Tier 1 — Full Pipeline**:
1. Resolve entity identifiers (refresh every 30 days)
2. Run `crowd_research` with 3-4 platforms
3. Run `compile_knowledge` to update topic pages
4. Write synthesis page connecting entity intelligence to strategic themes
5. Flag contradictions and sentiment shifts immediately

**Tier 2 — Moderate Pipeline**:
1. Resolve entity identifiers (refresh every 60 days)
2. Run `run_analysis` with 2 platforms (faster than crowd_research)
3. Save key findings with `save`
4. Compile only when 3+ new findings accumulate

**Tier 3 — Light Pipeline**:
1. Resolve entity identifiers (refresh every 90 days)
2. Run `search_content` for notable mentions
3. Save only if high-engagement content found (>100 engagement score)
4. No compilation — raw saves only

### Tier Promotion/Demotion

Entities can move between tiers based on signals:

**Promote** (Tier 3 → 2, or Tier 2 → 1):
- Sudden spike in mentions (>3x normal volume)
- User explicitly requests deeper tracking
- Entity enters your market directly (launches competing feature)

**Demote** (Tier 1 → 2, or Tier 2 → 3):
- 3+ research cycles with zero notable findings
- Entity exits your market or shuts down
- User explicitly reduces priority

---

## Research Scheduling

### Scheduling Rules

Each entity has scheduling metadata in its config:

| Field | Default | Description |
|-------|---------|-------------|
| `research_enabled` | `true` | Whether automated research is active |
| `research_interval_hours` | 24 (Tier 1), 168 (Tier 2), 336 (Tier 3) | Hours between research runs |
| `last_research_at` | `null` | ISO timestamp of last completed research |
| `pending_research_job` | `null` | Job ID if research is currently running |
| `research_failures` | 0 | Consecutive failure count |

### Determining "Due" Entities

An entity is due for research when ALL of these are true:
1. `research_enabled` is not `false`
2. `pending_research_job` is `null` (no job in flight)
3. `last_research_at` is older than `research_interval_hours`, OR is `null` (never researched)
4. Entity has at least one linked project (via project_entities)
5. `research_failures` < 3 (not auto-disabled)

### Concurrency Limits

- **Maximum 5 concurrent research jobs globally** per user
- Count entities where `pending_research_job` is not null
- Skip starting new jobs if at capacity
- Priority: Tier 1 entities get researched before Tier 2/3

### The 7-Day Minimum Rule

**Check tracked entities every 7 days minimum, regardless of tier.**

Even Tier 3 entities should get a lightweight check (search_content) at least weekly. News moves fast. A Tier 3 entity can become critically relevant overnight (acquisition, product launch, controversy).

---

## Before You Start

Gather context about the user's tracked entities:

```tool
manage_entities({ action: "list" })
```

Then check existing wiki intelligence:

```tool
wiki_list({ prefix: "entities/", project_id: "{project_id}" })
```

This tells you:
- Which entities already have wiki pages
- How recent the latest research is
- Whether any entities need initial profiling

**Golden Rule: Always check existing intelligence before running new research.**

If recent intelligence exists (<7 days for Tier 1, <14 for Tier 2):
> "We have intelligence on [Entity] from [date]. Key findings: [summary]. Want me to run fresh research or is this sufficient?"

---

## Foundation: CrowdListen Tools

| Tool | Role in This Workflow |
|------|----------------------|
| `manage_entities` | List entities, update config (last_research_at, failures, pending job, resolved handles) |
| `crowd_research` | Start async research jobs and poll for results (Tier 1) |
| `run_analysis` | Quick multi-platform analysis (Tier 2) |
| `search_content` | Direct content search for specific mentions (Tier 3, or supplemental) |
| `wiki_write` | Save research results to entity-scoped wiki paths |
| `wiki_read` | Check if a research page already exists |
| `wiki_list` | Browse entity wiki pages |
| `save` | Quick-save individual observations |
| `recall` | Check existing knowledge before new research |
| `compile_knowledge` | Trigger topic compilation after Tier 1 research |
| `list_topics` | View compiled topics to check for entity-related themes |

---

## Workflow 1: Full Research Run

Run research for all due entities. This is the primary workflow for scheduled execution (dream cycle or manual batch).

### Process

1. **List entities**: `manage_entities({ action: "list" })`

2. **Filter to due entities**: For each entity, apply the scheduling rules above.

3. **Sort by priority**: Tier 1 first, then Tier 2, then Tier 3.

4. **Enforce concurrency**: Maximum 5 concurrent research jobs. Count entities where `pending_research_job` is not null. Skip if at capacity.

5. **For each due entity**, run the appropriate tier workflow:
   - Tier 1 → Workflow 2 (Single Entity Research — Full)
   - Tier 2 → Workflow 3 (Single Entity Research — Moderate)
   - Tier 3 → Workflow 4 (Single Entity Research — Light)

6. **Report summary**:

```
## Entity Research Run — {date}

**Entities processed**: {count}
**Skipped (not due)**: {count}
**Skipped (at capacity)**: {count}
**Failures**: {count}

| Entity | Tier | Status | Wiki Page |
|--------|------|--------|-----------|
| {name} | T1 | completed | entities/{slug}/research/{date} |
| {name} | T2 | completed | entities/{slug}/latest |
| {name} | T3 | skipped — last run 2h ago | — |
| {name} | T1 | failed — timeout | — |
```

---

## Workflow 2: Single Entity Research — Full (Tier 1)

Comprehensive research for high-priority entities.

### Process

1. **Check resolution status**: If `resolved_handles` is missing or >30 days old, run entity resolution first (see Entity Resolution section).

2. **Construct queries** using resolved identifiers:
   - Build platform-specific queries (not just the entity name as keywords)
   - Include @handles, subreddit names, alternative names
   - Full query: combine entity name + keywords + resolved handles

3. **Start research job**:
   ```tool
   crowd_research({
     action: "start",
     query: "{constructed_query}",
     platforms: entity.platforms  // or omit for default
   })
   ```
   Returns a `job_id`.

4. **Update entity config** with pending job:
   ```tool
   manage_entities({
     action: "update",
     entity_id: "{entity.id}",
     config: {
       pending_research_job: "{job_id}",
       pending_research_started_at: "{now_iso}"
     }
   })
   ```

5. **Poll for results** (wait 30-120s between polls, max 10 polls):
   ```tool
   crowd_research({ action: "status", job_id: "{job_id}" })
   ```

6. **On completion** — evaluate and save results:

   **Quality checks before saving**:
   - Source count ≥ 5? If not, note thin coverage.
   - Platform diversity ≥ 2? If not, flag single-platform limitation.
   - Any single author > 3 quotes? Cap at 3 per author.
   - Contradictions detected? Surface both sides.

   ```tool
   wiki_write({
     path: "entities/{entity.slug}/research/{YYYY-MM-DD}",
     title: "{entity.name} — Research {YYYY-MM-DD}",
     content: "{formatted_research_results}",
     metadata: { entity_id: "{entity.id}", type: "entity_research" },
     tags: ["entity-research", "{entity.slug}"]
   })
   ```

7. **Trigger compilation** for Tier 1 entities:
   ```tool
   compile_knowledge({
     project_id: "{project_id}",
     analysis_ids: ["{analysis_id_from_research}"]
   })
   ```

8. **Update entity config** on success:
   ```tool
   manage_entities({
     action: "update",
     entity_id: "{entity.id}",
     config: {
       last_research_at: "{now_iso}",
       pending_research_job: null,
       pending_research_started_at: null,
       research_failures: 0
     }
   })
   ```

9. **On failure** — apply failure protocol (see Failure Handling below).

---

## Workflow 3: Single Entity Research — Moderate (Tier 2)

Quick analysis for secondary entities.

### Process

1. **Check resolution** (refresh if >60 days old).

2. **Run quick analysis** (not full crowd_research):
   ```tool
   run_analysis({
     project_id: "{project_id}",
     question: "What are people saying about {entity.name}? Focus on sentiment, complaints, and recent developments.",
     platforms: ["{platform_1}", "{platform_2}"]
   })
   ```

3. **Save key findings** (not full wiki page — use `save` for atomic observations):
   ```tool
   save({
     title: "{entity.name}: {key finding}",
     content: "{finding with sources and engagement data}",
     tags: ["entity-research", "{entity.slug}", "{topic}"],
     project_id: "{project_id}",
     confidence: {0.0-1.0}
   })
   ```

4. **Update entity config** with `last_research_at`.

5. **Compile only if** 3+ new findings have accumulated since last compilation.

---

## Workflow 4: Single Entity Research — Light (Tier 3)

Minimal check for peripheral entities.

### Process

1. **Search for notable mentions** only:
   ```tool
   search_content({
     query: "{entity.name}",
     platforms: ["{primary_platform}"],
     limit: 10
   })
   ```

2. **Filter for high-engagement content** (>100 engagement score). Ignore low-engagement mentions.

3. **Save only notable items**:
   ```tool
   save({
     title: "{entity.name}: {notable event}",
     content: "{brief description with source link}",
     tags: ["entity-research", "{entity.slug}", "signal"],
     project_id: "{project_id}",
     confidence: {0.4-0.6}
   })
   ```

4. **Check for tier promotion signals**: If you find >3x normal mention volume or a major event, flag for tier promotion.

5. **Update entity config** with `last_research_at`.

---

## Failure Handling

### Failure Protocol

When a research job fails (timeout, API error, empty results):

1. **Clear pending job state**:
   ```tool
   manage_entities({
     action: "update",
     entity_id: "{entity.id}",
     config: {
       pending_research_job: null,
       pending_research_started_at: null,
       research_failures: {current_failures + 1}
     }
   })
   ```

2. **Auto-disable after 3 consecutive failures**:
   ```tool
   manage_entities({
     action: "update",
     entity_id: "{entity.id}",
     config: {
       research_enabled: false,
       research_disabled_at: "{now_iso}",
       research_disabled_reason: "{error_type}: {error_message}"
     }
   })
   ```

3. **Stale job detection**: If `pending_research_started_at` is older than 2 hours, treat as failed. Clear the pending job and increment failure counter.

### Common Failure Causes

| Failure | Cause | Recovery |
|---------|-------|----------|
| Timeout (>10 polls) | Query too broad, platform slow | Narrow query, try fewer platforms |
| Empty results | Entity too niche, wrong keywords | Re-resolve identifiers, try different platforms |
| API error (4xx/5xx) | Backend issue, rate limit | Retry next cycle, don't increment failures |
| Partial results | Some platforms succeeded, some failed | Save partial results, note gaps |

### Re-enabling After Auto-Disable

When a user wants to resume research for an auto-disabled entity:

1. **Diagnose**: Check `research_disabled_reason` to understand why it was disabled.
2. **Fix**: Re-resolve identifiers, adjust query, change platforms.
3. **Re-enable**:
   ```tool
   manage_entities({
     action: "update",
     entity_id: "{entity.id}",
     config: {
       research_enabled: true,
       research_failures: 0,
       research_disabled_at: null,
       research_disabled_reason: null
     }
   })
   ```
4. **Run immediate research** via the appropriate tier workflow to verify the fix.

---

## Research Result Format

When writing to wiki, format research results as:

```markdown
# {entity.name} — Research Intelligence
*Generated {YYYY-MM-DD} | Tier {1/2/3} | Confidence: {score}*

## Summary
{2-3 sentence overview of key findings}

## Key Themes
{For each theme from the research results}
### {theme_title}
{theme_summary}
**Sentiment**: {positive/negative/mixed}
**Sources**: {source_count} mentions across {platform_count} platforms
**Engagement**: {total engagement score}

> "{best quote}" — {platform}, {engagement metrics}

## Notable Mentions
{Top 3-5 specific quotes or data points, max 3 per author}

## Contradictions
{Any conflicting signals — present both sides}

## Trend Signals
{Emerging patterns, volume changes, sentiment shifts}

## Knowledge Gaps
{What we couldn't find — which platforms had no data, which questions remain}

## Metadata
- **Platforms searched**: {list}
- **Sources found**: {count}
- **Platform diversity**: {count} platforms
- **Time range**: {oldest} to {newest}
- **Per-author cap applied**: {yes/no}
- **Resolved identifiers used**: {list}
```

If the research returned empty or minimal results:

```markdown
# {entity.name} — Research Intelligence
*Generated {YYYY-MM-DD} | Tier {1/2/3}*

## Summary
No significant crowd activity detected for this period.

## Possible Reasons
- Entity is too niche for social media discussion
- Wrong identifiers — consider re-resolving
- Platform selection may not match where this entity's audience gathers

## Next Steps
- Re-resolve entity identifiers
- Try different platforms: {suggestions}
- Lower tier if consistently empty

Next scheduled research: {next_due_date}
```

---

## Integration with Other Skills

### With crowd-research Skill
Entity research uses `crowd_research` and `run_analysis` as execution tools. The entity-research skill adds:
- Entity resolution (pre-search identifier discovery)
- Scheduling logic (when to research)
- Tier-based depth control (how deeply to research)
- Entity-scoped wiki persistence (where to save)

### With knowledge-base Skill
Entity research feeds the knowledge base:
1. Research produces raw findings → filed under `entities/{slug}/research/`
2. `compile_knowledge` synthesizes into topic pages
3. Knowledge-base skill manages lifecycle (staleness, pruning, merging)

### With competitive-analysis Skill
Competitive analysis builds on entity research:
1. Entity research profiles individual competitors
2. Competitive analysis compares entities head-to-head
3. Results cross-reference: "See entity research for [Competitor] at entities/{slug}/"

### Wiki Path Conventions

All entity research goes under `entities/{slug}/`:

| Path | Content |
|------|---------|
| `entities/{slug}` | Entity overview page (manually curated or auto-generated) |
| `entities/{slug}/research/{YYYY-MM-DD}` | Daily research intelligence |
| `entities/{slug}/latest` | Most recent research (updated in-place) |
| `entities/{slug}/competitive/` | Competitive analysis results |
| `entities/{slug}/resolution` | Resolved handles and identifiers |

---

## Anti-Patterns

### Things That Waste Time

1. **Researching without resolving first.** Generic keyword searches miss 60%+ of relevant content. Always resolve entity identifiers before searching.
2. **Running Tier 1 research for Tier 3 entities.** Don't waste crowd_research on a peripheral market signal. Use search_content.
3. **Re-researching entities with fresh intelligence.** Check wiki_read first. If <7 days old, present existing intelligence.
4. **Ignoring resolution drift.** Companies rebrand, create new accounts, launch new subreddits. Re-resolve every 30 days.

### Things That Produce Bad Output

1. **Entity name as the only query.** "Cursor" returns CSS cursor discussions. Always add disambiguating context.
2. **Same query for all platforms.** Reddit search syntax ≠ Twitter search syntax ≠ YouTube search. Use platform-specific queries.
3. **No per-author cap.** A single vocal critic with 50 posts shouldn't dominate the intelligence. Cap at 3 quotes per author.
4. **Missing metadata.** Every research page must include: platforms searched, source count, time range, confidence score. Without metadata, the page can't be evaluated or pruned.

---

## Confidence Scoring for Entity Research

Entity research confidence follows the same formula as crowd research, with entity-specific adjustments:

```
confidence = (agreeing_sources / total_sources) * recency_weight * platform_diversity_bonus * resolution_bonus
```

Where:
- `resolution_bonus`: 1.0 if entity was properly resolved, 0.8 if using generic name only
- Other factors same as crowd-research skill

### Confidence Thresholds for Entities

| Score | Label | Meaning |
|-------|-------|---------|
| 0.8-1.0 | **High** | Entity well-understood. Multiple confirming sources across platforms. |
| 0.5-0.79 | **Medium** | Some intelligence available but gaps remain. |
| 0.3-0.49 | **Low** | Thin coverage. Entity may be too niche or identifiers may be wrong. |
| 0.0-0.29 | **Insufficient** | Effectively no usable intelligence. Re-resolve and retry. |

---

## Per-User Limits

- Maximum 10 entities with `research_enabled: true` per user
- Maximum 5 concurrent research jobs globally
- Default research interval: 24 hours for Tier 1, 168 hours for Tier 2, 336 hours for Tier 3
- Per-author cap: Maximum 3 quotes per unique author in any research output
