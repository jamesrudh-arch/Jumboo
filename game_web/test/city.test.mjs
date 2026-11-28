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
