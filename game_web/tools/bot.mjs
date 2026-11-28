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
import { hasLineOfSight } from "../src/collision.js";

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

/** True when a body of radius 0.45 fits at this spot, tested against real boxes. */
function bodyFree(x, z, nearBoxes) {
  for (const b of nearBoxes) {
    if (b.y1 <= 0.45 || b.y0 >= 1.7) continue;
    const cx = Math.max(b.x1, Math.min(x, b.x2));
    const cz = Math.max(b.z1, Math.min(z, b.z2));
    if (Math.hypot(cx - x, cz - z) < 0.45) return false;
  }
  return true;
}

/**
 * A heading that moves away from `hunter` without walking into anything.
 * Rotates out from straight-away in both directions and takes the first clear
 * step, so a wall or a parked car deflects the escape instead of stopping it.
 * Standing still in a hunt is what gets a player caught, so this always returns
 * a heading, even if it has to be a compromise.
 */
function slideAway(p, hunter, nearBoxes) {
  const away = Math.atan2(p.x - hunter.x, p.z - hunter.z);
  for (const reach of [1.6, 2.4, 3.2]) {
    for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75, 2.1, -2.1]) {
      const test = away + turn;
      if (bodyFree(p.x + Math.sin(test) * reach, p.z + Math.cos(test) * reach, nearBoxes)) return test;
    }
  }
  return away;
}

// ------------------------------------------------------------------ lane plan
// The loading lane is a corridor with three collectors in it, so the way
// through is not "walk to the marker": it is "only step into ground no cone is
// about to sweep, and wait in the dark when there is none". Everything below
// exists to answer that question far enough ahead to be useful.
const LANE_BOX = { x1: -11.5, x2: 11.5, z1: -47.5, z2: 6 };

const inLane = (x, z) =>
  x > LANE_BOX.x1 && x < LANE_BOX.x2 && z > LANE_BOX.z1 && z < LANE_BOX.z2;

/** Where a patrolling collector will be, and facing, over the next ~1.8 s. */
function agentFuture(a, steps = 4, stepTime = 0.45) {
  const pts = a.def.points;
  const out = [];
  let x = a.x;
  let z = a.z;
  let wp = a.waypoint;
  let yaw = a.yaw;
  for (let s = 0; s < steps; s++) {
    // A paused collector sweeps its head instead of walking; the sweep is
    // modelled as facing straight ahead, which under-estimates nothing that
    // matters (its body still has to be in the lane for the cone to reach).
    const paused = s === 0 && a.pause > 0;
    out.push({ x, z, yaw });
    if (!paused) {
      let rem = a.speed * stepTime;
      let guard = 0;
      while (rem > 0.001 && guard++ < 24) {
        const target = pts[wp];
        const d = Math.hypot(target.x - x, target.z - z);
        if (d < 0.22) {
          wp = (wp + 1) % pts.length;
          continue;
        }
        const step = Math.min(rem, d);
        const dir = Math.atan2(target.x - x, target.z - z);
        x += Math.sin(dir) * step;
        z += Math.cos(dir) * step;
        yaw = dir;
        rem -= step;
      }
    }
  }
  return out;
}

/** True if a crouched player at (x,z) would be in this collector's cone. */
function visibleFrom(a, pose, x, z, headY, near) {
  const sight = a.def.sight * 0.55; // crouched sight range
  if (Math.hypot(pose.x - x, pose.z - z) > sight) return false;
  const toP = Math.atan2(x - pose.x, z - pose.z);
  if (Math.abs(Math.atan2(Math.sin(toP - pose.yaw), Math.cos(toP - pose.yaw))) > a.def.fov) return false;
  return hasLineOfSight(pose.x, 1.62, pose.z, x, headY, z, near);
}

/**
 * The best nearby cell to be standing in for the next second and a half, in
 * eight directions at a few distances. "Stay put" is one of the options, so a
 * lane corner with a cone sweeping it is a place to wait, not to cross.
 */
function pickHop(world, p, goal, agents) {
  const headY = p.feetY + 1.05;
  const progressNow = Math.hypot(goal.x - p.x, goal.z - p.z);
  const opts = [];
  for (const r of [0, 2, 3.5, 5, 7]) {
    const dirs = r === 0 ? 1 : 8;
    for (let k = 0; k < dirs; k++) {
      const dir = (k * Math.PI) / 4;
      const x = p.x + Math.sin(dir) * r;
      const z = p.z + Math.cos(dir) * r;
      if (r > 0) {
        if (!lineClear(p.x, p.z, x, z)) continue;
        if (waterAt(world.city, x, z)) continue;
      }
      if (!bodyFree(x, z, world.boxesNear(x, z, 1.8))) continue;
      const near = world.boxesNear(x, z, 15);
      let safe = true;
      for (const a of agents) {
        for (const pose of agentFuture(a)) {
          if (visibleFrom(a, pose, x, z, headY, near)) {
            safe = false;
            break;
          }
        }
        if (!safe) break;
      }
      if (!safe) continue;
      const progress = progressNow - Math.hypot(goal.x - x, goal.z - z);
      opts.push({ x, z, r, progress });
    }
  }
  if (!opts.length) return null;
  // Rank by how much ground the hop actually buys toward the goal, measured as
  // a walk rather than a straight line: the lane's walls mean a sideways hop
  // can be worth more than a forward one.
  opts.sort((a, b) => b.progress - a.progress);
  const scored = opts.slice(0, 6).map((o) => {
    const route = followPath({ x: o.x, z: o.z }, goal);
    const step = route ? Math.hypot(route.x - o.x, route.z - o.z) : 0;
    return { ...o, score: o.progress - o.r * 0.05 - step * 0.35 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// ------------------------------------------------- time-expanded lane search
// Crouch-walking the lane takes about forty seconds, and the collectors sweep
// as they patrol, so "is this spot safe" is really "is this spot safe at the
// moment I would be standing in it". The plan below is a breadth-first search
// over (cell, half-second) instead: it finds a crouch route whose every step
// lands on ground that no cone covers at that moment, waiting where it has to.
const LANE_TICK = 0.5; // seconds per planning step
const LANE_CELL = 0.7; // metres a crouched player covers per step
const LANE_HORIZON = 220; // 110 s of plan: a full patrol cycle plus a wait
let LANE_WALK = null;
let planFutures = null;

function lanePlan(world, from, goal) {
  const t0 = performance.now();
  const out = lanePlanInner(world, from, goal);
  if (process.env.BOT_PERF) console.log(`  lanePlan ${(performance.now() - t0).toFixed(0)}ms`);
  return out;
}

function lanePlanInner(world, from, goal) {
  const x0 = LANE_BOX.x1;
  const z0 = LANE_BOX.z1;
  const nx = Math.ceil((LANE_BOX.x2 - LANE_BOX.x1) / LANE_CELL) + 1;
  const nz = Math.ceil((LANE_BOX.z2 - LANE_BOX.z1) / LANE_CELL) + 1;
  const cellOf = (x, z) => ({
    i: Math.max(0, Math.min(nx - 1, Math.round((x - x0) / LANE_CELL))),
    k: Math.max(0, Math.min(nz - 1, Math.round((z - z0) / LANE_CELL))),
  });
  const centre = (i, k) => ({ x: x0 + i * LANE_CELL, z: z0 + k * LANE_CELL });
  const at = (i, k) => i * nz + k;

  // Walkable cells: the player's body fits and there is no water. The lane's
  // walls do not move, so this is built once and reused.
  if (!LANE_WALK || LANE_WALK.nx !== nx || LANE_WALK.nz !== nz) {
    const walk = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const c = centre(i, k);
        walk[at(i, k)] = !waterAt(world.city, c.x, c.z) && bodyFree(c.x, c.z, boxes) ? 1 : 0;
      }
    }
    const nearCells = new Array(nx * nz);
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const c = centre(i, k);
        nearCells[at(i, k)] = boxes.filter((b) => {
          if (b.y1 <= 0.2 || b.y0 >= 2.4) return false;
          const cx = Math.max(b.x1, Math.min(c.x, b.x2));
          const cz = Math.max(b.z1, Math.min(c.z, b.z2));
          return Math.hypot(cx - c.x, cz - c.z) < 8;
        });
      }
    }
    LANE_WALK = { nx, nz, walk, nearCells };
  }
  const walk = LANE_WALK.walk;
  const nearCells = LANE_WALK.nearCells;

  // Visibility per tick: which cells each collector's cone covers. A collector
  // comes back to roughly the same handful of poses three or four times a lap,
  // and the line-of-sight test is the expensive part, so cones are memoised by
  // pose. Everything else here is integer work.
  const coneCache = new Map();
  const coneAt = (a, pose) => {
    const key = `${Math.round(pose.x * 10)},${Math.round(pose.z * 10)},${Math.round(pose.yaw * 60)},${Math.round(a.def.sight * 10)},${Math.round(a.def.fov * 10)}`;
    const hit = coneCache.get(key);
    if (hit) return hit;
    const sight = a.def.sight * 0.55;
    const i0 = Math.max(0, Math.floor((pose.x - sight - x0) / LANE_CELL));
    const i1 = Math.min(nx - 1, Math.ceil((pose.x + sight - x0) / LANE_CELL));
    const k0 = Math.max(0, Math.floor((pose.z - sight - z0) / LANE_CELL));
    const k1 = Math.min(nz - 1, Math.ceil((pose.z + sight - z0) / LANE_CELL));
    const cells = [];
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) {
        const c = centre(i, k);
        const d = Math.hypot(c.x - pose.x, c.z - pose.z);
        if (d > sight) continue;
        const toP = Math.atan2(c.x - pose.x, c.z - pose.z);
        if (Math.abs(Math.atan2(Math.sin(toP - pose.yaw), Math.cos(toP - pose.yaw))) > a.def.fov) continue;
        if (hasLineOfSight(pose.x, 1.62, pose.z, c.x, 1.05, c.z, nearCells[at(i, k)])) cells.push(at(i, k));
      }
    }
    coneCache.set(key, cells);
    return cells;
  };
  const futures = world.agents.map((a) => agentFuture(a, LANE_HORIZON + 2, LANE_TICK));
  planFutures = futures;
  const posesPerTick = [];
  for (let t = 0; t < LANE_HORIZON; t++) {
    const covered = new Set();
    for (let ai = 0; ai < world.agents.length; ai++) {
      const pose = futures[ai]?.[t];
      if (!pose) continue;
      for (const cell of coneAt(world.agents[ai], pose)) covered.add(cell);
    }
    posesPerTick.push(covered);
  }

  // Breadth-first over (cell, tick). Waiting is a move, so a plan can idle out a
  // sweep; a move into covered ground is never taken.
  const start = cellOf(from.x, from.z);
  const goalCell = cellOf(goal.x, goal.z);
  const seen = new Uint8Array(nx * nz * LANE_HORIZON);
  const prev = new Int32Array(nx * nz * LANE_HORIZON).fill(-1);
  let layer = [at(start.i, start.k)];
  const startIdx = layer[0];
  seen[startIdx] = 1;
  const goalIdx = at(goalCell.i, goalCell.k);
  let found = -1;
  // If the goal cannot be reached inside the horizon, the best-progress node
  // still gives a plan: standing in the right pocket beats standing at the mouth.
  let bestNode = -1;
  let bestKey = startIdx * LANE_HORIZON;
  let bestScore = Infinity;
  const scoreOf = (cellIdx) => {
    const i = Math.floor(cellIdx / nz);
    const k = cellIdx % nz;
    const c = centre(i, k);
    return Math.hypot(c.x - goal.x, c.z - goal.z);
  };
  for (let t = 0; t < LANE_HORIZON - 1 && layer.length && found < 0; t++) {
    for (const node of layer) {
      const sc = scoreOf(node);
      if (sc < bestScore) {
        bestScore = sc;
        bestNode = node * LANE_HORIZON + t;
      }
    }
    const next = [];
    const covered = posesPerTick[t + 1];
    for (const node of layer) {
      if (node === goalIdx) {
        found = node * LANE_HORIZON + t;
        break;
      }
      const i = Math.floor(node / nz);
      const k = node % nz;
      for (let di = -1; di <= 1; di++) {
        for (let dk = -1; dk <= 1; dk++) {
          const ni = i + di;
          const nk = k + dk;
          if (ni < 1 || ni >= nx - 1 || nk < 1 || nk >= nz - 1) continue;
          if (!walk[at(ni, nk)]) continue;
          // No corner cutting: a diagonal step needs both orthogonal cells open.
          if (di && dk && (!walk[at(i + di, k)] || !walk[at(i, k + dk)])) continue;
          const nid = at(ni, nk);
          if (covered.has(nid)) continue;
          const key = nid * LANE_HORIZON + (t + 1);
          if (seen[key]) continue;
          seen[key] = 1;
          prev[key] = node * LANE_HORIZON + t;
          next.push(nid);
        }
      }
    }
    layer = next;
  }
  if (found < 0) found = bestNode >= 0 ? bestNode : -1;
  if (found < 0) return null;
  // Walk the plan back out, then turn it into waypoints.
  const path = [];
  let cur = found;
  while (cur >= 0) {
    const cellIdx = Math.floor(cur / LANE_HORIZON);
    const i = Math.floor(cellIdx / nz);
    const k = cellIdx % nz;
    path.push(centre(i, k));
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

/** Path to a world point, stepped one waypoint ahead of the nearest one. */
function followPath(from, to) {
  const a = snap(...Object.values(toGrid(from.x, from.z)));
  const b = snap(...Object.values(toGrid(to.x, to.z)));
  if (!a || !b) return null;
  const path = findPath(a, b);
  if (!path) return null;
  let near = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.hypot(path[i].x - from.x, path[i].z - from.z);
    if (d < bestD) {
      bestD = d;
      near = i;
    }
  }
  // Take the furthest point along the path that is still on a clear straight
  // line, so a chase does not walk the bot straight into a wall corner the
  // 1 m grid said was fine. If not even the next cell is clear, slide.
  for (let i = Math.min(path.length - 1, near + 6); i > near; i--) {
    if (lineClear(from.x, from.z, path[i].x, path[i].z)) return path[i];
  }
  const direct = path[Math.min(path.length - 1, near + 1)];
  for (const turn of [0.6, -0.6, 1.2, -1.2]) {
    const base = Math.atan2(direct.x - from.x, direct.z - from.z) + turn;
    const x = from.x + Math.sin(base) * 1.4;
    const z = from.z + Math.cos(base) * 1.4;
    if (lineClear(from.x, from.z, x, z)) return { x, z };
  }
  return direct;
}

/**
 * A cell the hunter cannot see, at least its own sight radius away, reachable
 * without crossing the hunter. Scored by how much cover and distance it buys,
 * and by how little running it costs.
 */
function pickEscapeSpot(hunter, CURRENT) {
  const headY = 1.7;
  let best = null;
  let bestScore = -Infinity;
  for (let gx = 2; gx < W - 2; gx += 2) {
    for (let gz = 2; gz < H - 2; gz += 2) {
      if (!walkable[idx(gx, gz)]) continue;
      const c = toWorld(gx, gz);
      const range = Math.hypot(c.x - hunter.x, c.z - hunter.z);
      if (range < (hunter.def.sight || 12) + 2) continue;
      if (hasLineOfSight(hunter.x, 1.62, hunter.z, c.x, headY, c.z, boxes)) continue;
      const fromPlayer = Math.hypot(c.x - CURRENT.x, c.z - CURRENT.z);
      if (fromPlayer > 26) continue;
      // Only spots the bot can actually run to in a straight line: an escape
      // spot behind a parked car is not an escape, it is a corner to be caught
      // in, which is what happened against the lane's vehicles.
      if (!lineClear(CURRENT.x, CURRENT.z, c.x, c.z)) continue;
      // Do not run across the hunter's face to get there.
      const hx = hunter.x - CURRENT.x;
      const hz = hunter.z - CURRENT.z;
      const dx = c.x - CURRENT.x;
      const dz = c.z - CURRENT.z;
      const t = Math.max(0, Math.min(1, (hx * dx + hz * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(CURRENT.x + dx * t - hunter.x, CURRENT.z + dz * t - hunter.z) < 3.5) continue;
      // Prefer the nearest spot that qualifies: a sprint halfway across the
      // district kills the run on time as surely as being seen does.
      const score = Math.min(range, 22) - fromPlayer * 1.6;
      if (score > bestScore) {
        bestScore = score;
        best = { x: c.x, z: c.z };
      }
    }
  }
  return best;
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
  let stuckWindow = 0;
  let creepHold = 0;
  let fleeSpot = null;
  let hipWanted = null;
  let hopWanted = null;
  let waypoint = null;
  let hopAge = 0;
  let lanePlanPath = null;
  let lanePlanAt = 0;
  let lanePlanIdx = 0;
  let lanePlanDirty = false;
  let lanePlanCooldown = 0;
  let lagTime = 0;
  let fleeTimer = 0;
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
      if (trace) console.log(`  out of patience on ${wp.id} at ${p.x.toFixed(1)},${p.z.toFixed(1)} d=${dGoal.toFixed(1)} after ${legTime.toFixed(0)}s`);
      wi++;
      sub = null;
      legTime = 0;
      legBudget = 0;
      bestLegDist = Infinity;
      continue;
    }

    // In the lane, movement is chosen hop by hop: only into ground no cone will
    // sweep in the next couple of seconds. A lane with no such ground is a lane
    // to wait in, which is exactly what a player does at the corner of cover.
    if (!ghosts && inLane(p.x, p.z) && world.agents.length && world.phase !== PHASE.HUNT) {
      const laneGoal = wp.id === "lane" ? LEVEL.goal : wp;
      hopAge += dt;
      // The plan is a timed route: the index it is on is the step that belongs to
      // now. Keep it until it runs out, the bot has fallen well behind it, or it
      // is nearly exhausted. Re-planning every time a cone sweeps over a future
      // step would make the bot dither instead of walk; a failed plan backs off
      // for a second rather than being retried on every frame.
      const nowIdx = lanePlanPath
        ? Math.min(lanePlanPath.length - 1, Math.max(0, Math.floor((t - lanePlanAt) / LANE_TICK)))
        : 0;
      const lag = lanePlanPath ? Math.hypot(lanePlanPath[nowIdx].x - p.x, lanePlanPath[nowIdx].z - p.z) : Infinity;
      lagTime = lag > 2.5 ? lagTime + dt : 0;
      const nearEnd = lanePlanPath && lanePlanIdx >= lanePlanPath.length - 3;
      // The patrols are not actually deterministic: a collector that hears a
      // step or brushes a wall is a second off its forecast, and a plan made
      // against the old one walks into a cone. Compare the live position with
      // the forecast the plan used and re-plan when they have drifted apart.
      const drifted =
        lanePlanPath &&
        planFutures &&
        world.agents.some((a, ai) => {
          const pose = planFutures[ai]?.[nowIdx];
          return pose && Math.hypot(pose.x - a.x, pose.z - a.z) > 1.2;
        });
      if ((!lanePlanPath || lagTime > 1 || nearEnd || drifted) && t >= lanePlanCooldown) {
        const plan = lanePlan(world, p, laneGoal);
        lanePlanAt = t;
        lanePlanDirty = false;
        lanePlanPath = plan;
        lanePlanIdx = 0;
        lagTime = 0;
        lanePlanCooldown = t + (plan ? 0 : 1.0);
        if (trace) {
          if (plan) console.log(`  plan ${t.toFixed(1)}s at ${p.x.toFixed(1)},${p.z.toFixed(1)} -> ${plan.length} steps (${(plan.length * LANE_TICK).toFixed(0)}s) goal ${Math.hypot(p.x - laneGoal.x, p.z - laneGoal.z).toFixed(1)}`);
          else console.log(`  NO PLAN ${t.toFixed(1)}s at ${p.x.toFixed(1)},${p.z.toFixed(1)} goal ${Math.hypot(p.x - laneGoal.x, p.z - laneGoal.z).toFixed(1)}`);
        }
      }
      let hop = null;
      if (lanePlanPath) {
        lanePlanIdx = Math.min(lanePlanPath.length - 1, Math.max(0, Math.floor((t - lanePlanAt) / LANE_TICK)));
        hop = lanePlanPath[lanePlanIdx];
      }
      if (!hop) {
        // No timed plan: fall back to a single safe hop, and if even that is
        // impossible stay put and let the next frame try again.
        hop = pickHop(world, p, laneGoal, world.agents);
        if (!hop) {
          world.setInput({ moveX: 0, moveZ: 0, crouch: true, run: false });
          world.update(dt);
          t += dt;
          for (const e of world.drainEvents()) {
            if (e.type === "spotted") log.spotted++;
            if (e.type === "caught") {
              log.caught++;
              log.notes.push(`caught at ${t.toFixed(1)}s`);
            }
          }
          if (world.phase === PHASE.CAUGHT) break;
          continue;
        }
      }
      // Freeze rather than step into a cone that is about to sweep this ground.
      if (hop && Math.hypot(hop.x - p.x, hop.z - p.z) > 0.3) {
        const headY = p.feetY + 1.05;
        const near = world.boxesNear(hop.x, hop.z, 15);
        const aboutToBeSeen = world.agents.some((a) =>
          agentFuture(a, 4, 0.45).some((pose) => visibleFrom(a, pose, hop.x, hop.z, headY, near)),
        );
        if (aboutToBeSeen) hop = { x: p.x, z: p.z };
      }
      if (hop) {
        // Move at walking pace so stamina and noise stay in hand; run only when
        // the chosen ground is far enough that walking would miss the window.
        const d = Math.hypot(hop.x - p.x, hop.z - p.z);
        const move = d < 0.6 ? 0 : 1;
        world.setInput({ moveX: move, moveZ: 0, crouch: true, run: false });
        if (move) world.cameraYaw = Math.atan2(hop.x - p.x, hop.z - p.z);

      }
      world.update(dt);
      t += dt;
      for (const e of world.drainEvents()) {
        if (e.type === "spotted") log.spotted++;
        if (e.type === "errand") log.errands++;
        if (e.type === "caught") {
          log.caught++;
          log.notes.push(`caught at ${t.toFixed(1)}s`);
        }
        if (e.type === "drowned") log.drownings++;
        if (e.type === "carHit") log.hits++;
      }
      lastPos = { x: p.x, z: p.z };
      if (world.phase === PHASE.CAUGHT) break;
      continue;
    }

    // Cover: the lane is three cones deep with a pause at every waypoint, so the
    // way through it is crouched. A crouch cuts a collector's sight radius to
    // 55 %, and being hard to see is what lets the bot cross the open stretches
    // instead of being frozen at the mouth waiting for a cone that never leaves.
    const seenNow = world.agents.some((a) => a.seeing);
    const nearAgent = world.agents.some((a) => {
      if (a.state === "hunt" || a.state === "returning") return false;
      return Math.hypot(a.x - p.x, a.z - p.z) < 16;
    });
    // Hysteresis: once inside 16 m the bot keeps sneaking until it is 20 m clear,
    // otherwise it strides in, sprints at the edge and gets heard on the way.
    if (nearAgent) creepHold = 3;
    else if (creepHold > 0) creepHold -= dt;
    const creep = !ghosts && !seenNow && creepHold > 0;

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
      // A hunt ends when the hunter loses sight for 7.5 s and is still more than
      // 10 m away. Fleeing is therefore a search for a cell the hunter cannot
      // see, far enough off, not a wiggle away from it: a fan of local headings
      // pins the bot on a corner when every direction it samples is walled, and
      // standing still in a hunt is how it was getting caught.
      if (fleeTimer <= 0) {
        fleeSpot = pickEscapeSpot(nearestAgent, p);
        fleeTimer = 1.2;
      }
      fleeTimer -= dt;
      const nearBoxes = world.boxesNear(p.x, p.z, 3.5);
      let stepYaw = null;
      if (fleeSpot) {
        const fleeStep = followPath(p, fleeSpot);
        if (fleeStep) {
          const d = Math.hypot(fleeStep.x - p.x, fleeStep.z - p.z) || 1;
          const tryYaw = Math.atan2(fleeStep.x - p.x, fleeStep.z - p.z);
          // Only take the path heading if the next stride actually fits.
          if (bodyFree(p.x + Math.sin(tryYaw) * Math.min(d, 1.6), p.z + Math.cos(tryYaw) * Math.min(d, 1.6), nearBoxes)) {
            stepYaw = tryYaw;
          }
        }
        if (stepYaw === null) fleeSpot = null;
      }
      yaw = stepYaw === null ? slideAway(p, nearestAgent, nearBoxes) : stepYaw;
      run = true;
      crouch = false;
    } else if (watched && nearest < 6) {
      // Seen up close: crouch and keep going. Sprints are 9 m of noise and they
      // read as motion, which is exactly what turns a glimpse into a hunt — the
      // old branch bolted, and the collector caught it at 1.2 m every time.
      const away = Math.atan2(p.x - nearestAgent.x, p.z - nearestAgent.z);
      const goal = Math.atan2(aim.x - p.x, aim.z - p.z);
      yaw = goal + Math.atan2(Math.sin(away - goal), Math.cos(away - goal)) * 0.35;
      run = false;
      crouch = true;
    } else {
      yaw = Math.atan2(aim.x - p.x, aim.z - p.z);
      // Sprint on open ground; crouch when a cone is on us at range, which is
      // slower but silent, and silence is what stops the alarm.
      crouch = creep || (watched && nearest < 13);
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
    // Measured over half a second, not per frame: a crouched step moves 1.2 cm
    // a frame, which is slower than a per-frame 2 cm threshold and used to read
    // as standing still the whole time the bot was sneaking.
    if (stuckWindow < 0.5) {
      stuckWindow += dt;
    } else if (Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.35) {
      stuckWindow = 0;
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
      stuckWindow = 0;
      stuckTimer = 0;
      // Progress resets the patience counters: a long leg should not be
      // abandoned because of a few momentary snags along the way.
      legStalls = 0;
      noPathCount = 0;
    }
    if (stuckWindow >= 0.5) lastPos = { x: p.x, z: p.z };

    if (trace && t > nextTrace) {
      nextTrace = t + (world.phase === PHASE.HUNT ? 0.5 : 5);
      console.log(`  ${t.toFixed(0)}s -> ${wp.id} d=${dGoal.toFixed(1)} at ${p.x.toFixed(1)},${p.z.toFixed(1)} spd ${p.speed.toFixed(1)} ${world.phase} crouch=${p.crouch} nearest=${nearest.toFixed(1)} yaw=${(yaw ?? 0).toFixed(2)}`);
    }
    for (const e of world.drainEvents()) {
      if (e.type === "spotted") log.spotted++;
      if (e.type === "caught") {
        log.caught++;
        log.notes.push(`caught at ${t.toFixed(1)}s`);
      }
      if (e.type === "errand") log.errands++;
      if (trace && (e.type === "spotted" || e.type === "heard" || e.type === "escaped")) {
        console.log(`  ${e.type} at ${t.toFixed(1)}s pos ${p.x.toFixed(1)},${p.z.toFixed(1)} stance ${p.crouch ? "crouch" : "stand"} spd ${p.speed.toFixed(1)}`);
      }
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
