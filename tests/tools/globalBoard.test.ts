import { describe, it, expect, beforeEach } from "vitest";
import { handleTool, getOrCreateGlobalBoard } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_USER_ID, TEST_BOARD_ID, TEST_PROJECT_ID } from "../helpers/fixtures.js";

describe("get_or_create_global_board tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("returns existing global board without creating", async () => {
    // getOrCreateGlobalBoard queries kanban_boards first
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });

    const result = await handleTool(sb as any, TEST_USER_ID, "get_or_create_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.name).toBe("Global Tasks");
    expect(parsed.status).toBe("exists");
  });

  it("creates a new global board when none exists", async () => {
    // First query: no existing board — .select(...).eq(...).eq(...).single() => "select"
    pushResult("kanban_boards", "select", null);
    // Check for existing global project — .select("id").eq(...).eq(...).single() => "select"
    pushResult("projects", "select", null);
    // Create new project — .insert({...}).select("id").single() => resolves as "select" (2nd projects.select)
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // Create new board — .insert({...}).select("id").single() => resolves as "select" (2nd kanban_boards.select)
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID });
    // 5 column inserts — .insert({...}) with no .select() => resolves as "insert"
    for (let i = 0; i < 5; i++) {
      pushResult("kanban_columns", "insert", { id: `col-${i}` });
    }

    const result = await handleTool(sb as any, TEST_USER_ID, "get_or_create_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.name).toBe("Global Tasks");
    expect(parsed.status).toBe("created");
  });

  it("reuses existing global project when creating board", async () => {
    // No existing board — .select(...).eq(...).eq(...).single() => "select"
    pushResult("kanban_boards", "select", null);
    // Existing project found — .select("id").eq(...).eq(...).single() => "select"
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // Create board — .insert({...}).select("id").single() => resolves as "select" (2nd kanban_boards.select)
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID });
    // Column inserts — .insert({...}) with no .select() => resolves as "insert"
    for (let i = 0; i < 5; i++) {
      pushResult("kanban_columns", "insert", { id: `col-${i}` });
    }

    const result = await handleTool(sb as any, TEST_USER_ID, "get_or_create_global_board", {});
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.status).toBe("created");
  });
});

describe("getOrCreateGlobalBoard function", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("throws when project creation fails", async () => {
    pushResult("kanban_boards", "select", null);
    pushResult("projects", "select", null);
    // .insert({...}).select("id").single() => resolves as "select" (2nd projects.select)
    pushError("projects", "select", "Database error");

    await expect(
      getOrCreateGlobalBoard(sb as any, TEST_USER_ID)
    ).rejects.toThrow("Failed to create global project: Database error");
  });

  it("throws when board creation fails", async () => {
    pushResult("kanban_boards", "select", null);
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // .insert({...}).select("id").single() => resolves as "select" (2nd kanban_boards.select)
    pushError("kanban_boards", "select", "Board creation failed");

    await expect(
      getOrCreateGlobalBoard(sb as any, TEST_USER_ID)
    ).rejects.toThrow("Failed to create global board: Board creation failed");
  });
});
