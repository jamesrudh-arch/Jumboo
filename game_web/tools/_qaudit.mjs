import fs from "node:fs";
import path from "node:path";
function walk(d, out = []) {
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".glb")) out.push(p);
  }
  return out;
}
const files = walk("/tmp/qassets");
let tris = 0, verts = 0, textured = 0, animated = 0, mats = new Set(), images = 0;
const rows = [];
for (const f of files) {
  const buf = fs.readFileSync(f);
  const magic = buf.subarray(0, 4).toString();
  if (magic !== "glTF") { console.log("NOT GLB", f); continue; }
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  let t = 0;
  for (const m of json.meshes || []) for (const p of m.primitives) {
    const acc = json.accessors[p.indices ?? p.attributes.POSITION];
    t += acc.count / (p.indices !== undefined ? 3 : 3);
  }
  const v = (json.meshes || []).reduce((n, m) => n + m.primitives.reduce((k, p) => k + json.accessors[p.attributes.POSITION].count, 0), 0);
  tris += t; verts += v;
  if (json.textures?.length) textured++;
  if (json.animations?.length) animated++;
  images += json.images?.length || 0;
  for (const m of json.materials || []) mats.add(m.name || "");
  rows.push({ name: path.basename(f, ".glb"), tris: Math.round(t), verts: v, mats: (json.materials || []).length, tex: json.textures?.length || 0, anim: json.animations?.length || 0, kb: Math.round(buf.length / 1024) });
}
rows.sort((a, b) => b.tris - a.tris);
for (const r of rows) console.log(`${r.name.slice(0,34).padEnd(36)} ${String(r.tris).padStart(5)}t ${String(r.verts).padStart(5)}v ${r.mats}m ${r.tex}tex ${r.anim}anim ${r.kb}KB`);
console.log(`\n${files.length} models | ${tris} tris | ${verts} verts | ${textured} textured | ${animated} animated | ${images} images | ${mats.size} distinct materials`);
