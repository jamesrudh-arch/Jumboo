// Character integrity and rendering invariants.
//
// Loading notes verified against the approved source GLB:
//   * JOINTS_0/WEIGHTS_0 are interleaved with POSITION/NORMAL/UV in one buffer.
//     Read them only through the attribute accessors, never raw offsets.
//   * The inverse bind matrices are in the rig's centimetre space while the
//     vertices are in metres, so CPU skinning must apply matrixWorld afterwards
//     exactly as the GPU shader does. Skinned vertices are ~100x metres before
//     that step.
//   * Three's SkinnedMesh#applyBoneTransform() omits matrixWorld, so it is only
//     useful for bone-space comparisons, not for world positions.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "../tools/node-shims.mjs";
import { rasterize } from "../tools/software-raster.mjs";

installShims();
const { loadMarcus, validateSkinning } = await import("../src/scene.js");

const file = "file://" + path.resolve("assets/marcus.glb");

async function load() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0);
  const m = await loadMarcus(scene, null, file);
  scene.add(m.root);
  return { scene, m };
}

function skinnedMeshOf(m) {
  let mesh = null;
  m.root.traverse((o) => {
    if (o.isSkinnedMesh) mesh = o;
  });
  return mesh;
}

test("the approved asset's skinning buffers validate", async () => {
  const { m } = await load();
  const mesh = skinnedMeshOf(m);
  const report = validateSkinning(mesh);
  assert.equal(report.ok, true, `unexpected skin problem: ${report.reason}`);
  assert.ok(report.maxJoint < report.joints + 1, "no joint index beyond the rig");
  assert.equal(report.badWeights, 0);
  assert.equal(mesh.visible, true, "valid mesh is drawn");
  assert.equal(m.skinReport.ok, true);
});

test("the rig keeps its approved clips, skeleton and crouch pose", async () => {
  const { m } = await load();
  assert.deepEqual(m.clips.map((c) => c.name).sort(), ["run", "walk"]);
  const mesh = skinnedMeshOf(m);
  assert.equal(mesh.skeleton.bones.length, 54);
  assert.ok(m.crouch, "crouch pose builder is available");
  assert.equal(m.skinUnitScale, 100, "the centimetre-space note is recorded");
});

test("CPU skinning puts the character at human scale on the floor", async () => {
  const { scene, m } = await load();
  m.mixer.setTime(0.25);
  scene.updateMatrixWorld(true);
  const mesh = skinnedMeshOf(m);
  mesh.skeleton.update();
  // Same maths as the rasteriser and the GPU shader.
  const v = new THREE.Vector3();
  const bindPos = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const skinMat = new THREE.Matrix4();
  const si = mesh.geometry.attributes.skinIndex;
  const sw = mesh.geometry.attributes.skinWeight;
  let minY = Infinity;
  let maxY = -Infinity;
  const step = 97;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i += step) {
    v.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.bindMatrix);
    bindPos.copy(v);
    v.set(0, 0, 0);
    for (const axis of ["X", "Y", "Z", "W"]) {
      const w = sw[`get${axis}`](i);
      if (w === 0) continue;
      const j = si[`get${axis}`](i);
      skinMat.multiplyMatrices(mesh.skeleton.bones[j].matrixWorld, mesh.skeleton.boneInverses[j]);
      acc.copy(bindPos).applyMatrix4(skinMat).multiplyScalar(w);
      v.add(acc);
    }
    v.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld);
    assert.ok(Number.isFinite(v.x + v.y + v.z), `non-finite vertex at ${i}`);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  assert.ok(Math.abs(minY) < 0.2, `feet near the floor, got ${minY.toFixed(2)}`);
  assert.ok(maxY > 1.55 && maxY < 2.05, `head ~1.8 m, got ${maxY.toFixed(2)}`);
});

test("crouch pose lowers the head without sinking the feet", async () => {
  const { m } = await load();
  const measure = () => {
    m.root.updateMatrixWorld(true);
    const head = m.root.getObjectByName("Head");
    const toe = m.root.getObjectByName("LeftToeBase");
    const hips = m.root.getObjectByName("Hips");
    return {
      head: head.getWorldPosition(new THREE.Vector3()).y,
      toe: toe.getWorldPosition(new THREE.Vector3()).y,
      hips: hips.position.y,
    };
  };
  m.setCrouch(0);
  m.mixer.setTime(0.1);
  const standing = measure();
  m.setCrouch(1);
  m.mixer.update(0.0001);
  const crouched = measure();
  assert.ok(
    crouched.head < standing.head - 0.25,
    `crouch must lower the head: ${standing.head.toFixed(2)} -> ${crouched.head.toFixed(2)}`,
  );
  assert.ok(crouched.hips < standing.hips, "hips drop in local space");
  assert.ok(crouched.toe > -0.2, `toes stay near the floor: ${crouched.toe.toFixed(2)}`);
});

function projectedQuadArea(fovDeg, yawDeg, W, H) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  scene.add(quad);
  const cam = new THREE.PerspectiveCamera(fovDeg, W / H, 0.1, 100);
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
  if (yawDeg) quad.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  const po = {};
  rasterize(scene, cam, { width: W, height: H, mode: "flat", perObject: po });
  return po.list.find((o) => o.name === "Mesh")?.area ?? 0;
}

test("rasteriser perspective matches the standard frustum formula", () => {
  const W = 100;
  const H = 100;
  const visibleH = 2 * 5 * Math.tan((60 * Math.PI) / 360);
  const area = projectedQuadArea(60, 0, W, H);
  const expected = (1 / visibleH) * (1 / (visibleH * (W / H))) * W * H;
  assert.ok(Math.abs(area - expected) < expected * 0.2, `${area}px vs ${expected.toFixed(0)}px`);
});

test("an angled quad covers less area, as perspective requires", () => {
  const flat = projectedQuadArea(60, 0, 100, 100);
  const angled = projectedQuadArea(60, 60, 100, 100);
  assert.ok(angled < flat * 0.85 && angled > flat * 0.3, `angled ${angled} vs flat ${flat}`);
});

test("a near object is not occluded by a large distant ground plane", async () => {
  // Regression: screen depth is nonlinear in NDC, so interpolating it with the
  // perspective-correct weights made a 140x170 m floor win the depth test at
  // ~0.1 m and hide everything standing on it.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 170),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -30;
  ground.name = "ground";
  scene.add(ground);
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.8, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  );
  cube.position.set(0, 0.9, 0);
  cube.name = "cube";
  scene.add(cube);

  const cam = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 220);
  cam.position.set(0, 2.6, 3.6);
  cam.lookAt(0, 1.5, 0);
  const W = 160;
  const H = 90;
  const po = {};
  const shot = rasterize(scene, cam, { width: W, height: H, mode: "light", perObject: po });
  const area = (n) => po.list.find((o) => o.name === n)?.area ?? 0;
  assert.ok(area("cube") > 150, `cube must be visible through the floor, got ${area("cube")}px`);

  // The centre of the cube must actually be the cube in the colour buffer.
  const px = Math.round(W / 2);
  const py = Math.round(H * 0.55);
  const k = (py * W + px) * 3;
  assert.ok(shot.color[k] > 0.25, "cube pixel is drawn on top of the floor");
  assert.ok(shot.depth[py * W + px] > 0.5 && shot.depth[py * W + px] < 1.0, "depth is near the cube");
});
