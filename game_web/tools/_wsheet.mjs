import * as THREE from "three";
import fs from "node:fs";
import { makeKenneyKit } from "./_kkit.mjs";
import { rasterize, encodePNG } from "./software-raster.mjs";
// Weapons pack has no atlas: it is palette materials, so give the loader a
// white material set rather than a missing texture.
const names = ["knife_sharp", "pistol", "pistolSilencer", "uzi", "shotgun", "sniper", "rocketlauncher", "machinegun"];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
const grp = new THREE.MeshStandardMaterial({ color: 0x8a939e, roughness: 0.55, metalness: 0.35 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7, metalness: 0.2 });
names.forEach((n, i) => {
  const f = `/tmp/wassets/3d/weapon/${n}.glb`;
  if (!fs.existsSync(f)) { console.log("miss", n); return; }
  // readGlb via the kit helper needs a pack dir; load directly.
  const kit = makeKenneyKit("weapon", [n], "/tmp/wassets/3d/weapon");
  const m = kit.make(n);
  if (!m) { console.log("no mesh", n); return; }
  m.material = i % 2 ? grp : dark;
  const size = kit.size(n);
  const s = 1.6 / Math.max(size.z, 0.001);
  m.scale.setScalar(s);
  m.position.set((i - 3.5) * 1.9, 0.5, 0);
  m.rotation.y = Math.PI / 2;
  scene.add(m);
});
scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 10, 12); scene.add(key);
const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 60);
cam.position.set(0, 2.4, 9.5); cam.lookAt(0, 0.6, 0); cam.updateMatrixWorld();
const W = 1100, H = 340;
const { color } = rasterize(scene, cam, { width: W, height: H, defaultLighting: false });
for (let i = 0; i < W * H * 3; i++) color[i] = Math.pow(Math.min(1, color[i] / (1 + color[i]) * 1.5), 1 / 2.2);
fs.writeFileSync("/tmp/weapons.png", encodePNG(W, H, color));
console.log("wrote /tmp/weapons.png");
