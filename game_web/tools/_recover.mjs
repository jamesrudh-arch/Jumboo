// Scratch: die, retry, clear, advance. The loop a player actually lives.
import { Arena } from "../src/arena.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";

class DiskLoader {
  async loadAsync(url) {
    const buf = fs.readFileSync(url);
    return new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength), "", res, rej));
  }
}
const arena = new Arena();
arena.factory.loader = new DiskLoader();
await arena.preload();
const world = { player:{x:0,z:0,yaw:0,feetY:0,crouch:0,speed:0}, camera:{x:0,y:2,z:4}, emit(){}, hearSound(){}, groundAt:()=>0 };
arena.attach({add(){}}, world);
let events = [];
arena.handlers.onDeath = (e) => events.push(`death@wave${e.wave}`);
arena.handlers.onWaveEnd = (e) => events.push(`clear@wave${e.wave}`);

arena.startWave();
arena.run.takeDamage(200); // die
console.log("after death:", arena.run.state, "wave", arena.run.wave, "inWave", arena.inWave);
const r = arena.retry();
console.log("retry -> restored hp", arena.run.health, "bodies", r.count, "wave", arena.run.wave, "inWave", arena.inWave);

// Kill everything directly to clear the wave.
for (const e of [...arena.wave.live]) arena.wave.damage(e, 9999);
for (let i = 0; i < 4; i++) arena.step(1/60);
console.log("after clear:", arena.run.state, "wave", arena.run.wave, "offer:", arena.run.lastOffer?.map(o=>o.label).join(" | "));

const adv = arena.advance(arena.run.lastOffer.find(o=>o.kind==="weapon"));
console.log("advance -> wave", arena.run.wave, arena.run.beginWave ? "" : "", "bodies", adv.count, "held", arena.run.loadout.current, "scene bodies", arena.wave.live.length);
console.log("events:", events.join(", "));
console.log("corpses handled:", arena.wave.corpses.length);
