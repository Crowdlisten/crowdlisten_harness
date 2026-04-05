/**
 * .md Knowledge Base — Local file rendering of Supabase memories.
 *
 * Supabase = source of truth. This module renders a read-only .md cache
 * at ~/.crowdlisten/context/ that agents can browse via INDEX.md.
 *
 * Exports: renderEntry, removeEntry, rebuildIndex, renderAll, searchLocalIndex, readMeta, writeMeta
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BASE_DIR = path.join(os.homedir(), ".crowdlisten", "context");
const ENTRIES_DIR = path.join(BASE_DIR, "entries");
const TOPICS_DIR = path.join(BASE_DIR, "topics");
const INDEX_PATH = path.join(BASE_DIR, "INDEX.md");
const META_PATH = path.join(BASE_DIR, ".meta.json");

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  source?: string;
  source_agent?: string;
  project_id?: string | null;
  confidence?: number;
  created_at?: string;
}

interface MetaData {
  last_sync: string;
  entry_count: number;
  version: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDirs(): void {
  for (const dir of [BASE_DIR, ENTRIES_DIR, TOPICS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/** First 8 chars of the UUID for the filename */
function idPrefix(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

function entryPath(id: string): string {
  return path.join(ENTRIES_DIR, `${idPrefix(id)}.md`);
}

function formatDate(iso?: string): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

// ─── Render Entry ───────────────────────────────────────────────────────────

/**
 * Write a single memory as a .md file with YAML frontmatter.
 */
export function renderEntry(memory: MemoryEntry): void {
  ensureDirs();
  const tags = memory.tags || [];
  const frontmatter = [
    "---",
    `id: ${memory.id}`,
    `title: ${memory.title}`,
    `tags: [${tags.join(", ")}]`,
    memory.source_agent ? `source_agent: ${memory.source_agent}` : null,
    memory.project_id ? `project_id: ${memory.project_id}` : null,
    `created_at: ${memory.created_at || new Date().toISOString()}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const body = `${frontmatter}\n\n# ${memory.title}\n\n${memory.content}\n`;
  fs.writeFileSync(entryPath(memory.id), body, "utf-8");
}

// ─── Remove Entry ───────────────────────────────────────────────────────────

export function removeEntry(memoryId: string): void {
  const p = entryPath(memoryId);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
}

// ─── Rebuild INDEX.md ───────────────────────────────────────────────────────

/**
 * Regenerate INDEX.md from an array of memory entries.
 */
export function rebuildIndex(memories: MemoryEntry[]): void {
  ensureDirs();

  const now = new Date().toISOString();
  const topicFiles = fs.existsSync(TOPICS_DIR)
    ? fs.readdirSync(TOPICS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  // Group by tag
  const tagMap = new Map<string, MemoryEntry[]>();
  for (const m of memories) {
    for (const tag of m.tags || []) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(m);
    }
  }

  // Sort memories by date (newest first)
  const sorted = [...memories].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );
  const recent = sorted.slice(0, 25);

  // Build INDEX.md
  const lines: string[] = [];
  lines.push("# Knowledge Base");
  lines.push(
    `> ${memories.length} entries | ${topicFiles.length} topics | Updated: ${now}`
  );
  lines.push("");

  // Topics section
  if (topicFiles.length > 0) {
    lines.push("## Topics");
    lines.push("| Topic | Path |");
    lines.push("|-------|------|");
    for (const f of topicFiles) {
      const name = f.replace(".md", "").replace(/-/g, " ");
      lines.push(`| ${name} | topics/${f} |`);
    }
    lines.push("");
  }

  // Recent entries
  lines.push("## Recent Entries");
  lines.push("| Title | Tags | Date | Path |");
  lines.push("|-------|------|------|------|");
  for (const m of recent) {
    const tags = (m.tags || []).join(", ");
    const date = formatDate(m.created_at);
    const p = `entries/${idPrefix(m.id)}.md`;
    lines.push(`| ${m.title} | ${tags} | ${date} | ${p} |`);
  }
  lines.push("");

  // By tag
  const sortedTags = [...tagMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  if (sortedTags.length > 0) {
    lines.push("## By Tag");
    for (const [tag, entries] of sortedTags) {
      lines.push(`### ${tag} (${entries.length})`);
      const tagSorted = [...entries].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );
      for (const m of tagSorted.slice(0, 15)) {
        const date = formatDate(m.created_at);
        lines.push(
          `- [${m.title}](entries/${idPrefix(m.id)}.md) -- ${date}`
        );
      }
      if (tagSorted.length > 15) {
        lines.push(`- ... and ${tagSorted.length - 15} more`);
      }
      lines.push("");
    }
  }

  fs.writeFileSync(INDEX_PATH, lines.join("\n"), "utf-8");
}

// ─── Render All ─────────────────────────────────────────────────────────────

/**
 * Clear entries dir, re-render all entries, rebuild index.
 */
export function renderAll(memories: MemoryEntry[]): void {
  ensureDirs();

  // Clear existing entries
  if (fs.existsSync(ENTRIES_DIR)) {
    for (const f of fs.readdirSync(ENTRIES_DIR)) {
      fs.unlinkSync(path.join(ENTRIES_DIR, f));
    }
  }

  // Render each entry
  for (const m of memories) {
    renderEntry(m);
  }

  // Rebuild index
  rebuildIndex(memories);

  // Update meta
  writeMeta({
    last_sync: new Date().toISOString(),
    entry_count: memories.length,
    version: 1,
  });
}

// ─── Local Search (offline fallback) ────────────────────────────────────────

interface SearchOpts {
  tags?: string[];
  limit?: number;
}

/**
 * Grep local entry files for keyword matches. Fallback when Supabase is unavailable.
 */
export function searchLocalIndex(
  query?: string,
  opts: SearchOpts = {}
): MemoryEntry[] {
  const limit = opts.limit || 20;

  if (!fs.existsSync(ENTRIES_DIR)) return [];

  const files = fs.readdirSync(ENTRIES_DIR).filter((f) => f.endsWith(".md"));
  const results: MemoryEntry[] = [];

  for (const file of files) {
    if (results.length >= limit) break;

    const raw = fs.readFileSync(path.join(ENTRIES_DIR, file), "utf-8");

    // Parse frontmatter
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const id = fm.match(/^id:\s*(.+)$/m)?.[1]?.trim() || file.replace(".md", "");
    const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim() || "";
    const tagsMatch = fm.match(/^tags:\s*\[(.+)\]$/m)?.[1];
    const tags = tagsMatch
      ? tagsMatch.split(",").map((t) => t.trim())
      : [];
    const sourceAgent = fm.match(/^source_agent:\s*(.+)$/m)?.[1]?.trim();
    const createdAt = fm.match(/^created_at:\s*(.+)$/m)?.[1]?.trim();

    // Body is everything after frontmatter + title
    const body = raw.slice(fmMatch[0].length).replace(/^#\s+.+\n+/, "").trim();

    // Tag filter
    if (opts.tags?.length) {
      const hasTag = opts.tags.some((t) => tags.includes(t));
      if (!hasTag) continue;
    }

    // Query filter
    if (query) {
      const lower = query.toLowerCase();
      const haystack = `${title} ${body} ${tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(lower)) continue;
    }

    results.push({
      id,
      title,
      content: body.slice(0, 2000),
      tags,
      source_agent: sourceAgent,
      created_at: createdAt,
    });
  }

  return results;
}

// ─── Wiki Page Rendering ─────────────────────────────────────────────────

const PROJECTS_DIR = path.join(BASE_DIR, "projects");

export interface WikiPage {
  path: string;
  title: string;
  category: string;
  content: string;
  source_count?: number;
  word_count?: number;
  updated_at?: string;
}

/**
 * Render wiki pages as an organized .md tree under
 * ~/.crowdlisten/context/projects/{project-slug}/
 *
 * Structure:
 *   projects/{slug}/
 *   ├── index.md
 *   ├── overview.md
 *   ├── topics/
 *   │   ├── pricing-sentiment.md
 *   │   └── feature-requests.md
 *   ├── entities/
 *   │   └── competitor-x.md
 *   └── docs/
 *       └── product-requirements.md
 */
export function renderWikiPages(
  projectSlug: string,
  pages: WikiPage[]
): { dir: string; fileCount: number } {
  const projectDir = path.join(PROJECTS_DIR, projectSlug);

  // Clear existing project wiki files
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
  fs.mkdirSync(projectDir, { recursive: true });

  let fileCount = 0;

  for (const page of pages) {
    // Build file path from page.path (e.g. "topics/pricing-sentiment" → "topics/pricing-sentiment.md")
    const pagePath = page.path.endsWith(".md") ? page.path : `${page.path}.md`;
    const fullPath = path.join(projectDir, pagePath);

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write markdown with frontmatter
    const frontmatter = [
      "---",
      `title: ${page.title}`,
      `category: ${page.category}`,
      page.source_count ? `source_count: ${page.source_count}` : null,
      page.word_count ? `word_count: ${page.word_count}` : null,
      page.updated_at ? `updated_at: ${page.updated_at}` : null,
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    fs.writeFileSync(fullPath, `${frontmatter}\n\n${page.content}\n`, "utf-8");
    fileCount++;
  }

  return { dir: projectDir, fileCount };
}

// ─── Meta ───────────────────────────────────────────────────────────────────

export function readMeta(): MetaData | null {
  try {
    if (!fs.existsSync(META_PATH)) return null;
    return JSON.parse(fs.readFileSync(META_PATH, "utf-8")) as MetaData;
  } catch {
    return null;
  }
}

export function writeMeta(meta: MetaData): void {
  ensureDirs();
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}
