// Arena tests: the wave loop as a player lives it. Death, retry, clear, offer,
// advance — run headless against the real GLBs with a fake scene.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { Arena } from "../src/arena.js";

const here = dirname(fileURLToPath(import.meta.url));

class DiskLoader {
  async loadAsync(url) {
    const path = url.startsWith("/") ? url : join(here, "..", url.replace(/^\.\//, ""));
    const buf = fs.readFileSync(path);
    return new Promise((res, rej) =>
      new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej));
  }
}

function makeArena({ groundAt = () => 0 } = {}) {
  const arena = new Arena();
  arena.factory.loader = new DiskLoader();
  const scene = { children: [], add(o) { this.children.push(o); }, remove(o) { this.children = this.children.filter((c) => c !== o); } };
  const world = {
    player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
    camera: { x: 0, y: 2, z: 4 },
    emit() {},
    hearSound() {},
    groundAt,
  };
  arena.attach(scene, world);
  return { arena, scene, world };
}

test("preload loads the whole cast", async () => {
  const { arena } = makeArena();
  const stats = await arena.preload();
  assert.equal(stats.loaded, stats.requested);
  assert.deepEqual(arena.report().failed, []);
});

test("a wave spawns bodies on the street, not on the player", async () => {
  const { arena, world, scene } = makeArena();
  await arena.preload();
  const { wave, count } = arena.startWave();
  assert.equal(wave.n, 1);
  assert.equal(count, 5, "wave 1 is one pack group of five");
  assert.equal(scene.children.length, count, "every body is in the scene");
  for (const e of arena.wave.live) {
    const d = Math.hypot(e.root.position.x - world.player.x, e.root.position.z - world.player.z);
    assert.ok(d >= 8, `body spawned ${d.toFixed(1)} m away`);
  }
});

test("bodies close the distance and hurt a player who does nothing", async () => {
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  const startHp = arena.run.health;
  // Measure a short, fixed window rather than waiting for death.
  for (let i = 0; i < 60 * 6; i++) arena.step(1 / 60);
  const closer = arena.wave.live.every((e) => Math.hypot(e.root.position.x, e.root.position.z) < 12);
  assert.ok(closer, "the pack moved in");
  assert.ok(arena.run.health < startHp, "and it hurts");
});

test("an idle player survives the opening wave long enough to learn it", async () => {
  // The tuning claim, measured: five bodies killed an idle player in 11 s
  // before incoming damage was scaled, which left no room to learn anything.
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  let seconds = 0;
  while (arena.run.health > 0 && seconds < 60) { arena.step(1 / 60); seconds += 1 / 60; }
  assert.ok(seconds > 14, `an idle player lasts ${seconds.toFixed(1)} s, which is enough to react`);
});

test("a death is recoverable: retry restores health and reissues the wave", async () => {
  const { arena } = makeArena();
  await arena.preload();
  let death = null;
  arena.handlers.onDeath = (e) => { death = e; };
  arena.startWave();
  arena.run.takeDamage(999);
  assert.equal(arena.run.state, "dead");
  arena.retry();
  assert.equal(arena.run.health, arena.run.maxHealth);
  assert.equal(arena.run.wave, 1, "the wave is issued again, not skipped");
  assert.ok(arena.inWave);
  void death;
});

test("clearing a wave offers a reward and advances", async () => {
  const { arena } = makeArena();
  await arena.preload();
  let ended = null;
  arena.handlers.onWaveEnd = (e) => { ended = e; };
  arena.startWave();
  for (const e of [...arena.wave.live]) arena.wave.damage(e, 9999);
  arena.step(1 / 60);
  assert.ok(ended, "the wave ended");
  assert.equal(ended.wave, 1);
  assert.ok(ended.offer.length >= 2, "there are choices");
  const weapon = ended.offer.find((o) => o.kind === "weapon");
  arena.advance(weapon);
  assert.equal(arena.run.wave, 2);
  assert.equal(arena.run.loadout.current, weapon.id, "the reward is in hand");
  assert.ok(arena.wave.live.length > 0, "the next wave is on the street");
});

test("a cleared wave ends the fight only once", async () => {
  const { arena } = makeArena();
  await arena.preload();
  let count = 0;
  arena.handlers.onWaveEnd = () => { count += 1; };
  arena.startWave();
  for (const e of [...arena.wave.live]) arena.wave.damage(e, 9999);
  for (let i = 0; i < 20; i++) arena.step(1 / 60);
  assert.equal(count, 1, "the handler fired once, not once per frame");
});

test("the trigger connects, kills and counts", async () => {
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  // Put one weak body in punching distance and give it the opening wave's
  // whole attention: this measures the trigger path, not the horde.
  const target = arena.wave.live[0];
  target.root.position.set(0, 0, -0.8);
  for (const e of arena.wave.live) e.stats.health = 5;
  const before = arena.run.kills;
  let guard = 0;
  while (arena.run.kills < before + 1 && guard < 300) {
    arena.fire(1 / 60);
    arena.step(1 / 60);
    guard += 1;
  }
  assert.ok(guard < 300, "one punch settles a weakened body");
  assert.equal(arena.run.kills, before + 1);
  assert.ok(arena.stats.hits > 0, "the hit was counted");
});

test("the fists respect their own cadence", async () => {
  // A punch is every 0.55 s. A harness that fires every step would conceal a
  // missing cooldown, so count real uses against the clock.
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  for (const e of arena.wave.live) e.stats.health = 9999;
  arena.wave.live[0].root.position.set(0, 0, -0.8);
  let fired = 0;
  for (let i = 0; i < 120; i++) {
    const r = arena.fire(1 / 60);
    if (r && !r.dry) fired += 1;
    arena.step(1 / 60);
  }
  // Two seconds at one punch per 0.55 s is three, with slack for the cooldown
  // being seeded by the first frame.
  assert.ok(fired >= 3 && fired <= 5, `fired ${fired} times in 2 s`);
});

test("the HUD reports the wave, the weapon and the bodies left", async () => {
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  const h = arena.hud();
  assert.equal(h.wave, 1);
  assert.equal(h.enemiesAlive, 5);
  assert.equal(h.inWave, true);
  assert.ok(h.weapon.id);
  assert.equal(typeof h.health, "number");
});

test("spawn respects the ground height so bodies are not in the canal", async () => {
  // A ground function that reports a 2 m ledge: every body must be standing on
  // it rather than at zero.
  const { arena } = makeArena({ groundAt: () => 2 });
  await arena.preload();
  arena.startWave();
  for (const e of arena.wave.live) {
    assert.ok(e.root.position.y >= 2 - 0.01, `body at y=${e.root.position.y.toFixed(2)}`);
  }
});

test("applying shake moves the camera and returns a roll", async () => {
  const { arena, world } = makeArena();
  await arena.preload();
  arena.startWave();
  arena.feel.shake.add(1);
  arena.feel.shake.tick(0.1);
  const before = { ...world.camera };
  arena.applyShake(world);
  const moved = world.camera.x !== before.x || world.camera.y !== before.y || world.camera.z !== before.z;
  assert.ok(moved, "the camera moved");
  assert.equal(typeof world.cameraRoll, "number");
});

test("clearing the arena disposes every body", async () => {
  const { arena } = makeArena();
  await arena.preload();
  arena.startWave();
  arena.clear();
  assert.equal(arena.wave.live.length, 0);
  assert.equal(arena.inWave, false);
});
