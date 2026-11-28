// Takedown tests. Every rule here is something the player must actually have
// done — be close, be behind, be unseen, be slow — so each is tested separately
// and the failure reasons are tested too: silent failure teaches nothing.

import test from "node:test";
import assert from "node:assert/strict";

import {
  TAKEDOWN, canTakedown, performTakedown, findTakedownTarget, promptFor,
} from "../src/takedown.js";
import { statLine } from "../src/enemies.js";

/** A body. Forward is +Z, which is the convention the whole game uses. */
function body({ yaw = 0, x = 0, z = 0, archetype = "runner" } = {}) {
  return {
    stats: statLine(archetype, 1),
    root: { position: { x, y: 0, z }, rotation: { y: yaw } },
    dead: false,
    died: false,
    die() { this.dead = true; this.died = true; },
  };
}

/** The player. Facing does not matter for a takedown; position and speed do. */
function player({ x = 0, z = -0.9, speed = 0.4 } = {}) {
  return { x, z, yaw: 0, speed, feetY: 0 };
}

test("a still player behind an unaware body can take it down", () => {
  const v = canTakedown(player(), body(), []);
  assert.equal(v.ok, true);
  assert.equal(v.reason, "ready");
});

test("standing in front of a body is a fight, not a takedown", () => {
  // The body faces +Z; the player stands at +Z, in its eyeline.
  const v = canTakedown(player({ z: 0.9 }), body(), []);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "seen-by-target");
});

test("too far is refused, with the distance reported", () => {
  const v = canTakedown(player({ z: -5 }), body(), []);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "far");
  assert.ok(v.distance > 4);
});

test("running up is a shove, not a takedown", () => {
  const v = canTakedown(player({ speed: 3.4 }), body(), []);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "too-fast");
});

test("the reach is the documented one", () => {
  assert.equal(canTakedown(player({ z: -TAKEDOWN.reach + 0.05 }), body(), []).ok, true);
  assert.equal(canTakedown(player({ z: -TAKEDOWN.reach - 0.2 }), body(), []).ok, false);
});

test("a witness looking at the player spoils it", () => {
  // Forward is +Z, so a witness north of the player needs yaw 0 to be looking
  // back down at them.
  const witness = body({ yaw: 0, x: -0.2, z: -6 });
  const v = canTakedown(player(), body(), [body(), witness]);
  assert.equal(v.ok, false);
  assert.equal(v.reason, "witnessed");
  assert.ok(v.witness, "and it names who saw");
});

test("a witness facing away does not spoil it", () => {
  const witness = body({ yaw: Math.PI, x: -0.2, z: -6 });
  assert.equal(canTakedown(player(), body(), [body(), witness]).reason, "ready");
});

test("a witness too far away does not spoil it", () => {
  const witness = body({ yaw: 0, x: 0, z: -40 });
  assert.equal(canTakedown(player(), body(), [body(), witness]).reason, "ready");
});

test("a dead witness is no witness", () => {
  const witness = body({ yaw: 0, x: -0.2, z: -6 });
  witness.dead = true;
  assert.equal(canTakedown(player(), body(), [body(), witness]).reason, "ready");
});

test("a takedown kills silently and pays more than a loud kill", () => {
  const enemy = body();
  const kills = [];
  const run = { registerKill: (k) => kills.push(k) };
  const result = performTakedown(player(), enemy, { run, onKill: () => {} });
  assert.ok(enemy.dead, "the body is dead");
  assert.equal(enemy.takenDown, true);
  assert.equal(result.silent, true);
  assert.deepEqual(kills, [{ quiet: true, archetype: "runner" }]);
  assert.ok(TAKEDOWN.reward > 2, "it is worth more than twice a loud kill");
});

test("a takedown does not touch a body that is already down", () => {
  const enemy = body();
  enemy.dead = true;
  assert.equal(performTakedown(player(), enemy), null);
});

test("the closest eligible body is the one offered", () => {
  // Player behind both, on the -Z side where neither body is looking.
  const near = body({ z: -0.6 });
  const far = body({ z: 0.4 });
  const found = findTakedownTarget(player({ z: -1.2 }), [far, near]);
  assert.ok(found, "one of them is eligible");
  assert.equal(found.enemy, near, "the nearest one");
});

test("no prompt when there is nothing to take down", () => {
  assert.equal(findTakedownTarget(player({ z: -9 }), [body()]), null);
});

test("every failure has words a player can act on", () => {
  for (const reason of ["ready", "far", "seen-by-target", "too-fast", "witnessed"]) {
    const text = promptFor({ reason });
    assert.ok(text && text.length > 2, `${reason} has copy`);
  }
  assert.equal(promptFor(undefined), null);
  assert.equal(promptFor({ reason: "nonsense" }), null);
});

test("the prompt for a witnessed takedown names the problem, not the rule", () => {
  // "Watched" tells a player to deal with the watcher. "Cannot takedown" does not.
  assert.equal(promptFor({ reason: "witnessed" }), "Watched");
  assert.equal(promptFor({ reason: "seen-by-target" }), "Behind them");
});

test("the rear arc is generous enough to be usable in third person", () => {
  // 0.62 * pi is a bit over 110 degrees either side of directly behind, which
  // leaves only a narrow frontal cone where it is refused.
  assert.ok(TAKEDOWN.rearCone > 1.5, "wider than a right angle behind");
  assert.ok(TAKEDOWN.rearCone < Math.PI * 0.75, "but not so wide that facing the player counts");
});
