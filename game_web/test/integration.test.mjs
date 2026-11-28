// Integration checks for the playable slice.
//
// The browser smoke test (tools/smoke.mjs) needs a real WebGL browser, which is
// not available everywhere. These tests cover the same wiring headlessly:
// the animation layer against the real approved asset and the real simulation,
// and the page's module graph so a broken import cannot ship.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { installShims } from "../tools/node-shims.mjs";

installShims();
const { loadMarcus } = await import("../src/scene.js");
const { CharacterAnimator } = await import("../src/anim.js");
const { World, TUNING, PHASE } = await import("../src/world.js");
const { LEVEL, buildLevel } = await import("../src/level.js");
const { Hud, formatTime } = await import("../src/hud.js");

const file = "file://" + path.resolve("assets/marcus.glb");

async function rig() {
  const built = buildLevel();
  const scene = new THREE.Scene();
  const marcus = await loadMarcus(scene, null, file);
  const world = new World(LEVEL, built);
  world.start();
  const animator = new CharacterAnimator(marcus, LEVEL);
  const headY = () => {
    scene.updateMatrixWorld(true);
    const head = marcus.root.getObjectByName("Head");
    return head.getWorldPosition(new THREE.Vector3()).y;
  };
  const step = (frames, input) => {
    for (let i = 0; i < frames; i++) {
      world.setInput(input);
      world.update(1 / 60);
      animator.sync(world.player, 1 / 60);
      animator.update(1 / 60);
    }
  };
  return { built, scene, marcus, world, animator, headY, step };
}

test("the animator drives the real rig through walk, run and crouch", async () => {
  const { world, animator, headY, step } = await rig();

  const idleHead = headY();
  assert.ok(idleHead > 1.6, `standing head ~1.7 m, got ${idleHead.toFixed(2)}`);

  // Walk forward: the body advances in the direction the rig faces.
  const z0 = world.player.z;
  step(45, { moveZ: 1 });
  assert.ok(world.player.z < z0 - 0.4, `walked forward, z ${z0.toFixed(2)} -> ${world.player.z.toFixed(2)}`);
  assert.equal(Math.round(animator.runWeight * 10), 0, "walking does not fade in the run clip");
  assert.ok(animator.walkAction.timeScale > 0.2, "the walk clip is timed to the stride");

  // Sprint: the run clip takes over and the stride speeds up.
  step(60, { moveZ: 1, run: true });
  assert.ok(animator.runWeight > 0.6, `run clip faded in (${animator.runWeight.toFixed(2)})`);
  assert.ok(world.player.speed > LEVEL.walkSpeed + 0.5, `speed ${world.player.speed.toFixed(2)} m/s`);

  // Crouch: the composed pose lowers the head, and stays lowered while walking.
  step(45, { crouch: true });
  const crouchHead = headY();
  assert.ok(crouchHead < idleHead - 0.2, `crouched head ${crouchHead.toFixed(2)} vs ${idleHead.toFixed(2)}`);
  step(40, { crouch: true, moveZ: 1 });
  assert.ok(headY() < idleHead - 0.2, "crouch holds while moving");

  // Feet stay on the floor in every state.
  const feet = world.player.feetY;
  assert.ok(Math.abs(feet) < 0.25, `feet near the floor, got ${feet.toFixed(2)}`);
});

test("the player model tracks the simulation's position and facing", async () => {
  const { world, marcus, animator, step } = await rig();
  step(30, { moveX: 1 });
  const p = world.player;
  assert.ok(Math.abs(marcus.root.position.x - p.x) < 1e-6, "model x follows the player");
  assert.ok(Math.abs(marcus.root.position.z - p.z) < 1e-6, "model z follows the player");
  assert.equal(marcus.root.rotation.y, p.yaw, "model yaw follows the player");
  assert.ok(Math.abs(animator.lean) <= 0.13, "lean stays subtle");
});

test("a complete run can be finished: talk to Sade, then reach the lane", async () => {
  const { world, step } = await rig();
  // Place the player next to Sade; the sim only needs proximity + interact.
  world.player.x = LEVEL.witness.x;
  world.player.z = LEVEL.witness.z + 0.5;
  step(90, { interact: true });
  assert.equal(world.talkedToWitness, true, "the talk interaction completes");
  assert.equal(world.objective, "reach_lane");

  world.player.x = LEVEL.goal.x;
  world.player.z = LEVEL.goal.z;
  step(10, {});
  assert.equal(world.phase, PHASE.WON, "reaching the lane wins");
  assert.ok(world.score >= 100, `score ${world.score}`);
  assert.match(world.rank, /^[SABCD]$/);
});

test("getting caught is recoverable, not a dead end", async () => {
  const { world, step } = await rig();
  const agent = world.agents[0];
  world.startHunt(agent);
  world.caught(agent);
  assert.equal(world.phase, PHASE.CAUGHT);
  assert.ok(world.score >= 50);
  // The world resets after the catch delay.
  step(Math.ceil(TUNING.resetDelay * 60) + 30, {});
  assert.notEqual(world.phase, PHASE.CAUGHT, "the slice returns to play after a catch");
});

test("the HUD formats and renders every readout", async () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(59.9), "0:59");
  assert.equal(formatTime(60), "1:00");
  assert.equal(formatTime(65.2), "1:05", "a stopwatch floors the elapsed seconds");
  assert.equal(formatTime(-3), "0:00");

  // A real DOM rather than a hand-written stub. The stub had to be kept in sync
  // with a hard-coded list of field names by hand, and that list is exactly the
  // kind of thing that silently goes stale when the HUD grows a panel.
  const { parseHTML } = await import("linkedom");
  const { document: doc } = parseHTML("<html><head></head><body></body></html>");
  const original = globalThis.document;
  globalThis.document = doc;
  doc.body.innerHTML = "";
  doc.head.innerHTML = "";

  const hud = new Hud(doc.body);
  // Assert against the markup the HUD actually ships: every [data-field] in the
  // template must be wired, which is a stronger claim than a list in the test.
  const declarative = [...doc.body.querySelectorAll("[data-field]")].map((n) => n.dataset.field);
  assert.ok(declarative.length > 20, `${declarative.length} declared fields`);
  for (const n of declarative) assert.ok(hud.fields[n], `field ${n} wired`);
  for (const n of ["objectiveLabel", "distance", "time", "banner", "subtitle", "story", "line", "choices"]) {
    assert.ok(hud.fields[n], `field ${n} wired`);
  }
  globalThis.document = original;

  const sample = {
    phase: "play",
    objective: "reach_witness",
    objectiveLabel: "Reach Sade",
    distance: 12.4,
    bearing: -0.6,
    suspicion: 0.5,
    seeing: true,
    stamina: 72,
    exhausted: false,
    crouch: 0,
    running: false,
    noise: 4.4,
    interactProgress: 0.5,
    inWitnessZone: true,
    time: 8.2,
    spotted: 0,
    score: 0,
    rank: "",
    phaseTimer: 0,
  };
  hud.update(sample, { prompt: { text: "Talk to Sade", progress: 0.5 }, banner: null });
  assert.equal(hud.fields.objectiveLabel.textContent, "Reach Sade");
  assert.equal(hud.fields.distance.textContent, "12.4 m");
  assert.equal(hud.fields.time.textContent, "0:08");
  assert.equal(hud.fields.suspicion.hidden, false);
  assert.equal(hud.fields.prompt.hidden, false);
  assert.equal(hud.fields.banner.hidden, true);
  assert.match(hud.fields.progress.style.width, /50%/);
});

test("the page's module graph resolves", () => {
  const root = process.cwd();
  const main = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
  const imports = [...main.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.includes("three"));
  assert.ok(imports.includes("./level.js"));
  for (const spec of imports) {
    if (spec === "three" || spec.startsWith("three/")) continue;
    assert.ok(fs.existsSync(path.join(root, "src", spec)), `import ${spec} exists`);
  }

  // index.html must reference real files and map the bare specifiers.
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /type="importmap"/);
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const [spec, target] of Object.entries(map.imports)) {
    const rel = spec.endsWith("/") ? target : target;
    assert.ok(fs.existsSync(path.join(root, rel)), `import map ${spec} -> ${rel} exists`);
  }
  for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, m[1])), `${m[1]} exists`);
  }
  // Study labelling is not optional.
  assert.match(html, /Unapproved gameplay study/i);
  assert.match(html, /import map|importmap/);
});

test("serve.js serves the page and the shared fonts", async () => {
  const { spawn } = await import("node:child_process");
  const port = 8123;
  const proc = spawn(process.execPath, ["serve.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: "ignore",
  });
  try {
    let ok = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.ok) {
          ok = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(ok, "server starts");
    const index = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Last Call/);
    const glb = await fetch(`http://127.0.0.1:${port}/assets/marcus.glb`);
    assert.equal(glb.status, 200);
    assert.equal(glb.headers.get("content-type"), "model/gltf-binary");
    const font = await fetch(`http://127.0.0.1:${port}/fonts/Inter-Variable.ttf`);
    assert.equal(font.status, 200, "shared brand font is served");
    // Path traversal must not escape the root.
    const evil = await fetch(`http://127.0.0.1:${port}/../AGENTS.md`);
    assert.ok([400, 403, 404].includes(evil.status), `traversal blocked (${evil.status})`);
  } finally {
    proc.kill();
  }
});

test("the camera keeps a usable distance even when cover collapses the boom", async () => {
  const { world, step } = await rig();
  // Put the player against the dumpster row that the crouch-cover shot uses.
  world.player.x = 2.4;
  world.player.z = -19.4;
  world.cameraYaw = Math.PI * 0.75;
  step(90, { crouch: true });
  const c = world.camera;
  const f = world.cameraFocus;
  const d = Math.hypot(c.x - f.x, c.y - f.y, c.z - f.z);
  assert.ok(d > 0.9, `camera stays out of the character, got ${d.toFixed(2)} m`);
  assert.ok(c.y > world.player.feetY + 0.3, "camera stays above the floor");
});

test("the page shell provides every element main.js looks up", async () => {
  const fs = await import("node:fs/promises");
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  const main = await fs.readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const wanted = new Set(
    [...main.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]),
  );
  assert.ok(wanted.size >= 5, "main.js should look up the shell elements");
  for (const id of wanted) assert.ok(ids.has(id), `index.html is missing #${id}`);
});

test("the page shell loads the controls the README documents", async () => {
  const fs = await import("node:fs/promises");
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  const readme = await fs.readFile(new URL("../README.md", import.meta.url), "utf8");
  // Touch buttons exist and are bound, so the phone path is real.
  for (const id of ["touch-run", "touch-crouch", "touch-interact"]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  assert.match(readme, /^\| Touch/m);
  assert.match(readme, /^\| Mouse wheel/m);
});

test("every module main.js imports exists and parses", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const main = await fs.readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const imports = [...main.matchAll(/from\s+"(\.\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(imports.length >= 6);
  for (const spec of imports) {
    const file = new URL(spec, new URL("../src/main.js", import.meta.url));
    const text = await fs.readFile(file, "utf8");
    assert.ok(text.length > 0, `${spec} is empty`);
    const mod = await import(file.href);
    assert.ok(Object.keys(mod).length > 0, `${path.basename(file.pathname)} exports nothing`);
  }
});
