import { describe, it, expect } from "vitest";
import { STATUS_COLUMN } from "../../src/tools.js";

describe("STATUS_COLUMN mapping", () => {
  it("maps 'todo' to 'To Do'", () => {
    expect(STATUS_COLUMN.todo).toBe("To Do");
  });

  it("maps 'inprogress' to 'In Progress'", () => {
    expect(STATUS_COLUMN.inprogress).toBe("In Progress");
  });

  it("maps 'inreview' to 'In Review'", () => {
    expect(STATUS_COLUMN.inreview).toBe("In Review");
  });

  it("maps 'done' to 'Done'", () => {
    expect(STATUS_COLUMN.done).toBe("Done");
  });

  it("maps 'cancelled' to 'Cancelled'", () => {
    expect(STATUS_COLUMN.cancelled).toBe("Cancelled");
  });

  it("has exactly 5 status entries", () => {
    expect(Object.keys(STATUS_COLUMN)).toHaveLength(5);
  });

  it("returns undefined for unknown status keys", () => {
    expect(STATUS_COLUMN["nonexistent"]).toBeUndefined();
  });

  it("returns undefined for empty string status", () => {
    expect(STATUS_COLUMN[""]).toBeUndefined();
  });
});
