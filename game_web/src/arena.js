// The arena: the bridge between the existing street slice and the new combat
// layers. Everything before this file is a rule or a mesh. This is the piece
// that puts bodies in the street, moves them, lets them hit the player, and
// takes the player's shots back out into the scene.
//
// It is a class with an explicit `attach(scene)` because the browser is the only
// place it can run: it needs the renderer, the camera and the loaded character.
// The simulation inside it, though, is plain numbers — `spawn`, `step`, `fire`
// and `damage` are all testable with a fake scene, which is how the wave logic
// is checked in Node while the rendering is checked by hand.

import * as THREE from "../vendor/three/three.module.js";
import { Combat, spawnPoints } from "./combat.js";
import { EnemyFactory, EnemyWave } from "./enemyview.js";
import { CombatFeel } from "./feel.js";
import { Loadout } from "./arsenal.js";
import { Run, tierForWave } from "./progression.js";
import { ARCHETYPES, statLine } from "./enemies.js";

/**
 * What a body's attack is worth against the player, as a fraction of its
 * outbound power. The arsenal's numbers are tuned so enemies die fast enough to
 * be readable; the same numbers aimed at the player are brutal. One factor keeps
 * both honest without two tables drifting apart.
 */
const INCOMING = 0.42;

/** How an archetype moves once it has decided to come for you. */
const BEHAVIOUR = {
  watcher: { approach: 0.0, standoff: 14, attackRange: 0 },
  runner: { approach: 1.0, standoff: 0.9, attackRange: 1.6 },
  brute: { approach: 1.0, standoff: 1.6, attackRange: 2.0 },
  flyer: { approach: 1.0, standoff: 5, attackRange: 14, hover: true },
  pack: { approach: 1.0, standoff: 0.7, attackRange: 1.3 },
  heavy: { approach: 0.7, standoff: 11, attackRange: 22 },
  sniper: { approach: 0.0, standoff: 26, attackRange: 45 },
};

export class Arena {
  constructor({ audio = null, feel = null } = {}) {
    this.factory = new EnemyFactory();
    this.wave = new EnemyWave({ factory: this.factory });
    this.run = new Run();
    this.combat = null;
    this.feel = feel ?? new CombatFeel();
    this.audio = audio;
    this.scene = null;
    this.animationClock = 0; // feeds the idle sway so it never looks frozen
    this.inWave = false;
    this.waveTimer = 0;
    this.playerHitCooldown = 0;
    this.stats = { shots: 0, hits: 0, kills: 0, damageTaken: 0 };
    this.handlers = { onWaveStart: null, onWaveEnd: null, onDeath: null };
  }

  /** Load every model the roster names. Called once, from the loading screen. */
  async preload(onProgress) {
    const factoryStats = await this.factory.preload(ARCHETYPES, onProgress);
    const weaponRack = await import("./weaponview.js");
    this.WeaponRack = weaponRack.WeaponRack;
    this.MuzzleFlash = weaponRack.MuzzleFlash;
    return factoryStats;
  }

  /** Attach to the renderer's scene and to the world the player lives in. */
  attach(scene, world) {
    this.scene = scene;
    this.world = world;
    this.combat = new Combat({
      world,
      run: this.run,
      enemies: this.wave,
      feel: this.feel,
      audio: this.audio,
      onEvent: (e) => {
        if (e.type === "fire") this.stats.shots += 1;
        if (e.type === "select") this.onSelect?.(e.id);
      },
    });
    this.wave.onKill = (enemy) => {
      this.stats.kills += 1;
      this.feel.shake.add(0.12);
    };
    return this;
  }

  /**
   * Begin the next wave. Bodies are placed on a ring behind the player so they
   * arrive rather than appear, and the terrain height is sampled so nothing
   * spawns inside a wall or in the canal.
   */
  startWave() {
    const { wave, enemies } = this.run.beginWave();
    const points = spawnPoints(this.world, enemies.length);
    const placement = [];
    for (let i = 0; i < enemies.length; i++) {
      const p = points[i % points.length];
      const ground = this.world.groundAt ? this.world.groundAt(p.x, p.z) : 0;
      placement.push({ ...enemies[i], x: p.x, z: p.z, y: ground + (enemies[i].flyHeight ?? 0), yaw: p.yaw });
    }
    this.wave.spawnAll(placement);
    // Seat each body's root at its spawn point.
    for (let i = 0; i < placement.length; i++) {
      const e = this.wave.live[i];
      if (!e) continue;
      e.root.position.set(placement[i].x, placement[i].y, placement[i].z);
      e.root.rotation.y = placement[i].yaw;
      e.spawnHome = { x: placement[i].x, z: placement[i].z };
      e.behaviour = BEHAVIOUR[e.stats.archetype] ?? BEHAVIOUR.runner;
      e.cooldown = 0.6 + (i % 5) * 0.25;
      this.scene?.add(e.root);
    }
    this.inWave = true;
    this.currentWaveName = wave.name;
    this.waveEnding = false;
    this.waveTimer = 0;
    this.handlers.onWaveStart?.(wave);
    return { wave, count: placement.length };
  }

  /**
   * One fixed step of the fight.
   *
   * The bodies here are given the simplest behaviour that still produces the
   * archetype's pressure: close to a standoff distance, attack when inside their
   * range, and hold still when their archetype is a watcher or a sniper. That is
   * a deliberate scope line — a full navmesh chase belongs in the world agent
   * system, not here — and it is enough for a body to feel like it is hunting.
   */
  step(dt) {
    if (!this.inWave) return;
    this.waveTimer += dt;
    const p = this.world.player;
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - dt);
    const sim = this.feel.tick(dt);

    for (const e of this.wave.live) {
      if (e.dead) continue;
      const b = e.behaviour ?? BEHAVIOUR.runner;
      const dx = p.x - e.root.position.x;
      const dz = p.z - e.root.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      e.cooldown = Math.max(0, e.cooldown - dt);

      // Face the player: a body that attacks without turning looks like a
      // mannequin. Watchers and snipers track more slowly.
      const wantYaw = Math.atan2(dx, dz);
      const turn = (e.stats.turnRate ?? 4) * dt;
      e.root.rotation.y += shortAngle(wantYaw - e.root.rotation.y) * Math.min(1, turn);

      // Move to standoff.
      const want = dist - b.standoff;
      if (b.approach > 0 && Math.abs(want) > 0.25) {
        const speed = (e.stats.speed ?? 1) * b.approach * (want > 0 ? 1 : -0.6);
        const nx = e.root.position.x + (dx / dist) * speed * dt;
        const nz = e.root.position.z + (dz / dist) * speed * dt;
        const ground = this.world.groundAt ? this.world.groundAt(nx, nz) : 0;
        e.root.position.x = nx;
        e.root.position.z = nz;
        if (b.hover) {
          // A flyer bobs: a fixed hover height reads as a model on rails.
          e.root.position.y = ground + (e.stats.flyHeight ?? 3) + Math.sin(this.waveTimer * 1.7 + e.spawnHome.x) * 0.22;
        } else {
          e.root.position.y = ground;
        }
        e.play?.("move", 0.25);
      } else {
        e.play?.("idle", 0.3);
        if (b.hover) {
          e.root.position.y = (this.world.groundAt?.(e.root.position.x, e.root.position.z) ?? 0)
            + (e.stats.flyHeight ?? 3) + Math.sin(this.waveTimer * 1.7 + e.spawnHome.x) * 0.22;
        }
      }

      // Attack.
      const attack = e.stats.attack;
      if (attack && dist <= (b.attackRange ?? attack.reach) && e.cooldown <= 0) {
        const canHit = !b.hover || attack.kind === "ranged";
        if (canHit && Math.abs(shortAngle(wantYaw - e.root.rotation.y)) < 0.7) {
          e.cooldown = attack.rate * (1.3 - (b.approach * 0.3));
          e.play?.("attack", 0.12);
          this.landBlow(e, attack, dist);
        }
      }
      e.tick(dt);
    }

    // A wave ends when nothing is left standing or falling. This is checked
    // against `alive()` rather than against the list being empty, because a
    // body that dies is still in the list while it falls: waiting for the list
    // to empty delays the end of the fight until the corpse has sunk, which
    // feels like the game has forgotten the wave.
    if (this.wave.alive === 0 && !this.waveEnding) {
      this.waveEnding = true;
      this.inWave = false;
      const cleared = this.run.wave;
      const offer = this.run.endWave();
      this.handlers.onWaveEnd?.({ wave: cleared, offer, run: this.run.snapshot() });
    }
    void sim;
  }

  /** An enemy connects. Telegraphed by the attack animation, so it is dodgeable. */
  landBlow(enemy, attack, dist) {
    const p = this.world.player;
    if (this.playerHitCooldown > 0) return false;
    // Incoming damage is scaled well below the outgoing numbers on purpose.
    // hp is a resource the player spends over ten waves; a pack of five that
    // connects once each should take a fifth of it, not all of it. Measured
    // from the headless run: five bodies at full damage killed an idle player
    // in 11 seconds, which leaves no room to learn the controls.
    let damage = attack.power * INCOMING;
    // Crouching and running are the counterplay: a crouched target is harder to
    // hit and a running one is already moving.
    if (p.crouch > 0.5) damage *= 0.65;
    if (p.speed > 2) damage *= 0.85;
    const falloff = attack.kind === "ranged" ? Math.max(0.35, 1 - dist / (attack.reach * 1.5)) : 1;
    damage = Math.max(1, Math.round(damage * falloff));
    this.playerHitCooldown = attack.kind === "melee" ? 0.45 : 0.3;
    this.stats.damageTaken += damage;
    this.run.takeDamage(damage);
    this.feel.shake.add(0.3);
    this.feel.haptics.fire("pistol", 0.5);
    this.feel.decals.add({ kind: "blood", size: 0.12, life: 18 });
    // Two sounds, not one: the incoming blow (so the player hears a hit coming)
    // and the impact. A single sound after the fact is a punishment with no
    // warning attached.
    this.audio?.playEvent?.({ type: "enemy-attack", x: enemy.root.position.x, z: enemy.root.position.z, kind: attack.kind }, p);
    this.audio?.playEvent?.({ type: "player-hit", x: p.x, z: p.z }, p);
    this.handlers.onHurt?.({ enemy, damage, health: this.run.health });
    if (this.run.health <= 0) {
      this.inWave = false;
      // Death ends the wave but does not erase the run: the street resets, the
      // score stays, and the player gets the same wave again. In the browser
      // this is the "get up and try it differently" loop.
      this.deaths = (this.deaths ?? 0) + 1;
      this.handlers.onDeath?.({ wave: this.run.wave, run: this.run.snapshot() });
    }
    return true;
  }

  /** The trigger. Called from the input layer, once per press or per frame. */
  fire(dt) {
    if (!this.combat) return null;
    const result = this.combat.fire(dt);
    if (result && !result.dry) this.stats.shots += 1;
    if (result?.hit?.hit) this.stats.hits += 1;
    return result;
  }

  reload() {
    return this.combat?.reload() ?? 0;
  }

  cycle(direction = 1) {
    return this.combat?.cycle(direction);
  }

  select(id) {
    return this.combat?.select(id);
  }

  /** Everything the HUD draws, in one object, with no three.js in it. */
  hud() {
    const base = this.combat?.hud() ?? this.run.snapshot();
    return {
      ...base,
      waveName: this.currentWaveName ?? `Wave ${this.run.wave}`,
      inWave: this.inWave,
      waveTimer: this.waveTimer,
      enemiesAlive: this.wave.alive,
      enemiesTotal: this.wave.live.length,
      accuracy: this.combat?.hud().accuracy ?? null,
      damageTaken: this.stats.damageTaken,
    };
  }

  /** Camera shake, applied after the world has placed the camera. */
  applyShake(world) {
    const cam = world.camera;
    const s = this.feel.shake;
    const out = s.applyTo(cam.x, cam.y, cam.z);
    cam.x = out.x;
    cam.y = out.y;
    cam.z = out.z;
    world.cameraRoll = out.roll;
    return cam;
  }

  /**
   * Get up and try again. A death costs the wave, not the run: the bodies are
   * dismissed, health is restored, and the same wave is issued again. Score and
   * kills stay, so a run is cumulative even across deaths.
   */
  retry() {
    this.clear();
    this.run.health = this.run.maxHealth;
    this.run.state = "briefing";
    this.playerHitCooldown = 0;
    this.run.wave = Math.max(1, this.run.wave);
    return this.startWave();
  }

  /** Advance after a cleared wave, applying whichever offer was taken. */
  advance(offer = null) {
    if (offer) this.run.take(offer);
    this.clear();
    this.run.state = "briefing";
    this.playerHitCooldown = 0;
    return this.startWave();
  }

  clear() {
    this.wave.clear();
    this.inWave = false;
  }

  /** Report for the console: what loaded, what fell back. */
  report() {
    return {
      cast: this.factory.stats,
      failed: [...this.factory.failed],
      kills: this.stats.kills,
      wave: this.run.wave,
    };
  }
}

function shortAngle(a) {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { ARCHETYPES, statLine, Loadout, tierForWave, THREE };
