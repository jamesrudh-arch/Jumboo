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
const files = walk("/tmp/wassets");
const rows = [];
for (const f of files) {
  const buf = fs.readFileSync(f);
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  let t = 0, v = 0;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const m of json.meshes || []) for (const p of m.primitives) {
    const pos = json.accessors[p.attributes.POSITION];
    v += pos.count;
    t += (p.indices !== undefined ? json.accessors[p.indices].count : pos.count) / 3;
    if (pos.min) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], pos.min[i]); mx[i] = Math.max(mx[i], pos.max[i]); }
  }
  rows.push({
    name: path.basename(f, ".glb"),
    pack: f.includes("modular_sci_fi") ? "scifi" : f.includes("/weapon/") ? "weapon" : f.includes("/blaster/") ? "blaster" : "arena",
    tris: Math.round(t), verts: v,
    tex: (json.textures || []).length,
    size: Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]),
    long: Math.max(mx[0] - mn[0], mx[2] - mn[2]),
    kb: Math.round(buf.length / 1024),
  });
}
rows.sort((a, b) => a.pack.localeCompare(b.pack) || b.tris - a.tris);
for (const r of rows) console.log(`${r.pack.padEnd(8)} ${r.name.slice(0, 30).padEnd(32)} ${String(r.tris).padStart(5)}t ${String(r.verts).padStart(5)}v ${r.tex}tex len ${r.long.toFixed(2).padStart(5)} ${r.kb}KB`);
const by = {};
for (const r of rows) { by[r.pack] ??= { n: 0, t: 0, tex: 0 }; by[r.pack].n++; by[r.pack].t += r.tris; if (r.tex) by[r.pack].tex++; }
console.log("\nsummary:", JSON.stringify(by, null, 0));
console.log("total tris:", rows.reduce((n, r) => n + r.tris, 0));
