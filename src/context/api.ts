/**
 * REST API routes for the context extraction web UI.
 */

import * as http from "http";
import { runPipeline } from "./pipeline.js";
import {
  getBlocks,
  deleteBlock,
  updateBlock,
  clearBlocks,
  loadConfig,
  saveConfig,
  getHistory,
} from "./store.js";
import { matchSkills, discoverSkills, searchSkills, getSkillCategories } from "./matcher.js";
import { loadUserState, activatePack, deactivatePack } from "./user-state.js";
import type { ContextConfig, SkillTier, SkillCategory } from "./types.js";

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function error(
  res: http.ServerResponse,
  message: string,
  status = 400
): void {
  json(res, { error: message }, status);
}

export async function handleApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
): Promise<void> {
  const method = req.method || "GET";
  const pathname = url.pathname;

  try {
    // POST /api/process — Process text through the pipeline
    if (pathname === "/api/process" && method === "POST") {
      const body = JSON.parse(await readBody(req));
      const { text, source, isChat } = body;

      if (!text) {
        return error(res, "Missing 'text' field");
      }

      const result = await runPipeline({
        text,
        source: source || "web-upload",
        isChat: isChat !== false,
      });

      return json(res, result);
    }

    // GET /api/blocks — Get stored context blocks
    if (pathname === "/api/blocks" && method === "GET") {
      return json(res, { blocks: getBlocks() });
    }

    // DELETE /api/blocks/:index — Delete a block by index
    if (pathname.startsWith("/api/blocks/") && method === "DELETE") {
      const index = parseInt(pathname.split("/").pop() || "", 10);
      if (isNaN(index)) return error(res, "Invalid block index");
      deleteBlock(index);
      return json(res, { ok: true });
    }

    // PUT /api/blocks/:index — Update a block by index
    if (pathname.startsWith("/api/blocks/") && method === "PUT") {
      const index = parseInt(pathname.split("/").pop() || "", 10);
      if (isNaN(index)) return error(res, "Invalid block index");
      const body = JSON.parse(await readBody(req));
      updateBlock(index, body);
      return json(res, { ok: true });
    }

    // DELETE /api/blocks — Clear all blocks
    if (pathname === "/api/blocks" && method === "DELETE") {
      clearBlocks();
      return json(res, { ok: true });
    }

    // GET /api/skills — Get skill recommendations from stored blocks
    if (pathname === "/api/skills" && method === "GET") {
      const blocks = getBlocks();
      const skills = await matchSkills(blocks);
      return json(res, { skills });
    }

    // GET /api/skills/discover — Context-driven skill discovery
    if (pathname === "/api/skills/discover" && method === "GET") {
      const blocks = getBlocks();
      const category = url.searchParams.get("category") as SkillCategory | undefined;
      const tier = url.searchParams.get("tier") as SkillTier | undefined;
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      const skills = await discoverSkills(blocks, {
        category: category || undefined,
        tier: tier || undefined,
        limit,
      });
      return json(res, { skills });
    }

    // GET /api/skills/search — Full-text skill search
    if (pathname === "/api/skills/search" && method === "GET") {
      const q = url.searchParams.get("q") || "";
      const tier = url.searchParams.get("tier") as SkillTier | undefined;
      const category = url.searchParams.get("category") as SkillCategory | undefined;
      const skills = searchSkills(q, {
        tier: tier || undefined,
        category: category || undefined,
      });
      return json(res, { skills });
    }

    // GET /api/skills/categories — List categories with counts
    if (pathname === "/api/skills/categories" && method === "GET") {
      const categories = getSkillCategories();
      return json(res, { categories });
    }

    // GET /api/config — Get current config status (redacted)
    if (pathname === "/api/config" && method === "GET") {
      const config = loadConfig();
      if (!config) {
        return json(res, { configured: false });
      }
      return json(res, {
        configured: true,
        provider: config.provider,
        model: config.model || "default",
        hasApiKey: !!config.apiKey,
      });
    }

    // POST /api/config — Update LLM config
    if (pathname === "/api/config" && method === "POST") {
      const body = JSON.parse(await readBody(req)) as ContextConfig;
      if (!body.provider) return error(res, "Missing 'provider' field");
      if (!body.apiKey) {
        return error(res, "API key required");
      }
      saveConfig(body);
      return json(res, { ok: true });
    }

    // GET /api/history — Get processing history
    if (pathname === "/api/history" && method === "GET") {
      return json(res, { history: getHistory() });
    }

    // GET /api/state — Get UserState (active packs, preferences)
    if (pathname === "/api/state" && method === "GET") {
      return json(res, loadUserState());
    }

    // POST /api/state/activate — Activate a skill pack
    if (pathname === "/api/state/activate" && method === "POST") {
      const body = JSON.parse(await readBody(req));
      if (!body.pack_id) return error(res, "Missing 'pack_id'");
      const state = activatePack(body.pack_id);
      return json(res, { ok: true, activePacks: state.activePacks });
    }

    // POST /api/state/deactivate — Deactivate a skill pack
    if (pathname === "/api/state/deactivate" && method === "POST") {
      const body = JSON.parse(await readBody(req));
      if (!body.pack_id) return error(res, "Missing 'pack_id'");
      const state = deactivatePack(body.pack_id);
      return json(res, { ok: true, activePacks: state.activePacks });
    }

    // GET /api/packs — List all available packs with metadata
    if (pathname === "/api/packs" && method === "GET") {
      // Import registry dynamically to avoid circular deps at module load
      const { listPacks } = await import("../tools/registry.js");
      const state = loadUserState();
      return json(res, { packs: listPacks(state.activePacks) });
    }

    // 404 for unknown API routes
    error(res, "Not found", 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(res, message, 500);
  }
}
