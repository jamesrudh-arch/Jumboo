// Feel tests. These are the difference between "combat exists" and "combat has
// weight", so they are worth pinning: shake decays, haptics scale, hitstop
// freezes the simulation without locking it, and decals stay bounded.

import test from "node:test";
import assert from "node:assert/strict";

import { FEEL, Shake, Haptics, Hitstop, Decals, CombatFeel } from "../src/feel.js";
import { weaponById } from "../src/arsenal.js";

/** A fake environment that records vibration patterns and pad calls. */
function fakeEnv({ vibrate = true, pads = 0 } = {}) {
  const calls = { vibrate: [], padEffects: [] };
  const env = { navigator: {} };
  if (vibrate) env.navigator.vibrate = (p) => { calls.vibrate.push(p); return true; };
  if (pads) {
    const list = [];
    for (let i = 0; i < pads; i++) {
      list.push({
        connected: true,
        vibrationActuator: {
          playEffect(kind, opts) {
            calls.padEffects.push({ kind, opts });
            return Promise.resolve("complete");
          },
        },
      });
    }
    env.navigator.getGamepads = () => list;
  }
  return { env, calls };
}

test("every weapon has a feel profile", () => {
  for (const id of ["fists", "knife", "pistol", "pistolSilencer", "uzi", "shotgun",
    "sniper", "machinegun", "flamethrower", "rocketlauncher", "blaster", "grenade"]) {
    assert.ok(FEEL[id], `${id} has a profile`);
    assert.ok(FEEL[id].rumble > 0, `${id} is felt`);
  }
});

test("the launcher is the most violent thing in the game", () => {
  for (const [id, f] of Object.entries(FEEL)) {
    if (id === "rocketlauncher") continue;
    assert.ok(FEEL.rocketlauncher.trauma >= f.trauma, `launcher trauma beats ${id}`);
  }
  assert.ok(FEEL.shotgun.trauma > FEEL.pistol.trauma, "a shotgun kicks more than a pistol");
  assert.ok(FEEL.pistolSilencer.trauma < FEEL.pistol.trauma, "a silencer is softer");
});

test("shake decays to nothing and never exceeds the trauma cap", () => {
  const s = new Shake();
  s.add(5);
  assert.equal(s.trauma, 1, "trauma is capped at 1");
  s.tick(0.016);
  const first = s.trauma;
  for (let i = 0; i < 200; i++) s.tick(0.016);
  assert.equal(s.trauma, 0, "settles");
  assert.ok(first > 0 && first < 1);
});

test("shake offset is trauma squared, so small hits barely register", () => {
  const small = new Shake().add(0.15); small.tick(0);
  const big = new Shake().add(0.9); big.tick(0);
  const sm = Math.hypot(small.offset.x, small.offset.y, small.offset.z);
  const bg = Math.hypot(big.offset.x, big.offset.y, big.offset.z);
  assert.ok(bg > sm * 4, `big shake ${bg.toFixed(3)} dwarfs small ${sm.toFixed(3)}`);
});

test("shake roll stays small enough not to make the player sick", () => {
  const s = new Shake().add(1); s.tick(0.4);
  assert.ok(Math.abs(s.roll) <= 0.055, "roll is a tilt, not a barrel roll");
});

test("haptics use the gamepad when there is one, and the phone otherwise", () => {
  const pad = fakeEnv({ pads: 1 });
  const h1 = new Haptics(pad.env);
  h1.pollPads();
  assert.equal(h1.pads.length, 1);
  assert.ok(h1.fire("shotgun"));
  assert.equal(pad.calls.padEffects.length, 1);
  assert.equal(pad.calls.padEffects[0].kind, "dual-rumble");
  assert.equal(pad.calls.vibrate.length, 0, "the pad is preferred over the phone");

  const phone = fakeEnv({ pads: 0 });
  const h2 = new Haptics(phone.env);
  assert.ok(h2.fire("pistol"));
  assert.equal(phone.calls.vibrate.length, 1);
});

test("haptic strength tracks the weapon, not the platform", () => {
  const { env, calls } = fakeEnv({ pads: 1 });
  const h = new Haptics(env);
  h.pollPads();
  h.fire("pistolSilencer");
  h.fire("rocketlauncher");
  const [a, b] = calls.padEffects.map((c) => c.opts.strongMagnitude);
  assert.ok(b > a * 2, `launcher ${b} should dwarf silencer ${a}`);
});

test("a distant shot does not buzz the player", () => {
  const { env, calls } = fakeEnv();
  const h = new Haptics(env);
  assert.equal(h.fire("pistol", 0.02), false, "near-zero scale is dropped");
  assert.equal(calls.vibrate.length, 0);
});

test("with no haptics hardware, nothing throws", () => {
  const h = new Haptics({ navigator: {} });
  assert.equal(h.supported.any, false);
  assert.equal(h.fire("shotgun"), false);
});

test("hitstop freezes the simulation and then lets it go", () => {
  const hs = new Hitstop();
  hs.trigger(0.06);
  assert.ok(hs.active);
  assert.equal(hs.consume(0.016), 0, "the frame is fully frozen");
  assert.ok(hs.consume(0.016) === 0);
  // Drain it.
  let t = 0;
  while (hs.active && t < 1) { hs.consume(0.01); t += 0.01; }
  assert.equal(hs.active, false);
  assert.equal(hs.consume(0.016), 0.016, "time runs again");
});

test("stacked hits take the longest, never the sum", () => {
  const hs = new Hitstop();
  hs.trigger(0.04);
  hs.trigger(0.03);
  assert.equal(hs.remaining, 0.04, "a weaker second hit does not extend it");
  hs.trigger(0.08);
  assert.equal(hs.remaining, 0.08, "a stronger one does");
});

test("a long dt does not leave hitstop stuck active", () => {
  const hs = new Hitstop();
  hs.trigger(0.05);
  const left = hs.consume(0.5);
  assert.equal(left, 0.45);
  assert.equal(hs.active, false);
});

test("decals are ring-buffered at the budget", () => {
  const d = new Decals({ max: 10 });
  for (let i = 0; i < 25; i++) d.add({ kind: "blood" });
  assert.equal(d.count, 10, "never exceeds the budget");
  assert.ok(d.dropped > 0);
});

test("decals expire", () => {
  const d = new Decals({ max: 8 });
  d.add({ kind: "spark", life: 1 });
  d.tick(0.5);
  assert.equal(d.count, 1);
  d.tick(0.6);
  assert.equal(d.count, 0);
});

test("combat feel routes a use through every channel at once", () => {
  const { env, calls } = fakeEnv();
  const feel = new CombatFeel(env);
  const shotgun = weaponById("shotgun");
  feel.onUse(shotgun, { hit: { damage: 70, armoured: false } });
  assert.ok(feel.shake.trauma > 0, "camera moved");
  assert.equal(calls.vibrate.length, 1, "hands felt it");
  assert.ok(feel.hitstop.active, "the frame froze");
  assert.ok(feel.muzzle.lit > 0, "the muzzle flashed");
  assert.equal(feel.decals.count, 1, "it left a mark");
});

test("an armoured hit sparks instead of bleeding", () => {
  const feel = new CombatFeel(fakeEnv().env);
  feel.onUse(weaponById("pistol"), { hit: { damage: 10, armoured: true } });
  assert.equal(feel.decals.items[0].kind, "spark");
});

test("a miss shakes but does not stop time", () => {
  const feel = new CombatFeel(fakeEnv().env);
  feel.onUse(weaponById("pistol"), { hit: null });
  assert.ok(feel.shake.trauma > 0);
  assert.equal(feel.hitstop.active, false, "no hitstop without a hit");
  assert.equal(feel.decals.count, 0);
});

test("a blast far away is not felt", () => {
  const feel = new CombatFeel(fakeEnv().env);
  feel.onBlast(60);
  assert.equal(feel.shake.trauma, 0);
});

test("the event buffer does not grow without bound", () => {
  const feel = new CombatFeel(fakeEnv().env);
  for (let i = 0; i < 100; i++) feel.onUse(weaponById("uzi"), {});
  assert.ok(feel.events.length <= 32);
});

test("tick returns simulation time and drains the flash", () => {
  const feel = new CombatFeel(fakeEnv().env);
  feel.onUse(weaponById("pistol"), { hit: { damage: 20, armoured: false } });
  const first = feel.tick(0.01);
  assert.equal(first, 0, "hitstop ate the frame");
  let t = 0;
  let sim = 0;
  while (t < 0.2) { sim += feel.tick(0.02); t += 0.02; }
  assert.ok(sim > 0, "time resumed");
  assert.equal(feel.muzzle.lit, 0, "the flash is brief");
});
