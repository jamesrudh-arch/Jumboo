// Placeholder NPC characters for the vertical slice.
//
// These are deliberately simple, readable stand-ins: no approved character
// design exists for Sade or the collectors, so they are built from primitives
// and must not be treated as finished art. The one real, approved asset in the
// slice is Marcus (assets/marcus.glb).

import * as THREE from "three";

const SKIN = 0x8a5b3f;
const SKIN_LIGHT = 0x9a6a4a;

function bodyMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0.06 });
}

/**
 * Build a stylised humanoid with a few named parts so it can be animated
 * procedurally. Returns { root, parts } with pivots for hips, torso, head and
 * arms so calls can add small idle/suspicious poses.
 */
export function buildFigure({ skin = SKIN, jacket = 0x2f3b42, trousers = 0x232b31, height = 1.72, apron = null } = {}) {
  const root = new THREE.Group();
  const scale = height / 1.72;
  root.scale.setScalar(scale);

  // Legs
  const legMat = bodyMaterial(trousers);
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.68, 4, 8);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(side * 0.1, 0.44, 0);
    leg.castShadow = true;
    root.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.26), bodyMaterial(0x171d20, { roughness: 0.6 }));
    boot.position.set(side * 0.1, 0.05, 0.03);
    boot.castShadow = true;
    root.add(boot);
  }

  const hips = new THREE.Group();
  hips.position.set(0, 0.88, 0);
  root.add(hips);

  // Torso
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.16, 0.5, 10),
    bodyMaterial(jacket),
  );
  torso.position.y = 0.22;
  torso.castShadow = true;
  hips.add(torso);
  // Shoulders
  const shoulder = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 3, 8), bodyMaterial(jacket));
  shoulder.rotation.z = Math.PI / 2;
  shoulder.position.y = 0.42;
  hips.add(shoulder);

  if (apron) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.62, 0.03), bodyMaterial(apron));
    panel.position.set(0, 0.1, 0.17);
    hips.add(panel);
  }

  // Arms
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235, 0.4, 0);
    hips.add(pivot);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 3, 8), bodyMaterial(jacket));
    upper.position.y = -0.16;
    upper.castShadow = true;
    pivot.add(upper);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.24, 3, 8), bodyMaterial(jacket));
    lower.position.y = -0.4;
    pivot.add(lower);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bodyMaterial(skin));
    hand.position.y = -0.53;
    pivot.add(hand);
    pivot.rotation.z = side * -0.1;
    arms.push({ pivot, side });
  }

  // Head and neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.09, 8), bodyMaterial(skin));
  neck.position.y = 0.5;
  hips.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.56;
  hips.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), bodyMaterial(skin, { roughness: 0.7 }));
  head.scale.set(0.92, 1.05, 0.98);
  head.position.y = 0.1;
  head.castShadow = true;
  headPivot.add(head);
  // Hair/head wrap as a simple cap so the silhouette is not a bald sphere.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    bodyMaterial(0x1b1a19, { roughness: 0.95 }),
  );
  cap.position.y = 0.12;
  cap.scale.set(0.94, 0.9, 1.0);
  headPivot.add(cap);
  // Face plate: a subtle nose/brow block so the head has a front.
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), bodyMaterial(SKIN_LIGHT, { roughness: 0.7 }));
  face.position.set(0, 0.09, 0.108);
  headPivot.add(face);

  return { root, parts: { hips, torso, headPivot, arms, head } };
}

/** Sade: stall keeper, warm colours, apron, arms folded when idle. */
export function buildSade() {
  const fig = buildFigure({
    jacket: 0x5c4a3a,
    trousers: 0x2b3038,
    apron: 0x7d4a3f,
    skin: 0x7b4f38,
    height: 1.66,
  });
  for (const arm of fig.parts.arms) {
    arm.pivot.rotation.x = -0.95;
    arm.pivot.rotation.z = arm.side * 0.55;
  }
  fig.label = "Sade";
  return fig;
}

/** A collector: dark jacket, high-visibility band, cap. */
export function buildCollector() {
  const fig = buildFigure({ jacket: 0x2a3238, trousers: 0x1e2429, skin: 0x8a5b3f, height: 1.78 });
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.197, 0.197, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xe88771, emissive: 0xe88771, emissiveIntensity: 0.35, roughness: 0.6 }),
  );
  band.position.y = 0.3;
  fig.parts.hips.add(band);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 12), bodyMaterial(0x141a1d));
  cap.position.y = 0.2;
  fig.parts.headPivot.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.1), bodyMaterial(0x141a1d));
  brim.position.set(0, 0.18, 0.12);
  fig.parts.headPivot.add(brim);
  // Heavy boots and a sturdier stance than Sade.
  for (const arm of fig.parts.arms) arm.pivot.rotation.z = arm.side * -0.22;
  fig.label = "Collector";
  return fig;
}

/**
 * Pose a placeholder figure from simulation state. Locomotion drive comes
 * from the agent's stride phase so the legs read as walking.
 */
export function poseFigure(fig, state) {
  const t = state.stride || 0;
  const moving = state.moving ? 1 : 0;
  const swing = Math.sin(t) * 0.55 * moving;
  const hips = fig.parts.hips;
  const arms = fig.parts.arms;

  // Legs are static meshes parented to the root; fake a step with a hip bob.
  hips.position.y = 0.88 + Math.cos(t * 2) * 0.022 * moving;
  hips.rotation.z = Math.sin(t) * 0.035 * moving;
  hips.rotation.x = state.lean || 0;

  for (const arm of arms) {
    const phase = arm.side === 1 ? swing : -swing;
    if (state.mode === "suspicious") {
      arm.pivot.rotation.x = -0.25;
      arm.pivot.rotation.z = arm.side * -0.18;
    } else if (state.mode === "hunt") {
      arm.pivot.rotation.x = swing * 1.35 + 0.35;
      arm.pivot.rotation.z = arm.side * -0.3;
    } else if (state.mode === "folded") {
      arm.pivot.rotation.x = -0.95;
      arm.pivot.rotation.z = arm.side * 0.55;
    } else {
      arm.pivot.rotation.x = -phase;
      arm.pivot.rotation.z = arm.side * -0.12;
    }
  }

  const head = fig.parts.headPivot;
  head.rotation.y = state.lookYaw || 0;
  head.rotation.x = state.lookPitch || 0;
  if (state.mode === "suspicious") head.rotation.x = -0.12;
  if (state.mode === "hunt") head.rotation.x = -0.06;
}
