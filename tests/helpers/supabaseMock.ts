/**
 * Advanced chainable Supabase mock that tracks table context per chain.
 *
 * Each call to sb.from(table) starts a new chain with its own table context.
 * The result returned depends on the table + action (select/insert/update/delete).
 *
 * Results are looked up by "table.action" key from the results map.
 * Multiple results for the same key are consumed in FIFO order (shift).
 */

import { vi } from "vitest";

export interface MockResult {
  data: unknown;
  error: { message: string } | null;
}

export function createSb() {
  const results = new Map<string, MockResult[]>();
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  /**
   * Push a result that will be returned when the chain for table.action resolves.
   * Results are consumed in order; push multiple for sequential calls to same key.
   */
  function pushResult(
    table: string,
    action: string,
    data: unknown,
    error: { message: string } | null = null
  ) {
    const key = `${table}.${action}`;
    if (!results.has(key)) results.set(key, []);
    results.get(key)!.push({ data, error });
  }

  /**
   * Push an error result.
   */
  function pushError(table: string, action: string, message: string) {
    pushResult(table, action, null, { message });
  }

  function makeChain(table: string) {
    let action = "select"; // default

    function log(method: string, ...args: unknown[]) {
      calls.push({ table, method, args });
    }

    const chain: Record<string, unknown> = {};

    // Action methods set the action type
    for (const m of ["select", "insert", "update", "delete", "upsert"]) {
      chain[m] = vi.fn((...args: unknown[]) => {
        action = m;
        log(m, ...args);
        return chain;
      });
    }

    // Filter/modifier methods just pass through
    for (const m of [
      "eq", "neq", "in", "order", "limit", "single", "maybeSingle",
      "is", "gt", "lt", "gte", "lte", "like", "ilike", "contains",
      "containedBy", "overlaps", "range", "filter", "match", "not", "or", "textSearch",
    ]) {
      chain[m] = vi.fn((...args: unknown[]) => {
        log(m, ...args);
        return chain;
      });
    }

    // Make thenable
    chain.then = (
      resolve: (v: MockResult) => void,
      reject?: (e: unknown) => void
    ) => {
      try {
        const key = `${table}.${action}`;
        const queue = results.get(key);
        const result = queue?.shift() ?? { data: null, error: null };
        resolve(result);
      } catch (e) {
        if (reject) reject(e);
      }
    };

    return chain;
  }

  const sb = {
    from: vi.fn((table: string) => {
      calls.push({ table, method: "from", args: [table] });
      return makeChain(table);
    }),
    auth: {
      setSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
          user: { id: "user-123", email: "test@example.com" },
        },
        error: null,
      })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };

  return { sb, calls, pushResult, pushError };
}
