// Directional damage tests. The bearing maths is the whole feature: if it is
// wrong the arrow points the player at the wrong enemy, which is worse than no
// arrow at all.

import test from "node:test";
import assert from "node:assert/strict";
import { bearingTo, isBehind, DamageMarks, DAMAGE_MARK } from "../src/damagedir.js";

const DEG = 180 / Math.PI;
const from = { x: 0, z: 0 };

test("bearing is 0 dead ahead and positive to the right", () => {
  // yaw 0 has forward (0, 1) and right (1, 0), the convention the rest of the
  // game uses.
  assert.equal(Math.round(bearingTo(from, { x: 0, z: 10 }, 0) * DEG), 0);
  assert.equal(Math.round(bearingTo(from, { x: 10, z: 0 }, 0) * DEG), 90);
  assert.equal(Math.round(bearingTo(from, { x: -10, z: 0 }, 0) * DEG), -90);
  assert.equal(Math.round(Math.abs(bearingTo(from, { x: 0, z: -10 }, 0) * DEG)), 180);
});

test("bearing follows the camera, not the world", () => {
  // Turn the camera to face +X; a source at +X is now dead ahead.
  const facingX = Math.PI / 2;
  assert.ok(Math.abs(bearingTo(from, { x: 10, z: 0 }, facingX)) < 0.001);
  // And a source at +Z, which was ahead, is now to the left.
  assert.ok(bearingTo(from, { x: 0, z: 10 }, facingX) < -1.5);
});

test("bearings wrap in a full circle", () => {
  for (let deg = -180; deg <= 180; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const b = bearingTo(from, { x: Math.sin(rad) * 5, z: Math.cos(rad) * 5 }, 0);
    const shown = b * DEG;
    assert.ok(shown >= -180 && shown <= 180, `${shown.toFixed(1)} is inside the range`);
  }
});

test("behind is anything past a right angle", () => {
  assert.equal(isBehind(0), false);
  assert.equal(isBehind(Math.PI * 0.4), false);
  assert.equal(isBehind(Math.PI * 0.6), true);
  assert.equal(isBehind(-Math.PI * 0.9), true);
});

test("a mark decays and disappears", () => {
  const marks = new DamageMarks();
  marks.add(1);
  assert.equal(marks.count, 1);
  marks.tick(DAMAGE_MARK.life + 0.1);
  assert.equal(marks.count, 0);
});

test("repeated hits from the same source merge", () => {
  const marks = new DamageMarks();
  marks.add(1.0);
  marks.add(1.02);
  marks.add(0.99);
  assert.equal(marks.count, 1, "one arrow, not three");
  assert.ok(marks.marks[0].amount > 1, "and it knows it was hit more than once");
});

test("hits from opposite sides do not merge", () => {
  const marks = new DamageMarks();
  marks.add(1.5);
  marks.add(-1.5);
  assert.equal(marks.count, 2);
});

test("the mark list is capped", () => {
  const marks = new DamageMarks();
  for (let i = 0; i < 12; i++) marks.add((i / 12) * Math.PI * 2);
  assert.ok(marks.count <= DAMAGE_MARK.max, `${marks.count} marks`);
});

test("render gives the HUD what it needs and nothing it does not", () => {
  const marks = new DamageMarks();
  marks.add(1.2);
  marks.tick(0.5);
  const out = marks.render();
  assert.equal(out.length, 1);
  assert.ok(out[0].alpha > 0 && out[0].alpha < 1, "mid-fade");
  assert.equal(typeof out[0].bearing, "number");
  assert.equal(out[0].behind, false);
});

test("a mark behind the camera is flagged for different drawing", () => {
  const marks = new DamageMarks();
  marks.add(Math.PI * 0.8);
  assert.equal(marks.render()[0].behind, true);
});

test("clear empties the list", () => {
  const marks = new DamageMarks();
  marks.add(0.5);
  marks.clear();
  assert.equal(marks.count, 0);
  assert.deepEqual(marks.render(), []);
});
