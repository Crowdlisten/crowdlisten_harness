-- Migration: Add sharing/publishing support to memories
-- Date: 2026-04-04
-- Purpose: Enable personal→team publishing of knowledge base entries

-- Add publishing columns to memories
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS team_id uuid;

-- Index for team queries
CREATE INDEX IF NOT EXISTS idx_memories_team_published
  ON memories (team_id, is_published)
  WHERE is_published = true;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Team membership
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- RLS on teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- RLS on team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team memberships"
  ON team_members FOR SELECT
  USING (user_id = auth.uid() OR team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Team owners can manage members"
  ON team_members FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS: allow reading published memories from your team
CREATE POLICY "Users can read published team memories"
  ON memories FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      is_published = true
      AND team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    )
  );
