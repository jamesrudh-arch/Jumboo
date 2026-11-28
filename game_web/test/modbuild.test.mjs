// Mods wired into the loadout, proved by behaviour rather than by numbers.
//
// A mod system that changes a property on a sheet and nothing else is a menu.
// These tests fit a mod and then fight with it.

import test from "node:test";
import assert from "node:assert/strict";
import { Loadout, weaponById } from "../src/arsenal.js";
import { resolveHit } from "../src/arsenal.js";

const loadoutWith = (id, mods = []) => {
  const l = new Loadout({ tier: 6 });
  l.select(id);
  for (const m of mods) l.fitMod(id, m);
  return l;
};

test("an unmodded weapon is the base weapon", () => {
  const l = new Loadout({ tier: 6 });
  l.select("pistol");
  assert.deepEqual(l.weapon, weaponById("pistol"));
});

test("fitting a mod changes what the loadout reports", () => {
  const l = loadoutWith("pistol", ["extended"]);
  const base = weaponById("pistol");
  assert.ok(l.weapon.ammo > base.ammo, `magazine ${base.ammo} -> ${l.weapon.ammo}`);
});

test("a suppressor makes the gun quieter and weaker — a real trade", () => {
  const l = loadoutWith("pistol", ["suppressor"]);
  const base = weaponById("pistol");
  assert.ok(l.weapon.noise < base.noise, "quieter");
  assert.ok(l.weapon.power < base.power, "and it costs damage");
});

test("a suppressor changes the outcome of a shot, not just a number", () => {
  const base = weaponById("pistol");
  const suppressed = loadoutWith("pistol", ["suppressor"]).weapon;
  const opts = { armour: 0.2, distance: 6, priorHits: 0 };
  const loud = resolveHit(base, opts);
  const quiet = resolveHit(suppressed, opts);
  assert.ok(quiet.damage < loud.damage, `suppressed ${quiet.damage} vs ${loud.damage}`);
});

test("armour piercing beats base against armour and loses against flesh", () => {
  const base = weaponById("pistol");
  const piercing = loadoutWith("pistol", ["armourPiercer"]).weapon;
  const armoured = resolveHit(piercing, { armour: 0.6, distance: 6, priorHits: 0 });
  const armouredBase = resolveHit(base, { armour: 0.6, distance: 6, priorHits: 0 });
  assert.ok(armoured.damage > armouredBase.damage, "better against armour");
  const flesh = resolveHit(piercing, { armour: 0, distance: 6, priorHits: 0 });
  const fleshBase = resolveHit(base, { armour: 0, distance: 6, priorHits: 0 });
  assert.ok(flesh.damage < fleshBase.damage, "worse against flesh");
});

test("one mod per slot: fitting a second in the same slot replaces the first", () => {
  const l = loadoutWith("pistol", ["suppressor"]);
  const before = l.modsOn("pistol");
  assert.equal(before.length, 1);
  // Find another mod for the same slot as the suppressor.
  l.fitMod("pistol", "suppressor");
  assert.equal(l.modsOn("pistol").length, 1, "still one");
});

test("a mod that does not fit a weapon is refused", () => {
  const l = new Loadout({ tier: 6 });
  l.select("fists");
  assert.equal(l.fitMod("fists", "suppressor"), false, "no suppressor on fists");
  assert.equal(l.modsOn("fists").length, 0);
});

test("mods are per weapon, not per run", () => {
  const l = loadoutWith("pistol", ["extended"]);
  assert.equal(l.modsOn("pistol").length, 1, "the pistol is fitted");
  l.select("uzi");
  assert.equal(l.modsOn("uzi").length, 0, "the uzi is untouched");
  assert.equal(l.modsOn("pistol").length, 1, "and the pistol kept its mod");
  // And the fitted mod is reflected in what the pistol reports.
  l.select("pistol");
  assert.ok(l.weapon.ammo > weaponById("pistol").ammo);
});

test("a mod is offered on a mod wave and is actually taken", async () => {
  const { offerFor } = await import("../src/progression.js");
  const l = new Loadout({ tier: 6 });
  l.select("shotgun");
  const third = offerFor({ waveNumber: 3, loadout: l });
  const mod = third.find((o) => o.kind === "mod");
  assert.ok(mod, `wave three offers a mod: ${third.map((o) => o.kind).join(",")}`);
  const { Run } = await import("../src/progression.js");
  const run = new Run();
  run.loadout.select("shotgun");
  assert.equal(run.take(mod), true, "the offer is accepted");
  assert.ok(run.loadout.modsOn("shotgun").includes(mod.id));
});

test("mod waves are every third wave, not every wave", async () => {
  const { offerFor } = await import("../src/progression.js");
  const l = new Loadout({ tier: 6 });
  l.select("shotgun");
  for (const n of [1, 2, 4, 5, 7]) {
    const offer = offerFor({ waveNumber: n, loadout: l });
    assert.ok(!offer.some((o) => o.kind === "mod"), `wave ${n} has no mod`);
  }
  for (const n of [3, 6, 9]) {
    const offer = offerFor({ waveNumber: n, loadout: l });
    assert.ok(offer.some((o) => o.kind === "mod"), `wave ${n} has one`);
  }
});

test("a mod already fitted is not offered again", async () => {
  const { offerFor } = await import("../src/progression.js");
  const l = new Loadout({ tier: 6 });
  l.select("shotgun");
  const first = offerFor({ waveNumber: 3, loadout: l }).find((o) => o.kind === "mod");
  l.fitMod("shotgun", first.id);
  // Fit every mod in that slot so nothing else competes for it.
  const second = offerFor({ waveNumber: 6, loadout: l }).find((o) => o.kind === "mod");
  assert.notEqual(second?.id, first.id, "the fitted mod does not come back");
});
