---
name: context-extraction
version: 2.0.0
description: Extract, evaluate, and persist structured context from chat transcripts — decisions, constraints, patterns, preferences, goals. Includes PII protection, skill discovery, and quality evaluation.
requires_api_key: false
---

# Context Extraction

Extract structured context blocks from chat transcripts. Turn raw dialogue into durable knowledge that helps agents work better over time.

## Pipeline

1. **PII Redaction** — Strips emails, phone numbers, names (client-side, before anything leaves the browser)
2. **Block Extraction** — Identifies decisions, constraints, patterns, preferences, goals, insights
3. **Skill Matching** — Recommends CrowdListen skills based on extracted context

```typescript
import { runPipeline } from "@crowdlisten/harness/context/pipeline";

const result = await runPipeline({
  text: chatTranscript,
  source: "chat-export",
  isChat: true,
});
// result.blocks — extracted context blocks
// result.skills — matched skill recommendations
// result.redactionStats — PII redaction summary
```

## Block Types

| Type | Description | Example |
|------|-------------|---------|
| `decision` | Architecture/design decisions | "Chose JWT over session cookies for auth" |
| `constraint` | Limitations, requirements, boundaries | "Budget under $500/mo, must support IE11" |
| `pattern` | Recurring code/workflow patterns | "Always runs lint before committing" |
| `preference` | User preferences for tools, style, workflow | "Prefers functional components over class" |
| `goal` | Project goals and objectives | "Launch MVP by end of Q2" |
| `insight` | Key learnings and observations | "Users abandon onboarding at step 3" |

---

## Decision Framework — When to Extract

### Extract When

- **User uploads a chat export** — Primary trigger. Run the full pipeline.
- **User describes past work patterns** — "I always do X before Y" contains extractable preferences.
- **Project onboarding** — Extract constraints, goals, and existing decisions from introductions.
- **Correction patterns** — "No, don't use classes, use functions" encodes a preference.
- **Post-mortems** — Retrospective conversations contain high-value decisions and insights.

### Do NOT Extract When

- **Casual conversation** — One-off questions like "How do I center a div?" are not persistent context.
- **One-off debugging** — Specific bug fixes rarely generalize.
- **Hypothetical exploration** — "What if we used GraphQL?" is brainstorming, not a decision.
- **Transient instructions** — "For this file only, use tabs" is session-scoped.
- **Already-extracted context** — Always check with `recall` before creating duplicates.

---

## Block Quality Evaluation

A bad block is worse than no block. Every block must pass its type-specific quality gate.

**Decisions** — Must have a clear choice AND a rationale. Bad: "We talked about JWT vs sessions." Good: "Chose JWT with refresh tokens because the app spans multiple subdomains."

**Constraints** — Must be specific and actionable. Bad: "Budget is limited." Good: "Infrastructure budget capped at $200/month on AWS."

**Patterns** — Must appear 2+ times in the transcript or be explicitly stated as habitual. Bad: "User likes testing." Good: "User runs `pytest -x --tb=short` before every commit."

**Preferences** — Must be explicitly stated, not inferred from behavior. Bad: "User seemed to prefer short names." Good: "User said: 'Always use descriptive variable names.'"

**Goals** — Must be measurable or observable. Bad: "Make the app better." Good: "Reduce onboarding drop-off to under 30% before April 15."

**Insights** — Must be non-obvious and evidence-backed. Bad: "Users like fast apps." Good: "80% of support tickets mention search — users treat it as primary navigation."

---

## PII Protection Protocol

Privacy model: **patterns travel to the server, PII stays client-side.**

### Always Redact

| Data Type | Replacement |
|-----------|-------------|
| Email addresses | `[EMAIL]` |
| Phone numbers | `[PHONE]` |
| Full names (people) | `[PERSON]` |
| Physical addresses | `[ADDRESS]` |
| SSN / national IDs | `[ID]` |
| API keys and tokens | `[API_KEY]` |
| Passwords | `[REDACTED]` |

### Keep (Needed for Context)

Company names, product names, public URLs, code snippets (with secrets sanitized), role titles, dates and deadlines.

### Code Snippet Sanitization

Keep the code structure. Replace only secret values:

```
// Before: const client = new S3Client({ accessKeyId: "AKIA1234EXAMPLE" });
// After:  const client = new S3Client({ accessKeyId: "[API_KEY]" });
```

### Privacy Architecture

```
Browser (PII redaction) --> Server (patterns only) --> Storage (memories table)
```

PII redaction happens in the browser before data leaves. The server never sees raw PII. This is enforced architecturally, not by policy.

---

## Skill Discovery Workflow

The highest-value output of extraction is discovering that a user's workflow matches or should become a reusable skill.

### Step 1: Extract Blocks

Run the pipeline. Get the raw block list with types and confidence scores.

### Step 2: Identify Recurring Tool Chains

Look for tool/action sequences appearing 3+ times. Example: "User always runs search_content, then analyze_content, then saves insights" = candidate skill. Threshold: 3+ = investigate, 5+ = strong candidate.

### Step 3: Identify Correction Patterns

User corrections encode preferences: "No, search Reddit first, not Twitter" = platform preference. Each correction is both a preference block AND a signal that existing skills may need updating.

### Step 4: Match Against Existing Skills

```typescript
import { matchSkills } from "@crowdlisten/harness/context/matcher";
const skills = await matchSkills(blocks, { category: "audience-intelligence", limit: 5 });
```

If match scores above 0.7, recommend the existing skill. If the user's workflow adds steps the skill lacks, flag it as an enhancement candidate.

### Step 5: Generate SKILL.md for Novel Patterns

When no existing skill matches, generate a draft SKILL.md with name, steps (the recurring tool chain), preferences (from corrections), and triggers (when the user initiates this workflow). Save with `wiki_write` for human review. Never auto-publish.

---

## Integration Hooks

### save — Persist Important Blocks

```
save({
  title: "Auth decision: JWT with refresh tokens",
  content: "Chose JWT with short-lived access tokens (15 min) and long-lived refresh tokens (7 days)...",
  tags: ["decision", "auth", "security"],
  project_id: "proj_abc123"
})
```

### recall — Check for Existing Context

Always check before saving to avoid duplicates:

```
recall({ query: "authentication decision JWT", project_id: "proj_abc123", limit: 3 })
```

If `recall` returns a high-similarity match, update the existing block rather than creating a new one.

### skills — Discover Matching Skills

```
skills({ query: "competitive analysis workflow" })
```

If a match is found, suggest activation.

### wiki_write — Save as Wiki Pages

For complex multi-block extractions, save as a structured wiki page:

```
wiki_write({
  title: "Project Alpha — Extracted Context (2026-04-12)",
  content: "## Decisions\n- JWT auth...\n\n## Constraints\n- AWS budget $200/mo...",
  tags: ["context-extraction", "project-alpha"]
})
```

### Knowledge Compilation

Extracted blocks feed the compiled knowledge base over time:
raw transcript --> extracted blocks --> saved memories --> compiled knowledge

---

## Saving Strategy

Not everything extracted deserves to be saved. Storage is cheap but attention is expensive.

### Save These

| Category | Shelf Life |
|----------|------------|
| Decisions with rationale | Long (until reversed) |
| Hard constraints (budget, timeline, compliance) | Long (until lifted) |
| Recurring patterns (3+ times) | Medium (patterns evolve) |
| Explicit preferences | Medium (preferences shift) |
| Measurable goals | Until achieved or abandoned |
| Non-obvious insights | Long |

### Discard These

Session-specific instructions, debugging notes, temporary state ("I'm on the auth branch"), brainstorming that led nowhere, common knowledge ("React uses a virtual DOM"), duplicates of existing context.

### The 30-Day Test

Before saving: **"Would another agent benefit from finding this in 30 days?"** Yes = save with clear tags. No = let it go. Maybe = save with a `low-confidence` tag so it ranks lower in recall.

---

## Anti-Patterns

### 1. Saving Raw Transcript as Context
The point of extraction is distillation. A 500-line transcript saved verbatim is noise. Extract the 5-10 blocks that matter.

### 2. Inferring Preferences from Single Interactions
"The user used a for-loop once, so they prefer imperative style." No. A preference requires explicit statement or 3+ consistent repetitions.

### 3. Over-Extracting
If a 20-message chat produces 50 blocks, something is wrong. Typical yield: 3-8 blocks. Most messages are execution or clarification, not extractable context.

### 4. Not Checking for Existing Context Before Saving
Always run `recall` before `save`. Duplicate blocks dilute search quality and create conflicting sources of truth.

### 5. Saving PII-Containing Blocks
If a block contains actual emails or names (not `[EMAIL]` tokens), redaction failed. Never save unredacted PII. Re-run the redaction step.

### 6. Treating Questions as Decisions
"Should we use Redis?" is a question. "We decided to use Redis because our reads are 10x writes" is a decision. Extract the answer, not the question.

### 7. Extracting from Agent Output
The user's words are context. The agent's suggestions are generated artifacts that may be wrong. Extract what the user said, decided, or corrected — not what the agent proposed.

### 8. Saving Without Tags
An untagged block is nearly invisible to `recall`. Always include the block type plus 2-3 domain tags. Good: `["decision", "auth", "security"]`. Bad: `[]`.

---

## Example: Extraction from a Sample Chat

### Input Transcript (after PII redaction)

```
User: We need social login. Our users are mostly on Google and GitHub — no Facebook.
Agent: Should I use NextAuth or a custom implementation?
User: Use NextAuth. We already have it partially set up. But store refresh tokens
      server-side, not in cookies. Security audit finding from last quarter.
Agent: What database for the session store?
User: Supabase — our only database. And always write migration files, no manual SQL.
User: One more thing — always run the full test suite before merging. No exceptions.
```

### Extracted Blocks

**Block 1 — Decision**: "Social login: Google and GitHub via NextAuth. Partially set up from prior codebase."
Tags: `["decision", "auth", "social-login", "nextauth"]`

**Block 2 — Constraint**: "Refresh tokens must be server-side, not in cookies. Security audit finding."
Tags: `["constraint", "security", "auth", "tokens"]`

**Block 3 — Constraint**: "Supabase is the only database. All persistence goes through Supabase."
Tags: `["constraint", "database", "supabase"]`

**Block 4 — Preference**: "Database changes via migration files only. No manual SQL."
Tags: `["preference", "database", "migrations"]`

**Block 5 — Pattern**: "Full test suite required before every merge, regardless of change size."
Tags: `["pattern", "testing", "workflow"]`

### What Was NOT Extracted

- Agent's suggestion about NextAuth vs custom (agent output, not user context)
- OAuth2 protocol details (common knowledge)
- "Users are mostly on Google and GitHub" (captured implicitly by the decision)

### Saving

```
recall({ query: "authentication social login", project_id: "proj_abc123" })
// No match — save all five blocks
save({ title: "Social login: Google + GitHub via NextAuth", ... })
save({ title: "Refresh tokens server-side only", ... })
save({ title: "All data through Supabase", ... })
save({ title: "Always use migration files", ... })
save({ title: "Full test suite before merge", ... })
```
