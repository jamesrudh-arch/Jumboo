// Scratch: does the hand-out schedule actually pace the fights?
import { WAVES, waveHealth, statLine, ARCHETYPES } from "../src/enemies.js";
import { tierForWave, rewardForWave } from "../src/progression.js";
import { resolveHit, weaponById } from "../src/arsenal.js";

console.log("wave  weapon            TTK (s)  shots  drop  reserve  verdict");
for (const w of WAVES) {
  const gun = rewardForWave(w.n);
  const tier = tierForWave(w.n);
  // Face the toughest body in the wave, at half the weapon's reach.
  const kinds = w.spawn.map(s => s.archetype);
  const toughest = kinds.map(k => statLine(k, 1)).sort((a,b) => (b.health*(1-b.armour*0.5)) - (a.health*(1-a.armour*0.5)))[0];
  const dist = Math.min(2, gun.reach * 0.5);
  const hit = resolveHit(gun, { distance: dist, armour: toughest.armour });
  const shots = Math.ceil(toughest.health / Math.max(1, hit.damage));
  const ttk = (shots * gun.rate).toFixed(1);
  const drop = Number.isFinite(gun.ammo) ? gun.ammo : Infinity;
  const total = Number.isFinite(gun.ammo) ? gun.ammo + (gun.reserve ?? 0) : Infinity;
  const bodies = w.spawn.reduce((n,s)=>n+(ARCHETYPES[s.archetype].spawns??1)*s.count,0);
  let verdict = "ok";
  if (Number.isFinite(drop) && drop < shots) verdict = "RELOADS MID-TARGET";
  if (ttk > 12) verdict = "sluggish";
  console.log(`  ${String(w.n).padStart(2)}  ${gun.name.padEnd(18)}${ttk.padStart(6)}${String(shots).padStart(7)}${String(drop).padStart(6)}${String(total).padStart(8)}  ${verdict} (${bodies} bodies, tier ${tier})`);
}
