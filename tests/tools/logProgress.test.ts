import { describe, it, expect, beforeEach } from "vitest";
import { handleTool, logToSession } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_TASK_ID,
  TEST_WORKSPACE_ID,
  TEST_SESSION_ID,
  TEST_PROCESS_ID,
} from "../helpers/fixtures.js";

describe("log_progress tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("logs progress to the most recent session", async () => {
    // logToSession: find active workspace
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // logToSession: find most recent session
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });
    // logToSession: create execution process
    pushResult("kanban_execution_processes", "insert", { id: TEST_PROCESS_ID });
    // logToSession: create log entry
    pushResult("kanban_execution_process_logs", "insert", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "log_progress", {
      task_id: TEST_TASK_ID,
      message: "Refactoring auth module",
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe(TEST_TASK_ID);
    expect(parsed.status).toBe("logged");
    expect(parsed.session_id).toBeNull();
  });

  it("logs to a specific session when session_id provided", async () => {
    // logToSession with explicit session_id: lookup session directly
    pushResult("kanban_sessions", "select", {
      id: TEST_SESSION_ID,
      workspace_id: TEST_WORKSPACE_ID,
    });
    // Create execution process
    pushResult("kanban_execution_processes", "insert", { id: TEST_PROCESS_ID });
    // Create log entry
    pushResult("kanban_execution_process_logs", "insert", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "log_progress", {
      task_id: TEST_TASK_ID,
      message: "Working on login form",
      session_id: TEST_SESSION_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.session_id).toBe(TEST_SESSION_ID);
    expect(parsed.status).toBe("logged");
  });

  it("handles missing workspace gracefully (no crash)", async () => {
    // No workspace found
    pushResult("kanban_workspaces", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "log_progress", {
      task_id: TEST_TASK_ID,
      message: "Progress note",
    });
    const parsed = JSON.parse(result);

    // Still returns logged status even if no workspace/session found
    expect(parsed.status).toBe("logged");
  });

  it("handles missing session gracefully (no crash)", async () => {
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // No session found
    pushResult("kanban_sessions", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "log_progress", {
      task_id: TEST_TASK_ID,
      message: "Note without session",
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("logged");
  });
});

describe("logToSession function", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("creates coding agent turn and archives workspace when complete=true", async () => {
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });
    pushResult("kanban_execution_processes", "insert", { id: TEST_PROCESS_ID });
    pushResult("kanban_execution_process_logs", "insert", null);
    pushResult("kanban_coding_agent_turns", "insert", null);
    pushResult("kanban_workspaces", "update", null);

    // Should not throw
    await logToSession(sb as any, TEST_USER_ID, TEST_TASK_ID, "All done!", true);
  });

  it("does not archive workspace when complete=false", async () => {
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });
    pushResult("kanban_execution_processes", "insert", { id: TEST_PROCESS_ID });
    pushResult("kanban_execution_process_logs", "insert", null);

    // complete=false: should NOT call coding_agent_turns or archive workspace
    await logToSession(sb as any, TEST_USER_ID, TEST_TASK_ID, "In progress", false);

    // Verify from() was not called with kanban_coding_agent_turns
    const fromCalls = (sb.from as any).mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain("kanban_coding_agent_turns");
  });

  it("returns early if execution process creation fails", async () => {
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });
    // Process insert returns null data (proc is null -> early return)
    pushResult("kanban_execution_processes", "insert", null);

    // Should not throw, just return silently
    await logToSession(sb as any, TEST_USER_ID, TEST_TASK_ID, "Message", false);
  });
});
