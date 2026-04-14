/**
 * Knowledge Base (save/recall) tests.
 *
 * Tests the save → pages table → recall round-trip using the current
 * `pages`-based knowledge system (not the legacy `memories` table).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_USER_ID, TEST_PROJECT_ID } from "../helpers/fixtures.js";

// ─── save (default path → pages table) ─────────────────────────────────────

describe("save → pages table", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let calls: ReturnType<typeof createSb>["calls"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    calls = mock.calls;
  });

  it("inserts a new page when no existing page found", async () => {
    // First query: check for existing page via .select().maybeSingle() → not found
    pushResult("pages", "select", null);
    // Second query: .insert({...}).select("id").single() — the .select() after
    // .insert() resets the mock action to "select", so we push to pages.select
    pushResult("pages", "select", { id: "page-001" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Varonis Competitor Analysis",
      content: "Varonis is a cybersecurity company focused on data protection",
      tags: ["competitor", "cybersecurity"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(true);
    expect(parsed.id).toBe("page-001");
    expect(parsed.path).toContain("notes/");
    expect(parsed.title).toBe("Varonis Competitor Analysis");

    // Verify pages table was used
    const pageCalls = calls.filter((c) => c.table === "pages");
    expect(pageCalls.length).toBeGreaterThanOrEqual(2); // select + insert
  });

  it("updates an existing page when path matches", async () => {
    // First query: check for existing page → found
    pushResult("pages", "select", { id: "page-existing" });
    // Second query: update
    pushResult("pages", "update", { id: "page-existing" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Updated Analysis",
      content: "Updated content with new findings",
      tags: ["research"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(true);
    expect(parsed.id).toBe("page-existing");
  });

  it("uses project slug in path when project_id provided", async () => {
    // Project lookup
    pushResult("projects", "select", { name: "Varonis Research" });
    // Existing page check
    pushResult("pages", "select", null);
    // Insert new page
    pushResult("pages", "insert", { id: "page-proj" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Data Security Trends",
      content: "Key trends in data security market",
      tags: ["research"],
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.path).toContain("projects/");
  });

  it("rejects missing required params", async () => {
    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "",
      content: "Missing title should fail",
    });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBeTruthy();
  });

  it("rejects when content is missing", async () => {
    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Has title",
      content: "",
    });
    const parsed = JSON.parse(result);

    expect(parsed.error).toBeTruthy();
  });

  it("falls back to local store on Supabase error", async () => {
    // Existing check fails
    pushResult("pages", "select", null, { message: "connection error" });

    const result = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Fallback Test",
      content: "Should fall back to local store",
      tags: ["test"],
    });
    const parsed = JSON.parse(result);

    expect(parsed.saved).toBe(true);
    expect(parsed.supabase).toBe(false);
  });
});

// ─── recall (default path → pages table keyword search) ─────────────────────

describe("recall → pages table", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let calls: ReturnType<typeof createSb>["calls"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    calls = mock.calls;
  });

  it("returns recent pages when no search query", async () => {
    pushResult("pages", "select", [
      { id: "p1", path: "notes/analysis", title: "Analysis", content: "Test content", tags: [], updated_at: "2026-04-01" },
      { id: "p2", path: "notes/research", title: "Research", content: "More content", tags: [], updated_at: "2026-04-02" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {});
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    expect(parsed.count).toBe(2);
    expect(parsed.pages).toHaveLength(2);
  });

  it("performs keyword search on title + content", async () => {
    // Title matches
    pushResult("pages", "select", [
      { id: "p1", path: "notes/varonis", title: "Varonis Analysis", content: "Detailed analysis", tags: ["competitor"], updated_at: "2026-04-01" },
    ]);
    // Content matches (deduped)
    pushResult("pages", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      query: "Varonis",
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    expect(parsed.count).toBe(1);
    expect(parsed.pages[0].title).toBe("Varonis Analysis");
  });

  it("returns empty result gracefully", async () => {
    pushResult("pages", "select", []);
    pushResult("pages", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      query: "nonexistent-topic",
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    expect(parsed.count).toBe(0);
    expect(parsed.pages).toHaveLength(0);
  });

  it("respects limit parameter", async () => {
    pushResult("pages", "select", [
      { id: "p1", title: "Page 1", content: "Content 1", tags: [], updated_at: "2026-04-01" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      limit: 5,
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    // Verify limit was passed to query
    const limitCalls = calls.filter((c) => c.method === "limit");
    expect(limitCalls.some((c) => c.args[0] === 5)).toBe(true);
  });

  it("truncates long content to 500 chars", async () => {
    const longContent = "A".repeat(1000);
    pushResult("pages", "select", [
      { id: "p1", title: "Long Page", content: longContent, tags: [], updated_at: "2026-04-01" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {});
    const parsed = JSON.parse(result);

    expect(parsed.pages[0].content.length).toBeLessThanOrEqual(503); // 500 + "..."
    expect(parsed.pages[0].content).toContain("...");
  });

  it("filters by project_id", async () => {
    pushResult("pages", "select", [
      { id: "p1", title: "Project Page", content: "Scoped", tags: [], project_id: TEST_PROJECT_ID, updated_at: "2026-04-01" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      project_id: TEST_PROJECT_ID,
    });
    const parsed = JSON.parse(result);

    expect(parsed.search_mode).toBe("keyword");
    // Verify project_id filter was applied
    const eqCalls = calls.filter((c) => c.method === "eq" && c.args[0] === "project_id");
    expect(eqCalls.length).toBeGreaterThan(0);
  });

  it("routes path-based recall to wiki_read", async () => {
    pushResult("pages", "select", {
      id: "p1",
      path: "notes/test",
      title: "Test",
      content: "Test content",
      tags: [],
    });

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      path: "notes/test",
    });
    const parsed = JSON.parse(result);

    // Should route to wiki_read which queries pages by path
    const pageCalls = calls.filter((c) => c.table === "pages");
    expect(pageCalls.length).toBeGreaterThan(0);
  });

  it("routes list recall to wiki_list", async () => {
    pushResult("pages", "select", [
      { id: "p1", path: "notes/a", title: "A" },
      { id: "p2", path: "notes/b", title: "B" },
    ]);

    const result = await handleTool(sb as any, TEST_USER_ID, "recall", {
      list: true,
    });
    const parsed = JSON.parse(result);

    // Should return page list
    const pageCalls = calls.filter((c) => c.table === "pages");
    expect(pageCalls.length).toBeGreaterThan(0);
  });
});

// ─── save + recall round-trip ───────────────────────────────────────────────

describe("save + recall round-trip", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let calls: ReturnType<typeof createSb>["calls"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    calls = mock.calls;
  });

  it("save then recall by keyword returns saved content", async () => {
    // save: existing check → not found
    pushResult("pages", "select", null);
    // save: insert
    pushResult("pages", "insert", { id: "round-trip-001" });

    const saveResult = await handleTool(sb as any, TEST_USER_ID, "save", {
      title: "Varonis Competitive Intel",
      content: "Varonis has 45% market share in DSPM category",
      tags: ["competitor", "market-share"],
    });
    const savedParsed = JSON.parse(saveResult);
    expect(savedParsed.saved).toBe(true);

    // recall: title match
    pushResult("pages", "select", [
      {
        id: "round-trip-001",
        path: "notes/varonis-competitive-intel",
        title: "Varonis Competitive Intel",
        content: "Varonis has 45% market share in DSPM category",
        tags: ["competitor", "market-share"],
        updated_at: "2026-04-14",
      },
    ]);
    // recall: content match (empty, already found in title)
    pushResult("pages", "select", []);

    const recallResult = await handleTool(sb as any, TEST_USER_ID, "recall", {
      query: "Varonis",
    });
    const recallParsed = JSON.parse(recallResult);

    expect(recallParsed.search_mode).toBe("keyword");
    expect(recallParsed.count).toBe(1);
    expect(recallParsed.pages[0].title).toBe("Varonis Competitive Intel");
  });
});
