---
name: crowdlisten:competitive-analysis
description: Competitive intelligence through audience perception analysis. Use when comparing brands, products, or competitors in social conversations.
user-invocable: true
allowed-tools: Bash, Read, Write, WebFetch, Grep
metadata:
  openclaw:
    category: research
    tags: [competitive-intelligence, brand-analysis, social-listening]
    requires_api_key: false
---

# Competitive Analysis

See your market through your audience's eyes using CrowdListen audience intelligence.

Consolidates: competitive-intel, product-signals (competitive gap analysis)

## Before You Start

Ask your human for business context -- this skill produces significantly better output when grounded in specifics:

- **Target market**: Who are the customers? What industry/segment?
- **Key competitors**: Which brands or products to compare against?
- **Constraints**: Budget, timeline, geographic focus?
- **Decision context**: What decisions will this analysis inform? (roadmap, funding, positioning, hiring?)
- **Existing data**: Any prior research, internal metrics, or hypotheses to validate?

## When to Use This Skill

- Competitive analysis and positioning strategy
- Market entry and competitive landscape assessment
- Tracking competitor perception changes over time
- Identifying underserved market segments
- Competitive feature gap identification
- Preparing for fundraising, board meetings, or strategic reviews

## Decision Framework: Choosing the Right Tool

Before starting, determine whether `competitive-analysis`, `crowd_research`, or `run_analysis` is the correct tool for the job. Picking the wrong one wastes time and produces inferior output.

### Decision Tree

```
What is the user asking for?
|
+-- "How do people feel about [single topic]?"
|   --> crowd_research (single-topic deep dive, async, auto-synthesized)
|
+-- "Compare [Brand A] vs [Brand B] vs [Brand C]"
|   --> competitive-analysis (this skill -- multi-entity, structured comparison)
|
+-- "What does my audience think about [my product]?"
|   --> run_analysis (project-scoped, tied to a CrowdListen project, SSE streaming)
|
+-- "What are people switching from and to?"
|   --> competitive-analysis (switching intent detection workflow)
|
+-- "What features are competitors missing?"
|   --> competitive-analysis (white space + gap analysis workflows)
|
+-- "I want ongoing monitoring of [topic]"
|   --> entity-research (scheduled, automated, writes to wiki)
|
+-- "Run a quick sentiment check on [topic]"
|   --> crowd_research with depth: "quick" (~30s)
```

### When NOT to use this skill

- **Single-brand deep dive with no comparison**: Use `crowd_research` instead. This skill adds value through comparison and relative positioning. A single-brand analysis without a competitive frame is better served by `crowd_research` or `run_analysis`.
- **Historical trend tracking**: Use `entity-research` with scheduled runs. This skill captures a snapshot, not a longitudinal view.
- **Content strategy from competitive insights**: Use this skill first to identify gaps, then hand off to `content-strategy` for the editorial plan.
- **Market sizing or TAM/SAM/SOM**: Use `market-research` skill. This skill measures perception, not addressable market.

## Foundation: CrowdListen Tools

This skill builds on CrowdListen's core capabilities:
- `search_content` -- Find discussions mentioning competitors
- `analyze_content` -- Extract sentiment and themes per competitor
- `cluster_opinions` -- Group competitive comparisons by theme
- `extract_insights` -- Pull pain points, feature requests, competitive signals
- `save` -- Persist findings to the knowledge base
- `wiki_write` -- Write structured reports to project wiki

## Intent-Aware Source Mapping

Different competitive questions require different platform priorities. The platform you search first determines the quality ceiling of your analysis. Get this wrong and you spend tokens on low-signal content.

### Source Priority by Intent

| Research Intent | First Source | Second Source | Why |
|----------------|-------------|--------------|-----|
| Product feedback / UX complaints | YouTube | Reddit | YouTube comments on review videos contain specific, emotional product reactions. Reddit threads provide structured discussion. |
| Breaking news / announcements | X/Twitter | Reddit | Twitter breaks news first. Reddit provides the analysis layer 2-6 hours later. |
| Pricing comparisons | Reddit | YouTube | Reddit threads ("Is X worth it?", "X vs Y pricing") are the richest source. YouTube reviews cover pricing in passing. |
| Predictions / trend speculation | Reddit | HackerNews (via web) | Reddit's speculative threads and HackerNews technical analysis produce the strongest forward-looking signal. |
| Migration / switching stories | Reddit | YouTube | "I switched from X to Y" posts live on Reddit. YouTube "Why I switched" videos add narrative depth. |
| Enterprise / B2B perception | X/Twitter | Reddit | B2B buyers signal on Twitter/LinkedIn. Reddit's r/sysadmin, r/devops, etc. provide candid opinions. |
| Consumer electronics / hardware | YouTube | Reddit | Unboxing and review videos drive consumer electronics perception. Reddit validates. |
| Developer tools / APIs | Reddit | HackerNews (via web) | r/programming, r/webdev, and HN threads contain the most technically informed competitive opinions. |

### Implementation Pattern

When searching for competitive intelligence, query the first-priority source with `limit: 20`, then the second source with `limit: 10`. Only go to third-tier sources if the first two return fewer than 5 relevant results combined.

```
search_content({ platform: "[first_source]", query: "[competitor] vs [competitor]", limit: 20 })
search_content({ platform: "[second_source]", query: "[competitor] alternative", limit: 10 })
```

If both return thin results, broaden the query or try `platform: "all"` with `limit: 10` as a fallback.

## Evidence Quality Hierarchy

Not all social content is equally informative. Apply these rules to filter noise and weight evidence correctly.

### Engagement-Based Relevance Floor

Viral content carries signal even when text matching is weak. A post with 50,000 views and 2,000 comments about your competitor's product launch is relevant even if the search query only partially matches.

- Content with **>10,000 total engagement** (likes + shares + comments) gets a relevance floor of 0.3, regardless of text-match score
- Content with **>50,000 engagement** gets a relevance floor of 0.5

### Engagement Scoring Weights

When ranking evidence, weight engagement signals differently:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| Likes / upvotes | x1 | Passive agreement, low effort |
| Shares / retweets | x3 | Active endorsement, amplification intent |
| Replies / comments | x2 | Active engagement, indicates conversation depth |

**Composite engagement score**: `(likes * 1) + (shares * 3) + (replies * 2)`

Use this score to rank quotes and evidence in your output. Lead with the highest-engagement evidence.

### Per-Author Cap

**Maximum 3 quotes per unique source author in any single analysis section.**

This prevents a single prolific commenter or viral thread OP from dominating your findings. If one user's Reddit posts account for 40% of your results, you have a single-voice problem, not competitive intelligence.

When you hit the cap for an author, skip to the next unique voice. Note in your output if a single author was disproportionately present (this itself is a signal worth reporting).

### Source Credibility Tiers for Competitive Intelligence

Apply these tiers when weighing conflicting evidence:

| Tier | Source Type | Weight | Example |
|------|-----------|--------|---------|
| 1 (Strongest) | User migration stories | High | "I switched from Figma to Penpot because..." |
| 2 | Feature comparison threads | Medium-High | "X has this but Y doesn't" from actual users |
| 3 | Independent reviews / teardowns | Medium | YouTube deep-dives, blog benchmarks |
| 4 | Community speculation | Medium-Low | "I heard X is planning to..." |
| 5 (Weakest) | Marketing/PR claims | Low | Official company announcements, press releases |

**Rule**: When Tier 1 evidence contradicts Tier 5 evidence, Tier 1 wins. User experience outranks corporate narrative. Flag the contradiction explicitly in your output.

## Cross-Source Clustering Guidance

When the same competitive story appears on multiple platforms, merge it into a single cluster rather than reporting it three times. Redundant findings waste the reader's time and inflate perceived signal.

### When to Merge

Merge into a single cluster when the same story, event, or opinion appears on **3 or more platforms**. Two-platform overlap is noted but kept separate.

### Clustering Method

Use **entity overlap (Jaccard similarity on proper nouns)** for initial clustering, not just embedding similarity. Embedding similarity catches semantic overlap but misses when two posts discuss different aspects of the same event.

**Process**:
1. Extract proper nouns (company names, product names, person names) from each post
2. Calculate Jaccard similarity: `|intersection| / |union|` of proper noun sets
3. Apply threshold:
   - **General topics**: Merge at Jaccard >= 0.35
   - **Breaking news / announcements**: Merge at Jaccard >= 0.50 (higher threshold because breaking news generates many loosely related posts that should stay separate)
4. Within a merged cluster, keep the highest-engagement version as the primary evidence and reference the others as corroboration

### Cluster Output Format

```markdown
### [Cluster Theme]
**Cross-platform signal**: Found on [Reddit, YouTube, Twitter] ([total] mentions)
**Primary evidence** (Reddit, 2.4k upvotes):
> "[Highest-engagement quote]"
**Corroborating signals**:
- YouTube ([channel], [views]): [summary of same point]
- Twitter ([handle], [retweets]): [summary of same point]
**Platform-specific nuance**: [Any meaningful difference in how platforms discuss this]
```

## Contradiction Handling

Different platforms often show different sentiment about the same competitor. This is signal, not noise. Handle it explicitly.

### Detection

When sentiment polarity for the same competitor differs by more than 0.3 (on a -1 to +1 scale) across two platforms, flag it as a contradiction.

### Resolution Framework

Do not average contradictions away. Instead, investigate the cause:

| Pattern | Likely Cause | Action |
|---------|-------------|--------|
| Reddit negative, Twitter positive | Twitter has more casual/surface reactions; Reddit has experienced users | Weight Reddit higher for product quality; Twitter for brand perception |
| YouTube positive, Reddit negative | YouTube creators may have sponsorship bias | Check for "#ad" or "sponsored" disclosures; discount if present |
| Twitter negative, everything else positive | Twitter outrage cycle (short-lived) | Check post dates -- if Twitter negativity is < 48h old, it may be transient |
| All platforms negative except one | Astroturfing or niche community bias | Investigate the positive platform for bot patterns or small sample size |
| Enterprise sources positive, consumer sources negative | Genuinely different user segments | Report both -- they serve different buyer personas |

### Contradiction Output Format

```markdown
### Sentiment Contradiction: [Competitor Name]
**Reddit**: Negative (pain points around [issue])
**Twitter**: Positive (praise for [feature])
**Diagnosis**: [Explanation based on framework above]
**Recommendation**: [Which signal to weight for the user's specific decision context]
```

## Workflows

### 1. Share of Voice Analysis

Measure how much your audience talks about each competitor.

**Process**:
1. Search for each competitor name + product category keywords
2. Count mentions, normalize by platform (Reddit, Twitter, YouTube, TikTok)
3. Calculate share of voice = competitor_mentions / total_category_mentions
4. Track week-over-week changes

**Output Template**:
```markdown
## Share of Voice Report -- [Category]
**Period**: [date range]

| Brand | Mentions | Share of Voice | Sentiment | WoW Change |
|-------|----------|---------------|-----------|------------|
| [Brand A] | [count] | [%] | [+/-/neutral] | [+/- %] |

### Key Findings
- [Brand] dominates conversation because [reason with evidence]
- [Your brand] is [underrepresented/overrepresented] in [platform]
```

### 2. Sentiment Comparison

Side-by-side sentiment analysis across competitors.

**Process**:
1. Analyze sentiment for each competitor across same time period
2. Break down by dimension: product quality, pricing, support, innovation, reliability
3. Identify sentiment drivers (what causes positive/negative perception)

**Output Template**:
```markdown
## Competitive Sentiment Matrix

| Dimension | Your Brand | Competitor A | Competitor B | Leader |
|-----------|-----------|-------------|-------------|--------|
| Product Quality | [score] | [score] | [score] | [who] |
| Pricing | [score] | [score] | [score] | [who] |

### Sentiment Drivers
**What makes [leader] win on [dimension]**:
- [Evidence from social discussions]
- > "[User quote]"
```

### 3. Switching Intent Detection

Identify users actively considering switching between products.

**Process**:
1. Search for "switching from [competitor]", "alternative to [competitor]", "[competitor] vs [competitor]"
2. Analyze the reasons driving consideration
3. Score switching intent: researching, evaluating, decided
4. Identify which direction switching flows (from whom to whom)

**Output Template**:
```markdown
## Switching Intent Report

### Flow Map
[Competitor A] --(X users)--> [Competitor B]
[Your Brand]   --(Z users)--> [Competitor C]

### Why Users Leave [Competitor]
| Reason | Frequency | Intensity | Where They Go |
|--------|-----------|-----------|---------------|
| [Reason] | [count] | [high/med/low] | [destination] |
```

### 4. White Space Identification

Find unmet needs that no competitor addresses.

**Process**:
1. Collect all feature requests, wishlists, and complaints across all competitors
2. Remove features that any existing player already offers
3. Rank remaining needs by demand strength
4. Assess feasibility and strategic fit

**Output Template**:
```markdown
## White Space Opportunities

| Opportunity | Demand Signal | Nearest Competitor | Gap Size | Strategic Fit |
|-------------|--------------|-------------------|----------|---------------|
| [Need] | [evidence] | [who comes closest] | [Large/Medium] | [High/Med/Low] |

### Top White Space: [Opportunity Name]
**What the audience wants**: [synthesis]
**Your path to capture**: [strategic recommendation]
**Evidence base**: [X discussions, Y platforms, Z sentiment score]
```

### 5. Competitive Feature Gap Analysis

Identify what users want from competitors but cannot get.

**Process**:
1. Search for "[competitor] missing/lacks/wish/doesn't have"
2. Cross-reference with your own product's capabilities
3. Identify opportunities where you can fill the gap

**Output Template**:
```markdown
## Competitive Gap Opportunities

| Gap | Competitor | User Demand | Your Position | Opportunity |
|-----|-----------|-------------|---------------|-------------|
| [Missing feature] | [Competitor] | [High/Med/Low] | [Have/Partial/Don't have] | [Build/Promote/Ignore] |

### Top Opportunity: [Gap Name]
- **What users are saying**: [synthesis of complaints about competitor]
- **Your advantage**: [why you can/should build this]
```

## Integration Hooks

This skill does not operate in isolation. Use these integration points to capture, store, and act on competitive findings.

### Saving Findings to Knowledge Base

After completing any workflow, persist key findings using `save`:

```
save({
  title: "Competitive Intel: [Competitor] vs [Competitor] -- [Date]",
  content: "[synthesis of key findings]",
  tags: ["competitive", "insight", "[competitor-slug]"],
  project_id: "[project_id if scoped]"
})
```

**What to save**: Save the synthesis and top 3-5 findings, not the raw data. Raw data expires; insights compound.

### Writing Structured Reports to Wiki

For findings that should be browsable by the team or other agents:

```
wiki_write({
  title: "Competitive Landscape: [Category] -- [YYYY-MM-DD]",
  content: "[full report in markdown]",
  tags: ["competitive-analysis", "report"]
})
```

Use consistent path patterns so future agents can find prior reports:
- `competitive/[category]/[YYYY-MM-DD]` for periodic reports
- `competitive/[competitor-slug]/gaps` for persistent gap tracking

### Feeding Into Other Skills

| Downstream Skill | What to Pass | How |
|-----------------|-------------|-----|
| `content-strategy` | White space topics, competitor content gaps | Run competitive gap analysis first, then invoke content-strategy with the identified gaps as input context |
| `entity-research` | Competitor entities to track | Create entities via `manage_entities({ action: "create", type: "competitor" })`, then entity-research handles ongoing monitoring |
| `spec-generation` | Feature gaps from competitive analysis | Run `generate_specs` on a completed `run_analysis` that incorporated competitive findings |
| `market-research` | Competitive positioning data | Reference saved competitive intel entries when generating market research reports |

### Querying Prior Intelligence

Before starting a new competitive analysis, check for existing knowledge:

```
wiki_search({ query: "[competitor name] competitive" })
```

If recent reports exist (< 14 days), build on them rather than starting from scratch. Reference prior findings to show trend direction.

## Anti-Patterns

Common mistakes agents make when executing competitive analysis. Avoid these.

### 1. Brand-Name-Only Queries

**Wrong**: `search_content({ query: "Notion" })`
**Right**: `search_content({ query: "Notion vs Obsidian project management" })`

Searching a brand name alone returns product support questions, job postings, and unrelated noise. Always include a competitive or category qualifier.

### 2. Equal Platform Weighting

**Wrong**: Searching all platforms with `limit: 10` each and treating results as equally authoritative.
**Right**: Using the intent-aware source mapping above to prioritize platforms, then weighting evidence by engagement.

A Reddit thread with 500 upvotes and 200 comments carries more signal than a tweet with 3 likes. Do not count them as equal mentions.

### 3. Recency Bias

**Wrong**: Treating the most recent post as the most important.
**Right**: Weighting by engagement and checking whether recent posts represent a genuine trend shift or just noise.

A 2-day-old post with 5 upvotes is not more important than a 30-day-old post with 2,000 upvotes unless the newer post reveals breaking news.

### 4. Competitor Echo Chamber

**Wrong**: Reporting only what users say about competitors, ignoring what they say about the user's own product.
**Right**: Always including the user's brand in the competitive frame. If the user's product is not mentioned in the same conversations, that absence is a finding worth reporting.

### 5. Sentiment Without Context

**Wrong**: "Competitor A has 65% positive sentiment."
**Right**: "Competitor A has 65% positive sentiment, driven primarily by their free tier (42% of positive mentions reference pricing). Their positive sentiment drops to 38% when filtering to enterprise use cases."

Aggregate sentiment without dimension breakdown is nearly useless for decision-making.

### 6. Over-Quoting Low-Quality Sources

**Wrong**: Including 10+ quotes from a single Reddit thread.
**Right**: Enforcing the per-author cap (max 3 quotes per source), diversifying across threads and platforms.

### 7. Treating PR Announcements as Competitive Intelligence

**Wrong**: "Competitor X announced they are the market leader" -- reported as a finding.
**Right**: "Competitor X claims market leadership. User sentiment data shows mixed reception: [evidence]."

Always validate corporate claims against user perception data. That is the entire point of this skill.

### 8. Missing the Non-Consumer

**Wrong**: Only analyzing people who currently use competitor products.
**Right**: Also searching for "why I don't use [competitor]" and "stopped using [competitor]" -- non-users and churned users provide the most actionable competitive intelligence.

## Risk Section

### What Can Go Wrong

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Platform API downtime** | Medium | Incomplete data -- analysis based on subset of platforms | Run `platform_status({ diagnose: true })` before starting. If a key platform is down, note it in the report and recommend re-running when it recovers. |
| **Astroturfing / bot content** | Medium | Inflated or artificial sentiment for a competitor | Look for engagement-to-follower ratio anomalies. Flag accounts with no post history that suddenly appear in competitive threads. Apply the per-author cap to limit damage. |
| **Small sample size** | High (niche markets) | Conclusions drawn from < 10 data points | Always report sample size. If total evidence is < 15 posts across all platforms, explicitly state "low confidence -- insufficient data" and recommend supplementing with `crowd_research` for deeper coverage. |
| **Stale data** | Medium | Competitive landscape has shifted since last data point | Check post dates. If median post age is > 60 days, flag the analysis as potentially outdated. Recommend setting up `entity-research` for ongoing monitoring. |
| **Confirmation bias** | High | Agent selectively surfaces evidence that matches the user's hypothesis | When the user provides a hypothesis ("I think Competitor X is losing market share"), actively search for counter-evidence. Report both confirming and disconfirming signals. |
| **Legal / compliance exposure** | Low | Competitive intelligence that crosses into proprietary data collection | This skill analyzes publicly available social content only. Never scrape private forums, gated content, or internal documents. If a user requests analysis of non-public competitor data, decline and explain the boundary. |
| **Query pollution** | Medium | Search returns content about a competitor with a common name (e.g., "Notion" also means "idea") | Use qualified queries: "[Brand] + [category]" or "[Brand] + [competitor]" to reduce false positives. Review first 3 results for relevance before proceeding with full analysis. |

### Confidence Calibration

Report your confidence level in the output based on evidence quality:

| Evidence Quality | Confidence Label | Criteria |
|-----------------|-----------------|----------|
| Strong | High confidence | 30+ relevant posts, 3+ platforms, consistent signal, diverse authors |
| Moderate | Medium confidence | 15-29 relevant posts, 2+ platforms, mostly consistent signal |
| Weak | Low confidence | < 15 relevant posts, single platform, or contradictory signal |
| Insufficient | Insufficient data | < 5 relevant posts -- recommend `crowd_research` for deeper investigation |

## Integration with CrowdListen

This skill enhances CrowdListen analyses by:
- Adding competitive context to every audience analysis
- Tracking competitive dynamics over time
- Identifying strategic opportunities from audience perception data
- Providing investor-ready competitive intelligence
- Enabling proactive competitive strategy based on real audience signals
- Persisting findings to the wiki for cross-agent and cross-session access
- Feeding competitive gaps into downstream skills (content-strategy, spec-generation)
