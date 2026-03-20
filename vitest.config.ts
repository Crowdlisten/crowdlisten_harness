import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "text-summary", "json-summary"],
    },
    testTimeout: 10000,
    // Each test file gets its own module scope to avoid cross-contamination
    // between tests that manipulate process.argv or env vars
    isolate: true,
  },
});
