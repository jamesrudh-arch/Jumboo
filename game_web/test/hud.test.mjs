// HUD tests.
//
// The HUD is where a mission becomes visible, and the two failure modes that
// matter are both silent: an objective that points at the wrong place, and a
// subtitle that shows a speaker who is not speaking. Neither throws, so neither
// shows up in a gameplay bug report — only in a test like this one.
//
// Runs against linkedom rather than a browser, so the DOM code is exercised
// without a renderer.

import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML("<html><head></head><body></body></html>");
globalThis.document = document;
globalThis.window = window;

const { Hud } = await import("../src/hud.js");

/** The minimum World#hud() shape the HUD reads. */
const baseHud = (over = {}) => ({
  objectiveLabel: "Take the loading lane",
  distance: 12.3,
  bearing: 0.2,
  stamina: 80,
  noise: 3,
  crouch: 0,
  running: false,
  time: 61,
  errand: null,
  errandsDone: 0,
  errandsTotal: 0,
  errandPoints: 0,
  suspicion: 0,
  ...over,
});

function fresh() {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  return new Hud(document.body);
}

test("the HUD builds and shows the level objective by default", () => {
  const hud = fresh();
  hud.update(baseHud(), {});
  const label = hud.fields.objectiveLabel;
  assert.equal(label.textContent, "Take the loading lane");
  assert.equal(hud.fields.story.hidden, true, "no story objective without a mission");
  assert.equal(hud.fields.objectiveBlock.hidden, false);
});

test("a mission objective replaces the level's rather than stacking on it", () => {
  const hud = fresh();
  hud.update(baseHud(), { story: { act: "I", text: "Talk to Tessa" } });
  assert.equal(hud.fields.story.hidden, false);
  assert.equal(hud.fields.storyText.textContent, "Talk to Tessa");
  assert.equal(hud.fields.storyAct.textContent, "Act I");
  // The level's objective is still displayed textually, but its block is hidden:
  // two objectives at once means one of them is wrong.
  assert.equal(hud.fields.objectiveBlock.hidden, true);
});

test("the story objective clears when the mission ends", () => {
  const hud = fresh();
  hud.update(baseHud(), { story: { act: "I", text: "Talk to Tessa" } });
  hud.update(baseHud(), { story: null });
  assert.equal(hud.fields.story.hidden, true);
  assert.equal(hud.fields.objectiveBlock.hidden, false);
});

test("a spoken line shows its speaker", () => {
  const hud = fresh();
  hud.update(baseHud(), {
    subtitle: { speaker: "TESSA", text: "You fixed that light yet?", narration: false, choices: [] },
  });
  assert.equal(hud.fields.subtitle.hidden, false);
  assert.equal(hud.fields.speaker.textContent, "TESSA");
  assert.equal(hud.fields.line.textContent, "You fixed that light yet?");
});

test("a narration line shows nobody speaking", () => {
  const hud = fresh();
  hud.update(baseHud(), {
    subtitle: { speaker: null, text: "The battery charger clicks off.", narration: true, choices: [] },
  });
  assert.equal(hud.fields.speaker.textContent, "", "nobody says a narration line");
  assert.equal(hud.fields.line.dataset.narration, "1");
});

test("choices are numbered so the keys are visible", () => {
  const hud = fresh();
  hud.update(baseHud(), {
    subtitle: {
      speaker: null, text: "The phone rings.", narration: true, awaiting: true,
      choices: [{ text: "Answer it." }, { text: "Let it ring." }],
    },
  });
  const items = hud.fields.choices.querySelectorAll("li");
  assert.equal(items.length, 2);
  assert.equal(items[0].textContent, "1Answer it.");
  assert.equal(items[1].textContent, "2Let it ring.");
});

test("the choice list is not rebuilt every frame", () => {
  const hud = fresh();
  const subtitle = {
    speaker: null, text: "The phone rings.", narration: true, awaiting: true,
    choices: [{ text: "Answer it." }, { text: "Let it ring." }],
  };
  hud.update(baseHud(), { subtitle });
  const first = hud.fields.choices.querySelector("li");
  hud.update(baseHud(), { subtitle });
  assert.equal(hud.fields.choices.querySelector("li"), first, "same node, not a new one");
});

test("the subtitle clears when the conversation ends", () => {
  const hud = fresh();
  hud.update(baseHud(), { subtitle: { speaker: "TESSA", text: "Hello.", choices: [] } });
  hud.update(baseHud(), { subtitle: null });
  assert.equal(hud.fields.subtitle.hidden, true);
});

test("the banner still works alongside a subtitle", () => {
  const hud = fresh();
  hud.update(baseHud(), {
    banner: { title: "Taken.", body: "Press R to get up." },
    subtitle: { speaker: "TESSA", text: "Hello.", choices: [] },
  });
  assert.equal(hud.fields.banner.hidden, false);
  assert.equal(hud.fields.bannerTitle.textContent, "Taken.");
  assert.equal(hud.fields.subtitle.hidden, false);
});
