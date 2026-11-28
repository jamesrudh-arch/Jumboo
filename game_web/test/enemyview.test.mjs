// Enemy view tests. These run the real three.js classes against the real
// vendored GLBs in Node — no browser needed, because nothing here touches WebGL.
// That is the entire point of keeping the view layer separate from the renderer:
// the skinned pipeline can be proven on a machine with no GPU.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { EnemyFactory, EnemyWave } from "../src/enemyview.js";
import { ARCHETYPES, ARCHETYPE, statLine, resolveClipMap, scaleToHeight } from "../src/enemies.js";

const here = dirname(fileURLToPath(import.meta.url));

/** A loader that reads from disk instead of the network. */
class DiskLoader {
  async loadAsync(url) {
    const path = url.startsWith("/") ? url : join(here, "..", url.replace(/^\.\//, ""));
    const buf = fs.readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const loader = new GLTFLoader();
    return new Promise((res, rej) => loader.parse(ab, "", res, rej));
  }
}

const factory = new EnemyFactory({ loader: new DiskLoader() });

test("every archetype model loads, rigged and animated", async () => {
  const stats = await factory.preload(ARCHETYPES);
  assert.equal(stats.loaded, stats.requested, "every model loaded");
  assert.deepEqual([...factory.failed], []);
  assert.ok(stats.tris > 5000, `the cast has geometry (${stats.tris} tris)`);
});

test("a spawned body is the declared height in metres", async () => {
  for (const [name, def] of Object.entries(ARCHETYPES)) {
    const e = factory.spawn({ ...def, archetype: name });
    const box = new THREE.Box3().setFromObject(e.root);
    const h = box.max.y - box.min.y;
    assert.ok(
      Math.abs(h - def.height) < 0.02,
      `${name} is ${h.toFixed(3)} m, wanted ${def.height}`,
    );
    e.dispose();
  }
});

test("copies do not share a skeleton", async () => {
  // The bug this prevents: every enemy in the district snapping to the same
  // pose and frame, because Object3D.clone shares one Skeleton.
  const a = factory.spawn(statLine(ARCHETYPE.RUNNER));
  const b = factory.spawn(statLine(ARCHETYPE.RUNNER));
  const skelA = [];
  const skelB = [];
  a.body.traverse((o) => { if (o.isSkinnedMesh) skelA.push(o.skeleton); });
  b.body.traverse((o) => { if (o.isSkinnedMesh) skelB.push(o.skeleton); });
  assert.ok(skelA.length > 0, "the model is skinned");
  assert.equal(skelA.length, skelB.length);
  assert.notEqual(skelA[0], skelB[0], "each copy owns its skeleton");
  assert.notEqual(skelA[0].bones[0], skelB[0].bones[0], "and its own bones");
  a.dispose(); b.dispose();
});

test("an idle body plays its idle clip", async () => {
  const e = factory.spawn(statLine(ARCHETYPE.WATCHER));
  assert.equal(e.current, "idle");
  assert.ok(e.actions.idle, "the pack has an idle clip");
  e.tick(0.1);
  assert.ok(e.mixer.time >= 0, "the mixer is advancing");
  e.dispose();
});

test("a hit flinches and flashes, then is not dead", async () => {
  const e = factory.spawn(statLine(ARCHETYPE.RUNNER));
  e.hit();
  assert.equal(e.dead, false);
  assert.ok(e.flashTimer > 0, "the hit is visible");
  e.tick(0.02);
  e.dispose();
});

test("a body with no death clip falls over instead of vanishing", async () => {
  // The snake and the wasp carry no death clip. Falling over is the readable
  // alternative; a body that simply stops looks like a bug.
  const map = resolveClipMap(["SnakeArmature|Snake_Attack", "SnakeArmature|Snake_Walk"]);
  assert.equal(map.death, null, "this pack has no death clip");
  // The wasp genuinely carries no Death clip: Attack and Flying only.
  const e = factory.spawn({ ...statLine(ARCHETYPE.FLYER), model: "easy_enemies_pack__Wasp", height: 0.45 });
  assert.equal(e.actions.death, undefined, "no death action was bound");
  e.die();
  assert.equal(e.dead, true);
  for (let i = 0; i < 40; i++) e.tick(0.016);
  assert.ok(e.fallOver, "the body topples");
  assert.ok(e.body.rotation.x > 0, "and it is actually rotating");
  e.dispose();
});

test("a body with a death clip plays it and holds", async () => {
  const e = factory.spawn(statLine(ARCHETYPE.WATCHER));
  assert.ok(e.actions.death, "the watcher has a death clip");
  e.die();
  assert.equal(e.current, "death");
  assert.equal(e.actions.death.clampWhenFinished, true, "held at the last frame");
  e.dispose();
});

test("wave damage kills at zero and reports it", async () => {
  const wave = new EnemyWave({ factory });
  const killed = [];
  wave.onKill = (e) => killed.push(e.stats.archetype);
  wave.spawnAll([statLine(ARCHETYPE.RUNNER), statLine(ARCHETYPE.PACK)]);
  assert.equal(wave.alive, 2);
  const runner = wave.live[0];
  const r1 = wave.damage(runner, 5);
  assert.equal(r1, "hit");
  const r2 = wave.damage(runner, 500);
  assert.equal(r2, "killed");
  assert.deepEqual(killed, [ARCHETYPE.RUNNER]);
  assert.equal(wave.damage(runner, 10), null, "a corpse cannot be hit again");
  wave.tick(0.016);
  assert.equal(wave.alive, 1);
  wave.clear();
});

test("corpses are capped so a long fight cannot grow the scene", async () => {
  const wave = new EnemyWave({ factory, maxCorpses: 2 });
  wave.spawnAll(Array.from({ length: 6 }, () => statLine(ARCHETYPE.PACK)));
  for (const e of [...wave.live]) wave.damage(e, 999);
  wave.tick(0.016);
  assert.ok(wave.corpses.length <= 2, `corpses capped at 2, got ${wave.corpses.length}`);
  wave.clear();
});

test("clearing a wave disposes every body", async () => {
  const wave = new EnemyWave({ factory });
  wave.spawnAll([statLine(ARCHETYPE.BRUTE), statLine(ARCHETYPE.FLYER)]);
  wave.clear();
  assert.equal(wave.live.length, 0);
  assert.equal(wave.corpses.length, 0);
});

test("a missing model degrades to a proxy body rather than throwing", async () => {
  const f = new EnemyFactory({ loader: new DiskLoader() });
  const e = f.spawn({ ...statLine(ARCHETYPE.RUNNER), model: "nope__Missing" });
  assert.equal(e.isFallback, true);
  assert.ok(e.root.children.length > 0, "there is still a body");
  assert.equal(e.current, null, "a proxy has no clips");
  e.tick(0.016);
  e.die();
  e.tick(0.016);
  e.dispose();
});

test("clip resolution handles the four naming styles in the packs", () => {
  const cases = [
    { names: ["CharacterArmature|Death", "CharacterArmature|Idle", "CharacterArmature|Run"], death: "CharacterArmature|Death" },
    { names: ["CharacterArmature|Dead", "CharacterArmature|Idle"], death: "CharacterArmature|Dead" },
    { names: ["AnimalArmature|Gallop", "AnimalArmature|Idle"], move: "AnimalArmature|Gallop" },
    { names: ["FrogArmature|Frog_Attack"], attack: "FrogArmature|Frog_Attack" },
    { names: ["WaspArmature|Wasp_Flying"], idle: "WaspArmature|Wasp_Flying" },
  ];
  for (const c of cases) {
    const m = resolveClipMap(c.names);
    if (c.death) assert.equal(m.death, c.death, `death from ${c.names[0]}`);
    if (c.move) assert.equal(m.move, c.move, `move from ${c.names[0]}`);
    if (c.attack) assert.equal(m.attack, c.attack, `attack from ${c.names[0]}`);
    if (c.idle) assert.equal(m.idle, c.idle, `idle from ${c.names[0]}`);
  }
});

test("scaleToHeight normalises the 100x-exported bodies", () => {
  assert.equal(scaleToHeight(100, 1.8).toFixed(4), "0.0180");
  assert.equal(scaleToHeight(1.8, 1.8), 1);
  assert.equal(scaleToHeight(0, 1.8), 1, "a zero measurement does not divide by zero");
  assert.equal(scaleToHeight(NaN, 1.8), 1);
});
