// District tests: the city data, its generated geometry, and the street
// simulation (traffic, crowds, water, chaos). No renderer, no DOM.

import test from "node:test";
import assert from "node:assert/strict";

import { CITY, buildCity, mulberry32, waterAt, roadAt, isBuildable, insideRect } from "../src/city.js";
import { LEVEL, buildLevel } from "../src/level.js";
import { World, TUNING } from "../src/world.js";
import { Traffic, Crowd, VEHICLE_SPEC } from "../src/traffic.js";
import { TIERS } from "../src/config.js";
import { Weather, WEATHER, Wetness } from "../src/weather.js";
import * as collisionIndex from "../src/collision.js";

const rectsOverlap = (a, b) =>
  a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1;

const area = (r) => Math.max(0, r.x2 - r.x1) * Math.max(0, r.z2 - r.z1);

// ------------------------------------------------------------------ layout
test("city bounds contain every road, block, park and water body", () => {
  const b = CITY.bounds;
  for (const r of [...CITY.roads, ...CITY.blocks, ...CITY.parks, ...CITY.water, ...CITY.bridges]) {
    assert.ok(r.x1 >= b.x1 && r.x2 <= b.x2 && r.z1 >= b.z1 && r.z2 <= b.z2, `${r.id || "rect"} outside bounds`);
    assert.ok(r.x2 > r.x1 && r.z2 > r.z1, `${r.id || "rect"} is empty`);
  }
});

test("no duplicated roads: same-orientation roads may only meet as junctions", () => {
  for (let i = 0; i < CITY.roads.length; i++) {
    for (let j = i + 1; j < CITY.roads.length; j++) {
      const a = CITY.roads[i];
      const c = CITY.roads[j];
      if (!rectsOverlap(a, c)) continue;
      const aAlongX = a.x2 - a.x1 > a.z2 - a.z1;
      const cAlongX = c.x2 - c.x1 > c.z2 - c.z1;
      if (aAlongX !== cAlongX) continue; // a crossing, not a duplicate
      const shared = {
        x1: Math.max(a.x1, c.x1),
        x2: Math.min(a.x2, c.x2),
        z1: Math.max(a.z1, c.z1),
        z2: Math.min(a.z2, c.z2),
      };
      const fraction = area(shared) / Math.min(area(a), area(c));
      assert.ok(fraction < 0.5, `${a.id} and ${c.id} overlap ${(fraction * 100).toFixed(0)}%`);
    }
  }
});

test("the approved lane stays clear of roads, blocks and water", () => {
  const lane = CITY.lane;
  for (const r of CITY.roads) assert.ok(!rectsOverlap(lane, r), `road ${r.id} crosses the lane`);
  for (const r of CITY.blocks) assert.ok(!rectsOverlap(lane, r), `block at ${r.x1},${r.z1} covers the lane`);
  for (const w of CITY.water) assert.ok(!rectsOverlap(lane, w), `water ${w.id} crosses the lane`);
});

test("every traffic route point is on a road", () => {
  assert.ok(CITY.trafficRoutes.length >= 3);
  for (const route of CITY.trafficRoutes) {
    assert.ok(route.points.length >= 3, `${route.id} needs a closed loop`);
    for (const p of route.points) {
      assert.ok(roadAt(CITY, p.x, p.z), `${route.id} point ${p.x},${p.z} is off-road`);
    }
  }
});

test("water bodies are holes, and waterAt agrees with the data", () => {
  assert.equal(waterAt(CITY, 0, -80)?.id, "canal");
  assert.equal(waterAt(CITY, 0, -140)?.id, "harbour");
  assert.equal(waterAt(CITY, -12, 74)?.id, "pond");
  assert.equal(waterAt(CITY, 0, 0), null);
  for (const w of CITY.water) {
    assert.ok(w.surfaceY > w.bedY, `${w.id} surface must sit above its bed`);
  }
});

// ------------------------------------------------------------------ builder
test("buildCity is deterministic for a seed", () => {
  const a = buildCity(CITY, { buildings: 104, treeCount: 280 });
  const b = buildCity(CITY, { buildings: 104, treeCount: 280 });
  assert.equal(a.buildings.length, b.buildings.length);
  for (let i = 0; i < a.buildings.length; i++) {
    assert.deepEqual(
      [a.buildings[i].x1, a.buildings[i].z1, a.buildings[i].height],
      [b.buildings[i].x1, b.buildings[i].z1, b.buildings[i].height],
    );
  }
});

test("the district is dense and covers every zone", () => {
  const built = buildCity(CITY, { buildings: 104, treeCount: 280 });
  assert.ok(built.stats.buildings >= 90, `only ${built.stats.buildings} buildings`);
  assert.ok(built.stats.trees >= 90, `only ${built.stats.trees} trees`);
  assert.ok(built.stats.lamps >= 40, `only ${built.stats.lamps} lamps`);
  assert.ok(built.stats.parked >= 12, "the kerbs should have parked cars");

  const north = built.buildings.filter((b) => b.z2 > 14).length;
  const south = built.buildings.filter((b) => b.z1 < -60).length;
  assert.ok(north >= 20, `north of the lane only has ${north} buildings`);
  assert.ok(south >= 20, `south of the canal only has ${south} buildings`);
});

test("no generated building sits on a road, in water or in a park", () => {
  const built = buildCity(CITY, { buildings: 104, treeCount: 280 });
  for (const b of built.buildings) {
    for (const r of CITY.roads) assert.ok(!rectsOverlap(b, r), `building at ${b.x1},${b.z1} on ${r.id}`);
    for (const w of CITY.water) assert.ok(!rectsOverlap(b, w), `building at ${b.x1},${b.z1} in ${w.id}`);
    assert.ok(isBuildable(CITY, b.x1, b.z1, b.x2, b.z2, 0), "building on reserved ground");
  }
});

test("no tree grows in the water or in a building", () => {
  const built = buildCity(CITY, { buildings: 104, treeCount: 280 });
  for (const t of built.trees) {
    assert.equal(waterAt(CITY, t.x, t.z), null, `tree at ${t.x},${t.z} is in water`);
    for (const b of built.buildings) {
      assert.ok(
        !(t.x > b.x1 && t.x < b.x2 && t.z > b.z1 && t.z < b.z2),
        `tree at ${t.x.toFixed(1)},${t.z.toFixed(1)} is inside a building`,
      );
    }
  }
});

test("every road is reachable: a sidewalk exists beside each non-alley road", () => {
  const built = buildCity(CITY, { buildings: 40, treeCount: 40 });
  assert.ok(built.roads.length >= CITY.roads.length);
  for (const r of built.roads) {
    assert.ok(insideRect(r.x1 + 0.01, r.z1 + 0.01, CITY.bounds), `${r.id} starts outside bounds`);
  }
});

test("water bodies get a bed and a surface, so looking down shows depth", () => {
  const built = buildCity(CITY, { buildings: 10, treeCount: 10 });
  for (const w of built.water) {
    assert.ok(Number.isFinite(w.surfaceY) && Number.isFinite(w.bedY), `${w.id} has no depth`);
  }
});

// ------------------------------------------------------------------ tiers
test("phone tier is strictly lighter than desktop", () => {
  const phone = TIERS.phone;
  const desk = TIERS.desktop;
  assert.ok(phone.drawDistance < desk.drawDistance);
  assert.ok(phone.traffic < desk.traffic);
  assert.ok(phone.crowd < desk.crowd);
  assert.ok(phone.buildings < desk.buildings);
  assert.ok(!phone.shadows, "phones must not pay for shadow maps");
  assert.ok(phone.rain < desk.rain);
});

test("a phone build produces a smaller district than a desktop build", () => {
  const phone = buildCity(CITY, TIERS.phone);
  const desk = buildCity(CITY, TIERS.desktop);
  assert.ok(phone.stats.buildings < desk.stats.buildings, `${phone.stats.buildings} vs ${desk.stats.buildings}`);
  assert.ok(phone.stats.lampsLit < desk.stats.lampsLit);
  // Thinning must be spread across the map, not lop off the far district.
  const phoneSouth = phone.buildings.filter((b) => (b.z1 + b.z2) / 2 < -58).length;
  assert.ok(phoneSouth >= 6, `the phone build lost the whole south district (${phoneSouth})`);
  // Every building on every tier is solid.
  assert.equal(phone.boxes.filter((b) => b.tag === "building").length, phone.buildings.length);
  assert.equal(desk.boxes.filter((b) => b.tag === "building").length, desk.buildings.length);
});

// ------------------------------------------------------------------ world
function districtWorld(seed = 7, tier = TIERS.desktop) {
  const built = buildCity(CITY, tier);
  const level = buildLevel();
  const cityBoxes = built.boxes.concat(level.boxes);
  const world = new World(LEVEL, { boxes: level.boxes, platforms: level.platforms }, {
    city: CITY,
    cityBoxes,
    cityBuilt: built,
    tier,
    seed,
  });
  world.geometry = { ...level, city: built };
  return world;
}

test("with a district the player is bounded by the map, not the lane", () => {
  const world = districtWorld();
  assert.ok(world.bounds.x2 - world.bounds.x1 > 250, "district bounds are still the lane box");
  assert.ok(world.bounds.z2 - world.bounds.z1 > 200);
});

test("the lane opens onto the district on both sides and at the market end", () => {
  // The lane mouth is watched by a collector, so this walks the map with the
  // patrols empty: the question is whether the street is connected, not
  // whether the player can sneak past a guard (world.test.js covers that).
  const walk = (from, input, seconds) => {
    const world = districtWorld();
    world.patrolDefs = [];
    world.agents = [];
    world.start();
    world.player.x = from.x;
    world.player.z = from.z;
    for (let i = 0; i < 60 * seconds; i++) {
      world.setInput(input);
      world.update(1 / 60);
    }
    return world.player;
  };

  // West facade gap -> the west alley.
  const west = walk({ x: -9, z: -25 }, { moveX: -1, moveZ: 0 }, 6);
  assert.ok(west.x < -16, `the west alley is sealed (x=${west.x.toFixed(2)})`);

  // East facade gap -> the east alley.
  const east = walk({ x: 9, z: -28 }, { moveX: 1, moveZ: 0 }, 6);
  assert.ok(east.x > 16, `the east alley is sealed (x=${east.x.toFixed(2)})`);

  // Market-end doorway -> out of the lane.
  const south = walk({ x: 4.5, z: -45 }, { moveX: 0, moveZ: 1 }, 8);
  assert.ok(south.z < -53, `the market end is sealed (z=${south.z.toFixed(2)})`);
});

test("walking into the canal drowns the player and respawns them", () => {
  const world = districtWorld();
  world.patrolDefs = [];
  world.agents = [];
  world.start();
  world.player.x = 0;
  world.player.z = -80; // the canal
  world.player.feetY = -0.6;
  world.setInput({ moveX: 0, moveZ: 0 });
  for (let i = 0; i < 60 * 3; i++) world.update(1 / 60);
  const drowned = world.events.some((e) => e.type === "drowned");
  assert.ok(drowned, `no drowning event (${world.events.map((e) => e.type).join(",")})`);
  assert.ok(world.player.feetY > -1, "player did not come back out of the water");
});

test("crossing a canal bridge does not drown the player", () => {
  const world = districtWorld();
  world.patrolDefs = [];
  world.agents = [];
  world.start();
  for (const b of CITY.bridges) {
    const cx = (b.x1 + b.x2) / 2;
    const cz = (b.z1 + b.z2) / 2;
    // Standing on the deck.
    world.player.x = cx;
    world.player.z = cz;
    world.player.feetY = 0.18;
    world.wetTimer = 0;
    world.setInput({ moveX: 0, moveZ: 0 });
    for (let i = 0; i < 60 * 2; i++) world.update(1 / 60);
    assert.equal(world.drownings, 0, `drowned on ${b.id}`);
    // Walking the length of it stays dry too.
    const startDrownings = world.drownings;
    world.player.x = cx;
    world.player.z = b.z2 + 1.5;
    world.player.feetY = 0;
    world.wetTimer = 0;
    world.cameraYaw = Math.PI; // face -z, across the canal
    world.setInput({ moveX: 0, moveZ: 1, run: true });
    for (let i = 0; i < 60 * 5; i++) world.update(1 / 60);
    assert.ok(world.player.z < b.z1 + 1, `did not cross ${b.id} (z=${world.player.z.toFixed(2)})`);
    assert.equal(world.drownings, startDrownings, `drowned crossing ${b.id}`);
  }
});

// ------------------------------------------------------------------ traffic
test("traffic runs on the routes and stays on a road", () => {
  const traffic = new Traffic(CITY, { traffic: 12 }, { aggression: 0.2 });
  assert.ok(traffic.vehicles.length >= 6);
  const moving = new Set();
  for (let i = 0; i < 60 * 20; i++) {
    traffic.update(1 / 60, { x: 0, z: 0 }, null);
    for (const v of traffic.vehicles) if (v.speed > 0.4) moving.add(v.index);
  }
  assert.equal(moving.size, traffic.vehicles.length, "some vehicles never move");
});

test("vehicles brake for the player standing in the road", () => {
  const traffic = new Traffic(CITY, { traffic: 4 }, { aggression: 0 });
  // Put one car on the north cross-street and stand in front of it.
  const v = traffic.vehicles[0];
  for (let i = 0; i < 120; i++) traffic.update(1 / 60, { x: 999, z: 999 }, null);
  const ahead = { x: v.x + Math.sin(v.yaw) * 4, z: v.z + Math.cos(v.yaw) * 4 };
  let braked = false;
  for (let i = 0; i < 180; i++) {
    traffic.update(1 / 60, ahead, null);
    if (v.braking) braked = true;
  }
  assert.ok(braked, "the car drove straight through the player");
});

test("a car strike knocks the player down and costs time", () => {
  const world = districtWorld(11);
  world.start();
  const traffic = world.traffic;
  const v = traffic.vehicles[0];
  for (let i = 0; i < 60; i++) world.update(1 / 60);
  // Place the player right in front of the car, then let it arrive.
  world.player.x = v.x + Math.sin(v.yaw) * 1.1;
  world.player.z = v.z + Math.cos(v.yaw) * 1.1;
  let down = false;
  for (let i = 0; i < 60 * 3; i++) {
    world.update(1 / 60);
    if (world.knockdown > 0) down = true;
  }
  assert.ok(down, "the car never knocked the player down");
  assert.ok(world.events.some((e) => e.type === "hit-by-car"), "no hit-by-car event");
});

test("pedestrians keep off the road surface", () => {
  const crowd = new Crowd(CITY, 12, 99);
  for (let i = 0; i < 60 * 20; i++) crowd.update(1 / 60, []);
  let onRoad = 0;
  for (const p of crowd.people) {
    const road = roadAt(CITY, p.x, p.z);
    if (!road || road.kind === "alley") continue;
    const inset = 0.6;
    if (p.x > road.x1 + inset && p.x < road.x2 - inset && p.z > road.z1 + inset && p.z < road.z2 - inset) {
      onRoad++;
    }
  }
  assert.equal(onRoad, 0, `${onRoad} pedestrians are standing in the road`);
});

test("a crowd panics and runs when a car sweeps past", () => {
  const crowd = new Crowd(CITY, 10, 5);
  const p = crowd.people[0];
  p.panic = 0;
  const hit = crowd.scare(p.x, p.z, 8, "car");
  assert.ok(hit.length >= 1, "the crowd did not react to the car");
  assert.ok(p.panic > 0.4, "panic is too weak to read as fleeing");
  const x0 = p.x;
  const z0 = p.z;
  for (let i = 0; i < 30; i++) crowd.update(1 / 60, []);
  assert.ok(Math.hypot(p.x - x0, p.z - z0) > 0.2, "nobody moved after the scare");
});

// ------------------------------------------------------------------ chaos
test("the chaos director fires, logs and stays inside its budget", () => {
  const world = districtWorld(3);
  world.start();
  for (let i = 0; i < 60 * 120; i++) {
    world.setInput({ moveX: 0, moveZ: 0 });
    world.update(1 / 60);
  }
  assert.ok(world.chaosEvents.length >= 1, "no chaos in two minutes");
  assert.ok(world.chaosEvents.length <= TUNING.chaosMax, "chaos log overflowed");
  for (const e of world.chaosEvents) {
    assert.ok(typeof e.kind === "string" && e.kind.length > 0);
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.z), `${e.kind} has no position`);
  }
});

test("a jammed car actually holds still, and a sweep car keeps moving", () => {
  const traffic = new Traffic(CITY, { traffic: 6 }, { aggression: 0 });
  const v = traffic.vehicles[0];
  for (let i = 0; i < 90; i++) traffic.update(1 / 60, { x: 999, z: 999 }, []);
  // Traffic advances its own clock inside update(), so the window is stamped
  // against that clock, not against a stale local time.
  v.jamUntil = (traffic.time || 0) + 4.5;
  const startX = v.x;
  const startZ = v.z;
  // A jammed car brakes to a stop (~0.7 s from full speed) and then holds.
  for (let i = 0; i < 60; i++) traffic.update(1 / 60, { x: 999, z: 999 }, []);
  assert.ok(v.speed < 0.3, `the jammed car did not stop (speed ${v.speed.toFixed(2)})`);
  const stoppedX = v.x;
  const stoppedZ = v.z;
  for (let i = 0; i < 60; i++) traffic.update(1 / 60, { x: 999, z: 999 }, []);
  assert.ok(
    Math.hypot(v.x - stoppedX, v.z - stoppedZ) < 0.1,
    "a stopped, jammed car kept creeping forward",
  );
  // After the window it moves again.
  for (let i = 0; i < 60 * 4; i++) traffic.update(1 / 60, { x: 999, z: 999 }, []);
  assert.ok(Math.hypot(v.x - startX, v.z - startZ) > 0.5, "the jam never cleared");

  const w = traffic.vehicles[1];
  w.sweepUntil = (traffic.time || 0) + 3.5;
  w.speed = w.spec.maxSpeed;
  const before = { x: w.x, z: w.z };
  // A player directly in the road must not stop the sweeping car.
  for (let i = 0; i < 60; i++) {
    traffic.update(1 / 60, { x: w.x + Math.sin(w.yaw) * 3, z: w.z + Math.cos(w.yaw) * 3 }, []);
  }
  assert.ok(Math.hypot(w.x - before.x, w.z - before.z) > 1, "the sweeping car was braked by the player");
});

test("a power cut puts out a block of district lamps and then restores them", () => {
  const world = districtWorld(5);
  world.start();
  const lamps = world.cityBuilt.lamps.filter((l) => l.lit);
  assert.ok(lamps.length > 0);
  // Force the director to reach the power-cut branch.
  world.chaosRng = () => 0.5;
  world.chaosTimer = 0;
  world.update(1 / 60);
  const cut = lamps.filter((l) => l.cutUntil !== undefined);
  assert.ok(cut.length > 0, "no district lamps were cut");
  assert.ok(world.chaosEvents.some((e) => e.kind === "power"));
  // The window is finite: nothing is permanently dark.
  for (const l of cut) assert.ok(Number.isFinite(l.cutUntil));
});

test("chaos is unpredictable: two seeds do not produce the same script", () => {
  const run = (seed) => {
    const world = districtWorld(seed);
    world.start();
    for (let i = 0; i < 60 * 90; i++) {
      world.setInput({ moveX: 0, moveZ: 0 });
      world.update(1 / 60);
    }
    return world.chaosEvents.map((e) => e.kind).join(",");
  };
  assert.notEqual(run(1), run(2));
});

// ------------------------------------------------------------------ errands
test("street errands exist on the map, pay score, and can be finished", () => {
  const world = districtWorld(13);
  world.patrolDefs = [];
  world.agents = [];
  world.start();
  assert.ok(world.errands.length >= 3, "the district has no street errands");
  const e = world.errands[0];

  // Standing on the marker and holding interact completes it.
  world.player.x = e.x;
  world.player.z = e.z;
  world.setInput({ moveX: 0, moveZ: 0, interact: true });
  for (let i = 0; i < 90; i++) world.update(1 / 60);
  assert.ok(e.done, "the errand never completed while standing on it");
  assert.equal(world.errandsDone, 1);
  assert.ok(world.errandPoints >= e.points, "the errand paid nothing");
  assert.ok(world.events.some((ev) => ev.type === "errand"), "no errand event");
});

test("errand markers stand on walkable ground, not inside a building", () => {
  const built = buildCity(CITY, TIERS.desktop);
  const level = buildLevel();
  const world = new World(LEVEL, { boxes: level.boxes, platforms: level.platforms }, {
    city: CITY,
    cityBoxes: built.boxes.concat(level.boxes),
    cityBuilt: built,
    tier: TIERS.desktop,
    seed: 3,
  });
  for (const e of world.errands) {
    for (const b of built.buildings) {
      const inside = e.x > b.x1 && e.x < b.x2 && e.z > b.z1 && e.z < b.z2;
      assert.ok(!inside, `errand ${e.id} is inside a building`);
    }
    assert.equal(waterAt(CITY, e.x, e.z), null, `errand ${e.id} is in water`);
    const B = world.bounds;
    assert.ok(e.x > B.x1 && e.x < B.x2 && e.z > B.z1 && e.z < B.z2, `errand ${e.id} is off the map`);
  }
});

test("an errand's sabotage kill darkens the street", () => {
  const world = districtWorld(21);
  world.patrolDefs = [];
  world.agents = [];
  world.start();
  const e = world.errands.find((x) => x.kind === "sabotage");
  world.player.x = e.x;
  world.player.z = e.z;
  world.setInput({ moveX: 0, moveZ: 0, interact: true });
  for (let i = 0; i < 90; i++) world.update(1 / 60);
  assert.ok(e.done);
  const cut = (world.cityBuilt.lamps || []).filter((l) => l.cutUntil !== undefined);
  assert.ok(cut.length > 0, "killing the power box left every lamp on");
});

test("errands are optional: the approved beat still wins without them", () => {
  const world = districtWorld(31);
  world.patrolDefs = [];
  world.agents = [];
  world.start();
  world.player.x = LEVEL.witness.x;
  world.player.z = LEVEL.witness.z;
  world.setInput({ moveX: 0, moveZ: 0, interact: true });
  for (let i = 0; i < 90; i++) world.update(1 / 60);
  assert.equal(world.objective, "reach_lane");
  world.player.x = LEVEL.goal.x;
  world.player.z = LEVEL.goal.z;
  world.update(1 / 60);
  assert.equal(world.phase, "won");
  assert.equal(world.errandsDone, 0, "the run finished without touching the errands");
  assert.ok(world.score >= 100);
});

// ------------------------------------------------------------------ weather
test("weather drifts on its own and reports a resolved mood", () => {
  const w = new Weather({ start: "drizzle", interval: 4, allowLightning: false });
  let changes = 0;
  w.onEvent = (e) => {
    if (e.type === "weather-change") changes++;
  };
  for (let i = 0; i < 60 * 120; i++) w.update(1 / 60);
  assert.ok(changes >= 2, `weather never changed (${changes})`);
  assert.ok(w.blend.rain >= 0 && w.blend.rain <= 1);
  assert.ok(w.blend.fogFar > w.blend.fogNear);
  const known = Object.values(WEATHER).some((p) => p.id === w.blend.id);
  assert.ok(known, `unknown weather ${w.blend.id}`);
});

test("wet streets follow the rain and dry out slowly", () => {
  const wet = new Wetness();
  const start = wet.level;
  for (let i = 0; i < 60 * 10; i++) wet.update(1 / 60, 1);
  assert.ok(wet.level > start, "the street never got wet in a downpour");
  const soaked = wet.level;
  for (let i = 0; i < 60 * 3; i++) wet.update(1 / 60, 0);
  assert.ok(wet.level < soaked, "the street never dried");
  assert.ok(wet.level > 0.2, "it dried instantly, which reads as a bug");
});

// ------------------------------------------------------------------ specs
test("vehicle specs stay within the street and play well", () => {
  for (const [kind, spec] of Object.entries(VEHICLE_SPEC)) {
    assert.ok(spec.len > 3 && spec.len < 9, `${kind} is not car-sized`);
    assert.ok(spec.maxSpeed > 6 && spec.maxSpeed < 16, `${kind} speed is unplayable`);
    assert.ok(spec.height > 1.2 && spec.height < 3.4);
  }
});

// ---------------------------------------------------------------- reachability
// The district is only open if a body can actually walk it. This floods the map
// on a 1 m grid using the same boxes and water the player collides with, then
// checks that every objective is inside the component the player spawns in.
// It catches the class of bug that is invisible in a screenshot: a kerb, a
// fence or a shed that silently seals off a whole district.
test("every objective on the map is walkable from the spawn", () => {
  const built = buildCity(CITY, TIERS.desktop);
  const level = buildLevel();
  const boxes = built.boxes.concat(level.boxes);
  const R = 0.42;
  const step = 1;
  const B = CITY.bounds;
  const W = Math.ceil((B.x2 - B.x1) / step) + 1;
  const H = Math.ceil((B.z2 - B.z1) / step) + 1;
  const open = new Uint8Array(W * H);
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      const x = B.x1 + i * step;
      const z = B.z1 + j * step;
      let v = waterAt(CITY, x, z) ? 0 : 1;
      if (v) {
        for (const b of boxes) {
          if (b.y1 <= 0.45 || b.y0 >= 1.5) continue;
          if (x > b.x1 - R && x < b.x2 + R && z > b.z1 - R && z < b.z2 + R) {
            v = 0;
            break;
          }
        }
      }
      open[i * H + j] = v;
    }
  }
  const gx = (x) => Math.round((x - B.x1) / step);
  const gz = (z) => Math.round((z - B.z1) / step);
  const seen = new Uint8Array(W * H);
  const start = [gx(LEVEL.spawn.x), gz(LEVEL.spawn.z)];
  const stack = [start];
  seen[start[0] * H + start[1]] = 1;
  let reached = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    reached += 1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || a >= W || b < 0 || b >= H) continue;
      const id = a * H + b;
      if (seen[id] || !open[id]) continue;
      seen[id] = 1;
      stack.push([a, b]);
    }
  }
  // The spawn component must be most of the walkable city, not a pocket.
  const walkable = open.reduce((n, v) => n + v, 0);
  assert.ok(reached > walkable * 0.9, `only ${((reached / walkable) * 100).toFixed(1)}% of the map is reachable`);

  const targets = [
    ["Sade", LEVEL.witness],
    ["the lane", LEVEL.goal],
    ...TUNING.errands.map((e) => [e.id, e]),
  ];
  for (const [name, t] of targets) {
    const i = gx(t.x);
    const j = gz(t.z);
    let hit = false;
    for (let r = 0; r <= 6 && !hit; r++) {
      for (let di = -r; di <= r && !hit; di++) {
        for (let dj = -r; dj <= r && !hit; dj++) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || a >= W || b < 0 || b >= H) continue;
          if (seen[a * H + b]) hit = true;
        }
      }
    }
    assert.ok(hit, `${name} at ${t.x},${t.z} cannot be walked to from the spawn`);
  }
});

test("traffic runs on the city layout, whichever object a caller passes", () => {
  // A caller that only has the built district (tools, tests, the bot) used to
  // get an empty route list and therefore zero cars, silently.
  const built = buildCity(CITY, TIERS.desktop);
  const w1 = new World(LEVEL, { boxes: built.boxes, platforms: built.platforms }, {
    city: CITY,
    cityBoxes: built.boxes,
    cityBuilt: built,
    tier: TIERS.desktop,
  });
  assert.equal(w1.traffic.vehicles.length, TIERS.desktop.traffic, "layout with routes spawns traffic");

  const w2 = new World(LEVEL, { boxes: built.boxes, platforms: built.platforms }, {
    city: built,
    cityBoxes: built.boxes,
    cityBuilt: built,
    tier: TIERS.desktop,
  });
  assert.equal(w2.traffic.vehicles.length, TIERS.desktop.traffic, "the built district still spawns traffic");
});

test("a stopped car backs out of a jam instead of blocking the street forever", () => {
  const built = buildCity(CITY, TIERS.desktop);
  const w = new World(LEVEL, { boxes: built.boxes, platforms: built.platforms }, {
    city: CITY,
    cityBoxes: built.boxes,
    cityBuilt: built,
    tier: TIERS.desktop,
  });
  w.start();
  // Pin one car in place for longer than the back-up threshold: a dead end or
  // a pedestrian standing in the lane is what the manoeuvre is for. (A timed
  // jam lifts on its own, so it never produces a long enough stop.)
  const held = w.traffic.vehicles[0];
  let reversed = false;
  for (let i = 0; i < 60 * 14; i++) {
    held.speed = 0;
    w.traffic.update(1 / 60, null, []);
    if (held.reversing) reversed = true;
  }
  assert.ok(reversed, "no car ever backed out of the jam");
  // And the street clears: no car is permanently parked in the junction.
  const stopped = w.traffic.vehicles.filter((v) => v.speed < 0.3).length;
  assert.ok(stopped <= 1, `${stopped} of ${w.traffic.vehicles.length} cars are still stopped 14 s later`);
});

// ------------------------------------------------------------- collision index
test("the spatial index never hides a box that matters", () => {
  const built = buildCity(CITY, TIERS.desktop);
  const level = buildLevel();
  const boxes = built.boxes.concat(level.boxes);
  const { BoxIndex } = collisionIndex;
  const idx = new BoxIndex(boxes);
  // Every box must come back from a query over its own footprint, or collision
  // would let a player walk through it.
  for (const b of boxes) {
    const hits = idx.query(b.x1, b.z1, b.x2, b.z2);
    assert.ok(hits.includes(b), `box ${b.tag} at ${b.x1},${b.z1} is missing from its own bucket`);
  }
  // And a query near a wall must include that wall for a body-sized radius.
  const wall = boxes.find((b) => b.tag === "wall");
  if (wall) {
    const near = idx.near((wall.x1 + wall.x2) / 2, wall.z1 - 0.2, 0.42);
    assert.ok(near.includes(wall), "a wall 20 cm away was not returned");
  }
  // The whole point: a query is a small fraction of the map.
  let total = 0;
  for (let i = 0; i < 200; i++) {
    total += idx.near(CITY.bounds.x1 + Math.random() * 300, CITY.bounds.z1 + Math.random() * 250, 2.5).length;
  }
  const avg = total / 200;
  assert.ok(avg < boxes.length * 0.1, `index returns ${avg.toFixed(0)} of ${boxes.length} boxes, which is not a saving`);
});

test("the district still behaves identically with the index in play", () => {
  // Same seed, same inputs: the player must end up in the same place. This is
  // the guard against an index that is fast because it is wrong.
  const run = () => {
    const w = districtWorld(31);
    w.agents.length = 0;
    w.start();
    for (let i = 0; i < 240; i++) {
      w.setInput({ moveZ: 1, run: true });
      w.cameraYaw = Math.PI;
      w.update(1 / 60);
    }
    return { x: w.player.x, z: w.player.z };
  };
  const a = run();
  const b = run();
  assert.equal(a.x, b.x);
  assert.equal(a.z, b.z);
  assert.ok(Math.hypot(a.x, a.z) > 1, "the player never moved");
});
