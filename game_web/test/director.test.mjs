// Encounter director tests. The claim is that pressure is paced, not dumped.

import test from "node:test";
import assert from "node:assert/strict";
import {
  EncounterDirector, PACE, THREAT, budgetForWave, spawnPointsFromCity,
} from "../src/director.js";
import { CITY } from "../src/city.js";

const live = (n, archetype = "pack") => Array.from({ length: n }, () => ({ dead: false, stats: { archetype } }));

test("nothing is released before the ramp opens", () => {
  const d = new EncounterDirector({ queue: ["pack", "pack", "pack"] });
  const sent = d.tick(1 / 60, []);
  assert.equal(sent.length, 0, "the first frame is not a wall of bodies");
});

test("bodies arrive, and the queue drains", () => {
  const d = new EncounterDirector({ queue: ["pack", "pack"] });
  let released = 0;
  let bodies = [];
  for (let i = 0; i < 60 * 10 && !d.done; i++) {
    const spawns = d.tick(1 / 60, bodies);
    released += spawns.length;
    bodies = bodies.concat(spawns.map((s) => ({ dead: false, stats: { archetype: s.archetype } })));
  }
  assert.ok(released >= 2, `released ${released}`);
  assert.equal(d.done, true, "the queue emptied");
});

test("the budget caps how much is on the field at once", () => {
  const d = new EncounterDirector({ queue: Array(40).fill("brute"), pace: PACE.PRESSURE });
  let bodies = [];
  let peak = 0;
  for (let i = 0; i < 60 * 12; i++) {
    const spawns = d.tick(1 / 60, bodies);
    bodies = bodies.concat(spawns.map((s) => ({ dead: false, stats: { archetype: s.archetype } })));
    peak = Math.max(peak, d.onField(bodies));
  }
  // Brutes are 6 threat each against a budget of 7: never more than two.
  assert.ok(peak <= 14, `peak pressure ${peak}, never a flood`);
});

test("an assault push spends more at once than a breath", () => {
  const measure = (pace) => {
    const d = new EncounterDirector({ queue: Array(20).fill("runner"), pace });
    let bodies = [];
    for (let i = 0; i < 60 * 4; i++) {
      const spawns = d.tick(1 / 60, bodies);
      bodies = bodies.concat(spawns.map((s) => ({ dead: false, stats: { archetype: s.archetype } })));
    }
    return d.onField(bodies);
  };
  const assault = measure(PACE.ASSAULT);
  const breath = measure(PACE.BREATH);
  assert.ok(assault > breath, `assault ${assault} > breath ${breath}`);
});

test("no bodies are released while the director is breathing", () => {
  const d = new EncounterDirector({ queue: ["pack"], pace: PACE.SPOTLIGHT });
  d.breath = 3;
  const sent = d.tick(1 / 60, []);
  assert.equal(sent.length, 0);
  assert.ok(d.breath < 3, "and the breath runs down");
});

test("the same seed produces the same encounter — a wave replays identically", () => {
  const run = () => {
    const d = new EncounterDirector({ queue: Array(8).fill("pack"), seed: 0xbeef, spawns: [{ x: 1, z: 1 }, { x: 2, z: 2 }, { x: 3, z: 3 }] });
    const order = [];
    let bodies = [];
    for (let i = 0; i < 60 * 20 && !d.done; i++) {
      const spawns = d.tick(1 / 60, bodies);
      for (const s of spawns) order.push(s.spawn?.x);
      bodies = bodies.concat(spawns.map((s) => ({ dead: false, stats: { archetype: s.archetype } })));
    }
    return order;
  };
  assert.deepEqual(run(), run());
});

test("spawn points are rotated, not funnelled through one", () => {
  const spawns = [{ x: 0 }, { x: 1 }, { x: 2 }, { x: 3 }];
  const d = new EncounterDirector({ queue: Array(12).fill("pack"), spawns });
  const used = new Set();
  let bodies = [];
  for (let i = 0; i < 60 * 30 && !d.done; i++) {
    const s = d.tick(1 / 60, bodies);
    for (const x of s) used.add(x.spawn.x);
    bodies = bodies.concat(s.map((y) => ({ dead: false, stats: { archetype: y.archetype } })));
  }
  assert.ok(used.size >= 3, `used ${used.size} of 4 spawns`);
});

test("a wave with no spawn points still runs", () => {
  const d = new EncounterDirector({ queue: ["pack"] });
  let bodies = [];
  for (let i = 0; i < 60 * 5 && !d.done; i++) {
    const s = d.tick(1 / 60, bodies);
    bodies = bodies.concat(s.map((y) => ({ dead: false, stats: { archetype: y.archetype } })));
  }
  assert.equal(d.done, true);
});

test("a Watcher is worth more than its health, and a Brute more still", () => {
  assert.ok(THREAT.watcher > THREAT.pack, "a caller turns one body into an ambush");
  assert.ok(THREAT.brute > THREAT.runner);
  assert.ok(THREAT.boss_warden > THREAT.boss_enforcer);
});

test("wave budgets rise, then rise gently on a replay lap", () => {
  const w1 = budgetForWave(1);
  const w10 = budgetForWave(10);
  const w20 = budgetForWave(20);
  assert.ok(w10 > w1, "harder by wave 10");
  assert.ok(w20 > w10, "and harder still later");
  assert.ok(w20 - w10 < w10 - w1, "but the second lap is a gentler slope");
});

test("the real district offers alley and canal spawn points", () => {
  const points = spawnPointsFromCity(CITY);
  assert.ok(points.length >= 4, `${points.length} points`);
  assert.ok(points.some((p) => p.kind === "alley"));
  assert.ok(points.some((p) => p.kind === "canal"));
});

test("a missing city yields no points rather than throwing", () => {
  assert.deepEqual(spawnPointsFromCity(null), []);
});
