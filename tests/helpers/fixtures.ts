/**
 * Test fixtures for CrowdListen Kanban MCP tests.
 *
 * Provides consistent sample data objects matching the Supabase schema
 * used throughout the tool handlers.
 */

export const TEST_USER_ID = "user-00000000-0000-0000-0000-000000000001";
export const TEST_USER_EMAIL = "testuser@crowdlisten.com";

export const TEST_BOARD_ID = "board-0000-0000-0000-000000000001";
export const TEST_BOARD = {
  id: TEST_BOARD_ID,
  name: "Global Tasks",
  description: null,
  project_id: "proj-0000-0000-0000-000000000001",
  user_id: TEST_USER_ID,
  created_at: "2026-01-15T10:00:00Z",
};

export const TEST_PROJECT_ID = "proj-0000-0000-0000-000000000001";
export const TEST_PROJECT = {
  id: TEST_PROJECT_ID,
  name: "Global Tasks",
  description: "Container for your global kanban board",
  user_id: TEST_USER_ID,
  updated_at: "2026-01-15T10:00:00Z",
};

export const TEST_COLUMN_TODO_ID = "col-0000-0000-0000-000000000001";
export const TEST_COLUMN_INPROGRESS_ID = "col-0000-0000-0000-000000000002";
export const TEST_COLUMN_INREVIEW_ID = "col-0000-0000-0000-000000000003";
export const TEST_COLUMN_DONE_ID = "col-0000-0000-0000-000000000004";
export const TEST_COLUMN_CANCELLED_ID = "col-0000-0000-0000-000000000005";

export const TEST_COLUMNS = [
  { id: TEST_COLUMN_TODO_ID, name: "To Do", board_id: TEST_BOARD_ID, position: 0 },
  { id: TEST_COLUMN_INPROGRESS_ID, name: "In Progress", board_id: TEST_BOARD_ID, position: 1 },
  { id: TEST_COLUMN_INREVIEW_ID, name: "In Review", board_id: TEST_BOARD_ID, position: 2 },
  { id: TEST_COLUMN_DONE_ID, name: "Done", board_id: TEST_BOARD_ID, position: 3 },
  { id: TEST_COLUMN_CANCELLED_ID, name: "Cancelled", board_id: TEST_BOARD_ID, position: 4 },
];

export const TEST_TASK_ID = "task-0000-0000-0000-000000000001";
export const TEST_TASK = {
  id: TEST_TASK_ID,
  title: "Implement user authentication",
  description: "Add JWT-based auth with refresh tokens",
  status: "todo",
  priority: "high",
  labels: [{ name: "backend", color: "#3b82f6" }],
  due_date: null,
  position: 1,
  board_id: TEST_BOARD_ID,
  column_id: TEST_COLUMN_TODO_ID,
  user_id: TEST_USER_ID,
  created_at: "2026-01-15T12:00:00Z",
  updated_at: "2026-01-15T12:00:00Z",
  column: { id: TEST_COLUMN_TODO_ID, name: "To Do" },
};

export const TEST_TASK_2_ID = "task-0000-0000-0000-000000000002";
export const TEST_TASK_2 = {
  id: TEST_TASK_2_ID,
  title: "Design landing page",
  description: "Create responsive hero section",
  status: "inprogress",
  priority: "medium",
  labels: [{ name: "frontend", color: "#10b981" }],
  due_date: "2026-02-01T00:00:00Z",
  position: 2,
  board_id: TEST_BOARD_ID,
  column_id: TEST_COLUMN_INPROGRESS_ID,
  user_id: TEST_USER_ID,
  created_at: "2026-01-16T09:00:00Z",
  updated_at: "2026-01-17T14:00:00Z",
  column: { id: TEST_COLUMN_INPROGRESS_ID, name: "In Progress" },
};

export const TEST_WORKSPACE_ID = "ws-0000-0000-0000-000000000001";
export const TEST_WORKSPACE = {
  id: TEST_WORKSPACE_ID,
  card_id: TEST_TASK_ID,
  user_id: TEST_USER_ID,
  branch: "task/implement-user-authentication-task-0000",
  archived: false,
  created_at: "2026-01-15T13:00:00Z",
};

export const TEST_SESSION_ID = "sess-0000-0000-0000-000000000001";
export const TEST_SESSION = {
  id: TEST_SESSION_ID,
  workspace_id: TEST_WORKSPACE_ID,
  user_id: TEST_USER_ID,
  executor: "CLAUDE_CODE",
  focus: "implement auth backend",
  status: "running",
  started_at: "2026-01-15T13:00:00Z",
  completed_at: null,
  created_at: "2026-01-15T13:00:00Z",
};

export const TEST_PROCESS_ID = "proc-0000-0000-0000-000000000001";

export const TEST_STORED_AUTH = {
  access_token: "eyJ-test-access-token",
  refresh_token: "eyJ-test-refresh-token",
  user_id: TEST_USER_ID,
  email: TEST_USER_EMAIL,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

// ─── Planning Context Fixtures ───────────────────────────────────────────────

export const TEST_PLAN_ID = "plan-0000-0000-0000-000000000001";
export const TEST_PLAN = {
  id: TEST_PLAN_ID,
  user_id: TEST_USER_ID,
  project_id: TEST_PROJECT_ID,
  task_id: TEST_TASK_ID,
  type: "plan",
  title: "Plan: JWT + refresh tokens",
  body: "JWT + refresh tokens",
  metadata: {
    assumptions: ["Server-side validation preferred"],
    success_criteria: ["All tests pass"],
  },
  status: "draft",
  version: 1,
  source: "agent",
  source_agent: "CLAUDE_CODE",
  confidence: 1.0,
  created_at: "2026-01-15T14:00:00Z",
  updated_at: "2026-01-15T14:00:00Z",
};

export const TEST_CONTEXT_ID = "ctx-0000-0000-0000-000000000001";
export const TEST_CONTEXT_ENTRY = {
  id: TEST_CONTEXT_ID,
  user_id: TEST_USER_ID,
  project_id: TEST_PROJECT_ID,
  task_id: null,
  type: "decision",
  title: "Use JWT for auth",
  body: "Chose JWT over session cookies for stateless API",
  tags: ["auth", "architecture"],
  metadata: {},
  status: "active",
  confidence: 1.0,
  source: "agent",
  source_agent: "CLAUDE_CODE",
  created_at: "2026-01-15T15:00:00Z",
  updated_at: "2026-01-15T15:00:00Z",
};

export const TEST_LEARNING_ID = "learn-0000-0000-0000-000000000001";
export const TEST_PROMOTED_ID = "learn-0000-0000-0000-000000000002";

/**
 * Builds a list of tasks with configurable count.
 */
export function buildTaskList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${String(i + 1).padStart(4, "0")}`,
    title: `Task ${i + 1}`,
    description: `Description for task ${i + 1}`,
    status: "todo",
    priority: "medium",
    labels: [],
    due_date: null,
    position: i + 1,
    created_at: "2026-01-15T12:00:00Z",
    updated_at: "2026-01-15T12:00:00Z",
    column: { id: TEST_COLUMN_TODO_ID, name: "To Do" },
  }));
}
