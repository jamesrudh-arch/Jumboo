// Playthrough test: the story and the HUD, together.
//
// story.test.mjs proves the mission advances. hud.test.mjs proves the HUD draws
// what it is told. Neither proves that what the player sees is correct for a whole
// mission, which is the only thing that actually matters here.
//
// This plays M01 from the first keypress to the last subtitle, sampling the HUD at
// every step, and asserts on what a player would have been looking at.

import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";

const { document, window } = parseHTML("<html><head></head><body></body></html>");
globalThis.document = document;
globalThis.window = window;

const { Hud } = await import("../src/hud.js");
const { Mission } = await import("../src/mission.js");
const { StoryDirector } = await import("../src/story.js");
const { m01Definition, M01_CONVERSATIONS, M01_PLACES } = await import("../src/missions/m01.js");

const levelHud = (over = {}) => ({
  objectiveLabel: "Take the loading lane",
  distance: 12, bearing: 0, stamina: 80, noise: 2, crouch: 0, running: false,
  time: 30, errand: null, errandsDone: 0, errandsTotal: 0, errandPoints: 0, suspicion: 0,
  ...over,
});

/** A session: the mission, the director, the HUD, and what the HUD was told. */
function session() {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  const hud = new Hud(document.body);
  const flags = {};
  const mission = new Mission(m01Definition(), { flags });
  const state = { objective: null, subtitle: null };
  const director = new StoryDirector({
    mission,
    conversations: M01_CONVERSATIONS,
    flags,
    onSubtitle: (v) => { state.subtitle = v; },
    onObjective: (o) => { state.objective = o; },
    liveBodies: () => [],
  });

  const render = () => {
    hud.update(levelHud(), {
      story: state.objective
        ? { act: state.objective.mission === "M01" ? "I" : null, text: state.objective.text }
        : null,
      subtitle: state.subtitle,
      // Same rule main.js uses: a conversation owns the bottom of the screen.
      prompt: state.subtitle ? null : null,
    });
  };

  /**
   * Walk to a place and run ticks, answering questions the way a player would.
   *
   * `press` fires the interact key once at the start, which is how a beat that
   * wants E is satisfied. Questions are answered before the tick that would
   * otherwise be spent waiting on them.
   */
  const goTo = (place, { seconds = 30, dt = 0.1, answer = 0, press = false, sample = null } = {}) => {
    const ticks = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < ticks; i++) {
      if (press && i === 0) director.press();
      if (state.subtitle?.awaiting) director.choose(answer);
      // Sample before the tick as well as after: the objective a player sees
      // during the beat is the one announced when the beat started, and the beat
      // can complete on the very first tick it is visited.
      render();
      sample?.();
      director.tick(dt, { player: { x: place.x, z: place.z } });
      render();
      sample?.();
    }
  };

  return { hud, mission, director, flags, state, render, goTo };
}

test("the first thing the player sees is what to do, not the level's old objective", () => {
  const s = session();
  s.director.start();
  s.render();
  assert.equal(s.hud.fields.story.hidden, false);
  assert.equal(s.hud.fields.storyText.textContent, "Inspect the charger");
  assert.equal(s.hud.fields.objectiveBlock.hidden, true, "one objective at a time");
  assert.equal(s.hud.fields.subtitle.hidden, true, "nobody is talking yet");
});

test("a full playthrough shows every beat and ends with the mission complete", () => {
  const s = session();
  s.director.start();

  // Sample the objective on every frame the HUD is drawn, so the assertion is
  // about what the player saw rather than what the test remembered to check.
  const seenObjectives = new Set();
  const sample = () => {
    if (!s.hud.fields.story.hidden) seenObjectives.add(s.hud.fields.storyText.textContent);
  };
  s.render();
  sample();

  s.goTo(M01_PLACES.charger, { seconds: 0.2, press: true, sample });
  s.goTo(M01_PLACES.charger, { seconds: 0.2, sample });
  s.goTo(M01_PLACES.shop, { seconds: 0.2, sample });
  s.goTo(M01_PLACES.shop, { seconds: 120, sample });
  s.goTo(M01_PLACES.shop, { seconds: 60, sample });      // Tessa, plainly
  s.goTo(M01_PLACES.market, { seconds: 60, sample });    // the stall
  s.goTo(M01_PLACES.van, { seconds: 2, sample });
  s.goTo(M01_PLACES.lane, { seconds: 2, sample });
  s.goTo(M01_PLACES.alleyEast, { seconds: 60, sample }); // the long way round
  s.goTo(M01_PLACES.laneShadow, { seconds: 3, sample });
  s.goTo(M01_PLACES.sade, { seconds: 0.2, sample });
  s.goTo(M01_PLACES.sade, { seconds: 120, sample });
  s.goTo(M01_PLACES.collectors, { seconds: 0.2, sample });
  s.goTo(M01_PLACES.collectors, { seconds: 120, sample });
  s.goTo(M01_PLACES.collectors, { seconds: 120, sample }); // the debrief

  for (const expected of [
    "Inspect the charger",
    "Talk to Tessa",
    "Say it to Tessa plainly",
    "Find where the van came from",
    "Take the long way round",
    "Talk to Sade",
    "Two men at the alley",
  ]) {
    assert.ok(seenObjectives.has(expected), `the player was shown "${expected}" (saw: ${[...seenObjectives].join(", ")})`);
  }
  assert.equal(s.mission.state, "complete");
  assert.equal(s.flags.answeredCall, true);
  assert.ok(s.flags.collectorFavour === 1 || s.flags.collectorOutcome, "the alley outcome was recorded");
});

test("subtitles name a speaker only when someone is speaking", () => {
  const s = session();
  s.director.start();
  s.goTo(M01_PLACES.charger, { ticks: 1, press: true });
  s.goTo(M01_PLACES.charger, { seconds: 0.2 });
  s.goTo(M01_PLACES.shop, { seconds: 0.2 });

  // The shop scene opens on narration, then Tessa speaks.
  let sawNarration = false;
  let sawSpeaker = null;
  for (let i = 0; i < 2000; i++) {
    if (s.state.subtitle && s.hud.fields.subtitle.hidden === false) {
      const speaker = s.hud.fields.speaker.textContent;
      if (speaker === "") sawNarration = true;
      if (speaker === "TESSA") sawSpeaker = "TESSA";
    }
    if (s.state.subtitle?.awaiting) s.director.choose(0);
    s.director.tick(0.1, { player: { x: M01_PLACES.shop.x, z: M01_PLACES.shop.z } });
    s.render();
  }
  assert.ok(sawNarration, "the scene opened on narration with nobody credited");
  assert.equal(sawSpeaker, "TESSA", "and Tessa was credited for her own line");
});

test("the choice list appears only while a question is actually being asked", () => {
  const s = session();
  s.director.start();
  s.goTo(M01_PLACES.charger, { seconds: 0.4, press: true });
  s.goTo(M01_PLACES.charger, { seconds: 0.2 });

  let sawChoices = 0;
  let sawNoChoices = 0;
  for (let i = 0; i < 2000; i++) {
    const n = s.hud.fields.choices.querySelectorAll("li").length;
    if (s.state.subtitle?.awaiting) {
      assert.ok(n >= 2, "a question always offers at least two answers");
      sawChoices += 1;
      s.director.choose(0);
    } else if (s.state.subtitle) {
      if (n === 0) sawNoChoices += 1;
      else assert.fail("choices were on screen while no question was pending");
    }
    s.director.tick(0.1, { player: { x: M01_PLACES.shop.x, z: M01_PLACES.shop.z } });
    s.render();
  }
  assert.ok(sawChoices > 0, "a question was asked");
  assert.ok(sawNoChoices > 0, "and there were lines that were not questions");
});

test("the subtitle clears at the end so it cannot be left on screen", () => {
  const s = session();
  s.director.start();
  s.goTo(M01_PLACES.charger, { seconds: 0.4, press: true });
  s.goTo(M01_PLACES.charger, { seconds: 0.2 });
  s.goTo(M01_PLACES.shop, { seconds: 90 });
  assert.equal(s.director.talking, false, "the conversation finished on its own");
  assert.equal(s.hud.fields.subtitle.hidden, true);
});

test("dying mid-mission rewinds the beat but keeps the flags already earned", () => {
  const s = session();
  s.director.start();
  s.goTo(M01_PLACES.charger, { seconds: 0.4, press: true });
  s.goTo(M01_PLACES.charger, { seconds: 0.2 });
  s.goTo(M01_PLACES.shop, { seconds: 90 });
  assert.equal(s.flags.answeredCall, true);
  const beatBefore = s.mission.beat.id;
  s.director.rewind();
  s.render();
  assert.equal(s.mission.beat.id, beatBefore, "the same beat, not the opening");
  assert.equal(s.flags.answeredCall, true, "a choice the player made is not undone");
  assert.equal(s.hud.fields.subtitle.hidden, true, "and nothing is left talking");
});
