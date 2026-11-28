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
const rows = [];
for (const f of walk("/tmp/eassets")) {
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
  const pack = f.split("/")[3];
  // A humanoid rig is what makes an enemy animatable; skins without one are props.
  const rigged = (json.skins || []).length > 0;
  const anims = (json.animations || []).length;
  const clips = (json.animations || []).map((a) => a.name).slice(0, 6);
  rows.push({ name: path.basename(f, ".glb"), pack, tris: Math.round(t), verts: v, rigged, anims, clips,
    h: (mx[1] - mn[1]), kb: Math.round(buf.length / 1024), tex: (json.images || []).length });
}
rows.sort((a, b) => b.tris - a.tris);
for (const r of rows.slice(0, 26)) {
  console.log(`${r.pack.slice(0,10).padEnd(12)} ${r.name.slice(0, 26).padEnd(28)} ${String(r.tris).padStart(6)}t ${String(r.verts).padStart(6)}v ${r.h.toFixed(1).padStart(5)}m rig=${r.rigged ? "Y" : "."} anim=${String(r.anims).padStart(2)} img=${r.tex} ${r.kb}KB`);
}
const riggedRows = rows.filter((r) => r.rigged);
console.log(`\n${rows.length} models | ${rows.reduce((n, r) => n + r.tris, 0)} tris | rigged: ${riggedRows.length} | animated: ${rows.filter(r=>r.anims>0).length}`);
console.log("animated clip names:", [...new Set(rows.flatMap((r) => r.clips))].slice(0, 24).join(", "));
