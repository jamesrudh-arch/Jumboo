// Scratch: does the real skinned pipeline work headless?
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { EnemyFactory } from "../src/enemyview.js";
import { ARCHETYPES } from "../src/enemies.js";
import fs from "node:fs";

class NodeLoader {
  constructor() { this.base = "./assets/arsenal/enemies"; }
  async loadAsync(url) {
    const buf = fs.readFileSync(url);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const loader = new GLTFLoader();
    return new Promise((res, rej) => loader.parse(ab, "", res, rej));
  }
}
const factory = new EnemyFactory({ loader: new NodeLoader() });
const stats = await factory.preload(ARCHETYPES, (p, m) => {});
console.log("preload:", JSON.stringify(stats));
console.log("failed:", [...factory.failed]);

for (const [name, def] of Object.entries(ARCHETYPES)) {
  try {
    const e = factory.spawn({ ...def, archetype: name });
    if (!e) { console.log(name, "spawn returned null"); continue; }
    const box = new THREE.Box3().setFromObject(e.root);
    const h = box.max.y - box.min.y;
    console.log(`${name.padEnd(9)} fallback=${String(e.isFallback).padEnd(5)} clips=${Object.keys(e.actions).length} height=${h.toFixed(2)}m (want ${def.height}) state=${e.current}`);
    for (let i = 0; i < 5; i++) { e.tick(0.016); }
    e.die();
    for (let i = 0; i < 200; i++) e.tick(0.016);
    e.dispose();
  } catch (err) { console.log(name, "THREW:", err.message); }
}
