// Scratch: a real headless wave — bodies load, close in, hit the player, die.
import { Arena } from "../src/arena.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
import { join } from "node:path";

class DiskLoader {
  async loadAsync(url) {
    const buf = fs.readFileSync(url);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
  }
}
const arena = new Arena();
arena.factory.loader = new DiskLoader();
await arena.preload();
console.log("cast:", JSON.stringify(arena.report().cast));
const scene = { add(){}, remove(){} };
let groundCalls = 0;
const world = {
  player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
  camera: { x: 0, y: 2, z: 4 }, emit(){}, hearSound(){},
  groundAt: (x, z) => { groundCalls++; return 0; },
};
arena.attach(scene, world);
arena.handlers.onWaveStart = (w) => console.log(`  wave ${w.n}: ${w.name}`);
arena.handlers.onWaveEnd = (e) => console.log(`  wave ${e.wave} cleared, offer: ${e.offer.map(o=>o.label).join(" | ")}`);
arena.handlers.onDeath = () => console.log("  player died");

const info = arena.startWave();
console.log(`spawned ${info.count} bodies at ${arena.wave.live.map(e=>`(${e.root.position.x.toFixed(1)},${e.root.position.z.toFixed(1)} ${e.stats.archetype})`).join(" ")}`);

// Stand still and let the pack come. Player does not fight back: this measures
// how fast the street can hurt an idle player, which should be non-trivial.
let t = 0, dealt = 0;
while (t < 30 && arena.wave.alive > 0) {
  arena.step(1/60); t += 1/60;
  if (arena.run.health <= 0) break;
}
console.log(`after ${t.toFixed(1)}s standing still: player hp ${arena.run.health}, damage taken ${arena.stats.damageTaken}`);
console.log(`bodies still alive: ${arena.wave.alive}, states: ${arena.wave.live.map(e=>e.current).join(",")}`);
const dist = arena.wave.live.map(e => Math.hypot(e.root.position.x - world.player.x, e.root.position.z - world.player.z).toFixed(2));
console.log(`distances now: ${dist.join(", ")} (each started 9-18m out)`);

// Now fight: fists, since wave 1 should be fisticuffs.
let swings = 0;
while (arena.wave.alive > 0 && t < 120) {
  arena.fire(1/60); arena.step(1/60); t += 1/60; swings++;
  if (arena.run.health <= 0) { arena.run.health = 30; }
}
console.log(`used ${swings} trigger pulls; kills ${arena.stats.kills}; shots ${arena.stats.shots}; hits ${arena.stats.hits}`);
console.log(`wave over: ${!arena.inWave}, run wave now ${arena.run.wave}, state ${arena.run.state}`);
console.log(`shake trauma ${arena.feel.shake.trauma.toFixed(3)}, decals ${arena.feel.decals.count}`);
