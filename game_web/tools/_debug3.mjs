import { Combat } from "../src/combat.js";
import { Run } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";
import { statLine } from "../src/enemies.js";

const run = new Run(); run.wave = 2;
run.loadout.raiseTier(1); run.loadout.select("knife");
const w = run.loadout.weapon;
console.log(`knife: reach ${w.reach} rate ${w.rate} noise ${w.noise}`);
for (const [arch, h] of [["pack",0.5],["watcher",1.8]]) {
  const st = statLine(arch,1);
  const e = { stats: { ...st }, root: { position: { x: 0, y: 0, z: -0.9 } }, height: h, dead: false };
  const enemies = { live: [e], damage(t,n){ t.stats.health-=n; if(t.stats.health<=0){t.dead=true;return "killed";} return "hit"; } };
  const combat = new Combat({ world:{player:{x:0,z:0,yaw:0,feetY:0},emit(){},hearSound(){}}, run, enemies, feel:new CombatFeel({navigator:{vibrate:()=>true}}) });
  const found = combat.findTarget(w);
  console.log(`${arch.padEnd(8)} hp ${st.health} at 0.9m -> ${found ? "in reach" : "NOT in reach (vertical gate)"}`);
  if (found) {
    let n=0; while(!e.dead && n<200){ combat.fire(0.05); run.loadout.tick(0.05); n++; }
    console.log(`           dies in ${n} swings, ${e.stats.health} hp left`);
  }
}
