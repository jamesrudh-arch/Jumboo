// The simulation. No DOM, no WebGL, no audio: this module can be imported and
// stepped from a test runner, which is how the gameplay is verified here.
//
// Loop: get down the loading lane to Sade without being caught. Movement makes
// noise. Collectors patrol, hear noise and investigate; if they see you long
// enough the lane goes into hunt mode and you must break line of sight and get
// clear before they give up.

import {
  clamp,
  damp,
  dampAngle,
  dist2D,
  lerp,
  moveTowards,
  wrapAngle,
} from "./geom.js";
import {
  box,
  hasLineOfSight,
  resolveCircle,
  supportHeightAt,
} from "./collision.js";
import { Traffic, Crowd } from "./traffic.js";
import { waterAt, CITY, mulberry32 } from "./city.js";

export const PHASE = {
  BRIEFING: "briefing",
  PLAY: "play",
  HUNT: "hunt",
  CAUGHT: "caught",
  WON: "won",
};

export const STANCE = { STAND: "stand", CROUCH: "crouch" };

// Tuning lives here so it can be adjusted without touching behaviour code.
export const TUNING = {
  accel: 14, // m/s^2 toward target speed
  decel: 18,
  crouchBlend: 9, // stance change rate
  gravity: 18,
  runCost: 17, // stamina per second while running
  crouchCost: 2.5,
  staminaRegen: 13,
  staminaFloor: 0, // forced walk until it recovers past `staminaRecover`
  staminaRecover: 22,
  noiseInterval: 0.22,
  noise: { idle: 0, crouch: 1.5, walk: 4.4, run: 9.0 },
  step: { crouch: 2.6, walk: 3.2, run: 3.0 },
  sightRate: 1.25,
  suspicionAt: 0.34,
  huntLoseTime: 2.2,
  huntGiveUpDistance: 10.0,
  // A collector runs at 1.55x their patrol walk (~1.62 m/s) and the player
  // sprints at 3.4 m/s. Before this, pursuit was 2.05x walk (2.15 m/s) with a
  // hunt that never expired while the player was 10 m away, so once the alarm
  // went up the only ending was "caught". Now breaking line of sight and
  // running actually works, and standing still does not.
  huntSpeedScale: 1.55,
  huntGiveUpTime: 7.5,
  huntSearchScale: 1.15, // jogging to the last known position
  catchRadius: 1.2,
  interactTime: 1.15,
  resetDelay: 2.4,
  spottedPenalty: 200,
  baseScore: 1600,
  timePenaltyPerSecond: 5,
  // Hazards and the chaos director.
  drownTime: 0.85, // seconds under the surface before the water spits you out
  carKnockback: 9, // m/s imparted by a car strike
  carDownTime: 1.25, // seconds on the ground after being hit
  chaosInterval: [11, 22], // seconds between unpredictable events
  chaosMax: 6,
  // Street errands: optional objectives in the district. They exist so the map
  // has something to do in it beyond the one approved beat, and they pay score.
  errands: [
    { id: "powerbox", label: "Kill the block's power", x: -34, z: 26, radius: 2.4, points: 120, kind: "sabotage" },
    { id: "dropped-bag", label: "Recover the dropped bag", x: 62, z: -46, radius: 2.2, points: 90, kind: "recover" },
    { id: "witness", label: "Talk to the dockhand", x: -86, z: -104, radius: 2.4, points: 150, kind: "talk" },
  ],
};

function insetRect(r, pad) {
  return { x1: r.x1 + pad, x2: r.x2 - pad, z1: r.z1 + pad, z2: r.z2 - pad };
}

export class World {
  constructor(level, built = { boxes: [], platforms: [] }, options = {}) {
    this.level = level;
    this.patrolDefs = level.patrols;
    this.events = [];
    this.openBoxes = built.boxes || [];
    this.platforms = built.platforms || [];
    // The district is optional: without it this is exactly the old lane-only
    // build, which keeps the approved-beat tests valid.
    this.city = options.city || null;
    // The district's layout (and therefore its bounds) can live on either the
    // layout object or the built result; accept both so a headless run does not
    // have to guess.
    this.cityBuilt = options.cityBuilt || null;
    if (this.city && !this.city.bounds && this.cityBuilt && this.cityBuilt.bounds) {
      this.city = { ...this.city, bounds: this.cityBuilt.bounds };
    }
    this.tier = options.tier || null;
    // With a district the player can walk the whole map; without one the lane
    // keeps its own small bounds, which is what the approved-beat tests expect.
    this.bounds = this.city ? insetRect(this.city.bounds, 2) : level.bounds;
    this.traffic = this.city ? new Traffic(this.city, this.tier || { traffic: 8 }, { aggression: options.aggression }) : null;
    this.crowd = this.city ? new Crowd(this.city, (this.tier && this.tier.crowd) || 12, options.seed || 4242) : null;
    // Which box list the collision solver uses: district if present.
    if (this.city && Array.isArray(options.cityBoxes)) this.openBoxes = options.cityBoxes.concat(this.openBoxes);
    this.chaosRng = mulberry32(options.seed || 20261127);
    this.reset();
  }

  /** True when the player is standing over open water. */
  waterUnderfoot(x = this.player.x, z = this.player.z) {
    if (!this.city) return null;
    return waterAt(this.city, x, z);
  }

  get boxes() {
    return this.openBoxes;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (this.events.length > 64) this.events.shift();
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  reset() {
    const L = this.level;
    this.time = 0;
    this.phase = PHASE.BRIEFING;
    this.phaseTimer = 0;
    this.spottedCount = 0;
    this.huntCount = 0;
    this.talkedToWitness = false;
    this.interactProgress = 0;
    this.objective = "reach_witness";
    this.score = 0;
    this.rank = "";
    this.events = [];
    this.lastCheckpoint = L.checkpoints[0];
    this.cameraYaw = L.spawn.yaw;
    this.cameraPitch = 0.16;
    this.cameraDistance = 4.1;
    this.camera = { x: L.spawn.x, y: 1.9, z: L.spawn.z + 4, distance: 4.1 };

    const p = L.spawn;
    this.player = {
      x: p.x,
      z: p.z,
      feetY: 0,
      yaw: p.yaw,
      speed: 0,
      maxSpeed: 0,
      moving: false,
      stance: STANCE.STAND,
      crouch: 0,
      stamina: 100,
      exhausted: false,
      running: false,
      noise: 0,
      noiseTimer: 0,
      stepTimer: 0,
      falling: false,
    };

    this.input = {
      moveX: 0,
      moveZ: 0,
      lookX: 0,
      lookY: 0,
      run: false,
      crouch: false,
      interact: false,
    };

    this.agents = this.patrolDefs.map((def, index) => this.makeAgent(def, index));
    this.hunters = 0;
    this.suspicion = 0;
    // Hazard / chaos state.
    this.wetTimer = 0;
    this.knockdown = 0;
    this.knockX = 0;
    this.knockZ = 0;
    this.chaosTimer = this.chaosRng ? 6 + this.chaosRng() * 6 : Infinity;
    this.chaosEvents = [];
    this.hitsTaken = 0;
    this.drownings = 0;
    this.honks = 0;
    // Street errands reset with the run, and each is moved to clear walkable
    // ground: the authored points are only approximate, and a marker inside a
    // building is worse than no marker at all.
    this.errands = (this.city ? TUNING.errands : []).map((e) => {
      const spot = this.findErrandSpot(e.x, e.z);
      return { ...e, x: spot.x, z: spot.z, done: false, progress: 0 };
    });
    this.errandsDone = 0;
    this.errandPoints = 0;
  }

  /**
   * Nearest clear spot to (x, z) that is inside the map, not in water, not on
   * a road centre and not inside a solid box at waist height.
   */
  findErrandSpot(x, z) {
    const b = this.bounds || this.level.bounds;
    const blockers = this.cityBuilt ? this.cityBuilt.boxes : [];
    const clear = (px, pz) => {
      if (px < b.x1 + 3 || px > b.x2 - 3 || pz < b.z1 + 3 || pz > b.z2 - 3) return false;
      if (waterAt(this.city, px, pz)) return false;
      for (const q of blockers) {
        if (px > q.x1 - 0.9 && px < q.x2 + 0.9 && pz > q.z1 - 0.9 && pz < q.z2 + 0.9) {
          // Any solid that overlaps waist or head height blocks the spot; a
          // kerb or a road-paint decal does not.
          if (q.y0 < 1.7 && q.y1 > 0.3) return false;
        }
      }
      return true;
    };
    if (clear(x, z)) return { x, z };
    // Spiral outwards in 2 m steps until something is clear.
    for (let r = 2; r <= 26; r += 2) {
      for (let a = 0; a < 12; a++) {
        const px = x + Math.cos((a / 12) * Math.PI * 2) * r;
        const pz = z + Math.sin((a / 12) * Math.PI * 2) * r;
        if (clear(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  makeAgent(def, index) {
    const first = def.points[0];
    const next = def.points[1 % def.points.length];
    const yaw = Math.atan2(next.x - first.x, next.z - first.z);
    return {
      id: def.id,
      label: def.label,
      def,
      index,
      x: first.x,
      z: first.z,
      yaw,
      baseYaw: yaw,
      speed: def.speed,
      state: "patrol", // patrol | investigate | hunt | returning
      waypoint: 1 % def.points.length,
      pause: 0,
      scan: 0,
      awareness: 0,
      seeing: false,
      lastSeen: { x: 0, z: 0 },
      lostTimer: 0,
      investigateTimer: 0,
      target: { x: first.x, z: first.z },
      stepPhase: 0,
      idleTime: 0,
    };
  }

  start() {
    if (this.phase === PHASE.BRIEFING) {
      this.phase = PHASE.PLAY;
      this.emit("start");
    }
  }

  // ------------------------------------------------------------------ input
  setInput(patch) {
    Object.assign(this.input, patch);
  }

  /** Camera boom length, clamped so it never sits inside the player. */
  setCameraDistance(d) {
    this.cameraDistance = clamp(d, 1.6, 8.5);
  }

  look(dx, dy) {
    this.cameraYaw = wrapAngle(this.cameraYaw - dx);
    this.cameraPitch = clamp(this.cameraPitch + dy, -0.35, 0.95);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    dt = clamp(dt, 0, 0.05);
    if (this.phase === PHASE.BRIEFING) {
      this.updateCamera(dt);
      return;
    }
    if (this.phase === PHASE.CAUGHT || this.phase === PHASE.WON) {
      this.phaseTimer += dt;
      this.updateAgents(dt, true);
      this.updateCamera(dt);
      // A catch is a setback, not a dead end: after a short beat the slice puts
      // the player back at the last checkpoint with the patrols reset.
      if (this.phase === PHASE.CAUGHT && this.phaseTimer >= TUNING.resetDelay) {
        this.restartFromCheckpoint();
      }
      return;
    }
    this.time += dt;
    this.updatePlayer(dt);
    this.updateStreet(dt);
    this.updateAgents(dt, false);
    this.updateDetection(dt);
    this.updateObjective(dt);
    this.updateChaos(dt);
    this.updateCamera(dt);
    this.checkOutcome();
  }

  /**
   * Traffic, crowds and the hazards they create. Every event here is emitted so
   * the HUD, audio and the chaos director can react to it.
   */
  updateStreet(dt) {
    const p = this.player;

    // Traffic.
    if (this.traffic) {
      const carEvents = this.traffic.update(dt, p, this.agents);
      for (const e of carEvents) {
        if (e.type === "hit-by-car") {
          // Knock the player down and shove them clear of the wheels.
          this.knockdown = TUNING.carDownTime;
          this.knockX = (e.pushX || 0) * TUNING.carKnockback;
          this.knockZ = (e.pushZ || 0) * TUNING.carKnockback;
          this.hitsTaken += 1;
          p.stamina = Math.max(0, p.stamina - 22);
          // Being flattened is loud: the collectors notice.
          this.emit("hit-by-car", { x: e.x, z: e.z, kind: e.kind });
          this.startHuntNearest(e.x, e.z);
        } else if (e.type === "honk") {
          this.honks += 1;
          this.emit("honk", { x: e.x, z: e.z });
          this.hearSound(e.x, e.z, 18);
        }
      }
    }

    // Crowds.
    if (this.crowd) {
      const pedEvents = this.crowd.update(dt, this.traffic ? this.traffic.vehicles : []);
      for (const e of pedEvents) {
        if (e.type === "ped-panic") this.emit("panic", { x: e.x, z: e.z });
      }
    }

    // Water: the district's canal, harbour and pond are holes in the ground.
    const water = this.waterUnderfoot();
    // Any part of the body in the channel counts: walking off the wharf drops
    // you in even though the surface sits below street level.
    if (water && p.feetY < water.surfaceY + 1.6) {
      this.wetTimer += dt;
      // Swimming is not authored: being in the water costs you and spits you
      // back to the bank. This is documented in the README as a study limit.
      if (this.wetTimer > TUNING.drownTime) {
        this.drownings += 1;
        this.wetTimer = 0;
        this.emit("drowned", { x: p.x, z: p.z, kind: water.kind });
        this.respawn();
        return;
      }
    } else {
      this.wetTimer = Math.max(0, this.wetTimer - dt * 2);
    }

    // Knockdown recovery.
    if (this.knockdown > 0) {
      this.knockdown = Math.max(0, this.knockdown - dt);
      p.x += this.knockX * dt;
      p.z += this.knockZ * dt;
      this.knockX *= 1 - Math.min(1, dt * 6);
      this.knockZ *= 1 - Math.min(1, dt * 6);
      resolveCircle(p, this.level.player.radius, this.boxes, p.feetY, p.feetY + 1.8, 3, this.level.stepUp);
    }
  }

  /** Nearest collector reacts to a loud event at (x, z). */
  startHuntNearest(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const a of this.agents) {
      if (a.state === "hunt") continue;
      const d = dist2D(a.x, a.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best && bestD < 34) {
      best.target = { x, z };
      this.startHunt(best);
    }
  }

  /** A sound at a point: collectors within reach investigate it. */
  hearSound(x, z, radius) {
    for (const a of this.agents) {
      if (a.state === "hunt") continue;
      const d = dist2D(a.x, a.z, x, z);
      if (d < Math.min(radius, a.def.hearing * 1.8)) {
        a.state = "investigate";
        a.target = { x, z };
        a.investigateTimer = 0;
        this.emit("heard", { id: a.id });
      }
    }
  }

  // ------------------------------------------------------------ chaos
  /**
   * The chaos director. On a jittered timer it rolls one of a handful of
   * unpredictable street events. Every event is auditable in `chaosEvents` so a
   * chaotic run can still be explained after the fact.
   */
  updateChaos(dt) {
    if (!this.city) return;
    this.chaosTimer -= dt;
    if (this.chaosTimer > 0) return;
    const [minGap, maxGap] = TUNING.chaosInterval;
    this.chaosTimer = minGap + this.chaosRng() * (maxGap - minGap);

    const roll = this.chaosRng();
    const p = this.player;
    let event = null;
    if (roll < 0.24) event = this.chaosJam();
    else if (roll < 0.46) event = this.chaosSweep();
    else if (roll < 0.66) event = this.chaosPowerCut();
    else if (roll < 0.84) event = this.chaosDetour();
    else event = this.chaosCrowd();

    if (event) {
      this.chaosEvents.push({ ...event, time: this.time });
      if (this.chaosEvents.length > TUNING.chaosMax) this.chaosEvents.shift();
      this.emit("chaos", event);
      void p;
    }
  }

  chaosJam() {
    if (!this.traffic || !this.traffic.vehicles.length) return null;
    // Stop three cars in a row at the same place: a jam has to hold, and one
    // car pausing for a step reads as nothing at all.
    const v = this.traffic.vehicles[Math.floor(this.chaosRng() * this.traffic.vehicles.length)];
    const until = this.time + 6 + this.chaosRng() * 5;
    let held = 0;
    for (const other of this.traffic.vehicles) {
      if (Math.hypot(other.x - v.x, other.z - v.z) > 46) continue;
      other.jamUntil = until;
      other.speed = 0;
      held++;
    }
    return { kind: "jam", label: "Traffic jam", x: v.x, z: v.z, count: held };
  }

  chaosSweep() {
    if (!this.traffic) return null;
    // A car cuts across the avenue: give one a temporary aggressive speed and
    // a short horn so the player has to move.
    const v = this.traffic.vehicles[Math.floor(this.chaosRng() * this.traffic.vehicles.length)];
    if (!v) return null;
    v.speed = Math.min(v.spec.maxSpeed * 1.25, v.speed + 5);
    v.honk = 1.6;
    v.sweepUntil = this.time + 4;
    this.hearSound(v.x, v.z, 26);
    return { kind: "sweep", label: "A car cuts across", x: v.x, z: v.z };
  }

  chaosPowerCut() {
    // A block of the district loses its lamps: the street gets darker around
    // the player, which is the point (and it is a real stealth opportunity).
    const centreX = this.player.x + (this.chaosRng() - 0.5) * 60;
    const centreZ = this.player.z + (this.chaosRng() - 0.5) * 60;
    let hit = 0;
    if (this.cityBuilt && Array.isArray(this.cityBuilt.lamps)) {
      const radius = 26;
      this.powerCut = { x: centreX, z: centreZ, radius, until: this.time + 9 + this.chaosRng() * 6 };
      for (const l of this.cityBuilt.lamps) {
        if (Math.hypot(l.x - centreX, l.z - centreZ) > radius) continue;
        l.cutUntil = this.powerCut.until;
        hit++;
      }
    }
    if (!hit && this.level.lights && this.level.lights.length) {
      const light = this.level.lights[Math.floor(this.chaosRng() * this.level.lights.length)];
      light.flicker = 1.4 + this.chaosRng() * 2;
      return { kind: "power", label: "The lights stutter", x: light.x, z: light.z, count: 1 };
    }
    return { kind: "power", label: "The lights go out", x: centreX, z: centreZ, count: hit, radius: 26 };
  }

  chaosDetour() {
    // Send one collector off its route for a while.
    const a = this.agents[Math.floor(this.chaosRng() * this.agents.length)];
    if (!a) return null;
    a.waypoint = Math.floor(this.chaosRng() * a.def.points.length);
    a.pause = 0.2;
    return { kind: "detour", label: "A patrol changes up", x: a.x, z: a.z };
  }

  chaosCrowd() {
    if (!this.crowd || !this.crowd.people.length) return null;
    const person = this.crowd.people[Math.floor(this.chaosRng() * this.crowd.people.length)];
    person.panic = 1;
    person.yaw = this.chaosRng() * Math.PI * 2;
    return { kind: "panic", label: "Someone runs", x: person.x, z: person.z };
  }

  // ---------------------------------------------------------------- player
  updatePlayer(dt) {
    const L = this.level;
    const p = this.player;
    const P = L.player;

    // Stance
    const wantCrouch = this.input.crouch && !p.falling;
    p.stance = wantCrouch ? STANCE.CROUCH : STANCE.STAND;
    p.crouch = damp(p.crouch, wantCrouch ? 1 : 0, TUNING.crouchBlend, dt);

    // Desired direction, relative to the camera's yaw.
    let ix = this.input.moveX;
    let iz = this.input.moveZ;
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }
    const inputMag = Math.min(mag, 1);
    const cos = Math.cos(this.cameraYaw);
    const sin = Math.sin(this.cameraYaw);
    // Forward = (sin yaw, cos yaw); right = forward x up = (-cos yaw, sin yaw).
    const dx = -ix * cos + iz * sin;
    const dz = ix * sin + iz * cos;

    // Speed budget
    const staminaOk = p.stamina > 0.01 && !p.exhausted;
    const wantRun = this.input.run && staminaOk && !wantCrouch && inputMag > 0.2;
    let maxSpeed = wantCrouch ? L.crouchSpeed : wantRun ? L.runSpeed : L.walkSpeed;
    const targetSpeed = maxSpeed * inputMag;
    p.running = wantRun && inputMag > 0.2;

    // Stamina
    if (p.running) {
      p.stamina = Math.max(0, p.stamina - TUNING.runCost * dt);
    } else {
      p.stamina = Math.min(100, p.stamina + TUNING.staminaRegen * dt);
      if (p.exhausted && p.stamina >= TUNING.staminaRecover) {
        p.exhausted = false;
        this.emit("recovered");
      }
    }

    if (p.stamina <= 0.01 && !p.exhausted) {
      p.exhausted = true;
      this.emit("exhausted");
    }

    p.speed = moveTowards(
      p.speed,
      targetSpeed,
      (targetSpeed > p.speed ? TUNING.accel : TUNING.decel) * dt,
    );
    p.maxSpeed = maxSpeed;
    p.moving = p.speed > 0.06;

    if (inputMag > 0.05) {
      p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 11, dt);
    }

    // Horizontal movement with axis-separated resolution so the player slides
    // along walls rather than sticking.
    if (p.speed > 0.001) {
      const stepX = dx * p.speed * dt;
      const stepZ = dz * p.speed * dt;
      const headY = p.feetY + lerp(P.height, P.crouchHeight, p.crouch);
      const tryMove = (nx, nz) => {
        const candidate = { x: nx, z: nz };
        resolveCircle(candidate, P.radius, this.boxes, p.feetY, headY, 3, L.stepUp);
        const support = supportHeightAt(
          candidate.x,
          candidate.z,
          this.platforms,
          p.feetY,
          L.stepUp,
        );
        if (support > p.feetY + L.stepUp + 0.001) return false;
        p.x = candidate.x;
        p.z = candidate.z;
        return true;
      };
      if (!tryMove(p.x + stepX, p.z + stepZ)) {
        if (!tryMove(p.x + stepX, p.z)) tryMove(p.x, p.z + stepZ);
        else {
          // Moved on X only; try Z separately for corner sliding.
          tryMove(p.x, p.z + stepZ);
        }
      }
      p.x = clamp(p.x, this.bounds.x1, this.bounds.x2);
      p.z = clamp(p.z, this.bounds.z1, this.bounds.z2);
    }

    // Vertical: platforms and the dock lip. Open water has no ground, so the
    // support there is the bed: walking off the wharf drops you in.
    const water = this.waterUnderfoot();
    const support = water
      ? water.bedY
      : supportHeightAt(p.x, p.z, this.platforms, p.feetY, L.stepUp);
    if (p.feetY > support + 0.02) {
      p.falling = true;
      p.velocityY = (p.velocityY ?? 0) - TUNING.gravity * dt;
      p.feetY += p.velocityY * dt;
      if (p.feetY <= support) {
        if (p.velocityY < -3.2) this.emit("land", { impact: -p.velocityY });
        p.feetY = support;
        p.velocityY = 0;
        p.falling = false;
      }
    } else if (p.feetY < support) {
      p.feetY = moveTowards(p.feetY, support, 6 * dt);
      p.velocityY = 0;
      p.falling = false;
    } else {
      p.feetY = support;
      p.velocityY = 0;
      p.falling = false;
    }

    // Noise: stance and speed decide how far it carries.
    const base =
      p.speed < 0.08
        ? TUNING.noise.idle
        : p.running
          ? TUNING.noise.run
          : p.crouch > 0.5
            ? TUNING.noise.crouch
            : TUNING.noise.walk;
    const landing = p.falling ? 1.35 : 1;
    p.noise = base * landing;
    p.noiseTimer -= dt;
    if (p.noise > 0.2 && p.noiseTimer <= 0) {
      p.noiseTimer = TUNING.noiseInterval;
      this.emit("noise", { x: p.x, z: p.z, radius: p.noise });
    }
    // Footstep cadence for audio and head-bob.
    if (p.moving) {
      const rate = p.running ? TUNING.step.run : p.crouch > 0.5 ? TUNING.step.crouch : TUNING.step.walk;
      p.stepTimer += dt * rate * clamp(p.speed / Math.max(maxSpeed, 0.001), 0.35, 1.2);
      if (p.stepTimer >= 0.5) {
        p.stepTimer -= 0.5;
        this.emit("step", { x: p.x, z: p.z, running: p.running, crouch: p.crouch > 0.5 });
      }
    } else {
      p.stepTimer = 0;
    }
  }

  // ---------------------------------------------------------------- agents
  updateAgents(dt, frozen) {
    for (const a of this.agents) {
      if (a.state === "hunt" && !frozen) {
        this.updateHunter(a, dt);
        continue;
      }
      if (frozen) continue;
      if (a.state === "investigate") {
        this.updateInvestigator(a, dt);
        continue;
      }
      this.updatePatrol(a, dt);
    }
  }

  updatePatrol(a, dt) {
    const def = a.def;
    const target = def.points[a.waypoint];
    if (a.pause > 0) {
      a.pause -= dt;
      a.idleTime += dt;
      a.scan += dt;
      a.yaw = a.baseYaw + Math.sin(a.scan * 0.85) * 0.62;
      a.stepPhase += dt * 1.4;
      return;
    }
    const d = dist2D(a.x, a.z, target.x, target.z);
    if (d < 0.22) {
      a.waypoint = (a.waypoint + 1) % def.points.length;
      a.pause = def.pauseAt;
      a.baseYaw = a.yaw;
      return;
    }
    const yaw = Math.atan2(target.x - a.x, target.z - a.z);
    a.yaw = dampAngle(a.yaw, yaw, 4.5, dt);
    a.baseYaw = a.yaw;
    this.moveAgent(a, yaw, a.speed, dt);
  }

  updateInvestigator(a, dt) {
    const d = dist2D(a.x, a.z, a.target.x, a.target.z);
    a.investigateTimer += dt;
    if (d > 0.6 && a.investigateTimer < 9) {
      const yaw = Math.atan2(a.target.x - a.x, a.target.z - a.z);
      a.yaw = dampAngle(a.yaw, yaw, 5.5, dt);
      a.baseYaw = a.yaw;
      this.moveAgent(a, yaw, a.speed * 1.18, dt);
      return;
    }
    // Look around at the point of interest, then resume the route.
    a.yaw = a.baseYaw + Math.sin(a.investigateTimer * 1.15) * 0.8;
    if (a.investigateTimer > 3.0) {
      a.state = "returning";
      a.waypoint = this.nearestWaypoint(a);
      a.investigateTimer = 0;
    }
  }

  nearestWaypoint(a) {
    let best = 0;
    let bestD = Infinity;
    a.def.points.forEach((p, i) => {
      const d = dist2D(a.x, a.z, p.x, p.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  updateHunter(a, dt) {
    const p = this.player;
    const d = dist2D(a.x, a.z, p.x, p.z);
    a.awareness = 1;
    if (a.seeing && d < 14) {
      a.lastSeen.x = p.x;
      a.lastSeen.z = p.z;
      a.lostTimer = 0;
    } else {
      a.lostTimer += dt;
    }
    const goal = a.lastSeen;
    const gd = dist2D(a.x, a.z, goal.x, goal.z);
    if (gd > 0.7) {
      const yaw = Math.atan2(goal.x - a.x, goal.z - a.z);
      a.yaw = dampAngle(a.yaw, yaw, 7, dt);
      a.baseYaw = a.yaw;
      // Closing on a visible player is a sprint; searching the last known spot
      // is a jog. That gap is what lets a player who breaks line of sight and
      // keeps moving actually get away.
      const chase = a.seeing ? TUNING.huntSpeedScale : TUNING.huntSearchScale;
      this.moveAgent(a, yaw, a.speed * chase, dt);
    } else {
      a.yaw += dt * 1.9;
    }
    const lost =
      a.lostTimer > TUNING.huntLoseTime &&
      dist2D(a.x, a.z, p.x, p.z) > TUNING.huntGiveUpDistance;
    // A chase is a chase, not a life sentence: a collector who has not seen
    // the player for a while gives up and goes back to the patrol.
    const blocked =
      a.lostTimer > TUNING.huntLoseTime + TUNING.huntGiveUpTime; // never chase forever
    if (lost || blocked) {
      a.state = "returning";
      a.awareness = 0;
      a.waypoint = this.nearestWaypoint(a);
      a.investigateTimer = 0;
      this.emit("hunter-gave-up", { id: a.id });
    }
  }

  moveAgent(a, yaw, speed, dt) {
    const nx = a.x + Math.sin(yaw) * speed * dt;
    const nz = a.z + Math.cos(yaw) * speed * dt;
    const candidate = { x: nx, z: nz };
    const before = { x: nx, z: nz };
    resolveCircle(candidate, 0.34, this.boxes, 0, 1.8);
    // If collision pushed us far off the intended spot, treat it as reaching
    // the waypoint so a blocked route cannot deadlock a patrol.
    if (Math.hypot(candidate.x - before.x, candidate.z - before.z) > 0.2) {
      a.stuck = (a.stuck ?? 0) + dt;
      if (a.stuck > 1.2) {
        a.waypoint = (a.waypoint + 1) % a.def.points.length;
        a.stuck = 0;
      }
    } else {
      a.stuck = 0;
    }
    a.x = candidate.x;
    a.z = candidate.z;
    a.stepPhase += speed * dt * 3.2;
    a.idleTime = 0;
  }

  // ------------------------------------------------------------- detection
  // Detection targets the player's head, so cover works the way a player
  // expects: duck until your head is below the crate and you are hidden.
  playerHeadY() {
    const p = this.player;
    return p.feetY + lerp(1.7, 1.05, p.crouch);
  }

  agentEyeY(a) {
    return 1.62;
  }

  canSee(a) {
    const p = this.player;
    const def = a.def;
    const chest = { x: p.x, z: p.z };
    const d = dist2D(a.x, a.z, chest.x, chest.z);
    if (p.feetY > 2.6) return { visible: false, d, sight: 0 };
    const sight = def.sight * (0.55 + 0.45 * (1 - p.crouch));
    if (d > sight) return { visible: false, d, sight };
    const toPlayer = Math.atan2(chest.x - a.x, chest.z - a.z);
    const halfFov = def.fov + (a.state === "hunt" ? 0.35 : 0);
    if (Math.abs(wrapAngle(toPlayer - a.yaw)) > halfFov) {
      return { visible: false, d, sight, angle: true };
    }
    const eyeY = this.agentEyeY(a);
    const clear = hasLineOfSight(
      a.x,
      eyeY,
      a.z,
      p.x,
      this.playerHeadY(),
      p.z,
      this.boxes,
    );
    return { visible: clear, d, sight };
  }

  updateDetection(dt) {
    const p = this.player;
    const P = this.level.player;
    // Noise: loud movement carries. A crouch (1.5) is quieter than a collector
    // can hear at any distance, a walk (4.4) carries a few metres, and a sprint
    // (9.0) is heard right across the lane. Previously every footstep beat
    // `hearing` (7 m), so walking anywhere near a collector pulled them onto
    // the player no matter what cover was used.
    for (const a of this.agents) {
      if (a.state === "hunt") continue;
      if (p.noise > 0.2) {
        const hearRange = a.def.hearing * (a.state === "investigate" ? 0.7 : 1);
        const d = dist2D(a.x, a.z, p.x, p.z);
        if (d < hearRange && d < p.noise * 1.15 && a.state !== "investigate") {
          a.state = "investigate";
          a.target = { x: p.x, z: p.z };
          a.investigateTimer = 0;
          this.emit("heard", { id: a.id });
        }
      }
    }

    let maxAwareness = 0;
    let seeingAny = false;
    for (const a of this.agents) {
      if (a.state === "hunt") {
        a.seeing = this.canSee(a).visible;
        maxAwareness = 1;
        continue;
      }
      const seen = this.canSee(a);
      a.seeing = seen.visible;
      if (seen.visible) {
        seeingAny = true;
        const closeness = clamp(1 - (seen.d / Math.max(seen.sight, 0.01)) * 0.62, 0.3, 1);
        const stanceFactor = lerp(1.0, 0.52, p.crouch);
        const motionFactor = p.speed < 0.1 ? 0.55 : p.running ? 1.3 : 1.0;
        const rate = TUNING.sightRate * closeness * stanceFactor * motionFactor;
        const before = a.awareness;
        a.awareness = clamp(a.awareness + rate * dt, 0, 1);
        if (before < TUNING.suspicionAt && a.awareness >= TUNING.suspicionAt) {
          this.emit("suspicion", { id: a.id });
        }
        if (a.awareness >= 1) {
          this.startHunt(a);
        }
        // Suspicious collectors stop and watch, which makes their intent legible.
        if (a.awareness > TUNING.suspicionAt && a.state === "patrol") {
          a.pause = Math.max(a.pause, 0.25);
          const toPlayer = Math.atan2(p.x - a.x, p.z - a.z);
          a.baseYaw = toPlayer;
          a.yaw = dampAngle(a.yaw, toPlayer, 4.0, dt);
        }
      } else {
        const decay = a.state === "investigate" ? 0.55 : 0.32;
        a.awareness = Math.max(0, a.awareness - decay * dt);
      }
      maxAwareness = Math.max(maxAwareness, a.awareness);
    }
    this.suspicion = maxAwareness;
    this.seeingAny = seeingAny;

    // Catch: a hunter in reach ends the attempt.
    if (this.phase !== PHASE.WON) {
      for (const a of this.agents) {
        if (a.state === "hunt" && dist2D(a.x, a.z, p.x, p.z) < TUNING.catchRadius) {
          this.caught(a);
          return;
        }
      }
    }

    if (this.phase === PHASE.HUNT) {
      const anyHunt = this.agents.some((a) => a.state === "hunt");
      if (!anyHunt) {
        this.phase = PHASE.PLAY;
        this.emit("escaped");
      }
    }
  }

  startHunt(a) {
    if (this.phase === PHASE.HUNT && a.state === "hunt") return;
    a.state = "hunt";
    a.lostTimer = 0;
    a.lastSeen = { x: this.player.x, z: this.player.z };
    if (this.phase !== PHASE.HUNT) {
      this.phase = PHASE.HUNT;
      this.huntCount += 1;
      this.spottedCount += 1;
      this.emit("spotted", { id: a.id });
    }
  }

  caught(agent) {
    if (this.phase === PHASE.CAUGHT) return;
    this.phase = PHASE.CAUGHT;
    this.phaseTimer = 0;
    this.caughtBy = agent ? agent.id : "";
    this.emit("caught", { id: this.caughtBy });
    this.finaliseScore();
  }

  // ------------------------------------------------------------- objective
  updateObjective(dt) {
    const p = this.player;
    const L = this.level;
    const w = L.witness;
    const inWitness = dist2D(p.x, p.z, w.x, w.z) < w.radius;

    if (this.objective === "reach_witness") {
      if (inWitness) {
        if (this.input.interact) {
          const before = this.interactProgress;
          this.interactProgress = Math.min(1, this.interactProgress + dt / TUNING.interactTime);
          if (before === 0) this.emit("interact-start");
          if (this.interactProgress >= 1 && !this.talkedToWitness) {
            this.talkedToWitness = true;
            this.objective = "reach_lane";
            this.interactProgress = 0;
            this.emit("talked", { speaker: "Sade" });
          }
        } else if (this.interactProgress > 0) {
          this.interactProgress = Math.max(0, this.interactProgress - dt * 1.6);
        }
      } else if (this.interactProgress > 0) {
        this.interactProgress = Math.max(0, this.interactProgress - dt * 2.4);
      }
    } else if (this.objective === "reach_lane") {
      const g = L.goal;
      if (dist2D(p.x, p.z, g.x, g.z) < g.radius) {
        this.win();
      }
    }
    this.inWitnessZone = inWitness;
    this.updateErrands(dt);
  }

  /**
   * Street errands. One at a time, by proximity: stand in the marker and hold
   * interact. They are optional, they are loud or quiet depending on the kind,
   * and they pay into the score.
   */
  updateErrands(dt) {
    if (!this.errands || !this.errands.length) return;
    const p = this.player;
    let nearest = null;
    let nearestD = Infinity;
    for (const e of this.errands) {
      if (e.done) continue;
      const d = dist2D(p.x, p.z, e.x, e.z);
      if (d < e.radius + 0.4 && d < nearestD) {
        nearest = e;
        nearestD = d;
      }
      if (d > e.radius + 0.4 && e.progress > 0) e.progress = Math.max(0, e.progress - dt * 2);
    }
    this.activeErrand = nearest;
    if (!nearest) return;
    if (this.input.interact) {
      nearest.progress = Math.min(1, nearest.progress + dt / TUNING.interactTime);
      if (nearest.progress >= 1) {
        nearest.done = true;
        nearest.progress = 1;
        this.errandsDone += 1;
        this.errandPoints += nearest.points;
        this.emit("errand", { id: nearest.id, label: nearest.label, kind: nearest.kind, points: nearest.points });
        // A sabotage kill is loud; a quiet recovery is not.
        if (nearest.kind === "sabotage") {
          this.hearSound(nearest.x, nearest.z, 34);
          if (this.cityBuilt) {
            for (const l of this.cityBuilt.lamps || []) {
              if (Math.hypot(l.x - nearest.x, l.z - nearest.z) < 30) l.cutUntil = this.time + 20;
            }
            this.powerCut = { x: nearest.x, z: nearest.z, radius: 30, until: this.time + 20 };
          }
        }
      }
    } else if (nearest.progress > 0) {
      nearest.progress = Math.max(0, nearest.progress - dt * 1.6);
    }
  }

  win() {
    if (this.phase === PHASE.WON || this.phase === PHASE.CAUGHT) return;
    this.phase = PHASE.WON;
    this.phaseTimer = 0;
    this.emit("won");
    this.finaliseScore();
  }

  finaliseScore() {
    const timePenalty = Math.floor(this.time * TUNING.timePenaltyPerSecond);
    const spotPenalty = this.spottedCount * TUNING.spottedPenalty;
    this.score = Math.max(100, TUNING.baseScore - timePenalty - spotPenalty + (this.errandPoints || 0));
    if (this.phase === PHASE.CAUGHT) this.score = Math.max(50, Math.floor(this.score * 0.25));
    const s = this.score;
    this.rank = s >= 1300 ? "S" : s >= 1050 ? "A" : s >= 800 ? "B" : s >= 550 ? "C" : "D";
  }

  checkOutcome() {
    if (this.phase === PHASE.CAUGHT) return;
    const p = this.player;
    // Falling off the world would be a level bug; recover to the checkpoint.
    if (p.feetY < -14) this.respawn();
  }

  /** Rebuild the run from the last checkpoint after being caught. */
  restartFromCheckpoint() {
    const L = this.level;
    const c = this.lastCheckpoint;
    this.time = 0;
    this.phase = PHASE.PLAY;
    this.phaseTimer = 0;
    this.suspicion = 0;
    this.hunters = 0;
    this.interactProgress = 0;
    this.caughtBy = "";
    const p = this.player;
    p.x = c.x;
    p.z = c.z;
    p.feetY = 0;
    p.yaw = L.spawn.yaw;
    p.speed = 0;
    p.maxSpeed = 0;
    p.moving = false;
    p.stance = STANCE.STAND;
    p.crouch = 0;
    p.stamina = 100;
    p.exhausted = false;
    p.running = false;
    p.noise = 0;
    p.falling = false;
    this.cameraYaw = L.spawn.yaw;
    this.camera.x = c.x;
    this.camera.z = c.z + 4;
    this.agents = this.patrolDefs.map((def, index) => this.makeAgent(def, index));
    this.emit("restart");
  }

  respawn() {
    const c = this.lastCheckpoint;
    const p = this.player;
    p.x = c.x;
    p.z = c.z;
    p.feetY = 0;
    p.speed = 0;
    p.velocityY = 0;
    this.cameraYaw = this.level.spawn.yaw;
    this.emit("respawn");
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const p = this.player;
    const P = this.level.player;
    const eyeY = p.feetY + lerp(P.eye, P.crouchEye, p.crouch);
    const focus = { x: p.x, y: eyeY - 0.12, z: p.z };

    const pitch = this.cameraPitch;
    const yaw = this.cameraYaw;
    const back = this.cameraDistance * Math.cos(pitch);
    const desired = {
      x: p.x - Math.sin(yaw) * back,
      y: focus.y + 0.55 + this.cameraDistance * Math.sin(pitch) * 0.9,
      z: p.z - Math.cos(yaw) * back,
    };

    // Keep the camera out of walls: shorten the boom if the segment is blocked.
    let allowed = 1;
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const sx = lerp(focus.x, desired.x, t);
      const sz = lerp(focus.z, desired.z, t);
      const sy = lerp(focus.y, desired.y, t);
      let blocked = false;
      for (const b of this.boxes) {
        if (b.tag === "floor") continue;
        if (sx > b.x1 - 0.12 && sx < b.x2 + 0.12 && sz > b.z1 - 0.12 && sz < b.z2 + 0.12 && sy > b.y0 - 0.1 && sy < b.y1 + 0.1) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        allowed = Math.max(0.18, t - 1 / steps);
        break;
      }
    }

    // Never collapse the boom into the character's head: when cover forces the
    // camera in, hold a minimum distance and lift it instead, so crouching
    // behind a dumpster does not fill the screen with the back of a jacket.
    const minAllowed = Math.min(1, 1.15 / this.cameraDistance);
    if (allowed < minAllowed) {
      allowed = minAllowed;
      focus.y += 0.28;
    }
    const target = {
      x: lerp(focus.x, desired.x, allowed),
      y: lerp(focus.y, desired.y, allowed),
      z: lerp(focus.z, desired.z, allowed),
    };
    this.camera.distance = allowed * this.cameraDistance;
    const rate = allowed < 0.999 ? 26 : 9;
    this.camera.x = damp(this.camera.x, target.x, rate, dt);
    this.camera.y = damp(this.camera.y, target.y, rate, dt);
    this.camera.z = damp(this.camera.z, target.z, rate, dt);
    this.camera.y = Math.max(this.camera.y, p.feetY + 0.35);
    this.cameraFocus = focus;
  }

  // ------------------------------------------------------------------- hud
  hud() {
    const p = this.player;
    const L = this.level;
    const toTarget =
      this.objective === "reach_witness"
        ? L.witness
        : L.goal;
    const dx = toTarget.x - p.x;
    const dz = toTarget.z - p.z;
    return {
      phase: this.phase,
      objective: this.objective,
      objectiveLabel:
        this.objective === "reach_witness" ? "Reach Sade" : "Take the loading lane",
      distance: Math.hypot(dx, dz),
      bearing: wrapAngle(Math.atan2(dx, dz) - this.cameraYaw),
      suspicion: this.suspicion,
      seeing: !!this.seeingAny,
      stamina: p.stamina,
      exhausted: p.exhausted,
      crouch: p.crouch,
      running: p.running,
      noise: p.noise,
      interactProgress: this.interactProgress,
      inWitnessZone: !!this.inWitnessZone,
      time: this.time,
      spotted: this.spottedCount,
      score: this.score,
      rank: this.rank,
      phaseTimer: this.phaseTimer,
      // Street errands: the HUD shows the nearest live one and the tally.
      errand: this.activeErrand
        ? { label: this.activeErrand.label, progress: this.activeErrand.progress, points: this.activeErrand.points }
        : null,
      errandsDone: this.errandsDone || 0,
      errandsTotal: this.errands ? this.errands.length : 0,
      errandPoints: this.errandPoints || 0,
    };
  }
}

/** Build a world plus its collision set for a level definition. */
export function createWorld(level, buildLevelFn, options = {}) {
  const built = buildLevelFn();
  const world = new World(level, { ...options, openBoxes: built.boxes });
  world.geometry = built;
  return world;
}
