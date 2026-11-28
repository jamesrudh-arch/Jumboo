import fs from "node:fs";
import path from "node:path";
function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d)) {
    const p = path.join(d, e);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".glb")) out.push(p);
  }
  return out;
}
const ROOT = "/tmp/kassets";
const packs = {};
let totT = 0, totV = 0;
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).split(path.sep);
  const pack = rel[1] || rel[0];
  let buf;
  try { buf = fs.readFileSync(f); } catch { continue; }
  if (buf.subarray(0, 4).toString() !== "glTF") continue;
  let json;
  try { json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")); } catch { continue; }
  let t = 0, v = 0;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes || []) {
    for (const p of m.primitives) {
      const pos = json.accessors[p.attributes.POSITION];
      v += pos.count;
      t += (p.indices !== undefined ? json.accessors[p.indices].count : pos.count) / 3;
      if (pos.min && pos.max) {
        for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], pos.min[i]); mx[i] = Math.max(mx[i], pos.max[i]); }
      }
    }
  }
  const p = packs[pack] || (packs[pack] = { n: 0, t: 0, v: 0, tex: 0, anim: 0, mats: 0, sizes: [] });
  p.n++; p.t += t; p.v += v;
  if (json.textures?.length) p.tex++;
  if (json.animations?.length) p.anim++;
  p.mats += json.materials?.length || 0;
  p.sizes.push(Math.max(mx[0] - mn[0], mx[2] - mn[2], mx[1] - mn[1]));
  totT += t; totV += v;
}
console.log("PACK            models    tris   verts  tex  anim mats   median-size  max-size");
for (const [k, p] of Object.entries(packs).sort((a, b) => b[1].n - a[1].n)) {
  p.sizes.sort((a, b) => a - b);
  const med = p.sizes[Math.floor(p.sizes.length / 2)];
  console.log(`${k.padEnd(16)} ${String(p.n).padStart(6)} ${String(Math.round(p.t)).padStart(7)} ${String(p.v).padStart(7)} ${String(p.tex).padStart(4)} ${String(p.anim).padStart(5)} ${String(p.mats).padStart(5)} ${med.toFixed(1).padStart(11)} ${p.sizes.at(-1).toFixed(1).padStart(9)}`);
}
console.log(`\nTOTAL ${Object.values(packs).reduce((n, p) => n + p.n, 0)} models | ${Math.round(totT)} tris | ${totV} verts`);
