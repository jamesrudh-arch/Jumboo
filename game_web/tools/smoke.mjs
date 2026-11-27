// Browser smoke test for the playable slice.
//
//   npm run serve          # in one terminal
//   npm run smoke          # in another
//
// It loads the real page with a real WebGL context, presses real keys, and
// checks that the simulation, the character, the camera and the HUD respond.
// Skips (exit 0 with a note) when no browser automation is available, so it
// never blocks a machine without one.

import { spawn } from "node:child_process";
import fs from "node:fs";

const url = process.env.SMOKE_URL || "http://127.0.0.1:8080/";
const failures = [];
const notes = [];

function check(name, ok, detail = "") {
  if (ok) console.log(`  ok   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    /* not installed */
  }
  try {
    return await import("playwright-core");
  } catch {
    /* not installed */
  }
  return null;
}

async function waitForServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log("smoke: playwright is not installed — skipping browser checks.");
  console.log("       install with: npm i -D playwright && npx playwright install chromium");
  process.exit(0);
}

if (!(await waitForServer())) {
  console.error(`smoke: no server at ${url}. Start it with "npm run serve".`);
  process.exit(1);
}

const browser = await playwright.chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(url, { waitUntil: "domcontentloaded" });

// WebGL available at all? If not, report honestly rather than pretending.
const hasGL = await page.evaluate(() => {
  const c = document.createElement("canvas");
  return !!(c.getContext("webgl2") || c.getContext("webgl"));
});
check("browser exposes WebGL", hasGL);
if (!hasGL) {
  await browser.close();
  process.exit(1);
}

// The start button only enables once the character has loaded.
await page.waitForFunction(() => {
  const b = document.getElementById("start");
  return b && !b.disabled;
}, null, { timeout: 90000 }).catch(() => {});
const ready = await page.evaluate(() => !document.getElementById("start").disabled);
check("character loads and enables Begin", ready);
if (!ready) {
  const status = await page.evaluate(() => document.getElementById("status")?.textContent || "");
  notes.push(`status: ${status}`);
}

await page.click("#start");
await page.waitForTimeout(700);

const boot = await page.evaluate(() => {
  const g = window.LEVERAGE;
  return {
    started: g.state.started,
    hasCharacter: !!g.scene.getObjectByName("char1") || !!g.scene.getObjectByProperty("isSkinnedMesh", true),
    playerZ: g.world.player.z,
    phase: g.world.phase,
    drawCalls: g.view && g.view.root ? g.view.root.children.length : 0,
  };
});
check("run starts", boot.started);
check("approved character is in the graph", boot.hasCharacter);
check("video mode is not in an error phase", boot.phase === "play" || boot.phase === "briefing", boot.phase);

// Walk forward for a second and confirm the player actually moves.
const before = await page.evaluate(() => ({ x: window.LEVERAGE.world.player.x, z: window.LEVERAGE.world.player.z }));
await page.keyboard.down("KeyW");
await page.waitForTimeout(1200);
await page.keyboard.up("KeyW");
const after = await page.evaluate(() => ({
  x: window.LEVERAGE.world.player.x,
  z: window.LEVERAGE.world.player.z,
  camera: window.LEVERAGE.world.camera.z,
  hud: window.LEVERAGE.world.hud(),
}));
const moved = Math.hypot(after.x - before.x, after.z - before.z);
check("player moves on W", moved > 0.4, `${moved.toFixed(2)} m`);
check("camera follows the player", after.camera < 8.7, `camera z ${after.camera.toFixed(2)}`);
check("HUD reports a distance", after.hud.distance > 0, `${after.hud.distance.toFixed(1)} m`);

// Crouch and confirm the stance reaches the animation layer.
await page.keyboard.down("ControlLeft");
await page.waitForTimeout(700);
const crouched = await page.evaluate(() => ({
  crouch: window.LEVERAGE.world.player.crouch,
  stance: document.querySelector('[data-field="stance"]').textContent,
  headY: (() => {
    let head = null;
    window.LEVERAGE.scene.traverse((o) => {
      if (o.name === "Head") head = o;
    });
    if (!head) return null;
    const v = new window.LEVERAGE.THREE.Vector3();
    head.getWorldPosition(v);
    return v.y;
  })(),
}));
await page.keyboard.up("ControlLeft");
check("crouch engages", crouched.crouch > 0.5, `blend ${crouched.crouch.toFixed(2)}`);
check("HUD shows the crouched stance", /crouch/i.test(crouched.stance), crouched.stance);
check("crouched head is lower than standing", crouched.headY !== null && crouched.headY < 1.75, `head y ${crouched.headY?.toFixed(2)}`);

// Render sanity: the frame must not be a flat colour or fully black.
const shot = await page.screenshot({ type: "png" });
fs.writeFileSync("docs/previews/game/browser-frame.png", shot);
const variety = await page.evaluate(() => {
  const c = document.getElementById("view");
  const gl = c.getContext("webgl2") || c.getContext("webgl");
  const px = new Uint8Array(4 * 64 * 64);
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let min = 255;
  let max = 0;
  let nonBlack = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
    min = Math.min(min, l);
    max = Math.max(max, l);
    if (l > 12) nonBlack++;
  }
  return { min, max, nonBlack, total: px.length / 4 };
});
check("frame is not a flat fill", variety.max - variety.min > 12, `luma ${variety.min}..${variety.max}`);
check("frame is not black", variety.nonBlack > 200, `${variety.nonBlack}/${variety.total} lit pixels`);

const errs = consoleErrors.filter((e) => !/favicon|DevTools/i.test(e));
check("no console errors", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();

for (const n of notes) console.log(`  note ${n}`);
if (failures.length) {
  console.error(`\nsmoke: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nsmoke: all checks passed");
