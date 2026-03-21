import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_BOARD_ID,
  TEST_TASK_ID,
  TEST_PROJECT_ID,
  TEST_LEARNING_ID,
  TEST_PROMOTED_ID,
} from "../helpers/fixtures.js";

describe("record_learning tool", () => {
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

  it("records a task-scoped learning", async () => {
    // Look up card → board → project
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    pushResult("kanban_boards", "select", { project_id: TEST_PROJECT_ID });
    // Insert learning → select
    pushResult("planning_context", "select", { id: TEST_LEARNING_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "record_learning", {
      task_id: TEST_TASK_ID,
      title: "TOTP library X was 3x faster than Y",
      body: "Benchmarked totp-generator vs otpauth. totp-generator averaged 0.3ms per code vs 0.9ms.",
      learning_type: "optimization",
      tags: ["auth", "performance"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.learning_id).toBe(TEST_LEARNING_ID);
    expect(parsed.promoted_id).toBeNull();
  });

  it("promotes learning to project scope", async () => {
    // Look up card → board → project
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    pushResult("kanban_boards", "select", { project_id: TEST_PROJECT_ID });
    // Insert task-scoped learning → select
    pushResult("planning_context", "select", { id: TEST_LEARNING_ID });
    // Insert promoted copy → select
    pushResult("planning_context", "select", { id: TEST_PROMOTED_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "record_learning", {
      task_id: TEST_TASK_ID,
      title: "Redis caching reduced latency 40%",
      body: "Adding Redis cache layer to the search endpoint reduced p95 from 800ms to 480ms.",
      promote: true,
    });
    const parsed = JSON.parse(result);

    expect(parsed.learning_id).toBe(TEST_LEARNING_ID);
    expect(parsed.promoted_id).toBe(TEST_PROMOTED_ID);
  });

  it("records learning even if project lookup fails", async () => {
    // Card lookup returns null
    pushResult("kanban_cards", "select", null);
    // Insert learning → select
    pushResult("planning_context", "select", { id: TEST_LEARNING_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "record_learning", {
      task_id: TEST_TASK_ID,
      title: "Simple learning",
      body: "Just a note",
    });
    const parsed = JSON.parse(result);

    expect(parsed.learning_id).toBe(TEST_LEARNING_ID);
    expect(parsed.promoted_id).toBeNull();
  });

  it("does not promote when no project_id found", async () => {
    // Card lookup returns board without project
    pushResult("kanban_cards", "select", { board_id: TEST_BOARD_ID });
    pushResult("kanban_boards", "select", { project_id: null });
    // Insert learning → select
    pushResult("planning_context", "select", { id: TEST_LEARNING_ID });

    const result = await handleTool(sb as any, TEST_USER_ID, "record_learning", {
      task_id: TEST_TASK_ID,
      title: "Learning without project",
      body: "Cannot promote without project scope",
      promote: true,
    });
    const parsed = JSON.parse(result);

    expect(parsed.learning_id).toBe(TEST_LEARNING_ID);
    expect(parsed.promoted_id).toBeNull();
  });
});
