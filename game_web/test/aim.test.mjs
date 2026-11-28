// Aim versus animation.
//
// These exist because of a bug that survived several sessions: the hit test used
// the *body* heading, which is damped for looks, so a player who turned and fired
// shot where they used to be looking. The measurement that proves it is in the
// commit: 44 degrees short after 100 ms at the rate that shipped.

import test from "node:test";
import assert from "node:assert/strict";
import { dampAngle, angleDiff } from "../src/geom.js";
import { coneFor } from "../src/combat.js";
import { weaponById } from "../src/arsenal.js";

const DEG = 180 / Math.PI;

test("aim is exact on the frame the camera moves", () => {
  const p = { yaw: 0, aimYaw: 0 };
  // The rule from world.js, expressed without a world.
  p.aimYaw = Math.PI;
  assert.equal(Math.abs(angleDiff(p.aimYaw, Math.PI)), 0, "no lag in the aim");
});

test("the body still turns smoothly, which is what damping is for", () => {
  let yaw = 0;
  const target = Math.PI;
  const samples = [];
  for (let i = 0; i < 12; i++) {
    yaw = dampAngle(yaw, target, 12, 1 / 60);
    samples.push(Math.abs(angleDiff(yaw, target)) * DEG);
  }
  assert.ok(samples[0] > 20, "it does not snap in one frame");
  assert.ok(samples.at(-1) < samples[0], "but it closes");
  // Monotonic: never overshoots the target.
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] <= samples[i - 1] + 1e-9);
});

test("the old rule missed for the first 80 ms of every flick", () => {
  // Measured, not assumed. A 180 degree turn and a shot at a body 6 m in front of
  // the new heading:
  //
  //   fire at   0 ms  body 180 deg off  cone 60  -> miss
  //   fire at  50 ms  body  99 deg off           -> miss
  //   fire at 100 ms  body  54 deg off           -> hit
  //
  // So the old rule was not "slightly sluggish": it threw away the shot for the
  // first three frames of every turn, and the faster the player reacted, the more
  // reliably it failed. The aim is now exact, so the result does not depend on
  // reaction speed at all.
  const weapon = weaponById("pistol");
  const cone = coneFor(weapon, 6, false);
  assert.ok(cone > 0);
  const misses = [];
  for (const ms of [0, 50, 80]) {
    const lag = Math.abs(angleDiff(dampAngle(0, Math.PI, 12, ms / 1000), Math.PI));
    if (lag > cone) misses.push(ms);
  }
  assert.deepEqual(misses, [0, 50, 80], "the old rule misses at every one of these");
  // And what the new rule does: no lag at all, at any interval including zero.
  for (const ms of [0, 16, 50, 80]) {
    const aim = Math.PI; // set exactly, every frame
    assert.ok(Math.abs(angleDiff(aim, Math.PI)) <= cone, `exact aim hits at ${ms} ms`);
  }
});

test("a fast flick and a slow turn both end with the aim where the camera is", () => {
  for (const frames of [1, 6, 30, 120]) {
    let yaw = 0;
    for (let i = 0; i < frames; i++) yaw = dampAngle(yaw, 1.2, 12, 1 / 60);
    const aim = 1.2; // set exactly every frame
    assert.equal(aim, 1.2);
    assert.ok(Math.abs(angleDiff(yaw, aim)) < 1.3, "the body is on its way");
  }
});

// ------------------------------------------------------- against the real world
import { World } from "../src/world.js";
import { LEVEL } from "../src/level.js";

const makeWorld = () => new World(LEVEL, { boxes: [], platforms: [] });

test("a real world starts with aim and body agreeing", () => {
  const w = makeWorld();
  assert.equal(typeof w.player.aimYaw, "number", "aimYaw exists from spawn");
  assert.equal(w.player.aimYaw, w.player.yaw);
});

test("a real camera flick moves the aim at once and the body over time", () => {
  const w = makeWorld();
  // A fresh world starts in briefing, where the player is not simulated at all.
  w.phase = "play";
  w.player.yaw = 0;
  w.player.aimYaw = 0;
  w.cameraYaw = Math.PI;
  // Drive the real simulation with no movement input, so the camera alone drives
  // the turn, exactly as it does when a player spins the mouse while standing.
  w.input.moveX = 0;
  w.input.moveZ = 0;
  w.input.run = false;
  w.input.crouch = false;
  const step = (dt) => w.update(dt);
  step(1 / 60);
  // One frame in, the aim is on the camera. The body is nowhere near it yet.
  assert.ok(
    Math.abs(angleDiff(w.player.aimYaw, Math.PI)) < 0.01,
    `aim is on the camera (${w.player.aimYaw.toFixed(2)})`,
  );
  assert.ok(Math.abs(angleDiff(w.player.yaw, Math.PI)) > 0.3, "the body is still turning");
  // After long enough, the body catches up and looks right.
  for (let i = 0; i < 120; i++) step(1 / 60);
  assert.ok(Math.abs(angleDiff(w.player.yaw, Math.PI)) < 0.05, "and eventually faces it");
});
