// Progression tests: the rules that tie the ladder to the roster.

import test from "node:test";
import assert from "node:assert/strict";

import {
  tierForWave, rewardForWave, offerFor, Run, curveTable,
} from "../src/progression.js";
import { Loadout, weaponById } from "../src/arsenal.js";
import { WAVES } from "../src/enemies.js";

test("the tier curve starts at nothing and rises", () => {
  assert.equal(tierForWave(1), 0, "a first wave is fought with fists");
  let prev = -1;
  for (let w = 1; w <= 12; w++) {
    const t = tierForWave(w);
    assert.ok(t >= prev, `tier at wave ${w} does not fall`);
    prev = t;
  }
});

test("the tier lags the wave: the weapon answers the problem you just met", () => {
  // By wave 3 a player has a pistol, but not the rifle they will need at 8.
  assert.equal(rewardForWave(3).id, "pistol");
  assert.equal(rewardForWave(8).id, "sniper");
  assert.notEqual(rewardForWave(3).id, rewardForWave(8).id);
});

test("the reward ladder is monotonic and never regresses", () => {
  const order = ["fists", "knife", "pistol", "pistolSilencer", "uzi", "shotgun",
    "sniper", "machinegun", "flamethrower", "rocketlauncher"];
  let last = -1;
  for (let w = 1; w <= 11; w++) {
    const id = rewardForWave(w).id;
    const at = order.indexOf(id);
    assert.ok(at >= last, `wave ${w} rewards ${id}, which is behind an earlier wave`);
    last = at;
  }
});

test("the early frag never blocks a later reward", () => {
  // Regression: the frag unlocks at tier 3 and used to outrank everything by
  // sort order, so waves 5 through 10 all "rewarded" a grenade.
  for (let w = 5; w <= 10; w++) {
    assert.notEqual(rewardForWave(w).id, "grenade", `wave ${w} must not reward the frag`);
  }
});

test("a run begins with fists and no kills", () => {
  const run = new Run();
  assert.equal(run.loadout.current, "fists");
  assert.equal(run.kills, 0);
  assert.equal(run.state, "briefing");
});

test("beginning a wave raises the tier and builds bodies", () => {
  const run = new Run();
  run.wave = 6;
  const { enemies, threat, wave } = run.beginWave();
  assert.equal(run.state, "fighting");
  assert.ok(run.loadout.has("uzi"), "tier 4 is held at wave 6");
  assert.ok(enemies.length > 0);
  assert.ok(threat > 0);
  assert.equal(wave.n, 6);
  // The bodies carry their own stats, so the world needs no lookup table.
  assert.ok(enemies[0].health > 0);
  assert.ok(enemies[0].archetype);
});

test("waves scale their bodies with the lap counter", () => {
  const early = new Run(); early.wave = 1; early.loadout.raiseTier(0);
  const late = new Run(); late.wave = 21;
  const a = early.beginWave().enemies;
  const b = late.beginWave().enemies;
  assert.ok(b[0].health > a[0].health, "a second-lap body is tougher");
});

test("quiet kills are worth more than loud ones", () => {
  const loud = new Run(); loud.wave = 4;
  const quiet = new Run(); quiet.wave = 4;
  const a = loud.registerKill({ archetype: "watcher", quiet: false });
  const b = quiet.registerKill({ archetype: "watcher", quiet: true });
  assert.ok(b > a, `quiet ${b} should beat loud ${a}`);
  assert.equal(quiet.quietKills, 1);
});

test("a bigger enemy is worth more", () => {
  const run = new Run();
  const pack = run.registerKill({ archetype: "pack" });
  const brute = run.registerKill({ archetype: "brute" });
  assert.ok(brute > pack * 3);
});

test("health floors at zero and the player goes down", () => {
  const run = new Run();
  run.takeDamage(40);
  assert.equal(run.health, 60);
  run.takeDamage(500);
  assert.equal(run.health, 0);
  // Down, not dead: there is a bleed-out window and two revives.
  assert.equal(run.state, "down");
  assert.ok(run.downTimer > 0);
});

test("a run with no revives left dies at zero", () => {
  const run = new Run({ deathsAllowed: 0 });
  run.takeDamage(500);
  assert.equal(run.state, "dead");
});

test("bleeding out runs the clock down to a real death", () => {
  const run = new Run({ deathsAllowed: 1 });
  run.takeDamage(500);
  assert.equal(run.state, "down");
  run.tickDown(1);
  assert.equal(run.state, "down", "still holding on");
  run.tickDown(20);
  assert.equal(run.state, "dead", "the clock ran out");
});

test("a cleared wave revives a downed player on a third of their health", () => {
  const run = new Run({ deathsAllowed: 1 });
  run.takeDamage(500);
  run.revive();
  assert.equal(run.state, "between");
  assert.equal(run.health, 35);
  assert.equal(run.downTimer, 0);
});

test("revives are limited, so being downed is not toothless", () => {
  const run = new Run({ deathsAllowed: 2 });
  run.takeDamage(500); run.revive();
  run.takeDamage(500); run.revive();
  assert.equal(run.deathsAllowed, 0);
  run.takeDamage(500);
  assert.equal(run.state, "dead", "the third down is final");
});

test("a downed player cannot be damaged further", () => {
  const run = new Run();
  run.takeDamage(500);
  const hp = run.health;
  run.takeDamage(500);
  assert.equal(run.health, hp, "the bleed-out clock is the only thing running");
});

test("healing never passes the maximum", () => {
  const run = new Run({ health: 100 });
  assert.equal(run.heal(999), 100);
  run.takeDamage(30);
  assert.equal(run.heal(10), 80);
});

test("the between-wave offer is three meaningful choices", () => {
  const l = new Loadout({ tier: 0 });
  const offer = offerFor({ waveNumber: 2, loadout: l });
  assert.ok(offer.length >= 2);
  assert.ok(offer.some((o) => o.kind === "weapon"));
  assert.ok(offer.some((o) => o.kind === "health"));
});

test("taking a weapon option actually equips it", () => {
  const run = new Run();
  run.endWave();
  const weaponOffer = run.lastOffer.find((o) => o.kind === "weapon");
  assert.ok(weaponOffer, "wave 2 offers a weapon");
  assert.ok(run.take(weaponOffer));
  assert.equal(run.loadout.current, weaponOffer.id);
});

test("taking ammo refills the held weapon from reserve", () => {
  const run = new Run();
  run.loadout.raiseTier(2);
  run.loadout.select("pistol");
  for (let i = 0; i < 8; i++) { run.loadout.use(); run.loadout.tick(run.loadout.weapon.rate); }
  const offer = { kind: "ammo", id: "pistol" };
  assert.ok(run.take(offer));
  assert.equal(run.loadout.roundsLeft(), 12, "topped up to a full magazine");
});

test("the curve table matches the wave table", () => {
  const table = curveTable();
  assert.equal(table.length, WAVES.length);
  let prev = 0;
  for (const row of table) {
    assert.ok(row.threat > prev, `wave ${row.wave} threat rises`);
    prev = row.threat;
    assert.ok(row.reward, `wave ${row.wave} has a reward`);
  }
});

test("snapshot is renderable and does not leak internals", () => {
  const run = new Run();
  run.beginWave();
  const s = run.snapshot();
  assert.equal(typeof s.wave, "number");
  assert.equal(typeof s.health, "number");
  assert.ok(s.weapon.id);
  assert.equal(JSON.stringify(s).includes("Map"), false, "no raw Maps leak into the HUD");
});
