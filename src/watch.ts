/**
 * Watch + Sync — local folder ↔ pages table
 *
 * `npx @crowdlisten/harness watch ~/knowledge`  — auto-sync, Dropbox-style
 * `npx @crowdlisten/harness sync ~/knowledge`   — one-shot
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { loadAuth } from "./tools.js";

const SUPABASE_URL =
  process.env.CROWDLISTEN_URL || "https://fnvlxtzonwybshtvrzit.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.CROWDLISTEN_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudmx4dHpvbnd5YnNodHZyeml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjExMjksImV4cCI6MjA3MjQzNzEyOX0.KAoEVMAVxqANcHBrjT5Et_9xiMZGP7LzdVSoSDLxpaA";

const EXTENSIONS = new Set([".md", ".txt", ".mdx"]);

interface SyncOptions {
  watch: boolean;
}

export async function runWatchSync(
  targetDir: string,
  opts: SyncOptions
): Promise<void> {
  const resolvedDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error(`Not a directory: ${resolvedDir}`);
  }

  // Auth
  const auth = loadAuth();
  if (!auth) {
    throw new Error("Not logged in. Run: npx @crowdlisten/harness login");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await sb.auth.setSession({
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
  });
  const userId = auth.user_id;
  const folderName = path.basename(resolvedDir);

  // Initial sync
  const files = collectFiles(resolvedDir);
  console.error(`Syncing ${resolvedDir}... (${files.length} files)`);

  let synced = 0;
  let unchanged = 0;
  let errors = 0;

  for (const fp of files) {
    try {
      const updated = await upsertFile(sb, userId, resolvedDir, folderName, fp);
      if (updated) synced++;
      else unchanged++;
    } catch (err: any) {
      console.error(`  Error: ${path.relative(resolvedDir, fp)} — ${err?.message}`);
      errors++;
    }
  }

  console.error(
    `Synced: ${synced} new/updated, ${unchanged} unchanged${errors ? `, ${errors} errors` : ""}`
  );

  if (!opts.watch) return;

  // Watch mode
  console.error(`\nWatching ${resolvedDir}...`);

  const debounceTimers = new Map<string, NodeJS.Timeout>();

  fs.watch(resolvedDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const ext = path.extname(filename).toLowerCase();
    if (!EXTENSIONS.has(ext)) return;

    const fullPath = path.join(resolvedDir, filename);

    // Debounce: 500ms per file
    const existing = debounceTimers.get(fullPath);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      fullPath,
      setTimeout(async () => {
        debounceTimers.delete(fullPath);
        try {
          if (!fs.existsSync(fullPath)) {
            // File deleted — could optionally delete from pages
            const now = new Date().toLocaleTimeString();
            console.error(`[${now}] Deleted: ${filename}`);
            return;
          }
          const updated = await upsertFile(
            sb,
            userId,
            resolvedDir,
            folderName,
            fullPath
          );
          const now = new Date().toLocaleTimeString();
          if (updated) {
            console.error(`[${now}] Updated: ${filename}`);
          }
        } catch (err: any) {
          console.error(`[error] ${filename}: ${err?.message}`);
        }
      }, 500)
    );
  });

  // Keep process alive
  await new Promise(() => {});
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (EXTENSIONS.has(ext)) results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

async function upsertFile(
  sb: any,
  userId: string,
  rootDir: string,
  folderName: string,
  filePath: string
): Promise<boolean> {
  const content = fs.readFileSync(filePath, "utf-8");
  const contentHash = createHash("md5").update(content).digest("hex");
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const pagePath = `documents/${folderName}/${relativePath}`;
  const title = path.basename(filePath);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Check existing
  const { data: existing } = await sb
    .from("pages")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("path", pagePath)
    .maybeSingle();

  if (existing) {
    const oldHash = (existing.metadata as any)?.content_hash;
    if (oldHash === contentHash) return false; // unchanged

    await sb
      .from("pages")
      .update({
        content,
        title,
        word_count: wordCount,
        metadata: {
          source_path: filePath,
          source_filename: title,
          content_hash: contentHash,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return true;
  }

  // Insert new
  await sb.from("pages").insert({
    user_id: userId,
    path: pagePath,
    title,
    content,
    tags: ["document", "synced"],
    source: "agent",
    source_agent: "folder_sync",
    word_count: wordCount,
    metadata: {
      source_path: filePath,
      source_filename: title,
      content_hash: contentHash,
    },
  });
  return true;
}
