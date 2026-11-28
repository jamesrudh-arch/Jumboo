import { Combat } from "../src/combat.js";
import { Run } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";
import { statLine } from "../src/enemies.js";

const run = new Run(); run.wave = 1;
const mk = (x, z) => ({ stats: statLine("pack", 1), root: { position: { x, y: 0, z } }, height: 0.5, dead: false });
const enemies = { live: [], damage(e, n) { if (e.dead) return null; e.stats.health -= n; if (e.stats.health <= 0) { e.dead = true; return "killed"; } return "hit"; } };
// The five pack bodies, exactly as the world spawns them: 0.45 m tall, around the player.
enemies.live = [mk(-1.2, -0.65), mk(0, -0.65), mk(1.2, -0.65), mk(-0.6, -4), mk(0.6, -4)];
const world = { player: { x: 0, z: 0, yaw: 0, feetY: 0 }, emit(){}, hearSound(){} };
const combat = new Combat({ world, run, enemies, feel: new CombatFeel({navigator:{vibrate:()=>true}}) });
console.log("fists reach:", run.loadout.weapon.reach);
for (const b of enemies.live) {
  const d = Math.hypot(b.root.position.x, b.root.position.z);
  const dy = Math.abs(0.25 - 1.1);
  console.log(`  body at dist ${d.toFixed(2)} dy ${dy.toFixed(2)} -> ${combat.findTarget(run.loadout.weapon) ? "reachable" : "no"}`);
  break;
}
console.log("nearest target:", combat.findTarget(run.loadout.weapon)?.stats.archetype ?? "NULL");
let n = 0, hits0 = 0;
while (enemies.live.some(b => !b.dead) && n++ < 300) {
  const before = combat.hits;
  combat.fire(0.05); run.loadout.tick(0.05);
  if (combat.hits > before) hits0++;
}
console.log("iterations", n, "hits", combat.hits, "alive", enemies.live.filter(b=>!b.dead).length, "hp", enemies.live.filter(b=>!b.dead).map(b=>b.stats.health).join(","));
