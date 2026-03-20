import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_TASK_ID,
  TEST_COLUMN_DONE_ID,
  TEST_WORKSPACE_ID,
  TEST_SESSION_ID,
  TEST_PROCESS_ID,
} from "../helpers/fixtures.js";

describe("complete_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("marks a task as done without summary", async () => {
    // Get card's board_id
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    // getColumnByStatus for "done"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_DONE_ID });
    // Update card to done
    pushResult("kanban_cards", "update", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "complete_task", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe(TEST_TASK_ID);
    expect(parsed.status).toBe("done");
  });

  it("marks a task as done with summary and logs it", async () => {
    // Get card's board_id
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    // getColumnByStatus for "done"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_DONE_ID });
    // Update card
    pushResult("kanban_cards", "update", null);
    // logToSession: find workspace
    pushResult("kanban_workspaces", "select", { id: TEST_WORKSPACE_ID });
    // logToSession: find session
    pushResult("kanban_sessions", "select", { id: TEST_SESSION_ID });
    // logToSession: create execution process
    pushResult("kanban_execution_processes", "insert", { id: TEST_PROCESS_ID });
    // logToSession: create log entry
    pushResult("kanban_execution_process_logs", "insert", null);
    // logToSession: create coding agent turn (complete=true)
    pushResult("kanban_coding_agent_turns", "insert", null);
    // logToSession: archive workspace (complete=true)
    pushResult("kanban_workspaces", "update", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "complete_task", {
      task_id: TEST_TASK_ID,
      summary: "Implemented JWT auth with refresh token rotation",
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe(TEST_TASK_ID);
    expect(parsed.status).toBe("done");
  });

  it("handles missing card gracefully (no board lookup)", async () => {
    // Card not found (data is null)
    pushResult("kanban_cards", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "complete_task", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    // Still returns done status even if card wasn't found to update
    expect(parsed.status).toBe("done");
  });
});
