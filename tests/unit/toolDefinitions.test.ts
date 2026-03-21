import { describe, it, expect } from "vitest";
import { TOOLS } from "../../src/tools.js";

describe("TOOLS definitions", () => {
  it("defines exactly 22 tools", () => {
    expect(TOOLS).toHaveLength(22);
  });

  it("each tool has a name, description, and inputSchema", () => {
    for (const tool of TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("has no duplicate tool names", () => {
    const names = TOOLS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  const expectedTools = [
    "get_or_create_global_board",
    "list_projects",
    "list_boards",
    "create_board",
    "list_tasks",
    "get_task",
    "create_task",
    "update_task",
    "claim_task",
    "complete_task",
    "log_progress",
    "delete_task",
    "migrate_to_global_board",
    "start_session",
    "list_sessions",
    "update_session",
    "create_plan",
    "get_plan",
    "update_plan",
    "query_context",
    "add_context",
    "record_learning",
  ];

  for (const toolName of expectedTools) {
    it(`includes the "${toolName}" tool`, () => {
      const found = TOOLS.find((t) => t.name === toolName);
      expect(found).toBeDefined();
    });
  }

  describe("required fields validation", () => {
    it("create_task requires title", () => {
      const tool = TOOLS.find((t) => t.name === "create_task")!;
      expect(tool.inputSchema.required).toContain("title");
    });

    it("update_task requires task_id", () => {
      const tool = TOOLS.find((t) => t.name === "update_task")!;
      expect(tool.inputSchema.required).toContain("task_id");
    });

    it("claim_task requires task_id", () => {
      const tool = TOOLS.find((t) => t.name === "claim_task")!;
      expect(tool.inputSchema.required).toContain("task_id");
    });

    it("complete_task requires task_id", () => {
      const tool = TOOLS.find((t) => t.name === "complete_task")!;
      expect(tool.inputSchema.required).toContain("task_id");
    });

    it("log_progress requires task_id and message", () => {
      const tool = TOOLS.find((t) => t.name === "log_progress")!;
      expect(tool.inputSchema.required).toContain("task_id");
      expect(tool.inputSchema.required).toContain("message");
    });

    it("delete_task requires task_id", () => {
      const tool = TOOLS.find((t) => t.name === "delete_task")!;
      expect(tool.inputSchema.required).toContain("task_id");
    });

    it("list_boards requires project_id", () => {
      const tool = TOOLS.find((t) => t.name === "list_boards")!;
      expect(tool.inputSchema.required).toContain("project_id");
    });

    it("create_board requires project_id", () => {
      const tool = TOOLS.find((t) => t.name === "create_board")!;
      expect(tool.inputSchema.required).toContain("project_id");
    });

    it("start_session requires task_id and focus", () => {
      const tool = TOOLS.find((t) => t.name === "start_session")!;
      expect(tool.inputSchema.required).toContain("task_id");
      expect(tool.inputSchema.required).toContain("focus");
    });

    it("update_session requires session_id", () => {
      const tool = TOOLS.find((t) => t.name === "update_session")!;
      expect(tool.inputSchema.required).toContain("session_id");
    });

    it("get_or_create_global_board has no required fields", () => {
      const tool = TOOLS.find((t) => t.name === "get_or_create_global_board")!;
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it("list_projects has no required fields", () => {
      const tool = TOOLS.find((t) => t.name === "list_projects")!;
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it("list_tasks has no required fields (board_id is optional)", () => {
      const tool = TOOLS.find((t) => t.name === "list_tasks")!;
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it("create_plan requires task_id and approach", () => {
      const tool = TOOLS.find((t) => t.name === "create_plan")!;
      expect(tool.inputSchema.required).toContain("task_id");
      expect(tool.inputSchema.required).toContain("approach");
    });

    it("get_plan requires task_id", () => {
      const tool = TOOLS.find((t) => t.name === "get_plan")!;
      expect(tool.inputSchema.required).toContain("task_id");
    });

    it("update_plan requires plan_id", () => {
      const tool = TOOLS.find((t) => t.name === "update_plan")!;
      expect(tool.inputSchema.required).toContain("plan_id");
    });

    it("query_context has no required fields", () => {
      const tool = TOOLS.find((t) => t.name === "query_context")!;
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it("add_context requires type, title, body", () => {
      const tool = TOOLS.find((t) => t.name === "add_context")!;
      expect(tool.inputSchema.required).toContain("type");
      expect(tool.inputSchema.required).toContain("title");
      expect(tool.inputSchema.required).toContain("body");
    });

    it("record_learning requires task_id, title, body", () => {
      const tool = TOOLS.find((t) => t.name === "record_learning")!;
      expect(tool.inputSchema.required).toContain("task_id");
      expect(tool.inputSchema.required).toContain("title");
      expect(tool.inputSchema.required).toContain("body");
    });
  });
});
