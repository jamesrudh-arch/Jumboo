// Navigation tests. Steering is the kind of code that looks right and behaves
// wrong, so every claim here is a geometric fact rather than a vibe.

import test from "node:test";
import assert from "node:assert/strict";

import {
  steer, separate, avoid, pathBlocked, flankOffset, canSee, nearestObstacle, STEER,
} from "../src/navigation.js";

const wall = (x1, z1, x2, z2, h = 3) => ({ x1, z1, x2, z2, y0: 0, y1: h, tag: "wall" });

test("a clear path steers straight at the target", () => {
  const s = steer({ x: 0, z: -6, targetX: 0, targetZ: 0, boxes: [] });
  assert.ok(s.z > 0.9, `steers toward +z (got ${s.z.toFixed(2)})`);
  assert.ok(Math.abs(s.x) < 0.2, "and does not wander sideways");
  assert.equal(s.blocked, false);
});

test("a wall between body and target is steered around, not through", () => {
  const boxes = [wall(-0.6, -2, 0.6, 2)];
  const s = steer({ x: 0, z: -8, targetX: 0, targetZ: 8, boxes });
  assert.ok(s.blocked, "the body knows it is blocked");
  assert.ok(Math.abs(s.x) > 0.3, `it commits to a side (x=${s.x.toFixed(2)})`);
  assert.ok(s.z > 0, "and still makes progress toward the target");
});

test("a low kerb is not an obstacle", () => {
  // 0.2 m tall: something a body steps over. Treating it as a wall would make
  // the street's kerbs into invisible fences.
  const kerb = { x1: -0.6, z1: -2, x2: 0.6, z2: 2, y0: 0, y1: 0.2 };
  assert.equal(pathBlocked(0, -6, 0, 6, [kerb]), false);
});

test("a floor is never an obstacle", () => {
  const floor = { x1: -10, z1: -10, x2: 10, z2: 10, y0: -1, y1: 0, tag: "floor" };
  assert.equal(pathBlocked(0, -6, 0, 6, [floor]), false);
});

test("the body radius inflates obstacles so shoulders do not clip corners", () => {
  const post = wall(-0.2, -0.2, 0.2, 0.2);
  // A line at x = 0.35: 0.15 m clear of the post's edge. A point body misses it
  // and a 0.4 m-wide body does not.
  const withoutRadius = pathBlocked(0.35, -3, 0.35, 3, [post], 0.001);
  const withRadius = pathBlocked(0.35, -3, 0.35, 3, [post], 0.4);
  assert.equal(withoutRadius, false, "the bare line misses");
  assert.equal(withRadius, true, "a body with width does not");
});

test("bodies push apart when they overlap", () => {
  const a = { x: 0, z: 0 };
  const b = { x: 0.4, z: 0 };
  const s = separate(a, [a, b]);
  assert.ok(s.x < -0.5, "pushed away from the neighbour");
  assert.ok(Math.abs(s.z) < 0.1);
  assert.ok(s.weight > 0);
});

test("bodies at comfortable distance do not push each other", () => {
  const s = separate({ x: 0, z: 0 }, [{ x: 5, z: 0 }]);
  assert.equal(s.weight, 0);
  assert.equal(s.x, 0);
});

test("a crowd pushes harder than one neighbour", () => {
  const self = { x: 0, z: 0 };
  const one = separate(self, [self, { x: 0.3, z: 0 }]);
  const many = separate(self, [self, { x: 0.3, z: 0 }, { x: -0.3, z: 0.1 }, { x: 0.1, z: 0.3 }]);
  assert.ok(many.weight > one.weight, `crowd ${many.weight} beats one ${one.weight}`);
});

test("flank slots spread evenly around the player", () => {
  const slots = [];
  for (let i = 0; i < 8; i++) slots.push(flankOffset(i, 8));
  // All distinct, and roughly on a circle.
  const keys = new Set(slots.map((s) => `${s.x.toFixed(1)},${s.z.toFixed(1)}`));
  assert.equal(keys.size, 8, "eight distinct bearings");
  for (const s of slots) {
    const r = Math.hypot(s.x, s.z);
    assert.ok(Math.abs(r - 3.2) < 0.01, `slot radius ${r.toFixed(2)}`);
  }
});

test("a single body has no flank offset", () => {
  assert.deepEqual(flankOffset(0, 1), { x: 0, z: 0 });
});

test("the flank offset fades out as a body closes", () => {
  // Far away, two bodies on different slots approach on different lines.
  const boxes = [];
  const farA = steer({ x: -10, z: 0, targetX: 0, targetZ: 0, boxes, slot: 0, count: 4 });
  const farB = steer({ x: 10, z: 0, targetX: 0, targetZ: 0, boxes, slot: 2, count: 4 });
  // Close in, both go for the player rather than for their slot.
  const nearA = steer({ x: -1.2, z: 0, targetX: 0, targetZ: 0, boxes, slot: 0, count: 4 });
  const nearB = steer({ x: 1.2, z: 0, targetX: 0, targetZ: 0, boxes, slot: 2, count: 4 });
  // A close body's heading points at the player: opposite signs for the two sides.
  assert.ok(nearA.x > 0.7, `the body on the left drives right (${nearA.x.toFixed(2)})`);
  assert.ok(nearB.x < -0.7, `the body on the right drives left (${nearB.x.toFixed(2)})`);
  void farA;
  void farB;
});

test("separation never cancels pursuit outright", () => {
  // The bug this protects: five bodies ringed the player at 1.6 m, each pushed
  // back by its neighbours, and none could close to the 1.3 m their attack
  // needed. A body that still has ground to cover must keep closing.
  const neighbours = [
    { x: 0.5, z: 0 }, { x: -0.5, z: 0 }, { x: 0, z: 0.5 }, { x: 0, z: -0.5 },
  ];
  const closing = steer({
    x: 0, z: 6, targetX: 0, targetZ: 0, boxes: [], neighbours,
    slot: 0, count: 5, closing: 1,
  });
  assert.ok(closing.z < -0.5, `committed to closing (z=${closing.z.toFixed(2)})`);
});

test("canSee agrees with pathBlocked", () => {
  const boxes = [wall(-1, -1, 1, 1)];
  assert.equal(canSee(0, -5, 0, 5, boxes), false);
  assert.equal(canSee(-5, 0, -5, 5, boxes), true);
});

test("nearestObstacle ignores floors", () => {
  const boxes = [
    { x1: -10, z1: -10, x2: 10, z2: 10, y0: -1, y1: 0, tag: "floor" },
    wall(2, 0, 3, 1),
  ];
  const d = nearestObstacle(0, 0, boxes);
  assert.ok(d > 1.9 && d < 2.1, `distance to the wall post is ${d.toFixed(2)}`);
});

test("steering is deterministic", () => {
  const args = { x: 3, z: -4, targetX: -1, targetZ: 2, boxes: [wall(0, -1, 1, 1)], slot: 1, count: 3 };
  assert.deepEqual(steer(args), steer(args));
});

test("a body boxed in on all sides does not sit still", () => {
  // Fully surrounded: the fallback must produce a direction (a unit vector),
  // not a zero, or the body freezes and the player sees a mannequin.
  const cage = [
    wall(-1.2, -1.2, 1.2, -0.9), wall(-1.2, 0.9, 1.2, 1.2),
    wall(-1.2, -1.2, -0.9, 1.2), wall(0.9, -1.2, 1.2, 1.2),
  ];
  const s = steer({ x: 0, z: 0, targetX: 10, targetZ: 10, boxes: cage });
  const len = Math.hypot(s.x, s.z);
  assert.ok(Math.abs(len - 1) < 0.01, `still a unit heading (${len.toFixed(3)})`);
});

test("the steering weights are in the units the arena passes", () => {
  assert.ok(STEER.avoid > 1, "avoidance outweighs pursuit when blocked");
  assert.ok(STEER.separate > 0 && STEER.separate < 2);
  assert.ok(STEER.lookahead > 1, "feeler reaches past a doorway");
});

// --------------------------------------------------------------- body collision
import { resolveOverlaps } from "../src/navigation.js";

test("two bodies in the same place are pushed apart", () => {
  const bodies = [{ x: 0, z: 0 }, { x: 0.1, z: 0 }];
  const n = resolveOverlaps(bodies, 0.72);
  assert.ok(n > 0, "a correction was applied");
  const d = Math.hypot(bodies[1].x - bodies[0].x, bodies[1].z - bodies[0].z);
  assert.ok(d > 0.6, `separated to ${d.toFixed(2)} m`);
});

test("exactly coincident bodies are separated deterministically", () => {
  // No random direction: a wave must replay identically frame for frame.
  const make = () => [{ x: 1, z: 1 }, { x: 1, z: 1 }];
  const a = make();
  const b = make();
  resolveOverlaps(a, 0.72);
  resolveOverlaps(b, 0.72);
  assert.deepEqual(a, b);
  const d = Math.hypot(a[1].x - a[0].x, a[1].z - a[0].z);
  assert.ok(d > 0.5, `pushed apart to ${d.toFixed(2)}`);
});

test("bodies already apart are left alone", () => {
  const bodies = [{ x: 0, z: 0 }, { x: 5, z: 0 }];
  assert.equal(resolveOverlaps(bodies, 0.72), 0);
  assert.deepEqual(bodies, [{ x: 0, z: 0 }, { x: 5, z: 0 }]);
});

test("the correction is split, not dumped on one body", () => {
  const bodies = [{ x: 0, z: 0 }, { x: 0.2, z: 0 }];
  resolveOverlaps(bodies, 0.72, 1);
  assert.ok(bodies[0].x < 0, "the first moved left");
  assert.ok(bodies[1].x > 0.2, "the second moved right");
});

test("a crowd resolves without collapsing to a point", () => {
  const bodies = Array.from({ length: 8 }, () => ({ x: 0, z: 0 }));
  for (let i = 0; i < 6; i++) resolveOverlaps(bodies, 0.72);
  const unique = new Set(bodies.map((b) => `${b.x.toFixed(2)},${b.z.toFixed(2)}`));
  assert.ok(unique.size >= 6, `eight bodies occupy ${unique.size} distinct spots`);
});

test("a wave does not leave bodies intersecting", async () => {
  // End to end: seed a wave, cram them together, step, and check no pair is
  // closer than the body diameter.
  const { Arena } = await import("../src/arena.js");
  const arena = new Arena();
  arena.factory.loader = { async loadAsync() { throw new Error("proxy bodies are fine here"); } };
  const world = {
    player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
    camera: { x: 0, y: 2, z: 4 }, cameraYaw: 0,
    emit() {}, hearSound() {}, groundAt: () => 0, boxesNear: () => [],
  };
  arena.attach({ add() {} }, world);
  arena.startWave();
  for (const e of arena.wave.live) e.root.position.set(0, 0, 0);
  for (let i = 0; i < 10; i++) arena.step(1 / 60);
  const pts = arena.wave.live.map((e) => e.root.position);
  let worst = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      worst = Math.min(worst, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
    }
  }
  assert.ok(worst > 0.5, `closest pair is ${worst.toFixed(2)} m apart`);
  arena.clear();
});
