// Boss tests.
//
// The claim these hold to account is narrow and important: a boss is a rule the
// player can learn, not a health bar. So the tests are about telegraphs, phases
// and punish windows — not about hit points.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BOSSES, BOSS_WAVES, bossForWave, bossStats, phaseAt, phaseCrossed,
  BOSS_ACTION, tickBossAction, beginBossAction, telegraphSeconds,
} from "../src/bosses.js";

test("there are three bosses, one per act", () => {
  const ids = Object.keys(BOSSES);
  assert.equal(ids.length, 3);
  for (const id of ids) {
    const b = BOSSES[id];
    assert.ok(b.name && b.title && b.phases.length >= 2, `${id} is fleshed out`);
  }
});

test("each boss appears on exactly one wave, and they are spread apart", () => {
  const waves = Object.keys(BOSS_WAVES).map(Number).sort((a, b) => a - b);
  assert.deepEqual(waves, [10, 20, 30]);
  for (const n of [1, 5, 9, 11, 19, 25, 31]) {
    assert.equal(bossForWave(n), null, `wave ${n} is a normal wave`);
  }
  assert.equal(bossForWave(10).id, "enforcer");
  assert.equal(bossForWave(30).id, "warden");
});

test("a boss is much tougher than the body it is built from", () => {
  for (const boss of Object.values(BOSSES)) {
    const stats = bossStats(boss);
    assert.ok(stats.health > 400, `${boss.id} has ${stats.health} health`);
    assert.ok(stats.attack.windup >= 0.5, `${boss.id} telegraphs for ${stats.attack.windup}s`);
    assert.ok(stats.height > 2, "and it is tall enough to read as a boss");
  }
});

test("a boss scales with the wave it is replayed on", () => {
  const boss = BOSSES.enforcer;
  const a = bossStats(boss, 1);
  const b = bossStats(boss, 1.5);
  assert.ok(b.health > a.health);
  assert.equal(a.attack, boss.attack, "but its rules do not change");
});

test("a boss ignores the takedown, and that is stated not implied", () => {
  // A one-button kill on a boss would make the whole fight pointless.
  assert.equal(bossStats(BOSSES.enforcer).ignoresTakedown, true);
  assert.equal(bossStats(BOSSES.warden).ignoresTakedown, true);
  assert.equal(bossStats(BOSSES.marksman).ignoresTakedown, false, "the marksman can be flanked");
});

test("phases are ordered from full health down and all reachable", () => {
  for (const boss of Object.values(BOSSES)) {
    const at = boss.phases.map((p) => p.at);
    assert.deepEqual(at, [...at].sort((a, b) => b - a), `${boss.id} phases descend`);
    assert.equal(at[0], 1.0, "the first phase is the whole bar");
    for (const threshold of at) assert.ok(threshold > 0 && threshold <= 1);
  }
});

test("phaseAt reports the right phase across the whole bar", () => {
  const boss = BOSSES.enforcer;
  assert.equal(phaseAt(boss, 1.0).name, "Advance");
  assert.equal(phaseAt(boss, 0.8).name, "Advance");
  assert.equal(phaseAt(boss, 0.5).name, "Bloodied");
  assert.equal(phaseAt(boss, 0.1).name, "Cornered");
});

test("a phase is announced once, on the frame it changes", () => {
  const boss = BOSSES.enforcer;
  assert.equal(phaseCrossed(boss, 0.6, 0.5)?.name, "Bloodied", "crossing announces");
  assert.equal(phaseCrossed(boss, 0.5, 0.4), null, "staying in a phase is silent");
  assert.equal(phaseCrossed(boss, 0.9, 0.8), null);
});

test("a hit that kills in one blow crosses straight to the deep phase", () => {
  const boss = BOSSES.enforcer;
  const phase = phaseCrossed(boss, 1.0, 0.1);
  assert.equal(phase.name, "Cornered");
});

test("an attack telegraphs before it lands, and telegraphs are long enough to react to", () => {
  const boss = BOSSES.enforcer;
  const clock = beginBossAction();
  const windup = telegraphSeconds(boss);
  assert.ok(windup >= 0.5, `${windup}s is a human reaction plus a decision`);

  // During the wind-up, nothing lands. Step whole frames up to the wind-up
  // boundary rather than accumulating a float and hoping it lands short.
  const frames = Math.floor((windup - 1 / 60) * 60);
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    if (tickBossAction(clock, boss.attack, 1 / 60).hit) hits++;
  }
  assert.equal(hits, 0, `no damage during ${frames} wind-up frames`);
  assert.equal(clock.state, BOSS_ACTION.windup, "still winding up");

  // Then exactly one blow.
  let landed = 0;
  for (let i = 0; i < 20; i++) if (tickBossAction(clock, boss.attack, 1 / 60).hit) landed++;
  assert.equal(landed, 1, "the strike lands exactly once");
});

test("a punish window exists after the strike", () => {
  const boss = BOSSES.warden;
  const clock = beginBossAction();
  // Run through windup and strike.
  const frames = Math.ceil((telegraphSeconds(boss) + 0.2) * 60);
  for (let i = 0; i < frames; i++) tickBossAction(clock, boss.attack, 1 / 60);
  assert.equal(clock.state, BOSS_ACTION.recover, "it is recovering");
  // And the recovery is long enough to be worth taking.
  const recover = boss.attack.recover ?? 0.9;
  assert.ok(recover >= 0.8, `${recover}s is enough for a reload or a swing`);
});

test("an idle boss does nothing", () => {
  const clock = { state: BOSS_ACTION.idle, t: 0 };
  const out = tickBossAction(clock, BOSSES.enforcer.attack, 1 / 60);
  assert.equal(out.hit, false);
  assert.equal(out.state, BOSS_ACTION.idle);
});

test("every boss attack has a wind-up, so no boss can hit instantly", () => {
  for (const boss of Object.values(BOSSES)) {
    assert.ok(boss.attack.windup >= 0.5, `${boss.id} windup ${boss.attack.windup}`);
    assert.ok(boss.attack.recover >= 0.7, `${boss.id} recover ${boss.attack.recover}`);
  }
});

test("the boss models exist in the repository", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(new URL("../assets/arsenal/enemies/", import.meta.url));
  for (const boss of Object.values(BOSSES)) {
    assert.ok(files.includes(`${boss.model}.glb`), `${boss.model}.glb is vendored`);
  }
});
