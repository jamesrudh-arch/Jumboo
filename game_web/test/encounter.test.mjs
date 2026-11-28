// Encounter shape tests.
//
// These exist because the game was measured at 1.7 minutes for 15 waves, and the
// cause was bodies that died faster than a player could look at them. The audit
// is the tool that would have caught it before release.

import test from "node:test";
import assert from "node:assert/strict";
import {
  TTL_TARGET, WEIGHT, healthForTtl, encounterSeconds, bodiesForSeconds,
  auditEncounter, shapeEncounter,
} from "../src/encounter.js";
import { ARCHETYPES } from "../src/enemies.js";

const body = (health, armour = 0) => ({ health, armour });

test("time to kill is health over effective dps", () => {
  assert.equal(encounterSeconds([body(100)], 20), 5);
  assert.equal(encounterSeconds([body(100, 0.5)], 20), 10, "armour halves the output");
  assert.equal(encounterSeconds([body(100), body(100)], 20), 10, "two bodies take twice as long");
});

test("an unkillable body returns infinity rather than a big number", () => {
  assert.equal(encounterSeconds([body(100, 1)], 20), Infinity);
});

test("health can be solved for a target time to kill", () => {
  assert.equal(healthForTtl(3, 20), 60);
  assert.equal(healthForTtl(3, 0), 1, "no dps means a floor, not a crash");
});

test("body count can be solved for a target duration", () => {
  const n = bodiesForSeconds(60, body(100), 20);
  assert.equal(n, 12, "twelve 5-second bodies make a minute");
});

test("every archetype now survives long enough to be a decision", () => {
  // The bug this protects: a Pack died in 0.4 s of machine-gun fire.
  const dps = 18; // pistol, the weapon most of act one is played with
  for (const [name, def] of Object.entries(ARCHETYPES)) {
    const ttl = encounterSeconds([{ health: def.health, armour: def.armour }], dps);
    const target = TTL_TARGET[WEIGHT[name] ?? "medium"];
    assert.ok(ttl >= target.min * 0.8, `${name} dies in ${ttl.toFixed(1)}s, target min ${target.min}s`);
  }
});

test("a heavy body takes at least five times as long as a light one", () => {
  const dps = 18;
  const pack = encounterSeconds([{ health: ARCHETYPES.pack.health, armour: ARCHETYPES.pack.armour }], dps);
  const brute = encounterSeconds([{ health: ARCHETYPES.brute.health, armour: ARCHETYPES.brute.armour }], dps);
  assert.ok(brute / pack >= 5, `brute/pack ratio ${(brute / pack).toFixed(1)}`);
});

test("the audit fails a fight that is too short — the old content", () => {
  // The original wave 4: five light bodies.
  const old = [
    { health: 60, armour: 0.1 }, { health: 60, armour: 0.1 },
    { health: 40, armour: 0 }, { health: 40, armour: 0 }, { health: 18, armour: 0 },
  ];
  const res = auditEncounter(old, { dps: 20 });
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("too short")));
});

test("the audit fails a fight with no weight in it", () => {
  const res = auditEncounter([body(50), body(50), body(50), body(50)], { dps: 20, target: { min: 1, max: 9999 } });
  assert.equal(res.ok, false);
  assert.ok(res.problems.some((p) => p.includes("armoured")));
});

test("the audit fails a fight with fewer than three bodies", () => {
  const res = auditEncounter([body(1000, 0.5)], { dps: 20, target: { min: 1, max: 9999 } });
  assert.ok(res.problems.some((p) => p.includes("at least three")));
});

test("the audit passes a fight with real shape", () => {
  const good = Array.from({ length: 8 }, () => body(300)).concat([body(1400, 0.6)]);
  const res = auditEncounter(good, { dps: 18, target: { min: 60, max: 400 } });
  assert.equal(res.ok, true, res.problems.join("; "));
});

test("a proposed encounter includes a heavy, so it is not all one body", () => {
  const { bodies, seconds } = shapeEncounter(ARCHETYPES, { target: 120, dps: 18 });
  assert.ok(bodies.length >= 3, `${bodies.length} bodies`);
  assert.ok(bodies.some((b) => WEIGHT[b.name] === "heavy"), "there is a heavy");
  assert.ok(bodies.some((b) => WEIGHT[b.name] !== "heavy"), "and it is not all heavy");
  assert.ok(seconds >= 100, `${seconds.toFixed(0)}s of fighting`);
});

test("the target bands are ordered and sane", () => {
  assert.ok(TTL_TARGET.light.max < TTL_TARGET.medium.max);
  assert.ok(TTL_TARGET.medium.max < TTL_TARGET.heavy.max);
  assert.ok(TTL_TARGET.heavy.max < TTL_TARGET.boss.max);
  for (const t of Object.values(TTL_TARGET)) assert.ok(t.min > 0 && t.max > t.min);
});
