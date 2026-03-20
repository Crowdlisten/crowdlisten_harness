import { describe, it, expect } from "vitest";
import { json } from "../../src/tools.js";

describe("json", () => {
  it("serializes a simple object with 2-space indentation", () => {
    const result = json({ status: "ok" });
    expect(result).toBe('{\n  "status": "ok"\n}');
  });

  it("serializes nested objects", () => {
    const result = json({ task: { id: "1", title: "Test" } });
    const parsed = JSON.parse(result);
    expect(parsed.task.id).toBe("1");
    expect(parsed.task.title).toBe("Test");
  });

  it("serializes arrays", () => {
    const result = json({ items: [1, 2, 3] });
    const parsed = JSON.parse(result);
    expect(parsed.items).toEqual([1, 2, 3]);
  });

  it("serializes null values", () => {
    const result = json({ value: null });
    expect(JSON.parse(result).value).toBeNull();
  });

  it("serializes empty objects", () => {
    const result = json({});
    expect(result).toBe("{}");
  });

  it("serializes a string directly", () => {
    const result = json("hello");
    expect(result).toBe('"hello"');
  });

  it("serializes a number directly", () => {
    const result = json(42);
    expect(result).toBe("42");
  });

  it("produces valid JSON that can be round-tripped", () => {
    const original = {
      board_id: "abc-123",
      tasks: [{ id: "t1", title: "First" }],
      count: 1,
      metadata: null,
    };
    const serialized = json(original);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(original);
  });
});
