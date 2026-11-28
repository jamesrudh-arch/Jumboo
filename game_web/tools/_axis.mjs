// Scratch: which axis is each weapon long on? Feeds LENGTH/orientFromBounds.
import { makeKenneyKit } from "./_kkit.mjs";
const names = ["pistol","pistolSilencer","uzi","shotgun","sniper","machinegun",
  "flamethrower_long","rocketlauncher","knife_sharp","grenade","blaster-d","blaster-a"];
const kit = makeKenneyKit("weapon", names, "assets/arsenal/weapons");
console.log("model                 axis   size (m)");
for (const n of names) {
  if (!kit.has(n)) { console.log(n.padEnd(22), "MISSING"); continue; }
  const s = kit.size(n);
  const axis = s.y >= s.x && s.y >= s.z ? "y" : (s.z >= s.x ? "z" : "x");
  console.log(n.padEnd(22), axis.padEnd(6),
    `x=${s.x.toFixed(3)} y=${s.y.toFixed(3)} z=${s.z.toFixed(3)}`);
}
