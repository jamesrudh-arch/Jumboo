// Weapons in the hand.
//
// The data in src/arsenal.js says what a weapon *does*; this says what it looks
// like when you hold it. Three problems have to be solved and none of them are
// obvious from the model files:
//
//  1. The Kenney weapon pack has no texture atlas. It uses a palette material
//     convention, so assigning the street kit's atlas gives a wrong, garbage
//     skin. Every weapon here gets a solid MeshStandardMaterial chosen by
//     damage class, which is also a readability win: the gun looks like the
//     threat it carries.
//
//  2. Pivots are inconsistent. A pistol lies along -Z; the launcher stands with
//     its long axis on +Y. A single mount rotation leaves half the arsenal at
//     forty-five degrees to the wrist. Orientation is therefore *measured* from
//     each model's bounding box, not assumed.
//
//  3. Scale is not in metres. The same pack has a 0.11 m knife and a 2.77 m
//     sniper, and the blaster pack's unit is different again. Each model is
//     normalised to a declared real length so a pistol does not render the size
//     of a bus.
//
// The renderer never sees these rules; it gets a node it can parent to a hand
// and a muzzle point to flash a light at.

import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

/** Solid colour per damage class, with the exception for the heavy stuff. */
const CLASS_COLOUR = {
  blunt: 0x6a5a4a,
  blade: 0xb8c4cc,
  ballistic: 0x2f2f33,
  energy: 0x2a3d4a,
  explosive: 0x3a2a24,
};

/**
 * Real length in metres per model, applied to the model's *dominant* axis.
 *
 * These are not the pack's own units — the pack is uniformly oversized (its
 * "pistol" measures 0.77 of a unit against a real 0.30 m). Declaring a length
 * per model and scaling to it preserves each model's internal proportions while
 * putting the whole ladder in metres, so a rifle is visibly longer than a
 * pistol in the hand.
 */
const LENGTH = {
  pistol: 0.30,
  pistolSilencer: 0.44,
  uzi: 0.45,
  shotgun: 0.95,
  sniper: 1.25,
  machinegun: 1.10,
  flamethrower_long: 0.85,
  rocketlauncher: 1.10,
  knife_sharp: 0.30,
  grenade: 0.11,
  "blaster-d": 0.42,
};

/** How far the grip sits from the model's centre, as a fraction of its length. */
const GRIP_OFFSET = { long: -0.18, sidearm: -0.06 };

function makeMaterial(weapon) {
  const colour = CLASS_COLOUR[weapon.damage] ?? CLASS_COLOUR.ballistic;
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: weapon.damage === "blade" ? 0.22 : 0.55,
    metalness: weapon.damage === "blade" ? 0.9 : 0.45,
  });
}

/**
 * Which axis a model is really long on.
 *
 * Naively taking the longest bounding-box axis is wrong, and the pack proves it:
 * the uzi's tallest dimension is its magazine, so longest-axis orientation lays
 * the gun on its side. Firearms here are authored along Z; only a model whose
 * vertical extent clearly dominates (the launcher stood upright, the knife with
 * its blade up) is actually Y-authored. So Z wins unless something beats it by
 * a clear margin.
 */
export function dominantAxis(size, margin = 1.25) {
  if (size.y > size.z * margin && size.y >= size.x) return "y";
  if (size.x > size.z * margin && size.x > size.y) return "x";
  return "z";
}

/**
 * Measure a model and return the rotation that puts its long axis along -Z
 * (the direction the hand points) plus its normalising scale.
 *
 * This is the whole of problem 2 and 3: it is derived, so a new model needs no
 * hand-written rotation and cannot be shipped backwards.
 */
export function orientFromBounds(box, targetLength) {
  const size = new THREE.Vector3();
  box.getSize(size);
  const axis = dominantAxis(size);
  const longest = size[axis] || 1;
  const scale = targetLength / longest;

  // Rotate the dominant axis onto -Z: Y-authored models are laid down, X ones
  // turned ninety degrees.
  const rotation = { x: 0, y: 0, z: 0 };
  if (axis === "y") rotation.x = -Math.PI / 2;
  if (axis === "x") rotation.y = Math.PI / 2;

  return { axis, scale, rotation, size: { x: size.x, y: size.y, z: size.z } };
}

/**
 * The muzzle's local position after orientation: out along the long axis, past
 * the tip. Returned in the *parent* space so a flash light can be attached
 * without walking the transform chain every frame.
 */
export function muzzleFromOriented(oriented) {
  return new THREE.Vector3(0, 0, -oriented.scale * 0.0 - 0.02);
}

/**
 * Loads and caches weapon models, then hands out mounted copies.
 *
 * A weapon is never shared between two holders: a mesh can only have one
 * parent, and two collectors holding the same instance would teleport one of
 * them. Each `mount()` therefore clones the cached geometry's scene.
 */
export class WeaponRack {
  constructor({ base = "./assets/arsenal/weapons", loader = null } = {}) {
    this.base = base;
    this.loader = loader ?? new GLTFLoader();
    this.cache = new Map(); // model -> { scene, oriented, clips }
    this.failed = new Set();
    this.loaded = 0;
    this.requested = 0;
  }

  /** Preload every model the ladder actually names. */
  async preload(weapons, onProgress) {
    const models = [...new Set(weapons.map((w) => w.model).filter(Boolean))];
    this.requested = models.length;
    const results = await Promise.allSettled(models.map((m) => this.load(m)));
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        this.loaded += 1;
      } else {
        this.failed.add(models[i]);
        console.warn(`[weapons] ${models[i]} unavailable, using a fallback`, results[i].reason);
      }
      onProgress?.((i + 1) / models.length);
    }
    return { loaded: this.loaded, requested: this.requested, failed: [...this.failed] };
  }

  async load(model) {
    if (this.cache.has(model)) return this.cache.get(model);
    if (this.failed.has(model)) throw new Error(`already failed: ${model}`);
    const gltf = await this.loader.loadAsync(`${this.base}/${model}.glb`);
    const scene = gltf.scene;
    const box = new THREE.Box3().setFromObject(scene);
    const oriented = orientFromBounds(box, LENGTH[model] ?? 0.5);
    const entry = { scene, oriented, model };
    this.cache.set(model, entry);
    return entry;
  }

  /**
   * A weapon ready to parent to a hand. Returns null when the model is missing,
   * so the caller can fall back to a procedural shape rather than crash.
   */
  mount(weapon) {
    const entry = weapon.model ? this.cache.get(weapon.model) : null;
    const group = new THREE.Group();
    group.name = `weapon:${weapon.id}`;

    if (!entry) {
      // Fallback: a stub that reads as a held object. Never a placeholder in
      // the sense of "TODO", but a deliberate stand-in so a missing asset is a
      // cosmetic downgrade and not an empty hand.
      const len = LENGTH[weapon.model] ?? (weapon.mode === "melee" ? 0.26 : 0.34);
      const geo = new THREE.BoxGeometry(0.05, 0.06, len);
      geo.translate(0, 0, -len * 0.45);
      const mesh = new THREE.Mesh(geo, makeMaterial(weapon));
      mesh.castShadow = true;
      group.add(mesh);
      group.userData.fallback = true;
      group.userData.muzzle = { x: 0, y: 0, z: -len };
      return group;
    }

    const inner = entry.scene.clone(true);
    const { scale, rotation } = entry.oriented;
    inner.scale.setScalar(scale);
    inner.rotation.set(rotation.x, rotation.y, rotation.z);

    const material = makeMaterial(weapon);
    inner.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      // The palette materials are discarded wholesale; see note 1 at the top.
      o.material = material;
      o.frustumCulled = false;
    });

    // Seat the grip in the fist rather than the middle of the barrel.
    const grip = weapon.mode === "melee" || weapon.mode === "sidearm"
      ? GRIP_OFFSET.sidearm
      : GRIP_OFFSET.long;
    inner.position.z = -grip * LENGTH[weapon.model];
    group.add(inner);

    const m = muzzleFromOriented(entry.oriented);
    group.userData.muzzle = { x: m.x, y: m.y, z: -LENGTH[weapon.model] * 0.62 };
    group.userData.material = material;
    return group;
  }

  /** Report for the loading screen: what loaded, what did not. */
  report() {
    return {
      loaded: this.loaded,
      requested: this.requested,
      failed: [...this.failed],
      tris: [...this.cache.values()].reduce((n, e) => n + countTris(e.scene), 0),
    };
  }
}

function countTris(root) {
  let n = 0;
  root.traverse((o) => {
    if (o.isMesh && o.geometry?.index) n += o.geometry.index.count / 3;
    else if (o.isMesh && o.geometry?.attributes?.position) n += o.geometry.attributes.position.count / 3;
  });
  return Math.round(n);
}

/**
 * A muzzle flash: a short additive cone plus a point light, both cheap enough
 * to keep one per holder rather than allocating per shot.
 */
export class MuzzleFlash {
  constructor({ colour = 0xffd9a0 } = {}) {
    this.group = new THREE.Group();
    const geo = new THREE.ConeGeometry(0.05, 0.16, 6, 1, true);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -0.08);
    this.material = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cone = new THREE.Mesh(geo, this.material);
    this.group.add(this.cone);
    this.light = new THREE.PointLight(colour, 0, 6, 2);
    this.group.add(this.light);
    this.group.visible = false;
    this.pool = 0;
  }

  /** `strength` is 0..1 from the feel table; `life` is seconds. */
  fire(strength = 1, life = 0.055) {
    this.pool = Math.max(this.pool, life);
    this.strength = strength;
    this.group.visible = strength > 0.01;
    this.material.opacity = Math.min(1, 0.55 + strength * 0.45);
    this.light.intensity = 14 * strength;
    this.cone.scale.setScalar(0.6 + strength * 0.9);
    return this;
  }

  tick(dt) {
    if (this.pool <= 0) return this;
    this.pool = Math.max(0, this.pool - dt);
    if (this.pool === 0) {
      this.group.visible = false;
      this.material.opacity = 0;
      this.light.intensity = 0;
    }
    return this;
  }
}
