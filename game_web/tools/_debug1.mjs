import { Combat } from "../src/combat.js";
import { Run } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";

const run = new Run();
run.wave = 1;
const { enemies: bodies } = run.beginWave();
const enemies = { live: [], damage(e, n) { if (e.dead) return null; e.stats.health -= n; if (e.stats.health <= 0) { e.dead = true; return "killed"; } return "hit"; } };
enemies.live = bodies.map((b, i) => ({
  stats: { ...b }, root: { position: { x: (i % 3) * 1.2 - 1.2, y: b.flyHeight ?? 0, z: -0.65 } },
  height: b.height, dead: false,
}));
const world = { player: { x: 0, z: 0, yaw: 0, feetY: 0 }, emit(){}, hearSound(){} };
const combat = new Combat({ world, run, enemies, feel: new CombatFeel({navigator:{vibrate:()=>true}}) });
console.log("weapon:", run.loadout.weapon.id, "reach", run.loadout.weapon.reach, "ammo", run.loadout.roundsLeft());
console.log("bodies:", enemies.live.length, "hp", enemies.live.map(b=>b.stats.health).join(","), "heights", enemies.live.map(b=>b.height).join(","));
const t = combat.findTarget(run.loadout.weapon);
console.log("findTarget ->", t ? `found hp=${t.stats.health}` : "NULL");
let fired = 0, guard = 0;
while (enemies.live.some(b => !b.dead) && guard++ < 500) {
  const r = combat.fire(0.05);
  if (r && !r.dry) fired++;
  run.loadout.tick(0.05);
}
console.log("iterations", guard, "real fires", fired, "hits", combat.hits, "misses", combat.misses);
console.log("still alive:", enemies.live.filter(b=>!b.dead).map(b=>`${b.stats.archetype}:${b.stats.health}`).join(" "));
console.log("cooldown", run.loadout.cooldown, "ammo", run.loadout.roundsLeft(), "current", run.loadout.current);
