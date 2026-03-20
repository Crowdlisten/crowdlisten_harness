import { describe, it, expect, beforeEach } from "vitest";
import { getColumnByStatus } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_BOARD_ID, TEST_COLUMN_TODO_ID, TEST_COLUMN_DONE_ID } from "../helpers/fixtures.js";

describe("getColumnByStatus", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("returns column id for valid 'todo' status", async () => {
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });

    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "todo");
    expect(result).toBe(TEST_COLUMN_TODO_ID);
  });

  it("returns column id for valid 'done' status", async () => {
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_DONE_ID });

    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "done");
    expect(result).toBe(TEST_COLUMN_DONE_ID);
  });

  it("returns null for invalid status key", async () => {
    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "invalid");
    expect(result).toBeNull();
  });

  it("returns null for empty status", async () => {
    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "");
    expect(result).toBeNull();
  });

  it("returns null when column not found in database", async () => {
    pushResult("kanban_columns", "select", null);

    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "todo");
    expect(result).toBeNull();
  });

  it("returns null when column data has no id", async () => {
    pushResult("kanban_columns", "select", { name: "To Do" }); // no id field

    const result = await getColumnByStatus(sb as any, TEST_BOARD_ID, "todo");
    // data?.id is undefined, so || null returns null
    expect(result).toBeNull();
  });
});
