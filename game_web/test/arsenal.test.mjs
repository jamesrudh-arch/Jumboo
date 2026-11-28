// Arsenal tests. The point of these is not that the numbers are what they are,
// but that the ladder holds together: every rung changes how a fight is won, and
// the trade-offs are real rather than cosmetic.

import test from "node:test";
import assert from "node:assert/strict";

import {
  WEAPONS, MODE, DAMAGE, Loadout, weaponById, unlockedAt, resolveHit, armourAt,
} from "../src/arsenal.js";

test("every weapon points at a model that exists, or is explicitly unarmed", () => {
  for (const w of WEAPONS) {
    if (w.model === null) {
      assert.equal(w.id, "fists", `${w.id} must name a model`);
    } else {
      assert.match(w.model, /^[A-Za-z0-9_-]+$/, `${w.id} model name is a file stem`);
    }
  }
});

test("the ladder starts unarmed and is ordered by tier", () => {
  const tiers = WEAPONS.map((w) => w.tier);
  assert.equal(Math.min(...tiers), 0);
  assert.equal(WEAPONS.find((w) => w.tier === 0).id, "fists");
  // Nothing above tier 0 is available to a fresh run.
  assert.deepEqual(unlockedAt(0).map((w) => w.id), ["fists"]);
});

test("melee is silent and firearms are not", () => {
  const melee = WEAPONS.filter((w) => w.mode === MODE.MELEE);
  const guns = WEAPONS.filter((w) => w.mode !== MODE.MELEE && w.mode !== MODE.THROWN);
  assert.ok(melee.length >= 2, "there are at least two melee weapons");
  for (const w of melee) assert.ok(w.noise <= 4, `${w.id} is quiet`);
  for (const w of guns) assert.ok(w.noise >= 7, `${w.id} makes noise`);
});

test("louder is stronger: every firearm above a melee weapon is noisier than it", () => {
  const quietestGun = Math.min(...WEAPONS.filter((w) => w.mode === MODE.SIDEARM).map((w) => w.noise));
  const loudestMelee = Math.max(...WEAPONS.filter((w) => w.mode === MODE.MELEE).map((w) => w.noise));
  assert.ok(quietestGun > loudestMelee, "a suppressed shot is still louder than a knife");
});

test("armour makes the quiet route the better one", () => {
  // The design claim, tested: against a vest that stops most of a pistol round,
  // a blade that pierces armour does more per hit than a bullet that does not.
  const armour = 0.6;
  const knife = resolveHit(weaponById("knife"), { armour, distance: 1.2 });
  const pistol = resolveHit(weaponById("pistol"), { armour, distance: 2 });
  assert.ok(knife.hit && pistol.hit);
  assert.ok(knife.damage > pistol.damage, `knife ${knife.damage} should beat pistol ${pistol.damage}`);
});

test("range is real: a pistol cannot hit across the district", () => {
  const pistol = weaponById("pistol");
  assert.equal(resolveHit(pistol, { distance: pistol.reach + 1 }).hit, false);
  const rifle = weaponById("sniper");
  assert.equal(resolveHit(rifle, { distance: pistol.reach + 1 }).hit, true);
});

test("damage falls off with distance but never to zero inside range", () => {
  const rifle = weaponById("sniper");
  const near = resolveHit(rifle, { distance: 1 });
  const far = resolveHit(rifle, { distance: rifle.reach - 1 });
  assert.ok(near.damage > far.damage, "further is weaker");
  assert.ok(far.damage > 0, "still a hit at maximum range");
});

test("a shotgun loses pellets at range rather than damage per pellet", () => {
  const sg = weaponById("shotgun");
  const near = resolveHit(sg, { distance: 0.5 });
  const far = resolveHit(sg, { distance: sg.reach - 0.2 });
  assert.ok(near.landed > far.landed, "fewer pellets land far away");
});

test("each damage type is used by at least one weapon", () => {
  const used = new Set(WEAPONS.map((w) => w.damage));
  for (const d of Object.values(DAMAGE)) {
    assert.ok(used.has(d), `${d} is carried by a weapon`);
  }
});

test("loadout gates on tier and starts from fists", () => {
  const fresh = new Loadout();
  assert.equal(fresh.current, "fists");
  assert.deepEqual([...fresh.owned], ["fists"]);

  const later = new Loadout({ tier: 6 });
  assert.ok(later.has("sniper"));
  assert.ok(!later.has("rocketlauncher"), "tier 9 is not in a tier 6 kit");
});

test("firing consumes ammo and an empty gun is not a free pass", () => {
  const l = new Loadout({ tier: 2 });
  l.select("pistol");
  assert.equal(l.roundsLeft(), 12);
  for (let i = 0; i < 12; i++) {
    assert.ok(l.use(), `shot ${i + 1} fires`);
    l.tick(l.weapon.rate);
  }
  assert.equal(l.roundsLeft(), 0);
  const dry = l.use();
  assert.ok(dry && dry.dry, "the thirteenth pull is a dry fire");
  assert.ok(l.cooldown > 0, "and it still costs time");
});

test("cooldown blocks a second shot in the same instant", () => {
  const l = new Loadout({ tier: 2 });
  l.select("pistol");
  assert.ok(l.use());
  assert.equal(l.use(), null, "cannot fire twice without time passing");
  l.tick(l.weapon.rate);
  assert.ok(l.use(), "can fire once the cooldown is spent");
});

test("melee never runs out and never needs a reload", () => {
  const l = new Loadout({ tier: 1 });
  l.select("knife");
  assert.equal(l.roundsLeft(), Infinity);
  for (let i = 0; i < 50; i++) {
    assert.ok(l.use());
    l.tick(l.weapon.rate);
  }
  assert.equal(l.reload(), 0, "nothing to reload");
});

test("reload moves rounds from reserve and caps at the magazine", () => {
  const l = new Loadout({ tier: 2 });
  l.select("pistol");
  for (let i = 0; i < 5; i++) { l.use(); l.tick(l.weapon.rate); }
  assert.equal(l.roundsLeft(), 7);
  const moved = l.reload();
  assert.equal(moved, 5);
  assert.equal(l.roundsLeft(), 12);
  assert.equal(l.reserveLeft(), 55);
});

test("cycling visits only owned weapons and wraps", () => {
  const l = new Loadout({ tier: 2 });
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    l.cycle(1);
    seen.add(l.current);
  }
  assert.deepEqual([...seen].sort(), ["fists", "knife", "pistol"]);
});

test("raising the tier unlocks the next rung without resetting ammo", () => {
  const l = new Loadout({ tier: 2 });
  l.select("pistol");
  for (let i = 0; i < 4; i++) { l.use(); l.tick(l.weapon.rate); }
  const spent = l.roundsLeft();
  assert.equal(spent, 8);
  l.raiseTier(5);
  assert.ok(l.has("shotgun"), "the new rung is unlocked");
  assert.ok(l.has("uzi"), "and every rung below it");
  // Ammo already fired stays fired: a tier-up is not an ammo crate.
  l.select("pistol");
  assert.equal(l.roundsLeft(), spent);
});

test("snapshot is safe to render", () => {
  const l = new Loadout({ tier: 4 });
  l.select("uzi");
  const s = l.snapshot();
  assert.equal(s.id, "uzi");
  assert.equal(s.name, "Machine pistol");
  assert.ok(s.ammo >= 0);
  assert.ok(Array.isArray(s.owned));
});

test("armour degrades under sustained fire but never becomes free", () => {
  assert.equal(armourAt(0), 0);
  const fresh = armourAt(0.6, 0);
  const worn = armourAt(0.6, 8);
  const ruined = armourAt(0.6, 200);
  assert.equal(fresh, 0.6);
  assert.ok(worn < fresh, "armour wears");
  assert.ok(ruined > 0, "but never disappears: a quarter of the original remains");
  assert.ok(ruined < fresh * 0.3);
});

test("a fresh hit is not degraded: priorHits defaults to zero", () => {
  const w = weaponById("pistol");
  const a = resolveHit(w, { armour: 0.5, distance: 2 });
  const b = resolveHit(w, { armour: 0.5, distance: 2, priorHits: 0 });
  assert.equal(a.damage, b.damage);
});

test("the wave-6 weapon can finish a wave-6 brute in one magazine", () => {
  // The regression this protects: the machine pistol needed 37 rounds for
  // 220 hp behind 60% armour and carried 32, so the reward for wave 6 could not
  // kill the thing wave 6 is about. Armour degradation is the fix.
  const waves = { uzi: { health: 220, armour: 0.6 }, shotgun: { health: 220, armour: 0.6 } };
  for (const [id, target] of Object.entries(waves)) {
    const w = weaponById(id);
    let hp = target.health;
    let shots = 0;
    const dist = Math.min(2, w.reach * 0.5);
    while (hp > 0 && shots < 500) {
      hp -= resolveHit(w, { armour: target.armour, distance: dist, priorHits: shots }).damage;
      shots += 1;
    }
    assert.ok(shots <= w.ammo, `${id} needs ${shots} shots but holds ${w.ammo}`);
  }
});

test("a blade still beats a bullet on an armoured target at equal hit count", () => {
  // Degradation must not erase the knife's identity on the first exchange.
  const armour = 0.6;
  const knife = resolveHit(weaponById("knife"), { armour, distance: 1.2, priorHits: 0 });
  const pistol = resolveHit(weaponById("pistol"), { armour, distance: 2, priorHits: 0 });
  assert.ok(knife.damage > pistol.damage);
});
