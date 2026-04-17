---
name: crowdlisten:autopilot-research
description: >
  Automated research compilation — track topics across platforms,
  store raw data, and maintain always-current KB documents with
  periodic crawl jobs.
user-invocable: true
allowed-tools:
  - save
  - recall
  - search_content
  - run_analysis
  - manage_entities
metadata:
  openclaw:
    category: knowledge-management
    tags:
      - autopilot
      - research
      - compilation
      - tracking
      - periodic
    requires_api_key: false
---

# Autopilot Research

Track any topic across social platforms. Raw data is captured and stored.
KB documents are compiled and kept current via periodic crawl jobs.

**This skill automates the full research lifecycle**: initial deep dive, evidence storage, and ongoing monitoring with automatic KB updates.

---

## When to Use This Skill

Use autopilot-research when:
- The user wants ongoing monitoring of a topic, brand, or competitor
- Research needs to stay current over weeks/months (not a one-shot question)
- Raw evidence matters — the user wants to see source data, not just summaries
- The topic spans multiple platforms and needs cross-platform synthesis

Do NOT use when:
- A quick one-time analysis suffices (use `run_analysis` instead)
- The user only needs to search for specific posts (use `search_content`)
- The knowledge base already has fresh compiled truth (use `recall` first)

---

## Workflow

### Step 1: Check Existing Knowledge

Always check first:
```
recall({ query: "[topic keywords]" })
```

If recent compiled truth exists (< 7 days), present it and ask if refresh is needed.

### Step 2: Run Initial Research

Use the decomposition pipeline for comprehensive multi-platform research:
```
run_analysis({
  question: "[research question]",
  platforms: ["reddit", "twitter", "news"]
})
```

The system will:
1. Break the goal into platform-specific subtasks
2. Run independent platform searches in parallel
3. Store all raw search results in the evidence database
4. Compile findings into a single KB document with platform-annotated sections

### Step 3: Set Up Periodic Tracking

After initial research, create a monitored entity for automatic updates:
```
manage_entities({
  action: "create",
  name: "Topic Name",
  type: "topic",
  keywords: ["search terms"],
  config: {
    research_enabled: true,
    research_interval_hours: 168,
    search_query: "the research question",
    kb_path: "research/topic-slug",
    max_sources_per_refresh: 30,
    lookback_days: 7
  }
})
```

The scheduler will automatically:
- Crawl configured platforms at the specified interval (default: weekly)
- Store new raw results with deduplication
- Merge new findings into the existing KB document
- Update the document's Data Quality section

### Step 4: Review Updates

Check the KB document for updates:
```
recall({ query: "topic keywords", path: "research/topic-slug" })
```

Check raw evidence:
```
search_content({ query: "topic keywords", search_mode: "knowledge" })
```

---

## Tracking Configuration

### Interval Options

| Interval | Hours | Use Case |
|----------|-------|----------|
| Daily | 24 | Fast-moving topics, crisis monitoring |
| Every 3 days | 72 | Active product launches, trending topics |
| Weekly | 168 | Standard monitoring (default) |
| Biweekly | 336 | Stable topics, competitor tracking |

### Adjusting Tracking

Update an entity's config to change crawl behavior:
```
manage_entities({
  action: "update",
  entity_id: "[id]",
  config: {
    research_interval_hours: 72,
    max_sources_per_refresh: 50
  }
})
```

Pause tracking:
```
manage_entities({
  action: "update",
  entity_id: "[id]",
  config: { research_enabled: false }
})
```

---

## KB Document Structure

The compiled KB document follows this structure:

```markdown
# Research: [Topic]
*Last updated: [timestamp]*

## Reddit Findings
[Evidence with source URLs, engagement scores, dates]

## Twitter/X Findings
[Evidence with source URLs, engagement scores, dates]

## News/Web Findings
[Evidence with source URLs, dates]

## Cross-Platform Synthesis
[Integrated analysis across all platforms]

## Data Quality
- Total sources: N
- Platforms covered: [list]
- Date range: [oldest] to [newest]
- Last crawl: [timestamp]
```

Each update merges new evidence into existing sections, removes outdated info,
and preserves the overall document quality.

---

## Anti-Patterns

1. **Setting up tracking without initial research.** Always do a deep dive first.
2. **Tracking too many topics.** Each tracked entity runs periodic searches — be selective.
3. **Ignoring the Data Quality section.** If source counts are low or dates are stale, the topic may need manual attention.
4. **Using daily intervals for stable topics.** Weekly is sufficient for most use cases.

---

## Example: Complete Autopilot Setup

User: "Monitor what people think about Cursor AI"

### 1. Initial Research
```
run_analysis({
  question: "What do developers think about Cursor AI? Focus on productivity, pricing, and comparison with alternatives.",
  platforms: ["reddit", "twitter", "github", "news"]
})
```

### 2. Review Results
The system creates a KB document at `research/cursor-ai-developer-sentiment` with platform-annotated sections.

### 3. Auto-Tracking Enabled
The system automatically creates a tracked entity. Weekly crawls will update the KB document with fresh evidence.

### 4. Check Updates (next week)
```
recall({ query: "cursor ai developer sentiment" })
```

The document now includes both the original research and new findings from the weekly crawl, with updated source counts and timestamps.
