import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import {
  TEST_USER_ID,
  TEST_PROJECT_ID,
} from "../helpers/fixtures.js";

describe("save → Supabase memories", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let calls: ReturnType<typeof createSb>["calls"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    calls = mock.calls;
  });

  it("writes to memories table in Supabase", async () => {
    pushResult("memories", "select", { id: "mem-001" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Always use UTC timestamps",
      content: "Store all dates as UTC to avoid timezone bugs",
      tags: ["pattern"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(true);
    expect(parsed.id).toBe("mem-001");

    const memoryCalls = calls.filter(c => c.table === "memories");
    expect(memoryCalls.length).toBeGreaterThan(0);
  });

  it("supports optional project_id and task_id", async () => {
    pushResult("memories", "select", { id: "mem-002" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Use dark mode",
      content: "User prefers dark mode for all UIs",
      tags: ["preference"],
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(true);
  });

  it("falls back to local store on Supabase error", async () => {
    pushResult("memories", "select", null, { message: "RLS policy violation" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Fallback test",
      content: "Should fall back to local JSON",
      tags: ["insight"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(false);
  });

  it("rejects missing required params", async () => {
    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "",
      content: "Missing title",
    });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBeTruthy();
  });

  it("dual-writes to project_insights for knowledge tags with project_id", async () => {
    pushResult("memories", "select", { id: "mem-003" });
    pushResult("project_insights", "insert", { id: "insight-001" });

    await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Use PostgreSQL",
      content: "Chose PostgreSQL for relational data needs",
      tags: ["decision"],
      project_id: TEST_PROJECT_ID,
    });

    const insightCalls = calls.filter(c => c.table === "project_insights");
    expect(insightCalls.length).toBeGreaterThan(0);
  });

  it("does NOT dual-write to project_insights without project_id", async () => {
    pushResult("memories", "select", { id: "mem-004" });

    await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Use PostgreSQL",
      content: "Chose PostgreSQL for relational data needs",
      tags: ["decision"],
    });

    const insightCalls = calls.filter(c => c.table === "project_insights");
    expect(insightCalls).toHaveLength(0);
  });

  it("does NOT dual-write for non-knowledge tags", async () => {
    pushResult("memories", "select", { id: "mem-005" });

    await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Budget limit",
      content: "Must stay under $500/mo",
      tags: ["constraint"],
      project_id: TEST_PROJECT_ID,
    });

    const insightCalls = calls.filter(c => c.table === "project_insights");
    expect(insightCalls).toHaveLength(0);
  });
});

describe("recall → Supabase memories", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let calls: ReturnType<typeof createSb>["calls"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    calls = mock.calls;
  });

  it("reads from Supabase memories table", async () => {
    pushResult("memories", "select", [
      { id: "m1", title: "UTC timestamps", content: "Always use UTC", tags: ["pattern"] },
      { id: "m2", title: "Users prefer dark mode", content: "80% use dark mode", tags: ["insight"] },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {});
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    expect(parsed.count).toBe(2);
    expect(parsed.memories).toHaveLength(2);
  });

  it("filters by tags", async () => {
    pushResult("memories", "select", [
      { id: "m1", title: "UTC timestamps", content: "Always use UTC", tags: ["pattern"] },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      tags: ["pattern"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    expect(parsed.memories).toHaveLength(1);
  });

  it("filters by project_id", async () => {
    pushResult("memories", "select", [
      { id: "m1", title: "Project-specific", content: "Scoped memory", tags: [] },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    const memoryCalls = calls.filter(c => c.table === "memories");
    expect(memoryCalls.length).toBeGreaterThan(0);
  });

  it("falls back to local on Supabase error", async () => {
    pushResult("memories", "select", null, { message: "connection error" });

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {});
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("local");
  });
});
