// The encounter director.
//
// Currently bodies spawn on a ring around the player and walk at them until
// either side stops moving. That produces a fight, but every fight is the same
// shape: a wall of bodies arriving from every direction at once, which is chaos
// without rhythm. Chaos with rhythm is what makes an action game feel authored.
//
// The director's job is to spend a **pressure budget** over time instead of
// releasing everything at once. It has three levers:
//
//  1. **Intensity** — how much pressure is allowed at any moment, as a number of
//     "threat points". A Pack is 1, a Runner is 2, a Brute is 6.
//  2. **Arrival** — where bodies come from. Instead of a ring, they come from
//     places that make sense: alley mouths, the canal path, behind a parked van.
//     A body that arrives from a direction the player can predict can be planned
//     against, which is what makes cover and positioning matter.
//  3. **Breath** — the deliberate gaps. A director that never lets up is
//     exhausting; one that eases off after a hard push lets the player feel the
//     win and reload.
//
// Everything here is deterministic given a seed, because a wave has to be
// reproducible (the house rule forbids Math.random in the sim).

import { mulberry32 } from "./geom.js";

/** Threat value per archetype. Not health: a Watcher that calls is worth more
 * than its 60 hit points, because it turns one body into an ambush. */
export const THREAT = {
  pack: 1,
  runner: 2,
  flyer: 2,
  watcher: 3,
  sniper: 4,
  brute: 6,
  heavy: 5,
  boss_enforcer: 20,
  boss_marksman: 18,
  boss_warden: 26,
};

/** How a wave's pressure should behave. */
export const PACE = {
  /** Steady build. The default: something is always arriving, nothing floods. */
  PRESSURE: "pressure",
  /** A hard push then a real pause. Used before a story beat. */
  ASSAULT: "assault",
  /** Almost nothing, so the player can look around and listen. */
  BREATH: "breath",
  /** A single body, isolated, for teaching a weapon. */
  SPOTLIGHT: "spotlight",
};

const PROFILE = {
  [PACE.PRESSURE]: { budget: 7, pace: 1.0, breathAfter: 0 },
  [PACE.ASSAULT]: { budget: 12, pace: 1.6, breathAfter: 4.5 },
  [PACE.BREATH]: { budget: 2, pace: 0.45, breathAfter: 0 },
  [PACE.SPOTLIGHT]: { budget: 3, pace: 0.7, breathAfter: 2.5 },
};

/**
 * A director for one encounter.
 *
 * `queue` is the bodies left to send, as archetype names. The director releases
 * them as budget allows, and reports which spawn points it used.
 */
export class EncounterDirector {
  constructor({ queue = [], pace = PACE.PRESSURE, seed = 0x51ee7, spawns = [] } = {}) {
    this.queue = [...queue];
    this.pace = pace;
    this.profile = PROFILE[pace] ?? PROFILE[PACE.PRESSURE];
    this.rand = mulberry32(seed);
    this.spawns = spawns;
    this.elapsed = 0;
    // The budget available now, ramping in rather than starting full: the first
    // two seconds of a wave should be a warning, not a wall.
    this.ramp = 0;
    this.breath = 0;
    this.sent = 0;
    this.lastSpawnAt = -99;
  }

  /** Pressure currently on the field, from the caller's live bodies. */
  onField(bodies = []) {
    let total = 0;
    for (const b of bodies) {
      if (b.dead) continue;
      total += THREAT[b.stats?.archetype] ?? 1;
    }
    return total;
  }

  get remaining() {
    return this.queue.length;
  }

  get done() {
    return this.queue.length === 0;
  }

  /**
   * Advance the director. Returns an array of spawn requests this frame:
   * `{ archetype, spawn }`.
   *
   * `bodies` is the live array, read only for its current pressure.
   */
  tick(dt, bodies = []) {
    this.elapsed += dt;
    const out = [];
    if (this.breath > 0) {
      this.breath -= dt;
      return out;
    }
    // The ramp: full budget after ~3 s, so the opening is readable.
    this.ramp = Math.min(1, this.ramp + dt / 3);

    // A minimum gap between arrivals, so a burst never lands on one frame.
    const gap = 0.35 / Math.max(0.2, this.profile.pace);
    if (this.elapsed - this.lastSpawnAt < gap) return out;

    // Nothing arrives for the first half second. The old check allowed one body
    // of overshoot at every step, which meant the ramp did nothing at all: a
    // body could be released against a budget of 0.039.
    if (this.ramp < 0.15) return out;

    const budget = this.profile.budget * this.ramp;
    let pressure = this.onField(bodies);
    while (pressure < budget && this.queue.length) {
      const archetype = this.queue[0];
      const cost = THREAT[archetype] ?? 1;
      // Strict: something that would overshoot the budget waits its turn. A Brute
      // against a small budget is not shoved in, it arrives once there is room.
      if (pressure + cost > budget) break;
      this.queue.shift();
      const spawn = this._pickSpawn();
      out.push({ archetype, spawn });
      this.sent += 1;
      pressure += cost;
    }
    if (out.length) this.lastSpawnAt = this.elapsed;

    // Breath after a full release, if this profile has any.
    if (!this.queue.length && this.profile.breathAfter > 0 && bodies.every((b) => b.dead)) {
      this.breath = this.profile.breathAfter;
    }
    return out;
  }

  /**
   * Choose where the next body comes from.
   *
   * Deterministic, but not the same point twice in a row: a director that always
   * uses spawn 0 is a predictable funnel. Rotating through the list with a seeded
   * jitter keeps it varied without being random across runs.
   */
  _pickSpawn() {
    if (!this.spawns.length) return null;
    const n = this.spawns.length;
    const base = this.sent % n;
    const jitter = Math.floor(this.rand() * n) % n;
    return this.spawns[(base + jitter) % n];
  }
}

/**
 * Spawn points that make sense, derived from the city rather than a ring.
 *
 * Alley mouths and canal-side paths are the natural "someone comes round the
 * corner" places. Passing these to the director replaces the ring with something
 * a player can learn.
 */
export function spawnPointsFromCity(city, { maxDistance = 40, minDistance = 12 } = {}) {
  const out = [];
  if (!city) return out;
  for (const road of city.roads ?? []) {
    if (road.kind !== "alley") continue;
    out.push({ x: (road.x1 + road.x2) / 2, z: road.z1, kind: "alley" });
    out.push({ x: (road.x1 + road.x2) / 2, z: road.z2, kind: "alley" });
  }
  // The canal bank is the other way in: the water is a wall to you and a path to
  // anyone who does not mind getting wet.
  for (const w of city.water ?? []) {
    if (w.kind !== "canal") continue;
    for (let x = -100; x <= 100; x += 46) {
      out.push({ x, z: w.z2 + 2.5, kind: "canal" });
    }
  }
  void maxDistance; void minDistance;
  return out;
}

/**
 * How many threat points a wave should spend, by its number.
 *
 * This replaces the current model, which scales health. Scaling health makes a
 * fight longer; scaling pressure makes it harder, and makes the player's tools
 * matter more because there is more to do at once.
 */
export function budgetForWave(n) {
  // Linear to wave 10, then a gentler slope, so a replay lap is harder but not
  // impossible. 6 points is a small skirmish; 30 is a street war.
  return Math.round(n <= 10 ? 4 + n * 2.2 : 26 + (n - 10) * 1.1);
}
