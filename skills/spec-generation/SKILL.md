---
name: crowdlisten:spec-generation
version: 2.0.0
description: >
  Turn crowd intelligence into actionable product specs — feature requests, user stories,
  and acceptance criteria. Teaches agents WHEN evidence is strong enough to spec, HOW to
  score priority from crowd signals, and WHERE specs fit in the compile-to-ship pipeline.
  Encodes judgment against premature speccing and thin-evidence anti-patterns.
user-invocable: true
allowed-tools:
  - generate_specs
  - run_analysis
  - compile_knowledge
  - list_topics
  - wiki_write
  - wiki_read
  - wiki_search
  - recall
  - save
  - create_task
  - claim_task
  - complete_task
metadata:
  openclaw:
    category: product
    tags:
      - spec-generation
      - product-management
      - feature-requests
      - user-stories
      - acceptance-criteria
      - crowd-intelligence
    requires_api_key: false
---

# Spec Generation

Turn crowd analysis into actionable product specs -- feature requests, user stories,
and acceptance criteria grounded in real audience evidence.

**This skill encodes judgment, not procedures.** Specs are commitments. Every spec you
generate consumes engineering attention. The cost of a bad spec is not just wasted code --
it is the good spec that didn't get built because the team was busy building the wrong thing.

Before you generate anything, ask: "Is the evidence strong enough to justify
someone's week of work?"

---

## Decision Framework: When to Spec

Not every piece of crowd intelligence deserves a spec. Most don't.

### Decision Tree

```
User wants specs from crowd data
  |
  +-- Do we have compiled truth on this topic?
  |     |
  |     +-- NO --> Stop. Run research first (crowd-research skill).
  |     |          Specs without compiled truth are guesses.
  |     |
  |     +-- YES --> Is the compiled truth confidence >= 0.5?
  |           |
  |           +-- NO --> Flag as "emerging signal." Do NOT spec.
  |           |          Tell the user: "Evidence is thin. Here's what we
  |           |          have. Want me to gather more before speccing?"
  |           |
  |           +-- YES --> Are there 3+ independent sources?
  |                 |
  |                 +-- NO --> Spec as "exploratory" with LOW priority.
  |                 |          Never mark single-source findings as HIGH.
  |                 |
  |                 +-- YES --> Has the user validated the direction?
  |                       |
  |                       +-- NO --> Present findings, get confirmation.
  |                       |          "Crowd data suggests X. Should I
  |                       |          generate specs for this direction?"
  |                       |
  |                       +-- YES --> Generate specs. Proceed.
```

### When NOT to Spec

- **No compiled truth exists.** Run `recall` and `list_topics` first. If the topic
  has no compiled page, you are speccing from air.
- **Evidence is from a single source.** One Reddit post is an anecdote, not a signal.
- **The user hasn't validated the direction.** Crowd data reveals what people want.
  The user decides what to build. Never skip this step.
- **The finding is a contradiction.** If crowd evidence splits 50/50, you don't have
  a spec -- you have a research question. Surface the contradiction, don't spec through it.
- **Competitor has it but users don't ask for it.** "Competitor X launched feature Y"
  is not user demand. Spec only when users independently express the need.

### Spec Type Selection

Choose the right `spec_type` based on what the evidence supports:

| Evidence Shape | Spec Type | Example |
|----------------|-----------|---------|
| Users describe a problem they face | `feature_requests` | "I can't export data to CSV" |
| Users describe a workflow and its pain | `user_stories` | "As a team lead, I need to see all projects in one view" |
| Users describe what "done" looks like | `acceptance_criteria` | "It should load in under 2 seconds on mobile" |
| Evidence supports all three levels | `all` | Strong topic with clear persona, problem, and success metrics |

When in doubt, start with `feature_requests`. User stories and acceptance criteria
require stronger evidence (specific persona + specific workflow + specific outcome).

---

## Evidence Quality Requirements

Specs inherit the quality of their evidence. Thin evidence produces specs that waste
engineering time. Here are the minimums:

### Feature Requests

**Minimum threshold: 3+ independent sources across 2+ platforms.**

A feature request spec must answer:
- What problem does this solve? (must come from user quotes, not your inference)
- How many people independently raised this? (frequency count)
- How urgent is it? (language analysis: "need," "critical," "blocking," "wish," "nice to have")

If you cannot answer all three from compiled truth, the evidence is insufficient.

### User Stories

**Minimum threshold: Clear user persona + pain point from crowd data.**

A user story spec ("As a [user], I want [feature] so that [benefit]") must have:
- **Persona grounded in data.** "As a startup founder" is only valid if your crowd
  data actually contains startup founders expressing this need. Don't invent personas.
- **Pain point in the user's words.** The "I want" clause must trace to real quotes.
- **Benefit that users articulated.** The "so that" clause must come from user-stated
  outcomes, not your guess about what they'd value.

Bad: "As a user, I want better performance so that I can be more productive."
(Generic, no crowd evidence, could apply to any product.)

Good: "As a team lead managing 10+ projects, I want a unified dashboard so that I
stop switching between 4 tabs to check status."
(Specific persona from crowd data, pain point from user quotes, benefit in their words.)

### Acceptance Criteria

**Minimum threshold: Specific success metrics from user feedback.**

Acceptance criteria require the most evidence because they define "done." You need:
- Users describing what success looks like ("it should..." / "I expect..." / "good enough means...")
- Quantitative signals when available (load times, error rates, capacity numbers)
- Edge cases users actually mentioned (not edge cases you imagined)

If users haven't described success conditions, generate `feature_requests` instead.
Acceptance criteria from thin evidence lock engineering into arbitrary targets.

---

## Spec-to-Task Pipeline

This is the full workflow from crowd intelligence to shipped work. Every step has a
quality gate. Skipping gates produces bad specs that waste engineering time.

### Step 1: Check Compiled Truth (MANDATORY)

```
recall({ query: "[topic]", project_id: "[project]" })
list_topics({ project_id: "[project]" })
```

**Gate: Does compiled truth exist and is it recent (< 14 days)?**

- YES with confidence >= 0.5 --> Proceed to Step 2.
- YES but stale (> 14 days) --> Ask user: "Evidence is [N] days old. Generate specs
  from existing data or refresh first?"
- NO --> Stop. Run crowd-research skill first. Do NOT generate specs.

### Step 2: Evaluate Evidence Strength

Read the compiled truth page:
```
wiki_read({ path: "topics/[topic-slug]", project_id: "[project]" })
```

**Gate: Does the evidence meet minimum thresholds for the requested spec type?**

Check against the Evidence Quality Requirements above. If thresholds aren't met,
tell the user what's missing and offer to gather more evidence.

### Step 3: Generate Specs

```
generate_specs({
  project_id: "[project]",
  analysis_id: "[analysis_id]",    // optional: scope to one analysis
  spec_type: "[type]"              // feature_requests | user_stories | acceptance_criteria | all
})
```

**Gate: Review spec quality before presenting.**

After generation, validate each spec:
- Does it trace to specific evidence? (not generic statements)
- Is the priority justified by crowd signals? (not arbitrary)
- Is the confidence score defensible? (matches source count + diversity)

Discard specs that fail validation. Fewer good specs beat many weak ones.

### Step 4: Present to User for Approval (MANDATORY)

**Never create tasks directly from specs. Always present specs to the user first.**

Format for presentation:
```markdown
## Generated Specs from "[Topic]"

### 1. [Spec Title] (priority: HIGH, confidence: 0.82)
**Type**: feature_request
**Evidence**: 7 sources across Reddit, YouTube, Twitter
**Key quote**: "I spend 20 minutes every morning just checking status across tools" -- r/productivity, 342 upvotes
**Proposed**: Unified dashboard with cross-project status view

### 2. [Spec Title] (priority: MEDIUM, confidence: 0.61)
...

Shall I create tasks for any of these? Or should I refine/drop some first?
```

**Gate: User explicitly approves specs before task creation.**

### Step 5: Save Approved Specs to Wiki

```
wiki_write({
  project_id: "[project]",
  path: "specs/[topic-slug]",
  title: "Specs: [Topic Title]",
  content: "[approved specs with evidence links]",
  tags: ["spec", "approved"]
})
```

### Step 6: Create Tasks from Approved Specs Only

```
create_task({
  title: "[Spec title]",
  description: "[Spec objective with evidence summary and acceptance criteria]",
  project_id: "[project]"
})
```

Then optionally:
```
claim_task({ task_id: "[task_id]" })
```

---

## Integration Hooks

### With Knowledge Base (compile_knowledge / list_topics)

Specs are downstream of compiled truth. The pipeline is:

```
crowd data --> compile_knowledge --> compiled truth --> generate_specs --> specs
```

Always read compiled truth before speccing. If you spec without checking the knowledge
base, you will miss context, duplicate existing specs, or contradict known findings.

```
list_topics({ project_id: "[project]" })   // See all compiled topics
wiki_read({ path: "topics/[slug]" })       // Read the full compiled page
```

### With Wiki (wiki_write)

Save approved specs as wiki pages under `specs/` paths:

```
wiki_write({
  project_id: "[project]",
  path: "specs/unified-dashboard",
  title: "Spec: Unified Dashboard",
  content: "[full spec with evidence, priority, acceptance criteria]",
  tags: ["spec", "approved", "dashboard"]
})
```

This creates a persistent record that other agents and future sessions can reference.
Specs that only exist in chat history are lost specs.

### With Task Board (create_task / claim_task)

Spec-to-task conversion happens AFTER user approval:

```
create_task({
  title: "Implement unified dashboard",
  description: "## Context\n[spec content]\n\n## Evidence\n[crowd quotes]\n\n## Acceptance Criteria\n[testable conditions]"
})
```

Include the evidence summary in the task description. Engineers should see WHY this
was prioritized, not just WHAT to build.

### With Analysis Engine (run_analysis)

When compiled truth is insufficient, run fresh analysis before speccing:

```
run_analysis({
  project_id: "[project]",
  question: "What specific workflow problems do users report with [topic]?",
  platforms: ["reddit", "youtube", "twitter"]
})
```

Then compile results and re-enter the pipeline at Step 1.

---

## Priority Scoring

Priority comes from crowd signals, not gut feel. Here is how to derive it.

### Signal Weights

| Signal | Weight | How to Measure |
|--------|--------|----------------|
| **Frequency** | 0.35 | How many independent people mention it |
| **Engagement** | 0.25 | Upvotes, likes, comments on posts about it |
| **Urgency language** | 0.25 | Presence of "need," "critical," "blocking," "can't work without" |
| **Competitive pressure** | 0.15 | Competitor already ships it AND users reference the competitor |

### Scoring Formula

```
priority_score = (frequency_norm * 0.35) + (engagement_norm * 0.25)
               + (urgency_norm * 0.25) + (competitive_norm * 0.15)
```

Where each component is normalized to 0-1:
- `frequency_norm` = source_count / max_source_count_across_all_topics
- `engagement_norm` = avg_engagement / max_avg_engagement_across_all_topics
- `urgency_norm` = urgent_source_count / total_source_count
- `competitive_norm` = 1.0 if competitor has it AND users reference competitor, else 0.0

### Priority Thresholds

| Score | Priority Label | Action |
|-------|---------------|--------|
| 0.75 - 1.0 | **CRITICAL** | Spec immediately. Multiple people are blocked or churning. |
| 0.50 - 0.74 | **HIGH** | Spec and queue. Strong demand with clear evidence. |
| 0.25 - 0.49 | **MEDIUM** | Spec if capacity allows. Real signal but not urgent. |
| 0.00 - 0.24 | **LOW** | Note as emerging. Do not spec unless user explicitly requests. |

### Priority Red Flags

Reject or downgrade priority when:
- All sources are from the same author (astroturf risk)
- Engagement is high but all from a single viral post (one-time spike, not sustained demand)
- Urgency language comes from a competitor comparison, not organic pain
- The request is technically complex but only 1-2 people want it

---

## Anti-Patterns

### 1. Speccing from Single Data Points

**Wrong**: "One user on Reddit said they want dark mode. Generating feature request spec."

**Right**: "One user mentioned dark mode. Noting as an emerging signal. Will spec if
3+ independent sources confirm."

A single post is an anecdote. Wait for corroboration before spending engineering attention.

### 2. Generating Specs Without Checking the Wiki

**Wrong**: `generate_specs({ project_id, spec_type: "all" })` as the first action.

**Right**: `recall()` then `list_topics()` then evaluate evidence, THEN `generate_specs`.

If you skip the knowledge check, you will generate specs that duplicate existing work,
contradict known findings, or miss important context.

### 3. Over-Speccing: 50 Specs Instead of the Top 5

**Wrong**: Generating specs for every mention in every analysis. Result: 47 specs that
no one reads and no one builds.

**Right**: Generate specs only for topics with confidence >= 0.5 AND priority >= MEDIUM.
Present the top 5-7 to the user. Fewer specs with strong evidence beat a spec avalanche.

If the user asks for "all specs," push back: "I found 34 potential specs. Most have
thin evidence. Here are the top 7 with strong crowd support. Want me to show the rest
as a lower-confidence appendix?"

### 4. Speccing Competitor Features Without User Demand

**Wrong**: "Competitor X launched AI summaries. Generating spec for AI summaries."

**Right**: "Competitor X launched AI summaries. Checking if our users are asking for
this... [searches crowd data]. Found 2 mentions in 30 days. Not enough demand to spec.
Noting as a competitive watch item."

Competitor features are interesting intelligence. They are NOT user demand unless your
audience independently asks for the same thing.

### 5. Accepting AI-Generated User Stories Without Crowd Evidence

**Wrong**: The LLM generates a plausible-sounding user story from general knowledge.
"As a project manager, I want automated reporting so that I save time."

**Right**: Every clause in the user story traces to crowd data. The persona exists in
your audience. The pain point was expressed in user quotes. The benefit was articulated
by real users, not inferred by the model.

If you cannot link each part of the user story to specific crowd evidence, it is
fiction, not a spec.

### 6. Speccing Through Contradictions

**Wrong**: "Some users want simpler pricing, others want more tiers. Generating spec:
simplify pricing to 3 tiers."

**Right**: "Pricing feedback is contradictory (see compiled truth). Enterprise users
want custom tiers. Startups want flat pricing. This is a segmentation decision for the
user, not a spec. Presenting both positions."

When evidence contradicts, surface the contradiction. Let the user make the strategic
call. Specs require directional clarity.

---

## Example Output: Good Spec vs. Bad Spec

### Bad Spec

```
Title: Add dark mode
Type: feature_request
Priority: HIGH
Confidence: 0.9
Objective: Implement dark mode for the application.
Evidence: Users want dark mode.
```

What's wrong:
- No source count or platform breakdown
- "Users want dark mode" is not evidence -- it's a claim without citations
- Priority HIGH with no justification
- Confidence 0.9 is absurdly high for what appears to be thin evidence
- No urgency analysis, no engagement data, no competitive context

### Good Spec

```
Title: Unified cross-project status dashboard
Type: feature_request
Priority: HIGH (score: 0.71)
Confidence: 0.78

Objective: Build a single-view dashboard showing status across all active
projects, replacing the current per-project navigation.

Evidence summary:
- 9 independent sources across Reddit (4), YouTube (3), Twitter (2)
- Compiled topic: topics/dashboard-need (confidence: 0.78, compiled: 2026-04-08)
- Urgency: 5 of 9 sources used "need" or "blocking" language
- Engagement: Reddit thread with 847 upvotes, YouTube comment with 234 likes

Key quotes:
> "I manage 12 projects and spend 20 minutes every morning just clicking
>  through tabs to check status" -- r/productivity, 342 upvotes

> "The #1 thing that would keep me from switching to [Competitor] is if
>  [Product] had a single status view" -- YouTube comment, 234 likes

Priority justification:
- Frequency: 9 sources (top 15% across all topics)
- Engagement: High (847 upvotes on primary thread)
- Urgency: 56% of sources use urgency language
- Competitive: 2 sources reference competitor dashboard as reason to switch

Acceptance criteria (from user feedback):
- [ ] Shows all active projects on one screen without scrolling for < 20 projects
- [ ] Loads in under 3 seconds (users specifically complained about slow page loads)
- [ ] Updates in near-real-time (users mentioned "checking status in the morning")
```

The difference: every claim traces to evidence. Priority is justified by formula.
Acceptance criteria come from user-stated expectations, not invented requirements.

---

## Spec Types Reference

| Type | Description | Evidence Needed |
|------|-------------|-----------------|
| `feature_requests` | New feature ideas from crowd signals | 3+ sources, clear problem statement |
| `user_stories` | "As a [user], I want [X] so that [Y]" | Specific persona + pain point + benefit from crowd data |
| `acceptance_criteria` | Testable conditions for done | User-stated success metrics or quantitative expectations |
| `all` | Generate all three levels | Strong topic with persona, problem, workflow, and success metrics |

---

## Failure Modes and Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| No compiled truth | `list_topics` returns nothing relevant | Run crowd-research skill first, then return |
| Low confidence topic | Compiled truth confidence < 0.5 | Report as emerging signal, don't spec |
| Thin evidence | < 3 sources for feature_requests | Gather more evidence via `run_analysis` on underrepresented platforms |
| Contradictory evidence | Compiled truth flags contradiction | Surface contradiction to user, don't spec through it |
| User hasn't validated | No explicit approval in conversation | Present specs, wait for confirmation before creating tasks |
| Over-generation | > 10 specs produced | Filter to top 5-7 by priority score, present rest as appendix |
| Stale compiled truth | Topic compiled > 14 days ago | Offer to refresh evidence before speccing |

---

## Output Standards

Every spec generation output must include:

1. **Evidence trail** -- source count, platform breakdown, compiled topic link
2. **Priority score** with signal breakdown (frequency, engagement, urgency, competitive)
3. **Confidence score** matching the compiled truth confidence
4. **Key quotes** with platform and engagement metrics
5. **Acceptance criteria** only when user feedback provides success conditions
6. **Gaps flagged** -- what evidence is missing or weak
7. **User approval prompt** -- never assume specs are approved

Output that lacks an evidence trail or presents specs as pre-approved is incomplete.
Fix the gaps before presenting to the user.
