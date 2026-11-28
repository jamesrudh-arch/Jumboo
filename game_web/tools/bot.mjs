// A scripted playthrough of the slice, run headlessly against the real world
// simulation and the real district geometry. It answers one question with
// evidence rather than opinion: with the numbers as tuned, can a player who
// knows where they are going finish the beat, and what stops them if not?
//
//   node tools/bot.mjs [runs] [--no-errands] [--trace]
//
// The bot is a stand-in for a competent player, not a learning agent: it plans
// on a walkable grid (the same collision boxes the player collides with), walks
// or sprints depending on whether a collector is close, and holds crouch when
// it is inside a collector's sight cone. Difficulty is read from how often it
// is spotted and caught, and how long a clean run takes.

import { buildLevel, LEVEL } from "../src/level.js";
import { buildCity, CITY, waterAt } from "../src/city.js";
import { World, PHASE } from "../src/world.js";

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) || 5);
const doErrands = !args.includes("--no-errands");
const trace = args.includes("--trace");
// `--ghosts` removes the collectors: it isolates navigation (can the bot walk
// the route and finish every objective?) from detection (can it do that
// without being seen?). Both questions need separate answers.
const ghosts = args.includes("--ghosts");

const built = buildLevel();
const city = buildCity(CITY, { buildings: 104, treeCount: 100, crowd: 14, traffic: 14 });
// The same box list the player collides with, in the same order the game builds
// it: the district first, then the lane's own cover.
const boxes = city.boxes.concat(built.boxes);

// ------------------------------------------------------------------- grid
// 1 m cells over the district. A cell is walkable when the player's body fits
// at waist height and it is not open water: the same rules the movement solver
// applies, sampled ahead of time.
const STEP = 1;
const B = { x1: -148, x2: 148, z1: -158, z2: 88 };
const W = Math.ceil((B.x2 - B.x1) / STEP) + 1;
const H = Math.ceil((B.z2 - B.z1) / STEP) + 1;
const walkable = new Uint8Array(W * H);
const R = 0.42;
for (let gx = 0; gx < W; gx++) {
  for (let gz = 0; gz < H; gz++) {
    const x = B.x1 + gx * STEP;
    const z = B.z1 + gz * STEP;
    let ok = 1;
    // A bridge deck is walkable even though the canal runs under it.
    const onBridge = (city.bridges || []).some((b) => x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2);
    if (!onBridge && waterAt(city, x, z)) ok = 0;
    if (ok) {
      for (const b of boxes) {
        if (b.y1 <= 0.45 || b.y0 >= 1.5) continue; // kerbs the player steps over
        if (x > b.x1 - R && x < b.x2 + R && z > b.z1 - R && z < b.z2 + R) {
          ok = 0;
          break;
        }
      }
    }
    walkable[gx * H + gz] = ok;
  }
}
const idx = (gx, gz) => gx * H + gz;
const toGrid = (x, z) => ({
  gx: Math.round((x - B.x1) / STEP),
  gz: Math.round((z - B.z1) / STEP),
});
const toWorld = (gx, gz) => ({ x: B.x1 + gx * STEP, z: B.z1 + gz * STEP });

/** True when the straight line between two points stays on walkable cells.
 *  The grid is coarse, so sample well under one cell and check the four cells
 *  the sample could belong to. */
function lineClear(x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(len / 0.35));
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n;
    const z = z1 + ((z2 - z1) * i) / n;
    const c = toGrid(x, z);
    if (c.gx < 0 || c.gx >= W || c.gz < 0 || c.gz >= H) return false;
    if (!walkable[idx(c.gx, c.gz)]) return false;
  }
  return true;
}

/** Nearest walkable cell to a point, as world coordinates. */
function snapNearest(x, z) {
  const g = toGrid(x, z);
  const cell = snap(g.gx, g.gz, 6);
  return cell ? toWorld(cell.gx, cell.gz) : { x, z };
}

/** Nearest walkable cell, searched outward in rings. */
function snap(gx, gz, maxR = 40) {
  if (gx >= 0 && gx < W && gz >= 0 && gz < H && walkable[idx(gx, gz)]) return { gx, gz };
  for (let r = 1; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 0 || nx >= W || nz < 0 || nz >= H) continue;
        if (walkable[idx(nx, nz)]) return { gx: nx, gz: nz };
      }
    }
  }
  return null;
}

/** A* over the grid with 8-way movement and no corner cutting. */
function findPath(from, to) {
  const a = snap(...Object.values(toGrid(from.x, from.z)));
  const b = snap(...Object.values(toGrid(to.x, to.z)));
  if (!a || !b) return null;
  const start = idx(a.gx, a.gz);
  const goal = idx(b.gx, b.gz);
  const open = [start];
  const gScore = new Float32Array(W * H).fill(Infinity);
  const fScore = new Float32Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const inOpen = new Uint8Array(W * H);
  gScore[start] = 0;
  const h = (i) => {
    const gx = Math.floor(i / H);
    const gz = i % H;
    return Math.hypot(gx - b.gx, gz - b.gz);
  };
  fScore[start] = h(start);
  inOpen[start] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let guard = 0;
  while (open.length && guard++ < 400000) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[best]]) best = i;
    const cur = open.splice(best, 1)[0];
    inOpen[cur] = 0;
    if (cur === goal) break;
    const cx = Math.floor(cur / H);
    const cz = cur % H;
    for (const [dx, dz] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= W || nz < 0 || nz >= H) continue;
      const ni = idx(nx, nz);
      if (!walkable[ni]) continue;
      if (dx && dz && (!walkable[idx(cx + dx, cz)] || !walkable[idx(cx, cz + dz)])) continue;
      const cost = gScore[cur] + (dx && dz ? 1.4142 : 1);
      if (cost < gScore[ni]) {
        gScore[ni] = cost;
        fScore[ni] = cost + h(ni);
        prev[ni] = cur;
        if (!inOpen[ni]) {
          open.push(ni);
          inOpen[ni] = 1;
        }
      }
    }
  }
  if (prev[goal] < 0 && goal !== start) return null;
  const out = [];
  for (let i = goal; i !== -1; i = prev[i]) {
    out.push(toWorld(Math.floor(i / H), i % H));
    if (i === start) break;
  }
  out.reverse();
  // Drop intermediate points that are in a straight line: fewer, longer legs.
  const slim = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a1 = slim[slim.length - 1];
    const b1 = out[i];
    const c1 = out[i + 1];
    const cross = (b1.x - a1.x) * (c1.z - a1.z) - (b1.z - a1.z) * (c1.x - a1.x);
    const dot = (b1.x - a1.x) * (c1.x - b1.x) + (b1.z - a1.z) * (c1.z - b1.z);
    if (Math.abs(cross) > 0.4 || dot <= 0) slim.push(b1);
  }
  slim.push(out[out.length - 1]);
  return slim;
}

/** Prefer cells a little further from the immediate wall we are hugging. */
function stepBonus(cell) {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const gx = cell.gx + dx;
      const gz = cell.gz + dz;
      if (gx >= 0 && gx < W && gz >= 0 && gz < H && walkable[idx(gx, gz)]) n++;
    }
  }
  return n / 25;
}

/** Random walkable points for a scenario run without objectives. */
function makeWorld(seed) {
  const world = new World(LEVEL, { ...built, boxes: city.boxes }, {
    city: { ...CITY, ...city },
    cityBoxes: city.boxes,
    cityBuilt: city,
    tier: { crowd: 14, traffic: 14 },
    aggression: 0.5,
    seed,
  });
  world.openBoxes = boxes;
  world.start();
  if (ghosts) {
    world.agents.length = 0;
    world.traffic.vehicles.length = 0;
  }
  return world;
}

function runOnce(seed, opts = {}) {
  const world = makeWorld(seed);
  const dt = 1 / 60;
  let t = 0;
  const log = { seed, spotted: 0, caught: 0, errands: 0, drownings: 0, hits: 0, notes: [] };

  const waypoints = [];
  if (opts.errands) {
    for (const e of world.errands) waypoints.push({ id: e.id, x: e.x, z: e.z });
  }
  // The witness leg is aimed at a spot inside the talk radius that the grid can
  // actually stand on: the marker itself can sit under a lamp post base or a
  // kerb, and a waypoint nobody can occupy fails a leg that is otherwise fine.
  const sadeSpot = snapNearest(LEVEL.witness.x, LEVEL.witness.z);
  waypoints.push({ id: "sade", ...sadeSpot, radius: LEVEL.witness.radius });
  waypoints.push({ id: "lane", x: LEVEL.goal.x, z: LEVEL.goal.z });

  // Objectives in a nearest-neighbour tour, so a run is one sensible sweep of
  // the map rather than a zig-zag across it.
  const order = [];
  let here = { x: world.player.x, z: world.player.z };
  const pool = waypoints.slice();
  while (pool.length) {
    let bi = 0;
    let bd = Infinity;
    pool.forEach((w, i) => {
      const d = Math.hypot(w.x - here.x, w.z - here.z);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const w = pool.splice(bi, 1)[0];
    order.push(w);
    here = w;
  }
  // The approved beat has an order: Sade first, the lane last.
  const lane = order.splice(order.findIndex((w) => w.id === "lane"), 1)[0];
  const sade = order.splice(order.findIndex((w) => w.id === "sade"), 1)[0];
  order.unshift(sade);
  order.push(lane);

  let wi = 0;
  let sub = null; // path from here to the current objective
  let replanIn = 0;
  let legTime = 0;
  let legStalls = 0;
  let noPathCount = 0;
  let lastLoggedWi = -1;
  let legBudget = 0;
  let bestLegDist = Infinity;
  let stuckTimer = 0;
  let fleeTime = 0;
  let lastPos = { x: world.player.x, z: world.player.z };

  let nextTrace = 0;
  while (t < 1200 && wi < order.length) {
    const p = world.player;
    const wp = order[wi];

    // Objectives that are already satisfied are skipped.
    const er = wp.id === "sade" || wp.id === "lane" ? null : world.errands.find((e) => e.id === wp.id);
    if (er && er.done) {
      wi++;
      sub = null;
      legTime = 0;
      legBudget = 0;
      bestLegDist = Infinity;
      continue;
    }
    if (wp.id === "sade" && world.talkedToWitness) {
      wi++;
      sub = null;
      legTime = 0;
      legBudget = 0;
      bestLegDist = Infinity;
      continue;
    }

    const dGoal = Math.hypot(wp.x - p.x, wp.z - p.z);

    // Standing on a street errand: hold interact until it finishes.
    if (er && dGoal < er.radius * 0.8) {
      world.setInput({ moveX: 0, moveZ: 0, interact: true });
      world.update(dt);
      t += dt;
      if (er.done) {
        wi++;
        sub = null;
        legTime = 0;
        legBudget = 0;
        bestLegDist = Infinity;
      }
      continue;
    }
    // At Sade: hold interact until she has been spoken to. The talk only
    // completes inside her zone (2.2 m), not on the marker, so the bot only has
    // to get inside the radius and stop.
    if (wp.id === "sade" && dGoal < LEVEL.witness.radius * 0.65) {
      world.setInput({ moveX: 0, moveZ: 0, interact: true });
      world.update(dt);
      t += dt;
      if (world.talkedToWitness) {
        wi++;
        sub = null;
        legTime = 0;
      }
      continue;
    }

    // The approved beat ends when the player is inside the goal radius, which is
    // wider than the waypoint tolerance used for walking.
    if (wp.id === "lane" && world.objective === "reach_lane" && Math.hypot(LEVEL.goal.x - p.x, LEVEL.goal.z - p.z) < LEVEL.goal.radius) {
      world.setInput({ moveX: 0, moveZ: 0, interact: false });
      for (let i = 0; i < 8 && world.phase !== PHASE.WON; i++) {
        world.update(dt);
        t += dt;
      }
      for (const e of world.drainEvents()) if (e.type === "won") log.notes.push(`won at ${t.toFixed(1)}s`);
      if (trace) console.log("lane end-of-leg at", p.x.toFixed(2), p.z.toFixed(2), "phase", world.phase, "dGoal", Math.hypot(LEVEL.goal.x - p.x, LEVEL.goal.z - p.z).toFixed(2));
      break;
    }

    // An objective that cannot be reached gets abandoned rather than eating the
    // whole run: this bot is a difficulty probe, not a pathfinding benchmark.
    // The budget scales with the distance, because the dockhand is a 250 m walk
    // and a flat limit abandons a leg that is merely long.
    legTime += dt;
    if (legBudget === 0) legBudget = 60 + Math.hypot(wp.x - p.x, wp.z - p.z) * 1.1;
    if (legTime > legBudget) {
      // A leg that is over budget but closing is a leg the bot keeps missing
      // the marker on, not an unreachable one: re-plan to it rather than skip.
      if (dGoal < bestLegDist - 6) {
        bestLegDist = dGoal;
        legTime = 0;
        legBudget = 0;
        sub = null;
        continue;
      }
      log.notes.push(`gave up on ${wp.id} after ${legTime.toFixed(0)}s`);
      wi++;
      sub = null;
      legTime = 0;
      legBudget = 0;
      bestLegDist = Infinity;
      continue;
    }

    // Re-plan on a short cycle: a path computed once goes stale as soon as the
    // player is pushed off it, and following stale waypoints is how a bot
    // oscillates instead of walking.
    replanIn -= dt;
    if (!sub || replanIn <= 0) {
      const next = findPath(p, wp);
      if (next) {
        // Keep the old path until the new one is known good, and remember where
        // we have been: if the destination is genuinely unreachable we want to
        // say so rather than silently looping.
        sub = next;
        replanIn = 0.5;
        if (trace && wi !== lastLoggedWi) {
          lastLoggedWi = wi;
          console.log(`  plan -> ${wp.id} (${wp.x.toFixed(0)},${wp.z.toFixed(0)}) from ${p.x.toFixed(0)},${p.z.toFixed(0)} : ${next.length} pts, ends ${next[next.length - 1].x.toFixed(0)},${next[next.length - 1].z.toFixed(0)}`);
        }
        noPathCount = 0;
      } else {
        noPathCount += 1;
        replanIn = 0.4;
        if (!sub) {
          log.notes.push(`no path to ${wp.id}`);
          wi++;
          legTime = 0;
          continue;
        }
        if (noPathCount > 40) {
          log.notes.push(`cannot reach ${wp.id}, giving up`);
          wi++;
          sub = null;
          legTime = 0;
          noPathCount = 0;
          continue;
        }
      }
    }

    // Aim at a point a couple of steps ahead along the path, and look a bit
    // further where the next stretch is straight. Walking from point to point
    // makes the bot zig-zag on the grid; this keeps the line natural.
    let near = 0;
    let bestD = Infinity;
    for (let i = 0; i < sub.length; i++) {
      const d = Math.hypot(sub[i].x - p.x, sub[i].z - p.z);
      if (d < bestD) {
        bestD = d;
        near = i;
      }
    }
    let aimIdx = Math.min(sub.length - 1, near + 2);
    // Straighten: take the furthest point on the path that stays close to the
    // straight line from the player to it.
    for (let i = Math.min(sub.length - 1, near + 8); i > near; i--) {
      const cand = sub[i];
      const mx = (p.x + cand.x) / 2;
      const mz = (p.z + cand.z) / 2;
      const len = Math.hypot(cand.x - p.x, cand.z - p.z) || 1;
      const off = Math.abs((sub[Math.min(sub.length - 1, Math.round((near + i) / 2))].x - mx) * (cand.z - p.z) / len -
        (sub[Math.min(sub.length - 1, Math.round((near + i) / 2))].z - mz) * (cand.x - p.x) / len);
      // The straight-line check is what stops the bot clipping a wall corner:
      // the chord can look clear at its midpoint while the corner is in the way.
      if (off < 1.2 && lineClear(p.x, p.z, cand.x, cand.z)) {
        aimIdx = i;
        break;
      }
    }
    const aim = sub[aimIdx];

    let nearest = Infinity;
    let nearestAgent = null;
    let watched = false;
    for (const a of world.agents) {
      const dist = Math.hypot(a.x - p.x, a.z - p.z);
      if (dist < nearest) {
        nearest = dist;
        nearestAgent = a;
      }
      if (dist < 15 && a.state !== "returning") {
        const toP = Math.atan2(p.x - a.x, p.z - a.z);
        const facing = Math.atan2(Math.sin(toP - a.yaw), Math.cos(toP - a.yaw));
        if (Math.abs(facing) < 0.85) watched = true;
      }
    }

    let yaw;
    let run;
    let crouch;
    if (world.phase === PHASE.HUNT && nearestAgent) {
      // Flee along open ground, away from the hunter.
      const away = Math.atan2(p.x - nearestAgent.x, p.z - nearestAgent.z);
      let best = away;
      let bestScore = -Infinity;
      for (let k = -6; k <= 6; k++) {
        const test = away + k * 0.24;
        let open = 0;
        for (let step = 1; step <= 4; step++) {
          const c = toGrid(p.x + Math.sin(test) * step * 0.9, p.z + Math.cos(test) * step * 0.9);
          if (c.gx < 0 || c.gx >= W || c.gz < 0 || c.gz >= H || !walkable[idx(c.gx, c.gz)]) break;
          open = step;
        }
        const score = open * 2 + Math.cos(test - away) * 1.4;
        if (score > bestScore) {
          bestScore = score;
          best = test;
        }
      }
      yaw = best;
      run = true;
      crouch = false;
    } else if (watched && nearest < 5) {
      yaw = Math.atan2(p.x - nearestAgent.x, p.z - nearestAgent.z);
      run = true;
      crouch = false;
    } else {
      yaw = Math.atan2(aim.x - p.x, aim.z - p.z);
      // Sprint on open ground; crouch when a cone is on us at range, which is
      // slower but silent, and silence is what stops the alarm.
      crouch = watched && nearest < 13;
      run = !crouch && nearest > 12;
    }

    world.cameraYaw = yaw;
    world.setInput({ moveX: 0, moveZ: 1, run, crouch, interact: false });
    world.update(dt);
    t += dt;

    if (world.phase === PHASE.HUNT) fleeTime += dt;
    else fleeTime = 0;
    if (fleeTime > 12) {
      fleeTime = 0;
      sub = null;
    }

    // Stuck detection: pushed into a corner or a wall we cannot path around.
    if (Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.02) {
      stuckTimer += dt;
      if (stuckTimer > 2) {
        stuckTimer = 0;
        sub = null;
        legStalls += 1;
        if (trace) {
          console.log(`  stalled at ${p.x.toFixed(1)},${p.z.toFixed(1)} -> ${wp.id} (${legStalls}) aim ${aim.x.toFixed(0)},${aim.z.toFixed(0)} len ${sub ? sub.length : 0} spd ${p.speed.toFixed(2)}`);
        }
        if (legStalls > 6) {
          log.notes.push(`no route to ${wp.id} (stalled ${legStalls}x)`);
          if (trace) console.log(`  abandoning ${wp.id} at ${p.x.toFixed(1)},${p.z.toFixed(1)} t=${t.toFixed(0)}`);
          wi++;
          legStalls = 0;
          legTime = 0;
          continue;
        }
        if (findPath(p, wp) === null) {
          log.notes.push(`stuck before ${wp.id}`);
          break;
        }
      }
    } else {
      stuckTimer = 0;
      // Progress resets the patience counters: a long leg should not be
      // abandoned because of a few momentary snags along the way.
      legStalls = 0;
      noPathCount = 0;
    }
    lastPos = { x: p.x, z: p.z };

    if (trace && t > nextTrace) {
      nextTrace = t + 10;
      console.log(`  ${t.toFixed(0)}s -> ${wp.id} d=${dGoal.toFixed(1)} at ${p.x.toFixed(0)},${p.z.toFixed(0)} spd ${p.speed.toFixed(1)} aim ${aim.x.toFixed(0)},${aim.z.toFixed(0)} len ${sub.length}`);
    }
    for (const e of world.drainEvents()) {
      if (e.type === "spotted") log.spotted++;
      if (e.type === "caught") {
        log.caught++;
        log.notes.push(`caught at ${t.toFixed(1)}s`);
      }
      if (e.type === "errand") log.errands++;
      if (e.type === "drowned") log.drownings++;
      if (e.type === "carHit") log.hits++;
      if (e.type === "won") log.notes.push(`won at ${t.toFixed(1)}s`);
    }
    if (world.phase === PHASE.WON || world.phase === PHASE.CAUGHT) break;
  }

  log.at = wi < order.length ? order[wi].id : "done";
  log.time = +t.toFixed(2);
  log.score = Math.round(world.score);
  log.rank = world.rank || "-";
  log.won = world.phase === PHASE.WON;
  log.chaos = world.chaosEvents.length;
  log.dist = Math.round(Math.hypot(world.player.x - LEVEL.goal.x, world.player.z - LEVEL.goal.z));
  return log;
}

const results = [];
for (let i = 0; i < runs; i++) results.push(runOnce(9000 + i, { errands: doErrands }));

for (const r of results) {
  console.log(
    `${r.won ? "WON " : "FAIL"} seed=${r.seed} ${r.time}s score=${r.score} rank=${r.rank} ` +
      `spotted=${r.spotted} caught=${r.caught} errands=${r.errands} chaos=${r.chaos} ` +
      `at=${r.at} d=${r.dist}` +
      (r.notes.length ? ` [${r.notes.join(", ")}]` : ""),
  );
}
const times = results.filter((r) => r.won).map((r) => r.time).sort((a, b) => a - b);
console.log(
  `\n${results.length - results.filter((r) => !r.won).length}/${results.length} completed` +
    (times.length ? `, median ${times[Math.floor(times.length / 2)].toFixed(1)}s` : "") +
    `, spotted ${results.reduce((n, r) => n + r.spotted, 0)}, caught ${results.reduce((n, r) => n + r.caught, 0)}`,
);
