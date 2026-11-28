import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { Arena } from "../src/arena.js";
import fs from "node:fs";
class D { async loadAsync(u){const b=fs.readFileSync(u);return new Promise((r,j)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),"",r,j));} }
const arena=new Arena(); arena.factory.loader=new D(); await arena.preload();
const world={player:{x:0,z:0,yaw:0,feetY:0,crouch:0,speed:0},camera:{x:0,y:2,z:4},emit(){},hearSound(){},groundAt:()=>0};
arena.attach({add(){}},world);
arena.startWave();
const t=arena.wave.live[0];
t.root.position.set(0,0,-0.8);
console.log("target", t.stats.archetype, "hp", t.stats.health, "at", t.root.position.x, t.root.position.z);
console.log("weapon", arena.run.loadout.weapon.id, "reach", arena.run.loadout.weapon.reach);
console.log("combat target:", arena.combat.findTarget(arena.run.loadout.weapon) ? "found" : "NULL");
let n=0, fired=0;
while (arena.wave.alive>0 && n<400) { const r=arena.fire(1/60); if(r&&!r.dry) fired++; arena.step(1/60); n++; }
console.log("steps", n, "fired", fired, "alive", arena.wave.alive, "kills", arena.run.kills, "hits", arena.stats.hits);
console.log("bodies", arena.wave.live.map(e=>`${e.stats.archetype}:${e.stats.health}hp@${Math.hypot(e.root.position.x,e.root.position.z).toFixed(1)}m`).join(" "));
