// Tiny static server for the playable slice. Run it and the game is served at
// http://localhost:8080 with the import map intact (ES modules need real HTTP,
// not file://).
//
//   npm run serve
//
// It also aliases the shared brand fonts so the page does not ship a copy.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = here;
const fontsDir = path.resolve(here, "../game/assets/fonts");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function resolveSafe(base, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const joined = path.resolve(base, "." + decoded);
  if (!joined.startsWith(base)) return null;
  return joined;
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url === "/healthz") return send(res, 200, "ok");

  // Shared, licensed fonts live outside this directory.
  if (url.startsWith("/fonts/")) {
    const file = path.join(fontsDir, path.basename(url));
    if (!file.startsWith(fontsDir) || !fs.existsSync(file)) return send(res, 404, "not found");
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": "public, max-age=3600",
    });
    return fs.createReadStream(file).pipe(res);
  }

  let file = resolveSafe(root, url === "/" ? "/index.html" : url);
  if (!file) return send(res, 403, "forbidden");
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    // Unknown paths render the slice; assets 404 normally.
    if (!path.extname(url)) file = path.join(root, "index.html");
    else return send(res, 404, "not found");
  }

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "content-type": MIME[ext] || "application/octet-stream",
    "cache-control": "no-store",
    // Keep the page embeddable: this build is shown inside a preview frame.
    "x-frame-options": "ALLOWALL",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, host, () => {
  console.log(`LEVERAGE slice: http://localhost:${port}`);
});
