/**
 * Chainable Supabase mock factory.
 *
 * Produces a mock SupabaseClient whose query builder methods (.from, .select,
 * .eq, .neq, .in, .order, .limit, .single, .insert, .update, .delete)
 * are all chainable and return predictable data or errors.
 *
 * Usage:
 *   const { sb, callLog } = createMockSupabase();
 *   sb._results.set("kanban_boards.select", { data: [...], error: null });
 *   // pass sb into handleTool(sb, userId, toolName, args)
 *   // inspect callLog for assertions
 */

import { vi } from "vitest";

export interface CallLogEntry {
  method: string;
  table?: string;
  args: unknown[];
}

export interface MockQueryResult {
  data: unknown;
  error: { message: string } | null;
}

/**
 * A lookup key is built as "table.method" (e.g. "kanban_boards.select").
 * If no specific key is registered, the builder falls back to a default
 * successful empty result.
 */
export function createMockSupabase() {
  const callLog: CallLogEntry[] = [];
  const results = new Map<string, MockQueryResult>();

  // Internal state tracked per chain
  let currentTable = "";
  let currentMethod = "";

  function logCall(method: string, ...args: unknown[]) {
    callLog.push({ method, table: currentTable, args });
  }

  const builder: Record<string, unknown> = {};

  // Terminal methods that return a promise-like { data, error }
  const terminalResult = () => {
    const key = `${currentTable}.${currentMethod}`;
    const result = results.get(key) ?? { data: null, error: null };
    return result;
  };

  // All chainable query methods
  const chainableMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "is",
    "gt",
    "lt",
    "gte",
    "lte",
    "like",
    "ilike",
    "contains",
    "containedBy",
    "range",
    "filter",
    "match",
    "not",
    "or",
    "textSearch",
  ];

  for (const method of chainableMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      logCall(method, ...args);
      // Track the first "action" method (select/insert/update/delete)
      if (["select", "insert", "update", "delete", "upsert"].includes(method)) {
        currentMethod = method;
      }
      // Return the builder itself for chaining; also make it thenable
      return builder;
    });
  }

  // Make the builder thenable so `await sb.from(...).select(...)` works
  builder.then = (resolve: (value: MockQueryResult) => void, reject?: (reason: unknown) => void) => {
    try {
      resolve(terminalResult());
    } catch (e) {
      if (reject) reject(e);
    }
  };

  // The Supabase client mock
  const sb = {
    from: vi.fn((table: string) => {
      currentTable = table;
      currentMethod = "";
      logCall("from", table);
      return builder;
    }),
    auth: {
      setSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          user: { id: "user-123", email: "test@example.com" },
        },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: null },
        error: null,
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    // Expose internal controls for tests
    _results: results,
    _callLog: callLog,
    _builder: builder,
  };

  return { sb, callLog, results };
}

/**
 * Helper to set a result for a given table + method combination.
 */
export function setResult(
  results: Map<string, MockQueryResult>,
  table: string,
  method: string,
  data: unknown,
  error: { message: string } | null = null
) {
  results.set(`${table}.${method}`, { data, error });
}

/**
 * Helper to set an error result.
 */
export function setError(
  results: Map<string, MockQueryResult>,
  table: string,
  method: string,
  message: string
) {
  results.set(`${table}.${method}`, { data: null, error: { message } });
}
