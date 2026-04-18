---
name: crowdlisten:task-planning
version: 1.0.0
description: >
  Teaches agents to decompose complex goals into executable subtasks with
  dependency ordering. Encodes judgment about task granularity, parallelization
  opportunities, and result threading between steps.
user-invocable: true
allowed-tools:
  - decompose_goal
  - create_task
  - list_tasks
  - complete_task
  - run_analysis
  - search_content
  - save
  - recall
requires_api_key: false
metadata:
  openclaw:
    category: planning
    tags:
      - decomposition
      - orchestration
      - workflow
      - planning
      - subtasks
---

# Task Planning

Decompose complex goals into ordered, executable subtasks. This skill encodes **judgment** about when to decompose, how granular to make tasks, and how to thread results between steps.

---

## Decision Tree: When to Decompose

Not every request needs decomposition. Use this tree:

```
User goal arrives
  │
  ├─ Single tool can answer it?
  │   └─ NO decomposition. Just run the tool.
  │       Examples: "search Reddit for X", "save this to KB"
  │
  ├─ Multiple platforms or data sources?
  │   └─ YES decompose. Parallel searches → synthesis step.
  │       Example: "What do people think about X across Reddit and Twitter?"
  │
  ├─ Research + synthesis needed?
  │   └─ YES decompose. Gather → analyze → synthesize.
  │       Example: "Analyze competitor pricing strategies"
  │
  ├─ Multi-step workflow with dependencies?
  │   └─ YES decompose. Each step feeds the next.
  │       Example: "Research market, write spec, create tasks"
  │
  └─ Simple question or chat?
      └─ NO decomposition. Just answer directly.
```

**Rule of thumb**: If you need 2+ tools AND the output of one informs another, decompose.

---

## Decomposition Principles

### 1. Granularity: 10-60 Minute Tasks

Each subtask should be:
- **Concrete**: Has a clear deliverable (a search result set, a synthesis doc, a spec)
- **Testable**: You can verify it completed successfully
- **Scoped**: One agent can finish it in 10-60 minutes

Bad: "Research everything about the market" (too vague)
Good: "Search Reddit for pricing sentiment in SaaS tools" (concrete, testable)

### 2. Maximum 7 Subtasks

If you need more than 7, you're micro-tasking. Combine related steps.

- 2-3 subtasks: Simple research + synthesis
- 4-5 subtasks: Multi-platform research + analysis + deliverable
- 6-7 subtasks: Complex workflow with multiple outputs

### 3. Every Task Has a Type

| Type | What it does | Tool |
|------|-------------|------|
| `research` | Search and gather data from platforms | `search_content`, `crowd_research` |
| `analysis` | Run structured audience analysis | `run_analysis` |
| `synthesis` | Combine previous results into insight | Agent reasoning + `save` |
| `action` | Create deliverable (spec, task, KB entry) | `create_task`, `generate_specs`, `save` |

---

## Dependency Patterns

### Pattern 1: Parallel Research → Sequential Synthesis

```
[Search Reddit] ──┐
[Search Twitter] ──┼──→ [Synthesize findings] → [Save to KB]
[Search TikTok] ──┘
```

Tasks 1-3 have no dependencies (run in parallel).
Task 4 depends on tasks 1-3. Task 5 depends on task 4.

### Pattern 2: Research → Analysis → Action

```
[Search platforms] → [Run analysis] → [Generate spec] → [Create tasks]
```

Linear chain. Each step depends on the previous.

### Pattern 3: Analysis → Parallel Actions

```
                    ┌→ [Create product tasks]
[Run analysis] ────┼→ [Write summary for KB]
                    └→ [Generate spec]
```

Analysis first, then fan out to independent actions.

### Anti-pattern: Everything Sequential

```
BAD: [Search Reddit] → [Search Twitter] → [Search TikTok] → [Synthesize]
```

If tasks don't depend on each other, mark them as parallel (empty `depends_on`).

---

## Result Threading

When a subtask completes, its `result_summary` is injected into dependent subtasks' context. This is how knowledge flows through the plan.

### What to Include in Results

- **Key findings** (3-5 bullet points)
- **Quantitative signals** (mention counts, sentiment scores)
- **Notable quotes** or examples
- **Gaps identified** (what's missing)

### What NOT to Include

- Raw data dumps (too long, loses signal)
- Duplicate information across subtasks
- Speculative conclusions not supported by data

### Threading Template

When executing a subtask that depends on others, prefix the prompt with:

```
Context from previous steps:

Step 1 "{title}": {result_summary}
Step 2 "{title}": {result_summary}

Now execute: {current_task_description}
```

---

## Knowledge Base Integration

### Read Before You Start

Before decomposing, always `recall` relevant context:
- Existing research on the topic
- Previous analysis results
- Entity tracking data

This prevents duplicate work and builds on existing knowledge.

### Save As You Go

Each subtask should `save` its key findings:
- Tag with the decomposition goal for retrieval
- Use structured format (findings, evidence, gaps)
- Include source attribution

### Save the Synthesis

The final synthesis subtask should save a comprehensive summary that ties everything together. This becomes reusable context for future work.

---

## Worked Example

**Goal**: "Analyze competitor pricing strategies for project management tools"

### Decomposition Output

```json
{
  "subtasks": [
    {
      "order": 1,
      "title": "Search Reddit for PM tool pricing discussions",
      "description": "Use search_content to find Reddit threads about project management tool pricing, complaints about price changes, and comparisons between tools. Focus on r/projectmanagement, r/SaaS, r/startups.",
      "type": "research",
      "depends_on": []
    },
    {
      "order": 2,
      "title": "Search Twitter for PM tool pricing sentiment",
      "description": "Use search_content to find Twitter conversations about pricing for Asana, Monday, Jira, Linear, Notion. Look for reactions to recent price changes and switching behavior.",
      "type": "research",
      "depends_on": []
    },
    {
      "order": 3,
      "title": "Run audience analysis on pricing sentiment",
      "description": "Use run_analysis to perform structured analysis of PM tool pricing perceptions. Include opinion clustering and sentiment breakdown by tool.",
      "type": "analysis",
      "depends_on": [1, 2]
    },
    {
      "order": 4,
      "title": "Synthesize pricing strategy findings",
      "description": "Combine search results and analysis into a pricing strategy brief: key themes, per-tool sentiment, pricing model preferences, switching triggers, and recommendations.",
      "type": "synthesis",
      "depends_on": [3]
    },
    {
      "order": 5,
      "title": "Save findings to knowledge base",
      "description": "Save the pricing strategy synthesis to the knowledge base tagged with 'competitor-pricing' and 'project-management'. Include key data points for future reference.",
      "type": "action",
      "depends_on": [4]
    }
  ]
}
```

### Why This Works

- Steps 1-2 are parallel (independent platform searches)
- Step 3 waits for both searches (needs the data)
- Step 4 waits for analysis (needs structured results)
- Step 5 is a clean save action (no ambiguity)
- Each step is 10-30 minutes of work
- Total: 5 subtasks, clear dependencies, concrete deliverables

---

## Anti-Patterns

### 1. Micro-Tasking

> "Search Reddit. Then filter for relevant posts. Then extract quotes. Then categorize quotes. Then score sentiment. Then summarize."

This is one task: "Search Reddit for pricing discussions." The agent handles the details.

### 2. Missing Context in Descriptions

> "Analyze the data."

Analyze WHAT data? From where? For what purpose? Every description must be self-contained.

### 3. Not Reading KB First

If the KB already has research on this topic, you'll duplicate work. Always `recall` first.

### 4. Silent Execution

Every subtask should produce a visible result_summary. If it "completed" with no output, something went wrong.

### 5. Over-Decomposing Simple Requests

> "What does Reddit think about TypeScript?"

This is ONE search_content call. Don't decompose it into 4 subtasks.
