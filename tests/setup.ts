/**
 * Global test setup for vitest.
 *
 * Sets environment variables that the source module reads at import time,
 * and suppresses noisy console.error output from the MCP server bootstrap.
 */

// Provide dummy Supabase credentials so createClient never hits a real endpoint
process.env.CROWDLISTEN_URL = "https://test.supabase.co";
process.env.CROWDLISTEN_ANON_KEY = "test-anon-key";
process.env.CROWDLISTEN_APP_URL = "https://test.crowdlisten.com";

// Suppress console.error during tests (the server writes operational messages there)
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});
