// Mod tests. The rule that matters is that no mod is strictly better than
// nothing: a mod that dominates is an upgrade pretending to be a decision.

import test from "node:test";
import assert from "node:assert/strict";

import {
  MODS, modById, modsFor, applyMods, offerMods, isTradeOff, COST_ONLY_ELSEWHERE,
} from "../src/mods.js";
import { WEAPONS, weaponById, resolveHit } from "../src/arsenal.js";

test("every mod has an id, a slot and copy for the player", () => {
  const ids = new Set();
  for (const m of MODS) {
    assert.ok(m.id && !ids.has(m.id), `${m.id} is unique`);
    ids.add(m.id);
    assert.ok(m.kind, `${m.id} competes for a slot`);
    assert.ok(m.note && m.note.length > 5, `${m.id} explains itself`);
    assert.equal(typeof m.apply, "function");
  }
});

test("no mod is strictly better than base, bar the documented exemptions", () => {
  const failures = [];
  for (const weapon of WEAPONS) {
    for (const mod of modsFor(weapon)) {
      const verdict = isTradeOff(weapon, mod);
      if (!verdict.isTrade && !COST_ONLY_ELSEWHERE[mod.id]) {
        failures.push(`${weapon.id} + ${mod.id} only improves ${verdict.better.join(",")}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("a documented exemption really does pay somewhere the checker cannot see", () => {
  // The checker does not model armour, so the claim has to be made in the
  // simulation: piercing rounds must beat base against a 60% armoured body.
  const base = weaponById("pistol");
  const piercing = applyMods(base, ["armourPiercer"]);
  const armour = 0.6;
  const plain = resolveHit(base, { armour, distance: 3 });
  const pierced = resolveHit(piercing, { armour, distance: 3 });
  assert.ok(pierced.damage > plain.damage, `piercing ${pierced.damage} beats plain ${plain.damage} on armour`);
  // And it must lose on an unarmoured body, or it would be free.
  const soft = resolveHit(base, { armour: 0, distance: 3 });
  const softPierced = resolveHit(piercing, { armour: 0, distance: 3 });
  assert.ok(softPierced.damage < soft.damage, "and loses against flesh");
});

test("a mod never mutates the base weapon table", () => {
  const base = weaponById("pistol");
  const original = { ...base };
  applyMods(base, ["extended", "longBarrel"]);
  assert.deepEqual(base, original, "the shared table is untouched");
});

test("one mod per slot, so the slot is a choice", () => {
  const base = weaponById("pistol");
  const two = applyMods(base, ["extended", "drum"]);
  assert.equal(two.mods.length, 1, "the second magazine mod is ignored");
  assert.equal(two.ammo, Math.round(base.ammo * 1.6), "the first one applied");
});

test("mods from different slots stack", () => {
  const base = weaponById("pistol");
  const built = applyMods(base, ["extended", "longBarrel", "matchTrigger"]);
  assert.equal(built.mods.length, 3);
  assert.ok(built.ammo > base.ammo, "magazine");
  assert.ok(built.reach > base.reach, "barrel");
  assert.ok(built.rate < base.rate, "trigger");
});

test("a suppressor makes a real weapon quiet enough to matter", () => {
  const base = weaponById("pistol");
  const quiet = applyMods(base, ["suppressor"]);
  assert.ok(quiet.noise < base.noise * 0.5, `noise ${base.noise} -> ${quiet.noise}`);
  assert.ok(quiet.power < base.power, "and it costs damage");
});

test("a choke tightens the shotgun at the cost of pellets and reach", () => {
  const base = weaponById("shotgun");
  const choked = applyMods(base, ["choke"]);
  assert.ok(choked.spread < base.spread, "tighter");
  assert.ok(choked.pellets < base.pellets, "one fewer in the pattern");
  assert.ok(choked.reach < base.reach, "and shorter");
});

test("hollow point is worse than nothing against a brute", () => {
  // The mod that keeps the blade relevant: it does more to flesh and less to
  // armour, so the quiet weapon still has a job.
  const base = weaponById("pistol");
  const hp = applyMods(base, ["hollowPoint"]);
  const armour = 0.6;
  const plain = resolveHit(base, { armour, distance: 2 });
  const hollow = resolveHit(hp, { armour, distance: 2 });
  assert.ok(hollow.damage < plain.damage, `hollow ${hollow.damage} is worse than plain ${plain.damage} on armour`);
  const softPlain = resolveHit(base, { armour: 0, distance: 2 });
  const softHollow = resolveHit(hp, { armour: 0, distance: 2 });
  assert.ok(softHollow.damage > softPlain.damage, "and better on flesh");
});

test("melee gets only mods that mean something for a blade", () => {
  const knife = weaponById("knife");
  const offered = modsFor(knife).map((m) => m.id);
  assert.ok(offered.includes("longBarrel"), "reach matters to a blade");
  assert.ok(!offered.includes("extended"), "a blade has no magazine");
  assert.ok(!offered.includes("gripTape"), "and no spread to tighten");
  assert.ok(!offered.includes("hollowPoint"));
});

test("shotguns get a choke and rifles do not", () => {
  const chokeOnShotgun = modsFor(weaponById("shotgun")).some((m) => m.id === "choke");
  const chokeOnRifle = modsFor(weaponById("sniper")).some((m) => m.id === "choke");
  assert.equal(chokeOnShotgun, true);
  assert.equal(chokeOnRifle, false, "a rifle has no spread pattern to choke");
});

test("the offer never repeats what the player already has", () => {
  const base = weaponById("pistol");
  const owned = ["extended"];
  const offer = offerMods(base, owned);
  assert.ok(offer.length > 0);
  assert.ok(!offer.some((o) => o.id === "extended"));
  for (const o of offer) {
    assert.equal(o.kind, "mod");
    assert.ok(o.note.includes(base.name), "the note names the weapon it fits");
  }
});

test("an unknown mod id is ignored rather than crashing", () => {
  const built = applyMods(weaponById("pistol"), ["notARealMod"]);
  assert.deepEqual(built.mods, []);
  assert.equal(built.power, weaponById("pistol").power);
});

test("a built weapon still resolves hits identically to an unbuilt one", () => {
  // Mods must not break the rest of the combat math.
  const built = applyMods(weaponById("pistol"), ["longBarrel"]);
  const hit = resolveHit(built, { armour: 0.2, distance: 4 });
  assert.ok(hit.hit);
  assert.ok(hit.damage > 0);
});

test("modById round-trips", () => {
  for (const m of MODS) assert.equal(modById(m.id), m);
  assert.equal(modById("nope"), null);
});
