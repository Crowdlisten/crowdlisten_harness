import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_TASK_ID,
  TEST_COLUMN_INPROGRESS_ID,
  TEST_WORKSPACE_ID,
  TEST_SESSION_ID,
} from "../helpers/fixtures.js";

describe("start_session tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  const originalEnv = { ...process.env };

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;

    delete process.env.OPENCLAW_SESSION;
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.CURSOR_TRACE_ID;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("starts a session on existing workspace", async () => {
    // Find existing workspace — .select(...).eq(...).eq(...).order(...).limit(1).single() => "select"
    pushResult("kanban_workspaces", "select", {
      id: TEST_WORKSPACE_ID,
      branch: "task/existing-branch-12345678",
    });
    // Create session — .insert({...}).select("id, executor, focus, status, started_at").single() => "select"
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      executor: "CLAUDE_CODE",
      focus: "implement auth backend",
      status: "running",
      started_at: "2026-01-15T13:00:00Z",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "start_session", {
      task_id: TEST_TASK_ID,
      executor: "CLAUDE_CODE",
      focus: "implement auth backend",
    });
    const parsed = JSON.parse(result);

    expect(parsed.session_id).toBe(TEST_SESSION_ID);
    expect(parsed.workspace_id).toBe(TEST_WORKSPACE_ID);
    expect(parsed.executor).toBe("CLAUDE_CODE");
    expect(parsed.focus).toBe("implement auth backend");
    expect(parsed.status).toBe("running");
    expect(parsed.branch).toBe("task/existing-branch-12345678");
  });

  it("creates new workspace when none exists", async () => {
    // No existing workspace — .select(...).eq(...).eq(...).order(...).limit(1).single() => "select"
    pushResult("kanban_workspaces", "select", null);
    // Get card — .select(...).eq(...).single() => "select"
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      board_id: TEST_BOARD_ID,
      title: "Add user profile page",
    });
    // getColumnByStatus for inprogress — .select("id").eq(...).eq(...).single() => "select"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    // Update card status — .update({...}).eq(...) => "update"
    pushResult("kanban_cards", "update", null);
    // Create workspace — .insert({...}).select("id").single() => "select" (2nd kanban_workspaces.select)
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // Create session — .insert({...}).select(...).single() => "select" (kanban_sessions.select)
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      executor: "CURSOR",
      focus: "frontend styling",
      status: "running",
      started_at: "2026-01-15T14:00:00Z",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "start_session", {
      task_id: TEST_TASK_ID,
      executor: "CURSOR",
      focus: "frontend styling",
    });
    const parsed = JSON.parse(result);

    expect(parsed.workspace_id).toBe(TEST_WORKSPACE_ID);
    expect(parsed.branch).toContain("task/add-user-profile-page-");
  });

  it("auto-detects executor when not provided", async () => {
    process.env.CLAUDE_CODE = "1";

    pushResult("kanban_workspaces", "select", {
      id: TEST_WORKSPACE_ID,
      branch: "task/branch",
    });
    // .insert({...}).select(...).single() => "select"
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      executor: "CLAUDE_CODE",
      focus: "testing",
      status: "running",
      started_at: "2026-01-15T15:00:00Z",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "start_session", {
      task_id: TEST_TASK_ID,
      focus: "testing",
    });
    const parsed = JSON.parse(result);

    // The executor passed to session insert is auto-detected
    expect(parsed.executor).toBe("CLAUDE_CODE");
  });

  it("throws when task not found (no workspace)", async () => {
    pushResult("kanban_workspaces", "select", null);
    pushError("kanban_cards", "select", "Card not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "start_session", {
        task_id: "nonexistent",
        focus: "testing",
      })
    ).rejects.toThrow("Card not found");
  });

  it("throws when session creation fails", async () => {
    pushResult("kanban_workspaces", "select", {
      id: TEST_WORKSPACE_ID,
      branch: "task/branch",
    });
    // .insert({...}).select(...).single() => resolves as "select"
    pushError("kanban_sessions", "select", "Session insert failed");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "start_session", {
        task_id: TEST_TASK_ID,
        executor: "CLAUDE_CODE",
        focus: "testing",
      })
    ).rejects.toThrow("Session insert failed");
  });
});

describe("list_sessions tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("returns enriched sessions for a task", async () => {
    // Find workspaces for task
    pushResult("kanban_workspaces", "select", [
      {
        id: TEST_WORKSPACE_ID,
        branch: "task/my-branch-12345678",
        archived: false,
        created_at: "2026-01-15T13:00:00Z",
      },
    ]);
    // Find sessions for workspaces
    pushResult("kanban_sessions", "select", [
      {
        id: TEST_SESSION_ID,
        workspace_id: TEST_WORKSPACE_ID,
        executor: "CLAUDE_CODE",
        focus: "auth backend",
        status: "running",
        started_at: "2026-01-15T13:00:00Z",
        completed_at: null,
        created_at: "2026-01-15T13:00:00Z",
      },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_sessions", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.count).toBe(1);
    expect(parsed.task_id).toBe(TEST_TASK_ID);
    expect(parsed.sessions[0].session_id).toBe(TEST_SESSION_ID);
    expect(parsed.sessions[0].branch).toBe("task/my-branch-12345678");
    expect(parsed.sessions[0].workspace_archived).toBe(false);
    expect(parsed.sessions[0].executor).toBe("CLAUDE_CODE");
  });

  it("returns empty sessions when no workspaces exist", async () => {
    pushResult("kanban_workspaces", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_sessions", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.sessions).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("returns empty when workspaces exist but data is null", async () => {
    pushResult("kanban_workspaces", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_sessions", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.sessions).toHaveLength(0);
  });

  it("throws on workspace query error", async () => {
    pushError("kanban_workspaces", "select", "Access denied");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "list_sessions", { task_id: TEST_TASK_ID })
    ).rejects.toThrow("Access denied");
  });

  it("throws on session query error", async () => {
    pushResult("kanban_workspaces", "select", [
      { id: TEST_WORKSPACE_ID, branch: "b", archived: false, created_at: "2026-01-15" },
    ]);
    pushError("kanban_sessions", "select", "Sessions query failed");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "list_sessions", { task_id: TEST_TASK_ID })
    ).rejects.toThrow("Sessions query failed");
  });
});

describe("update_session tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("updates session status", async () => {
    // .update({...}).eq(...).select(...).single() => resolves as "select"
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      workspace_id: TEST_WORKSPACE_ID,
      executor: "CLAUDE_CODE",
      focus: "auth backend",
      status: "completed",
      started_at: "2026-01-15T13:00:00Z",
      completed_at: "2026-01-15T14:30:00Z",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_session", {
      session_id: TEST_SESSION_ID,
      status: "completed",
    });
    const parsed = JSON.parse(result);

    expect(parsed.session.id).toBe(TEST_SESSION_ID);
    expect(parsed.session.status).toBe("completed");
    expect(parsed.status).toBe("updated");
  });

  it("updates session focus", async () => {
    // .update({...}).eq(...).select(...).single() => resolves as "select"
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      workspace_id: TEST_WORKSPACE_ID,
      executor: "CLAUDE_CODE",
      focus: "updated focus area",
      status: "running",
      started_at: "2026-01-15T13:00:00Z",
      completed_at: null,
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_session", {
      session_id: TEST_SESSION_ID,
      focus: "updated focus area",
    });
    const parsed = JSON.parse(result);

    expect(parsed.session.focus).toBe("updated focus area");
  });

  it("throws when no updates provided", async () => {
    await expect(
      handleTool(sb as any, TEST_USER_ID, "update_session", {
        session_id: TEST_SESSION_ID,
      })
    ).rejects.toThrow("No updates provided. Specify status or focus.");
  });

  it("throws on update error", async () => {
    // .update({...}).eq(...).select(...).single() => resolves as "select"
    pushError("kanban_sessions", "select", "Session not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "update_session", {
        session_id: "nonexistent",
        status: "completed",
      })
    ).rejects.toThrow("Session not found");
  });
});
