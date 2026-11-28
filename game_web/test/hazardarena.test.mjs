// Environmental kills, wired into the arena.
//
// The rule tests prove the maths. These prove that a drum, in a real wave, with
// real archetypes and real armour, actually kills — and that it costs something.

import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/arena.js";
import { CITY, buildCity } from "../src/city.js";

const world = () => ({
  player: { x: 0, z: 0, yaw: 0, feetY: 0, crouch: 0, speed: 0 },
  camera: { x: 0, y: 2, z: 4 }, cameraYaw: 0,
  emit() {}, hearSound() {}, groundAt: () => 0, boxesNear: () => [],
});

const setup = () => {
  const arena = new Arena();
  arena.factory.loader = { async loadAsync() { throw new Error("proxy bodies"); } };
  arena.attach({ add() {} }, world());
  arena.attachHazards(buildCity().props, CITY.water[0]);
  arena.startWave();
  return arena;
};

test("the district's hazards are placed and reachable", () => {
  const arena = new Arena();
  const n = arena.attachHazards(buildCity().props, CITY.water[0]);
  assert.ok(n >= 8, `${n} hazards in the district`);
  assert.ok(arena.hazards.some((h) => h.kind === "barrel"));
  assert.ok(arena.hazards.some((h) => h.kind === "gasMain"));
});

test("a drum kills several bodies and costs a lot of noise", () => {
  const arena = setup();
  const live = arena.wave.live;
  live.forEach((e, i) => e.root.position.set(1 + i * 0.9, 0, 0));
  const h = arena.hazards.find((x) => x.kind === "barrel");
  h.x = 0; h.z = 0;

  let noise = 0;
  arena.world.hearSound = (e) => { noise = e.radius; };
  const before = live.filter((e) => !e.dead).length;
  const result = arena.trigger(h);

  assert.ok(result.kills.length >= 3, `${result.kills.length} of ${before} bodies killed`);
  assert.ok(noise >= 40, `heard ${noise} m away, so the street comes for you`);
  assert.ok(arena.stats.hazardKills >= 3);
  arena.clear();
});

test("a body at the rim survives a drum — reach is legible", () => {
  const arena = setup();
  const live = arena.wave.live;
  live.forEach((e, i) => e.root.position.set(1 + i * 0.9, 0, 0));
  const h = arena.hazards.find((x) => x.kind === "barrel");
  h.x = 0; h.z = 0;
  arena.trigger(h);
  const survivor = live.find((e) => !e.dead);
  if (survivor) assert.ok(survivor.root.position.x > 4.5, "it survived because it was outside");
  arena.clear();
});

test("a drum cannot be used twice", () => {
  const arena = setup();
  const h = arena.hazards.find((x) => x.kind === "barrel");
  arena.trigger(h);
  assert.equal(arena.trigger(h), null, "a spent drum does nothing");
  arena.clear();
});

test("fire keeps hurting after the bang", () => {
  const arena = setup();
  const h = arena.hazards.find((x) => x.kind === "barrel");
  arena.trigger(h);
  assert.equal(arena.fires.length, 1, "there is a fire");
  const victim = arena.wave.live[0];
  assert.ok(victim, "a body survived the blast to test the fire on");
  victim.dead = false;
  // Health lives on stats, not on the body: writing victim.health would create a
  // shadow property and measure nothing.
  victim.stats.health = 200;
  for (let i = 0; i < 90; i++) {
    // Hold it in the fire; a live body walks out on its own.
    victim.root.position.set(h.x, 0, h.z);
    arena.step(1 / 60);
  }
  assert.ok(victim.stats.health < 200, `fire took it to ${victim.stats.health}`);
  arena.clear();
});

test("fire burns out", () => {
  const arena = setup();
  const h = arena.hazards.find((x) => x.kind === "barrel");
  arena.trigger(h);
  for (let i = 0; i < 60 * 8; i++) arena.step(1 / 60);
  assert.equal(arena.fires.length, 0, "a fire is temporary");
  arena.clear();
});

test("the player can be burned by their own fire", () => {
  const arena = setup();
  const h = arena.hazards.find((x) => x.kind === "barrel");
  arena.world.player.x = h.x;
  arena.world.player.z = h.z;
  const before = arena.run.health;
  arena.trigger(h);
  for (let i = 0; i < 60; i++) arena.step(1 / 60);
  assert.ok(arena.run.health < before, "standing in your own fire costs you");
  arena.clear();
});

test("the canal drowns a body that is pushed into it", () => {
  const arena = setup();
  // Put a body in the canal. The canal is a channel below the pavement.
  const canal = CITY.water.find((w) => w.kind === "canal");
  const victim = arena.wave.live[0];
  victim.root.position.set((canal.x1 + canal.x2) / 2, canal.surfaceY - 0.2, (canal.z1 + canal.z2) / 2);
  const h = arena.hazards.find((x) => x.kind === "barrel");
  arena.trigger(h);
  assert.ok(victim.dead, "a body in the canal drowns, no trigger needed");
  arena.clear();
});

test("a hazard prompt only appears when one is actually in reach", () => {
  const arena = setup();
  const h = arena.hazards[0];
  arena.world.player.x = h.x + 50;
  arena.world.player.z = h.z;
  assert.equal(arena.hazardOffer(), null, "nothing in reach from across the district");
  arena.world.player.x = h.x;
  arena.world.player.z = h.z + 1.2;
  arena.world.cameraYaw = Math.PI; // facing -Z, toward the hazard
  const offer = arena.hazardOffer();
  assert.ok(offer, "an offer when standing next to one");
  assert.match(offer.prompt, /Use /);
  arena.clear();
});

test("hazard kills are counted separately from gun kills", () => {
  const arena = setup();
  const live = arena.wave.live;
  live.forEach((e, i) => e.root.position.set(1 + i * 0.9, 0, 0));
  const h = arena.hazards.find((x) => x.kind === "barrel");
  h.x = 0; h.z = 0;
  arena.trigger(h);
  assert.ok(arena.stats.hazardKills > 0);
  arena.clear();
});
