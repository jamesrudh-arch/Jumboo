import { test } from "node:test";
import assert from "node:assert/strict";
import { World, PHASE, STANCE, TUNING } from "../src/world.js";
import { LEVEL, buildLevel } from "../src/level.js";
import { supportHeightAt, resolveCircle, hasLineOfSight } from "../src/collision.js";
import { dampAngle, wrapAngle, formatTime, mulberry32 } from "../src/geom.js";

function makeWorld() {
  const built = buildLevel();
  const w = new World(LEVEL, built);
  w.geometry = built;
  return w;
}

function step(world, seconds, input = {}, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) world.update(dt);
}

// Aim the camera so that "forward" points along (dx, dz).
// Camera basis: forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw).
function aim(world, dx, dz) {
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  world.cameraYaw = wrapAngle(Math.atan2(fx, fz));
  return { x: dx / len, z: dz / len, rx: fz, rz: -fx };
}

function moveToward(world, x, z, maxSeconds = 40, opts = {}) {
  world.start();
  const dt = 1 / 60;
  let t = 0;
  while (t < maxSeconds) {
    const p = world.player;
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) break;
    // Aim the camera at the target, then push forward.
    world.cameraYaw = wrapAngle(Math.atan2(dx, dz));
    const patch = { moveX: 0, moveZ: 1, crouch: opts.crouch || false, run: opts.run || false };
    if (opts.noAgents) world.agents.forEach((a) => (a.awareness = 0));
    world.setInput(patch);
    world.update(dt);
    t += dt;
    if (world.phase === PHASE.CAUGHT) break;
  }
  world.setInput({ moveX: 0, moveZ: 0, run: false, crouch: false });
  return world;
}

test("level collision geometry is sane", () => {
  const built = buildLevel();
  assert.ok(built.boxes.length > 20, "expected authored collision boxes");
  for (const b of built.boxes) {
    assert.ok(b.x1 <= b.x2 && b.z1 <= b.z2, "boxes normalised");
    assert.ok(b.y1 > b.y0, "boxes have height");
  }
  // Spawn must be clear so the player never starts inside geometry.
  const spawn = LEVEL.spawn;
  const headY = LEVEL.player.height;
  for (const b of built.boxes) {
    if (b.tag === "floor") continue;
    if (b.y1 <= 0.05 || b.y0 >= headY) continue;
    const inside =
      spawn.x > b.x1 - LEVEL.player.radius &&
      spawn.x < b.x2 + LEVEL.player.radius &&
      spawn.z > b.z1 - LEVEL.player.radius &&
      spawn.z < b.z2 + LEVEL.player.radius;
    assert.ok(!inside, `spawn overlaps ${b.tag} at ${b.x1},${b.z1}`);
  }
});

test("witness and goal are outside collision", () => {
  const built = buildLevel();
  for (const point of [LEVEL.witness, LEVEL.goal]) {
    const inside = built.boxes.some(
      (b) =>
        b.tag !== "floor" &&
        b.y1 > 0.3 &&
        point.x > b.x1 - 0.34 &&
        point.x < b.x2 + 0.34 &&
        point.z > b.z1 - 0.34 &&
        point.z < b.z2 + 0.34,
    );
    assert.ok(!inside, `point ${point.label} is inside geometry`);
  }
});

test("every patrol waypoint is reachable (not inside a solid)", () => {
  const built = buildLevel();
  for (const patrol of LEVEL.patrols) {
    for (const pt of patrol.points) {
      for (const b of built.boxes) {
        if (b.tag === "floor" || b.y1 <= 0.3) continue;
        const inside =
          pt.x > b.x1 - 0.34 && pt.x < b.x2 + 0.34 && pt.z > b.z1 - 0.34 && pt.z < b.z2 + 0.34;
        assert.ok(!inside, `${patrol.id} waypoint ${pt.x},${pt.z} inside ${b.tag}`);
      }
    }
  }
});

test("player cannot walk through a wall", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  world.player.x = 0.5;
  world.player.z = -4.0;
  const dt = 1 / 60;
  world.cameraYaw = 0; // camera faces +Z, so "right" is world -X (the shopfront)
  world.setInput({ moveX: 1, moveZ: 0 });
  for (let i = 0; i < 60 * 12; i++) world.update(dt);
  assert.ok(world.player.x > -7.0 - LEVEL.player.radius - 0.001, `x=${world.player.x} passed the facade`);
  assert.ok(world.player.x < -6.2, `player did not reach the facade, x=${world.player.x}`);
  assert.ok(Math.abs(world.player.z + 4.0) < 0.6, `player should not be pushed down the lane, z=${world.player.z}`);
});

test("player slides along a wall instead of stopping dead", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  const startZ = world.player.z;
  const dt = 1 / 60;
  // Push diagonally into the left facade: forward-left.
  world.player.x = 0.5;
  world.player.z = -4.0;
  for (let i = 0; i < 60 * 4; i++) {
    aim(world, -1, -1);
    world.setInput({ moveX: 0, moveZ: 1 });
    world.update(dt);
  }
  assert.ok(world.player.z < startZ - 3.0, `expected to slide down the lane, z=${world.player.z}`);
});

test("movement speeds are playable over the length of the lane", () => {
  // The lane is ~50 m; a walking clear run must not become a 55-second trudge.
  const laneLength = Math.abs(LEVEL.spawn.z - LEVEL.goal.z);
  const walkTime = laneLength / LEVEL.walkSpeed;
  assert.ok(walkTime < 45, `walking the lane takes ${walkTime.toFixed(1)}s`);
  assert.ok(LEVEL.runSpeed > LEVEL.walkSpeed * 2.0, "run should feel like a decision");
  assert.ok(LEVEL.crouchSpeed < LEVEL.walkSpeed * 0.7, "crouch must be a real cost");
  // Clip time-scaling stays within a believable range.
  assert.ok(LEVEL.walkSpeed / LEVEL.clip.walk < 1.7, "walk clip is not sped up absurdly");
  assert.ok(LEVEL.runSpeed / LEVEL.clip.run < 2.2, "run clip is not sped up absurdly");
});

test("crouching is slower and quieter than walking, running is loudest", () => {
  const mk = () => {
    const w = makeWorld();
    w.agents.length = 0;
    w.start();
    return w;
  };
  const walk = mk();
  walk.setInput({ moveZ: 1 });
  step(walk, 1.2);
  const crouch = mk();
  crouch.setInput({ moveZ: 1, crouch: true });
  step(crouch, 1.2);
  const run = mk();
  run.setInput({ moveZ: 1, run: true });
  step(run, 1.2);
  assert.ok(crouch.player.crouch > 0.9, "crouch blends in");
  assert.ok(crouch.player.speed < walk.player.speed, "crouch is slower");
  assert.ok(run.player.speed > walk.player.speed * 1.8, "run is faster");
  assert.ok(crouch.player.noise < walk.player.noise, "crouch is quieter");
  assert.ok(run.player.noise > walk.player.noise, "run is louder");
});

test("running drains stamina and forces a walk until it recovers", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  world.setInput({ moveZ: 1, run: true });
  step(world, 6.5);
  assert.ok(world.player.exhausted, "should be exhausted after a long sprint");
  assert.ok(world.player.speed <= LEVEL.walkSpeed + 0.05, "exhausted player is capped to walk speed");
  world.setInput({ moveZ: 0, run: false });
  step(world, 3.0);
  assert.ok(!world.player.exhausted, "stamina recovers");
});

test("noise wakes a nearby patrol into investigating", () => {
  const world = makeWorld();
  world.start();
  const a = world.agents[0];
  a.pause = 0;
  world.player.x = a.x + 2.0;
  world.player.z = a.z;
  world.setInput({ moveZ: 1, run: true });
  step(world, 0.6);
  assert.equal(a.state, "investigate", `agent state was ${a.state}`);
  assert.ok(
    world.drainEvents().some((e) => e.type === "heard"),
    "a heard event should be emitted",
  );
});

test("walking quietly past cover does not instantly raise an alarm", () => {
  const world = makeWorld();
  world.start();
  // Stand behind the barrier and let the collectors patrol for two seconds.
  world.player.x = LEVEL.witness.x;
  world.player.z = LEVEL.witness.z - 1.0;
  step(world, 2.0);
  assert.notEqual(world.phase, PHASE.CAUGHT, "should not be caught while stationary");
});

test("a collector that sees the player builds awareness, then hunts", () => {
  const world = makeWorld();
  world.start();
  const a = world.agents[0];
  a.state = "patrol";
  a.pause = 0;
  a.x = 2.5;
  a.z = -16.0;
  a.yaw = 0; // yaw 0 faces +Z, toward the player
  a.baseYaw = 0;
  world.player.x = 2.5;
  world.player.z = -13.0; // 3 m in front, in the open
  world.player.feetY = 0;
  let sawHunt = false;
  for (let i = 0; i < 60 * 5; i++) {
    world.setInput({ moveZ: 0 });
    world.player.x = a.x;
    world.player.z = a.z + 3.0;
    assert.equal(world.canSee(a).visible, true, "player should be visible before detection");
    world.update(1 / 60);
    if (world.phase === PHASE.HUNT) {
      sawHunt = true;
      break;
    }
  }
  assert.ok(sawHunt, `agent awareness ${a.awareness.toFixed(3)} never reached a hunt`);
  assert.equal(world.spottedCount, 1);
});

test("crouching and standing still slows detection down", () => {
  const run = (crouch) => {
    const world = makeWorld();
    world.start();
    const a = world.agents[0];
    a.state = "patrol";
    a.pause = 0;
    a.x = 2.5;
    a.z = -16.0;
    a.yaw = 0;
    a.baseYaw = 0;
    const frames = [];
    for (let i = 0; i < 60 * 6; i++) {
      world.player.x = 2.5;
      world.player.z = -13.0;
      world.setInput({ moveZ: 0, crouch });
      world.update(1 / 60);
      frames.push(a.awareness);
      if (world.phase === PHASE.HUNT) break;
    }
    return frames.length;
  };
  const standing = run(false);
  const crouched = run(true);
  assert.ok(crouched > standing, `crouch ${crouched} frames vs standing ${standing}`);
});

test("cover blocks sight exactly when the head is below it", () => {
  const built = buildLevel();
  const HEAD = 1.7;
  const CROUCH_HEAD = 1.05;
  const coverOf = (minH, maxH) =>
    built.boxes.find((b) => b.tag === "cover" && b.y1 >= minH && b.y1 < maxH);
  const cross = (b, hA, hB) => {
    const z = (b.z1 + b.z2) / 2;
    return hasLineOfSight(-9, hA, z, 9, hB, z, [b]);
  };

  // Low pallets (0.55 m) hide nobody at head height: they are immersion props.
  const pallets = coverOf(0.5, 0.6);
  assert.ok(pallets, "pallet stack exists");
  assert.equal(cross(pallets, 1.62, HEAD), true, "pallets do not hide a standing head");
  assert.equal(cross(pallets, 1.62, CROUCH_HEAD), true, "pallets do not hide a crouched head either");

  // Dumpsters (1.28 m): hide the crouched head, not the standing one.
  const dumpster = coverOf(1.2, 1.4);
  assert.ok(dumpster, "dumpster cover exists");
  assert.equal(cross(dumpster, 1.62, HEAD), true, "standing head is visible over a dumpster");
  assert.equal(cross(dumpster, 1.62, CROUCH_HEAD), false, "crouched head is hidden by a dumpster");

  // Crate towers (>= 2 m) break sight entirely.
  const tower = coverOf(2.0, 3.2);
  assert.ok(tower, "crate tower exists");
  assert.equal(cross(tower, 1.62, HEAD), false, "crate towers block sight");

  // The parked van is full-height cover.
  const van = built.boxes.find((b) => b.tag === "cover" && b.y1 > 2.2);
  assert.ok(van, "van cover exists");
  assert.equal(cross(van, 1.62, HEAD), false, "van blocks sight");
});

test("hunt ends when the hunter loses the player", () => {
  const world = makeWorld();
  world.start();
  const a = world.agents[0];
  world.startHunt(a);
  assert.equal(world.phase, PHASE.HUNT);
  // Teleport the player far away and out of sight.
  world.player.x = LEVEL.spawn.x;
  world.player.z = LEVEL.spawn.z;
  a.x = -3.0;
  a.z = -40.0;
  a.seeing = false;
  step(world, 6.0);
  assert.notEqual(world.phase, PHASE.HUNT, "hunt should end");
  assert.equal(a.state, "returning");
});

test("reaching Sade and interacting, then the lane, wins", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  world.player.x = LEVEL.witness.x;
  world.player.z = LEVEL.witness.z + 0.6;
  world.setInput({ interact: true });
  step(world, 2.0);
  assert.ok(world.talkedToWitness, "talking completes");
  assert.equal(world.objective, "reach_lane");
  world.setInput({ interact: false });
  world.player.x = LEVEL.goal.x;
  world.player.z = LEVEL.goal.z;
  step(world, 0.2);
  assert.equal(world.phase, PHASE.WON);
  assert.ok(world.score > 0);
  assert.match(world.rank, /^[SABCD]$/);
});

test("interaction is interrupted when the player leaves the zone", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  world.player.x = LEVEL.witness.x;
  world.player.z = LEVEL.witness.z;
  world.setInput({ interact: true });
  step(world, 2.0);
  world.setInput({ interact: false });
  step(world, 0.5);
  assert.equal(world.interactProgress, 0, "progress resets after release");
});

test("getting caught resets the attempt and scores it", () => {
  const world = makeWorld();
  world.start();
  const a = world.agents[0];
  world.startHunt(a);
  world.player.x = a.x;
  world.player.z = a.z;
  step(world, 0.2);
  assert.equal(world.phase, PHASE.CAUGHT);
  assert.ok(world.score >= 50);
  world.player.x = LEVEL.spawn.x;
  world.player.z = LEVEL.spawn.z;
  world.player.feetY = 0;
});

test("camera never ends up inside a wall", () => {
  const world = makeWorld();
  world.agents.length = 0;
  world.start();
  // Stand against the shopfront and look into it: the boom must shorten.
  world.player.x = -6.4;
  world.player.z = -6.0;
  world.cameraYaw = wrapAngle(Math.PI * 0.5);
  step(world, 1.0);
  assert.ok(world.camera.distance < world.cameraDistance, "camera pulled in");
  assert.ok(world.camera.distance > 0.3, "camera stays usable");
});

test("checkpoint respawn restores position without duplicating time", () => {
  const world = makeWorld();
  world.start();
  step(world, 0.5);
  const t = world.time;
  world.lastCheckpoint = LEVEL.checkpoints[2];
  world.respawn();
  assert.equal(world.player.x, LEVEL.checkpoints[2].x);
  assert.ok(world.time >= t);
});

test("the world is open: a clear run can reach the lane", () => {
  const world = makeWorld();
  world.agents.length = 0;
  moveToward(world, LEVEL.witness.x, LEVEL.witness.z, 60, { noAgents: true });
  const dWitness = Math.hypot(world.player.x - LEVEL.witness.x, world.player.z - LEVEL.witness.z);
  assert.ok(dWitness < 1.2, `never reached Sade, ended ${dWitness.toFixed(2)} m away at z=${world.player.z.toFixed(2)}`);
  moveToward(world, LEVEL.goal.x, LEVEL.goal.z, 60, { noAgents: true });
  const dGoal = Math.hypot(world.player.x - LEVEL.goal.x, world.player.z - LEVEL.goal.z);
  assert.ok(dGoal < 1.2, `never reached the lane, ended ${dGoal.toFixed(2)} m away`);
});

test("dock lip is climbable and gives a vantage point", () => {
  const built = buildLevel();
  const lip = built.platforms.find((p) => p.y1 > 0.9);
  assert.ok(lip, "dock platform exists");
  const h = supportHeightAt(11.5, -39.5, built.platforms, 1.0, LEVEL.stepUp);
  assert.ok(Math.abs(h - lip.y1) < 0.01, "platform supports the player");
  const ground = supportHeightAt(0, 0, built.platforms, 0, LEVEL.stepUp);
  assert.equal(ground, 0);
});

test("collision resolution cannot push the player out of bounds far away", () => {
  const built = buildLevel();
  const pos = { x: 6.95, z: -20.0 };
  resolveCircle(pos, 0.32, built.boxes, 0, 1.8);
  assert.ok(pos.x <= 7.0, "pushed out of the wall to the walkable side");
  assert.ok(Math.abs(pos.z + 20) < 1.0, "did not slide absurdly along z");
});

test("HUD data is complete and finite during play", () => {
  const world = makeWorld();
  world.start();
  world.setInput({ moveZ: 1, run: true });
  step(world, 1.0);
  const hud = world.hud();
  for (const key of [
    "suspicion",
    "stamina",
    "distance",
    "bearing",
    "noise",
    "interactProgress",
    "time",
  ]) {
    assert.ok(Number.isFinite(hud[key]), `${key} is finite`);
  }
  assert.ok(hud.suspicion >= 0 && hud.suspicion <= 1);
  assert.ok(hud.distance > 0);
});

test("deterministic helpers behave", () => {
  const r = mulberry32(42);
  const a = [r(), r(), r()];
  const r2 = mulberry32(42);
  assert.deepEqual(a, [r2(), r2(), r2()]);
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65.2), "1:06");
  assert.ok(Math.abs(wrapAngle(Math.PI * 2 + 0.1) - 0.1) < 1e-9);
  assert.ok(Math.abs(dampAngle(0, Math.PI / 2, 100, 1) - Math.PI / 2) < 0.01);
  assert.equal(JSON.stringify(LEVEL.patrols.length), "3");
  assert.equal(STANCE.CROUCH, "crouch");
});

test("patrols stay inside the lane over a long unattended run", () => {
  const world = makeWorld();
  world.start();
  world.player.x = LEVEL.spawn.x;
  world.player.z = LEVEL.spawn.z;
  for (let i = 0; i < 60 * 45; i++) {
    world.setInput({ moveZ: 0 });
    world.update(1 / 60);
  }
  for (const a of world.agents) {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z), "agent position finite");
    assert.ok(a.x > -13 && a.x < 13, `${a.id} x=${a.x}`);
    assert.ok(a.z > -52 && a.z < 12, `${a.id} z=${a.z}`);
  }
});

// --------------------------------------------------------------- fairness
// The street has to be survivable: a collector who has stopped to watch must
// not be able to hear a crouched player, and a player who runs must be able to
// break a chase. Both of these were impossible before the tuning pass — every
// footstep beat the hearing radius and pursuit outran the sprint forever.
test("a crouched player is silent to a watching collector, a sprinter is not", () => {
  for (const [label, input, expectHeard] of [
    ["crouch", { moveZ: 1, crouch: true }, false],
    ["sprint", { moveZ: 1, run: true }, true],
  ]) {
    const world = makeWorld();
    world.start();
    world.agents.length = 1;
    const a = world.agents[0];
    a.state = "patrol";
    a.awareness = 0;
    a.x = 0;
    a.z = -20;
    let heard = false;
    for (let i = 0; i < 240; i++) {
      // Pin the collector: this test is about hearing, not pathing.
      a.x = 0;
      a.z = -20;
      world.player.x = 0;
      world.player.z = -14;
      world.player.feetY = 0;
      world.cameraYaw = Math.PI;
      world.setInput(input);
      world.update(1 / 60);
      for (const e of world.drainEvents()) if (e.type === "heard") heard = true;
    }
    assert.equal(heard, expectHeard, `${label} ${expectHeard ? "should" : "should not"} be heard`);
  }
});

test("a sprinting player opens a gap on a hunting collector", () => {
  const world = makeWorld();
  world.start();
  world.agents.length = 1;
  const a = world.agents[0];
  a.state = "hunt";
  a.x = 0;
  a.z = 8;
  a.yaw = Math.PI;
  a.lostTimer = 0;
  a.lastSeen = { x: 0, z: 8 };
  world.phase = PHASE.HUNT;
  world.player.x = 0;
  world.player.z = 0;
  world.player.feetY = 0;
  world.cameraYaw = Math.PI;
  let caught = false;
  let maxGap = 0;
  // Four seconds is the sprint window before stamina forces a walk.
  for (let i = 0; i < 60 * 4; i++) {
    world.setInput({ moveX: 0, moveZ: 1, run: true });
    world.update(1 / 60);
    maxGap = Math.max(maxGap, Math.hypot(a.x - world.player.x, a.z - world.player.z));
    for (const e of world.drainEvents()) if (e.type === "caught") caught = true;
  }
  assert.equal(caught, false, "a sprinting player was run down in four seconds");
  assert.ok(maxGap > 7, `the gap never opened (max ${maxGap.toFixed(1)} m)`);
});

test("a hunt gives up once the player is out of sight for long enough", () => {
  const world = makeWorld();
  world.start();
  world.agents.length = 1;
  const a = world.agents[0];
  world.startHunt(a);
  // Out of sight and far away: nowhere near the catch radius, no line of sight.
  a.x = 3;
  a.z = -4;
  world.player.x = 0;
  world.player.z = -40;
  world.player.feetY = 0;
  world.setInput({ moveX: 0, moveZ: 0 });
  let ended = false;
  const limit = (TUNING.huntLoseTime + TUNING.huntGiveUpTime) * 60 + 120;
  for (let i = 0; i < limit; i++) {
    world.update(1 / 60);
    if (world.phase !== PHASE.HUNT) {
      ended = true;
      break;
    }
  }
  assert.ok(ended, "the hunt never gave up");
  assert.notEqual(a.state, "hunt");
});

test("kerbs are steps, not walls", () => {
  // The lane mouth is bounded by 22 cm kerbs. The collision solver counts any
  // box above the step allowance as a wall, so a kerb used to be impassable:
  // the player could not leave the lane through its own mouth.
  const kerb = { x1: -27, z1: -9.2, x2: -7, z2: -8.4, y0: 0, y1: 0.22, tag: "kerb" };
  const pos = { x: -14, z: -8.1 };
  resolveCircle(pos, 0.32, [kerb], 0, 1.8, 3, LEVEL.stepUp);
  assert.ok(Math.abs(pos.z - -8.1) < 1e-6, `a kerb pushed the player ${Math.abs(pos.z - -8.1).toFixed(2)} m`);
  // A crate of the same footprint but taller than a step still blocks.
  const crate = { ...kerb, y1: 0.9 };
  // Start just inside the footprint so the push out is unambiguous.
  const blocked = { x: -14, z: -8.6 };
  resolveCircle(blocked, 0.32, [crate], 0, 1.8, 3, LEVEL.stepUp);
  assert.ok(Math.abs(blocked.z - -8.6) > 0.1, "a crate taller than a step should still block");
});
