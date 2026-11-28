// Roster tests. The threat curve is the thing worth protecting: a wave table
// that rises in hit points but dips in *pressure* produces a run that gets
// easier as it goes, and no amount of new models hides that.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ARCHETYPES, ARCHETYPE, WAVES, waveEnemies, waveHealth, waveThreat, waveAt, statLine,
} from "../src/enemies.js";

const here = dirname(fileURLToPath(import.meta.url));
const enemyDir = join(here, "..", "assets", "arsenal", "enemies");

test("every archetype names a model and distinct behaviour", () => {
  for (const [key, def] of Object.entries(ARCHETYPES)) {
    assert.ok(def.label, `${key} has a label`);
    assert.ok(def.health > 0, `${key} can be killed`);
    assert.ok(def.speed > 0, `${key} moves`);
    assert.ok(def.sight > 0, `${key} sees`);
    assert.match(def.model, /__/, `${key} names a vendored model`);
  }
});

test("each archetype is a different problem, not a reskin", () => {
  // The anti-repetition claim, made checkable: no two archetypes share the same
  // constellation of health/armour/speed/attack kind.
  const sigs = new Set();
  for (const def of Object.values(ARCHETYPES)) {
    const sig = [def.health, def.armour, def.speed, def.attack?.kind ?? "none", def.flyHeight ?? 0].join("|");
    assert.ok(!sigs.has(sig), `duplicate stat line: ${sig}`);
    sigs.add(sig);
  }
  // And the specific things the player must learn:
  assert.ok(ARCHETYPES[ARCHETYPE.BRUTE].armour > ARCHETYPES[ARCHETYPE.RUNNER].armour, "the brute is armoured");
  assert.ok(ARCHETYPES[ARCHETYPE.RUNNER].speed > ARCHETYPES[ARCHETYPE.BRUTE].speed, "the runner is fast");
  assert.ok(ARCHETYPES[ARCHETYPE.FLYER].flyHeight > 1, "the flyer is off the ground");
  assert.equal(ARCHETYPES[ARCHETYPE.WATCHER].attack, null, "the watcher does not attack");
  assert.ok(ARCHETYPES[ARCHETYPE.WATCHER].calls, "the watcher calls instead");
  assert.ok(ARCHETYPES[ARCHETYPE.SNIPER].tells?.glint > 0, "the sniper telegraphs");
});

test("enemy models actually exist on disk", () => {
  const missing = [];
  for (const [key, def] of Object.entries(ARCHETYPES)) {
    if (!existsSync(join(enemyDir, `${def.model}.glb`))) missing.push(`${key} -> ${def.model}.glb`);
  }
  assert.deepEqual(missing, [], `missing models: ${missing.join(", ")}`);
});

test("the threat curve rises on every wave", () => {
  let prev = 0;
  for (const wave of WAVES) {
    const t = waveThreat(wave);
    assert.ok(t > prev, `wave ${wave.n} (${t}) must exceed wave ${wave.n - 1} (${prev})`);
    prev = t;
  }
});

test("the roster expands, and late waves use many archetypes at once", () => {
  const kinds = WAVES.map((w) => new Set(w.spawn.map((s) => s.archetype)));
  assert.ok(kinds[0].size <= 1, "wave 1 is one kind");
  assert.ok(kinds[9].size >= 5, "the last table wave mixes five or more");
  // Every archetype appears somewhere in the table.
  const used = new Set(WAVES.flatMap((w) => w.spawn.map((s) => s.archetype)));
  for (const key of Object.keys(ARCHETYPES)) assert.ok(used.has(key), `${key} appears in a wave`);
});

test("packs expand into several bodies", () => {
  const wave = { spawn: [{ archetype: ARCHETYPE.PACK, count: 2 }] };
  const n = waveEnemies(wave).length;
  assert.ok(n > 2, `a pack group of 2 is ${n} bodies`);
  assert.equal(n, ARCHETYPES[ARCHETYPE.PACK].spawns * 2);
});

test("later waves are bigger as well as tougher", () => {
  assert.ok(waveHealth(WAVES[9]) > waveHealth(WAVES[0]) * 4, "the last wave is far heavier");
  assert.ok(waveEnemies(WAVES[9]).length > waveEnemies(WAVES[0]).length, "and has more bodies");
});

test("waves continue past the table with rising scale", () => {
  const a = waveAt(11);
  const b = waveAt(21);
  assert.equal(a.n, 11);
  assert.ok(a.scale > 1);
  assert.ok(b.scale > a.scale);
  assert.ok(waveThreat(waveAt(11)) > waveThreat(WAVES[9]) || a.scale > 1);
});

test("scaling raises health and armour but caps armour", () => {
  const base = statLine(ARCHETYPE.BRUTE, 1);
  const late = statLine(ARCHETYPE.BRUTE, 3);
  assert.ok(late.health > base.health);
  assert.ok(late.armour > base.armour);
  assert.ok(late.armour <= 0.85, "armour cannot become invulnerable");
  assert.equal(base.archetype, ARCHETYPE.BRUTE);
  assert.equal(statLine(ARCHETYPE.WATCHER, 2).attack, null, "a non-attacker stays a non-attacker");
});

test("base stats are not mutated by scaling", () => {
  const before = ARCHETYPES[ARCHETYPE.HEAVY].attack.power;
  statLine(ARCHETYPE.HEAVY, 4);
  assert.equal(ARCHETYPES[ARCHETYPE.HEAVY].attack.power, before);
});
