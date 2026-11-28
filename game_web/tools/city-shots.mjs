// Render the district from a set of survey points, on the CPU.
//
//   node tools/city-shots.mjs [outDir] [width] [height]
//
// This is the visual check for the procedural city: the same scene graph the
// browser builds, rendered by tools/software-raster.mjs. It is a diagnostic,
// not the shipping renderer, and not a quality claim.

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "./node-shims.mjs";
import { LevelView } from "../src/scene.js";
import { World } from "../src/world.js";
import { LEVEL, buildLevel } from "../src/level.js";
import { CITY, buildCity } from "../src/city.js";
import { CityView, makeVehicleMesh, makePedestrianMesh } from "../src/cityview.js";
import { TIERS } from "../src/config.js";
import { Weather, Wetness } from "../src/weather.js";
import { rasterize, encodePNG, describeImage, tonemapInPlace, buildShadowMap } from "./software-raster.mjs";

installShims();

const outDir = process.argv[2] || "../docs/previews/city";
const W = Number(process.argv[3] || 800);
const H = Number(process.argv[4] || 450);
const tierName = process.env.TIER || "desktop";
const tier = TIERS[tierName] || TIERS.desktop;
fs.mkdirSync(outDir, { recursive: true });

const built = buildLevel();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d141a);
scene.fog = new THREE.Fog(0x17242c, tier.fogNear, tier.fogFar);

new LevelView(scene, built, { district: true }).build();
const cityBuilt = buildCity(CITY, tier);
const cityView = new CityView(scene, CITY, cityBuilt, tier).build();

// Weather mood for the shots. WEATHER=<id> picks a preset, otherwise the
// director is left to drift for a while.
const weather = new Weather({ start: process.env.WEATHER || "downpour", allowLightning: false });
const wetness = new Wetness();

const world = new World(LEVEL, { ...built, boxes: [] }, {
  city: CITY,
  cityBoxes: cityBuilt.boxes,
  tier,
  seed: 20261127,
});
world.openBoxes = cityBuilt.boxes.concat(built.boxes);
world.start();

// Live traffic and pedestrians, so the shots show the street in motion.
const trafficMeshes = world.traffic.vehicles.map((v) => {
  const m = makeVehicleMesh(v.kind);
  scene.add(m);
  return m;
});
const pedMeshes = world.crowd.people.map((p) => {
  const m = makePedestrianMesh(p.tone);
  scene.add(m);
  return m;
});

function syncActors() {
  trafficMeshes.forEach((m, i) => {
    const v = world.traffic.vehicles[i];
    m.position.set(v.x, 0, v.z);
    m.rotation.y = v.yaw;
  });
  pedMeshes.forEach((m, i) => {
    const p = world.crowd.people[i];
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.yaw;
  });
}

// Run the street for a while so the traffic is spread out and someone is
// mid-panic, which is the honest look of the thing.

// ------------------------------------------------------------------ framing
/**
 * Reject a camera that is inside a building, under the ground or inside water.
 * The last two rounds of survey shots were unusable because the camera sat
 * inside a block and rendered a flat black frame; checking beats looking.
 */
function unsafeAt(pos) {
  const [x, y, z] = pos;
  if (y < 0.9) return "underground";
  // Tree canopies are solid to the eye even though they are not colliders: a
  // camera parked in one renders a black frame.
  for (const t of cityBuilt.trees) {
    const h = (t.scale || 1) * 3.2;
    const r = (t.scale || 1) * 2.6;
    if (Math.hypot(x - t.x, z - t.z) < r && y > h * 0.6 && y < h * 1.6) return "in a tree";
  }
  for (const w of CITY.water) {
    if (x > w.x1 && x < w.x2 && z > w.z1 && z < w.z2 && y < w.surfaceY + 0.4) return "in water";
  }
  for (const b of cityBuilt.boxes) {
    if (b.tag !== "building" && b.tag !== "block") continue;
    if (x > b.x1 - 0.6 && x < b.x2 + 0.6 && z > b.z1 - 0.6 && z < b.z2 + 0.6 && y < b.y1 + 0.4)
      return `inside ${b.tag} ${b.x1.toFixed(0)},${b.z1.toFixed(0)}`;
  }
  return null;
}

for (let i = 0; i < 60 * 8; i++) {
  world.setInput({ moveX: 0, moveZ: 0 });
  world.update(1 / 60);
  weather.update(1 / 60);
  wetness.update(1 / 60, weather.rainRate);
  cityView.update(1 / 60, { position: new THREE.Vector3(0, 2, 0) }, weather);
}
weather.apply(scene, tier);
// Match the runtime's ambient fill so the survey shows the shipped mood.
const hemi = scene.children.find((c) => c.isHemisphereLight);
const moonLight = scene.children.find((c) => c.isDirectionalLight);
if (hemi) hemi.intensity = (weather.blend.ambient ?? 0.5) * 1.15;
if (moonLight) moonLight.intensity = 0.55 + (weather.blend.ambient ?? 0.5) * 0.7;
console.log(`weather=${weather.blend.label} rain=${weather.rainRate.toFixed(2)} wet=${wetness.level.toFixed(2)}`);
syncActors();
scene.updateMatrixWorld(true);

const sun = scene.children.reduce((f, c) => f || c.children?.find((x) => x.isDirectionalLight), null);
// The shadow map has to cover the district, not the lane: a 60 m radius around
// the lane leaves the whole harbour in shadow and every shot renders black.
const shadow = tier.shadows && sun
  ? buildShadowMap(scene, sun, { size: tier.shadowMapSize, center: new THREE.Vector3(0, 0, -35), radius: 200 })
  : null;

const failures = [];
const shots = [
  // Street level, looking north up the lane mouth to the shop front.
  { name: "01-lane-south", pos: [0.5, 2.1, -18], look: [0, 1.5, 8], fov: 62 },
  // The lane opening east through the new alley gap.
  { name: "02-lane-alley", pos: [-2, 1.8, -26], look: [26, 1.2, -36], fov: 64 },
  // Out of the lane's far doorway, looking at the mid cross-street.
  { name: "03-lane-north-exit", pos: [4, 1.9, -49], look: [4, 1.4, -70], fov: 62 },
  // The canal, from the south bank.
  { name: "04-canal", pos: [-60, 6, -73], look: [40, 0, -80], fov: 62 },
  // Bridges and the water below.
  { name: "05-bridges", pos: [-26, 11, -89], look: [22, -1.2, -80], fov: 62 },
  // The harbour and the container quay.
  { name: "06-harbour", pos: [0, 7, -108], look: [8, -1.5, -150], fov: 62 },
  // The street outside the lane mouth, looking north to the shophouse row.
  { name: "07-street-north", pos: [6.5, 1.9, -12], look: [-2, 3.4, 30], fov: 70 },
  // The park and pond.
  { name: "08-park", pos: [-8, 3.2, 54], look: [-12, -0.2, 80], fov: 62 },
  // The skyline from outside the district, low enough for the towers to read.
  { name: "09-skyline", pos: [118, 24, 74], look: [-6, 30, -20], fov: 62 },
  // Rooftops and the street grid: the density shot.
  { name: "10-roofs", pos: [-62, 58, 34], look: [4, 0, -44], fov: 62 },
  // High and wide over the whole district.
  { name: "11-district", pos: [74, 108, 74], look: [-6, 0, -70], fov: 64 },
];

console.log(`tier=${tier.name} buildings=${cityBuilt.stats.buildings} trees=${cityBuilt.stats.trees} meshes=${cityView.stats.meshes} instances=${cityView.stats.instances}`);

for (const shot of shots) {
  const camera = new THREE.PerspectiveCamera(shot.fov, W / H, 0.1, tier.drawDistance * 1.8);
  camera.position.set(...shot.pos);
  camera.lookAt(new THREE.Vector3(...shot.look));
  if (process.env.DEBUG_RAY) {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = r.intersectObject(scene, true).slice(0, 4);
    console.log("  centre ray:", hits.map((h) => `${h.object.name || h.object.type}@${h.distance.toFixed(1)}`).join(" | ") || "nothing");
  }
  const bad = unsafeAt(shot.pos);
  if (bad) failures.push(`${shot.name} (${bad})`);
  const t0 = Date.now();
  const out = rasterize(scene, camera, { width: W, height: H, shadow });
  tonemapInPlace(out.color, 1.55 * (weather.blend.exposure || 1.05));
  const file = path.join(outDir, `${shot.name}.png`);
  fs.writeFileSync(file, encodePNG(W, H, out.color));
  const diag = describeImage(out.color, W, H);
  console.log(
    `${shot.name.padEnd(18)} tris=${String(out.stats.triangles).padStart(7)} ` +
      `luma=${diag.meanLuma} dark=${diag.darkFraction} ${String(Date.now() - t0).padStart(4)}ms` +
      (bad ? `  CAMERA ${bad}` : ""),
  );
}
if (failures.length) console.log(`UNSAFE CAMERAS: ${failures.join("; ")}`);
console.log("wrote", shots.length, "shots to", outDir);
void cityView;
