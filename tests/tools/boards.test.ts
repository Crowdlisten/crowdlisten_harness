import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_USER_ID, TEST_BOARD_ID, TEST_PROJECT_ID } from "../helpers/fixtures.js";

describe("list_boards tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("returns boards for a project", async () => {
    const boards = [
      { id: "board-1", name: "Tasks", description: null, created_at: "2026-01-15T10:00:00Z" },
      { id: "board-2", name: "Sprint 1", description: "First sprint", created_at: "2026-01-14T10:00:00Z" },
    ];
    pushResult("kanban_boards", "select", boards);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_boards", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.boards).toHaveLength(2);
    expect(parsed.count).toBe(2);
  });

  it("returns empty when no boards exist", async () => {
    pushResult("kanban_boards", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_boards", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.boards).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("throws on Supabase error", async () => {
    pushError("kanban_boards", "select", "DB error");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "list_boards", { project_id: TEST_PROJECT_ID })
    ).rejects.toThrow("DB error");
  });
});

describe("create_board tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("creates a board with default columns", async () => {
    // Verify project exists — .select("id").eq(...).single() => resolves as "select"
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // Create board — .insert({...}).select("id").single() => resolves as "select" (select overrides insert)
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID });
    // 5 column inserts — .insert({...}) with no trailing .select() => resolves as "insert"
    for (let i = 0; i < 5; i++) {
      pushResult("kanban_columns", "insert", { id: `col-${i}` });
    }

    const result = await handleTool(sb as any, TEST_USER_ID, "create_board", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.name).toBe("Tasks"); // default name
    expect(parsed.status).toBe("created");
    expect(parsed.columns).toEqual(["To Do", "In Progress", "In Review", "Done", "Cancelled"]);
  });

  it("creates a board with a custom name", async () => {
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // .insert({...}).select("id").single() => resolves as "select"
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID });
    for (let i = 0; i < 5; i++) {
      pushResult("kanban_columns", "insert", { id: `col-${i}` });
    }

    const result = await handleTool(sb as any, TEST_USER_ID, "create_board", {
      project_id: TEST_PROJECT_ID,
      name: "Sprint 42",
    });
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe("Sprint 42");
  });

  it("throws when project does not exist", async () => {
    pushError("projects", "select", "not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_board", { project_id: "nonexistent" })
    ).rejects.toThrow("Project not found");
  });

  it("throws when board creation fails", async () => {
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // .insert({...}).select("id").single() => resolves as "select"
    pushError("kanban_boards", "select", "Duplicate board name");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_board", { project_id: TEST_PROJECT_ID })
    ).rejects.toThrow("Duplicate board name");
  });

  it("throws when column creation fails", async () => {
    pushResult("projects", "select", { id: TEST_PROJECT_ID });
    // .insert({...}).select("id").single() => resolves as "select"
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID });
    // First column insert fails — .insert({...}) with no .select() => resolves as "insert"
    pushResult("kanban_columns", "insert", null, { message: "Column error" });

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_board", { project_id: TEST_PROJECT_ID })
    ).rejects.toThrow("Failed to create column 'To Do': Column error");
  });
});
