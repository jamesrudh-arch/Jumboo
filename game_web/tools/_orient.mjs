// Scratch: prove the orientation heuristic on the real pack bounds.
import { makeKenneyKit } from "./_kkit.mjs";
const MARGIN = 1.25;
function dominant(size) {
  if (size.y > size.z * MARGIN && size.y >= size.x) return "y";
  if (size.x > size.z * MARGIN && size.x > size.y) return "x";
  return "z";
}
const names = ["pistol","pistolSilencer","uzi","shotgun","sniper","machinegun",
  "flamethrower_long","rocketlauncher","knife_sharp","grenade","blaster-d"];
const kit = makeKenneyKit("weapon", names, "assets/arsenal/weapons");
console.log("model               longest naive   chosen   verdict");
for (const n of names) {
  if (!kit.has(n)) continue;
  const s = kit.size(n);
  const naive = s.y >= s.x && s.y >= s.z ? "y" : (s.z >= s.x ? "z" : "x");
  const chosen = dominant(s);
  const verdict = naive === chosen ? (chosen === "z" ? "authored along Z" : `needs a ${chosen} turn`) : `RESCUED from naive ${naive}`;
  console.log(n.padEnd(20), naive.padEnd(14), chosen.padEnd(8), verdict);
}
