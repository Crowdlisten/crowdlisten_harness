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

describe("claim_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  const originalEnv = { ...process.env };

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;

    // Clear executor env vars
    delete process.env.OPENCLAW_SESSION;
    delete process.env.OPENCLAW_AGENT;
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CODEX_SESSION_ID;
    delete process.env.GEMINI_CLI;
    delete process.env.AMP_SESSION_ID;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("claims a task with explicit executor", async () => {
    // Get card — .select(...).eq(...).single() => "select"
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      board_id: TEST_BOARD_ID,
      title: "Fix login bug",
    });
    // getColumnByStatus for "inprogress" — .select("id").eq(...).eq(...).single() => "select"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    // Update card status — .update({...}).eq(...) => "update"
    pushResult("kanban_cards", "update", null);
    // Create workspace — .insert({...}).select("id").single() => "select"
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // Create session — .insert({...}).select("id").single() => "select"
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "claim_task", {
      task_id: TEST_TASK_ID,
      executor: "CLAUDE_CODE",
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe(TEST_TASK_ID);
    expect(parsed.workspace_id).toBe(TEST_WORKSPACE_ID);
    expect(parsed.session_id).toBe(TEST_SESSION_ID);
    expect(parsed.executor).toBe("CLAUDE_CODE");
    expect(parsed.status).toBe("claimed");
    expect(parsed.branch).toContain("task/fix-login-bug-");
  });

  it("auto-detects executor when not provided", async () => {
    process.env.CURSOR_SESSION_ID = "cursor-abc";

    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      board_id: TEST_BOARD_ID,
      title: "Build feature",
    });
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    pushResult("kanban_cards", "update", null);
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "claim_task", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.executor).toBe("CURSOR");
  });

  it("uses custom branch name when provided", async () => {
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      board_id: TEST_BOARD_ID,
      title: "Any Title",
    });
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    pushResult("kanban_cards", "update", null);
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "claim_task", {
      task_id: TEST_TASK_ID,
      executor: "CLAUDE_CODE",
      branch: "custom/my-branch",
    });
    const parsed = JSON.parse(result);

    expect(parsed.branch).toBe("custom/my-branch");
  });

  it("generates branch from slugified title + task_id prefix", async () => {
    const taskId = "abcdef12-3456-7890-abcd-ef1234567890";
    pushResult("kanban_cards", "select", {
      id: taskId,
      board_id: TEST_BOARD_ID,
      title: "Implement OAuth 2.0 Flow",
    });
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    pushResult("kanban_cards", "update", null);
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // .insert({...}).select("id").single() => "select"
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "claim_task", {
      task_id: taskId,
      executor: "CLAUDE_CODE",
    });
    const parsed = JSON.parse(result);

    expect(parsed.branch).toBe("task/implement-oauth-2-0-flow-abcdef12");
  });

  it("throws when task not found", async () => {
    pushError("kanban_cards", "select", "Not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "claim_task", {
        task_id: "nonexistent",
        executor: "CLAUDE_CODE",
      })
    ).rejects.toThrow("Not found");
  });

  it("throws when workspace creation fails", async () => {
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      board_id: TEST_BOARD_ID,
      title: "Title",
    });
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    pushResult("kanban_cards", "update", null);
    // .insert({...}).select("id").single() => resolves as "select"
    pushError("kanban_workspaces", "select", "Workspace insert failed");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "claim_task", {
        task_id: TEST_TASK_ID,
        executor: "CLAUDE_CODE",
      })
    ).rejects.toThrow("Workspace insert failed");
  });
});
