import { describe, it, expect } from "vitest";
import { callbackHtml } from "../../src/tools.js";

describe("callbackHtml", () => {
  describe("success page", () => {
    it("returns valid HTML with DOCTYPE", () => {
      const html = callbackHtml(true);
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("contains success heading", () => {
      const html = callbackHtml(true);
      expect(html).toContain("You're connected!");
    });

    it("contains instruction to close tab", () => {
      const html = callbackHtml(true);
      expect(html).toContain("close this tab");
    });

    it("sets CrowdListen as the page title", () => {
      const html = callbackHtml(true);
      expect(html).toContain("<title>CrowdListen</title>");
    });
  });

  describe("failure page", () => {
    it("returns valid HTML with DOCTYPE", () => {
      const html = callbackHtml(false);
      expect(html).toContain("<!DOCTYPE html>");
    });

    it("contains failure heading", () => {
      const html = callbackHtml(false);
      expect(html).toContain("Login failed");
    });

    it("shows custom error message when provided", () => {
      const html = callbackHtml(false, "Token expired");
      expect(html).toContain("Token expired");
    });

    it("shows default error message when no error provided", () => {
      const html = callbackHtml(false);
      expect(html).toContain("Something went wrong. Please try again.");
    });

    it("sets CrowdListen as the page title", () => {
      const html = callbackHtml(false, "error");
      expect(html).toContain("<title>CrowdListen</title>");
    });
  });
});
