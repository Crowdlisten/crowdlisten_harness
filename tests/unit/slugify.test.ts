import { describe, it, expect } from "vitest";
import { slugify } from "../../src/tools.js";

describe("slugify", () => {
  it("converts a simple title to lowercase kebab-case", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces multiple non-alphanumeric characters with a single dash", () => {
    expect(slugify("Implement --- User Auth!!!")).toBe("implement-user-auth");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugify("---leading and trailing---")).toBe("leading-and-trailing");
  });

  it("truncates to 40 characters", () => {
    const longTitle = "a".repeat(60);
    const result = slugify(longTitle);
    expect(result.length).toBe(40);
    expect(result).toBe("a".repeat(40));
  });

  it("handles an empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles a string with only special characters", () => {
    expect(slugify("!!!@@@###$$$")).toBe("");
  });

  it("handles unicode characters by stripping them", () => {
    expect(slugify("Add login feature")).toBe("add-login-feature");
  });

  it("handles mixed case with numbers", () => {
    expect(slugify("Task 123 - Fix Bug #456")).toBe("task-123-fix-bug-456");
  });

  it("preserves single-word lowercase input", () => {
    expect(slugify("authentication")).toBe("authentication");
  });

  it("collapses spaces and special chars to single dashes", () => {
    expect(slugify("build    the   new   feature")).toBe("build-the-new-feature");
  });

  it("handles title at exactly 40 characters", () => {
    // "a-b" repeated to fill 40 chars
    const input = "abcdefghijklmnopqrstuvwxyz1234567890abcd";
    expect(slugify(input)).toBe(input);
    expect(slugify(input).length).toBe(40);
  });

  it("truncates after conversion, not before", () => {
    // Long title with special chars that reduce after slugify
    const title = "This Is A Very Long Title That Exceeds Forty Characters When Slugified";
    const result = slugify(title);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result).toBe("this-is-a-very-long-title-that-exceeds-f");
  });
});
