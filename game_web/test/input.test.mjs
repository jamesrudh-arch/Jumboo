// The gamepad mapping was the one control scheme with no coverage: it lived in
// main.js, was written once, and was never exercised. It now lives in
// src/input.js and is tested here with a synthetic standard-mapping pad.

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGamepad, deadzone, firstConnectedPad } from "../src/input.js";

/** Build a minimal standard-mapping pad. */
function pad({ axes = [0, 0, 0, 0], pressed = [], connected = true } = {}) {
  return {
    connected,
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  };
}

const IDLE = { moveX: 0, moveZ: 0, run: false, crouch: false, interact: false };

test("no pad leaves keyboard and touch intent untouched", () => {
  const intent = { moveX: -1, moveZ: 1, run: true, crouch: false, interact: true };
  const out = applyGamepad(null, intent);
  assert.deepEqual(out.intent, intent);
  assert.equal(out.look, null);

  const disconnected = applyGamepad(pad({ connected: false }), IDLE);
  assert.deepEqual(disconnected.intent, IDLE);
  assert.equal(disconnected.look, null);
});

test("the left stick drives movement and stick-up means forward", () => {
  const forward = applyGamepad(pad({ axes: [0, -1, 0, 0] }), IDLE);
  assert.equal(forward.intent.moveZ, 1, "pushing the stick up walks forward");
  assert.equal(forward.intent.moveX, 0);

  const back = applyGamepad(pad({ axes: [0, 1, 0, 0] }), IDLE);
  assert.equal(back.intent.moveZ, -1, "pulling the stick down walks back");

  const right = applyGamepad(pad({ axes: [0.7, 0, 0, 0] }), IDLE);
  assert.ok(Math.abs(right.intent.moveX - 0.7) < 1e-9);
});

test("a resting stick is ignored instead of drifting", () => {
  assert.equal(deadzone(0.1), 0);
  assert.equal(deadzone(-0.1), 0);
  assert.equal(deadzone(0.5), 0.5);
  assert.equal(deadzone(undefined), 0);
  assert.equal(deadzone(NaN), 0);
  const out = applyGamepad(pad({ axes: [0.08, -0.11, 0.05, 0.02] }), IDLE);
  assert.deepEqual(out.intent, IDLE, "a resting pad must not move or turn the player");
  assert.equal(out.look, null);
});

test("the right stick turns the camera and right is a negative yaw delta", () => {
  const right = applyGamepad(pad({ axes: [0, 0, 1, 0] }), IDLE);
  assert.ok(right.look, "right stick should produce a look delta");
  assert.ok(right.look.dx > 0, "pushing right is a positive dx for the caller");
  // world.look subtracts dx from yaw, so a positive dx is a right turn.
  assert.equal(right.look.dy, 0);

  const up = applyGamepad(pad({ axes: [0, 0, 0, -1] }), IDLE);
  assert.ok(up.look.dy < 0, "pushing up looks up");
});

test("face buttons map to run, crouch and interact", () => {
  // 0 = A/cross, 1 = B/circle, 5/7 = shoulders/triggers, 10 = stick click.
  assert.equal(applyGamepad(pad({ pressed: [0] }), IDLE).intent.interact, true);
  assert.equal(applyGamepad(pad({ pressed: [1] }), IDLE).intent.crouch, true);
  assert.equal(applyGamepad(pad({ pressed: [10] }), IDLE).intent.crouch, true);
  assert.equal(applyGamepad(pad({ pressed: [5] }), IDLE).intent.run, true);
  assert.equal(applyGamepad(pad({ pressed: [7] }), IDLE).intent.run, true);
  // Nothing pressed means nothing happens.
  assert.deepEqual(applyGamepad(pad(), IDLE).intent, IDLE);
});

test("the pad merges with, rather than replaces, keyboard intent", () => {
  // Keyboard is walking right while the stick is pushed up: both count.
  const out = applyGamepad(pad({ axes: [0, -1, 0, 0] }), {
    moveX: 1,
    moveZ: 0,
    run: false,
    crouch: false,
    interact: false,
  });
  assert.equal(out.intent.moveX, 1, "keyboard X survives an idle stick axis");
  assert.equal(out.intent.moveZ, 1, "the stick adds forward movement");

  // Holding run on the keyboard means the pad cannot un-run it.
  const running = applyGamepad(pad(), { ...IDLE, run: true });
  assert.equal(running.intent.run, true);

  // Pressing interact on the pad while the touch button is down stays pressed.
  const both = applyGamepad(pad({ pressed: [0] }), { ...IDLE, interact: true });
  assert.equal(both.intent.interact, true);
});

test("the first connected pad is the one that drives the game", () => {
  const a = pad({ connected: false });
  const b = pad({ connected: true, axes: [1, 0, 0, 0] });
  const c = pad({ connected: true, axes: [0, 1, 0, 0] });
  assert.equal(firstConnectedPad([a, b, c]), b);
  assert.equal(firstConnectedPad([a]), null);
  assert.equal(firstConnectedPad(null), null);
  assert.equal(firstConnectedPad(undefined), null);
  // Browsers hand back a sparse array of nulls for empty slots.
  assert.equal(firstConnectedPad([null, undefined, c]), c);
});

test("start is reported as a press edge the caller can debounce", () => {
  assert.equal(applyGamepad(pad({ pressed: [9] }), IDLE).pause, true);
  assert.equal(applyGamepad(pad(), IDLE).pause, false);
  assert.equal(applyGamepad(null, IDLE).pause, false);
});
