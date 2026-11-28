import * as THREE from "three";
import fs from "node:fs";
import { makeKenneyKit } from "./_kkit.mjs";
import { rasterize, encodePNG } from "./software-raster.mjs";
// Bind pose only: these are rigged, so without a mixer they render as authored.
const cast = [
  ["cyberpunk_pack", "Enemy_2Legs_Gun"], ["cyberpunk_pack", "Enemy_Large_Gun"],
  ["cyberpunk_pack", "Enemy_Flying_Gun"], ["cyberpunk_pack", "Character"],
  ["platformer_game_pack", "Character_Gun"], ["easy_enemies_pack", "Spider"],
  ["easy_enemies_pack", "Rat"], ["ultimate_space_pack", "Enemy_Large-transformed"],
  ["mech_pack", "Mech_BarbaraTheBee-transformed"], ["animals_pack", "Wolf"],
];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
const pal = [0xb0605a, 0x6a8fa8, 0x9a8fb0, 0x8aa06a, 0xb09060, 0x708a9a, 0xa8788a, 0x6a9a8a, 0x8a7a6a, 0x909aa8];
let i = 0;
for (const [pack, name] of cast) {
  const dir = `/tmp/eassets/public/glb/${pack}`;
  if (!fs.existsSync(`${dir}/${name}.glb`)) { console.log("miss", pack, name); continue; }
  const kit = makeKenneyKit("x", [name], dir);
  const m = kit.make(name);
  if (!m) { console.log("no mesh", name); continue; }
  m.material = new THREE.MeshStandardMaterial({ color: pal[i % pal.length], roughness: 0.75 });
  const size = kit.size(name);
  // "-transformed" models are exported at 100x, so normalise by height.
  const s = 1.7 / Math.max(size.y, 0.001);
  m.scale.setScalar(s);
  const b = new THREE.Box3().setFromObject(m);
  m.position.set((i - (cast.length - 1) / 2) * 2.3, -b.min.y, 0);
  scene.add(m);
  i++;
  console.log(`  ${name.padEnd(30)} ${kit.size(name).toArray().map((n) => n.toFixed(2)).join(" x ")}`);
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 1.3));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(6, 12, 14); scene.add(key);
const cam = new THREE.PerspectiveCamera(38, 16 / 6, 0.1, 80);
cam.position.set(0, 2.0, 15); cam.lookAt(0, 0.9, 0); cam.updateMatrixWorld();
const W = 1200, H = 450;
const { color } = rasterize(scene, cam, { width: W, height: H, defaultLighting: false });
for (let k = 0; k < W * H * 3; k++) color[k] = Math.pow(Math.min(1, color[k] / (1 + color[k]) * 1.5), 1 / 2.2);
fs.writeFileSync("/tmp/cast.png", encodePNG(W, H, color));
console.log("wrote /tmp/cast.png");
