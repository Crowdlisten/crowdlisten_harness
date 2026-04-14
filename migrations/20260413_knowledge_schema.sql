-- Migration: Enhance pages table for compiled truth pattern
-- Date: 2026-04-13
-- Purpose: Add knowledge compilation columns to support G-Brain compiled truth model
--
-- New columns:
--   category  — page type (topic, entity, source, document, log, index, overview)
--   confidence — compilation confidence score (0.0 - 1.0)
--   source_analyses — array of analysis UUIDs that contributed to this page
--   version  — monotonic page version for rollback support
--   compiled_at — timestamp of last knowledge compilation

-- Step 1: Add new columns to pages table
ALTER TABLE pages ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS source_analyses UUID[] DEFAULT '{}';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS compiled_at TIMESTAMPTZ;

-- Step 2: Index for category filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_pages_category ON pages (category) WHERE category IS NOT NULL;

-- Step 3: Index for stale page detection (compiled_at < latest evidence)
CREATE INDEX IF NOT EXISTS idx_pages_compiled_at ON pages (compiled_at) WHERE compiled_at IS NOT NULL;

-- Step 4: Backfill category from path prefix for existing pages
UPDATE pages SET category = 'topic'
WHERE category IS NULL AND path LIKE 'topics/%';

UPDATE pages SET category = 'entity'
WHERE category IS NULL AND path LIKE 'entities/%';

UPDATE pages SET category = 'source'
WHERE category IS NULL AND path LIKE 'sources/%';

UPDATE pages SET category = 'document'
WHERE category IS NULL AND (path LIKE 'documents/%' OR path LIKE 'docs/%');

UPDATE pages SET category = 'log'
WHERE category IS NULL AND path = 'log';

UPDATE pages SET category = 'overview'
WHERE category IS NULL AND path LIKE 'overview%';

-- Step 5: Helper function to slugify titles for path generation
CREATE OR REPLACE FUNCTION slugify(text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(text, '[^a-zA-Z0-9\s-]', '', 'g'),  -- remove special chars
        '\s+', '-', 'g'                                       -- spaces to hyphens
      ),
      '-+', '-', 'g'                                          -- collapse multiple hyphens
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 6: Migrate project_insights themes/insights to pages (idempotent)
-- Only migrates rows that don't already exist in pages
INSERT INTO pages (id, user_id, project_id, path, title, content, category, source, created_at, updated_at)
SELECT
  pi.id,
  pi.user_id,
  pi.project_id,
  'topics/' || slugify(pi.title),
  pi.title,
  pi.content,
  'topic',
  'analysis',
  pi.created_at,
  pi.updated_at
FROM project_insights pi
WHERE pi.type IN ('theme', 'insight')
  AND NOT EXISTS (
    SELECT 1 FROM pages p
    WHERE p.user_id = pi.user_id AND p.path = 'topics/' || slugify(pi.title)
  )
ON CONFLICT (user_id, path) DO NOTHING;
