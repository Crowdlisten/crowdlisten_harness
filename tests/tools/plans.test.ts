import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_TASK_ID,
  TEST_PROJECT_ID,
  TEST_PLAN_ID,
  TEST_PLAN,
} from "../helpers/fixtures.js";

describe("create_plan tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  const originalEnv = { ...process.env };

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_SESSION_ID;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("creates a draft plan for a task", async () => {
    // Look up card → board → project
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    pushResult("kanban_boards", "select", { project_id: TEST_PROJECT_ID });
    // Insert plan → select
    pushResult("planning_context", "select", { id: TEST_PLAN_ID, status: "draft", version: 1 });

    const result = await handleTool(sb as any, TEST_USER_ID, "create_plan", {
      task_id: TEST_TASK_ID,
      approach: "JWT + refresh tokens",
      assumptions: ["Server-side validation preferred"],
      success_criteria: ["All tests pass"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.plan_id).toBe(TEST_PLAN_ID);
    expect(parsed.status).toBe("draft");
    expect(parsed.version).toBe(1);
  });

  it("creates a plan even if project lookup fails", async () => {
    // Card lookup fails
    pushResult("kanban_cards", "select", null);
    // Insert plan → select
    pushResult("planning_context", "select", { id: TEST_PLAN_ID, status: "draft", version: 1 });

    const result = await handleTool(sb as any, TEST_USER_ID, "create_plan", {
      task_id: TEST_TASK_ID,
      approach: "Simple approach",
    });
    const parsed = JSON.parse(result);

    expect(parsed.plan_id).toBe(TEST_PLAN_ID);
    expect(parsed.status).toBe("draft");
  });
});

describe("get_plan tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("returns the active plan and version history", async () => {
    pushResult("planning_context", "select", TEST_PLAN);
    pushResult("planning_context_versions", "select", [
      { version: 1, title: "v1", body: "old approach", metadata: {}, status: "draft", feedback: null, created_at: "2026-01-15T14:00:00Z" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "get_plan", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.plan).toBeTruthy();
    expect(parsed.plan.id).toBe(TEST_PLAN_ID);
    expect(parsed.versions).toHaveLength(1);
  });

  it("returns null plan when none exists", async () => {
    pushResult("planning_context", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "get_plan", {
      task_id: TEST_TASK_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.plan).toBeNull();
    expect(parsed.message).toContain("No active plan");
  });
});

describe("update_plan tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("archives version and updates approach", async () => {
    // Get current plan
    pushResult("planning_context", "select", {
      id: TEST_PLAN_ID,
      title: "Plan: old approach",
      body: "old approach",
      metadata: { assumptions: ["old"] },
      status: "draft",
      version: 1,
    });
    // Insert version archive
    pushResult("planning_context_versions", "insert", null);
    // Update plan → select
    pushResult("planning_context", "select", { id: TEST_PLAN_ID, status: "draft", version: 2 });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_plan", {
      plan_id: TEST_PLAN_ID,
      approach: "New approach with 2FA",
    });
    const parsed = JSON.parse(result);

    expect(parsed.plan_id).toBe(TEST_PLAN_ID);
    expect(parsed.version).toBe(2);
  });

  it("reverts to draft when feedback is given", async () => {
    pushResult("planning_context", "select", {
      id: TEST_PLAN_ID,
      title: "Plan: approach",
      body: "approach",
      metadata: {},
      status: "review",
      version: 2,
    });
    pushResult("planning_context_versions", "insert", null);
    pushResult("planning_context", "select", { id: TEST_PLAN_ID, status: "draft", version: 3 });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_plan", {
      plan_id: TEST_PLAN_ID,
      feedback: "Also handle 2FA",
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("draft");
    expect(parsed.version).toBe(3);
  });

  it("updates status only without archiving", async () => {
    pushResult("planning_context", "select", {
      id: TEST_PLAN_ID,
      title: "Plan: approach",
      body: "approach",
      metadata: {},
      status: "draft",
      version: 1,
    });
    // No version insert (no content change)
    pushResult("planning_context", "select", { id: TEST_PLAN_ID, status: "approved", version: 1 });

    const result = await handleTool(sb as any, TEST_USER_ID, "update_plan", {
      plan_id: TEST_PLAN_ID,
      status: "approved",
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("approved");
    expect(parsed.version).toBe(1);
  });

  it("throws when plan not found", async () => {
    pushError("planning_context", "select", "Plan not found");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "update_plan", {
        plan_id: "nonexistent",
        approach: "anything",
      })
    ).rejects.toThrow("Plan not found");
  });
});
