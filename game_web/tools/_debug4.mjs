import { Combat } from "../src/combat.js";
import { Run } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";
import { statLine } from "../src/enemies.js";

// Exactly wave 2's composition, at wave 2's spawn distance.
const run = new Run(); run.wave = 1;
const { enemies: bodies } = run.beginWave();
run.wave = 2;
const g = run.beginWave(); // builds wave 2 bodies, raises tier
run.loadout.select("knife");
const gun = run.loadout.weapon;
const dist = Math.max(1, Math.min(gun.reach * 0.5, 6));
console.log("wave 2 reward weapon:", gun.id, gun.name, "spawn dist", dist);
const waveBodies = g.enemies;
console.log("bodies:", waveBodies.map(b => `${b.archetype}(${b.health}hp,h${b.height},fly${b.flyHeight??0})`).join(" "));
const enemies = { live: [], damage(e,n){ if(e.dead) return null; e.stats.health-=n; if(e.stats.health<=0){e.dead=true;return "killed";} return "hit"; } };
enemies.live.push(...waveBodies.map((b,i)=>({ stats:{...b}, root:{position:{x:((i%5)-2)*0.9, y:b.flyHeight??0, z:-dist}}, height:b.height, dead:false })));
const combat = new Combat({ world:{player:{x:0,z:0,yaw:0,feetY:0},emit(){},hearSound(){}}, run, enemies, feel:new CombatFeel({navigator:{vibrate:()=>true}}) });
const reachable = enemies.live.map(b => combat.findTarget(gun) === b);
let n=0;
while (enemies.live.some(b=>!b.dead) && n++<300) { combat.fire(0.05); run.loadout.tick(0.05); }
const alive = enemies.live.filter(b=>!b.dead);
console.log("after 300 swings: alive", alive.length, alive.map(b=>`${b.stats.archetype} hp${b.stats.health} at z${b.root.position.z.toFixed(1)} y${b.root.position.y}`).join(", "));
console.log("hits", combat.hits, "misses", combat.misses, "kills", run.kills);
