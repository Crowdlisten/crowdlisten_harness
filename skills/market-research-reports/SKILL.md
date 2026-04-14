---
name: crowdlisten:market-research
description: Generate comprehensive market research reports with Porter's Five Forces, PESTLE, SWOT, TAM/SAM/SOM, BCG Matrix. Use for market analysis, competitive landscape, industry trends.
user-invocable: true
allowed-tools: Bash, Read, Write, WebFetch, Grep
metadata:
  openclaw:
    category: research
    tags: [market-research, porters-five-forces, swot, tam-sam-som]
    requires_api_key: false
---

# Market Research Reports

Generate comprehensive, analyst-grade market research reports using established strategic frameworks and methodologies.

## Before You Start

Ask your human for business context — this skill produces significantly better output when grounded in specifics:

- **Target market**: Who are the customers? What industry/segment?
- **Key competitors**: Which brands or products to compare against?
- **Constraints**: Budget, timeline, geographic focus?
- **Decision context**: What decisions will this analysis inform? (roadmap, funding, positioning, hiring?)
- **Existing data**: Any prior research, internal metrics, or hypotheses to validate?

## Capabilities

This skill enables generation of:
- **Comprehensive Market Analysis**: 50+ page detailed reports
- **Strategic Framework Application**: Porter's Five Forces, PESTLE, SWOT, BCG Matrix
- **Market Sizing**: TAM/SAM/SOM calculations with methodology
- **Competitive Intelligence**: Competitor profiling and positioning analysis
- **Trend Analysis**: Industry trends, growth drivers, and future outlook

## Core Frameworks

### Porter's Five Forces
Analyze competitive intensity and attractiveness of a market:
1. **Threat of New Entrants**: Barriers to entry, capital requirements
2. **Bargaining Power of Suppliers**: Supplier concentration, switching costs
3. **Bargaining Power of Buyers**: Buyer concentration, price sensitivity
4. **Threat of Substitutes**: Alternative products, switching costs
5. **Competitive Rivalry**: Number of competitors, industry growth rate

### PESTLE Analysis
Macro-environmental factors affecting the market:
- **Political**: Government policies, trade regulations, political stability
- **Economic**: GDP growth, inflation, exchange rates, unemployment
- **Social**: Demographics, cultural trends, consumer behavior
- **Technological**: Innovation, R&D, automation, digital transformation
- **Legal**: Regulatory frameworks, compliance requirements, IP laws
- **Environmental**: Sustainability, climate impact, environmental regulations

### SWOT Analysis
Internal and external factor assessment:
- **Strengths**: Internal capabilities and competitive advantages
- **Weaknesses**: Internal limitations and areas for improvement
- **Opportunities**: External favorable conditions and growth potential
- **Threats**: External challenges and competitive risks

### TAM/SAM/SOM Market Sizing
- **Total Addressable Market (TAM)**: Total market demand
- **Serviceable Addressable Market (SAM)**: Portion you can target
- **Serviceable Obtainable Market (SOM)**: Realistic market capture

### BCG Growth-Share Matrix
Portfolio analysis for multi-product/segment evaluation:
- **Stars**: High growth, high market share
- **Cash Cows**: Low growth, high market share
- **Question Marks**: High growth, low market share
- **Dogs**: Low growth, low market share

## Report Structure

### Standard Market Research Report

```markdown
# [Industry/Market] Research Report

## Executive Summary
- Key findings
- Market size and growth
- Critical success factors
- Strategic recommendations

## Market Overview
- Market definition and scope
- Historical development
- Current state of the market

## Market Size & Forecast
- TAM/SAM/SOM analysis
- Growth projections (5-year)
- Regional breakdown

## Industry Analysis
### Porter's Five Forces
[Detailed analysis of each force]

### PESTLE Analysis
[Macro-environmental factors]

## Competitive Landscape
- Major players and market share
- Competitive positioning map
- Competitor profiles

## Customer Analysis
- Customer segments
- Buying behavior
- Unmet needs

## Trends & Drivers
- Key market trends
- Growth drivers
- Inhibitors and challenges

## SWOT Analysis
[Internal/external factors]

## Strategic Recommendations
- Market entry strategies
- Competitive positioning
- Investment priorities

## Appendix
- Data sources
- Methodology
- Definitions
```

## Usage

### Generate Market Research Report

```python
# Example: Request a market research report
await generate_market_report(
    industry="Electric Vehicle Charging Infrastructure",
    geography="North America",
    depth="comprehensive",  # comprehensive | executive | segment
    frameworks=["porters", "pestle", "swot", "tam_sam_som"]
)
```

### Analyze Competitive Landscape

```python
# Example: Competitive analysis
await analyze_competitors(
    market="SaaS Project Management Tools",
    competitors=["Asana", "Monday.com", "Notion", "ClickUp"],
    dimensions=["pricing", "features", "market_position", "growth"]
)
```

### Market Sizing

```python
# Example: Calculate TAM/SAM/SOM
await calculate_market_size(
    product="AI-powered Customer Service Platform",
    target_segment="Mid-market B2B SaaS",
    geography="Global",
    methodology="bottom_up"  # bottom_up | top_down | value_based
)
```

## Output Quality Standards

1. **Data-Driven**: All claims supported by data sources
2. **Cited Sources**: Academic, industry reports, and primary research
3. **Actionable Insights**: Strategic recommendations with clear rationale
4. **Visual Support**: Charts, graphs, and matrices where applicable
5. **Professional Format**: Executive-ready presentation quality

## Decision Framework: When to Use This Skill

```
User wants market intelligence
  │
  ├─ "What's the market for [product]?"
  │   └─ TAM/SAM/SOM analysis → this skill
  │
  ├─ "Who are our competitors?"
  │   └─ Competitive landscape → this skill for structure, competitive-analysis for crowd data
  │
  ├─ "What do users think about [product]?"
  │   └─ NOT this skill → use crowd-research or user-stories
  │
  ├─ "Should we enter [market]?"
  │   └─ Full market research report → this skill (Porter's + PESTLE + SWOT)
  │
  └─ "How is [industry] changing?"
      └─ Trend analysis → this skill + crowd-research for real-time signals
```

### When to Use vs Other Skills

| Question Type | This Skill | Use Instead |
|---------------|-----------|-------------|
| Market structure and size | Yes | — |
| Competitive positioning | Yes (framework) | competitive-analysis (crowd data) |
| User sentiment | No | crowd-research, user-stories |
| Feature demand | No | user-stories |
| Entity tracking | No | entity-research |
| Product specs | No | spec-generation |

### The Golden Rule: Crowd Data + Frameworks

**Market research without crowd data is speculation. Crowd data without frameworks is noise.**

This skill combines strategic frameworks (Porter's, PESTLE, SWOT) with CrowdListen's crowd intelligence to produce research that is both structurally sound AND grounded in real audience evidence.

Always check compiled truth before generating a report:
```
recall({ query: "market analysis {industry}", project_id: "{project_id}" })
list_topics({ project_id: "{project_id}" })
```

---

## Evidence Grounding

### Crowd Data Integration Points

Each framework section should incorporate crowd evidence where available:

| Framework Section | Crowd Data Source | Integration |
|-------------------|-------------------|-------------|
| Porter's — Buyer Power | User complaints about pricing | Quantify price sensitivity from crowd discussions |
| Porter's — Rivalry | Competitor mentions and sentiment | Measure competitive intensity from share of voice |
| PESTLE — Social | Audience discussions and trends | Ground social factors in real conversations |
| PESTLE — Technological | Developer community feedback | Track technology adoption signals |
| SWOT — Strengths | Positive user testimonials | Evidence strength claims with crowd validation |
| SWOT — Threats | Competitor praise, churn signals | Ground threats in real user switching behavior |
| TAM/SAM/SOM | Community sizes, engagement rates | Validate market sizing with observable audience data |

### Confidence Levels for Market Claims

| Claim Type | Evidence Required | Confidence |
|------------|------------------|------------|
| Market size (TAM) | Published industry reports + crowd validation | 0.6-0.8 |
| Growth rate | 2+ independent analyst projections | 0.5-0.7 |
| Competitive position | Crowd share-of-voice + feature comparison | 0.6-0.8 |
| Trend identification | 10+ crowd sources + industry coverage | 0.7-0.9 |
| User behavior claim | Direct crowd evidence from 5+ sources | 0.6-0.8 |
| Forecast/prediction | Analyst + trend data (inherently uncertain) | 0.3-0.5 |

**Never present forecasts as facts.** Always qualify: "Based on current trends and analyst consensus, the market may grow to $X by 2028. Confidence: 0.4."

---

## Integration Hooks

### With CrowdListen Tools

- **`search_content`**: Find industry discussions, competitor mentions, trend signals
- **`run_analysis`**: Quick multi-platform scan for specific market questions
- **`crowd_research`**: Comprehensive research for deep market intelligence
- **`analyze_content`**: Extract themes from industry discussions
- **`cluster_opinions`**: Group market opinions into actionable segments

### With Compiled Truth

- **Before report**: Check `recall()` and `list_topics()` for existing market intelligence
- **During report**: Reference compiled topics as evidence (e.g., "See compiled topic: Pricing Perception, confidence 0.78")
- **After report**: Save key findings with `save()` and trigger `compile_knowledge()`

### Wiki Persistence

Save report sections as reusable wiki pages:
```
wiki_write({
  path: "topics/market-analysis-{industry-slug}",
  title: "Market Analysis: {Industry}",
  content: "{report executive summary + key findings}",
  tags: ["market-research", "compiled", "{industry}"]
})
```

### With Other Skills

| Downstream Skill | What It Receives |
|------------------|------------------|
| competitive-analysis | Market structure context, competitive landscape |
| user-stories | Market sizing validates demand, personas get market context |
| spec-generation | Market requirements inform feature specs |
| entity-research | Competitor profiles feed entity tracking |

---

## Anti-Patterns

### 1. Framework Without Evidence
**Wrong**: Filling in Porter's Five Forces from general knowledge without crowd data or citations.
**Right**: Every force assessment cites specific evidence — industry reports, crowd discussions, or observable market data.

### 2. Stale Market Data
**Wrong**: Using 2-year-old market sizing without noting staleness.
**Right**: Always date your sources. Flag data >12 months old. Crowd signals can validate or invalidate old projections.

### 3. Ignoring Crowd Signals That Contradict Analyst Reports
**Wrong**: "Gartner says the market is growing 20% YoY" while crowd discussions show widespread churn.
**Right**: Surface the contradiction. Analyst projections may lag real sentiment shifts. Note both.

### 4. TAM Fantasy
**Wrong**: "$500B TAM" without a credible path from SAM to SOM.
**Right**: Bottom-up TAM from observable audience sizes. SAM from addressable segments. SOM from realistic capture rates with evidence.

### 5. Copy-Paste Frameworks
**Wrong**: Filling in PESTLE with generic text that applies to any industry.
**Right**: Each factor must be specific to THIS market, THIS geography, THIS time period, with evidence.

### 6. Report Without Actionable Recommendations
**Wrong**: 50 pages of analysis ending with "the market is competitive."
**Right**: Every report ends with 3-5 specific, actionable recommendations ranked by evidence strength.

---

## Risk Management

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data recency | Stale market data misleads strategy | Date all sources; flag anything >12 months old |
| Geographic bias | US-centric data applied globally | Note geographic scope explicitly; flag gaps |
| Survivorship bias | Only analyzing successful players | Include failed entrants and pivoted companies |
| Confirmation bias | Finding data that supports existing thesis | Run contradiction check; search for disconfirming evidence |
| Over-precision | False precision in market sizing ($127.3B TAM) | Use ranges, not point estimates; note methodology limitations |

---

## Output Success Criteria

Every market research report must include:

1. **Executive summary** with key findings and confidence levels
2. **Methodology** section noting data sources, time period, and limitations
3. **Evidence chain** linking framework conclusions to specific sources
4. **Crowd validation** where CrowdListen data confirms or contradicts traditional research
5. **Contradictions surfaced** between analyst reports and crowd signals
6. **Actionable recommendations** ranked by evidence strength
7. **Knowledge gaps** explicitly stated (what we couldn't find or verify)
