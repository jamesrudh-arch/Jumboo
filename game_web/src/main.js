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
import { CITY, buildCity } from "./city.js";
import { CityView, makeVehicleMesh, makePedestrianMesh } from "./cityview.js";
import { detectTierFromWindow } from "./config.js";
import { Weather, Wetness } from "./weather.js";
import { createAudio } from "./audio.js";
import { applyGamepad, firstConnectedPad } from "./input.js";
import { loadKit, loadCityKit, loadKenneyPack } from "./kit.js";
import { Arena } from "./arena.js";
import { CombatHud } from "./combathud.js";
import { WeaponRack, MuzzleFlash } from "./weaponview.js";
import { WEAPONS, weaponById } from "./arsenal.js";

const KEY = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
  crouch: ["ControlLeft", "ControlRight", "KeyC"],
  interact: ["KeyE", "Space"],
  // Combat. F fires, R reloads, Q cycles the arsenal, G throws a frag, and the
  // number keys jump straight to a weapon so a player never has to cycle past
  // the pistol to reach the thing they need.
  fire: ["KeyF"],
  reload: ["KeyR"],
  cycle: ["KeyQ"],
  grenade: ["KeyG"],
  aim: ["ShiftRight"],
  weapon1: ["Digit1"], weapon2: ["Digit2"], weapon3: ["Digit3"],
  weapon4: ["Digit4"], weapon5: ["Digit5"], weapon6: ["Digit6"],
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
// Everything expensive is gated by the hardware tier, so the same build runs on
// a phone and on a desktop without a second code path.
const tier = detectTierFromWindow(window);
const canvas = document.getElementById("view");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, powerPreference: "high-performance" });
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatio));
renderer.shadowMap.enabled = tier.shadows;
renderer.shadowMap.type = tier.name === "phone" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d141a);
scene.fog = new THREE.Fog(0x17242c, tier.fogNear, tier.fogFar);

// Weather drifts on its own clock: sky, fog, rain rate, wind and exposure all
// come from one blend, so the district never looks the same twice.
const weather = new Weather({
  start: "drizzle",
  allowLightning: tier.name !== "phone" && !matchMedia("(prefers-reduced-motion: reduce)").matches,
  onEvent: (e) => {
    if (e.type === "weather-change") {
      state.banner = { title: "The weather turns.", body: `${e.label}. The street gets harder to read.`, ms: 2600 };
      state.bannerUntil = performance.now() + 2600;
    }
    if (e.type === "lightning") {
      state.flashUntil = performance.now() + 320;
    }
  },
});
const wetness = new Wetness();
// Synthesised city audio: no files, so nothing to license and nothing to load.
const audio = createAudio(window);

const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, tier.drawDistance * 1.6);

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
const view = new LevelView(scene, built, { district: true }).build();

// The district wraps around the approved lane. It is study environment: a
// procedural city that gives the beat somewhere to breathe.
const cityBuilt = buildCity(CITY, tier);
const cityView = new CityView(scene, CITY, cityBuilt, tier).build();

const world = new World(LEVEL, { ...built, boxes: cityBuilt.boxes }, {
  city: CITY,
  cityBoxes: cityBuilt.boxes,
  cityBuilt,
  tier: { ...tier, ...built },
  seed: 20261127,
  aggression: 0.5,
});
// The lane's own cover still has to collide.
world.openBoxes = cityBuilt.boxes.concat(built.boxes);

// The kit's light rig is replaced by the level's own practicals plus one
// shadow-casting sun, which reads better in a night lane than a neutral probe.
if (view.sun) {
  view.sun.castShadow = tier.shadows;
  view.sun.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
  view.sun.shadow.camera.left = -30;
  view.sun.shadow.camera.right = 30;
  view.sun.shadow.camera.top = 30;
  view.sun.shadow.camera.bottom = -30;
  view.sun.shadow.camera.near = 1;
  view.sun.shadow.camera.far = 120;
  view.sun.shadow.bias = -0.0009;
  view.sun.shadow.normalBias = 0.03;
  view.sun.shadow.camera.updateProjectionMatrix();
}

// Mirror the level's practicals into the render graph with cheap, unshadowed
// point lights. They are the lighting the lane is designed around.
const practicals = [];
const laneLightBudget = tier.name === "phone" ? 2 : tier.name === "laptop" ? 4 : LEVEL.lights.length;
LEVEL.lights.slice(0, laneLightBudget).forEach((L) => {
  const light = new THREE.PointLight(L.color, L.intensity * 0.06, L.distance, 2);
  light.position.set(L.x, L.y, L.z);
  scene.add(light);
  practicals.push({ light, spec: L, base: light.intensity });
});
// The district's own street lamps already brought their budgeted lights with
// them in CityView; this list is only the approved lane's practicals.

// A faint environment probe gives the metal and glass something to reflect.
// Skipped on phones, where the PMREM pass is not worth the memory.
if (tier.name !== "phone") {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment({ intensity: 0.25 }), 0.04).texture;
  scene.environmentIntensity = 0.35;
}

// ------------------------------------------------------------------ character
let marcus = null;
let animator = null;
let trafficViews = [];
let pedViews = [];
// The street-level asset kit (CC0, vendored). When it loads, traffic and parked
// cars are the kit's models instead of extruded boxes; if it fails the game
// falls back to the generated meshes rather than looking broken.
let kit = null;
let cityKitRef = null; // trees and parks
let waterKitRef = null; // watercraft
const errandMarkers = [];

// ------------------------------------------------------------------ the fight
// The arena owns the wave, the cast and the trigger. It is created here but not
// attached until the character and the street exist, because it places bodies on
// the ground the world has already built.
let arena = null;
let combatHud = null;
let weaponRack = null;
let muzzleFlash = null;
let heldWeapon = null;
let heldId = null;
let combatEnabled = false;
const combatButtons = { fire: false, reload: false, cycle: false, aim: false };

/** Meshes for the live traffic and the crowd (built once, then moved). */
function buildStreetActors() {
  if (!world.traffic) return;
  for (const v of world.traffic.vehicles) {
    const mesh = kit ? makeKitVehicle(v) : makeVehicleMesh(v.kind);
    mesh.userData.vehicle = v;
    scene.add(mesh);
    trafficViews.push(mesh);
  }
  if (world.crowd) {
    for (const person of world.crowd.people) {
      const mesh = makePedestrianMesh(person.tone);
      mesh.userData.person = person;
      scene.add(mesh);
      pedViews.push(mesh);
    }
  }
}

/**
 * A kit car scaled to the simulation's vehicle size. The kit models are authored
 * around 0.9 m long, which is a display scale; the simulation's cars are real
 * metres, so each kind is scaled to the same footprint the old box cars used.
 * Wheels are returned in userData.wheels so they can roll with speed.
 */
const KIT_CAR_FOR = { sedan: "car_sedan", van: "car_hatchback", truck: "car_stationwagon" };
function makeKitVehicle(v) {
  const target = v.kind === "truck" ? [2.4, 2.9, 7.4] : v.kind === "van" ? [2.0, 2.2, 5.4] : [1.85, 1.4, 4.3];
  const name = KIT_CAR_FOR[v.kind] || "car_sedan";
  const group = kit.make(name) || makeVehicleMesh(v.kind);
  const size = group.userData.size;
  if (size && size.x > 0.01 && size.z > 0.01) {
    // Width and length from the simulation, height from the model so the
    // silhouette keeps the kit's proportions.
    const sx = target[0] / size.x;
    const sz = target[2] / size.z;
    group.scale.set(sx, (sx + sz) / 2, sz);
  }
  // A tail-light pair, so braking still reads. The kit's cars are textured, not
  // lit, and a night street needs the red.
  const lamps = new THREE.Group();
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x531f1a,
    emissive: 0xe88771,
    emissiveIntensity: 1.4,
    roughness: 0.5,
  });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.06), tailMat);
    lamp.position.set(side * target[0] * 0.32, target[1] * 0.62, -target[2] / 2 - 0.02);
    lamps.add(lamp);
  }
  group.add(lamps);
  group.userData.tailMaterial = tailMat;
  return group;
}

/** Copy simulation state onto the street actors. */
// Errand markers: a column of light and a ring on the ground, so a district
// objective is findable from a block away.
function buildErrandMarkers() {
  if (!world.errands) return;
  for (const e of world.errands) {
    const geo = new THREE.CylinderGeometry(1.5, 1.5, 2.4, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe0b77e,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.name = `errand-${e.id}`;
    beam.position.set(e.x, 1.2, e.z);
    scene.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.8, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0b77e, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(e.x, 0.06, e.z);
    scene.add(ring);
    errandMarkers.push({ errand: e, beam, ring });
  }
}

function syncErrandMarkers(elapsed) {
  for (const m of errandMarkers) {
    const live = !m.errand.done;
    m.beam.visible = live;
    m.ring.visible = live;
    if (!live) continue;
    // A slow pulse reads as "come here" without shouting.
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
    m.beam.material.opacity = 0.08 + pulse * 0.1;
    m.ring.material.opacity = 0.25 + pulse * 0.25;
    m.ring.rotation.z = elapsed * 0.3;
  }
}

function syncStreetActors(dt) {
  for (const mesh of trafficViews) {
    const v = mesh.userData.vehicle;
    mesh.position.set(v.x, 0, v.z);
    mesh.rotation.y = v.yaw;
    // Braking cars flare their tail lights and dim the road wash, so a car
    // stopping ahead of you is readable from behind. The lamps are one merged
    // mesh per car, so the flare is one material write, not four.
    const tail = mesh.userData.tailMaterial;
    if (tail) tail.emissiveIntensity = v.braking ? 3.4 : 1.4;
    const wash = mesh.userData.headlight;
    if (wash) wash.material.opacity = v.braking ? 0.05 : v.speed > 0.5 ? 0.12 : 0.03;
    // Kit cars have real wheels on their own nodes: roll them at the speed the
    // simulation says, which no box car could do.
    const wheels = mesh.userData.wheels;
    if (wheels && wheels.length) {
      const spin = (v.speed || 0) * dt * 2.6;
      for (const wheel of wheels) wheel.rotation.x -= spin;
    }
  }
  for (const mesh of pedViews) {
    const p = mesh.userData.person;
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.yaw;
    const legs = mesh.userData.legs;
    if (legs) {
      const swing = Math.sin(p.walkPhase) * (p.panic > 0.2 ? 0.75 : 0.42);
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
    }
    void dt;
  }
}

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
  setStatus("Loading street kit…");
  try {
    kit = await loadKit(renderer, {
      onProgress: (p) => setStatus(`Loading street kit… ${Math.round(p * 100)}%`),
    });
  } catch (err) {
    // A missing kit is a downgrade, not a failure: the generated street stands.
    console.warn("[kit] street kit unavailable, using generated actors", err);
    kit = null;
  }

  // The cast and the arsenal. Both are optional in the sense that a failure
  // leaves the stealth slice playable, but a failure is loud in the console
  // because a missing enemy model is a design defect, not weather.
  setStatus("Loading the cast…");
  arena = new Arena({ audio });
  try {
    const cast = await arena.preload((p) => setStatus(`Loading the cast… ${Math.round(p * 100)}%`));
    console.log(`[cast] ${cast.loaded}/${cast.requested} models, ${cast.tris} tris, ${cast.bones} bones max`);
  } catch (err) {
    console.warn("[cast] the roster fell back to proxy bodies", err);
  }
  try {
    weaponRack = new WeaponRack();
    const report = await weaponRack.preload(WEAPONS, (p) => setStatus(`Loading the arsenal… ${Math.round(p * 100)}%`));
    console.log(`[arsenal] ${report.loaded}/${report.requested} models, ${report.tris} tris`);
  } catch (err) {
    console.warn("[arsenal] weapons fell back to stubs", err);
  }
  setStatus("Loading trees and parks…");
  let cityKit = null;
  try {
    cityKit = await loadCityKit(renderer, {
      onProgress: (p) => setStatus(`Loading trees and parks… ${Math.round(p * 100)}%`),
    });
  } catch (err) {
    console.warn("[kit] city kit unavailable, using generated trees", err);
  }
  // Watercraft: the harbour and canal exist with nothing in them.
  let waterKit = null;
  try {
    waterKit = await loadKenneyPack("water", ["boat-fishing-small", "boat-tow-a",
      "boat-speed-b", "boat-speed-c", "ship-cargo-a", "ship-cargo-b", "boat-tug-a",
      "boat-house-a", "boat-row-small", "boat-fan"], {});
  } catch (err) {
    console.warn("[kit] watercraft unavailable", err);
  }
  cityKitRef = cityKit;
  waterKitRef = waterKit;
  setStatus("");
  // Swap the generated street furniture for the kit's where the kit has a match.
  if (kit) {
    try {
      cityView.applyKit(kit);
    } catch (err) {
      console.warn("[kit] street furniture swap failed", err);
    }
  }
  if (waterKit) {
    try {
      cityView.applyWaterKit(waterKit);
    } catch (err) {
      console.warn("[kit] water swap failed", err);
    }
  }
  // Then the trees and parks, which the street kit does not cover.
  if (cityKit) {
    try {
      cityView.applyCityKit(cityKit);
    } catch (err) {
      console.warn("[kit] tree and park swap failed", err);
    }
  }
  buildStreetActors();
  buildErrandMarkers();
  button.hidden = false;
  button.disabled = false;
  button.textContent = "Begin";
  button.focus();
  // Attach the arena now that the world and the street both exist.
  combatHud = new CombatHud();
  muzzleFlash = new MuzzleFlash();
  arena.attach(scene, world);
  arena.handlers.onWaveStart = (wave) => {
    state.banner = { title: `Wave ${wave.n}`, body: wave.name, ms: 2400 };
    state.bannerUntil = performance.now() + 2400;
    refreshHeldWeapon();
  };
  arena.handlers.onWaveEnd = (e) => {
    state.banner = { title: `Wave ${e.wave} cleared`, body: "Choose: 1, 2 or 3.", ms: 5200 };
    state.bannerUntil = performance.now() + 5200;
    pendingOffer = e.offer;
  };
  arena.handlers.onDeath = () => {
    state.banner = { title: "Taken.", body: "Press R to get up. Your score stays.", ms: 4000 };
    state.bannerUntil = performance.now() + 4000;
  };
  arena.handlers.onHurt = () => {
    // A wounded frame reads as damage without a full-screen red wash, which
    // would fight the night palette.
    state.hurtUntil = performance.now() + 220;
  };

  state.ready = true;
}

// --------------------------------------------------------------- the weapon
/** Mount the held weapon on the character's right hand. */
function refreshHeldWeapon() {
  if (!arena || !marcus || !weaponRack) return;
  const weapon = arena.run.loadout.weapon;
  if (weapon.id === heldId) return;
  heldId = weapon.id;

  // Find a hand bone. The rig's names are not guaranteed, so fall back through
  // the plausible ones and finally to the root.
  const hand = findBone(marcus.root, [/^hand_R$/i, /right.?hand/i, /hand\.R/i, /_R_hand/i, /handR/i]);
  const target = hand ?? marcus.root;
  if (heldWeapon) {
    heldWeapon.parent?.remove(heldWeapon);
    heldWeapon = null;
  }
  heldWeapon = weaponRack.mount(weapon);
  heldWeapon.scale.setScalar(0.62);
  // The rig's hand space is centimetres (see loadMarcus), so the mount inherits
  // that and only needs a small offset to sit in the palm.
  heldWeapon.position.set(0, 0, 0);
  target.add(heldWeapon);
  if (muzzleFlash) {
    muzzleFlash.group.position.set(0, 0, -0.22);
    heldWeapon.add(muzzleFlash.group);
  }
  console.log(`[weapon] holding ${weapon.name} on ${target.name || "the root"}`);
}

function findBone(root, patterns) {
  let found = null;
  root.traverse((o) => {
    if (found || !o.isBone) return;
    for (const p of patterns) if (p.test(o.name)) { found = o; break; }
  });
  return found;
}

/** The trigger, called once per frame while the button is held. */
function pullTrigger(dt) {
  if (!arena || !combatEnabled) return;
  const result = arena.fire(dt);
  if (!result) return;
  if (result.dry) {
    state.banner = { title: "Empty", body: "R to reload.", ms: 900 };
    state.bannerUntil = performance.now() + 900;
    return;
  }
  if (result.hit?.hit && combatHud) {
    combatHud.markHit(performance.now(), Boolean(result.killed));
  }
  if (muzzleFlash && result.weapon?.mode !== "melee") {
    muzzleFlash.fire(arena.feel.muzzle.strength, 0.06);
  }
}

let pendingOffer = null;

/** --------------------------------------------------------------------- input
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
  if (handleCombatKey(e.code)) return;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});

/**
 * Combat keys. Returns true when the key was consumed, so the movement layer
 * does not also act on it. Every branch is a single press: firing holds the key,
 * which is handled in the frame loop from `keys`, not here.
 */
function handleCombatKey(code) {
  if (!arena || !state.started || state.paused) return false;
  const run = arena.run;
  if (code === KEY.reload[0]) { arena.reload(); return true; }
  if (code === KEY.cycle[0]) { arena.cycle(1); refreshHeldWeapon(); return true; }
  if (code === KEY.grenade[0]) {
    // The frag is a weapon in the ladder, so "throw" is just "switch to it and
    // fire once" rather than a parallel system.
    if (run.loadout.has("grenade")) {
      const prev = run.loadout.current;
      run.loadout.select("grenade");
      pullTrigger(1 / 60);
      run.loadout.select(prev);
      refreshHeldWeapon();
    }
    return true;
  }
  // Between waves, 1..3 take an offer. Outside that, they select a weapon.
  if (/^Digit[1-6]$/.test(code)) {
    const n = Number(code.slice(5)) - 1;
    if (run.state === "between" && pendingOffer?.[n]) {
      const choice = pendingOffer[n];
      pendingOffer = null;
      state.banner = null;
      arena.advance(choice);
      combatEnabled = true;
      refreshHeldWeapon();
      return true;
    }
    const owned = run.loadout.snapshot().owned;
    const id = owned[n];
    if (id) { arena.select(id); refreshHeldWeapon(); }
    return true;
  }
  // A dead player gets up. Death costs the wave, not the run.
  if (run.state === "dead" && code === "KeyR") {
    pendingOffer = null;
    arena.retry();
    combatEnabled = true;
    refreshHeldWeapon();
    return true;
  }
  return false;
}
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
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    world.setCameraDistance(world.cameraDistance + Math.sign(e.deltaY) * 0.45);
  },
  { passive: false },
);

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
});

// Touch: left half is a stick, right half drags the camera.
const touchState = { stick: null, look: null, run: false, crouch: false, interact: false };

// On-screen buttons. They are a real touch path, not decoration: without them
// a phone player cannot crouch or interact at all.
function bindHoldButton(id, onDown, onUp) {
  const el = typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null;
  if (!el) return;
  const down = (e) => {
    e.preventDefault();
    el.classList.add("held");
    onDown();
  };
  const up = (e) => {
    if (e) e.preventDefault();
    el.classList.remove("held");
    onUp();
  };
  el.addEventListener("pointerdown", down, { passive: false });
  el.addEventListener("pointerup", up, { passive: false });
  el.addEventListener("pointercancel", up, { passive: false });
  el.addEventListener("pointerleave", up, { passive: false });
}
bindHoldButton("touch-run", () => { touchState.run = true; }, () => { touchState.run = false; });
bindHoldButton("touch-crouch", () => { touchState.crouch = true; }, () => { touchState.crouch = false; });
bindHoldButton("touch-interact", () => { touchState.interact = true; }, () => { touchState.interact = false; });
// A phone has no Escape key, so pause needs its own target. It is a tap, not a
// hold, and it stops the simulation without clearing the run.
document.getElementById("touch-pause")?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  togglePause();
}, { passive: false });
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
  const base = {
    moveX: 0,
    moveZ: 0,
    run: touchState.run,
    crouch: touchState.crouch,
    interact: touchState.interact,
  };
  // Interact is a press, not a hold: clear it once it has been read.
  touchState.interact = false;
  if (!s) return base;
  const dx = (s.x - s.x0) / 56;
  const dy = (s.y - s.y0) / 56;
  const mag = Math.hypot(dx, dy);
  const k = mag > 1 ? 1 / mag : 1;
  return {
    ...base,
    moveX: Math.max(-1, Math.min(1, dx * k)),
    moveZ: Math.max(-1, Math.min(1, -dy * k)),
    // Push the stick to the rim to sprint, unless Run is held down.
    run: base.run || mag > 0.92,
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

let padPauseHeld = false;

/** Merge keyboard/touch intent with an optional gamepad (standard mapping). */
function withGamepad(intent) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const merged = applyGamepad(firstConnectedPad(pads), intent);
  if (merged.look) world.look(merged.look.dx, merged.look.dy);
  // Start is a tap, not a hold: fire once on the press edge.
  if (merged.pause && !padPauseHeld) togglePause();
  padPauseHeld = merged.pause;
  return merged.intent;
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
  audio.start();
  // The fight starts where the game says it starts: unarmed.
  if (arena) {
    combatEnabled = true;
    arena.startWave();
    refreshHeldWeapon();
  }
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
    case "hit-by-car":
      return { title: "Hit.", body: "The street does not stop for you. Get clear.", ms: 1800 };
    case "drowned":
      return { title: "In the water.", body: "Back to the last solid ground.", ms: 2000 };
    case "chaos":
      return chaosBanner(event);
    case "checkpoint":
      return null;
    default:
      return null;
  }
}

/** Only events the player can perceive get a banner; the rest stay in the log. */
function chaosBanner(event) {
  const near = (px, pz) => Math.hypot(px - world.player.x, pz - world.player.z) < 30;
  switch (event.kind) {
    case "jam":
      return near(event.x, event.z) ? { title: "Traffic stops.", body: "Something ahead has jammed the lane.", ms: 2200 } : null;
    case "sweep":
      return near(event.x, event.z) ? { title: "Watch the road.", body: "A car is not slowing down.", ms: 1800 } : null;
    case "power":
      return { title: "The lights stutter.", body: "Stay off the pavement until they settle.", ms: 2000 };
    case "panic":
      return near(event.x, event.z) ? { title: "Someone runs.", body: "People are moving. So are the collectors.", ms: 1800 } : null;
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
    weather.update(dtReal);
    wetness.update(dtReal, weather.rainRate);
    if (animator) animator.update(dtReal);
    cityView.update(dtReal, camera, weather, wetness.level);
    render(now / 1000, dtReal);
    return;
  }
  weather.update(dtReal);
  wetness.update(dtReal, weather.rainRate);

  // Fixed-step simulation keeps movement, detection and stealth deterministic
  // and matches the tuned numbers in World.
  acc += dtReal;
  let steps = 0;
  while (acc >= FIXED && steps < 6) {
    const intent = withGamepad(keys.size ? readIntent() : touchIntent());
    world.setInput(intent);
    world.update(FIXED);
    if (animator) animator.step(world, FIXED);

    // The fight steps on the same fixed clock as the stealth simulation, so a
    // punch lands at the same moment at 30 fps as at 144.
    if (arena && combatEnabled) {
      arena.combat.aiming = keys.has("ShiftRight");
      if (keys.has("KeyF")) pullTrigger(FIXED);
      arena.step(FIXED);
    }
    if (muzzleFlash) muzzleFlash.tick(FIXED);
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
  if (combatHud && arena) {
    combatHud.visible = combatEnabled;
    combatHud.update(arena.hud(), now);
  }
  cityView.update(dtReal, camera, weather, wetness.level);
  syncStreetActors(dtReal);
  syncErrandMarkers(now / 1000);
  updateAudio(dtReal);

  render(now / 1000, dtReal);
  updateHud(now);
}

function updateAudio(dt) {
  if (!audio.enabled) return;
  audio.update(dt, {
    weather,
    player: world.player,
    cameraYaw: world.cameraYaw,
    vehicles: world.traffic ? world.traffic.vehicles : [],
    phase: world.phase,
  });
  // Footsteps follow the animation phase, so they land on the foot, not on a
  // timer: the phase crosses 0.5 once per stride.
  if (animator) {
    audio.footsteps(animator.phase % 1, {
      running: world.player.running,
      crouch: world.player.crouch > 0.5,
      wet: wetness.level > 0.45,
      moving: world.player.moving && !world.player.falling,
    });
  }
  if (weather.rumble > 2.25) audio.play("thunder", { gain: 0.5 });
}

function updateFlicker(elapsed) {
  // Practicals stutter when the chaos director cuts power, and one lamp in the
  // lane fails on its own as before.
  for (const p of practicals) {
    const spec = p.spec;
    if (spec.flicker > 0) spec.flicker -= 0.016;
    const base = p.base;
    if (spec.flicker > 0) {
      const n = Math.sin(elapsed * 47.3) * Math.sin(elapsed * 13.1);
      p.light.intensity = base * (n > 0.1 ? 0.15 : 1.1);
    } else {
      p.light.intensity = base;
    }
  }
}

function render(elapsed, dt = 1 / 60) {
  updateFlicker(elapsed);
  weather.apply(scene, tier);
  // Ambient fill follows the weather so a downpour is dim but never black.
  const hemiTarget = (weather.blend.ambient ?? 0.5) * 1.15;
  if (view.hemi) view.hemi.intensity += (hemiTarget - view.hemi.intensity) * Math.min(1, dt * 1.5);
  if (view.moon) view.moon.intensity = 0.55 + (weather.blend.ambient ?? 0.5) * 0.7;

  // Flash frames are a single short lift in exposure, not a full white overlay.
  renderer.toneMappingExposure =
    (weather.blend.exposure || 1.02) * (weather.flash > 0.05 ? 1 + weather.flash * 0.9 : 1);
  // Shake is applied to the camera after the world has placed it, never to the
  // world's own camera state, so the shake cannot accumulate into drift.
  if (arena && combatEnabled) arena.applyShake(world);
  const cam = world.camera;
  camera.position.set(cam.x, cam.y, cam.z);
  const focus = world.cameraFocus || { x: world.player.x, y: world.player.feetY + 1.3, z: world.player.z };
  camera.lookAt(focus.x, focus.y, focus.z);
  if (world.cameraRoll) camera.rotateZ(world.cameraRoll);
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
  // Prompt priority: the approved beat first, then a street errand.
  const prompt = h.inWitnessZone && !world.talkedToWitness
    ? { text: "Talk to Sade", progress: h.interactProgress }
    : h.errand
      ? { text: h.errand.label, progress: h.errand.progress }
      : null;
  const lastChaos = world.chaosEvents[world.chaosEvents.length - 1];
  hud.update(h, {
    prompt,
    banner,
    weather: weather.blend.label,
    wet: wetness.level,
    chaos: world.chaosEvents.length,
    chaosLabel: lastChaos ? lastChaos.label : "",
  });
}

boot();
requestAnimationFrame(frame);

// Expose a small handle for the smoke test and for tuning in the console.
// Exposed for the browser smoke test (tools/smoke.mjs) and for debugging the
// live page. The kits are on it so the test can assert they actually loaded
// rather than trusting a console line.
window.LEVERAGE = {
  THREE, scene, camera, world, view, cityView, cityBuilt, hud, state, config, tier, weather, wetness,
  kits: { street: kit, city: cityKitRef, water: waterKitRef },
};
