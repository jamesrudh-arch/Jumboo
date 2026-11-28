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
const shots = markers.map((e, i) => {
  const road = CITY.roads.reduce((best, r) => {
    const cx = Math.max(r.x1, Math.min(e.x, r.x2));
    const cz = Math.max(r.z1, Math.min(e.z, r.z2));
    const d = Math.hypot(cx - e.x, cz - e.z);
    return !best || d < best.d ? { r, d, cx, cz } : best;
  }, null);
  const along = road && road.r.x2 - road.r.x1 > road.r.z2 - road.r.z1;
  const pos = along
    ? [e.x - 13, 4.2, e.z + 4.5]
    : [e.x + 4.5, 4.2, e.z + 13];
  return { name: `errand-${i + 1}-${e.id}`, pos, look: [e.x, 1.0, e.z], fov: 62 };
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
