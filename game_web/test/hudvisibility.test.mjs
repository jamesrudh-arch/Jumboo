// HUD visibility: the bug that shipped twice.
//
// A panel with its own `display` rule ignores the `[hidden]` attribute, because a
// class selector beats the user-agent rule for [hidden]. This shipped in two files
// and produced the same visible symptom both times: text drawn over the game after
// the game had stopped asking for it — two objectives printed on top of each
// other, and a death overlay ("Taken.") over a street where nothing had happened.
//
// Neither bug throws. Neither is visible to a test that only calls update(). Both
// are visible to a test that renders the markup and asks what is on screen.
//
// These tests use linkedom, which does not do layout — so they check the rule
// rather than the pixels: every panel the code can hide must have an explicit
// hide rule, and every field the code toggles must be one of those panels.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML("<html><head></head><body></body></html>");
globalThis.document = document;
globalThis.window = window;

const { Hud } = await import("../src/hud.js");
const { CombatHud } = await import("../src/combathud.js");

/** Pull the STYLE string out of a HUD module and return its CSS text. */
function styleOf(path) {
  const src = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const m = src.match(/const STYLE = `([\s\S]*?)`;\n/);
  assert.ok(m, `${path} should declare a STYLE template`);
  return m[1];
}

/** Every class in this CSS that sets a display value. */
function displayClasses(css) {
  const out = new Set();
  const rule = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    if (/display\s*:/.test(m[2])) out.add(m[1]);
  }
  return out;
}

/** Every class that has an explicit `[hidden]` hide rule. */
function hiddenClasses(css) {
  const out = new Set();
  const rule = /\.([a-zA-Z0-9_-]+)\[hidden\]/g;
  let m;
  while ((m = rule.exec(css))) out.add(m[1]);
  return out;
}

test("a template literal survives a CSS comment mentioning code", () => {
  // The STYLE string is a template literal. A backtick inside a CSS comment ends
  // it and the module stops parsing — which happened twice, and the page then
  // never reached ready. This asserts the one thing that can silently break it.
  for (const file of ["../src/hud.js", "../src/combathud.js"]) {
    const css = styleOf(file);
    assert.ok(!css.includes("`"), `${file}: no stray backtick inside STYLE`);
  }
});

test("every panel that can be hidden has a rule that actually hides it", () => {
  for (const file of ["../src/hud.js", "../src/combathud.js"]) {
    const css = styleOf(file);
    const display = displayClasses(css);
    const hidden = hiddenClasses(css);
    // Panels that are purely decorative children never get `hidden` set on them;
    // they are always inside something that does.
    const decorative = new Set([
      "lv-choices", "lv-errand-bar", "lv-key", "lv-noise-pips", "lv-readouts",
      "lv-compass-mark", "lv-bar", "lv-hud",
      "cb-offer-item", "cb-offer-list", "cb-kicker", "cb-wave", "cb-weapon", "cb-health",
    ]);
    const missing = [...display].filter((c) => !hidden.has(c) && !decorative.has(c));
    assert.deepEqual(missing, [], `${file}: panels with display but no [hidden] rule: ${missing.join(", ")}`);
  }
});

test("every field the HUD toggles hidden on is a real element", () => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  const hud = new Hud(document.body);
  // The set of fields the code hides must all exist; a typo here hides nothing
  // and leaves the panel on screen forever.
  for (const name of ["banner", "subtitle", "story", "objectiveBlock", "prompt", "suspicion", "chaos", "errand"]) {
    assert.ok(hud.fields[name], `hud field "${name}" exists`);
  }
});

test("the death overlay is hidden on a healthy run — the exact shipped bug", () => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  const ch = new CombatHud(document.body);
  ch.update({
    state: "fighting", wave: 1, health: 100, maxHealth: 100, kills: 0,
    weapon: { name: "Fists" }, takedown: null, offer: null,
  }, 0);
  assert.equal(ch.fields.dead.hidden, true, "a healthy player is not shown a death overlay");
});

test("the death overlay appears only when the run says the player is dead", () => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  const ch = new CombatHud(document.body);
  ch.update({ state: "dead", wave: 2, health: 0, maxHealth: 100, kills: 4, weapon: null, takedown: null, offer: null }, 0);
  assert.equal(ch.fields.dead.hidden, false);
});

test("the story objective and the level objective are never both shown", () => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  const hud = new Hud(document.body);
  const base = {
    objectiveLabel: "Take the loading lane", distance: 10, bearing: 0, stamina: 90,
    noise: 2, crouch: 0, running: false, time: 5, errand: null,
    errandsDone: 0, errandsTotal: 0, errandPoints: 0, suspicion: 0,
  };
  hud.update(base, { story: { act: "I", text: "Inspect the charger" } });
  assert.equal(hud.fields.story.hidden, false);
  assert.equal(hud.fields.objectiveBlock.hidden, true, "level objective stands down");
  hud.update(base, { story: null });
  assert.equal(hud.fields.story.hidden, true);
  assert.equal(hud.fields.objectiveBlock.hidden, false, "and comes back when the mission ends");
});
