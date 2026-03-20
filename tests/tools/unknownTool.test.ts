import { describe, it, expect } from "vitest";
import { handleTool } from "../../src/tools.js";
import { createSb } from "../helpers/supabaseMock.js";
import { TEST_USER_ID } from "../helpers/fixtures.js";

describe("unknown tool handler", () => {
  it("throws for an unrecognized tool name", async () => {
    const { sb } = createSb();

    await expect(
      handleTool(sb as any, TEST_USER_ID, "nonexistent_tool", {})
    ).rejects.toThrow("Unknown tool: nonexistent_tool");
  });

  it("throws for empty tool name", async () => {
    const { sb } = createSb();

    await expect(
      handleTool(sb as any, TEST_USER_ID, "", {})
    ).rejects.toThrow("Unknown tool: ");
  });

  it("throws for a misspelled tool name", async () => {
    const { sb } = createSb();

    await expect(
      handleTool(sb as any, TEST_USER_ID, "create_tasks", {})
    ).rejects.toThrow("Unknown tool: create_tasks");
  });
});
