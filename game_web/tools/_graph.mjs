// Scratch: resolve the whole module graph the browser will, and check every
// named import resolves. Catches typos that only appear at runtime in a browser.
import fs from "node:fs";
import path from "node:path";

const seen = new Set();
const problems = [];
async function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  const specs = [...src.matchAll(/import\s+(?:(\{[^}]*\})|(\*\s+as\s+\w+)|(\w+))?\s*(?:from\s*)?["']([^"']+)["']/g)];
  for (const m of specs) {
    let spec = m[4];
    // Bare specifiers go through index.html's importmap, which is relative to
    // the document root, not to the importing file. Resolving them like a
    // relative path is exactly the mistake this script exists to catch.
    const bare = !spec.startsWith(".") && !spec.startsWith("/");
    if (spec === "three") spec = "./vendor/three/three.module.js";
    else if (spec.startsWith("three/examples/jsm/")) spec = "./vendor/three/examples/jsm/" + spec.slice("three/examples/jsm/".length);
    if (bare && !spec.startsWith(".")) continue;
    const resolved = path.resolve(bare ? "." : path.dirname(file), spec);
    if (!fs.existsSync(resolved)) { problems.push(`${file}: missing file ${spec}`); continue; }
    if (m[1]) {
      const names = m[1].replace(/[{}]/g, "").split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const target = fs.readFileSync(resolved, "utf8");
      for (const n of names) {
        // Rough but effective: the name must appear in an export list or decl.
        const exported = new RegExp(`export\\s+(?:async\\s+)?(?:function|class|const|let|var)\\s+${n}\\b`).test(target)
          || new RegExp(`export\\s*\\{[^}]*\\b${n}\\b`).test(target)
          || new RegExp(`export\\s+\\*`).test(target);
        if (!exported) problems.push(`${path.basename(file)}: "${n}" not exported by ${path.basename(resolved)}`);
      }
    }
    await walk(resolved);
  }
}
await walk("src/main.js");
console.log(`modules walked: ${seen.size}`);
if (problems.length) { console.log("PROBLEMS:"); problems.forEach(p => console.log("  " + p)); }
else console.log("every named import resolves");
