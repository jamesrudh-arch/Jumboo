// Combat, wired together.
//
// Everything below this file is a rule, a table, a state machine or a mesh. This
// is where a trigger pull becomes: a cooldown spent, a hit resolved against
// armour and range, a noise that pulls the street toward you, a body that
// flinches, a camera that kicks, a phone that buzzes and a sound that plays.
//
// It is deliberately not inside main.js. main.js owns the DOM, the renderer and
// the frame loop; a combat loop that lives there can only be tested in a
// browser, and there is no browser here. This class talks to four interfaces —
// world, enemies, feel, audio — and all four can be faked, so a full firefight
// can be simulated in Node in microseconds.

import { weaponById, resolveHit, MODE } from "./arsenal.js";
import { statLine, ARCHETYPES } from "./enemies.js";

/** Aim assist: how generous the hit test is, in metres, per weapon mode. */
const AIM_SLOP = {
  [MODE.MELEE]: 0.9,
  [MODE.SIDEARM]: 0.55,
  [MODE.AUTO]: 0.8,
  [MODE.SPREAD]: 1.1,
  [MODE.SCOPE]: 0.3,
  [MODE.HEAVY]: 0.9,
  [MODE.THROWN]: 0.7,
};

/**
 * How far off-centre a target may be before a use cannot reach it, as a half
 * angle in radians. There is no free aim in this game — the player faces where
 * they look — so this is the whole of "aiming", and it has to be generous
 * enough to feel like intent and tight enough that facing away means missing.
 *
 * 60 degrees is a 120-degree arc in front: roughly the width of the view, so
 * what is on screen is what can be hit. Aim-down-sights halves it.
 */
const AIM_CONE = 1.05;
const AIM_CONE_AIMED = 0.52;

/**
 * The cone widens to a near half-circle at contact range.
 *
 * Without this, a body 60 degrees off centre at 0.65 m is unhittable — which
 * means standing next to a spider and being unable to kick it. Aim is what makes
 * a rifle feel like a rifle; at arm's length there is nothing to aim.
 */
export function coneFor(weapon, distance, aiming = false) {
  const base = aiming ? AIM_CONE_AIMED : AIM_CONE;
  // An absolute contact radius, not a fraction of reach: "beside me" means the
  // same distance with a knife as with a rifle, and capping at 1.9 m keeps a
  // long weapon from getting a near-hemisphere of forgiveness at 20 m.
  const contact = Math.min(1.9, weapon.reach);
  const taperEnd = contact * 3;
  if (distance <= contact) return POINT_BLANK;
  if (distance >= taperEnd) return base;
  const t = (distance - contact) / (taperEnd - contact);
  return POINT_BLANK + (base - POINT_BLANK) * t;
}

const POINT_BLANK = 2.6;

/**
 * How far above or below the player's eye a weapon can still be pointed, in
 * metres. Melee is a body-length; a sidearm can be raised at a flyer; a scoped
 * weapon is steadied and has less play.
 */
const VERTICAL_REACH = {
  [MODE.MELEE]: 1.4,
  [MODE.SIDEARM]: 3.4,
  [MODE.AUTO]: 3.0,
  [MODE.SPREAD]: 2.6,
  [MODE.SCOPE]: 4.0,
  [MODE.HEAVY]: 4.0,
  [MODE.THROWN]: 3.5,
};

/**
 * The bridge between a held weapon and the bodies in the street.
 *
 * The contract with `world` is deliberately loose — it needs `player` with
 * `{x, z, yaw, feetY}`, a `drainEvents()` and an `emit(type, data)` — because
 * the world is the existing stealth simulation and combat is an addition to it,
 * not a replacement. Anything missing degrades to a no-op.
 */
export class Combat {
  constructor({ world, run, enemies, feel, audio = null, onEvent = null } = {}) {
    this.world = world;
    this.run = run;
    this.enemies = enemies; // an EnemyWave
    this.feel = feel;
    this.audio = audio;
    this.onEvent = onEvent;

    this.aiming = false;
    this.tracer = [];
    this.damageLog = [];
    this.hits = 0;
    this.misses = 0;
    this.quietKills = 0;
    this.lastTarget = null;
    // Per-body hit counts, so armour degradation is per target rather than a
    // global counter that a player could farm on one body and spend on another.
    this.priorHits = new WeakMap();
  }

  get loadout() {
    return this.run.loadout;
  }

  /** Nearest body in front of the player, within the weapon's reach. */
  findTarget(weapon, { requireAim = false } = {}) {
    const p = this.world.player;
    if (!p || !this.enemies) return null;
    const reach = weapon.reach + (AIM_SLOP[weapon.mode] ?? 0.6);
    let best = null;
    let bestScore = Infinity;
    for (const e of this.enemies.live) {
      if (e.dead) continue;
      const dx = e.root.position.x - p.x;
      const dz = e.root.position.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach) continue;
      // Vertical reach: a flyer 3 m up cannot be punched, and a launcher does
      // not care because it splashes.
      const dy = (e.root.position.y + e.height * 0.5) - (p.feetY + 1.1);
      if (Math.abs(dy) > (VERTICAL_REACH[weapon.mode] ?? 3)) continue;
      // Angle to the body centre against the player's facing. Forward is -Z in
      // this simulation, which is the same convention the camera uses.
      const facing = -p.yaw;
      const angle = Math.abs(angleDelta(Math.atan2(dx, dz) + Math.PI, facing));
      const cone = coneFor(weapon, dist, requireAim || this.aiming);
      if (angle > cone) continue;
      // Prefer close and centred.
      const score = dist / reach + angle * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  /**
   * Pull the trigger. Returns a result describing what happened, so the caller
   * (and the HUD, and the tests) can see it.
   */
  fire(dt = 0) {
    const L = this.loadout;
    L.tick(dt);
    const use = L.use(dt);
    if (!use) return null;
    const weapon = use.weapon;

    if (use.dry) {
      this.feel?.haptics.fire("pistol", 0.15);
      this.emitAudio("dry-fire", { x: this.world.player.x, z: this.world.player.z });
      this.onEvent?.({ type: "dry", weapon: weapon.id });
      return { weapon, dry: true };
    }

    const target = this.findTarget(weapon);
    let result = { weapon, target: target?.stats.archetype ?? null, hit: null, killed: false };

    if (weapon.mode === MODE.MELEE) {
      this.feel?.shake.add(0.06);
    }

    if (target) {
      const p = this.world.player;
      const dist = Math.hypot(target.root.position.x - p.x, target.root.position.z - p.z);
      const prior = this.priorHits.get(target) ?? 0;
      const hit = resolveHit(weapon, {
        armour: target.stats.armour ?? 0,
        distance: dist,
        priorHits: prior,
      });
      this.priorHits.set(target, prior + 1);
      result.hit = hit;
      result.distance = dist;

      if (hit.hit) {
        this.hits += 1;
        // Spread and splash: every body near the target takes a share, which is
        // what makes a shotgun feel like a shotgun in a corridor.
        const splash = weapon.splash ?? (weapon.mode === MODE.SPREAD ? 1.4 : 0);
        const collateral = [];
        if (splash > 0) {
          for (const other of this.enemies.live) {
            if (other === target || other.dead) continue;
            const d = Math.hypot(
              other.root.position.x - target.root.position.x,
              other.root.position.z - target.root.position.z,
            );
            if (d <= splash) collateral.push({ enemy: other, falloff: 1 - d / Math.max(splash, 0.01) });
          }
        }

        const verdict = this.enemies.damage(target, hit.damage);
        result.killed = verdict === "killed";
        for (const c of collateral) {
          const share = Math.round(hit.damage * 0.55 * c.falloff);
          if (share > 0) this.enemies.damage(c.enemy, share);
        }

        this.feel?.onUse(weapon, { hit: { damage: hit.damage, armoured: (target.stats.armour ?? 0) > 0.4 } });
        this.emitAudio("hit", {
          x: target.root.position.x,
          z: target.root.position.z,
          armoured: (target.stats.armour ?? 0) > 0.4,
        });

        if (result.killed) {
          // A body falling is the confirmation a fight is over. Silent deaths
          // made kills feel like the enemy simply stopped existing.
          this.emitAudio("death", {
            x: target.root.position.x,
            z: target.root.position.z,
            armoured: (target.stats.armour ?? 0) > 0.4,
          });
          const quiet = weapon.noise <= 4;
          this.run.registerKill({ quiet, archetype: target.stats.archetype });
          if (quiet) this.quietKills += 1;
          if (weapon.splash && weapon.splash >= 4) {
            this.feel?.onBlast(0);
            this.emitAudio("explosion", { x: target.root.position.x, z: target.root.position.z });
          }
        }
      } else {
        this.misses += 1;
        this.feel?.onUse(weapon, { hit: null });
      }
    } else {
      this.misses += 1;
      // A miss still costs the street its silence.
      this.feel?.onUse(weapon, { hit: null });
    }

    // Noise is the bridge back into stealth: a shot is a loud event the existing
    // simulation already knows how to react to.
    if (weapon.noise > 0) {
      const p = this.world.player;
      this.world.emit?.("shot", { x: p.x, z: p.z, sound: weapon.sound, radius: weapon.noise });
      this.world.hearSound?.(p.x, p.z, weapon.noise);
      this.emitAudio("shot", { x: p.x, z: p.z, sound: weapon.sound });
    } else if (weapon.mode === MODE.MELEE) {
      this.emitAudio("swing", { x: this.world.player.x, z: this.world.player.z, sound: weapon.sound });
    }

    this.onEvent?.({ type: "fire", ...result, dry: false });
    this.lastTarget = target;
    return result;
  }

  /** Reload the held weapon, then tell the player how it went. */
  reload() {
    const moved = this.loadout.reload();
    if (moved > 0) this.emitAudio("reload", { x: this.world.player.x, z: this.world.player.z });
    this.onEvent?.({ type: "reload", moved });
    return moved;
  }

  /** Cycle the arsenal. Returns the new weapon id. */
  cycle(direction = 1) {
    const id = this.loadout.cycle(direction);
    if (id === "fists") this.emitAudio("swing", { x: this.world.player.x, z: this.world.player.z });
    this.onEvent?.({ type: "select", id });
    return id;
  }

  select(id) {
    const got = this.loadout.select(id);
    this.onEvent?.({ type: "select", id: got });
    return got;
  }

  emitAudio(type, data) {
    if (this.audio?.playEvent) {
      this.audio.playEvent({ type, ...data }, this.world.player);
      return;
    }
    // No mixer: the event still reaches the world, so a headless run can assert
    // on sounds it cannot hear.
    this.world.emit?.("audio", { type, ...data });
  }

  /** Everything the HUD needs, in one object. */
  hud() {
    const snap = this.run.snapshot();
    return {
      ...snap,
      crosshair: this.loadout.weapon.mode !== MODE.MELEE,
      aiming: this.aiming,
      accuracy: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : null,
    };
  }
}

/** Shortest signed angle between two headings, in radians. */
export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Spawn placement for a wave: bodies arrive around the player but never inside
 * their view, because an enemy that pops into existence on screen reads as a bug
 * and one that arrives behind you reads as an ambush.
 */
export function spawnPoints(world, count, { minDistance = 9, maxDistance = 18, forwardCone = 1.1 } = {}) {
  const p = world.player;
  const facing = -p.yaw;
  const points = [];
  // Deterministic ring placement: evenly spaced, then rotated by a fixed offset
  // so a wave is reproducible from its number alone.
  const offset = 0.618 * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const slice = (i / Math.max(1, count)) * Math.PI * 2;
    let angle = facing + Math.PI + slice + offset;
    // Keep everyone out of the forward cone.
    if (Math.abs(angleDelta(angle, facing)) < forwardCone) angle += Math.PI * 0.6;
    const dist = minDistance + ((i * 37) % 100) / 100 * (maxDistance - minDistance);
    points.push({
      x: p.x + Math.sin(angle) * dist,
      z: p.z + Math.cos(angle) * dist,
      yaw: angle,
    });
  }
  return points;
}

/** Convenience: a stat line for a wave body, ready to hand to the factory. */
export function bodyFor(archetype, scale = 1) {
  return statLine(archetype, scale);
}

export { ARCHETYPES, weaponById };
