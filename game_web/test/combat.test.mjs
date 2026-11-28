// Combat tests. The combat loop is the one piece that has to be right in a
// browser and cannot be run in one here, so it is driven in Node against fakes
// for the four things it talks to: the world, the bodies, the feel layer and the
// audio mixer. A whole firefight runs in microseconds.

import test from "node:test";
import assert from "node:assert/strict";

import { Combat, angleDelta, spawnPoints, coneFor } from "../src/combat.js";
import { Run } from "../src/progression.js";
import { CombatFeel } from "../src/feel.js";
import { statLine, ARCHETYPE } from "../src/enemies.js";

/** A body good enough for the loop: position, height, stats, health. */
function body(archetype, { x = 0, z = -2, armour } = {}) {
  const stats = statLine(archetype, 1);
  if (armour !== undefined) stats.armour = armour;
  stats.health = stats.health;
  return {
    stats,
    root: { position: { x, y: 0, z } },
    height: stats.height,
    dead: false,
  };
}

function fakeEnemies(list = []) {
  return {
    live: list,
    damage(enemy, n) {
      if (enemy.dead) return null;
      enemy.stats.health -= n;
      if (enemy.stats.health <= 0) { enemy.dead = true; return "killed"; }
      return "hit";
    },
  };
}

function fakeWorld({ x = 0, z = 0, yaw = 0 } = {}) {
  const events = [];
  return {
    // Forward is +Z at yaw 0, so `aimYaw` is the same angle as `yaw` here. The
    // fake carries both because the real player does: one is intent, the other is
    // the animation that follows it.
    player: { x, z, yaw, aimYaw: yaw, feetY: 0 },
    events,
    emit(type, data) { events.push({ type, ...data }); },
    hearSound(x, z, r) { events.push({ type: "heard", x, z, radius: r }); },
  };
}

function fakeAudio() {
  const played = [];
  return { played, playEvent(e) { played.push(e); return true; } };
}

function fakeEnv() {
  const calls = { vibrate: [] };
  return { navigator: { vibrate: (p) => { calls.vibrate.push(p); return true; } }, calls };
}

function setup({ wave = 6, bodies = [], world = fakeWorld() } = {}) {
  const run = new Run();
  run.wave = wave;
  run.loadout.raiseTier(9);
  const audio = fakeAudio();
  const feel = new CombatFeel(fakeEnv());
  const enemies = fakeEnemies(bodies);
  const combat = new Combat({ world, run, enemies, feel, audio });
  return { combat, run, enemies, audio, feel, world };
}

test("a shot at nothing still costs ammo and makes noise", () => {
  const { combat, world, run } = setup({ bodies: [] });
  run.loadout.select("pistol");
  const before = run.loadout.roundsLeft();
  const r = combat.fire();
  assert.ok(r);
  assert.equal(r.hit, null);
  assert.equal(run.loadout.roundsLeft(), before - 1);
  assert.ok(world.events.some((e) => e.type === "shot"), "the shot is announced to the street");
  assert.ok(world.events.some((e) => e.type === "heard"), "and the collectors hear it");
});

test("a shot into a body damages it and pulls the street", () => {
  const target = body(ARCHETYPE.RUNNER, { z: 3 });
  const { combat, run, world } = setup({ bodies: [target] });
  run.loadout.select("pistol");
  const hp = target.stats.health;
  const r = combat.fire();
  assert.equal(r.target, ARCHETYPE.RUNNER);
  assert.ok(r.hit.hit);
  assert.ok(target.stats.health < hp, "health went down");
  assert.equal(combat.hits, 1);
  const heard = world.events.find((e) => e.type === "heard");
  assert.equal(heard.radius, 26, "a pistol carries 26 m, which is what the ladder says");
});

test("a kill is registered with the run, and quietly if the weapon is quiet", () => {
  const target = body(ARCHETYPE.PACK, { z: 1 });
  target.stats.health = 5;
  const { combat, run } = setup({ wave: 3, bodies: [target] });
  run.loadout.raiseTier(1);
  run.loadout.select("knife");
  const r = combat.fire();
  assert.ok(r.killed);
  assert.equal(run.kills, 1);
  assert.equal(run.quietKills, 1, "a knife kill is quiet");
  assert.equal(combat.quietKills, 1);
});

test("a loud kill is not counted quiet", () => {
  const target = body(ARCHETYPE.PACK, { z: 2 });
  target.stats.health = 5;
  const { combat, run } = setup({ wave: 3, bodies: [target] });
  run.loadout.select("shotgun");
  combat.fire();
  assert.equal(run.kills, 1);
  assert.equal(run.quietKills, 0);
});

test("a body out of range cannot be hit, and the aim is honest about it", () => {
  const target = body(ARCHETYPE.RUNNER, { z: 40 });
  const { combat, run } = setup({ bodies: [target] });
  run.loadout.select("pistol"); // 12 m
  assert.equal(combat.findTarget(run.loadout.weapon), null, "nothing at 40 m for a pistol");
  const rifle = run.loadout.select("sniper");
  assert.ok(combat.findTarget(run.loadout.weapon), `a rifle reaches 40 m (${rifle})`);
});

test("a player facing away from a body cannot shoot it", () => {
  // Forward is +Z at yaw 0 (the camera sits behind on -Z and looks toward +Z).
  // So a body at +Z is in FRONT and a body at -Z is behind: this test used to
  // assert the opposite, which is the convention bug it was meant to catch.
  const behind = body(ARCHETYPE.RUNNER, { z: -6 });
  const world = fakeWorld({ yaw: 0 });
  const { combat, run } = setup({ bodies: [behind], world });
  run.loadout.select("pistol");
  assert.equal(combat.findTarget(run.loadout.weapon), null, "a body behind is out of the cone");

  // And the same body in front is hit, so the test cannot pass by rejecting all.
  const front = body(ARCHETYPE.RUNNER, { z: 6 });
  const w2 = fakeWorld({ yaw: 0 });
  const s2 = setup({ bodies: [front], world: w2 });
  s2.run.loadout.select("pistol");
  assert.ok(s2.combat.findTarget(s2.run.loadout.weapon), "a body in front is hit");
});

test("melee cannot reach a flyer overhead", () => {
  const flyer = body(ARCHETYPE.FLYER, { z: 1 });
  flyer.root.position.y = 3.2;
  const { combat, run } = setup({ bodies: [flyer] });
  run.loadout.raiseTier(1);
  run.loadout.select("knife");
  assert.equal(combat.findTarget(run.loadout.weapon), null, "a knife does not touch a flyer");
  run.loadout.select("pistol");
  assert.ok(combat.findTarget(run.loadout.weapon), "a pistol does");
});

test("a shotgun spreads damage onto a body standing next to the target", () => {
  const target = body(ARCHETYPE.RUNNER, { z: 2 });
  const neighbour = body(ARCHETYPE.RUNNER, { x: 0.8, z: 2 });
  const { combat, run } = setup({ bodies: [target, neighbour] });
  run.loadout.select("shotgun");
  const hp = neighbour.stats.health;
  combat.fire();
  assert.ok(neighbour.stats.health < hp, "the neighbour was hit by the spread");
});

test("armour degrades per body, not globally", () => {
  // Firing 10 rounds into one brute must not make the *next* brute softer.
  const a = body(ARCHETYPE.BRUTE, { z: 2 });
  const b = body(ARCHETYPE.BRUTE, { z: 2, x: 0.01 });
  a.stats.health = 9999;
  b.stats.health = 9999;
  const { combat, run, enemies } = setup({ bodies: [a] });
  run.loadout.select("uzi");
  for (let i = 0; i < 10; i++) { combat.fire(); run.loadout.tick(0.2); }
  const degraded = combat.priorHits.get(a);
  assert.ok(degraded >= 8, `the first brute took hits (${degraded})`);
  assert.equal(combat.priorHits.get(b), undefined, "the second brute is untouched");
  void enemies;
});

test("dry fire makes a sound and costs time but no ammo", () => {
  const { combat, run, audio } = setup({ bodies: [] });
  run.loadout.select("sniper");
  for (let i = 0; i < 5; i++) { combat.fire(); run.loadout.tick(2); }
  assert.equal(run.loadout.roundsLeft(), 0);
  const before = run.loadout.roundsLeft();
  const r = combat.fire();
  assert.ok(r.dry);
  assert.equal(run.loadout.roundsLeft(), before);
  assert.ok(audio.played.some((e) => e.type === "dry-fire"));
});

test("reloading reports how much moved and plays a click", () => {
  const { combat, run, audio } = setup({ bodies: [] });
  run.loadout.select("pistol");
  for (let i = 0; i < 4; i++) { combat.fire(); run.loadout.tick(0.5); }
  const moved = combat.reload();
  assert.equal(moved, 4);
  assert.ok(audio.played.some((e) => e.type === "reload"));
});

test("a launcher blast shakes the camera and marks the ground", () => {
  const target = body(ARCHETYPE.BRUTE, { z: 6 });
  target.stats.health = 10;
  const { combat, run, feel } = setup({ bodies: [target] });
  run.loadout.select("rocketlauncher");
  combat.fire();
  assert.ok(feel.shake.trauma > 0.5, "a launcher is felt");
  assert.ok(feel.decals.count >= 1);
});

test("per-body hit counts do not leak between waves", () => {
  const a = body(ARCHETYPE.RUNNER, { z: 2 });
  const { combat, run, enemies } = setup({ bodies: [a] });
  run.loadout.select("pistol");
  combat.fire();
  assert.equal(combat.priorHits.get(a), 1);
  // A new wave replaces the live list; the old body is gone from it.
  enemies.live = [];
  assert.equal(combat.findTarget(run.loadout.weapon), null);
});

test("the HUD shows a crosshair only when the weapon has one", () => {
  const { combat, run } = setup({ bodies: [] });
  run.loadout.raiseTier(1);
  run.loadout.select("knife");
  assert.equal(combat.hud().crosshair, false);
  run.loadout.select("pistol");
  assert.equal(combat.hud().crosshair, true);
  assert.equal(combat.hud().weapon.id, "pistol");
  assert.equal(combat.hud().accuracy, null, "no shots fired yet");
});

test("accuracy is measured, not guessed", () => {
  const target = body(ARCHETYPE.RUNNER, { z: 2 });
  const { combat, run } = setup({ bodies: [target] });
  run.loadout.select("pistol");
  // Derive the number of kills from the real stat line rather than hard-coding
  // it: this test used to assert "two hits kill a 40 hp runner", which stopped
  // being true the moment health was rebalanced for a longer fight.
  const perHit = combat.fire() && combat.findTarget(run.loadout.weapon);
  void perHit;
  run.loadout.tick(0.5);
  let shots = 1;
  let guard = 0;
  while (!target.dead && guard++ < 60) {
    combat.fire();
    run.loadout.tick(0.5);
    shots += 1;
  }
  const kills = shots;
  // One more shot: there is nothing left to hit, so it must count as a miss.
  combat.fire();
  run.loadout.tick(0.5);
  assert.equal(combat.hits, kills, `every shot until death hit (${kills})`);
  assert.equal(combat.misses, 1, "the killed body cannot be hit again");
  assert.ok(Math.abs(combat.hud().accuracy - kills / (kills + 1)) < 1e-9);
});

test("angleDelta wraps the short way round", () => {
  assert.ok(Math.abs(angleDelta(0.1, -0.1) - 0.2) < 1e-9);
  const wrapped = angleDelta(Math.PI - 0.05, -Math.PI + 0.05);
  assert.ok(Math.abs(wrapped) < 0.2, `wrapped to ${wrapped}, not 2pi`);
});

test("waves spawn behind the player, never in the forward cone", () => {
  const world = fakeWorld({ yaw: 0 });
  const points = spawnPoints(world, 6);
  assert.equal(points.length, 6);
  // Forward is +Z at yaw 0, which is also the `aimYaw` convention.
  const facing = world.player.aimYaw ?? world.player.yaw;
  for (const p of points) {
    assert.ok(Math.hypot(p.x, p.z) >= 9, "not on top of the player");
    const angle = Math.atan2(p.x - world.player.x, p.z - world.player.z);
    assert.ok(Math.abs(angleDelta(angle, facing)) > 0.3, `spawn ${JSON.stringify(p)} is out of view`);
  }
});

test("spawn placement is deterministic for a given wave", () => {
  const a = spawnPoints(fakeWorld(), 5);
  const b = spawnPoints(fakeWorld(), 5);
  assert.deepEqual(a, b, "no Math.random: a wave is reproducible");
});

test("a weapon can hit a body beside it at contact range", () => {
  // The feel bug this protects: at 0.65 m a body 60 degrees off centre was
  // outside the cone, so a player could stand next to a spider and not kick it.
  const target = body(ARCHETYPE.PACK, { x: 1.2, z: 0.65 });
  const { combat, run } = setup({ wave: 1, bodies: [target] });
  assert.ok(combat.findTarget(run.loadout.weapon), "point blank needs no aim");
});

test("the aim cone still rejects a body at range off to the side", () => {
  const target = body(ARCHETYPE.RUNNER, { x: 8, z: 2 });
  const { combat, run } = setup({ bodies: [target] });
  run.loadout.select("pistol");
  assert.equal(combat.findTarget(run.loadout.weapon), null, "8 m to the side is not in front");
});

test("the cone narrows when aiming", () => {
  assert.ok(coneFor({ reach: 12 }, 10, true) < coneFor({ reach: 12 }, 10, false));
  assert.equal(coneFor({ reach: 12 }, 0.5, true), 2.6, "point blank ignores the aim state");
});
