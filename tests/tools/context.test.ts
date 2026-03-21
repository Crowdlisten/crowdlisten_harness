import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_PROJECT_ID,
  TEST_TASK_ID,
  TEST_CONTEXT_ID,
  TEST_CONTEXT_ENTRY,
} from "../helpers/fixtures.js";

describe("query_context tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
  });

  it("returns context entries for a project", async () => {
    pushResult("planning_context", "select", [TEST_CONTEXT_ENTRY]);

    const result = await handleTool(sb as any, TEST_USER_ID, "query_context", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].type).toBe("decision");
    expect(parsed.count).toBe(1);
  });

  it("returns empty when no entries match", async () => {
    pushResult("planning_context", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "query_context", {
      project_id: TEST_PROJECT_ID,
      type: "principle",
    });
    const parsed = JSON.parse(result);

    expect(parsed.entries).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("supports full-text search", async () => {
    pushResult("planning_context", "select", [TEST_CONTEXT_ENTRY]);

    const result = await handleTool(sb as any, TEST_USER_ID, "query_context", {
      search: "JWT auth",
    });
    const parsed = JSON.parse(result);

    expect(parsed.entries).toHaveLength(1);
  });

  it("supports tag filtering", async () => {
    pushResult("planning_context", "select", [TEST_CONTEXT_ENTRY]);

    const result = await handleTool(sb as any, TEST_USER_ID, "query_context", {
      tags: ["auth"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.entries).toHaveLength(1);
  });
});

describe("add_context tool", () => {
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

  it("adds a decision context entry", async () => {
    pushResult("planning_context", "select", { id: TEST_CONTEXT_ID, status: "active" });

    const result = await handleTool(sb as any, TEST_USER_ID, "add_context", {
      type: "decision",
      title: "Use JWT for auth",
      body: "Chose JWT over session cookies for stateless API",
      project_id: TEST_PROJECT_ID,
      tags: ["auth", "architecture"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.context_id).toBe(TEST_CONTEXT_ID);
    expect(parsed.status).toBe("active");
  });

  it("handles supersession", async () => {
    const oldId = "old-ctx-0000";
    // Update old entry
    pushResult("planning_context", "update", null);
    // Insert new entry
    pushResult("planning_context", "select", { id: TEST_CONTEXT_ID, status: "active" });
    // Link superseded_by on old entry
    pushResult("planning_context", "update", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "add_context", {
      type: "pattern",
      title: "Updated API pattern",
      body: "All routes now use /api/v2/{resource}",
      supersedes: oldId,
    });
    const parsed = JSON.parse(result);

    expect(parsed.context_id).toBe(TEST_CONTEXT_ID);
  });

  it("rejects invalid context types", async () => {
    await expect(
      handleTool(sb as any, TEST_USER_ID, "add_context", {
        type: "invalid_type",
        title: "Test",
        body: "Test",
      })
    ).rejects.toThrow("Invalid type");
  });

  it("adds a principle entry", async () => {
    pushResult("planning_context", "select", { id: TEST_CONTEXT_ID, status: "active" });

    const result = await handleTool(sb as any, TEST_USER_ID, "add_context", {
      type: "principle",
      title: "Never store PII in logs",
      body: "All logging must redact PII fields before writing",
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.context_id).toBe(TEST_CONTEXT_ID);
    expect(parsed.status).toBe("active");
  });
});
