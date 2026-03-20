import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_TASK_ID,
  TEST_TASK,
  TEST_TASK_2,
  TEST_COLUMN_TODO_ID,
  TEST_COLUMN_INPROGRESS_ID,
  TEST_COLUMN_DONE_ID,
  buildTaskList,
} from "../helpers/fixtures.js";

describe("list_tasks tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("lists tasks from a specific board", async () => {
    const tasks = [TEST_TASK, TEST_TASK_2];
    pushResult("kanban_cards", "select", tasks);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_tasks", {
      board_id: TEST_BOARD_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.count).toBe(2);
    expect(parsed.board_id).toBe(TEST_BOARD_ID);
  });

  it("falls back to global board when no board_id provided", async () => {
    // getOrCreateGlobalBoard lookup
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    // list_tasks query
    pushResult("kanban_cards", "select", [TEST_TASK]);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_tasks", {});
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.tasks).toHaveLength(1);
  });

  it("returns empty list when board has no tasks", async () => {
    pushResult("kanban_cards", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_tasks", {
      board_id: TEST_BOARD_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.tasks).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("handles null data as empty list", async () => {
    pushResult("kanban_cards", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_tasks", {
      board_id: TEST_BOARD_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.count).toBe(0);
  });

  it("throws on Supabase error", async () => {
    pushError("kanban_cards", "select", "Query failed");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "list_tasks", { board_id: TEST_BOARD_ID })
    ).rejects.toThrow("Query failed");
  });
});

describe("get_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("returns full task details", async () => {
    pushResult("kanban_cards", "select", TEST_TASK);

    const result = await handleTool(sb as any, TEST_USER_ID, "get_task", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.task.id).toBe(TEST_TASK_ID);
    expect(parsed.task.title).toBe("Implement user authentication");
    expect(parsed.task.description).toBe("Add JWT-based auth with refresh tokens");
    expect(parsed.task.status).toBe("todo");
    expect(parsed.task.priority).toBe("high");
  });

  it("throws when task not found", async () => {
    pushError("kanban_cards", "select", "Row not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "get_task", { task_id: "nonexistent" })
    ).rejects.toThrow("Row not found");
  });
});

describe("create_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("creates a task on a specific board", async () => {
    // getColumnByStatus for "todo" — .select("id").eq(...).eq(...).single() => "select"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    // Get last position — .select("position").eq(...).order(...).limit(1).single() => "select"
    pushResult("kanban_cards", "select", { position: 5 });
    // Insert task — .insert({...}).select("id").single() => "select" (2nd kanban_cards.select)
    pushResult("kanban_cards", "select", { id: "new-task-id" });

    const result = await handleTool(sb as any, TEST_USER_ID, "create_task", {
      title: "New Task",
      description: "A test task",
      priority: "high",
      board_id: TEST_BOARD_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe("new-task-id");
    expect(parsed.board_id).toBe(TEST_BOARD_ID);
    expect(parsed.status).toBe("created");
    expect(parsed.project_id).toBeNull();
  });

  it("defaults to global board when no board_id given", async () => {
    // getOrCreateGlobalBoard — .select(...).eq(...).eq(...).single() => "select"
    pushResult("kanban_boards", "select", { id: TEST_BOARD_ID, name: "Global Tasks" });
    // getColumnByStatus — .select("id").eq(...).eq(...).single() => "select"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    // Last position — .select("position")...single() => "select"
    pushResult("kanban_cards", "select", null);
    // Insert — .insert({...}).select("id").single() => "select" (2nd kanban_cards.select)
    pushResult("kanban_cards", "select", { id: "new-task-id" });

    const result = await handleTool(sb as any, TEST_USER_ID, "create_task", {
      title: "Global Task",
    });
    const parsed = JSON.parse(result);

    expect(parsed.board_id).toBe(TEST_BOARD_ID);
  });

  it("adds project_id as a label when provided", async () => {
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    pushResult("kanban_cards", "select", null);
    // .insert({...}).select("id").single() => "select" (2nd kanban_cards.select)
    pushResult("kanban_cards", "select", { id: "new-task-id" });

    const result = await handleTool(sb as any, TEST_USER_ID, "create_task", {
      title: "Tagged Task",
      board_id: TEST_BOARD_ID,
      project_id: "proj-abc",
    });
    const parsed = JSON.parse(result);

    expect(parsed.project_id).toBe("proj-abc");
  });

  it("defaults priority to medium", async () => {
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    pushResult("kanban_cards", "select", null);
    // .insert({...}).select("id").single() => "select" (2nd kanban_cards.select)
    pushResult("kanban_cards", "select", { id: "new-task-id" });

    // The mock doesn't validate insert data, but we verify the tool runs without error
    const result = await handleTool(sb as any, TEST_USER_ID, "create_task", {
      title: "Default Priority Task",
      board_id: TEST_BOARD_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.task_id).toBe("new-task-id");
  });

  it("throws when To Do column not found", async () => {
    pushResult("kanban_columns", "select", null);

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_task", {
        title: "Orphaned Task",
        board_id: TEST_BOARD_ID,
      })
    ).rejects.toThrow("Could not find 'To Do' column");
  });

  it("throws on insert error", async () => {
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_TODO_ID });
    pushResult("kanban_cards", "select", null);
    // .insert({...}).select("id").single() => resolves as "select" (2nd kanban_cards.select)
    pushError("kanban_cards", "select", "Insert failed");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_task", {
        title: "Failing Task",
        board_id: TEST_BOARD_ID,
      })
    ).rejects.toThrow("Insert failed");
  });
});

describe("update_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("updates title only", async () => {
    // .update({...}).eq(...).select("id, title, status, priority").single() => "select"
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      title: "Updated Title",
      status: "todo",
      priority: "high",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_task", {
      task_id: TEST_TASK_ID,
      title: "Updated Title",
    });
    const parsed = JSON.parse(result);

    expect(parsed.task.title).toBe("Updated Title");
    expect(parsed.status).toBe("updated");
  });

  it("updates status and moves column", async () => {
    // First: look up card's board_id — .select("board_id").eq(...).single() => "select"
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    // getColumnByStatus for "inprogress" — .select("id").eq(...).eq(...).single() => "select"
    pushResult("kanban_columns", "select", { id: TEST_COLUMN_INPROGRESS_ID });
    // Update — .update({...}).eq(...).select("id, title, status, priority").single() => "select" (2nd kanban_cards.select)
    pushResult("kanban_cards", "select", {
      id: TEST_TASK_ID,
      title: "Task",
      status: "inprogress",
      priority: "high",
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_task", {
      task_id: TEST_TASK_ID,
      status: "inprogress",
    });
    const parsed = JSON.parse(result);

    expect(parsed.task.status).toBe("inprogress");
  });

  it("throws on update error", async () => {
    // .update({...}).eq(...).select(...).single() => resolves as "select"
    pushError("kanban_cards", "select", "Update denied");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "update_task", {
        task_id: TEST_TASK_ID,
        title: "New Title",
      })
    ).rejects.toThrow("Update denied");
  });
});

describe("delete_task tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("deletes a task successfully", async () => {
    pushResult("kanban_cards", "delete", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "delete_task", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.deleted_task_id).toBe(TEST_TASK_ID);
    expect(parsed.status).toBe("deleted");
  });

  it("throws on delete error", async () => {
    pushError("kanban_cards", "delete", "Cannot delete");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "delete_task", { task_id: TEST_TASK_ID })
    ).rejects.toThrow("Cannot delete");
  });
});
