// Scratch: play all ten waves headless and report what happens.
import { Combat } from "../src/combat.js";
import { Run, rewardForWave } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";
import { statLine, ARCHETYPE } from "../src/enemies.js";

function fakeEnv() { return { navigator: { vibrate: () => true } }; }
const audioLog = [];
const audio = { playEvent: (e) => { audioLog.push(e.type); return true; } };

const run = new Run();
const feel = new CombatFeel(fakeEnv());
const events = [];
const world = {
  player: { x: 0, z: 0, yaw: 0, feetY: 0 },
  emit: (t, d) => events.push({ t, ...d }),
  hearSound: () => {},
};

const stats = { waves: [], kills: 0, shots: 0, reloads: 0, damageTaken: 0, quiet: 0 };
const waveRows = [];
const enemies = { live: [], damage(e, n) { if (e.dead) return null; e.stats.health -= n; if (e.stats.health <= 0) { e.dead = true; return "killed"; } return "hit"; } };
const combat = new Combat({ world, run, enemies, feel, audio });

for (let waveNo = 1; waveNo <= 10; waveNo++) {
  run.wave = waveNo;
  const { wave, enemies: bodies } = run.beginWave();
  // Place bodies at half the reward weapon's reach, on the facing axis.
  const gun = rewardForWave(waveNo);
  // The between-wave offer equips the reward; make the harness do the same.
  if (run.loadout.has(gun.id)) run.loadout.select(gun.id);
  const dist = Math.max(1, Math.min(gun.reach * 0.5, 6));
  // Mutate the list Combat already holds. Reassigning it was the harness's own
  // bug: the first wave's array stayed bound to the Combat instance forever.
  enemies.live.length = 0;
  enemies.live.push(...bodies.map((b, i) => ({
    stats: { ...b },
    root: { position: { x: ((i % 5) - 2) * 0.9, y: b.flyHeight ?? 0, z: -dist } },
    height: b.height,
    dead: false,
  })));
  let guard = 0;
  const shotsAtStart = combat.hits + combat.misses;
  let waveShots = 0, waveDmg = 0;
  let maxHealth = run.health;
  while (enemies.live.some(b => !b.dead) && guard++ < 4000) {
    // Player takes a bite each cycle from the nearest live body, so health means something.
    if (guard % 14 === 0) {
      const alive = enemies.live.filter(b => !b.dead);
      if (alive.length) { const dmg = Math.max(1, Math.round((alive[0].attack?.power ?? 6) * 0.35)); const before = run.health; run.takeDamage(dmg); waveDmg += before - run.health; }
    }
    if (run.health <= 0) { run.health = maxHealth * 0.6; } // restart-from-checkpoint in the slice
    const had = run.loadout.roundsLeft();
    const r = combat.fire(0.05);
    waveShots++;
    run.loadout.tick(0.05);
    if (had === 0 && combat.reload() > 0) { stats.reloads++; waveShots += 2; }
    if (!r) run.loadout.tick(0.1);
  }
  stats.kills += run.kills;
  stats.shots += combat.hits + combat.misses - shotsAtStart;
  stats.quiet = run.quietKills;
  waveRows.push({
    wave: waveNo, weapon: gun.name, bodies: bodies.length,
    shots: combat.hits + combat.misses - shotsAtStart,
    damage: waveDmg, hp: run.health, score: run.score,
    resolved: enemies.live.every(b => b.dead),
  });
  const offer = run.endWave();
  const pick = offer.find(o => o.kind === "weapon") ?? offer[0];
  run.take(pick);
}

console.log("wave  weapon            bodies  shots  dmgTaken  hp  resolved  score");
for (const r of waveRows) {
  console.log(`  ${String(r.wave).padStart(2)}  ${r.weapon.padEnd(18)}${String(r.bodies).padStart(6)}${String(r.shots).padStart(7)}${r.damage.toFixed(1).padStart(9)}${r.hp.toFixed(0).padStart(5)}${String(r.resolved).padStart(9)}${String(r.score).padStart(7)}`);
}
console.log(`\ntotal: ${run.kills} kills (${run.quietKills} quiet), ${stats.shots} shots, ${stats.reloads} reloads, score ${run.score}`);
console.log(`sounds played: ${audioLog.length} (${[...new Set(audioLog)].join(", ")})`);
console.log(`decals live: ${feel.decals.count}, shake at rest: ${feel.shake.trauma.toFixed(3)}`);
