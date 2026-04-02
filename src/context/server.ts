/**
 * Express server for context extraction web UI.
 * Serves static files + API routes on port 3847.
 */

import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { handleApiRequest } from "./api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3847;

// MIME types for static file serving
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(
  res: http.ServerResponse,
  filePath: string
): void {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for any non-API, non-file route
    try {
      const indexPath = path.join(getWebDistDir(), "index.html");
      const content = fs.readFileSync(indexPath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}

function getWebDistDir(): string {
  // Check for built web UI in various locations
  const candidates = [
    path.join(__dirname, "..", "..", "web-dist"),
    path.join(__dirname, "..", "web-dist"),
    path.join(__dirname, "web-dist"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }

  // Fallback: return the first candidate (will show instructions if missing)
  return candidates[0];
}

function openBrowser(url: string): void {
  import("child_process").then(({ execSync }) => {
    try {
      if (process.platform === "darwin") execSync(`open "${url}"`);
      else if (process.platform === "win32") execSync(`start "${url}"`);
      else execSync(`xdg-open "${url}" || sensible-browser "${url}"`);
    } catch {
      // Silently fail — user can open manually
    }
  });
}

export async function startContextServer(): Promise<void> {
  const webDir = getWebDistDir();
  const hasWebUI = fs.existsSync(path.join(webDir, "index.html"));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    // CORS headers for local development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, url);
      return;
    }

    // Static files
    if (hasWebUI) {
      const filePath = path.join(
        webDir,
        url.pathname === "/" ? "index.html" : url.pathname
      );
      serveStatic(res, filePath);
    } else {
      // No web UI built — show instructions
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
<!DOCTYPE html>
<html>
<head><title>CrowdListen Context</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 60px auto; padding: 0 20px;">
  <h1>CrowdListen Context</h1>
  <p>The web UI hasn't been built yet. You can:</p>
  <ol>
    <li>Use the CLI: <code>npx @crowdlisten/harness context &lt;file&gt;</code></li>
    <li>Build the web UI: <code>npm run build:web</code></li>
  </ol>
  <h2>API Endpoints</h2>
  <ul>
    <li><code>POST /api/process</code> — Process text through the pipeline</li>
    <li><code>GET /api/blocks</code> — Get stored context blocks</li>
    <li><code>GET /api/skills</code> — Get skill recommendations</li>
    <li><code>GET /api/config</code> — Get current config status</li>
    <li><code>POST /api/config</code> — Update LLM config</li>
  </ul>
</body>
</html>`);
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.error(`\n🚀 CrowdListen Context server running at http://localhost:${PORT}\n`);
    if (hasWebUI) {
      openBrowser(`http://localhost:${PORT}`);
    } else {
      console.error(
        "   Web UI not built. Run 'npm run build:web' or use the API directly.\n"
      );
    }
  });
}
