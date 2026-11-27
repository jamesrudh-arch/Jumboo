// Isolates the CPU rasteriser's triangle path with one hand-made triangle, so a
// projected-but-not-drawn bug cannot hide behind a complex scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { rasterize } from "../tools/software-raster.mjs";

function quadScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "quad";
  scene.add(mesh);
  return scene;
}

test("a quad at 3 m covers the area the perspective maths predicts", () => {
  const scene = quadScene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 0, 3);
  cam.lookAt(0, 0, 0);
  const po = {};
  rasterize(scene, cam, { width: 64, height: 64, mode: "flat", perObject: po });
  const area = po.list.find((o) => o.name === "quad")?.area ?? 0;
  // Visible height at 3 m through a 60 deg vertical FOV is 2*3*tan(30) = 3.46 m,
  // so a 2 m plane should cover (2/3.46)^2 = 33% of the frame.
  const expected = (2 / 3.464) ** 2 * 64 * 64;
  assert.ok(Math.abs(area - expected) < expected * 0.12, `area ${area}, expected ~${expected.toFixed(0)}`);
});

test("a small offset quad covers a plausible area", () => {
  const scene = quadScene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 0, 3);
  cam.lookAt(0, 0, 0);
  // Move the mesh far to the side so it covers a modest band of the frame.
  scene.children[0].position.set(2.0, 0.0, 0);
  const po = {};
  rasterize(scene, cam, { width: 64, height: 64, mode: "flat", perObject: po });
  const area = po.list.find((o) => o.name === "quad")?.area ?? 0;
  assert.ok(area > 4 && area < 64 * 64, `side quad covered ${area} px`);
});

test("depth ordering puts the nearer quad in front", () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const near = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }),
  );
  near.position.set(0, 0, 1);
  near.name = "near";
  const far = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide }),
  );
  far.position.set(0, 0, -1);
  far.name = "far";
  scene.add(far);
  scene.add(near);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 0, 3);
  cam.lookAt(0, 0, 0);
  const shot = rasterize(scene, cam, { width: 32, height: 32 });
  const mid = shot.color.slice((16 * 32 + 16) * 3, (16 * 32 + 16) * 3 + 3);
  assert.ok(mid[0] > mid[1], `centre pixel should be red, got ${mid}`);
});
