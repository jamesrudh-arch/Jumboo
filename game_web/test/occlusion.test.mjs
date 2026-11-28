// Sound through walls.
//
// The claim: a shot heard through a building is quieter and duller than the same
// shot in the open, by a measurable amount. These tests hold that to account and
// check the geometry that decides it.

import test from "node:test";
import assert from "node:assert/strict";
import { throughWalls, wallsBetween, segmentCrosses, WALLS } from "../src/occlusion.js";

const box = (x1, z1, x2, z2, tag = "building") => ({ x1, z1, x2, z2, y0: 0, y1: 8, tag });

test("open air is unfiltered", () => {
  const f = throughWalls(0);
  assert.equal(f.muffled, false);
  assert.equal(f.gain, 1);
  assert.ok(f.cutoff >= 20000, "nothing above the audible range is cut");
});

test("a wall makes a sound quieter and duller, monotonically", () => {
  let lastGain = 2;
  let lastCut = Infinity;
  for (let n = 0; n < WALLS.length; n++) {
    const f = throughWalls(n);
    assert.ok(f.gain < lastGain, `${n} walls is quieter`);
    assert.ok(f.cutoff < lastCut, `${n} walls is duller`);
    lastGain = f.gain;
    lastCut = f.cutoff;
  }
});

test("beyond the last entry it clamps rather than falling to silence", () => {
  const f = throughWalls(99);
  assert.ok(f.gain > 0.1, "you can still hear that something happened");
  assert.equal(f.gain, WALLS.at(-1).gain);
});

test("a negative count is treated as open air", () => {
  assert.equal(throughWalls(-3).gain, 1);
});

test("a segment with nothing in the way crosses nothing", () => {
  assert.equal(wallsBetween(0, 0, 10, 0, [box(20, -1, 21, 1)]), 0);
});

test("a wall between the two points is counted", () => {
  assert.equal(wallsBetween(0, 0, 10, 0, [box(4, -2, 6, 2)]), 1);
});

test("two walls are counted as two", () => {
  const walls = [box(2, -2, 3, 2), box(6, -2, 7, 2)];
  assert.equal(wallsBetween(0, 0, 10, 0, walls), 2);
});

test("a wall behind the listener does not muffle what is in front", () => {
  assert.equal(wallsBetween(0, 0, 10, 0, [box(-6, -2, -4, 2)]), 0);
});

test("the ground does not muffle", () => {
  assert.equal(wallsBetween(0, 0, 10, 0, [box(4, -2, 6, 2, "floor"), box(4, -2, 6, 2, "platform"), box(4, -2, 6, 2, "ground")]), 0);
});

test("a diagonal segment through a building is caught", () => {
  assert.equal(segmentCrosses(0, 0, 10, 10, box(4, 4, 6, 6)), true);
});

test("a diagonal that misses the corner is not caught", () => {
  assert.equal(segmentCrosses(0, 0, 10, 10, box(0, 8, 2, 12)), false);
});

test("a segment that only touches an edge counts as crossing", () => {
  assert.equal(segmentCrosses(0, 5, 10, 5, box(4, 5, 6, 9)), true);
});

test("a listener inside a building is not sealed off from the street", () => {
  // A degenerate but real case: standing in a doorway. The segment starts inside
  // the box, and the box should still be counted once rather than zero or many.
  assert.equal(wallsBetween(5, 5, 20, 5, [box(4, 4, 6, 6)]), 1);
});

test("a wall parallel to the segment and beside it is not counted", () => {
  assert.equal(segmentCrosses(0, 0, 10, 0, box(0, 2, 10, 4)), false);
});

// ------------------------------------------------- into the actual audio graph
import { CityAudio } from "../src/audio.js";
import { fakeContext } from "./fakeaudio.mjs";

const cutoffs = (ctx) => ctx._nodes
  .filter((n) => n.frequency)
  .map((n) => n.frequency.value)
  .filter((v) => typeof v === "number");

test("a sound through walls builds a low-pass with the right cutoff", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.play("shotgunBlast", { x: 8, z: 0, yaw: 0, player: { x: 0, z: 0 }, walls: 2 });
  const seen = cutoffs(ctx);
  assert.ok(seen.includes(throughWalls(2).cutoff), `two walls applied ${throughWalls(2).cutoff} Hz; saw ${seen.join(",")}`);
});

test("open air does not apply a wall filter", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.play("shotgunBlast", { x: 8, z: 0, yaw: 0, player: { x: 0, z: 0 }, walls: 0 });
  assert.ok(!cutoffs(ctx).includes(throughWalls(1).cutoff), "nothing muffled in the open");
});

test("a sound blocked by walls is quieter than the same sound in the open", () => {
  // Measure the voice's own gain envelope: the second value it sets is the peak
  // it ramps up to. Measuring the maximum across every node would find the master
  // bus and prove nothing.
  const voicePeak = (walls) => {
    const ctx = fakeContext();
    new CityAudio({ ctx }).play("shotgunBlast", { x: 8, z: 0, yaw: 0, player: { x: 0, z: 0 }, walls });
    const ramps = ctx._nodes
      .filter((n) => n.gain?._sets?.length >= 2)
      .map((n) => n.gain._sets[1][1]);
    return Math.max(...ramps.filter((v) => v > 0 && v < 1));
  };
  const open = voicePeak(0);
  const blocked = voicePeak(3);
  assert.ok(open > 0 && blocked > 0);
  assert.ok(blocked < open, `through three walls ${blocked.toFixed(3)} < in the open ${open.toFixed(3)}`);
  assert.ok(blocked / open < 0.3, `and it is a real cut: ${(blocked / open).toFixed(2)} of the level`);
});

// ------------------------------------------------------------ in the real arena
import { Arena } from "../src/arena.js";

test("the arena counts walls for every world sound it plays", () => {
  const heard = [];
  const a = new Arena();
  a.factory.loader = { async loadAsync() { throw new Error("proxy bodies"); } };
  a.attach({ add() {} }, {
    player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
    camera: { x: 0, y: 2, z: 4 }, cameraYaw: 0,
    emit() {}, hearSound() {}, groundAt: () => 0, boxesNear: () => [],
    // A wall across z = 6..9.
    wallsBetween: (ax, az, bx, bz) => (Math.abs(bx - ax) < 0.1 && Math.min(az, bz) < 6 && Math.max(az, bz) > 9 ? 1 : 0),
  });
  a.audio = { playEvent: (e) => { heard.push(e); return true; } };
  a.startWave();
  a.sound({ type: "enemy-attack", x: 0, z: 14 });
  a.sound({ type: "enemy-attack", x: 0, z: 3.5 });
  assert.equal(heard[0].walls, 1, "through the building");
  assert.equal(heard[1].walls, 0, "in the open");
  a.clear();
});

test("the player's own hit is never muffled", () => {
  const heard = [];
  const a = new Arena();
  a.factory.loader = { async loadAsync() { throw new Error("proxy"); } };
  a.attach({ add() {} }, {
    player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
    camera: { x: 0, y: 2, z: 4 }, cameraYaw: 0,
    emit() {}, hearSound() {}, groundAt: () => 0, boxesNear: () => [],
    wallsBetween: () => 3, // even inside a fortress
  });
  a.audio = { playEvent: (e) => { heard.push(e); return true; } };
  a.startWave();
  const enemy = a.wave.live[0];
  enemy.root.position.set(0, 0, -1.2);
  enemy.stats.attack = { kind: "melee", power: 10, reach: 2, rate: 1 };
  a.playerHitCooldown = 0;
  a.landBlow(enemy, enemy.stats.attack, 1);
  const own = heard.find((e) => e.type === "player-hit");
  if (own) assert.equal(own.walls, undefined, "your own hit is in your ear, not through a wall");
  a.clear();
});
