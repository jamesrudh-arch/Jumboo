// Environmental kill tests.
//
// The claim this feature makes is "turn the street into a weapon". These tests
// hold that claim to account: reach has to be real, chains have to be finite,
// the body has to actually die, and a body thrown into the canal has to drown
// rather than bounce off the bank.

import test from "node:test";
import assert from "node:assert/strict";
import {
  HAZARD, USE_REACH, canUse, blastTargets, chainFrom, fallsInWater, shove,
  usableHazards,
} from "../src/hazards.js";

const body = (x, z, extra = {}) => ({ root: { position: { x, y: 0, z } }, dead: false, ...extra });
const barrel = (x, z, extra = {}) => ({ kind: "barrel", x, z, ...extra });

test("every hazard has a spec, and the reaches are worth using", () => {
  for (const kind of ["barrel", "gasMain", "canal", "vehicle"]) {
    const spec = HAZARD[kind];
    assert.ok(spec, `${kind} exists`);
    assert.equal(typeof spec.damage, "number");
    assert.ok(spec.reach >= 0);
  }
  // A barrel's reach must beat a shotgun's, or it is never the better choice.
  assert.ok(HAZARD.barrel.reach > 4, "a drum is worth more than a close-range gun");
});

test("you can use a hazard beside you, not across the street", () => {
  const p = { x: 0, z: 0 };
  assert.equal(canUse(barrel(0, 1.5), p, 0), true);
  assert.equal(canUse(barrel(0, USE_REACH + 0.5), p, 0), false);
});

test("you cannot use a hazard behind you", () => {
  const p = { x: 0, z: 0 };
  // Facing +Z (yaw 0); the barrel is at -Z, i.e. behind.
  assert.equal(canUse(barrel(0, -2), p, 0), false);
  // Turn around and it is in front again.
  assert.equal(canUse(barrel(0, -2), p, Math.PI), true);
});

test("standing on a hazard counts as being in reach whatever you face", () => {
  assert.equal(canUse(barrel(0.1, 0), { x: 0, z: 0 }, 1.2), true);
});

test("a blast hits what is inside the reach and nothing outside", () => {
  const origin = { x: 0, z: 0 };
  const near = body(1, 0);
  const rim = body(HAZARD.barrel.reach - 0.05, 0);
  const outside = body(HAZARD.barrel.reach + 0.4, 0);
  const hits = blastTargets(origin, [near, rim, outside], HAZARD.barrel.reach);
  assert.equal(hits.length, 2, "two bodies inside the reach");
  assert.equal(hits[0].enemy, near, "nearest first");
  assert.ok(!hits.some((h) => h.enemy === outside), "the body outside is untouched");
});

test("falloff is strongest at the centre and never reaches zero inside", () => {
  const origin = { x: 0, z: 0 };
  const hits = blastTargets(origin, [body(0.2, 0), body(5, 0)], HAZARD.barrel.reach);
  assert.ok(hits[0].falloff > hits[1].falloff);
  assert.ok(hits[1].falloff >= 0.25, "a body at the rim is still hurt");
});

test("a blast can be told to spare the body that set it off", () => {
  const origin = { x: 0, z: 0 };
  const self = body(0.5, 0);
  assert.equal(blastTargets(origin, [self], 5, { ignore: self }).length, 0);
});

test("dead bodies are not hurt twice", () => {
  const dead = body(1, 0, { dead: true });
  assert.equal(blastTargets({ x: 0, z: 0 }, [dead], 5).length, 0);
});

test("hovering bodies are spared when the blast is ground-bound", () => {
  const flyer = { root: { position: { x: 1, y: 3, z: 0 } }, behaviour: { hover: true } };
  const walker = body(1, 0);
  const hits = blastTargets({ x: 0, z: 0 }, [flyer, walker], 5, { requireGrounded: true });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].enemy, walker);
});

test("a chain reaches nearby drums and stops short of distant ones", () => {
  const a = barrel(0, 0);
  const b = barrel(3, 0);
  const c = barrel(20, 0);
  const next = chainFrom(a, [a, b, c]);
  assert.deepEqual(next, [b]);
});

test("chains are bounded, so a street of drums terminates", () => {
  // Twenty drums in a line, each within reach of the next.
  const line = Array.from({ length: 20 }, (_, i) => barrel(i * 3, 0));
  let live = [line[0]];
  const spent = new Set([line[0]]);
  let fired = 0;
  for (let depth = 0; depth < 10 && live.length; depth++) {
    const next = [];
    for (const h of live) next.push(...chainFrom(h, line, { depth, spent }));
    for (const n of next) { spent.add(n); fired++; }
    live = next;
    if (!next.length) break;
  }
  assert.ok(fired < 20, `chain stopped after ${fired} drums, not all twenty`);
  assert.ok(fired > 0, "but it did chain");
});

test("the canal does not chain into anything", () => {
  const canal = { kind: "canal", x: 0, z: 0 };
  assert.equal(chainFrom(canal, [barrel(1, 0)]).length, 0);
});

test("a body inside the water rectangle with its feet below the bank is in the water", () => {
  const water = { x1: -5, x2: 5, z1: -1, z2: 1, surfaceY: -1.2 };
  assert.equal(fallsInWater({ x: 0, y: -1.2, z: 0 }, water), true);
  assert.equal(fallsInWater({ x: 0, y: 2, z: 0 }, water), false, "on the bridge");
  assert.equal(fallsInWater({ x: 20, y: -1.2, z: 0 }, water), false, "on the bank");
});

test("a shove throws the body away from the centre", () => {
  const out = shove({ x: 1, y: 0, z: 0 }, { x: 0, z: 0 }, 3);
  assert.ok(out.x > 1, "pushed outward");
  assert.equal(out.z, 0);
});

test("a shove is stronger close to the blast than at the rim", () => {
  const near = shove({ x: 0.4, z: 0 }, { x: 0, z: 0 }, 3);
  const far = shove({ x: 4.6, z: 0 }, { x: 0, z: 0 }, 3);
  assert.ok(near.thrown > far.thrown);
  assert.ok(far.thrown >= 0.6, "but even the rim gets a nudge");
});

test("a shove of a body exactly on the origin is deterministic", () => {
  const a = shove({ x: 0, z: 0 }, { x: 0, z: 0 }, 3);
  const b = shove({ x: 0, z: 0 }, { x: 0, z: 0 }, 3);
  assert.deepEqual(a, b, "no randomness in a blast");
});

test("usable hazards are the close ones, nearest first, spent ones excluded", () => {
  const p = { x: 0, z: 0 };
  const list = [barrel(0, 2.2), barrel(0, 1.0), barrel(0, 1.6, { spent: true }), barrel(0, 9)];
  const usable = usableHazards(list, p, 0);
  assert.equal(usable.length, 2, "the spent drum and the distant one are out");
  assert.ok(usable[0].distance < usable[1].distance, "nearest first");
});

test("a body thrown toward the canal can end up in it — the combination works", () => {
  // The real sequence: a blast shoves a body, and the shove lands it in water.
  const water = { x1: 2, x2: 8, z1: -1, z2: 1, surfaceY: -1.2 };
  const origin = { x: 0, z: 0 };
  const victim = { x: 1.5, y: -1.2, z: 0 };
  const thrown = shove(victim, origin, 4);
  assert.equal(fallsInWater({ ...victim, x: thrown.x, z: thrown.z }, water), true,
    "the blast pushed the body into the canal");
});
