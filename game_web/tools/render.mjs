// Automated visual check: render the real scene graph from the real camera on
// the CPU and write PNGs. The game's renderer cannot run here (no GPU, no
// headless browser), so this is the only way to see composition, occlusion and
// character framing before the build is opened on a real device.
//
//   node tools/render.mjs [outDir] [width] [height]
//
// Produces: overview, spawn, approach, crouch-cover, hunt, witness, dock.
// This is a diagnostic, not the shipping renderer and not a quality claim.

import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "./node-shims.mjs";
import { LevelView, loadMarcus } from "../src/scene.js";
import { World } from "../src/world.js";
import { LEVEL, buildLevel } from "../src/level.js";
import { rasterize, encodePNG, describeImage, tonemapInPlace, buildShadowMap } from "./software-raster.mjs";
import { poseFigure } from "./characters.mjs";

// Offline diagnostics run in Node: browser shims (canvas 2D for the
// procedural textures, Blob/createImageBitmap for the GLB's embedded JPEGs,
// ProgressEvent for the loader) come from the shared shim module.
installShims();

// GLTFLoader fetches relative URLs; serve them from disk instead of the network.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = typeof url === "string" ? url : url.url;
  if (u.startsWith("file://") || u.startsWith("./assets/") || u.startsWith("assets/")) {
    const file = u.startsWith("file://") ? new URL(u) : path.join(process.cwd(), u.replace(/^\.\//, ""));
    const buf = fs.readFileSync(file);
    return new Response(buf, { status: 200, headers: { "content-type": "model/gltf-binary" } });
  }
  return realFetch(url, opts);
};

const outDir = process.argv[2] || "docs/previews/game";
const W = Number(process.argv[3] || 720);
const H = Number(process.argv[4] || 405);
fs.mkdirSync(outDir, { recursive: true });

const built = buildLevel();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e171d);
scene.fog = new THREE.Fog(0x16232b, 16, 62);

const view = new LevelView(scene, built).build();

// ------------------------------------------------ approved character
const marcus = await loadMarcus(
  scene,
  null,
  "file://" + path.resolve("assets/marcus.glb"),
);
const mroot = marcus.root;
mroot.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = false; // software shadows are static-only
    o.frustumCulled = false;
  }
});
// The GLB is 1.8 m tall with its origin at the feet and faces +Z.
console.log("Marcus clips:", marcus.clips.map((c) => `${c.name}(${c.duration.toFixed(2)}s)`).join(", "));

const world = new World(LEVEL, built);
const walk = marcus.actions.walk;
const run = marcus.actions.run;
const clipSpeed = LEVEL.clip;

function applyPlayerPose(dt) {
  const p = world.player;
  mroot.position.set(p.x, p.feetY, p.z);
  mroot.rotation.y = p.yaw;

  const crouch = p.crouch;
  const moving = p.speed > 0.08;
  const useRun = p.running || p.speed > LEVEL.walkSpeed + 0.35;
  // Cross-fade walk/run by speed and time-scale to the stride so the feet plant.
  const runWeight = THREE.MathUtils.clamp((p.speed - LEVEL.walkSpeed) / (LEVEL.runSpeed - LEVEL.walkSpeed), 0, 1);
  if (walk) walk.setEffectiveWeight(1 - runWeight);
  if (run) run.setEffectiveWeight(runWeight);
  const nominal = THREE.MathUtils.lerp(clipSpeed.walk, clipSpeed.run, runWeight);
  const speedScaled = THREE.MathUtils.clamp(p.speed / Math.max(nominal, 0.01), 0.35, 2.4);
  if (walk) walk.timeScale = moving ? speedScaled : 0.18; // a slow idle sway beats a frozen T-pose
  if (run) run.timeScale = speedScaled;
  marcus.mixer.update(dt);
  marcus.setCrouch(crouch);
}

const sunLight = scene.children.reduce((f, c) => f || c.children?.find((x) => x.isDirectionalLight), null);
const shadow = sunLight
  ? buildShadowMap(scene, sunLight, { size: 1024, center: new THREE.Vector3(0, 0, -22), radius: 34 })
  : null;

function placeCamera(worldRef) {
  const cam = worldRef.camera;
  const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 220);
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(worldRef.cameraFocus.x, worldRef.cameraFocus.y, worldRef.cameraFocus.z);
  return camera;
}

/** Run the simulation to a state, then render a frame. */
function capture(name, setup, maxFrames = 60 * 30) {
  world.reset();
  for (const c of [walk, run]) if (c) c.reset();
  world.start();
  // Give the camera a moment to settle before the action. A setup may return a
  // fixed camera; it is held for the whole shot.
  const fixedCamera = setup(world, maxFrames);
  // Settle with the last input still held (crouch decays if it is released, so
  // clearing it here photographed a standing pose for a crouch shot).
  const settle = { moveX: 0, moveZ: 0, run: false, crouch: holdInput.crouch, interact: false };
  for (let i = 0; i < 45; i++) {
    world.setInput(settle);
    applyPlayerPose(1 / 60);
    world.update(1 / 60);
  }
  world.setInput(settle);
  const cam = fixedCamera || placeCamera(world);
  console.log(`    camera (${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(1)}, ${cam.position.z.toFixed(1)}) -> player (${world.player.x.toFixed(1)}, ${world.player.z.toFixed(1)}) boom=${world.camera.distance.toFixed(2)}`);
  mroot.position.set(world.player.x, world.player.feetY, world.player.z);
  mroot.rotation.y = world.player.yaw;
  marcus.setCrouch(world.player.crouch);
  marcus.mixer.setTime(0.05);
  view.syncCharacters(world);
  view.update(0.016, world.time, world.hud());

  const shot = rasterize(scene, cam, { width: W, height: H, shadow });
  tonemapInPlace(shot.color, 1.7);
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, encodePNG(W, H, shot.color));
  const diag = describeImage(shot.color, W, H);
  console.log(
    `${name.padEnd(14)} tris=${String(shot.stats.triangles).padStart(6)} meshes=${String(shot.stats.meshes).padStart(4)} ` +
      `skinnedVerts=${shot.stats.skinnedVerts} meanLuma=${diag.meanLuma} dark=${diag.darkFraction}`,
  );
  return { file, shot, diag };
}

let holdInput = { crouch: false };
function stepWorld(frames, input, dt = 1 / 60) {
  holdInput = { crouch: !!input.crouch };
  for (let i = 0; i < frames; i++) {
    world.setInput(input);
    world.update(dt);
    applyPlayerPose(dt);
  }
}

const aim = (dx, dz) => {
  world.cameraYaw = Math.atan2(dx, dz);
};

const results = {};

// 1. Overview: high, wide, from the spawn end looking down the lane.
results.overview = capture("01-overview", (w) => {
  // Above the roofline (walls are 13-14 m), far enough back to clear the
  // skyline block behind the spawn point, looking down the lane.
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.5, 400);
  camera.position.set(-2.5, 34, 30);
  camera.lookAt(0, 0, -24);
  return camera;
});

// 2. Spawn: default third-person framing, everything settled.
results.spawn = capture("02-spawn", (w) => {
  for (let i = 0; i < 90; i++) {
    applyPlayerPose(1 / 60);
    w.update(1 / 60);
  }
  return null;
});

// 3. Approach: walking down the lane, near the parked van.
results.approach = capture("03-approach", (w) => {
  aim(-0.08, -1);
  stepWorld(60 * 4.0, { moveZ: 1, run: false }, 1 / 60);
  stepWorld(20, { moveZ: 0 });
  return null;
});

// 4. Crouched behind the dumpster with a collector approaching.
results.crouch = capture("04-crouch-cover", (w) => {
  w.player.x = 6.1;
  w.player.z = -5.7;
  aim(-1, -0.2);
  stepWorld(60 * 1.2, { crouch: true, moveZ: 0 }, 1 / 60);
  stepWorld(30, { crouch: true, moveZ: 0 }, 1 / 60);
  return null;
});

// 5. Hunt: a collector has seen the player and is closing in.
results.hunt = capture("05-hunt", (w) => {
  w.player.x = 2.0;
  w.player.z = -17.0;
  aim(0.15, -1);
  const a = w.agents[1];
  a.x = 2.6;
  a.z = -11.6;
  a.yaw = Math.PI;
  a.state = "patrol";
  a.pause = 0;
  stepWorld(60 * 0.4, { moveZ: 0 }, 1 / 60);
  w.startHunt(a);
  stepWorld(60 * 0.7, { moveZ: 1, run: true }, 1 / 60);
  return null;
});

// 6. Witness: standing at Sade's stall.
results.witness = capture("06-witness", (w) => {
  w.player.x = LEVEL.witness.x - 0.4;
  w.player.z = LEVEL.witness.z + 2.1;
  aim(0.1, -1);
  stepWorld(60 * 1.0, { moveZ: 0 }, 1 / 60);
  return null;
});

// 7. Dock: the loading bay at the end of the lane.
results.dock = capture("07-dock", (w) => {
  w.player.x = 3.4;
  w.player.z = -36.0;
  aim(0.75, -1);
  stepWorld(60 * 1.0, { moveZ: 0 }, 1 / 60);
  return null;
});

// 8. Crouch close-up: verifies the squat pose reads without interpenetration.
results.crouchClose = capture("08-crouch-closeup", (w) => {
  w.player.x = 0.0;
  w.player.z = -22.0;
  w.cameraYaw = 0.9;
  w.cameraPitch = 0.12;
  stepWorld(60 * 0.6, { crouch: true, moveZ: 0 }, 1 / 60);
  // Three-quarter side view of the squat, close enough to read the pose.
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 60);
  camera.position.set(w.player.x + 2.1, 1.55, w.player.z + 1.5);
  camera.lookAt(w.player.x, 0.85, w.player.z);
  return camera;
});

console.log("\nWrote:", Object.values(results).map((r) => r.file).join("\n       "));
