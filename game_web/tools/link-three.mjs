// Point the test toolchain at the renderer the browser actually loads.
//
// index.html maps `three` to ./vendor/three/three.module.js, so the page runs the
// vendored build. Node resolves `three` to node_modules/three, and if that is a
// separately installed copy the tests are exercising a different renderer than the
// one that ships — the sort of skew that lets a suite pass on code the browser
// cannot run.
//
// This makes node_modules/three a symlink to vendor/three, as game_web/.gitignore
// documents. Runs on install so a fresh clone is correct without a manual step.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const vendor = path.join(web, "vendor", "three");
const link = path.join(web, "node_modules", "three");

if (!fs.existsSync(vendor)) {
  console.warn("link-three: no vendor/three, leaving node_modules alone");
  process.exit(0);
}
fs.mkdirSync(path.join(web, "node_modules"), { recursive: true });

// A real directory here is a separately installed copy: remove it, because the
// two must not disagree about which renderer is in play.
try {
  const st = fs.lstatSync(link);
  if (st.isSymbolicLink()) {
    fs.unlinkSync(link);
  } else {
    fs.rmSync(link, { recursive: true, force: true });
  }
} catch {
  // Nothing there yet.
}
fs.symlinkSync(path.relative(path.dirname(link), vendor), link, "dir");
console.log("link-three: node_modules/three -> vendor/three");
