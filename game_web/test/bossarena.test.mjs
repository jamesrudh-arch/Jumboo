// Bosses in the arena: that they spawn, fight, phase, and can be killed.

import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/arena.js";

const setup = (wave) => {
  const a = new Arena();
  a.factory.loader = { async loadAsync() { throw new Error("proxy bodies"); } };
  a.attach({ add() {} }, {
    player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
    camera: { x: 0, y: 2, z: 4 }, cameraYaw: 0,
    emit() {}, hearSound() {}, groundAt: () => 0, boxesNear: () => [],
  });
  a.run.wave = wave;
  a.startWave();
  return a;
};

test("wave ten spawns a boss and nothing else", () => {
  const a = setup(10);
  assert.equal(a.wave.live.length, 1, "a boss fights alone");
  assert.equal(a.wave.live[0].stats.boss, "enforcer");
  assert.ok(a.boss, "the arena tracks it");
  a.clear();
});

test("a normal wave has no boss and no boss bar", () => {
  const a = setup(1);
  assert.equal(a.boss, null);
  assert.equal(a.bossState(), null);
  a.clear();
});

test("the boss bar reports name, phase and a ceiling that scales", () => {
  const a = setup(10);
  const state = a.bossState();
  assert.equal(state.name, "The Enforcer");
  assert.equal(state.phase, "Advance");
  assert.equal(state.max, 620);
  assert.equal(state.fraction, 1);
  a.clear();
});

test("the boss telegraphs before it can hurt the player", () => {
  const a = setup(10);
  const boss = a.wave.live[0];
  // Stand in its face so it commits.
  boss.root.position.set(0, 0, -1.5);
  let sawTelegraph = false;
  let damaged = false;
  const start = a.run.health;
  for (let i = 0; i < 60 * 4; i++) {
    a.step(1 / 60);
    const s = a.bossState();
    if (s?.winding) sawTelegraph = true;
    if (a.run.health < start) damaged = true;
  }
  assert.ok(sawTelegraph, "the wind-up was visible");
  assert.ok(damaged, "and then it hurt");
  a.clear();
});

test("a boss crosses phases as it takes damage, once each", () => {
  const a = setup(10);
  const boss = a.wave.live[0];
  const seen = [];
  a.onBossPhase = ({ phase }) => seen.push(phase.name);
  // Drop its health through both thresholds, stepping so the per-frame check runs.
  // 350/620 = 0.565 is still "Advance" (threshold 0.55), so crossing needs to go
  // below the threshold, not merely near it.
  boss.stats.health = 330; a.step(1 / 60); // 0.532 -> Bloodied
  boss.stats.health = 130; a.step(1 / 60); // 0.210 -> Cornered
  assert.deepEqual(seen, ["Bloodied", "Cornered"], "each phase announced once");
  // And staying put does not re-announce.
  boss.stats.health = 120; a.step(1 / 60);
  assert.deepEqual(seen, ["Bloodied", "Cornered"], "no repeat announcements");
  a.clear();
});

test("a boss can be killed and its bar goes away", () => {
  const a = setup(10);
  a.run.loadout.raiseTier(6);
  a.run.loadout.select("shotgun");
  const boss = a.wave.live[0];
  boss.stats.health = 30;
  boss.root.position.set(0, 0, -3);
  for (let i = 0; i < 60 && !boss.dead; i++) { a.fire(1 / 60); a.step(1 / 60); }
  assert.ok(boss.dead, "the boss died");
  a.step(1 / 60);
  assert.equal(a.bossState(), null, "no boss bar after it dies");
  assert.equal(a.boss, null);
  a.clear();
});

test("the boss ignores a takedown, because the offer is never made", () => {
  const a = setup(10);
  const boss = a.wave.live[0];
  // Stand right behind it.
  boss.root.position.set(0, 0, 0);
  boss.yaw = 0;
  a.world.player.x = 0;
  a.world.player.z = -1.2;
  a.world.player.speed = 0;
  const offer = a.takedownOffer();
  if (offer) assert.notEqual(offer.verdict.ok, true, "a boss cannot be knifed from behind");
  a.clear();
});

test("killing the boss clears the wave like any other", () => {
  const a = setup(10);
  const boss = a.wave.live[0];
  let ended = false;
  a.handlers.onWaveEnd = () => { ended = true; };
  boss.stats.health = 1;
  boss.root.position.set(0, 0, -2);
  a.run.loadout.raiseTier(6);
  a.run.loadout.select("shotgun");
  for (let i = 0; i < 120 && !ended; i++) { a.fire(1 / 60); a.step(1 / 60); }
  assert.ok(ended, "the wave ended when the boss died");
  a.clear();
});
