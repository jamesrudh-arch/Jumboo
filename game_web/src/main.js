// Playable browser slice for LEVERAGE: Cinder City.
//
// Scope, per AGENTS.md: this is an unapproved gameplay study. It does not touch
// the approved opening in game/main.tscn and it invents no canon. Level, props
// and collectors are study geometry; only Marcus is approved art. The copy in
// the objective, prompts and banners stays inside M01 "Last Call" and EV-01..06
// of docs/LEVERAGE_narrative_slice_and_state_design.md.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LevelView, loadMarcus } from "./scene.js";
import { CharacterAnimator } from "./anim.js";
import { Hud } from "./hud.js";
import { World, PHASE } from "./world.js";
import { LEVEL, buildLevel } from "./level.js";

const KEY = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
  crouch: ["ControlLeft", "ControlRight", "KeyC"],
  interact: ["KeyE", "Space"],
};

const config = {
  sensitivity: 0.0026,
  invertY: false,
  dragToLook: true,
};

const state = {
  paused: false,
  started: false,
  banner: null,
  bannerUntil: 0,
  lastHud: null,
};

// ------------------------------------------------------------------ renderer
const canvas = document.getElementById("view");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  // Say so on the page instead of leaving a black rectangle: this slice is
  // opened by reviewers on unknown hardware.
  document.getElementById("status").hidden = false;
  document.getElementById("status").dataset.error = "1";
  document.getElementById("status").textContent =
    "This browser could not create a WebGL2 context. The slice needs hardware acceleration enabled.";
  document.getElementById("start").textContent = "WebGL unavailable";
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10171d);
scene.fog = new THREE.Fog(0x16232b, 18, 68);

const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 260);

const button = document.getElementById("start");
const status = document.getElementById("status");
const hud = new Hud(document.body);

function setStatus(text, isError = false) {
  if (!status) return;
  status.textContent = text || "";
  status.hidden = !text;
  status.dataset.error = isError ? "1" : "0";
}

// --------------------------------------------------------------------- world
const built = buildLevel();
const view = new LevelView(scene, built).build();
const world = new World(LEVEL, built);

// The kit's light rig is replaced by the level's own practicals plus one
// shadow-casting sun, which reads better in a night lane than a neutral probe.
if (view.sun) {
  view.sun.castShadow = true;
  view.sun.shadow.mapSize.set(2048, 2048);
  view.sun.shadow.camera.left = -26;
  view.sun.shadow.camera.right = 26;
  view.sun.shadow.camera.top = 26;
  view.sun.shadow.camera.bottom = -26;
  view.sun.shadow.camera.near = 1;
  view.sun.shadow.camera.far = 120;
  view.sun.shadow.bias = -0.0009;
  view.sun.shadow.normalBias = 0.03;
  view.sun.shadow.camera.updateProjectionMatrix();
}

// Mirror the level's practicals into the render graph with cheap, unshadowed
// point lights. They are the lighting the lane is designed around.
const practicals = [];
for (const L of LEVEL.lights) {
  const light = new THREE.PointLight(L.color, L.intensity * 0.06, L.distance, 2);
  light.position.set(L.x, L.y, L.z);
  scene.add(light);
  practicals.push(light);
}

// A faint environment probe gives the metal and glass something to reflect.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment({ intensity: 0.25 }), 0.04).texture;
scene.environmentIntensity = 0.35;

// ------------------------------------------------------------------ character
let marcus = null;
let animator = null;

async function boot() {
  setStatus("Loading Marcus…");
  try {
    marcus = await loadMarcus(
      scene,
      (p) => setStatus(`Loading Marcus… ${Math.round(p * 100)}%`),
      "./assets/marcus.glb",
    );
    animator = new CharacterAnimator(marcus, LEVEL);
    if (!marcus.skinReport.ok) {
      setStatus(`Character rig problem: ${marcus.skinReport.reason}`, true);
    } else {
      setStatus("");
    }
  } catch (err) {
    console.error(err);
    setStatus("Could not load the character asset. The lane is playable without it.", true);
  }
  button.hidden = false;
  button.disabled = false;
  button.textContent = "Begin";
  button.focus();
  state.ready = true;
}

// --------------------------------------------------------------------- input
const keys = new Set();
let dragging = false;
let dragMoved = 0;
let pointerLocked = false;

function axis(positive, negative) {
  const p = positive.some((k) => keys.has(k)) ? 1 : 0;
  const n = negative.some((k) => keys.has(k)) ? 1 : 0;
  return p - n;
}

function readIntent() {
  return {
    moveX: axis(KEY.right, KEY.left),
    moveZ: axis(KEY.forward, KEY.back),
    run: KEY.run.some((k) => keys.has(k)),
    crouch: KEY.crouch.some((k) => keys.has(k)),
    interact: KEY.interact.some((k) => keys.has(k)),
  };
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Escape") togglePause();
  if (e.code === "Enter" && !state.started) start();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

canvas.addEventListener("pointerdown", (e) => {
  if (!state.started) return;
  dragging = true;
  dragMoved = 0;
  canvas.setPointerCapture(e.pointerId);
  if (config.dragToLook && !pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock();
});
canvas.addEventListener("pointerup", (e) => {
  dragging = false;
  if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!state.started || state.paused) return;
  // Drag-to-look works without pointer lock; locked mode uses raw movement.
  if (pointerLocked || dragging) {
    dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
    world.look(
      e.movementX * config.sensitivity,
      (config.invertY ? -e.movementY : e.movementY) * config.sensitivity,
    );
  }
});
document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
});

// Touch: left half is a stick, right half drags the camera.
const touchState = { stick: null, look: null };
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!state.started) return;
    for (const t of e.changedTouches) {
      const isLeft = t.clientX < window.innerWidth / 2;
      if (isLeft && !touchState.stick) touchState.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
      else if (!isLeft && !touchState.look) touchState.look = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  },
  { passive: true },
);
canvas.addEventListener(
  "touchmove",
  (e) => {
    for (const t of e.changedTouches) {
      if (touchState.stick && t.identifier === touchState.stick.id) {
        touchState.stick.x = t.clientX;
        touchState.stick.y = t.clientY;
      } else if (touchState.look && t.identifier === touchState.look.id) {
        world.look((t.clientX - touchState.look.x) * 0.005, (t.clientY - touchState.look.y) * 0.004);
        touchState.look.x = t.clientX;
        touchState.look.y = t.clientY;
      }
    }
  },
  { passive: true },
);
const endTouch = (e) => {
  for (const t of e.changedTouches) {
    if (touchState.stick && t.identifier === touchState.stick.id) touchState.stick = null;
    if (touchState.look && t.identifier === touchState.look.id) touchState.look = null;
  }
};
canvas.addEventListener("touchend", endTouch, { passive: true });
canvas.addEventListener("touchcancel", endTouch, { passive: true });

function touchIntent() {
  const s = touchState.stick;
  if (!s) return { moveX: 0, moveZ: 0, run: false, crouch: false, interact: false };
  const dx = (s.x - s.x0) / 56;
  const dy = (s.y - s.y0) / 56;
  const mag = Math.hypot(dx, dy);
  const k = mag > 1 ? 1 / mag : 1;
  return {
    moveX: Math.max(-1, Math.min(1, dx * k)),
    moveZ: Math.max(-1, Math.min(1, -dy * k)),
    run: mag > 0.85,
    crouch: false,
    interact: false,
  };
}

// ---------------------------------------------------------------------- loop
function togglePause() {
  if (!state.started) return;
  state.paused = !state.paused;
  if (state.paused) {
    if (document.pointerLockElement) document.exitPointerLock();
    pauseEl.hidden = false;
  } else {
    pauseEl.hidden = true;
  }
}

/** Merge keyboard/touch intent with an optional gamepad (standard mapping). */
function withGamepad(intent) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && Array.from(pads).find((p) => p && p.connected);
  if (!pad) return intent;
  const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
  const lx = dz(pad.axes[0] || 0);
  const ly = dz(pad.axes[1] || 0);
  const rx = dz(pad.axes[2] || 0);
  const ry = dz(pad.axes[3] || 0);
  const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  if (rx || ry) world.look(rx * 0.045, ry * 0.03);
  return {
    moveX: lx || intent.moveX,
    moveZ: -ly || intent.moveZ,
    run: intent.run || btn(5) || btn(7),
    crouch: intent.crouch || btn(1) || btn(10),
    interact: intent.interact || btn(0),
  };
}

function start() {
  if (!state.ready || state.started) return;
  state.started = true;
  state.paused = false;
  button.hidden = true;
  titleEl.hidden = true;
  pauseEl.hidden = true;
  hud.visible = true;
  world.start();
  last = performance.now();
  if (canvas.requestPointerLock) canvas.requestPointerLock();
}

const titleEl = document.getElementById("title");
const pauseEl = document.getElementById("pause");
button.addEventListener("click", start);
document.getElementById("resume")?.addEventListener("click", togglePause);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/** Banner copy stays inside M01 "Last Call" and EV-01..EV-06. */
function bannerFor(event) {
  switch (event.type) {
    case "talked":
      return { title: "Sade talked.", body: "Get to the loading lane before the collectors close it.", ms: 3600 };
    case "spotted":
      return { title: "Spotted.", body: "Break line of sight and get quiet.", ms: 2200 };
    case "heard":
      return { title: "Heard something.", body: "Move slower, or crouch.", ms: 1600 };
    case "caught":
      return { title: "Taken.", body: "The collectors walk you back to the shop front.", ms: 2600 };
    case "won": {
      const hudNow = world.hud();
      return {
        title: "Lane reached.",
        body: `${formatScore(hudNow)} · ${hudNow.spotted} spotted · ${fmt(hudNow.time)}`,
        ms: 6000,
      };
    }
    case "checkpoint":
      return null;
    default:
      return null;
  }
}

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const formatScore = (h) => `${Math.max(0, Math.round(h.score))} points`;

let last = performance.now();
let acc = 0;
const FIXED = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (!state.started || state.paused) {
    if (animator) animator.update(dtReal);
    render(now / 1000);
    return;
  }

  // Fixed-step simulation keeps movement, detection and stealth deterministic
  // and matches the tuned numbers in World.
  acc += dtReal;
  let steps = 0;
  while (acc >= FIXED && steps < 6) {
    const intent = withGamepad(keys.size ? readIntent() : touchIntent());
    world.setInput(intent);
    world.update(FIXED);
    if (animator) animator.step(world, FIXED);
    acc -= FIXED;
    steps++;
  }
  if (steps === 6) acc = 0;

  for (const e of world.drainEvents()) {
    const b = bannerFor(e);
    if (b) {
      state.banner = b;
      state.bannerUntil = now + b.ms;
    }
    if (e.type === "won") keys.clear();
  }
  view.syncCharacters(world);
  view.update(dtReal, world.time, world.hud());

  render(now / 1000);
  updateHud(now);
}

function render(elapsed) {
  const cam = world.camera;
  camera.position.set(cam.x, cam.y, cam.z);
  const focus = world.cameraFocus || { x: world.player.x, y: world.player.feetY + 1.3, z: world.player.z };
  camera.lookAt(focus.x, focus.y, focus.z);
  renderer.render(scene, camera);
  void elapsed;
}

function updateHud(now) {
  const h = world.hud();
  state.lastHud = h;
  const active = state.banner && now < state.bannerUntil ? state.banner : null;
  let banner = active;
  // Before the run starts and after it ends, the banner states the objective
  // instead of flashing for a few frames.
  if (!banner && world.phase === PHASE.BRIEFING) {
    banner = { title: "Last Call", body: "Reach Sade at the stall. Keep off the collectors' line." };
  }
  if (!banner && world.phase === PHASE.CAUGHT) {
    banner = { title: "Taken.", body: "The collectors walk you back to the shop front." };
  }
  if (!banner && world.phase === PHASE.WON) {
    banner = { title: "Lane reached.", body: `${formatScore(h)} · ${h.spotted} spotted · ${fmt(h.time)}` };
  }
  const prompt = h.inWitnessZone && !world.talkedToWitness
    ? { text: "Talk to Sade", progress: h.interactProgress }
    : null;
  hud.update(h, { prompt, banner });
}

boot();
requestAnimationFrame(frame);

// Expose a small handle for the smoke test and for tuning in the console.
window.LEVERAGE = { THREE, scene, camera, world, view, hud, state, config };
