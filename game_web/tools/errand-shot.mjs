// Render the three errand markers so the pool of light can be checked.
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "./node-shims.mjs";
installShims();
import { LevelView } from "../src/scene.js";
import { World } from "../src/world.js";
import { LEVEL, buildLevel } from "../src/level.js";
import { CITY, buildCity } from "../src/city.js";
import { CityView } from "../src/cityview.js";
import { segmentHitsBox } from "../src/collision.js";
import { TIERS } from "../src/config.js";
import { Weather } from "../src/weather.js";
import { rasterize, encodePNG, describeImage, tonemapInPlace } from "./software-raster.mjs";

const outDir = process.argv[2] || "../docs/previews/city";
const W = Number(process.argv[3] || 800);
const H = Number(process.argv[4] || 450);
fs.mkdirSync(outDir, { recursive: true });

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101a22);
scene.fog = new THREE.Fog(0x17252e, 24, 120);
const tier = TIERS.desktop;
const built = buildLevel();
new LevelView(scene, built, { district: true }).build();
const cityBuilt = buildCity(CITY, tier);
new CityView(scene, CITY, cityBuilt, tier).build();
const weather = new Weather({ start: "break", allowLightning: false });
weather.update(1 / 60);
weather.apply(scene, tier);

const world = new World(LEVEL, built, { city: CITY, cityBoxes: cityBuilt.boxes, cityBuilt, tier });
// The same marker construction main.js uses.
const markers = [];
for (const e of world.errands) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 2.4, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xe0b77e, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.set(e.x, 1.2, e.z);
  scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.8, 24),
    new THREE.MeshBasicMaterial({ color: 0xe0b77e, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(e.x, 0.06, e.z);
  scene.add(ring);
  markers.push(e);
}

scene.updateMatrixWorld(true);
// Approach cameras: stand back along the nearest road so the marker is seen
// the way a player would find it, not from inside a block.
// Pick the camera by measuring it, not by guessing: rasterise a small frame
// from each candidate stand with only the marker's beam visible, and keep the
// stand where the beam covers the most pixels. Ray tests said "clear" while the
// frame was still full of wall, because the marker sits inside a lot.
const beamOnly = [];
for (const e of world.errands) {
  const probe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 2.4, 12, 1, false),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  probe.name = "errand-probe";
  probe.position.set(e.x, 1.2, e.z);
  probe.visible = false;
  scene.add(probe);
  beamOnly.push(probe);
}

const scoreFrom = (pos, look, only) => {
  const cam = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 320);
  cam.position.set(...pos);
  cam.lookAt(new THREE.Vector3(...look));
  cam.updateMatrixWorld(true);
  for (const o of beamOnly) o.visible = o === only;
  // The ID pass reports per-object screen area, which is the only reliable way
  // to ask "how much of this frame is the marker, and how much is wall".
  const perObject = { list: [] };
  rasterize(scene, cam, { width: 120, height: 68, mode: "ids", perObject });
  for (const o of beamOnly) o.visible = false;
  const entry = perObject.list.find((o) => o.name === "errand-probe");
  let wall = 0;
  for (const o of perObject.list) if (o.name !== "errand-probe") wall += o.area;
  const marker = entry ? entry.area : 0;
  // Reward the marker filling frame, punish standing with a wall in the lens.
  return marker - wall * 0.15;
};

const shots = markers.map((e, i) => {
  const look = [e.x, 1.2, e.z];
  const probe = beamOnly[i];
  let best = null;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    for (const dist of [7, 10, 14, 18]) {
      const pos = [e.x + Math.sin(ang) * dist, 4.2, e.z + Math.cos(ang) * dist];
      const score = scoreFrom(pos, look, probe);
      if (!best || score > best.score) best = { pos, score };
    }
  }
  if (!best || best.score < 12) console.log(`  (marker ${e.id} is barely visible from any angle: ${best && best.score}px)`);
  return { name: `errand-${i + 1}-${e.id}`, pos: best.pos, look, fov: 62 };
});

for (const s of shots) {
  const cam = new THREE.PerspectiveCamera(s.fov, W / H, 0.1, 320);
  cam.position.set(...s.pos);
  cam.lookAt(new THREE.Vector3(...s.look));
  const out = rasterize(scene, cam, { width: W, height: H, shadow: null });
  tonemapInPlace(out.color, 1.35);
  fs.writeFileSync(path.join(outDir, `${s.name}.png`), encodePNG(W, H, out.color));
  const diag = describeImage(out.color, W, H);
  console.log(`${s.name.padEnd(24)} luma=${diag.meanLuma} dark=${diag.darkFraction}`);
}
