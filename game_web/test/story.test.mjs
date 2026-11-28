// Story director tests.
//
// The point of this file: prove that M01 can be played start to finish through the
// same code the browser will run — not through a hand-written sequence of
// `mission.satisfy()` calls, which would pass even if the director were broken.

import test from "node:test";
import assert from "node:assert/strict";
import { Mission } from "../src/mission.js";
import { StoryDirector, lineSeconds } from "../src/story.js";
import { m01Definition, M01_CONVERSATIONS, M01_PLACES } from "../src/missions/m01.js";

/** A world the mission can be ticked against, standing where we say. */
function worldAt(place, extra = {}) {
  return { player: { x: place.x, z: place.z }, ...extra };
}

function play(flags = {}) {
  const mission = new Mission(m01Definition(), { flags });
  const seen = { subtitles: [], objectives: [], ended: null, spawned: [] };
  const director = new StoryDirector({
    mission,
    conversations: M01_CONVERSATIONS,
    flags,
    onSubtitle: (s) => seen.subtitles.push(s),
    onObjective: (o) => seen.objectives.push(o),
    onMissionEnd: (m) => { seen.ended = m; },
    spawnBeat: (b) => seen.spawned.push(b.id),
    liveBodies: () => [],
  });
  return { director, mission, flags, seen };
}

/** Run ticks until the predicate holds or we give up. Bounded on purpose: a story
 *  test that can hang is a story test that blocks CI instead of reporting a bug. */
function until(director, world, predicate, { dt = 0.1, limit = 4000, answer = 0 } = {}) {
  for (let i = 0; i < limit; i++) {
    // A player answers a question when it is asked. The director refuses to move
    // past a pending choice, so a harness that never chooses would hang by design.
    if (director.subtitle?.awaiting) director.choose(answer);
    director.tick(dt, world);
    if (predicate()) return i;
  }
  throw new Error(`condition never became true (subtitle: ${JSON.stringify(director.subtitle)})`);
}

test("a line is up long enough to read, and not much longer", () => {
  assert.ok(lineSeconds("Marcus.") >= 1.6, "a short line still gets time");
  assert.ok(lineSeconds("x".repeat(200)) > lineSeconds("x".repeat(20)));
  assert.ok(lineSeconds("x".repeat(5000)) <= 6, "a huge line does not hold the screen");
});

test("the mission can be played from the first beat to the last", () => {
  const { director, mission, seen } = play();

  director.start();
  assert.equal(mission.state, "active");
  assert.equal(seen.objectives.at(-1).text, "Inspect the charger");

  // Beat 1: walk to the charger and press E.
  const charger = M01_PLACES.charger;
  director.tick(0.1, worldAt({ x: charger.x + 20, z: charger.z }));
  assert.equal(mission.beat.id, "charger", "20 m away is not close enough");
  director.tick(0.1, worldAt(charger));
  director.press();
  director.tick(0.1, worldAt(charger));
  assert.equal(mission.beat.id, "tessa");

  // Beat 2: the shop conversation starts on arrival and plays itself.
  director.tick(0.1, worldAt(M01_PLACES.shop));
  assert.ok(director.talking, "the shop conversation opened");
  until(director, worldAt(M01_PLACES.shop), () => !director.talking);
  assert.equal(mission.beat.id, "call");

  // Beat 3: the call is a flag beat, satisfied by the conversation just played.
  director.tick(0.1, worldAt(M01_PLACES.shop));
  assert.equal(mission.beat.id, "tessaLane");

  // Beat 4: the market edge, out into the district.
  director.tick(0.1, worldAt(M01_PLACES.shop));
  until(director, worldAt(M01_PLACES.shop), () => !director.talking);
  director.tick(0.1, worldAt(M01_PLACES.market));
  assert.equal(mission.beat.id, "trace");
  until(director, worldAt(M01_PLACES.market), () => !director.talking);
  director.tick(0.1, worldAt(M01_PLACES.van));
  director.tick(0.1, worldAt(M01_PLACES.lane));
  assert.equal(mission.beat.id, "alley");

  // Beat 5: the long way round, then the watched lane, then Sade.
  director.tick(0.1, worldAt(M01_PLACES.alleyEast));
  until(director, worldAt(M01_PLACES.alleyEast), () => !director.talking);
  director.tick(0.1, worldAt(M01_PLACES.laneShadow));
  assert.equal(mission.beat.id, "sade");

  // Beat 5: Sade.
  director.tick(0.1, worldAt(M01_PLACES.sade));
  assert.ok(director.talking, "Sade's conversation opened");
  until(director, worldAt(M01_PLACES.sade), () => !director.talking);
  assert.equal(mission.beat.id, "collectors");

  // Beat 6: the collectors.
  director.tick(0.1, worldAt(M01_PLACES.collectors));
  assert.ok(director.talking, "the collector conversation opened");
  until(director, worldAt(M01_PLACES.collectors), () => !director.talking);

  // Talking them down opens the debrief, then skips the fight.
  assert.equal(mission.beat.id, "favour", "the peace route owes a debrief");
  director.tick(0.1, worldAt(M01_PLACES.collectors));
  until(director, worldAt(M01_PLACES.collectors), () => !director.talking);
  assert.equal(mission.state, "complete");
  assert.ok(seen.ended, "the mission reported its end");
});

test("the player has to press E at the charger — walking over it is not enough", () => {
  const { director, mission } = play();
  director.start();
  const charger = M01_PLACES.charger;
  for (let i = 0; i < 50; i++) director.tick(0.1, worldAt(charger));
  assert.equal(mission.beat.id, "charger", "standing on the charger does not finish it");
  director.press();
  director.tick(0.1, worldAt(charger));
  assert.equal(mission.beat.id, "tessa");
});

test("an interact press does not leak past the conversation it was meant for", () => {
  const { director, mission } = play();
  director.start();
  const charger = M01_PLACES.charger;
  director.tick(0.1, worldAt(charger));
  director.press();
  // Two presses before a single tick: the second must not queue up and skip a
  // line of the next conversation.
  director.press();
  director.tick(0.1, worldAt(charger));
  assert.equal(mission.beat.id, "tessa");
  director.tick(0.1, worldAt(M01_PLACES.shop));
  const first = director.subtitle.text;
  director.tick(0.05, worldAt(M01_PLACES.shop));
  assert.equal(director.subtitle.text, first, "the line was not skipped by the stale press");
});

test("a choice stops the clock and cannot be skipped with the interact key", () => {
  const { director } = play();
  director.start();
  const charger = M01_PLACES.charger;
  director.tick(0.1, worldAt(charger));
  director.press();
  director.tick(0.1, worldAt(charger));
  director.tick(0.1, worldAt(M01_PLACES.shop));
  until(director, worldAt(M01_PLACES.shop), () => director.subtitle?.awaiting);
  const asked = director.subtitle.text;
  // Sit there for ten seconds and mash the interact key.
  for (let i = 0; i < 100; i++) {
    director.press();
    director.tick(0.1, worldAt(M01_PLACES.shop));
  }
  assert.ok(director.subtitle.awaiting, "still waiting on an answer");
  assert.equal(director.subtitle.text, asked, "the question did not change");
});

test("choosing an option moves the conversation and writes its flag", () => {
  const { director, flags } = play();
  director.start();
  const charger = M01_PLACES.charger;
  director.tick(0.1, worldAt(charger));
  director.press();
  director.tick(0.1, worldAt(charger));
  director.tick(0.1, worldAt(M01_PLACES.shop));
  until(director, worldAt(M01_PLACES.shop), () => director.subtitle?.awaiting);
  assert.equal(director.choose(0), true);
  assert.equal(director.subtitle.awaiting, false, "the question was answered");
  until(director, worldAt(M01_PLACES.shop), () => !director.talking);
  assert.equal(flags.answeredCall, true, "the choice wrote the canonical flag");
});

test("a body count from the fight beat ends it when the street is clear", () => {
  const flags = { collectorOutcome: "refused" };
  let alive = 2;
  const mission = new Mission(m01Definition(), { flags });
  const director = new StoryDirector({
    mission,
    conversations: M01_CONVERSATIONS,
    flags,
    liveBodies: () => Array.from({ length: alive }, () => ({ dead: false })),
  });
  director.start();
  // Jump straight to the fight: this test is about the clear beat only.
  mission.index = mission.definition.beats.findIndex((b) => b.id === "fight");
  mission._enterBeat();
  director.tick(0.1, {});
  assert.equal(mission.beat.id, "fight");
  for (let i = 0; i < 20; i++) director.tick(0.1, {});
  assert.equal(mission.state, "active", "two bodies left, so the beat holds");
  alive = 0;
  // Run past the clear beat's grace window, which exists so the beat cannot
  // complete before its spawner has filled the street.
  for (let i = 0; i < 40; i++) director.tick(0.1, {});
  assert.equal(mission.state, "complete", "the street is clear");
});

test("the objective is announced once per beat, not every frame", () => {
  const { director, seen } = play();
  director.start();
  const charger = M01_PLACES.charger;
  for (let i = 0; i < 30; i++) director.tick(0.1, worldAt({ x: charger.x + 30, z: charger.z }));
  assert.equal(seen.objectives.length, 1, `announced ${seen.objectives.length} times while approaching`);
});

test("dying rewinds to the beat, not to the start of the mission", () => {
  const { director, mission } = play();
  director.start();
  const charger = M01_PLACES.charger;
  director.tick(0.1, worldAt(charger));
  director.press();
  director.tick(0.1, worldAt(charger));
  const before = mission.index;
  assert.ok(before > 0, "we had made progress");
  director.rewind();
  assert.equal(mission.index, before, "the beat is preserved");
  assert.equal(mission.state, "active");
});

test("a beat naming a missing conversation satisfies instead of deadlocking", () => {
  const mission = new Mission({
    id: "T", title: "Test",
    beats: [{ id: "talk", kind: "talk", conversation: "nope", at: { x: 0, z: 0, radius: 5 } }],
  }, { flags: {} });
  const director = new StoryDirector({ mission, conversations: {}, flags: {} });
  director.start();
  director.tick(0.1, { player: { x: 0, z: 0 } });
  assert.equal(mission.state, "complete", "a typo must not soft-lock the game");
});

test("the M01 skeleton is honest about its own shape", () => {
  const def = m01Definition();
  assert.equal(def.id, "M01");
  assert.ok(def.beats.length >= 7, `${def.beats.length} beats`);
  const ids = def.beats.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, "beat ids are unique");
  for (const b of def.beats) {
    if (b.kind === "talk") {
      assert.ok(M01_CONVERSATIONS[b.conversation], `${b.id} names a real conversation`);
    }
    if (b.at) assert.ok(Number.isFinite(b.at.x) && Number.isFinite(b.at.z), `${b.id} has a place`);
  }
});
