---
name: crowdlisten:knowledge-base
description: >
  Crowd intelligence knowledge management — the capture-compile-synthesize-prune
  cycle for building compiled truth from audience data, analyses, and research.
  Teaches agents to file, merge, age, and retrieve crowd knowledge with judgment.
user-invocable: true
allowed-tools:
  - save
  - recall
  - wiki_write
  - wiki_read
  - wiki_list
  - wiki_search
  - wiki_ingest
  - wiki_log
  - compile_knowledge
  - list_topics
metadata:
  openclaw:
    category: knowledge-management
    tags:
      - knowledge-base
      - compiled-truth
      - crowd-intelligence
      - synthesis
      - wiki
    requires_api_key: false
---

# Knowledge Base -- The Compiled Truth Model

Your knowledge base is not a filing cabinet. It is a living model of what you know
about your audience, your market, and your product -- assembled from evidence,
not assumptions.

Every piece of crowd data you encounter -- a customer quote, a sentiment cluster,
a competitor mention, a feature request pattern -- either reinforces, contradicts,
or extends what you already know. Your job is not to store data. Your job is to
build **compiled truth**: synthesized, confidence-scored, source-linked knowledge
that any agent can trust and act on.

This skill teaches the judgment loop that makes that happen.


## The G-Brain Cycle

The knowledge base operates on a four-phase cycle. Every interaction with crowd
data should pass through at least one phase of this cycle.

```
  CAPTURE ──> COMPILE ──> SYNTHESIZE ──> PRUNE
     ^                                     |
     └─────────────────────────────────────┘
```

### Phase 1: Capture

**What**: Save raw observations, quotes, data points, and analysis outputs as
individual knowledge entries.

**When**: After every analysis, research run, or manual insight discovery.

**How**:

```tool
save({
  title: "Customer: Onboarding friction in mobile app",
  content: "Reddit user u/designfan42 reports 3-step signup feels 'exhausting' on mobile. Thread had 47 upvotes and 12 replies agreeing. Platform: Reddit, r/ProductDesign, 2026-04-10.",
  tags: ["customer-feedback", "onboarding", "mobile", "friction"],
  project_id: "{project_id}",
  confidence: 0.8
})
```

**Rules for capture**:
- One observation per entry. Do not bundle unrelated findings into a single save.
- Always include the source platform, date, and engagement context (upvotes,
  replies, shares) in the content body.
- Always include a confidence score. If the source is a single user with no
  engagement, use 0.4-0.5. If it is a highly-upvoted thread with many
  agreeing replies, use 0.8-0.9.
- Never save with confidence 1.0 unless you are recording a verified fact
  (e.g., a competitor's publicly announced pricing).
- Tag with both the topic and the knowledge type (see Filing Rules below).

### Phase 2: Compile

**What**: Trigger the compilation engine to merge individual captures into
canonical topic pages with confidence scores, source counts, and contradiction
flags.

**When**:
- After 5+ new captures accumulate for a project.
- After any analysis run completes.
- Before presenting findings to the user.
- When the user asks "what do we know about X?"

**How**:

```tool
compile_knowledge({
  project_id: "{project_id}"
})
```

Or to recompile a specific set of analyses:

```tool
compile_knowledge({
  project_id: "{project_id}",
  analysis_ids: ["{analysis_1}", "{analysis_2}"],
  force: true
})
```

**What compilation does**:
- Groups related captures by topic and subtopic.
- Calculates confidence scores based on source count, recency, and agreement.
- Detects contradictions between captures and flags them.
- Ranks evidence by the source precedence hierarchy (see below).
- Produces canonical topic pages that represent the current compiled truth.

### Phase 3: Synthesize

**What**: Read the compiled topics, identify patterns across them, and write
higher-order synthesis pages that connect themes.

**When**:
- After compilation produces 3+ related topics.
- When the user asks for strategic recommendations.
- Before generating any deliverable (report, spec, content strategy).
- When you notice the same signal appearing in multiple unrelated topics.

**How**:

1. List the current compiled topics:

```tool
list_topics({
  project_id: "{project_id}",
  min_confidence: 0.5
})
```

2. Read the topic pages that share common threads:

```tool
wiki_read({ entry_id: "{topic_page_id}" })
```

3. Write a synthesis page that connects them:

```tool
wiki_write({
  title: "Synthesis: Mobile experience is the dominant churn driver",
  content: "Three independent topic pages converge on the same conclusion...\n\n## Evidence Chain\n- Topic 'Onboarding Friction' (confidence 0.82): ...\n- Topic 'Mobile Performance' (confidence 0.75): ...\n- Topic 'Competitor Advantage: AppX' (confidence 0.68): ...\n\n## Compiled Position\nMobile experience quality is the #1 driver of churn intent...\n\n## Confidence: 0.78\n## Sources: 34 across 3 platforms\n## Last updated: 2026-04-12",
  tags: ["synthesis", "churn", "mobile", "strategic"]
})
```

**Rules for synthesis**:
- A synthesis must cite at least 2 compiled topic pages. If you only have one
  source topic, it is not a synthesis -- it is a summary. Save it as a topic
  update instead.
- Every claim in a synthesis must trace back to a specific topic page.
- State the synthesis confidence as the weighted average of its source topic
  confidences, adjusted downward for any unresolved contradictions.
- If two source topics contradict each other, say so explicitly. Do not paper
  over conflicts.

### Phase 4: Prune

**What**: Remove, archive, or demote knowledge that is stale, superseded,
or contradicted by newer evidence.

**When**:
- During any compile cycle (staleness is checked automatically).
- When new evidence directly contradicts an existing entry.
- Monthly, as a scheduled maintenance task.
- When the knowledge base exceeds 200 entries for a project.

**How**:

1. Find stale topics:

```tool
list_topics({
  project_id: "{project_id}",
  stale_only: true
})
```

2. For each stale topic, decide:
   - **Still valid but old**: Update the entry with a note that no new evidence
     has appeared. Lower the confidence by 0.1.
   - **Superseded**: A newer topic covers the same ground better. Archive the
     old one by adding an `archived` tag and prepending "[ARCHIVED]" to the title.
   - **Contradicted**: Newer evidence disagrees. Update the topic to reflect the
     new position, or split it into two competing views with their respective
     confidence scores.

3. Log the pruning action:

```tool
wiki_log({
  message: "Pruned 3 stale topics: archived 'Early Adopter Pricing Sensitivity' (superseded by 'Price Elasticity Q2 2026'), updated confidence on 2 others.",
  tags: ["maintenance", "pruning"]
})
```


## Filing Rules: Path Conventions

Every knowledge entry must be tagged consistently so that agents, the wiki, and
the frontend can navigate the knowledge base by domain. Use these tag prefixes
as your filing system.

### `customers/` -- Individual Customer Feedback

For direct quotes, specific user complaints, feature requests from identifiable
users or user segments.

**Tags**: `customer-feedback`, plus the topic tag (e.g., `onboarding`, `pricing`).

**Title convention**: `"Customer: {brief description}"`

**When to file here**:
- A specific user said something worth remembering.
- A support thread reveals a pattern you have not seen before.
- A social media post with high engagement surfaces a new complaint or praise.

**Example**:
```tool
save({
  title: "Customer: Enterprise users need SSO before purchase",
  content: "Three separate Reddit threads (r/SaaS, r/devops, r/startup) mention SSO as a hard requirement for enterprise procurement. One user: 'We literally cannot buy tools without SSO — it's a security policy.' Engagement: 89 upvotes combined.",
  tags: ["customer-feedback", "enterprise", "sso", "purchase-blocker"],
  project_id: "{project_id}",
  confidence: 0.85
})
```

### `features/` -- Feature-Related Intelligence

For feature requests, feature comparisons, feature satisfaction data, and
capability gaps.

**Tags**: `feature-intel`, plus the specific feature name (e.g., `export`, `api`,
`mobile-app`).

**Title convention**: `"Feature: {feature name} -- {observation type}"`

**When to file here**:
- Audience is requesting a specific capability.
- Audience is comparing your feature to a competitor's.
- An analysis reveals a feature satisfaction or dissatisfaction pattern.

**Example**:
```tool
save({
  title: "Feature: CSV export -- high demand, low satisfaction",
  content: "Analysis of 23 posts across Reddit and Twitter shows CSV export is mentioned in 40% of 'missing feature' complaints. Current export is described as 'broken' and 'incomplete' by 6 users. Competitor X offers one-click CSV with filters.",
  tags: ["feature-intel", "csv-export", "gap", "competitor-comparison"],
  project_id: "{project_id}",
  confidence: 0.78
})
```

### `themes/` -- Recurring Themes from Analyses

For patterns that emerge from multiple analyses -- not individual data points,
but compiled observations that appear across time and sources.

**Tags**: `theme`, plus the theme name (e.g., `trust-deficit`, `pricing-confusion`,
`onboarding-friction`).

**Title convention**: `"Theme: {theme name}"`

**When to file here**:
- The same signal appears in 3+ separate analyses.
- Compilation reveals a recurring pattern.
- A theme crosses platform boundaries (appears on Reddit AND Twitter AND TikTok).

**A theme is NOT**:
- A single data point (that belongs in `customers/` or `features/`).
- An analyst's speculation (that belongs nowhere -- do not save guesses).
- A restatement of raw analysis output (see Anti-Patterns below).

**Example**:
```tool
wiki_write({
  title: "Theme: Trust deficit with AI-generated recommendations",
  content: "## Evidence\n- Analysis #a1b2: 18 Reddit posts express skepticism about AI accuracy\n- Analysis #c3d4: Twitter sentiment 62% negative on 'AI suggestions'\n- Customer feedback: 'I don't trust the recommendations — they feel random'\n\n## Pattern\nUsers want AI assistance but do not trust it enough to act on recommendations without manual verification. This limits feature adoption for any AI-powered workflow.\n\n## Confidence: 0.73\n## Sources: 31 posts, 3 platforms\n## First observed: 2026-03-15\n## Last confirmed: 2026-04-10",
  tags: ["theme", "trust-deficit", "ai-features", "adoption-blocker"]
})
```

### `signals/` -- Market and Competitive Signals

For market movements, competitor actions, industry trends, and external events
that affect your product or audience.

**Tags**: `signal`, plus the signal type (e.g., `competitor-launch`,
`market-shift`, `regulation`, `trend`).

**Title convention**: `"Signal: {brief description}"`

**When to file here**:
- A competitor launches a new feature or changes pricing.
- Industry regulation affects your market.
- A technology trend shifts audience expectations.
- Macro-economic or cultural shifts affect demand.

**Example**:
```tool
save({
  title: "Signal: Competitor Y launched free tier -- audience response",
  content: "Competitor Y announced a free tier on 2026-04-08. Twitter/Reddit response: 340 mentions in 48 hours. Sentiment: 72% positive. Key themes: 'finally accessible', 'will switch from Z'. 15 posts explicitly mention leaving our product for Y's free tier.",
  tags: ["signal", "competitor-launch", "competitor-y", "pricing", "churn-risk"],
  project_id: "{project_id}",
  confidence: 0.88
})
```

### `channels/` -- Channel-Specific Intelligence

For platform-specific behaviors, audience differences across channels, and
channel strategy data.

**Tags**: `channel-intel`, plus the platform name (e.g., `reddit`, `tiktok`,
`twitter`, `youtube`).

**Title convention**: `"Channel: {platform} -- {observation}"`

**When to file here**:
- Audience behaves differently on one platform vs. another.
- A platform's algorithm or policy change affects reach.
- Content performs differently across channels.
- A new channel emerges as relevant for your audience.

**Example**:
```tool
save({
  title: "Channel: TikTok -- younger demographic, feature-focused discussions",
  content: "TikTok discussions about our product category skew 18-28 (vs Reddit 25-40). Content is feature-demo focused rather than comparison-focused. Engagement on 'how-to' content 3x higher than 'review' content. 12 relevant creators identified with >10k followers.",
  tags: ["channel-intel", "tiktok", "demographics", "content-format"],
  project_id: "{project_id}",
  confidence: 0.70
})
```


## Staleness Detection

Knowledge decays. A theme compiled from feedback that is 30+ days old with no
new supporting evidence is stale. Stale does not mean wrong -- it means
unconfirmed.

### Staleness Rules

| Condition | Status | Action |
|-----------|--------|--------|
| Last evidence < 7 days old | **Fresh** | No action needed |
| Last evidence 7-30 days old | **Aging** | Flag for re-confirmation on next analysis |
| Last evidence 30+ days old, no new support | **Stale** | Lower confidence by 0.15, add `stale` tag |
| Last evidence 60+ days old, contradicted by newer data | **Expired** | Archive with `[ARCHIVED]` prefix |
| Last evidence 60+ days old, still the only data available | **Unconfirmed** | Keep but set confidence to max 0.4 |

### Detecting Staleness

```tool
list_topics({
  project_id: "{project_id}",
  stale_only: true
})
```

This returns topics where the most recent source evidence is older than the
staleness threshold (default: 7 days). Review each one and apply the rules above.

### Staleness in Practice

Do not treat staleness as automatic deletion. A theme like "enterprise buyers
require SSO" does not expire just because nobody mentioned it this month. Use
judgment:

- **Structural truths** (market requirements, regulatory constraints): Slow to
  decay. Lower confidence gradually but do not archive without contradicting
  evidence.
- **Sentiment observations** (audience mood, perception of a feature): Fast to
  decay. Audience sentiment shifts with product updates, competitor moves, and
  cultural trends. Re-confirm frequently.
- **Competitive intelligence** (competitor pricing, features): Medium decay.
  Check quarterly. Archive when confirmed to have changed.


## Create vs. Update vs. Archive: Decision Tree

When you encounter new information, follow this decision tree:

```
New information arrives
│
├─ Does a wiki page already exist for this topic?
│  │
│  ├─ YES: Does the new info agree with the existing page?
│  │  │
│  │  ├─ YES (reinforces): UPDATE the existing page.
│  │  │   - Add the new evidence to the Evidence section.
│  │  │   - Increment the source count.
│  │  │   - Raise confidence by 0.05 (max 0.95).
│  │  │   - Update "Last confirmed" date.
│  │  │
│  │  ├─ PARTIALLY (extends): UPDATE the existing page.
│  │  │   - Add a new subsection for the extension.
│  │  │   - Do not change confidence (new angle, not confirmation).
│  │  │   - Note the extension in the change log.
│  │  │
│  │  └─ NO (contradicts): EVALUATE.
│  │     │
│  │     ├─ New evidence is stronger (more sources, higher engagement,
│  │     │  more recent): UPDATE the page with the new position.
│  │     │  Move the old position to a "Previous view" section.
│  │     │
│  │     ├─ Evidence is roughly equal: ADD a "Conflicting evidence"
│  │     │  section to the page. Lower confidence by 0.1.
│  │     │
│  │     └─ New evidence is weaker: ADD to the page as a dissenting
│  │        data point. Do not change the compiled position.
│  │
│  └─ NO: Does it fit an existing category?
│     │
│     ├─ YES: CREATE a new page using the appropriate filing convention.
│     │
│     └─ NO: CREATE a new page. Consider whether a new tag category is
│        needed or whether you are over-specializing.
│
└─ Is this a meta-observation (pattern across topics)?
   │
   ├─ YES, 2+ source topics: CREATE a synthesis page.
   └─ YES, 1 source topic: DO NOT create a synthesis. Save as a note
      on the source topic instead.
```

### Update Example

```tool
wiki_read({ entry_id: "{existing_topic_id}" })
```

Read the current content, then append the new evidence:

```tool
wiki_write({
  title: "Theme: Onboarding friction on mobile",
  content: "{existing_content}\n\n### New evidence (2026-04-12)\n- Reddit r/UXDesign: 'The mobile signup flow has 3 extra steps compared to desktop' (34 upvotes)\n- Reinforces existing theme. Source count: 12 -> 13.\n\n## Confidence: 0.84 (was 0.82)\n## Last confirmed: 2026-04-12",
  tags: ["theme", "onboarding", "mobile", "friction"],
  entry_id: "{existing_topic_id}"
})
```


## Merging Conflicting Observations

Conflict is normal. Different platforms, time periods, and user segments produce
different signals. The knowledge base must hold contradiction without collapsing
it prematurely.

### Conflict Resolution Process

1. **Identify the scope of each observation.**
   - Is one observation platform-specific? ("TikTok users love feature X" vs.
     "Reddit users hate feature X" is not a contradiction -- it is a segment
     difference.)
   - Is one observation time-bound? (Sentiment from before a product update
     does not contradict sentiment after the update.)

2. **Check the source precedence hierarchy** (see below).

3. **If the conflict is real** (same scope, same time, same segment):
   - Create a "Conflicting evidence" section in the topic page.
   - Present both sides with their evidence chain.
   - State which position has stronger support and why.
   - Lower the overall topic confidence to reflect the uncertainty.
   - Do not pick a winner unless one side has significantly more evidence.

4. **If the conflict is a segment difference**:
   - Split the topic into segment-specific subsections.
   - Each subsection gets its own confidence score.
   - Note the segmentation in the topic summary.

### Example: Real Conflict

```markdown
## Theme: Pricing Perception

### Position A: Price is too high (confidence 0.65)
- 14 Reddit posts complaining about pricing, avg 23 upvotes
- 3 Twitter threads comparing unfavorably to competitors
- Timeframe: 2026-03-01 to 2026-04-05

### Position B: Price is fair for the value (confidence 0.55)
- 8 Reddit posts defending pricing, avg 11 upvotes
- 2 detailed comparison posts showing feature parity justifies price
- Timeframe: 2026-03-15 to 2026-04-10

### Compiled Position
Pricing perception is polarized. Power users who use advanced features
defend the price. Casual users and prospects find it too high relative
to simpler alternatives. This suggests a packaging problem, not a
pricing problem.

**Overall confidence: 0.58** (lowered due to active conflict)
```


## Source Precedence Hierarchy

Not all evidence is equal. When compiling, ranking, or resolving conflicts,
apply this precedence order:

| Rank | Source Type | Weight | Rationale |
|------|------------|--------|-----------|
| 1 | **Direct customer quotes** | 1.0 | Primary evidence. The customer said it. |
| 2 | **Compiled themes** (3+ sources) | 0.9 | Cross-validated patterns from multiple voices. |
| 3 | **Individual feedback items** | 0.6 | Single data points. Valuable but unconfirmed. |
| 4 | **Competitor claims** | 0.4 | Biased source. Useful as signal, unreliable as fact. |
| 5 | **Analyst inference** | 0.3 | Your (or the agent's) interpretation. Must be labeled. |

### Applying Precedence

- When two sources conflict, the higher-ranked source wins by default.
- A lower-ranked source can override a higher-ranked one only if it has
  significantly more volume (5x+ more data points).
- Always label the source type when saving. Use these tags:
  `direct-quote`, `compiled-theme`, `individual-feedback`, `competitor-claim`,
  `analyst-inference`.
- Never present an analyst inference as a compiled theme. If you wrote it,
  tag it as inference.


## Quality Enforcement

### The Test-First Rule

**Test 3-5 items before bulk processing.**

Before running a batch save, compile, or synthesis operation:

1. Process 3-5 items manually.
2. Check: Are the tags consistent? Are the titles following convention? Is the
   content structured with source references?
3. Only proceed with the full batch once you are satisfied with the quality of
   the test items.

This catches tagging mistakes, formatting issues, and misclassifications before
they propagate across dozens of entries.

### Knowledge Gap Disclosure

**Flag knowledge gaps. State explicitly when information is unavailable.**

When a user asks "what does our audience think about X?" and the knowledge base
has no data on X, do not speculate. Say:

> "The knowledge base has no compiled intelligence on X. The closest related
> topic is Y (confidence 0.72). To build knowledge on X, I recommend running
> a search_content query for [suggested terms] and filing the results."

When synthesizing, if a critical dimension is missing, note it:

```markdown
## Gaps
- No data on enterprise segment (all sources are consumer/prosumer)
- No TikTok coverage (all sources are Reddit and Twitter)
- Pricing perception data is >30 days old (stale)
```

### Entity Linking

**Every entity mention MUST link to its wiki page.**

When saving or writing knowledge entries, reference related entities and topics
by their wiki path or entry ID. This creates a navigable knowledge graph.

Good:
```
"Competitor Y (see: Signal: Competitor Y launched free tier, entry #abc123)
launched a free tier, causing churn signals (see: Theme: Churn risk from
free-tier competitors, entry #def456)."
```

Bad:
```
"A competitor launched a free tier and some users are leaving."
```

The second version creates an orphan -- knowledge disconnected from the graph.
It cannot be found, cannot be compiled, and will rot.

### Confidence Score Discipline

| Scenario | Confidence Range |
|----------|-----------------|
| Single unverified mention | 0.3 - 0.4 |
| Single post with moderate engagement (10-50 upvotes) | 0.5 - 0.6 |
| Multiple posts, single platform | 0.6 - 0.7 |
| Multiple posts, multiple platforms, consistent signal | 0.7 - 0.85 |
| Compiled theme with 10+ sources, cross-platform confirmation | 0.85 - 0.95 |
| Verified fact (public announcement, confirmed pricing) | 0.95 |


## Integration Hooks

This skill connects to other CrowdListen tools in specific ways. Understanding
these connections is essential for operating the knowledge cycle correctly.

### `save` -- Capture Entry Point

The primary tool for Phase 1 (Capture). Use for individual observations.

```tool
save({
  title: "...",
  content: "...",
  tags: ["...", "..."],
  project_id: "{project_id}",
  confidence: 0.0-1.0
})
```

Save writes to the Supabase `memories` table and renders a local `.md` file.
When tags include `decision`, `pattern`, `preference`, `learning`, or
`principle`, it also dual-writes to `project_insights` for frontend visibility.

### `recall` -- Semantic Retrieval

Use recall to find relevant existing knowledge before saving new entries. This
prevents duplicates and helps you decide whether to create or update.

```tool
recall({
  query: "onboarding friction mobile",
  project_id: "{project_id}",
  limit: 5
})
```

Recall uses pgvector cosine similarity with a keyword fallback. Always recall
before you save to check for existing entries on the same topic.

### `compile_knowledge` -- Compilation Engine

Triggers the backend compilation pipeline. Takes individual captures and produces
canonical topic pages.

```tool
compile_knowledge({
  project_id: "{project_id}",
  analysis_ids: ["..."],  // optional: scope to specific analyses
  force: false            // optional: recompile even if recently compiled
})
```

### `list_topics` -- Compiled Truth Index

Returns the current compiled topics with confidence scores and staleness
indicators.

```tool
list_topics({
  project_id: "{project_id}",
  min_confidence: 0.5,   // optional: filter low-confidence topics
  stale_only: false,      // optional: only stale topics
  category: "topic"       // optional: filter by category
})
```

### `wiki_write` -- Direct Page Authoring

Use for synthesis pages, manual corrections, and structured topic updates.
Prefer `save` for individual captures; use `wiki_write` for compiled or
synthesized content that you have constructed from multiple sources.

```tool
wiki_write({
  title: "...",
  content: "...",
  tags: ["..."],
  entry_id: "..."  // optional: updates existing entry instead of creating new
})
```

### `wiki_read` -- Read a Specific Page

```tool
wiki_read({ entry_id: "{entry_id}" })
```

### `wiki_list` -- Browse the Index

```tool
wiki_list({ tag: "theme", limit: 20 })
```

### `wiki_search` -- Full-Text Search

```tool
wiki_search({ query: "pricing perception", limit: 10 })
```

### `wiki_ingest` -- Import External Content

Use to bring in articles, blog posts, or competitor documentation:

```tool
wiki_ingest({
  url_or_text: "https://competitor.com/blog/new-feature-announcement",
  source: "competitor-blog"
})
```

### `wiki_log` -- Decision and Activity Journal

Use for audit trails, maintenance logs, and decision records:

```tool
wiki_log({
  message: "Completed monthly pruning cycle. Archived 5 topics, updated 8.",
  tags: ["maintenance", "pruning", "monthly"]
})
```


## Example Workflows

### Workflow 1: Post-Analysis Capture and Compile

An analysis just completed. You need to capture the findings and update the
compiled truth.

**Step 1**: Recall existing knowledge to understand current state.

```tool
recall({ query: "main themes from recent analyses", project_id: "{project_id}" })
```

**Step 2**: Save 3-5 individual captures from the analysis output. Do not save
the raw analysis output -- decompose it into atomic observations.

```tool
save({
  title: "Customer: Users confused by dashboard metrics",
  content: "Analysis #run-042: 8 Reddit posts describe the analytics dashboard as 'overwhelming' and 'confusing'. Users want simpler default views. Engagement: avg 19 upvotes.",
  tags: ["customer-feedback", "dashboard", "ux", "confusion"],
  project_id: "{project_id}",
  confidence: 0.72
})
```

```tool
save({
  title: "Feature: Demand for customizable dashboard widgets",
  content: "Analysis #run-042: 5 posts specifically request drag-and-drop widget customization. 2 posts reference Datadog's dashboard as the desired model. Cross-platform: Reddit (3), Twitter (2).",
  tags: ["feature-intel", "dashboard", "customization", "widget"],
  project_id: "{project_id}",
  confidence: 0.65
})
```

```tool
save({
  title: "Signal: Competitor Z redesigned their analytics page",
  content: "Analysis #run-042: 4 Twitter posts praise Competitor Z's new analytics redesign launched 2026-04-01. Users compare it favorably to our dashboard. 'Z finally nailed the analytics view — wish [our product] would do this.'",
  tags: ["signal", "competitor-z", "dashboard", "analytics"],
  project_id: "{project_id}",
  confidence: 0.70
})
```

**Step 3**: Compile to update the topic pages.

```tool
compile_knowledge({ project_id: "{project_id}" })
```

**Step 4**: Check the compiled output and verify quality.

```tool
list_topics({ project_id: "{project_id}", min_confidence: 0.5 })
```

### Workflow 2: Synthesis from Accumulated Themes

Multiple compilation cycles have produced related topic pages. Time to
synthesize.

**Step 1**: List all compiled topics.

```tool
list_topics({ project_id: "{project_id}", min_confidence: 0.5 })
```

**Step 2**: Identify related topics that share a common thread.

For example, you see:
- "Theme: Dashboard UX confusion" (confidence 0.76)
- "Theme: Information overload in reports" (confidence 0.71)
- "Feature: Customizable views demand" (confidence 0.68)
- "Signal: Competitor Z analytics redesign" (confidence 0.70)

These four topics all point to the same strategic reality.

**Step 3**: Read each topic page to understand the full evidence chain.

```tool
wiki_read({ entry_id: "{dashboard_ux_id}" })
wiki_read({ entry_id: "{info_overload_id}" })
wiki_read({ entry_id: "{customization_id}" })
wiki_read({ entry_id: "{competitor_z_id}" })
```

**Step 4**: Write the synthesis.

```tool
wiki_write({
  title: "Synthesis: Analytics experience is a strategic vulnerability",
  content: "## Thesis\nOur analytics and reporting UX is a growing competitive liability. Four independent lines of evidence converge.\n\n## Evidence Chain\n\n### 1. Dashboard UX confusion (confidence 0.76)\n8+ posts describe the dashboard as overwhelming. Users want simpler defaults.\n\n### 2. Information overload in reports (confidence 0.71)\nGenerated reports contain too much data without prioritization. Users skim or ignore.\n\n### 3. Customization demand (confidence 0.68)\nUsers want to build their own views. Drag-and-drop widgets cited as the ideal pattern.\n\n### 4. Competitor Z redesign (confidence 0.70)\nCompetitor Z shipped a praised analytics redesign. Users are making direct comparisons.\n\n## Compiled Position\nThe analytics experience is not a single bug or missing feature — it is a systemic UX debt that compounds across dashboard, reports, and data presentation. Competitor Z's redesign raises the bar and makes our gap more visible.\n\n## Strategic Recommendation\nPrioritize analytics UX overhaul. Start with customizable dashboard widgets (highest demand signal) and simplified default views (fastest win).\n\n## Confidence: 0.72\n## Sources: 28 posts, 4 compiled topics\n## Platforms: Reddit, Twitter\n## Last updated: 2026-04-12",
  tags: ["synthesis", "analytics", "ux", "strategic", "competitive-vulnerability"]
})
```

**Step 5**: Log the synthesis action.

```tool
wiki_log({
  message: "Created synthesis 'Analytics experience is a strategic vulnerability' from 4 topic pages. Confidence 0.72.",
  tags: ["synthesis", "analytics"]
})
```

### Workflow 3: Monthly Pruning Cycle

Time to clean the knowledge base.

**Step 1**: Find stale topics.

```tool
list_topics({ project_id: "{project_id}", stale_only: true })
```

**Step 2**: For each stale topic, read it and decide.

```tool
wiki_read({ entry_id: "{stale_topic_id}" })
```

Apply the staleness rules:
- Is it a structural truth? Keep but note staleness.
- Is it sentiment data? Likely needs re-confirmation or archival.
- Is it competitive intel? Check if the situation has changed.

**Step 3**: Update or archive each stale topic.

For archival:
```tool
wiki_write({
  title: "[ARCHIVED] Theme: Early adopter pricing sensitivity",
  content: "{existing_content}\n\n---\n## Archived: 2026-04-12\nReason: Superseded by 'Theme: Price elasticity Q2 2026' which has fresher evidence from 22 new sources.",
  tags: ["theme", "pricing", "archived"],
  entry_id: "{stale_topic_id}"
})
```

For confidence reduction:
```tool
wiki_write({
  title: "Theme: API documentation quality complaints",
  content: "{existing_content_with_updated_confidence}\n\n## Staleness Note (2026-04-12)\nNo new evidence in 35 days. Confidence reduced from 0.74 to 0.59. Will archive if no new evidence by 2026-05-12.",
  tags: ["theme", "api-docs", "documentation", "stale"],
  entry_id: "{stale_topic_id}"
})
```

**Step 4**: Log the maintenance cycle.

```tool
wiki_log({
  message: "Monthly pruning: reviewed 12 stale topics. Archived 3, reduced confidence on 5, kept 4 as structural truths.",
  tags: ["maintenance", "pruning", "monthly"]
})
```


## Anti-Patterns: What NOT to Do

These are the most common mistakes agents make when managing the knowledge base.
Each one degrades the compiled truth over time.

### 1. Dumping Raw Analysis Output

**Wrong**:
```tool
save({
  title: "Analysis results 2026-04-12",
  content: "{entire raw JSON or markdown output from an analysis run}",
  tags: ["analysis"],
  project_id: "{project_id}"
})
```

Raw analysis output is not knowledge. It is data. Knowledge is what you extract,
interpret, and file with context. Saving raw output creates noise that drowns
real insight.

**Right**: Decompose the analysis into 3-5 atomic observations, each filed
under the appropriate category with proper tags, source references, and
confidence scores.

### 2. Creating Duplicates Instead of Updating

**Wrong**: Saving a new entry every time you see evidence for an existing theme.

After 10 analyses, you end up with:
- "Onboarding is hard"
- "Users struggle with onboarding"
- "Mobile onboarding friction"
- "New user experience problems"

All of these are the same topic with slightly different wording.

**Right**: Recall first. If a topic page exists, update it with the new evidence.
Create a new page only when the observation is genuinely novel.

### 3. Inflating Confidence Scores

**Wrong**: Assigning confidence 0.9 to a theme based on 3 Reddit posts from the
same subreddit.

**Right**: Follow the confidence score discipline table. Three posts from one
subreddit is a 0.5-0.6 observation. Cross-platform confirmation with high
engagement is needed to reach 0.8+.

### 4. Forgetting to Link Entities

**Wrong**: Mentioning competitors, features, or themes in content without
referencing their wiki pages.

This creates orphaned knowledge that cannot be navigated, compiled, or connected
to related intelligence.

**Right**: Always reference related entries by title or entry ID. Build the graph.

### 5. Synthesizing from a Single Source

**Wrong**: Writing a "synthesis" page that is really just a restatement of one
topic page.

A synthesis must combine insights from 2+ independent topic pages. If you only
have one source, update that source page instead of creating a fake synthesis.

### 6. Never Pruning

**Wrong**: Letting the knowledge base grow indefinitely without reviewing
staleness, contradictions, or superseded entries.

After 6 months, an unpruned knowledge base has:
- 40% stale entries that no longer reflect reality.
- 20% duplicate entries covering the same ground.
- Confidence scores that no longer mean anything because they were never updated.

**Right**: Run the pruning workflow monthly. Treat it as essential maintenance,
not optional cleanup.

### 7. Saving Without a Project Scope

**Wrong**: Saving knowledge without a `project_id`.

Unscoped knowledge floats in the global space where it cannot be compiled,
cannot be scoped to a specific product or audience, and clutters every agent's
recall results.

**Right**: Always include `project_id` when saving project-specific knowledge.
Only omit it for truly global knowledge (tool preferences, process decisions).

### 8. Treating the Knowledge Base as a Chat Log

**Wrong**: Using `save` to record conversational context, session state, or
temporary working notes.

The knowledge base is for compiled truth -- durable knowledge that should persist
across sessions and be available to any agent. Session notes belong in
`wiki_log` if they are decisions worth recording, or nowhere if they are
transient.

**Right**: Ask "would another agent benefit from finding this in 30 days?" If
no, do not save it. If yes, save it with proper filing.
