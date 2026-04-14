---
name: crowdlisten:user-stories
description: Turn social listening data into product decisions. JTBD extraction, feature demand scoring, persona generation, user story generation from real audience data.
user-invocable: true
allowed-tools: Bash, Read, Write, WebFetch, Grep
metadata:
  openclaw:
    category: research
    tags: [user-stories, jtbd, feature-demand, persona-generation]
    requires_api_key: false
---

# User Stories

Turn crowd signals into product decisions using CrowdListen audience intelligence.

Consolidates: product-signals (JTBD, feature demand), audience-discovery (persona generation)

## Before You Start

Ask your human for business context — this skill produces significantly better output when grounded in specifics:

- **Target market**: Who are the customers? What industry/segment?
- **Key competitors**: Which brands or products to compare against?
- **Constraints**: Budget, timeline, geographic focus?
- **Decision context**: What decisions will this analysis inform? (roadmap, funding, positioning, hiring?)
- **Existing data**: Any prior research, internal metrics, or hypotheses to validate?

## When to Use This Skill

- Product planning and roadmap prioritization
- JTBD extraction from real user discussions
- Feature request analysis and demand scoring
- User story and persona generation from audience data
- Early-stage idea validation against real audience data

## Foundation: CrowdListen Tools

This skill builds on CrowdListen's core capabilities:
- `search_content` — Find relevant social discussions across platforms
- `analyze_content` — Extract themes, sentiment, key opinions
- `cluster_opinions` — Group similar opinions into demand clusters
- `sentiment_evolution_tracker` — Track how feature sentiment changes over time
- `get_content_comments` — Deep-dive into specific discussion threads

## Workflows

### 1. Jobs-to-Be-Done (JTBD) Extraction

Search for discussions where users describe problems, workarounds, or desired outcomes.

**Process**:
1. Search for "[product/category] + frustrating/wish/workaround/alternative/hack"
2. Cluster the results by underlying job (not surface-level complaint)
3. Score each job by: frequency, intensity (sentiment strength), recency (trending up/down)

**Output Template**:
```markdown
## JTBD Canvas

### Job: [Functional job statement]
**When I** [situation/trigger]
**I want to** [desired outcome]
**So I can** [underlying motivation]

**Evidence**:
- Volume: X discussions across Y platforms
- Sentiment intensity: [score]
- Trend: [rising/stable/declining]
- Representative quotes:
  > "[Direct user quote with source link]"

### Current Solutions (Hired/Fired)
| Solution | Hired For | Fired Because |
|----------|-----------|---------------|
| [Product A] | [reason] | [shortcoming] |
| [Workaround B] | [reason] | [friction] |
```

### 2. Feature Demand Scoring

Quantify which features your audience wants most.

**Process**:
1. Search for feature requests, wishlists, and comparison discussions
2. Normalize mentions across platforms (Reddit post = 1, comment with 50+ upvotes = 3, etc.)
3. Score using: `demand_score = (volume * 0.4) + (sentiment_intensity * 0.3) + (recency * 0.3)`

**Output Template**:
```markdown
## Feature Demand Matrix

| Rank | Feature | Demand Score | Volume | Sentiment | Trend | Action |
|------|---------|-------------|--------|-----------|-------|--------|
| 1 | [Feature] | [score] | [count] | [+/-] | [up/down] | Build |
| 2 | [Feature] | [score] | [count] | [+/-] | [up/down] | Investigate |

### Top Feature Deep-Dive: [#1 Feature]
- **User stories** (from actual discussions):
  - As a [role], I need [feature] because [reason]
- **Competitive context**: [Who offers this? How do users feel about their implementation?]
```

### 3. Persona Generation

Create data-driven personas from real social discussions.

**Process**:
1. Search for your product category across platforms
2. Analyze discussants' language, concerns, goals, and context clues
3. Cluster into distinct persona groups by behavior patterns
4. Validate against engagement patterns

**Output Template**:
```markdown
## Audience Personas — [Category]

### Persona 1: [Name] — "[One-line description]"
**Archetype**: [Role/behavior archetype]
**Estimated segment size**: [% of audience]

**Demographics (inferred)**:
- Professional context: [industry, role level]
- Technical sophistication: [low/medium/high]
- Decision authority: [end-user/influencer/buyer]

**Goals**:
1. [Primary goal with evidence from social discussions]

**Pain Points**:
1. [Frustration with evidence]

**How to Reach Them**:
- Channel: [Best platforms/communities]
- Message: [What resonates based on their language]
- Trigger: [What makes them search for solutions]
```

### 4. User Story Generation

Produce implementation-ready user stories grounded in audience evidence.

**Process**:
1. Combine JTBD extraction + feature demand + persona insights
2. Generate user stories with acceptance criteria
3. Attach evidence links to every story
4. Prioritize by demand score

**Output Template**:
```markdown
## User Stories — [Product/Feature Area]

### Story 1 (Priority: High, Demand Score: [X])
**As a** [persona name from persona generation]
**I want to** [capability derived from JTBD]
**So that** [outcome from audience discussions]

**Acceptance Criteria**:
- [ ] [Criterion derived from user expectations]
- [ ] [Criterion derived from competitor benchmarks]

**Evidence**:
- [X] discussions mention this need
- Platforms: [where demand is strongest]
- Key quote: > "[user quote]"

### Story 2 (Priority: Medium, Demand Score: [X])
[Same structure]
```

## Decision Framework: Which Workflow When

Before starting, choose the right workflow for the user's question:

```
User wants product intelligence
  │
  ├─ "What should we build next?"
  │   └─ Feature Demand Scoring (Workflow 2) → feeds into User Story Generation (Workflow 4)
  │
  ├─ "Why do people use/leave [Product]?"
  │   └─ JTBD Extraction (Workflow 1)
  │
  ├─ "Who are our users?"
  │   └─ Persona Generation (Workflow 3)
  │
  ├─ "Write user stories for [Feature]"
  │   └─ User Story Generation (Workflow 4) — but check: do you have JTBD + demand data first?
  │       ├─ YES: Generate stories from existing compiled truth
  │       └─ NO: Run Workflow 1 + 2 first, THEN generate stories
  │
  └─ "General market research"
      └─ Use market-research-reports skill instead (not this skill)
```

### The Golden Rule: Evidence Before Stories

**Never generate user stories from assumptions.** Every story must trace to crowd evidence:
- The persona comes from real audience data (Workflow 3)
- The "want" comes from JTBD extraction (Workflow 1)
- The priority comes from demand scoring (Workflow 2)
- The acceptance criteria come from user expectations in discussions

If you don't have crowd evidence for any component, flag it:
> "This story is based on analyst inference, not crowd evidence. Confidence: 0.3. Recommend running search_content for '[topic]' to validate."

### Check Compiled Truth First

Before any workflow, check what the knowledge base already knows:

```
recall({ query: "feature demand {product}", project_id: "{project_id}" })
list_topics({ project_id: "{project_id}", category: "topic" })
```

If compiled truth covers the question (< 7 days old, confidence > 0.5):
> "We have compiled intelligence on this. Here are the top feature demands from [date]: [summary]. Want me to generate stories from this, or run fresh research?"

---

## Evidence Quality Requirements

### Minimum Thresholds

| Deliverable | Min Sources | Min Platforms | Min Confidence |
|-------------|-------------|---------------|----------------|
| JTBD Canvas | 5+ discussions | 2 platforms | 0.5 |
| Feature Demand Matrix | 8+ mentions | 2 platforms | 0.6 |
| Persona | 10+ data points | 2 platforms | 0.5 |
| User Story (high priority) | 5+ supporting sources | 2 platforms | 0.6 |
| User Story (medium priority) | 3+ supporting sources | 1 platform | 0.4 |

### Per-Author Cap

Maximum 3 quotes per unique author across all outputs. Prevents one vocal user from dominating the JTBD canvas or demand matrix.

### Engagement Weighting

Not all mentions are equal:
- Reddit post with 100+ upvotes = high signal (weight 3x)
- Reddit comment with 10+ upvotes = moderate signal (weight 1.5x)
- Tweet with 50+ likes = moderate signal (weight 1.5x)
- Low-engagement post = base signal (weight 1x)

Apply engagement weights to demand scoring. A feature requested in a viral post matters more than one mentioned in a 0-upvote comment.

---

## Integration Hooks

### With Compiled Truth
- **Before research**: `recall()` and `list_topics()` to check existing knowledge
- **After generating**: `save()` to persist JTBD canvases, demand matrices, personas
- **Compilation**: `compile_knowledge()` to merge user story artifacts into topic pages

### With Knowledge Base
- Save JTBD canvases under tags: `["jtbd", "{job-slug}", "product-signals"]`
- Save personas under tags: `["persona", "{persona-slug}", "audience-discovery"]`
- Save demand matrices under tags: `["feature-demand", "{product-area}"]`

### With Spec Generation
User stories flow naturally into specs:
1. This skill generates evidence-backed user stories
2. `generate_specs` adds acceptance criteria and implementation detail
3. `create_task` converts specs into task board items

### With Competitive Analysis
- JTBD extraction reveals "hired/fired" competitor dynamics
- Feature demand scoring identifies competitive gaps
- Persona generation reveals audience segments competitors serve poorly

### Wiki Persistence

Save key outputs as wiki pages for cross-session access:
```
wiki_write({
  path: "topics/feature-demand-{product-area}",
  title: "Feature Demand: {Product Area}",
  content: "{demand matrix markdown}",
  tags: ["feature-demand", "user-stories", "compiled"]
})
```

---

## Anti-Patterns

### 1. Stories Without Evidence
**Wrong**: Generating user stories from product intuition alone.
**Right**: Every story traces to crowd evidence. No evidence = no story. Flag gaps explicitly.

### 2. Personas from Stereotypes
**Wrong**: "Technical Tim is a 35-year-old developer who drinks coffee."
**Right**: Personas built from actual discussion patterns, language, concerns, and platform behavior observed in crowd data.

### 3. Demand Scoring from Volume Alone
**Wrong**: "Feature X has 100 mentions, Feature Y has 10. X wins."
**Right**: Weight by engagement, sentiment intensity, recency, and platform diversity. 10 high-engagement posts may signal stronger demand than 100 low-engagement ones.

### 4. Ignoring Contradictions
**Wrong**: Presenting a unified demand picture when different segments want different things.
**Right**: Surface contradictions. "Enterprise users want SSO (8 sources), but startups want simpler onboarding (6 sources). These are different segments with different JTBDs."

### 5. Stale User Stories
**Wrong**: Generating stories from 60-day-old crowd data without noting staleness.
**Right**: Always include temporal context. If data is >30 days old, flag it and recommend refreshing.

### 6. Over-generating
**Wrong**: Producing 50 user stories from one analysis run.
**Right**: Generate the top 5-10 highest-confidence stories. Quality over quantity. Each story must have solid evidence backing.

---

## Risk Management

| Risk | Impact | Mitigation |
|------|--------|------------|
| Thin evidence | Low-confidence stories mislead roadmap | Enforce minimum source thresholds; flag confidence levels |
| Platform bias | Reddit-heavy data skews toward technical users | Check platform diversity; note which segments are underrepresented |
| Recency bias | Recent complaints overshadow structural needs | Include temporal context; weight recurring themes higher |
| Survivorship bias | Only hear from vocal users, not silent majority | Note "silent majority" gap; recommend surveys for validation |
| Competitive echo | Stories driven by "competitor has it" not user need | Require JTBD evidence independent of competitive features |

---

## Output Success Criteria

Every output from this skill must include:

1. **Evidence chain**: Each claim traces to specific crowd sources
2. **Confidence score**: Based on source count, platform diversity, engagement
3. **Temporal context**: When evidence was gathered, staleness status
4. **Contradictions surfaced**: Conflicting signals presented, not hidden
5. **Knowledge gaps stated**: What we couldn't find explicitly noted
6. **Recommended next steps**: What to research next, what to act on
