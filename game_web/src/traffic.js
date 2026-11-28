// Traffic and crowds.
//
// Vehicles drive closed routes on the district's roads, brake for anything in
// front of them (the player, each other, a stopped car), and knock the player
// down on contact. Pedestrian crowds wander the sidewalks and scatter when a
// car is near. Pure simulation: no renderer, no DOM, so it can be tested.
//
// This is the "chaotic and unpredictable" layer: a route can jam, a car can
// cut across the avenue, and the resulting noise is real (it feeds the same
// noise/alert values the collectors already use).

import { clamp, dist2D } from "./geom.js";

const CAR = {
  sedan: { len: 4.4, wid: 1.9, height: 1.45, maxSpeed: 12.5, accel: 5.2, mass: 1.0 },
  van: { len: 5.6, wid: 2.1, height: 2.25, maxSpeed: 11.0, accel: 4.4, mass: 1.6 },
  truck: { len: 7.8, wid: 2.5, height: 3.05, maxSpeed: 9.5, accel: 3.6, mass: 3.2 },
};

export const VEHICLE_SPEC = CAR;

/**
 * A vehicle driving a closed route.
 * Route points are in metres; the car keeps to the right of the path.
 */
export class Vehicle {
  constructor(route, index, kind, tone, seed = 0) {
    this.route = route;
    this.index = index;
    this.kind = kind;
    this.spec = CAR[kind] || CAR.sedan;
    this.tone = tone;
    this.seed = seed;
    this.leg = 0;
    this.t = (index / Math.max(1, route.points.length)) * 0.5;
    this.x = route.points[0].x;
    this.z = route.points[0].z;
    this.speed = this.spec.maxSpeed * 0.6;
    this.yaw = 0;
    this.braking = false;
    this.honk = 0;
    this.stuckFor = 0;
    this.damage = 0;
    this.hitCooldown = 0;
  }

  get length() {
    return this.spec.len;
  }
}

/** Point and heading a given distance along a closed polyline. */
function sampleRoute(points, distance) {
  let remaining = distance;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = dist2D(a.x, a.z, b.x, b.z);
    if (remaining <= len || len < 1e-6) {
      const t = len < 1e-6 ? 0 : remaining / len;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: Math.atan2(b.x - a.x, b.z - a.z),
        leg: i,
        legLen: len,
      };
    }
    remaining -= len;
  }
  const a = points[0];
  return { x: a.x, z: a.z, yaw: 0, leg: 0, legLen: 1 };
}

function routeLength(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += dist2D(a.x, a.z, b.x, b.z);
  }
  return total;
}

/**
 * Traffic manager. Owns vehicles, updates them, and reports contacts with the
 * player through `world.emit("hit-by-car")`.
 */
export class Traffic {
  constructor(city, tier = { traffic: 10 }, options = {}) {
    this.city = city;
    this.routes = city.trafficRoutes || [];
    this.routes.forEach((r) => {
      r.length = routeLength(r.points);
    });
    this.vehicles = [];
    this.aggression = options.aggression ?? 0.5;
    this.spawn(tier.traffic ?? 10);
  }

  spawn(count) {
    if (!this.routes.length) return;
    const kinds = ["sedan", "sedan", "van", "truck"];
    for (let i = 0; i < count; i++) {
      const route = this.routes[i % this.routes.length];
      const kind = kinds[i % kinds.length];
      const v = new Vehicle(route, i, kind, (i * 0.37) % 1, i * 77 + 13);
      // Spread cars around the loop so they do not start in a queue.
      v.distance = (route.length / Math.max(1, count / this.routes.length)) * Math.floor(i / this.routes.length);
      const p = sampleRoute(route.points, v.distance);
      v.x = p.x;
      v.z = p.z;
      v.yaw = p.yaw;
      this.vehicles.push(v);
    }
  }

  /** Distance along a vehicle's route, wrapped to its length. */
  advanceDistance(v, dx) {
    const len = v.route.length || 1;
    v.distance = ((v.distance + dx) % len + len) % len;
    return sampleRoute(v.route.points, v.distance);
  }

  /**
   * One fixed step. `player` is the world's player object (or null).
   * Returns events worth surfacing: hits, honks, jams.
   */
  update(dt, player, agents = []) {
    if (!Array.isArray(agents)) agents = [];
    const events = [];
    for (const v of this.vehicles) {
      v.hitCooldown = Math.max(0, v.hitCooldown - dt);

      // Look ahead: brake for the player, for pedestrians and for other cars.
      const ahead = this.obstacleAhead(v, player, agents);
      const targetSpeed = ahead.blocked ? Math.max(0, ahead.speedCap) : v.spec.maxSpeed;
      const braking = targetSpeed < v.speed - 0.05;
      v.braking = braking;
      const rate = braking ? v.spec.accel * 2.2 : v.spec.accel;
      if (v.speed < targetSpeed) v.speed = Math.min(targetSpeed, v.speed + rate * dt);
      else v.speed = Math.max(targetSpeed, v.speed - rate * 1.6 * dt);

      // A fully stopped car honks once, then waits.
      if (v.speed < 0.25) {
        v.stuckFor += dt;
        if (v.stuckFor > 1.4 && v.honk <= 0) {
          v.honk = 2.2;
          events.push({ type: "honk", x: v.x, z: v.z, radius: 26 });
        }
      } else {
        v.stuckFor = 0;
      }
      v.honk = Math.max(0, v.honk - dt);

      const p = this.advanceDistance(v, v.speed * dt);
      v.x = p.x;
      v.z = p.z;
      v.yaw = p.yaw;
      v.leg = p.leg;
      v.speedNow = v.speed;

      // Contact with the player: knock them down unless they are on a kerb.
      if (player && v.hitCooldown <= 0 && v.speed > 1.2) {
        const halfLen = v.spec.len / 2 + 0.45;
        const halfWid = v.spec.wid / 2 + 0.4;
        const dx = player.x - v.x;
        const dz = player.z - v.z;
        const c = Math.cos(v.yaw);
        const s = Math.sin(v.yaw);
        // Vehicle space: +z is forward along yaw.
        const localZ = dx * s + dz * c;
        const localX = dx * c - dz * s;
        const reach = Math.abs(player.feetY) < 1.2;
        if (reach && Math.abs(localZ) < halfLen && Math.abs(localX) < halfWid) {
          v.hitCooldown = 2.4;
          v.damage += 1;
          events.push({
            type: "hit-by-car",
            x: v.x,
            z: v.z,
            yaw: v.yaw,
            speed: v.speed,
            kind: v.kind,
            pushX: Math.sign(localX || 1) * Math.cos(v.yaw),
            pushZ: -Math.sign(localX || 1) * Math.sin(v.yaw),
          });
        }
      }
    }
    return events;
  }

  /** Nearest blocking thing in front of a vehicle, within a braking window. */
  obstacleAhead(v, player, agents) {
    const look = 3.5 + v.speed * 0.9;
    const s = Math.sin(v.yaw);
    const c = Math.cos(v.yaw);
    let best = { blocked: false, speedCap: v.spec.maxSpeed };

    const consider = (x, z, radius, hardStop, extra = 0) => {
      const dx = x - v.x;
      const dz = z - v.z;
      const ahead2 = dx * s + dz * c;
      const lateral = Math.abs(dx * c - dz * s);
      if (ahead2 <= 0 || ahead2 > look + extra) return;
      if (lateral > v.spec.wid / 2 + radius) return;
      // Aim to stop just short of the obstacle.
      // A pedestrian only forces a slow-down, not a 40 cm-per-second creep;
      // otherwise a crowded street brings every car to a permanent standstill.
      // A pedestrian only forces a slow-down, never a full standstill, or a
      // crowded pavement brings the whole street to a permanent halt.
      const allowed = hardStop
        ? Math.max(0, (ahead2 - radius - v.spec.len / 2) * 0.9)
        : Math.max(2.2, (ahead2 - radius - v.spec.len / 2) * 0.9);
      if (hardStop) {
        best = { blocked: true, speedCap: Math.min(best.speedCap, allowed + 0.3) };
      } else {
        best = { blocked: true, speedCap: Math.min(best.speedCap, allowed) };
      }
    };

    if (player) consider(player.x, player.z, 0.45, true);
    for (const a of agents) consider(a.x, a.z, 0.4, true);
    for (const other of this.vehicles) {
      if (other === v) continue;
      // Only cars ahead on roughly the same heading share a lane.
      const sameWay = Math.cos(other.yaw - v.yaw) > 0.6;
      if (sameWay) consider(other.x, other.z, other.spec.wid / 2 + 0.8, false, other.spec.len);
    }
    return best;
  }

  /** Nearest vehicle to a point, for audio/visual cueing. */
  nearest(px, pz) {
    let best = null;
    let bestD = Infinity;
    for (const v of this.vehicles) {
      const d = dist2D(px, pz, v.x, v.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best ? { vehicle: best, distance: bestD } : null;
  }
}

// ------------------------------------------------------------------ crowds

const CROWD_HOME_RADIUS = 14;

/** True when a point is on a road surface rather than its pavement. */
function isRoadMiddle(city, x, z) {
  for (const r of city.roads) {
    if (r.kind === "alley") continue;
    // The pavement band is 2.2 m wide on each side; deeper than that is road.
    if (x > r.x1 + 0.4 && x < r.x2 - 0.4 && z > r.z1 + 0.4 && z < r.z2 - 0.4) return true;
  }
  return false;
}

/** Pedestrians on the sidewalk grid, scattering from cars. */
export class Crowd {
  constructor(city, count = 14, seed = 991) {
    this.city = city;
    this.people = [];
    let s = seed;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const walks = city.roads.filter((r) => r.kind !== "alley");
    let guard = 0;
    while (this.people.length < count && guard++ < count * 40) {
      const road = walks[Math.floor(rand() * walks.length)];
      const along = road.x2 - road.x1 > road.z2 - road.z1;
      const x = along ? road.x1 + rand() * (road.x2 - road.x1) : rand() < 0.5 ? road.x1 - 1.6 : road.x2 + 1.6;
      const z = along ? (rand() < 0.5 ? road.z1 - 1.6 : road.z2 + 1.6) : road.z1 + rand() * (road.z2 - road.z1);
      this.people.push({
        id: `ped-${this.people.length}`,
        x,
        z,
        home: { x, z },
        yaw: rand() * Math.PI * 2,
        speed: 0.7 + rand() * 0.6,
        pause: rand() * 2,
        panic: 0,
        stride: rand() * 10,
        tone: rand(),
        walkPhase: 0,
      });
    }
    this._rand = rand;
  }

  /** Deterministic RNG shared by the crowd update. */
  rand() {
    this._seed = ((this._seed ?? 12345) * 1664525 + 1013904223) >>> 0;
    return this._seed / 4294967296;
  }

  /**
   * Scare everyone within `radius` of a point. Cars, gunfire, a shouted
   * collector and a failing street lamp all use this one entry point.
   */
  scare(x, z, radius = 9, cause = "noise") {
    const hit = [];
    for (const p of this.people) {
      const d = dist2D(x, z, p.x, p.z);
      if (d > radius) continue;
      p.panic = Math.min(1, 0.55 + (1 - d / radius) * 0.45);
      // Flee roughly away from the source, with a bias so a crowd fans out.
      p.yaw = Math.atan2(p.x - x, p.z - z) + (this.rand() - 0.5) * 0.8;
      p.pause = 0;
      p.cause = cause;
      hit.push(p);
    }
    return hit;
  }

  update(dt, vehicles) {
    const events = [];
    for (const p of this.people) {
      // Panic decays and is refreshed by nearby fast cars.
      p.panic = Math.max(0, p.panic - dt * 0.7);
      for (const v of vehicles) {
        const d = dist2D(p.x, p.z, v.x, v.z);
        if (d < 7 && v.speed > 3) {
          p.panic = 1;
          const away = Math.atan2(p.x - v.x, p.z - v.z);
          p.yaw = away;
          p.x += Math.sin(away) * dt * 4.2;
          p.z += Math.cos(away) * dt * 4.2;
          events.push({ type: "ped-panic", x: p.x, z: p.z });
          break;
        }
      }
      if (p.panic > 0.1) {
        // Fleeing has to actually move: this used to bump the walk animation
        // and continue, so a terrified crowd ran on the spot.
        const run = 1.5 + p.panic * 2.3;
        p.x += Math.sin(p.yaw) * run * dt;
        p.z += Math.cos(p.yaw) * run * dt;
        p.walkPhase += dt * 11;
        continue;
      }
      if (p.pause > 0) {
        p.pause -= dt;
        continue;
      }
      // Wander near home, turning occasionally. A scared pedestrian ignores
      // the leash: fleeing is allowed to leave the home radius.
      const fleeing = p.panic > 0.15;
      const dx = p.home.x - p.x;
      const dz = p.home.z - p.z;
      if (!fleeing && Math.hypot(dx, dz) > CROWD_HOME_RADIUS) {
        p.yaw = Math.atan2(dx, dz);
      } else if (!fleeing && this.rand() < dt * 0.35) {
        p.yaw += (this.rand() - 0.5) * 1.8;
      }
      const panicSpeed = p.panic > 0 ? 1 + p.panic * 1.6 : 1;
      const stepX = Math.sin(p.yaw) * p.speed * panicSpeed * dt;
      const stepZ = Math.cos(p.yaw) * p.speed * panicSpeed * dt;
      // Pedestrians keep to the pavement: if the next step lands in the middle
      // of a road (outside an alley they are already crossing) they turn away.
      if (!fleeing && !p.crossing && isRoadMiddle(this.city, p.x + stepX, p.z + stepZ)) {
        p.yaw += Math.PI * 0.5;
        p.walkPhase += dt * 2;
        continue;
      }
      p.x += stepX;
      p.z += stepZ;
      p.walkPhase += dt * p.speed * 7;
      if (this.rand() < dt * 0.12) p.pause = 0.8 + this.rand() * 2.4;
    }
    return events;
  }
}

/** Clamp helper re-exported so callers do not import two maths modules. */
export { clamp };
