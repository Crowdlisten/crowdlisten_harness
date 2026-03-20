import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_COLUMN_TODO_ID,
  TEST_COLUMN_DONE_ID,
} from "../helpers/fixtures.js";

describe("migrate_to_global_board tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("migrates tasks from other boards to the global board", async () => {
    // getOrCreateGlobalBoard: existing board found
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    // Get all tasks not on global board
    pushResult("kanban_cards", "select", [
      { id: "task-1", title: "Task One", status: "todo", board_id: "other-board-1" },
      { id: "task-2", title: "Task Two", status: "done", board_id: "other-board-2" },
    ]);
    // getColumnByStatus for task-1 (todo)
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    // Update task-1
    pushResult("kanban_cards", "update", null);
    // getColumnByStatus for task-2 (done)
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_DONE_ID });
    // Update task-2
    pushResult("kanban_cards", "update", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "migrate_to_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.migrated).toBe(2);
    expect(parsed.total_found).toBe(2);
    expect(parsed.global_board_id).toBe(TEST_BOARD_ID);
    expect(parsed.status).toBe("migration_complete");
  });

  it("returns zero when no tasks to migrate", async () => {
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    pushResult("kanban_cards", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "migrate_to_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.migrated).toBe(0);
    expect(parsed.message).toBe("No tasks to migrate");
  });

  it("returns zero when all tasks data is null", async () => {
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    pushResult("kanban_cards", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "migrate_to_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.migrated).toBe(0);
  });

  it("handles partial migration (some tasks fail column lookup)", async () => {
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    pushResult("kanban_cards", "select", [
      { id: "task-1", title: "One", status: "todo", board_id: "other-1" },
      { id: "task-2", title: "Two", status: "invalidstatus", board_id: "other-2" },
    ]);
    // task-1: column found
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    pushResult("kanban_cards", "update", null);
    // task-2: invalid status returns null from getColumnByStatus (no query because STATUS_COLUMN check fails)

    const result = await handleTool(sb as any, TEST_USER_ID, "migrate_to_global_board", {});
    const parsed = JSON.parse(result);

    // Only task-1 migrated, task-2 skipped because of invalid status
    expect(parsed.migrated).toBe(1);
    expect(parsed.total_found).toBe(2);
  });

  it("throws when task query fails", async () => {
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    pushError("kanban_cards", "select", "Query error");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "migrate_to_global_board", {})
    ).rejects.toThrow("Query error");
  });
});
