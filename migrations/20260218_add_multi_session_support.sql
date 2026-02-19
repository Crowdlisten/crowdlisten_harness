-- Migration: Add Multi-Session Support
-- Description: Enable multiple parallel agent sessions per workspace for "Cursor for PM" vision
-- Date: 2026-02-18
--
-- This migration adds:
-- 1. Session lifecycle columns (status, focus, started_at, completed_at)
-- 2. Index for querying active sessions by workspace
-- 3. RLS policy for user session isolation

-- ============================================================================
-- STEP 1: Add new columns to kanban_sessions
-- ============================================================================

-- Add status column with valid state constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kanban_sessions' AND column_name = 'status'
    ) THEN
        ALTER TABLE kanban_sessions
        ADD COLUMN status TEXT DEFAULT 'idle';

        ALTER TABLE kanban_sessions
        ADD CONSTRAINT kanban_sessions_status_check
        CHECK (status IN ('idle', 'running', 'completed', 'failed', 'stopped'));
    END IF;
END $$;

-- Add focus column (describes what session is working on)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kanban_sessions' AND column_name = 'focus'
    ) THEN
        ALTER TABLE kanban_sessions
        ADD COLUMN focus TEXT;
    END IF;
END $$;

-- Add started_at timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kanban_sessions' AND column_name = 'started_at'
    ) THEN
        ALTER TABLE kanban_sessions
        ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add completed_at timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'kanban_sessions' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE kanban_sessions
        ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add index for querying active sessions by workspace
-- ============================================================================

-- Composite index for efficient workspace + status queries
-- Supports queries like: "Get all running sessions for workspace X"
CREATE INDEX IF NOT EXISTS idx_kanban_sessions_workspace_status
ON kanban_sessions (workspace_id, status);

-- Partial index for active sessions only (excludes completed/failed/stopped)
-- Optimizes the common query pattern of finding running or idle sessions
CREATE INDEX IF NOT EXISTS idx_kanban_sessions_active
ON kanban_sessions (workspace_id, status)
WHERE status IN ('idle', 'running');

-- ============================================================================
-- STEP 3: Add RLS policy for user session isolation
-- ============================================================================

-- Enable RLS on kanban_sessions if not already enabled
ALTER TABLE kanban_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS kanban_sessions_user_isolation ON kanban_sessions;

-- Create policy: users can only access sessions belonging to their workspaces
-- This joins through kanban_workspaces to check ownership
CREATE POLICY kanban_sessions_user_isolation ON kanban_sessions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kanban_workspaces kw
            WHERE kw.id = kanban_sessions.workspace_id
            AND kw.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM kanban_workspaces kw
            WHERE kw.id = kanban_sessions.workspace_id
            AND kw.user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN kanban_sessions.status IS
    'Session lifecycle state: idle (ready), running (active), completed (success), failed (error), stopped (user terminated)';

COMMENT ON COLUMN kanban_sessions.focus IS
    'Human-readable description of what this session is working on, e.g., "implement auth backend"';

COMMENT ON COLUMN kanban_sessions.started_at IS
    'Timestamp when session transitioned to running state';

COMMENT ON COLUMN kanban_sessions.completed_at IS
    'Timestamp when session transitioned to completed, failed, or stopped state';

COMMENT ON INDEX idx_kanban_sessions_workspace_status IS
    'Supports efficient queries for sessions by workspace and status';

COMMENT ON INDEX idx_kanban_sessions_active IS
    'Partial index for finding active (idle/running) sessions per workspace';

-- ============================================================================
-- VERIFICATION QUERIES (commented out, for manual testing)
-- ============================================================================

-- Verify columns were added:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'kanban_sessions'
-- AND column_name IN ('status', 'focus', 'started_at', 'completed_at');

-- Verify indexes exist:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'kanban_sessions';

-- Verify RLS policy exists:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'kanban_sessions';
