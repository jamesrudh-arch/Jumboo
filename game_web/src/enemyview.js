// Enemies in the world.
//
// The simulation (src/world.js) decides where a body is and what it wants to do.
// This file owns the part that has a skeleton: loading the vendored GLBs, cloning
// them per body, driving an AnimationMixer from a small state machine, and
// getting a corpse out of the scene without leaking a mixer.
//
// Three things here are less obvious than they look:
//
//  1. `SkeletonUtils.clone`, not `Object3D.clone`. A plain clone shares one
//     Skeleton instance between every copy, so every enemy in the district
//     snaps to the same pose and the same animation frame. The vendored
//     SkeletonUtils rebuilds the bone graph per copy.
//
//  2. Height normalisation by measurement. The Quaternius packs are not in
//     metres — the `.transformed` variants are exported 100x — so a body is
//     scaled to its archetype's declared height from its own bounding box.
//     Trusting the file's units puts a 100 m brute in the street.
//
//  3. A body that dies keeps animating for a moment. Cutting to a corpse model
//     loses the fall, which is the single most readable thing in a fight; the
//     action is played once, held at its last frame, and only then is the body
//     released.

import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "../vendor/three/examples/jsm/utils/SkeletonUtils.js";
import { resolveClipMap, scaleToHeight, statLine } from "./enemies.js";

/** Fallback colour per archetype, used only when a model will not load. */
const FALLBACK_COLOUR = {
  watcher: 0x6f8fa8,
  runner: 0xa86f6f,
  brute: 0x8a7a6a,
  flyer: 0x8f6fa8,
  pack: 0x6a8a6a,
  heavy: 0xa86f8a,
  sniper: 0x8a8a6a,
};

/** A cheap proxy body so a failed load is a downgrade, not an empty street. */
function fallbackBody(def) {
  const g = new THREE.Group();
  const h = def.height ?? 1.8;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(h * 0.16, h * 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: FALLBACK_COLOUR[def.archetype] ?? 0x777777, roughness: 0.8 }),
  );
  body.position.y = h * 0.45;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: FALLBACK_COLOUR[def.archetype] ?? 0x777777, roughness: 0.7 }),
  );
  head.position.y = h * 0.86;
  head.castShadow = true;
  g.add(head);
  // A face so the player can read which way it is looking.
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(h * 0.05, h * 0.05, h * 0.05),
    new THREE.MeshStandardMaterial({ color: 0x221a16 }),
  );
  nose.position.set(0, h * 0.86, -h * 0.1);
  g.add(nose);
  g.userData.fallback = true;
  g.userData.height = h;
  return g;
}

/**
 * Loads every enemy model once, then stamps out cheap clones.
 *
 * Loading is deliberately serial-ish: fourteen GLBs totalling 8 MB on a phone
 * will saturate the connection and make the first frame arrive late, and a wave
 * needs its cast before it starts, not a fast loading bar.
 */
export class EnemyFactory {
  constructor({ base = "./assets/arsenal/enemies", loader = null } = {}) {
    this.base = base;
    this.loader = loader ?? new GLTFLoader();
    this.cache = new Map(); // model -> { scene, clips, clipMap, measuredHeight }
    this.failed = new Set();
    this.stats = { loaded: 0, requested: 0, tris: 0, bones: 0 };
  }

  /** Load each distinct model the given archetypes name. */
  async preload(archetypes, onProgress) {
    const models = [...new Set(Object.values(archetypes).map((a) => a.model))];
    this.stats.requested = models.length;
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        await this.load(model);
        this.stats.loaded += 1;
      } catch (err) {
        this.failed.add(model);
        console.warn(`[enemies] ${model} unavailable, using a proxy body`, err?.message ?? err);
      }
      onProgress?.((i + 1) / models.length, model);
    }
    return this.stats;
  }

  async load(model) {
    if (this.cache.has(model)) return this.cache.get(model);
    if (this.failed.has(model)) throw new Error(`already failed: ${model}`);
    const gltf = await this.loader.loadAsync(`${this.base}/${model}.glb`);
    const scene = gltf.scene;
    // Measure before anything is scaled. Box3 on a skinned mesh uses the bind
    // pose, which is what we want: the archetype height is the standing height.
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    let bones = 0;
    let tris = 0;
    scene.traverse((o) => {
      if (o.isBone) bones += 1;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned bounds change with the pose
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          m.envMapIntensity = 0.5;
          m.shadowSide = THREE.FrontSide;
        }
        if (o.geometry?.index) tris += o.geometry.index.count / 3;
        else if (o.geometry?.attributes?.position) tris += o.geometry.attributes.position.count / 3;
      }
    });
    this.stats.tris += Math.round(tris);
    this.stats.bones = Math.max(this.stats.bones, bones);
    const entry = {
      scene,
      clips: gltf.animations,
      clipMap: resolveClipMap(gltf.animations.map((c) => c.name)),
      measuredHeight: size.y,
      bones,
      tris: Math.round(tris),
    };
    this.cache.set(model, entry);
    return entry;
  }

  /**
   * One live enemy. `stats` is a statLine() from the progression layer, so the
   * view and the simulation cannot disagree about health or archetype.
   */
  spawn(stats) {
    const entry = this.cache.get(stats.model);
    const root = new THREE.Group();
    const body = entry ? cloneSkinned(entry.scene) : fallbackBody(stats);

    const targetHeight = stats.height ?? 1.8;
    const scale = entry ? scaleToHeight(entry.measuredHeight, targetHeight) : 1;
    body.scale.setScalar(scale);
    // Sit the feet on the ground: the measured box starts at its own origin.
    if (entry) {
      const b = new THREE.Box3().setFromObject(body);
      body.position.y = -b.min.y;
    }
    root.add(body);

    const mixer = entry ? new THREE.AnimationMixer(body) : null;
    const actions = {};
    if (entry && mixer) {
      for (const [state, clipName] of Object.entries(entry.clipMap)) {
        if (state === "all" || !clipName) continue;
        const clip = entry.clips.find((c) => c.name === clipName);
        if (!clip) continue;
        const action = mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = state === "death";
        action.setEffectiveWeight(0);
        action.play();
        actions[state] = action;
      }
      // Death is a one-shot: it plays to its last frame and holds there.
      if (actions.death) {
        actions.death.setLoop(THREE.LoopOnce, 1);
      }
    }

    const enemy = {
      stats,
      root,
      body,
      mixer,
      actions,
      current: null,
      height: targetHeight,
      /** feet offset so the simulation can place root.position.y directly */
      bodyOffset: body.position.y,
      dead: false,
      deathTimer: 0,
      flashTimer: 0,
      isFallback: Boolean(!entry),

      /** Switch animation state; a no-op if already in it. */
      play(state, fade = 0.18) {
        if (!actions[state] || this.current === state) return;
        const next = actions[state];
        const prev = this.current ? actions[this.current] : null;
        next.reset();
        next.setEffectiveWeight(1);
        next.fadeIn(fade).play();
        if (prev) prev.fadeOut(fade);
        this.current = state;
        return this;
      },

      /** A hit: play the flinch if the pack has one, and flash the material. */
      hit() {
        if (this.dead) return this;
        if (actions.hit) {
          const prev = this.current;
          this.play("hit", 0.05);
          // Return to whatever it was doing, which is what keeps a fight from
          // turning into a flinch loop.
          this.hitReturn = setTimeoutLike(this, prev);
        }
        this.flashTimer = 0.09;
        return this;
      },

      die() {
        if (this.dead) return this;
        this.dead = true;
        this.deathTimer = actions.death ? 1.6 : 0.9;
        if (actions.death) this.play("death", 0.1);
        else {
          // No death clip (the snake, the wasp): fall over instead. A body that
          // simply stops is unreadable; a body that topples is not.
          this.fallOver = true;
        }
        return this;
      },

      tick(dt) {
        this.mixer?.update(dt);
        if (this.flashTimer > 0) {
          this.flashTimer = Math.max(0, this.flashTimer - dt);
          applyTint(this.body, this.flashTimer > 0 ? 0xff5544 : null);
        }
        if (this.fallOver) {
          // Topple about the feet, not the hips, so the body pivots where it
          // stood rather than sliding.
          this.body.rotation.x = Math.min(Math.PI / 2, this.body.rotation.x + dt * 3.4);
          this.body.position.y = this.bodyOffset * Math.cos(this.body.rotation.x);
        }
        if (this.dead) {
          this.deathTimer -= dt;
          // Sink after the fall so the corpse does not pop out.
          if (this.deathTimer < 0.5) {
            this.root.position.y -= dt * 0.35;
          }
          return this.deathTimer <= 0;
        }
        return false;
      },

      dispose() {
        this.mixer?.stopAllAction();
        this.mixer?.uncacheRoot(this.body);
        disposeTree(this.root);
      },
    };

    // Fade the idle in immediately so a body never appears in its bind pose.
    enemy.play("idle", 0);
    return enemy;
  }

  /** Build a killable body without a model: used by tests and by the range. */
  spawnSimple(stats) {
    return this.spawn({ ...statLine(stats.archetype ?? "runner", 1), ...stats });
  }
}

/** setTimeout against the simulation rather than the wall clock. */
function setTimeoutLike(enemy, state) {
  let t = 0.18;
  const timer = { t, state };
  enemy.hitReturnTimer = timer;
  return timer;
}

/** Tint every material on a body, remembering the originals once. */
function applyTint(root, colour) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.userData.baseEmissive === undefined) {
        m.userData.baseEmissive = m.emissive ? m.emissive.getHex() : 0;
      }
      if (!m.emissive) continue;
      if (colour === null) m.emissive.setHex(m.userData.baseEmissive);
      else m.emissive.setHex(colour);
    }
  });
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
  root.parent?.remove(root);
}

/**
 * A wave of bodies. Owns the tick order, removal and the corpse budget: corpses
 * are visually valuable and financially expensive, so they are capped and the
 * oldest is retired first.
 */
export class EnemyWave {
  constructor({ factory, maxCorpses = 6 } = {}) {
    this.factory = factory;
    this.maxCorpses = maxCorpses;
    this.live = [];
    this.corpses = [];
    this.onKill = null;
  }

  spawnAll(list) {
    for (const stats of list) {
      const enemy = this.factory.spawn(stats);
      this.live.push(enemy);
    }
    return this.live;
  }

  /** Apply damage. Returns 'killed' | 'hit' | null. */
  damage(enemy, amount) {
    if (!enemy || enemy.dead) return null;
    enemy.stats.health -= amount;
    if (enemy.stats.health <= 0) {
      enemy.die();
      this.onKill?.(enemy);
      return "killed";
    }
    enemy.hit();
    return "hit";
  }

  tick(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      const finished = e.tick(dt);
      if (e.dead && !e.movedToCorpses) {
        e.movedToCorpses = true;
        this.corpses.push(e);
        if (this.corpses.length > this.maxCorpses) {
          const old = this.corpses.shift();
          old.dispose();
        }
        this.live.splice(i, 1);
        continue;
      }
      if (finished) {
        if (!e.movedToCorpses) this.corpses.push(e);
        this.live.splice(i, 1);
      }
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      if (this.corpses[i].tick(dt)) {
        this.corpses[i].dispose();
        this.corpses.splice(i, 1);
      }
    }
    return this;
  }

  get alive() {
    return this.live.filter((e) => !e.dead).length;
  }

  get total() {
    return this.live.length;
  }

  clear() {
    for (const e of [...this.live, ...this.corpses]) e.dispose();
    this.live = [];
    this.corpses = [];
  }
}
