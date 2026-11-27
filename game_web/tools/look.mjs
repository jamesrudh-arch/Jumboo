// Diagnostic contact sheet: render the level from fixed viewpoints in several
// shading modes and print which objects cover pixels. Debug tool only.

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "./node-shims.mjs";

installShims();

const { LevelView, loadMarcus } = await import("../src/scene.js");
const { rasterize, encodePNG, describeImage, tonemapInPlace, buildShadowMap } = await import("./software-raster.mjs");

const outDir = process.argv[2] || "../docs/previews/game/diag";
const mode = process.argv[3] || "light";
const W = Number(process.argv[4] || 800);
const H = Number(process.argv[5] || 450);
fs.mkdirSync(outDir, { recursive: true });

const { LEVEL, buildLevel } = await import("../src/level.js");
const built = buildLevel();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e171d);
scene.fog = new THREE.Fog(0x16232b, 18, 64);
const view = new LevelView(scene, built).build();

const marcus = await loadMarcus(scene, null, "file://" + path.resolve("assets/marcus.glb"));
marcus.root.position.set(0, 0, 0);
marcus.mixer.setTime(0.25);

const sun = scene.children.reduce((found, c) => found || c.children?.find((x) => x.isDirectionalLight), null);
console.log("sun:", sun && sun.position.toArray());
const shadow = sun ? buildShadowMap(scene, sun, { size: 1024, center: new THREE.Vector3(0, 0, -22), radius: 34 }) : null;
console.log("shadow map built:", !!shadow);

const views = [
  { name: "A-high-lane", pos: [-6, 14, 12], look: [0, 0, -26] },
  { name: "B-mid-lane", pos: [0, 2.6, 4], look: [0, 1.0, -30] },
  { name: "C-van", pos: [3.5, 2.2, -6], look: [-3.3, 0.9, -13] },
  { name: "D-witness", pos: [0.5, 2.0, -24], look: [5.0, 1.0, -30] },
  { name: "E-dock", pos: [1.5, 2.0, -34], look: [10.0, 1.4, -40] },
  { name: "F-side", pos: [-8, 5, -14], look: [4, 1, -30] },
  { name: "G-lookback", pos: [0, 2.6, -20], look: [0, 1.2, 8] },
];

for (const v of views) {
  const cam = new THREE.PerspectiveCamera(58, W / H, 0.1, 400);
  cam.position.set(...v.pos);
  cam.lookAt(new THREE.Vector3(...v.look));
  const perObject = {};
  const shot = rasterize(scene, cam, { width: W, height: H, mode, perObject, shadow });
  const diag = describeImage(shot.color, W, H);
  console.log(`${v.name.padEnd(12)} mean=${diag.meanLuma} dark=${diag.darkFraction} tris=${shot.stats.triangles}`);
  for (const o of perObject.list.sort((a, b) => b.area - a.area).slice(0, 6)) {
    console.log(`      ${o.hex} ${o.name.padEnd(14)} area=${String(o.area).padStart(6)} at ${JSON.stringify(o.world)}`);
  }
  tonemapInPlace(shot.color, 1.1);
  fs.writeFileSync(path.join(outDir, `${v.name}-${mode}.png`), encodePNG(W, H, shot.color));
}
console.log("wrote", outDir, "mode", mode);
