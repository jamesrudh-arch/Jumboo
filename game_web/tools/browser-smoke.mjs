// Browser smoke test.
//
// The unit suite runs modules in Node. It cannot see a broken template literal in
// a browser module, a CSS rule that outranks [hidden], a page error thrown inside
// a requestAnimationFrame callback, or an asset 404. All four have shipped here.
//
// This loads the actual page in an actual Chromium with software WebGL, presses
// BEGIN, and asserts on what a player would see:
//
//   node tools/browser-smoke.mjs
//
// It needs a Chromium binary. In a sandbox with no browser binary and a blocked
// download CDN, `@sparticuz/chromium` ships one inside its npm tarball, and its
// al2023 dependency bundle holds the NSS libraries the binary needs. That is what
// makes this runnable where `npx playwright install` is not.

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const SHOTS = resolve(web, ".shots");
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080/";

/**
 * Unpack the shared libraries the Chromium binary links against.
 *
 * The binary lands in /tmp, but the dependency bundle lives in the package's own
 * bin/ directory — looking for it next to the binary finds nothing and the launch
 * dies with "libnss3.so: cannot open shared object file".
 */
function unshareLibraries() {
  const target = "/tmp/chromium-libs";
  if (fs.existsSync(resolve(target, "lib/libnss3.so"))) return resolve(target, "lib");
  const bundle = resolve(web, "node_modules/@sparticuz/chromium/bin/al2023.tar.br");
  if (!fs.existsSync(bundle)) {
    console.log("  (no dependency bundle; relying on system libraries)");
    return null;
  }
  fs.mkdirSync(target, { recursive: true });
  const tar = zlib.brotliDecompressSync(fs.readFileSync(bundle));
  fs.writeFileSync(resolve(target, "deps.tar"), tar);
  // Shell out to tar: writing a tar reader here would be its own source of bugs.
  const { execFileSync } = require("node:child_process");
  execFileSync("tar", ["-xf", resolve(target, "deps.tar"), "-C", target]);
  return resolve(target, "lib");
}

const failures = [];
const fail = (m) => { failures.push(m); console.log("  FAIL:", m); };
const ok = (m) => console.log("  ok:", m);

const exe = await chromium.executablePath();
const libDir = unshareLibraries();
const browser = await puppeteer.launch({
  protocolTimeout: 600000,
  args: [...chromium.args, "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
  executablePath: exe,
  headless: true,
  env: { ...process.env, ...(libDir ? { LD_LIBRARY_PATH: libDir } : {}) },
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

const pageErrors = [];
const bad = new Map();
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) bad.set(r.url(), r.status()); });
const transport = new Map();
page.on("requestfailed", (r) => transport.set(r.url(), r.failure()?.errorText ?? "failed"));

console.log("loading", BASE);
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => window.LEVERAGE?.state?.ready === true, { timeout: 400000, polling: 1000 });
ok("page reached ready");

await page.waitForFunction(() => { const b = document.getElementById("start"); return b && !b.disabled; },
  { timeout: 200000, polling: 500 });
await page.evaluate(() => document.getElementById("start").click());
// Wait for the game to have actually drawn a frame with the story running, rather
// than guessing at a delay: software rendering makes any fixed wait a coin flip.
await page.waitForFunction(
  () => window.LEVERAGE?.state?.story && !window.LEVERAGE.hud.fields.story?.hidden,
  { timeout: 120000, polling: 250 }
).catch(() => {});

const s = await page.evaluate(() => {
  const L = window.LEVERAGE;
  return {
    started: L.state.started,
    phase: L.world.phase,
    banner: L.state.banner?.title ?? null,
    bannerVisible: L.hud.fields.banner ? !L.hud.fields.banner.hidden : null,
    objective: L.state.objective?.text ?? null,
    storyText: L.hud.fields.storyText?.textContent ?? null,
    storyHidden: L.hud.fields.story?.hidden,
    objectiveBlockHidden: L.hud.fields.objectiveBlock?.hidden,
  };
});

// The four things that have actually gone wrong, asserted directly.
if (!s.started) fail("the game did not start");
else ok("the game started");
if (s.phase !== "play") fail(`phase is "${s.phase}", expected play`);
else ok("the simulation is running");
if (s.bannerVisible) fail(`a banner ("${s.banner}") is on screen at the opening`);
else ok("no stale banner at the opening");
if (s.storyHidden !== false) fail("the story objective is not visible");
else ok("the story objective is visible");
if (s.storyText !== s.objective) fail(`HUD shows "${s.storyText}", state says "${s.objective}"`);
else ok(`objective reads "${s.objective}"`);
if (s.objectiveBlockHidden !== true) fail("the level objective is still drawn under the story objective");
else ok("only one objective is on screen");

const realErrors = pageErrors.filter((e) => !/colormap|citybits/i.test(e));
if (realErrors.length) fail(`page errors: ${[...new Set(realErrors)].slice(0, 3).join(" | ")}`);
else ok("no page errors");

// Asset 404s that are not the known missing sub-resource textures.
// A 404 for a model that exists on disk is a path bug; a transport failure is a
// flaky fetch under software rendering. Only the first is the game's fault.
const realTransport = [...transport.entries()].filter(([u]) => !/colormap|citybits/i.test(u));
if (realTransport.length) {
  console.log("  note: transport failures (retried by the loader):",
    realTransport.slice(0, 3).map(([u, e]) => `${e} ${u.split("/").pop()}`).join(", "));
}
const realBad = [...bad.entries()].filter(([u]) => !/colormap|citybits/i.test(u));
if (realBad.length) fail(`asset failures: ${realBad.slice(0, 4).map(([u, c]) => `${c} ${u}`).join(", ")}`);
else ok("no unexpected asset failures");

fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: resolve(SHOTS, "smoke-start.png") });
ok("screenshot: .shots/smoke-start.png");

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nPASS");
process.exit(failures.length ? 1 : 0);
