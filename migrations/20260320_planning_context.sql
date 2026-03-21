-- Planning Context: knowledge base for plans, decisions, constraints, patterns, learnings, principles
-- Part of the Plan & Delegate system — agents read and write context via MCP tools

-- ─── Table 1: planning_context ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.planning_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Scope
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,

  -- What kind of context is this?
  type TEXT NOT NULL CHECK (type IN (
    'plan',        -- execution plan for a task
    'decision',    -- "We chose X over Y because..."
    'constraint',  -- "Must support IE11" / "Budget is $5k/mo"
    'preference',  -- "Use Tailwind" / "Prefer functional style"
    'pattern',     -- "All API routes follow /api/v1/{resource}"
    'learning',    -- "Redis caching reduced latency 40%"
    'principle'    -- "Never store PII in logs"
  )),

  -- Content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Structured fields (used by plans, optional for other types)
  metadata JSONB DEFAULT '{}',

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',       -- plan not yet ready for review
    'review',      -- plan awaiting human feedback
    'approved',    -- plan approved for execution
    'executing',   -- plan currently being executed
    'active',      -- context entry in effect
    'completed',   -- plan finished
    'stale',       -- may no longer be relevant
    'superseded',  -- replaced by newer entry
    'archived'     -- retired
  )),
  superseded_by UUID REFERENCES public.planning_context(id),
  version INTEGER NOT NULL DEFAULT 1,

  -- Provenance
  source TEXT DEFAULT 'human' CHECK (source IN ('human', 'agent')),
  source_agent TEXT,
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pc_user ON planning_context(user_id);
CREATE INDEX idx_pc_project ON planning_context(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_pc_task ON planning_context(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_pc_type ON planning_context(type);
CREATE INDEX idx_pc_status ON planning_context(status);
CREATE INDEX idx_pc_tags ON planning_context USING GIN (tags);
CREATE INDEX idx_pc_search ON planning_context
  USING GIN (to_tsvector('english', title || ' ' || body));

-- One active plan per task
CREATE UNIQUE INDEX idx_pc_active_plan ON planning_context(task_id)
  WHERE type = 'plan' AND status NOT IN ('completed', 'archived', 'superseded');

-- RLS
ALTER TABLE planning_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own context"
  ON planning_context FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─── Table 2: planning_context_versions ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.planning_context_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID NOT NULL REFERENCES public.planning_context(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Snapshot
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT,
  feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pcv_context ON planning_context_versions(context_id);
CREATE UNIQUE INDEX idx_pcv_unique ON planning_context_versions(context_id, version);

ALTER TABLE planning_context_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own versions"
  ON planning_context_versions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM planning_context pc
    WHERE pc.id = planning_context_versions.context_id
    AND pc.user_id = auth.uid()
  ));
