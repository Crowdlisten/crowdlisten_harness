import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectExecutor } from "../../src/tools.js";

describe("detectExecutor", () => {
  // Save original env and restore after each test
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all agent-related env vars
    delete process.env.OPENCLAW_SESSION;
    delete process.env.OPENCLAW_AGENT;
    delete process.env.CLAUDE_CODE;
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.CURSOR_SESSION_ID;
    delete process.env.CURSOR_TRACE_ID;
    delete process.env.CODEX_SESSION_ID;
    delete process.env.GEMINI_CLI;
    delete process.env.AMP_SESSION_ID;
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("detects OPENCLAW via OPENCLAW_SESSION", () => {
    process.env.OPENCLAW_SESSION = "abc123";
    expect(detectExecutor()).toBe("OPENCLAW");
  });

  it("detects OPENCLAW via OPENCLAW_AGENT", () => {
    process.env.OPENCLAW_AGENT = "agent-1";
    expect(detectExecutor()).toBe("OPENCLAW");
  });

  it("detects CLAUDE_CODE via CLAUDE_CODE=1", () => {
    process.env.CLAUDE_CODE = "1";
    expect(detectExecutor()).toBe("CLAUDE_CODE");
  });

  it("detects CLAUDE_CODE via CLAUDE_SESSION_ID", () => {
    process.env.CLAUDE_SESSION_ID = "sess-123";
    expect(detectExecutor()).toBe("CLAUDE_CODE");
  });

  it("detects CURSOR via CURSOR_SESSION_ID", () => {
    process.env.CURSOR_SESSION_ID = "cursor-sess";
    expect(detectExecutor()).toBe("CURSOR");
  });

  it("detects CURSOR via CURSOR_TRACE_ID", () => {
    process.env.CURSOR_TRACE_ID = "trace-123";
    expect(detectExecutor()).toBe("CURSOR");
  });

  it("detects CODEX via CODEX_SESSION_ID", () => {
    process.env.CODEX_SESSION_ID = "codex-sess";
    expect(detectExecutor()).toBe("CODEX");
  });

  it("detects GEMINI via GEMINI_CLI", () => {
    process.env.GEMINI_CLI = "true";
    expect(detectExecutor()).toBe("GEMINI");
  });

  it("detects AMP via AMP_SESSION_ID", () => {
    process.env.AMP_SESSION_ID = "amp-sess";
    expect(detectExecutor()).toBe("AMP");
  });

  it("returns UNKNOWN when no agent env vars are set", () => {
    expect(detectExecutor()).toBe("UNKNOWN");
  });

  it("prioritizes OPENCLAW over CLAUDE_CODE when both are set", () => {
    process.env.OPENCLAW_SESSION = "oc-sess";
    process.env.CLAUDE_CODE = "1";
    expect(detectExecutor()).toBe("OPENCLAW");
  });

  it("prioritizes CLAUDE_CODE over CURSOR when both are set", () => {
    process.env.CLAUDE_CODE = "1";
    process.env.CURSOR_SESSION_ID = "cursor-sess";
    expect(detectExecutor()).toBe("CLAUDE_CODE");
  });
});
