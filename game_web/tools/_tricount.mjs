import * as THREE from "three";
import { buildCity, CITY } from "../src/city.js";
import { CityView } from "../src/cityview.js";
import { TIERS } from "../src/config.js";
const built = buildCity(CITY, TIERS.desktop);
const scene = new THREE.Scene();
const view = new CityView(scene, CITY, built, TIERS.desktop).build();
const rows = [];
view.root.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry;
  let tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
  const inst = o.isInstancedMesh ? o.count : 1;
  rows.push({ name: o.name || o.type, tris: tris * inst, inst, skinned: !!o.isSkinnedMesh, verts: g.attributes.position.count });
});
rows.sort((a, b) => b.tris - a.tris);
let total = 0;
for (const r of rows) total += r.tris;
console.log("total tris:", Math.round(total), "meshes:", rows.length);
console.log("\nTop draw calls by triangle count:");
for (const r of rows.slice(0, 14)) {
  console.log(`  ${String(Math.round(r.tris)).padStart(8)}t  x${String(r.inst).padStart(3)}  ${r.name.slice(0, 34).padEnd(36)} ${r.verts}v/inst${r.skinned ? " SKINNED" : ""}`);
}
const byPrefix = {};
for (const r of rows) {
  const k = r.name.replace(/-\d+$/, "").replace(/\d+$/, "");
  byPrefix[k] = (byPrefix[k] || 0) + r.tris;
}
console.log("\nBy family:");
for (const [k, v] of Object.entries(byPrefix).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(Math.round(v)).padStart(8)}t  ${k}`);
}
