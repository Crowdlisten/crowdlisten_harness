# Harness Engineering - Deep Analysis

**Repository**: https://github.com/alchemiststudiosDOTai/harness-engineering
**License**: MIT | **Language**: Shell/Markdown | **Stars**: ~62 | **Status**: Active development

---

## 1. What This Project Is

Harness Engineering is a **framework for making AI-agent-driven code changes safe, reviewable, and incremental**. It packages as a Claude Code plugin (`--plugin-dir`) and provides slash commands, skills, agent definitions, and prompt hooks.

The core philosophy: **"What Codex can't see doesn't exist."** Instead of storing critical knowledge in Slack, docs, or engineers' heads, everything -- architecture decisions, quality standards, coding patterns -- gets mechanically encoded into the repository itself.

---

## 2. Architecture Overview

```
harness-engineering/
├── .claude-plugin/           # Claude Code plugin manifest
├── agents/                   # Task-specific agent definitions (subagents)
│   ├── analysis/            # codebase-analyzer, codebase-locator, code-synthesis
│   ├── development/         # TDD Python, bug-issue-creator, refactorer
│   ├── documentation/       # git-diff-docs, prompt-engineer, tech-docs
│   ├── research/            # multi-agent-synthesis-orchestrator, web-docs
│   ├── performance/         # memory-profiler
│   └── security/            # security-orchestrator
├── commands/                 # Slash commands for Claude Code
│   ├── context engineering/ # deep-research, execute, plan, three-step-workflow
│   ├── integration/         # coderabbitai, linear integrations
│   ├── quality-assurance/   # fagan-inspection
│   └── utilities/           # context-compact, phase-planner, smart-git
├── skills/                   # Reusable capability definitions (RPEQ phases)
│   ├── research-phase/      # + helper scripts (ast-scan, structure-map, etc.)
│   ├── plan-phase/
│   ├── execute-phase/
│   ├── qa-from-execute/
│   ├── harness-map/         # Maps repo's safety layers
│   ├── agents-md-mapper/    # Maintains AGENTS.md as navigation map
│   ├── ast-grep-setup/      # AST-based structural rules
│   └── differential-session-runner/  # A/B comparison evidence trails
├── docs/
│   ├── harness-engineering.md  # Full HES v1 spec
│   └── workflows/RPEQ.md      # The 4-phase workflow
├── prompt-hooks/             # Pre/post tool-use automation triggers
├── alias/                    # Model configuration (minimax, zai)
├── rules/                    # AST-grep structural/style rules
└── skills/.artifacts/        # Artifact storage (research/, plan/, execute/)
```

---

## 3. The RPEQ Workflow (Core Innovation)

The central pattern is a **strict 4-phase workflow** with artifact-driven handoffs:

### Phase 1: Research
- **Command**: `/deep-research`
- **Skill**: `research-phase`
- **Output**: `.artifacts/research/YYYY-MM-DD_HH-MM-SS_<topic>.md`
- **Rule**: "Map, don't suggest." Facts only. No recommendations.
- **Mechanism**: Deploys parallel sub-agents (codebase-locator, codebase-analyzer, pattern-finder), then synthesizes. Uses helper scripts for ast-scan, structure-map, symbol-index, dependency-graph.
- **Key constraint**: Document what exists with exact paths and line numbers.

### Phase 2: Plan
- **Command**: `/implementation-from-deep-research`
- **Skill**: `plan-phase`
- **Output**: `.artifacts/plan/YYYY-MM-DD_HH-MM-SS_<topic>.md`
- **Rule**: "If a junior developer picked this up, could they start coding immediately?"
- **Structure**: Single goal, 4 milestones (skeleton -> core logic -> feature completion -> testing), numbered tasks with file paths, acceptance criteria, dependencies.
- **Key constraint**: No code changes during planning.

### Phase 3: Execute
- **Command**: `/execute-from-deep-research`
- **Skill**: `execute-phase`
- **Output**: `.artifacts/execute/YYYY-MM-DD_HH-MM-SS_<topic>.md` (living log)
- **Rule**: "Follow the plan exactly. Do not improvise."
- **Mechanism**: Git rollback point first, then atomic commits per task (`T<NNN>: <summary>`), mandatory quality gates (pytest, mypy, black, coverage, security scan).
- **Key constraint**: Stop on failure and ask for guidance. Never proceed past a failed gate.

### Phase 4: QA
- **Command**: triggered after execution
- **Skill**: `qa-from-execute`
- **Output**: `memory-bank/qa/` report
- **Rule**: Read-only analysis. No code modifications.
- **Mechanism**: 10-dimension checklist (inputs, control flow, data flow, state, errors, contracts, time/locale, resources, edge cases, public surface). Severity levels: CRITICAL/WARNING/INFO/PASS.
- **Key constraint**: Never claim fixes without proof.

### What Makes RPEQ Novel
1. **Strict phase separation** -- research cannot recommend, planning cannot code, execution cannot improvise, QA cannot fix
2. **Artifact-driven handoffs** -- each phase produces a timestamped markdown file that the next phase reads
3. **Parent references** -- downstream documents link to their predecessors for traceability
4. **Parallel sub-agents** -- research deploys multiple specialized agents concurrently

---

## 4. The Six Verification Gates (Harness)

The "harness" is a set of mechanical checks enforced by `just check`:

| Gate | Purpose | Tool |
|------|---------|------|
| **A: Format + Lint** | Deterministic style | ruff |
| **B: Import Boundaries** | Architecture constraints | Import Linter / grimp |
| **C: Structural Ratchets** | AST-based anti-pattern prevention | ast-grep |
| **D: Snapshot Testing** | Behavioral stability locks | syrupy |
| **E: Golden Outputs** | End-to-end deterministic artifacts | custom golden.py |
| **F: Numerical Equivalence** | Float tolerance for math/ML refactoring | custom checks |

**Key concept -- Ratchets**: For brownfield repos, a ratchet gate:
- Allows existing violations via baseline list
- Blocks new violations
- Forces baseline to shrink (CI fails if baseline contains entries that no longer violate)

This turns legacy mess into measurable burndown without blocking all change.

---

## 5. Work Chunks (Merge Unit)

Every change merges as a "work chunk" -- a small, independently verifiable unit:

1. Changes exactly one thing
2. Adds/adjusts harness enforcement to keep the change true
3. Produces evidence (tests, snapshots, golden diffs)
4. Passes all gates

Each chunk is documented in `docs/chunks/NNN-<slug>.md` with:
- Intent
- Preconditions
- Exact commands
- Evidence produced
- Rollback procedure

---

## 6. Council (Multi-Agent Review)

A 3-agent acceptance gate where independent AI models vote on changes:

- Council reads: diff, chunk doc, harness results, golden diffs
- Outputs JSON: `{"vote": "accept|reject", "reasons": [...], "required_fixes": [...]}`
- Merge requires: all gates green + 2/3 agent acceptance (Codex + Gemini + Claude)
- Implementation: `tools/harness/council.py` collects artifacts and calls model-specific reviewer scripts

---

## 7. Knowledge Management Patterns

### AGENTS.md as Navigation Map
- Kept under 100 lines
- Evidence-based (verified paths, actual commands from configs)
- Updated by the `agents-md-mapper` skill whenever repos change
- Contains: project overview, structure map, build/test/lint commands, architecture boundaries, links to authoritative docs
- Excludes: lengthy essays, exhaustive dependency lists, historical detail

### Artifact Storage Convention
```
.artifacts/
├── research/    # Timestamped research memos
├── plan/        # Timestamped implementation plans
└── execute/     # Execution logs with per-task status
```

Alternative: `memory-bank/` directory for projects that prefer that convention.

### Differential Session Runner
For A/B comparisons (original vs rewritten, baseline vs candidate):
- Creates reusable evidence packets
- Tracks mismatch progression (append, never overwrite)
- Uses hashes for artifact identity
- Keeps findings separate from fixes
- Ends with clear next-step or explicit "done"

---

## 8. Agent Architecture Patterns

### Sub-Agent Definitions
Markdown files with YAML frontmatter in `.claude/agents/`:

```markdown
---
name: your-sub-agent-name
description: When this should be invoked
tools: tool1, tool2, tool3
---
System prompt with role, capabilities, and instructions.
```

### Multi-Agent Synthesis Orchestrator
5-phase pattern for complex analysis:
1. **Query Analysis** -- identify required perspectives
2. **Multi-Agent Gathering** -- deploy 3-5 specialized agents (technical, performance, security, architecture, DX)
3. **Synthesis** -- consolidate with consensus/disagreement identification
4. **QA Verification** -- dedicated QA agent cross-references claims
5. **Report Generation** -- comprehensive output with confidence levels

### Prompt Hooks
Automation triggers for pre/post tool-use:
- `post-write-context.py` -- context management after writes
- `prompt-validator.py` -- validates prompts before execution
- `validate-bash.py` -- validates bash commands before execution
- `session-env.sh` -- sets up session environment

---

## 9. Key Concepts Worth Adopting

### A. Phase Separation with Artifact Handoffs
**Why it matters**: Prevents the common failure mode where AI agents jump straight to implementation without understanding the codebase. Each phase has a clear deliverable that gates the next.

**For an MCP-based system**: Each phase could be an MCP tool/resource. The research phase produces a resource that the plan phase consumes. The plan phase produces a resource that the execute phase consumes. Phase transitions are explicit API calls, not implicit.

### B. "Map, Don't Suggest" Research
**Why it matters**: AI agents' research tends to be polluted by premature recommendations. Separating observation from prescription produces better understanding.

**For an MCP-based system**: A research MCP tool that enforces output schema (facts, paths, line numbers) and rejects recommendation language.

### C. Ratchets for Brownfield Codebases
**Why it matters**: Most real projects have existing violations. Binary pass/fail blocking is impractical. Ratchets allow progress while preventing regression.

**For an MCP-based system**: A quality-gate MCP tool that maintains baselines and fails only on new violations or stale baselines.

### D. Work Chunks as Atomic Units
**Why it matters**: AI agents tend to make large, hard-to-review changes. Forcing small, independently verifiable units makes agent work reviewable by humans.

**For an MCP-based system**: A planning MCP tool that decomposes work into chunks, each with a defined evidence requirement.

### E. Council (Multi-Model Voting)
**Why it matters**: No single AI model catches everything. Cross-model review adds a layer of safety without human bottleneck.

**For an MCP-based system**: A review MCP tool that sends diffs + context to multiple models and aggregates votes.

### F. Evidence-Based Everything
**Why it matters**: AI agents claiming "I fixed it" without proof is a recurring problem. Requiring tests, snapshots, or golden diffs as evidence prevents silent regressions.

**For an MCP-based system**: Execution tools that require evidence artifacts (test results, diffs) before marking tasks complete.

### G. AGENTS.md as Compressed Knowledge Map
**Why it matters**: Long documentation rots. A short, verified navigation map that links to authoritative sources stays current.

**For an MCP-based system**: An MCP resource that serves the current AGENTS.md and validates it against actual repo state.

---

## 10. Comparison with SuperClaude / Our Approach

| Aspect | Harness Engineering | SuperClaude/Our Approach |
|--------|-------------------|--------------------------|
| **Phase separation** | RPEQ with strict boundaries | Modes (Brainstorm, Research, etc.) but softer boundaries |
| **Artifact storage** | `.artifacts/` with timestamps | `claudedocs/` or in-memory |
| **Knowledge map** | AGENTS.md (< 100 lines, verified) | CLAUDE.md (larger, configuration-focused) |
| **Quality gates** | 6 mechanical gates (`just check`) | Validation rules but less automated |
| **Agent architecture** | Markdown-defined sub-agents | MCP servers as specialized tools |
| **Multi-agent review** | Council (3-model voting) | Not implemented |
| **Ratchets** | Baseline + shrink enforcement | Not implemented |
| **Evidence requirements** | Mandatory per work chunk | Recommended but not enforced |
| **Planning rigor** | "Junior dev could start immediately" | Plans exist but less prescriptive |

### What We Could Adopt

1. **Strict RPEQ with artifact handoffs** -- formalize the research -> plan -> execute -> QA pipeline with mandatory deliverables at each stage
2. **Ratchet pattern** -- for brownfield improvements, maintain baselines that must shrink
3. **Council pattern** -- multi-model review for high-stakes changes
4. **"Map, don't suggest" research** -- enforce factual observation before recommendation
5. **Work chunk protocol** -- atomic, evidence-backed change units
6. **AGENTS.md compression** -- keep knowledge maps short and verified
7. **Quality gates as code** -- mechanical enforcement over prose guidance

---

## 11. Potential MCP Integration Points

If building an MCP-based planning system for AI agents, harness-engineering suggests these tool categories:

```
mcp__harness__research     -- Codebase mapping with enforced fact-only output
mcp__harness__plan         -- Plan generation with junior-dev-ready acceptance criteria
mcp__harness__execute      -- Guided execution with rollback points and gate checks
mcp__harness__qa           -- Read-only post-execution analysis
mcp__harness__gates        -- Run verification gates (lint, imports, AST, tests)
mcp__harness__council      -- Multi-model review aggregation
mcp__harness__chunks       -- Work chunk management and evidence tracking
mcp__harness__ratchet      -- Baseline management for brownfield improvements
```

Each tool would enforce the phase boundaries mechanically -- research tools cannot produce recommendations, planning tools cannot modify code, QA tools cannot fix issues.

---

## Sources

- README.md -- https://github.com/alchemiststudiosDOTai/harness-engineering
- docs/harness-engineering.md -- Full HES v1 specification
- docs/workflows/RPEQ.md -- RPEQ workflow definition
- skills/research-phase/SKILL.md -- Research phase skill
- skills/plan-phase/SKILL.md -- Plan phase skill
- skills/execute-phase/SKILL.md -- Execute phase skill
- skills/qa-from-execute/SKILL.md -- QA phase skill
- skills/harness-map/SKILL.md -- Harness mapping skill
- skills/agents-md-mapper/SKILL.md -- AGENTS.md maintenance skill
- skills/differential-session-runner/SKILL.md -- A/B comparison evidence
- agents/guide.md -- Sub-agent definition guide
- agents/research/multi-agent-synthesis-orchestrator.md -- Multi-agent orchestration
- agents/development/tdd-python.md -- TDD agent pattern
- commands/COMMANDS.md -- Slash command documentation
- commands/context engineering/three-step-workflow.md -- Three-step workflow
- commands/context engineering/deep-research.md -- Deep research command
