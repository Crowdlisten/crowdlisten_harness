/**
 * CrowdListen Planner MCP - Integration / E2E Tests
 *
 * Runs a full task lifecycle against real Supabase using a service-role key.
 * Requires three environment variables:
 *   CROWDLISTEN_URL          - Supabase project URL
 *   CROWDLISTEN_SERVICE_KEY  - Service-role key (bypasses RLS)
 *   E2E_TEST_USER_ID         - UUID of a test user row in the auth.users table
 *
 * When the env vars are missing the suite is skipped gracefully so that
 * `npm run test:e2e` never fails in environments without credentials.
 */

import { createClient } from '@supabase/supabase-js';
import { handleTool } from '../../src/tools.js';

// ── Environment ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.CROWDLISTEN_URL;
const SUPABASE_KEY = process.env.CROWDLISTEN_SERVICE_KEY;
const TEST_USER_ID = process.env.E2E_TEST_USER_ID;

const canRun = !!(SUPABASE_URL && SUPABASE_KEY && TEST_USER_ID);

// ── Test suite ─────────────────────────────────────────────────────────────

describe.skipIf(!canRun)('Planner MCP E2E — full task lifecycle', () => {
  const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const userId = TEST_USER_ID!;

  /** Task IDs created during the run — cleaned up in afterAll. */
  const createdTaskIds: string[] = [];

  /** Board ID resolved by get_or_create_global_board. */
  let globalBoardId: string;

  // ── Cleanup ────────────────────────────────────────────────────────────

  afterAll(async () => {
    for (const taskId of createdTaskIds) {
      try {
        await handleTool(sb, userId, 'delete_task', { task_id: taskId });
      } catch {
        // Best-effort cleanup — task may already be deleted.
      }
    }
  });

  // ── Helper ─────────────────────────────────────────────────────────────

  /**
   * Calls handleTool and JSON-parses the result string.
   * Provides a concise API for each test step.
   */
  const call = async (
    tool: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => {
    const raw = await handleTool(sb, userId, tool, args);
    return JSON.parse(raw) as Record<string, unknown>;
  };

  // ── Tests (sequential, each builds on the previous) ────────────────────

  it('gets or creates the global board', async () => {
    const res = await call('get_or_create_global_board');
    // handleTool returns { board_id, name, status: "exists"|"created" }
    expect(res.status).toMatch(/exists|created/);
    expect(res.board_id).toBeDefined();
    globalBoardId = res.board_id as string;
  });

  it('lists projects', async () => {
    const res = await call('list_projects');
    expect(res.projects).toBeInstanceOf(Array);
    expect(typeof res.count).toBe('number');
  });

  it('creates a task', async () => {
    const taskTitle = `e2e_test_task_${Date.now()}`;
    const res = await call('create_task', {
      title: taskTitle,
      description: 'E2E test task — safe to delete',
      priority: 'medium',
    });
    // Response shape: { task_id, board_id, status: "created", project_id }
    expect(res.task_id).toBeDefined();
    expect(res.status).toBe('created');
    createdTaskIds.push(res.task_id as string);
  });

  it('gets the created task by ID', async () => {
    const res = await call('get_task', { task_id: createdTaskIds[0] });
    expect(res.task).toBeDefined();
    const task = res.task as Record<string, unknown>;
    expect(task.id).toBe(createdTaskIds[0]);
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
  });

  it('lists tasks and finds the created one', async () => {
    const res = await call('list_tasks');
    expect(res.tasks).toBeInstanceOf(Array);
    const tasks = res.tasks as Array<Record<string, unknown>>;
    const found = tasks.find((t) => t.id === createdTaskIds[0]);
    expect(found).toBeDefined();
  });

  it('updates the task title and priority', async () => {
    const updatedTitle = `e2e_test_task_updated_${Date.now()}`;
    const res = await call('update_task', {
      task_id: createdTaskIds[0],
      title: updatedTitle,
      priority: 'high',
    });
    // Response shape: { task: { id, title, status, priority }, status: "updated" }
    expect(res.task).toBeDefined();
    const task = res.task as Record<string, unknown>;
    expect(task.priority).toBe('high');
    expect(task.title).toBe(updatedTitle);
  });

  it('claims the task (moves to inprogress, creates workspace + session)', async () => {
    const res = await call('claim_task', { task_id: createdTaskIds[0] });
    // Response shape: { task_id, workspace_id, session_id, branch, executor, status: "claimed" }
    expect(res.status).toBe('claimed');
    expect(res.workspace_id).toBeDefined();
    expect(res.session_id).toBeDefined();
    expect(typeof res.branch).toBe('string');
  });

  it('lists tasks filtered by inprogress status and finds the claimed task', async () => {
    const res = await call('list_tasks', { status: 'inprogress' });
    expect(res.tasks).toBeInstanceOf(Array);
    const tasks = res.tasks as Array<Record<string, unknown>>;
    const found = tasks.find((t) => t.id === createdTaskIds[0]);
    expect(found).toBeDefined();
  });

  it('logs progress against the task', async () => {
    const res = await call('log_progress', {
      task_id: createdTaskIds[0],
      message: 'E2E test progress log',
    });
    // Response shape: { task_id, session_id, status: "logged" }
    expect(res.status).toBe('logged');
    expect(res.task_id).toBe(createdTaskIds[0]);
  });

  it('starts a new session on the task', async () => {
    const res = await call('start_session', {
      task_id: createdTaskIds[0],
      focus: 'E2E testing session',
    });
    // Response shape: { session_id, workspace_id, executor, focus, status, started_at, branch }
    expect(res.session_id).toBeDefined();
    expect(res.workspace_id).toBeDefined();
    expect(res.focus).toBe('E2E testing session');
  });

  it('lists sessions for the task', async () => {
    const res = await call('list_sessions', { task_id: createdTaskIds[0] });
    expect(res.sessions).toBeInstanceOf(Array);
    const sessions = res.sessions as unknown[];
    // At least the claim session and the start_session session
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('completes the task', async () => {
    const res = await call('complete_task', {
      task_id: createdTaskIds[0],
      summary: 'E2E test completed successfully',
    });
    // Response shape: { task_id, status: "done" }
    expect(res.status).toBe('done');
    expect(res.task_id).toBe(createdTaskIds[0]);
  });

  it('verifies the task moved to done status', async () => {
    const res = await call('get_task', { task_id: createdTaskIds[0] });
    const task = res.task as Record<string, unknown>;
    expect(task.status).toBe('done');
  });

  it('deletes the task and confirms get_task errors for nonexistent ID', async () => {
    const taskId = createdTaskIds[0];

    // Delete should succeed
    const delRes = await call('delete_task', { task_id: taskId });
    expect(delRes.status).toBe('deleted');

    // Remove from cleanup list since we already deleted it
    createdTaskIds.splice(0, 1);

    // Subsequent get_task should throw (row not found)
    await expect(call('get_task', { task_id: taskId })).rejects.toThrow();
  });
});
