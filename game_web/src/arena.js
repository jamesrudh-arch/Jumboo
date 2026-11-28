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
import { steer, resolveOverlaps } from "./navigation.js";
import { findTakedownTarget, performTakedown, promptFor, TAKEDOWN } from "./takedown.js";
import { DamageMarks, bearingTo } from "./damagedir.js";
import {
  HAZARD, blastTargets, chainFrom, fallsInWater, shove, usableHazards,
} from "./hazards.js";
import { BOSSES, phaseAt, phaseCrossed, tickBossAction, beginBossAction, telegraphSeconds } from "./bosses.js";
import { resolveCircle } from "./collision.js";

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
    // Where the last hits came from, so the HUD can show a bearing. A hit from
    // off-screen with no indicator is a coin flip, not a fight.
    this.damageMarks = new DamageMarks();
    // Every hazard in the district, and the fires currently burning.
    this.hazards = [];
    this.fires = [];
    this.boss = null; // the acting boss, if this wave has one
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
      // A stable flank slot per body: the formation spread is decided by the
      // wave, not by chance, so a wave is reproducible.
      e.flankSlot = i;
      // A boss carries its own behaviour; the archetype table does not know it.
      if (e.stats.boss) {
        const boss = BOSSES[e.stats.boss];
        e.behaviour = {
          approach: 1,
          standoff: boss.attack.kind === "ranged" || boss.attack.kind === "explosive" ? 12 : 1.8,
          attackRange: boss.attack.reach,
        };
        e.isBoss = true;
        e.bossDef = boss;
        e.bossClock = { state: "idle", t: 0 };
        e.bossPhase = phaseAt(boss, 1);
        e.phaseHealth = 1;
        this.boss = e;
      }
      e.behaviour = e.behaviour ?? BEHAVIOUR[e.stats.archetype] ?? BEHAVIOUR.runner;
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
    // A takedown holds the world for a beat. The lock is a number, not a promise:
    // it always expires.
    if (this.takedownLock > 0) {
      this.takedownLock = Math.max(0, this.takedownLock - dt);
      this.waveTimer += dt;
      for (const e of this.wave.live) e.tick(dt);
      return;
    }
    this.waveTimer += dt;
    const p = this.world.player;
    this.playerHitCooldown = Math.max(0, this.playerHitCooldown - dt);

    // The bleed-out. Down is not dead: the player is on the ground, the wave is
    // still coming, and a cleared wave is what gets them up.
    if (this.run.state === "down") {
      const alive = this.run.tickDown(dt);
      this.feel.shake.add(dt * 0.6);
      if (!alive) {
        this.inWave = false;
        this.handlers.onDeath?.({ wave: this.run.wave, run: this.run.snapshot() });
        return;
      }
      for (const e of this.wave.live) e.tick(dt);
      // Keep checking whether the street has emptied: killing the last body is
      // exactly what is supposed to bring a downed player back, so this check has
      // to run while down rather than being skipped by an early return.
      if (this.wave.alive === 0) this.finishWave();
      return;
    }
    const sim = this.feel.tick(dt);
    this.damageMarks.tick(dt);
    this.tickHazards(dt);

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
        // Steering, not a straight line: bodies go around walls, spread across
        // flank slots, and push off each other so a wave arrives as a formation
        // rather than as one overlapping blob. Flyers ignore the geometry
        // because they are above it.
        let dirX;
        let dirZ;
        if (b.hover) {
          dirX = dx / dist;
          dirZ = dz / dist;
        } else {
          const boxes = this.world.boxesNear ? this.world.boxesNear(e.root.position.x, e.root.position.z, 3.5) : [];
          const neighbours = this.wave.live
            .filter((o) => o !== e && !o.dead && !o.behaviour?.hover)
            .slice(0, 8)
            .map((o) => ({ x: o.root.position.x, z: o.root.position.z }));
          const heading = steer({
            x: e.root.position.x,
            z: e.root.position.z,
            targetX: p.x,
            targetZ: p.z,
            boxes,
            neighbours,
            slot: e.flankSlot ?? 0,
            count: this.wave.live.length,
            radius: 0.4,
            // How far outside its standoff the body is, 0..1: at range it
            // commits to closing, and near its standoff it gives ground to its
            // neighbours instead.
            closing: Math.min(1, Math.abs(want) / 4),
          });
          dirX = heading.x;
          dirZ = heading.z;
        }
        let nx = e.root.position.x + dirX * speed * dt;
        let nz = e.root.position.z + dirZ * speed * dt;
        // Resolve against the street so a body cannot end up inside a wall even
        // when the steering was imperfect. The resolution is the same function
        // the player uses, so bodies and players agree about what is solid.
        if (!b.hover && this.world.boxesNear) {
          const body = { x: nx, z: nz };
          resolveCircle(body, 0.4, this.world.boxesNear(nx, nz, 1.6), 0, 1.8, 2, 0.3);
          nx = body.x;
          nz = body.z;
        }
        e.root.position.x = nx;
        e.root.position.z = nz;
        const ground = this.world.groundAt ? this.world.groundAt(nx, nz) : 0;
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

    this.tickBoss(dt);

    // Bodies do not intersect. Steering is a preference; this is the constraint.
    // Done after movement so the correction applies to where everyone ended up.
    const solid = this.wave.live
      .filter((e) => !e.dead && !e.behaviour?.hover)
      .map((e) => {
        const box = { x: e.root.position.x, z: e.root.position.z, ref: e };
        return box;
      });
    const corrections = resolveOverlaps(solid, 0.72);
    if (corrections > 0) {
      for (const b of solid) {
        b.ref.root.position.x = b.x;
        b.ref.root.position.z = b.z;
      }
    }

    // A wave ends when nothing is left standing or falling. This is checked
    // against `alive()` rather than against the list being empty, because a
    // body that dies is still in the list while it falls: waiting for the list
    // to empty delays the end of the fight until the corpse has sunk, which
    // feels like the game has forgotten the wave.
    if (this.wave.alive === 0) this.finishWave();
    void sim;
  }

  /**
   * The street is empty. Called from both the normal path and the downed path,
   * because a player bleeding out on the ground needs the wave to end too.
   */
  finishWave() {
    if (this.waveEnding) return;
    this.waveEnding = true;
    this.inWave = false;
    const cleared = this.run.wave;
    // A downed player who survives to see the wave cleared gets up with a third
    // of their health. That is the tension the downed state buys: hold on, the
    // street is nearly clear.
    if (this.run.state === "down") this.run.revive();
    const offer = this.run.endWave();
    this.handlers.onWaveEnd?.({ wave: cleared, offer, run: this.run.snapshot() });
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
    // Bearing from the player to the source, relative to where they are looking.
    const bearing = bearingTo(p, enemy.root.position, this.world.cameraYaw ?? p.yaw ?? 0);
    this.damageMarks.add(bearing, damage, { from: enemy.stats?.archetype });
    this.run.takeDamage(damage);
    this.feel.shake.add(0.3);
    this.feel.haptics.fire("pistol", 0.5);
    this.feel.decals.add({ kind: "blood", size: 0.12, life: 18 });
    // Two sounds, not one: the incoming blow (so the player hears a hit coming)
    // and the impact. A single sound after the fact is a punishment with no
    // warning attached.
    this.sound({ type: "enemy-attack", x: enemy.root.position.x, z: enemy.root.position.z, kind: attack.kind });
    // The player's own hit is in their ear: no walls, no distance.
    this.audio?.playEvent?.({ type: "player-hit", x: p.x, z: p.z }, p);
    this.handlers.onHurt?.({ enemy, damage, health: this.run.health });
    if (this.run.health <= 0 && this.run.state === "dead") {
      this.inWave = false;
      // Death ends the wave but does not erase the run: the street resets, the
      // score stays, and the player gets the same wave again. In the browser
      // this is the "get up and try it differently" loop.
      this.deaths = (this.deaths ?? 0) + 1;
      this.handlers.onDeath?.({ wave: this.run.wave, run: this.run.snapshot() });
    }
    return true;
  }

  /**
   * Register the district's hazards. Called once when the world is attached, so
   * a barrel is where the geometry says it is rather than where a second copy of
   * the layout thinks it is.
   */
  attachHazards(props = [], water = null) {
    this.hazards = props
      .filter((p) => HAZARD[p.kind])
      .map((p) => ({ kind: p.kind, x: p.x, z: p.z, spent: false }));
    this.hazardWater = water;
    return this.hazards.length;
  }

  /** Hazards the player could use from where they stand. Drives the HUD prompt. */
  hazardOffer() {
    if (!this.inWave || !this.world?.player) return null;
    const p = this.world.player;
    const usable = usableHazards(this.hazards, p, this.world.cameraYaw ?? p.yaw ?? 0);
    if (!usable.length) return null;
    const h = usable[0].hazard;
    return { hazard: h, prompt: `Use ${HAZARD[h.kind].label}`, distance: usable[0].distance };
  }

  /**
   * Set one off.
   *
   * This is the leverage the fiction promised. A drum kills more than a magazine
   * does, and costs nothing but the walk to it. It is loud — 42 metres of noise —
   * so the street comes to you afterwards, which is the price.
   */
  trigger(hazard = this.hazardOffer()?.hazard) {
    if (!hazard || hazard.spent) return null;
    const spec = HAZARD[hazard.kind];
    hazard.spent = true;
    const kills = [];
    const origin = { x: hazard.x, z: hazard.z };

    const hits = blastTargets(origin, this.wave.live, spec.reach);
    for (const hit of hits) {
      const damage = Math.round(spec.damage * hit.falloff);
      const verdict = this.wave.damage(hit.enemy, damage);
      // The shove is what puts a body in the canal, so it happens before the
      // death check: the body is moved, then the water is asked about it.
      const pushed = shove(
        { x: hit.enemy.root.position.x, y: hit.enemy.root.position.y, z: hit.enemy.root.position.z },
        origin,
        spec.reach * 0.5,
      );
      if (!hit.enemy.dead) {
        hit.enemy.root.position.x = pushed.x;
        hit.enemy.root.position.z = pushed.z;
      }
      if (verdict === "killed" || hit.enemy.dead) kills.push(hit.enemy);
    }

    // Anything thrown over the bank drowns. This is the environmental kill that
    // needs no trigger at all — the canal is simply where the street ends.
    if (this.hazardWater) {
      for (const enemy of this.wave.live) {
        if (enemy.dead) continue;
        if (!fallsInWater(enemy.root.position, this.hazardWater)) continue;
        this.wave.damage(enemy, 999);
        kills.push(enemy);
        this.sound({ type: "splash", x: enemy.root.position.x, z: enemy.root.position.z });
      }
    }

    // Fire, which keeps working after the bang.
    if (spec.fire) {
      this.fires.push({
        x: hazard.x, z: hazard.z, radius: spec.fire.radius,
        left: spec.fire.seconds, perSecond: spec.fire.perSecond, tick: 0,
      });
    }

    // The chain, bounded so a street of drums is an event and not a hang.
    const spent = new Set([hazard]);
    let frontier = [hazard];
    for (let depth = 1; depth <= spec.chainDepth && frontier.length; depth++) {
      const next = [];
      for (const h of frontier) next.push(...chainFrom(h, this.hazards, { depth: depth - 1, spent }));
      for (const h of next) spent.add(h);
      for (const h of next) {
        const chained = this.detonate(h);
        if (chained) kills.push(...chained);
      }
      frontier = next;
    }

    // The feel of it: everything at once, and the loudest thing in the game.
    if (this.feel.explosion) this.feel.explosion({ x: hazard.x, z: hazard.z });
    else this.feel.shake.add(1.2);
    this.sound({ type: "explosion", x: hazard.x, z: hazard.z });
    this.stats.hazardKills = (this.stats.hazardKills ?? 0) + kills.length;
    this.hazardLock = 0.35;
    this.onHazard?.({ hazard, kills, chained: spent.size - 1 });

    // Noise: the whole street heard that.
    this.world?.hearSound?.({ x: hazard.x, z: hazard.z, radius: spec.noise, loud: true });
    return { hazard, kills, chained: spent.size - 1 };
  }

  /**
   * Play a world sound, muffled by however many walls stand between it and the
   * player. One place, so no call site can forget.
   */
  sound(event) {
    if (!this.audio?.playEvent) return false;
    const p = this.world?.player;
    if (!p || event.x === undefined) return this.audio.playEvent(event, p);
    const walls = this.world.wallsBetween ? this.world.wallsBetween(p.x, p.z, event.x, event.z) : 0;
    return this.audio.playEvent({ ...event, walls }, p);
  }

  /** What the HUD needs to draw a boss: name, bar, phase, and telegraph. */
  bossState() {
    const b = this.boss;
    if (!b || b.dead || !b.bossDef) return null;
    const def = b.bossDef;
    const max = b.stats.maxHealth ?? def.health;
    const clock = b.bossClock ?? { state: "idle", t: 0 };
    const windup = def.attack.windup ?? 0.6;
    return {
      id: def.id,
      name: def.name,
      title: def.title,
      health: Math.max(0, b.stats.health),
      max,
      fraction: Math.max(0, Math.min(1, b.stats.health / max)),
      phase: b.bossPhase?.name ?? "",
      phaseNote: b.bossPhase?.note ?? "",
      // The telegraph is the point: how far through the wind-up the boss is, so
      // the player can see the blow coming rather than react to it landing.
      telegraph: clock.state === "windup" ? Math.min(1, clock.t / windup) : 0,
      winding: clock.state === "windup",
      recovering: clock.state === "recover",
      ignoresTakedown: def.ignoresTakedown ?? false,
    };
  }

  /**
   * The boss, once a frame.
   *
   * A boss is the one body in the game whose attack has a clock the player can
   * read: `windup` telegraphs, `strike` lands exactly once, `recover` is the
   * window to punish. That structure is the whole reason a boss fight is a fight
   * rather than a health bar, so it lives here rather than in the generic body
   * attack path.
   */
  tickBoss(dt) {
    const boss = this.boss;
    if (!boss || boss.dead) {
      if (boss?.dead) this.boss = null;
      return;
    }
    const def = boss.bossDef;
    const p = this.world.player;

    // Phases. Announced on the frame they change, so the HUD can say so once.
    // The ceiling comes from the body, not the definition: on a replay the wave
    // scale raises a boss's health, and dividing by the base figure would make
    // its phases arrive late. `currentScale` was never set anywhere, so the
    // original division by `undefined` produced NaN and phase one never ended.
    const ceiling = boss.stats.maxHealth ?? def.health;
    const fraction = Math.max(0, boss.stats.health / ceiling);
    const next = phaseAt(def, fraction);
    if (next !== boss.bossPhase) {
      boss.bossPhase = next;
      this.feel.shake.add(0.25);
      this.audio?.play?.("bossPhase", { gain: 0.7 });
      this.onBossPhase?.({ boss, phase: next });
    }

    const dist = Math.hypot(p.x - boss.root.position.x, p.z - boss.root.position.z);
    const attack = def.attack;

    // Start an attack when in range and idle.
    if (boss.bossClock.state === "idle" && dist <= attack.reach) {
      boss.bossClock = beginBossAction();
      boss.bossClock.t = 0;
      boss.telegraph = telegraphSeconds(def);
      return;
    }
    const out = tickBossAction(boss.bossClock, attack, dt);
    if (out.hit) {
      // The blow lands once, and only if the player is still there. A charge you
      // can sidestep is a charge worth reading.
      const stillThere = Math.hypot(p.x - boss.root.position.x, p.z - boss.root.position.z) <= attack.reach;
      if (stillThere && this.playerHitCooldown <= 0) {
        this.playerHitCooldown = 1 / Math.max(0.1, attack.rate ?? 1);
        const scale = this.markscaleFor?.() ?? 1;
        const damage = Math.max(1, Math.round(attack.power * 0.42 * scale));
        this.damageMarks.add(bearingTo(p, boss.root.position, this.world.cameraYaw ?? p.yaw ?? 0), damage, { from: def.id });
        this.run.takeDamage(damage);
        this.feel.shake.add(0.8);
        this.feel.haptics.fire("heavy", 1);
        this.sound({ type: "hurt", x: boss.root.position.x, z: boss.root.position.z });
        this.handlers.onHurt?.({ enemy: boss, damage, health: this.run.health });
        if (this.run.health <= 0) {
          this.inWave = false;
          this.handlers.onDeath?.({ wave: this.run.wave, run: this.run.snapshot() });
        }
      }
    }
    if (out.changed && out.state === "windup") boss.telegraph = telegraphSeconds(def);
  }

  /**
   * Fire keeps working after the bang.
   *
   * A blast that only removes health once is a big bullet. A fire is a place you
   * cannot stand, and it is the reason a burning drum changes the shape of a
   * fight for six seconds rather than half of one. Ticked at a fixed interval
   * rather than per frame so the damage does not depend on frame rate.
   */
  tickHazards(dt) {
    if (!this.fires.length) return;
    for (const fire of this.fires) {
      fire.left -= dt;
      fire.tick += dt;
      // Four times a second, which is fast enough to read as burning and slow
      // enough that a body survives long enough to run out of it.
      const interval = 0.25;
      if (fire.tick < interval) continue;
      const ticks = Math.floor(fire.tick / interval);
      fire.tick -= ticks * interval;
      for (const enemy of this.wave.live) {
        if (enemy.dead) continue;
        const d = Math.hypot(enemy.root.position.x - fire.x, enemy.root.position.z - fire.z);
        if (d > fire.radius) continue;
        this.wave.damage(enemy, Math.round(fire.perSecond * interval * ticks));
      }
      // The player burns too. Standing in your own fire is a mistake the game
      // should allow you to make.
      const p = this.world?.player;
      if (p && this.run.state !== "dead" && this.run.state !== "down" && this.run.health > 0) {
        const d = Math.hypot(p.x - fire.x, p.z - fire.z);
        if (d <= fire.radius) {
          this.run.takeDamage(Math.round(fire.perSecond * 0.5 * interval * ticks));
        }
      }
    }
    this.fires = this.fires.filter((f) => f.left > 0);
  }

  /** Recursive detonation used by the chain. Returns the bodies it killed. */
  detonate(hazard) {
    if (!hazard || hazard.spent) return null;
    const spec = HAZARD[hazard.kind];
    if (!spec) return null;
    hazard.spent = true;
    const kills = [];
    for (const hit of blastTargets({ x: hazard.x, z: hazard.z }, this.wave.live, spec.reach)) {
      const verdict = this.wave.damage(hit.enemy, Math.round(spec.damage * hit.falloff));
      if (verdict === "killed" || hit.enemy.dead) kills.push(hit.enemy);
    }
    if (spec.fire) {
      this.fires.push({
        x: hazard.x, z: hazard.z, radius: spec.fire.radius,
        left: spec.fire.seconds, perSecond: spec.fire.perSecond, tick: 0,
      });
    }
    return kills;
  }

  /**
   * Is a takedown available right now? Cheap enough to ask every frame: it looks
   * at the live bodies and returns either null or { enemy } plus copy for the
   * prompt. The HUD shows it, and E performs it.
   */
  takedownOffer() {
    if (!this.inWave || !this.world?.player) return null;
    const found = findTakedownTarget(this.world.player, this.wave.live);
    if (!found) return null;
    return { enemy: found.enemy, prompt: promptFor(found.verdict), verdict: found.verdict };
  }

  /**
   * Perform it. The one kill in the game that costs no noise, no ammo and no
   * alert — the reward for having got behind someone unseen.
   */
  takedown() {
    const offer = this.takedownOffer();
    if (!offer) return null;
    const result = performTakedown(this.world.player, offer.enemy, {
      run: this.run,
      onKill: (enemy) => {
        this.stats.kills += 1;
        this.quietTakedowns = (this.quietTakedowns ?? 0) + 1;
        // The feel of it: a hard, short lock with the camera held still.
        this.feel.hitstop.trigger(0.115, "takedown");
        this.feel.shake.add(0.35);
        this.feel.haptics.fire("knife", 0.9);
        this.feel.decals.add({ kind: "blood", size: 0.14, life: 20 });
        this.sound(
          { type: "death", x: enemy.root.position.x, z: enemy.root.position.z, armoured: false },
          this.world.player,
        );
        this.takedownLock = TAKEDOWN.duration;
      },
    });
    this.onTakedown?.(result);
    return result;
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
      takedown: this.takedownOffer(),
      downTimer: this.run.downTimer ?? 0,
      revivesLeft: this.run.deathsAllowed,
      takedowns: this.quietTakedowns ?? 0,
      damageMarks: this.damageMarks.render(),
      hazard: this.hazardOffer(),
      boss: this.bossState(),
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
    this.boss = null;
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
