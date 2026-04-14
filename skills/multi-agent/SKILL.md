---
name: multi-agent
version: 2.0.0
description: Multi-agent coordination — teaches agents when to work solo vs. together, how to claim work without conflicts, share knowledge through wiki, and coordinate through the task board. Encodes the judgment that prevents wasted parallel effort.
requires_api_key: false
---

# Multi-Agent Coordination

The skill that turns independent agents into a functioning team. Every section teaches you WHEN to coordinate, HOW to avoid conflicts, and WHY shared state matters more than individual speed.

**This skill encodes coordination judgment.** An agent working alone is fast. Two agents working on the same thing without coordination is slower than one. This skill is the difference.

---

## Decision Framework: Solo vs. Multi-Agent

Before involving other agents, decide whether coordination actually helps. Getting this wrong adds overhead that slows everyone down.

### Decision Tree

```
You have a task to complete
  |
  +-- Is this a single, focused deliverable?
  |   |
  |   +-- YES: Can you finish it in one session?
  |   |   |
  |   |   +-- YES --> Work solo. No coordination needed.
  |   |   +-- NO  --> Break into subtasks. Create tasks on the board.
  |   |              Another agent (or future you) picks up the rest.
  |   |
  |   +-- NO: Does it span multiple domains?
  |       (e.g., research + implementation + testing)
  |       |
  |       +-- YES --> Multi-agent. Split by domain expertise.
  |       +-- NO  --> Probably sequential. Create ordered tasks.
  |
  +-- Is there a task board with unclaimed work?
  |   |
  |   +-- YES --> Check the board first. Claim something useful.
  |   +-- NO  --> Create the board. Break the work down.
  |
  +-- Are multiple agents already active on this project?
      |
      +-- YES --> Read the wiki. Check task board. Claim unclaimed work.
      +-- NO  --> You are the first. Set up the coordination surface.
```

### When Multi-Agent Wins

Multi-agent coordination produces better results when:

- **Research + implementation are happening in parallel.** One agent researches pricing sentiment while another implements the pricing page. Neither blocks the other.
- **The task board has more unclaimed work than one agent can handle.** Three agents each claiming different tasks clear a backlog faster than one agent doing them sequentially.
- **Different domains need different expertise.** A crowd research agent finding user pain points while a spec generation agent turns previous findings into user stories.
- **Long-running async work needs monitoring.** One agent kicks off `crowd_research`, another agent checks status and processes results when ready.

### When Solo Wins

Do NOT involve multiple agents when:

- **The task is a single focused deliverable.** Writing one function, fixing one bug, drafting one document. Coordination overhead exceeds the work itself.
- **Tasks have strict sequential dependencies.** If Agent B literally cannot start until Agent A finishes, you have a pipeline, not parallel work.
- **The project is in early discovery.** One agent exploring a problem space produces more coherent understanding than three agents exploring simultaneously with no shared frame.
- **Context switching cost exceeds coordination benefit.** If explaining the task to another agent takes longer than doing it yourself, work solo.

---

## Agent Roles and Capabilities

Agents are general-purpose, but coordination works best when each agent takes a clear role within a session. Roles are not permanent identities -- they are hats an agent wears for a specific workflow.

### Researcher

Gathers intelligence, runs analyses, compiles findings into the wiki.

**Primary tools**: `crowd_research`, `run_analysis`, `search_content`, `recall`, `wiki_write`

**Responsibilities**:
- Frame research questions with specificity and scope
- Check wiki for existing compiled truth before running new research
- Evaluate source quality (confidence scoring, platform diversity)
- Write compiled findings to wiki with proper confidence scores and citations
- Flag knowledge gaps and contradictions for other agents

**Outputs**: Wiki pages under `topics/`, entity research, compiled truth documents

**Judgment call**: A researcher should NEVER start a `crowd_research` run without first checking `recall()` and `wiki_search()`. Redundant research is the most common multi-agent waste.

### Implementer

Claims tasks, writes code, creates deliverables, marks work complete.

**Primary tools**: `list_tasks`, `claim_task`, `complete_task`, `wiki_read`, `save`

**Responsibilities**:
- Check the task board before starting any work
- Claim a task BEFORE beginning implementation (never work unclaimed)
- Read wiki for context that other agents have compiled
- Log progress via `complete_task` with `progress: true` at meaningful milestones
- Mark tasks complete with a summary of what was delivered

**Outputs**: Code changes, PRs, configuration files, completed task records

**Judgment call**: An implementer who starts coding without reading the wiki is ignoring intelligence that could change their approach. Always read context first.

### Reviewer

Validates quality of research, specs, and implementations produced by other agents.

**Primary tools**: `wiki_read`, `list_tasks`, `recall`, `run_analysis`

**Responsibilities**:
- Review compiled truth for confidence score accuracy and source quality
- Validate that specs match the research they were derived from
- Check implementations against acceptance criteria in tasks
- Flag issues by creating new tasks or writing review notes to wiki
- Run spot-check analyses to verify research findings are still current

**Outputs**: Review notes in wiki, new tasks for issues found, quality assessments

**Judgment call**: A reviewer adds value only when they bring fresh perspective. If you just re-read what the researcher wrote and agree, you added overhead, not quality. Challenge assumptions. Spot-check sources. Run a quick `run_analysis` to see if findings hold.

### Orchestrator

Breaks down large goals into tasks, assigns work, monitors overall progress.

**Primary tools**: `create_task`, `list_tasks`, `wiki_write`, `wiki_read`, `execute_task`

**Responsibilities**:
- Decompose high-level goals into discrete, claimable tasks
- Write task descriptions with enough context that any agent can pick them up
- Monitor task board for bottlenecks and blocked work
- Dispatch server-side agents via `execute_task` for async processing
- Maintain a project status page in the wiki
- Rebalance work when tasks take longer than expected

**Outputs**: Task board populated with well-described work items, project status wiki pages

**Judgment call**: An orchestrator who creates 50 micro-tasks is creating busy work, not coordination. Tasks should be meaningful units of work that take 10-60 minutes. Too granular and the coordination cost exceeds the work. Too coarse and agents cannot parallelize.

---

## Coordination Patterns

These patterns prevent the failure modes that kill multi-agent productivity.

### Pattern 1: Claim Before Work

**The rule**: Never start work on something without claiming it first.

```
# CORRECT
list_tasks({ project_id: "proj_123" })
# See unclaimed task "Research competitor pricing"
claim_task({ task_id: "task_456" })
# NOW begin the research

# WRONG
# Just start researching competitor pricing without checking the board
# Another agent is already doing the same research --> wasted effort
```

**Why this matters**: Without claiming, two agents can independently start the same work. The task board is the single source of truth for who is doing what. Claiming is a lightweight lock -- it tells every other agent "I've got this."

**Edge case**: If you find work that needs doing but no task exists for it, create the task AND claim it in sequence:

```
create_task({
  project_id: "proj_123",
  title: "Research competitor pricing models",
  description: "Survey pricing pages and user sentiment for top 5 competitors. Write findings to wiki at topics/competitor-pricing."
})
# Returns task_id
claim_task({ task_id: "[returned_id]" })
```

### Pattern 2: Wiki as Shared Memory

**The rule**: All cross-agent knowledge goes through the wiki. Not chat. Not local files. The wiki.

```
# After completing research, write findings to wiki
wiki_write({
  project_id: "proj_123",
  path: "topics/competitor-pricing",
  title: "Competitor Pricing Analysis",
  content: "## Competitor Pricing\n\nConfidence: 0.82\n\n### Key Findings\n...",
  tags: ["research", "pricing", "competitors"]
})

# Another agent, before implementing pricing page:
wiki_read({ project_id: "proj_123", path: "topics/competitor-pricing" })
# Now has full context from the researcher's work
```

**Why this matters**: Agents do not share memory. Agent A's conversation context is invisible to Agent B. The wiki is the shared memory surface that makes multi-agent coordination possible. If it is not in the wiki, it does not exist for other agents.

**Wiki organization for multi-agent projects**:

```
wiki/
  status/           <-- Project status, who is working on what
  topics/           <-- Compiled research findings
  specs/            <-- Generated specifications
  decisions/        <-- Architecture and design decisions
  entities/         <-- Tracked entities (competitors, people, products)
  reviews/          <-- Quality review notes
```

### Pattern 3: Task Board as Coordination Layer

**The rule**: The task board is the single source of truth for all active work.

The coordination cycle:

```
1. list_tasks({ project_id: "proj_123" })
   --> See all tasks: claimed, unclaimed, completed

2. Identify unclaimed tasks matching your capabilities

3. claim_task({ task_id: "task_789" })
   --> You now own this task. Other agents see it as claimed.

4. Do the work. Log progress at milestones:
   complete_task({ task_id: "task_789", progress: true })
   --> Signals "still working, here's where I am"

5. Finish and mark complete:
   complete_task({
     task_id: "task_789",
     result: "Completed pricing research. Findings at wiki: topics/competitor-pricing"
   })
```

**Task states agents should respect**:

| State | Meaning | What to do |
|-------|---------|------------|
| unclaimed | Available work | Claim it if you can do it |
| claimed | Another agent is on it | Do NOT duplicate this work |
| in_progress | Active work with progress logged | Check if the agent needs help |
| completed | Finished | Read the result, build on it |
| blocked | Cannot proceed | Check if you can unblock it |

### Pattern 4: Progress as Communication

**The rule**: Log progress, not just completion. Other agents need to see your state.

```
# BAD: Claim task, go silent for 30 minutes, then mark complete
claim_task({ task_id: "task_456" })
# ... 30 minutes of silence ...
complete_task({ task_id: "task_456", result: "Done" })

# GOOD: Claim task, log meaningful progress, then complete
claim_task({ task_id: "task_456" })

# After first milestone:
complete_task({
  task_id: "task_456",
  progress: true,
  result: "Searched Reddit and YouTube. 14 sources found. Analyzing contradictions."
})

# After completion:
complete_task({
  task_id: "task_456",
  result: "Research complete. 18 sources across 3 platforms. Compiled to wiki at topics/pricing-sentiment. Confidence: 0.78. One contradiction flagged."
})
```

**Why this matters**: When Agent B checks the task board and sees Agent A's task is "claimed" with no progress for 30 minutes, Agent B does not know if Agent A is stuck, crashed, or almost done. Progress logs tell the team what is actually happening.

---

## Shared Knowledge Protocol

Knowledge that stays in one agent's session dies when that session ends. Knowledge that reaches the wiki compounds across every future session.

### Save Early, Save Often

When you discover something useful, write it to the wiki immediately. Do not wait until you have a complete analysis.

```
# Found an important data point during research
wiki_write({
  project_id: "proj_123",
  path: "topics/pricing-signals",
  title: "Pricing Signals (Draft)",
  content: "## Early Signals\n\nFound 3 Reddit threads from this week showing pricing pushback from startup segment. Full analysis pending.\n\n### Raw Quotes\n- ...",
  tags: ["draft", "pricing"]
})
```

A draft in the wiki is infinitely more valuable than a complete analysis in a dead session.

### Check Before You Research

Before running ANY research or analysis, check what already exists:

```
# Step 1: Semantic search across all saved knowledge
recall({ query: "competitor pricing models", project_id: "proj_123" })

# Step 2: Check wiki for compiled topics
wiki_search({ project_id: "proj_123", query: "pricing" })

# Step 3: List all wiki pages to see the full knowledge map
wiki_list({ project_id: "proj_123" })
```

If another agent already researched this topic, build on their work. Do not redo it.

### Cross-Agent Knowledge Synthesis

After multiple agents have written findings to the wiki, synthesize:

```
# Compile findings from multiple analysis runs into unified topic pages
compile_knowledge({
  project_id: "proj_123",
  analysis_ids: ["analysis_a", "analysis_b", "analysis_c"]
})
```

This merges findings from different agents and sessions into coherent compiled truth pages. Run this after a batch of research tasks completes.

---

## Integration Hooks

### Task Board Tools

| Tool | Multi-Agent Role |
|------|-----------------|
| `list_tasks` | See all work: claimed, unclaimed, completed. Start here. |
| `create_task` | Break down goals into claimable units. Orchestrator's primary tool. |
| `claim_task` | Claim ownership. Prevents duplicate work. Claim before starting. |
| `complete_task` | Log progress (`progress: true`) or mark done. Communication tool. |
| `execute_task` | Dispatch server-side agent for async work. Orchestrator dispatches, others can poll. |
| `get_execution_status` | Check on server-side agent execution progress. |

### Wiki Tools (Shared Memory)

| Tool | Multi-Agent Role |
|------|-----------------|
| `wiki_write` | Write findings, decisions, status updates. The primary sharing mechanism. |
| `wiki_read` | Read what other agents have written. Do this before starting work. |
| `wiki_list` | See all wiki pages. Understand the project's knowledge map. |
| `wiki_search` | Find specific knowledge across the wiki. Check before researching. |
| `wiki_ingest` | Bulk import external documents into the wiki for all agents to access. |
| `wiki_log` | Append timestamped entries. Good for status logs and audit trails. |

### Memory Tools

| Tool | Multi-Agent Role |
|------|-----------------|
| `save` | Persist important discoveries with semantic tags for future recall. |
| `recall` | Search saved knowledge semantically. First thing to check before new work. |

### Cross-Skill Integration

| Skill | How It Connects |
|-------|----------------|
| `crowd-research` | Researcher agents use this for intelligence gathering. Results go to wiki. |
| `spec-generation` | Implementer agents consume specs generated from crowd research. |
| `entity-research` | Researcher agents track entities over time. Wiki is the accumulation layer. |
| `knowledge-base` | Wiki pages follow knowledge base conventions for staleness, pruning, merging. |
| `competitive-analysis` | Specialized research that feeds the same wiki and task board. |

---

## Anti-Patterns

These are the mistakes that make multi-agent coordination worse than working solo. Learn them. Avoid them.

### 1. Duplicate Research

**What happens**: Two agents both research "competitor pricing" because neither checked the wiki or task board first.

**Cost**: Double the API calls, double the time, and conflicting compiled truth pages that need manual merging.

**Prevention**: ALWAYS run `recall()` and `wiki_search()` before starting research. ALWAYS check `list_tasks()` before creating a new task. If someone else is already on it, find different work.

### 2. Wiki Blindness

**What happens**: An agent starts implementing a feature without reading the wiki. Another agent already researched the requirements and wrote detailed findings. The implementer builds the wrong thing.

**Cost**: Rework. The implementer's work does not match what the research discovered.

**Prevention**: Before starting ANY implementation task, read all relevant wiki pages. If your task is "implement pricing page," read `topics/pricing`, `topics/competitor-pricing`, and any specs at `specs/pricing-page`.

### 3. Claiming Without Capacity

**What happens**: An agent claims 5 tasks but only has capacity to finish 2. The other 3 sit claimed but unworked, blocking other agents who could have done them.

**Cost**: Three tasks sit idle. Other agents see them as claimed and skip them. Total project throughput drops.

**Prevention**: Claim one task at a time. Finish it (or release it) before claiming the next. If you know you will not finish a task, do not claim it.

### 4. Silent Work

**What happens**: An agent claims a task and goes silent. No progress logged. Other agents cannot tell if the work is progressing, stuck, or abandoned.

**Cost**: Other agents cannot make decisions about related work. The orchestrator cannot rebalance. If the agent crashes, no one knows what was accomplished.

**Prevention**: Use `complete_task` with `progress: true` at every meaningful milestone. A one-sentence progress update every 10-15 minutes costs almost nothing and gives the team visibility.

### 5. Bypassing the Task Board

**What happens**: An agent notices something that needs doing and just does it, without creating or claiming a task. The work is invisible to other agents.

**Cost**: Another agent might do the same work. The orchestrator cannot track progress. There is no record of what was done or why.

**Prevention**: If work needs doing, create a task for it. If a task already exists, claim it. The task board is the coordination surface. Work that is not on the board does not exist for the team.

### 6. Overloading the Wiki

**What happens**: An agent writes a 5000-word brain dump to a single wiki page instead of structured, focused pages.

**Cost**: Other agents cannot quickly find what they need. Search becomes noisy. The page becomes a maintenance burden.

**Prevention**: Write focused wiki pages. One topic per page. Use clear paths (`topics/pricing`, not `notes/stuff-i-found`). Include a summary at the top so other agents can quickly assess relevance.

### 7. Orchestrating Without Context

**What happens**: An orchestrator creates tasks based on a high-level goal without reading the existing wiki or checking what research has already been done.

**Cost**: Tasks may duplicate existing work, miss key context, or describe requirements that the research contradicts.

**Prevention**: An orchestrator's first action is ALWAYS to read the wiki and the existing task board. Decompose work based on what is known, not what is assumed.

---

## Example Workflow: Research to Spec to Implementation

A complete multi-agent cycle showing three agents coordinating on a pricing page feature.

### Phase 1: Orchestrator Sets Up the Work

The orchestrator reads the project context and creates tasks:

```
# Read existing knowledge
wiki_list({ project_id: "proj_123" })
list_tasks({ project_id: "proj_123" })

# Create the research task
create_task({
  project_id: "proj_123",
  title: "Research: User pricing sentiment and competitor pricing models",
  description: "Run crowd research on pricing perception. Check Reddit, YouTube, Twitter. Compare against top 3 competitors. Write findings to wiki at topics/pricing-research. Target: confidence >= 0.7 with 3+ platforms."
})

# Create the spec task (depends on research)
create_task({
  project_id: "proj_123",
  title: "Spec: Pricing page requirements based on research",
  description: "Read wiki at topics/pricing-research. Generate user stories and acceptance criteria for the pricing page. Write spec to wiki at specs/pricing-page. BLOCKED UNTIL: research task is complete."
})

# Create the implementation task (depends on spec)
create_task({
  project_id: "proj_123",
  title: "Implement: Build pricing page per spec",
  description: "Read spec at wiki specs/pricing-page. Implement the pricing page component. Follow acceptance criteria exactly. BLOCKED UNTIL: spec task is complete."
})

# Write status to wiki
wiki_write({
  project_id: "proj_123",
  path: "status/pricing-feature",
  title: "Pricing Feature Status",
  content: "## Pricing Feature\n\nCreated: 2026-04-12\n\n### Tasks\n1. Research (unclaimed)\n2. Spec (blocked on research)\n3. Implementation (blocked on spec)\n\n### Status: Waiting for researcher",
  tags: ["status", "pricing"]
})
```

### Phase 2: Researcher Claims and Executes

A researcher agent checks the board and picks up the research task:

```
# Check the board
list_tasks({ project_id: "proj_123" })
# Sees "Research: User pricing sentiment" -- unclaimed

# Check existing knowledge first
recall({ query: "pricing feedback user sentiment", project_id: "proj_123" })
wiki_search({ project_id: "proj_123", query: "pricing" })
# No recent compiled truth found

# Claim the task
claim_task({ task_id: "task_research_001" })

# Run the research
run_analysis({
  project_id: "proj_123",
  question: "What are current user perceptions of our pricing? Include complaints, comparisons to competitors, and switching intent.",
  platforms: ["reddit", "youtube", "twitter"]
})

# Log progress
complete_task({
  task_id: "task_research_001",
  progress: true,
  result: "Analysis running. 22 sources found across 3 platforms. Evaluating quality now."
})

# Write findings to wiki
wiki_write({
  project_id: "proj_123",
  path: "topics/pricing-research",
  title: "Pricing Research Findings",
  content: "## Pricing Sentiment Analysis\n\nConfidence: 0.81 | Sources: 22 | Platforms: Reddit, YouTube, Twitter\nCompiled: 2026-04-12\n\n### Key Findings\n1. Enterprise users (8 sources): Pricing perceived as fair...\n2. Startup segment (9 sources): #1 concern is per-seat cost...\n3. Competitor comparison (5 sources): We are mid-range...\n\n### Contradiction\nYouTube reviewers call pricing 'great value' while Reddit users call it 'expensive'. Likely audience segmentation (see detailed analysis below).\n\n### Recommendations for Pricing Page\n- Show annual discount prominently (mentioned in 6 sources)\n- Add startup tier or usage-based option\n- Include competitor comparison table (users are already comparing)",
  tags: ["research", "pricing", "compiled"]
})

# Mark complete
complete_task({
  task_id: "task_research_001",
  result: "Research complete. 22 sources, confidence 0.81. Compiled to wiki at topics/pricing-research. Key finding: need startup tier and annual discount visibility."
})
```

### Phase 3: Implementer Reads Research, Writes Spec, Builds

A second agent picks up the spec task now that research is done:

```
# Check the board
list_tasks({ project_id: "proj_123" })
# Research: complete. Spec: unclaimed. Implementation: blocked.

# Claim the spec task
claim_task({ task_id: "task_spec_002" })

# Read the research
wiki_read({ project_id: "proj_123", path: "topics/pricing-research" })

# Generate spec based on research findings
generate_specs({
  project_id: "proj_123",
  spec_type: "user_stories"
})

# Write spec to wiki
wiki_write({
  project_id: "proj_123",
  path: "specs/pricing-page",
  title: "Pricing Page Spec",
  content: "## Pricing Page Spec\n\nBased on: topics/pricing-research (confidence: 0.81)\n\n### User Stories\n1. As a startup founder, I want to see a usage-based tier so that I can start small\n2. As an enterprise buyer, I want a comparison table so that I can justify the purchase\n3. As any visitor, I want to see annual discount prominently so that I know the real cost\n\n### Acceptance Criteria\n- [ ] Three tiers displayed: Startup, Team, Enterprise\n- [ ] Annual discount shown with savings amount\n- [ ] Competitor comparison section\n- [ ] Mobile responsive",
  tags: ["spec", "pricing"]
})

# Complete the spec task
complete_task({
  task_id: "task_spec_002",
  result: "Spec complete at wiki specs/pricing-page. 3 user stories, 4 acceptance criteria. Ready for implementation."
})

# Claim the implementation task (now unblocked)
claim_task({ task_id: "task_impl_003" })

# Read the spec
wiki_read({ project_id: "proj_123", path: "specs/pricing-page" })

# Implement... (code changes happen here)

# Log progress
complete_task({
  task_id: "task_impl_003",
  progress: true,
  result: "Pricing component scaffolded. Three tiers rendering. Working on comparison table."
})

# Final completion
complete_task({
  task_id: "task_impl_003",
  result: "Pricing page implemented. All 4 acceptance criteria met. PR created."
})
```

### What Made This Work

1. **The orchestrator created well-described tasks** with clear deliverables and dependency signals.
2. **The researcher checked existing knowledge first** before running new research.
3. **The researcher wrote findings to the wiki** so the implementer had full context.
4. **The implementer read the wiki before writing code** and built exactly what the research supported.
5. **Everyone logged progress** so the team had visibility into status at all times.
6. **The task board prevented conflicts** -- every piece of work was claimed before it was started.

---

## Scaling Guidelines

### 2-3 Agents (Small Team)

- One orchestrator who also implements
- One researcher
- Coordination through task board and wiki is sufficient
- Check in every 10-15 minutes via progress logs

### 4-6 Agents (Medium Team)

- Dedicated orchestrator who monitors but does not execute
- 2 researchers covering different domains
- 2-3 implementers claiming from the task board
- Wiki status page updated by orchestrator after each task completes
- Use `execute_task` for async dispatch to reduce coordination overhead

### 7+ Agents (Large Team)

- Orchestrator creates sub-orchestrators for each workstream
- Researchers specialize (one per domain: pricing, UX, competitors)
- Implementers specialize (frontend, backend, infrastructure)
- Wiki becomes the primary coordination surface -- the task board alone is not enough
- Mandatory progress logging every 10 minutes
- Reviewer role becomes essential for quality control at this scale
