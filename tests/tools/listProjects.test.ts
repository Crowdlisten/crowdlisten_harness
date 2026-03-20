import { describe, it, expect, beforeEach } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_USER_ID, TEST_PROJECT } from "../helpers/fixtures.js";

describe("list_projects tool", () => {
  let sb: ReturnType<typeof createSb>["sb"];
  let pushResult: ReturnType<typeof createSb>["pushResult"];
  let pushError: ReturnType<typeof createSb>["pushError"];

  beforeEach(() => {
    const mock = createSb();
    sb = mock.sb;
    pushResult = mock.pushResult;
    pushError = mock.pushError;
  });

  it("returns a list of projects", async () => {
    const projects = [
      { id: "proj-1", name: "Project Alpha", updated_at: "2026-01-15T10:00:00Z" },
      { id: "proj-2", name: "Project Beta", updated_at: "2026-01-14T10:00:00Z" },
    ];
    pushResult("projects", "select", projects);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_projects", {});
    const parsed = JSON.parse(result);

    expect(parsed.projects).toHaveLength(2);
    expect(parsed.count).toBe(2);
    expect(parsed.projects[0].id).toBe("proj-1");
    expect(parsed.projects[0].name).toBe("Project Alpha");
    // updated_at should be stripped (slim output)
    expect(parsed.projects[0].updated_at).toBeUndefined();
  });

  it("returns empty list when no projects exist", async () => {
    pushResult("projects", "select", []);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_projects", {});
    const parsed = JSON.parse(result);

    expect(parsed.projects).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("handles null data gracefully", async () => {
    pushResult("projects", "select", null);

    const result = await handleTool(sb as any, TEST_USER_ID, "list_projects", {});
    const parsed = JSON.parse(result);

    expect(parsed.projects).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });

  it("throws on Supabase error", async () => {
    pushError("projects", "select", "Permission denied");

    await expect(
      handleTool(sb as any, TEST_USER_ID, "list_projects", {})
    ).rejects.toThrow("Permission denied");
  });
});
