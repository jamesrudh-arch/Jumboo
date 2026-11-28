// M01 "Last Call", tested against the promises the narrative document makes.
//
// This is the document's own acceptance criteria turned into assertions:
//   declining the call must not skip a required decision,
//   pressuring Sade must lower trust without losing the lead,
//   a fight you can walk out of,
//   a checkpoint that does not duplicate a favour.

import test from "node:test";
import assert from "node:assert/strict";
import { Mission, MISSION } from "../src/mission.js";
import { Conversation } from "../src/dialogue.js";
import {
  m01Definition, M01_SHOP, M01_SADE, M01_COLLECTORS, M01_FLAGS, M01_CONVERSATIONS,
  M01_LOG, M01_TESSA_LANE, M01_CAMERA, M01_SPOTTED, M01_MARKET, M01_ALLEY, M01_FAVOUR,
  M01_PLACES,
} from "../src/missions/m01.js";

const run = (script, { flags = {}, pick = null } = {}) => {
  const c = new Conversation(script, { flags });
  c.begin();
  let guard = 0;
  while (!c.done && guard++ < 100) {
    if (c.awaiting) {
      if (pick === null) break;
      c.choose(pick);
    } else {
      c.advance();
    }
  }
  return { conv: c, flags };
};

// ------------------------------------------------------------------ the shop call

test("the shop conversation opens on Tessa and the light", () => {
  const c = new Conversation(M01_SHOP);
  const first = c.begin();
  assert.match(first.text, /charger clicks off/);
  c.advance();
  assert.equal(c.view().speaker, "TESSA");
  assert.match(c.view().text, /fixed that light/);
});

test("answering the call sets answeredCall and plays Eli's warning", () => {
  const { flags } = run(M01_SHOP, { pick: 0 });
  assert.equal(flags[M01_FLAGS.ANSWERED_CALL], true);
  assert.equal(flags[M01_FLAGS.HEARD_ELI], true, "the warning was received");
  assert.equal(flags[M01_FLAGS.DECLINED_CALL], undefined);
});

test("declining records a missed call and still delivers the lead", () => {
  const { conv, flags } = run(M01_SHOP, { pick: 1 });
  assert.equal(flags[M01_FLAGS.DECLINED_CALL], true);
  assert.equal(flags[M01_FLAGS.ANSWERED_CALL], undefined);
  // The document requires the missed call to be recoverable, not a dead end.
  assert.match(conv.log.map((l) => l.text ?? "").join(" "), /call log/);
});

test("both branches end with Marcus saying it wasn't a goodbye", () => {
  for (const pick of [0, 1]) {
    const { conv } = run(M01_SHOP, { pick });
    const said = conv.log.map((l) => l.text).join(" ");
    assert.match(said, /That wasn't a goodbye/, `branch ${pick}`);
  }
});

test("the call cannot be skipped by pressing on — the document forbids it", () => {
  const c = new Conversation(M01_SHOP);
  c.begin();
  let guard = 0;
  while (!c.awaiting && guard++ < 40) c.advance();
  assert.ok(c.awaiting, "it is waiting for an answer");
  for (let i = 0; i < 10; i++) assert.equal(c.advance(), null, "advancing does nothing");
  assert.ok(c.awaiting, "still waiting");
});

test("the answered branch does not fall through into the declined branch", () => {
  const { conv } = run(M01_SHOP, { pick: 0 });
  const said = conv.log.map((l) => l.text ?? "").join(" ");
  assert.ok(!said.includes("missed call"), "the other branch did not run");
});

// ----------------------------------------------------------------------- Sade

test("reassuring Sade sets protected trust and yields the vehicle description", () => {
  const { flags } = run(M01_SADE, { pick: 0 });
  assert.equal(flags[M01_FLAGS.SADE_TRUST], "protected");
  assert.equal(flags[M01_FLAGS.HAS_VEHICLE_DESC], true);
});

test("pressuring Sade sets afraid trust and STILL yields the description", () => {
  const { flags } = run(M01_SADE, { pick: 1 });
  assert.equal(flags[M01_FLAGS.SADE_TRUST], "afraid");
  assert.equal(flags[M01_FLAGS.HAS_VEHICLE_DESC], true,
    "the document is explicit: the description remains valid");
});

test("leaving it is slower but not a dead end — the camera is the other route", () => {
  const { flags } = run(M01_SADE, { pick: 2 });
  assert.equal(flags[M01_FLAGS.HAS_CAMERA_CLUE], true);
  assert.equal(flags[M01_FLAGS.HAS_VEHICLE_DESC], undefined);
  assert.equal(flags[M01_FLAGS.SADE_TRUST], undefined, "she was not pressed or promised");
});

test("the two Sade branches give different dialogue, not the same text twice", () => {
  const a = run(M01_SADE, { pick: 0 }).conv.log.map((l) => l.text).join(" ");
  const b = run(M01_SADE, { pick: 1 }).conv.log.map((l) => l.text).join(" ");
  assert.notEqual(a, b);
  assert.match(a, /won't put your name on it/);
  assert.match(b, /someone else gets hurt/);
});

// ------------------------------------------------------------------ collectors

test("talking the collectors down records a single favour and no fight", () => {
  const { flags } = run(M01_COLLECTORS, { pick: 0 });
  assert.equal(flags[M01_FLAGS.COLLECTORS], "talked");
  assert.equal(flags.collectorFavour, 1);
});

test("withdrawing is a real option and is remembered", () => {
  const { flags } = run(M01_COLLECTORS, { pick: 1 });
  assert.equal(flags[M01_FLAGS.COLLECTORS], "withdrew");
});

test("choosing to fight is remembered so the mission can require the fight", () => {
  const { flags } = run(M01_COLLECTORS, { pick: 2 });
  assert.equal(flags[M01_FLAGS.COLLECTORS], "fought");
});

// ------------------------------------------------------------- the mission shape

test("M01 is the document's four stages, in order", () => {
  const def = m01Definition();
  assert.deepEqual(def.beats.map((b) => b.id), [
    // stage 1: ordinary work
    "charger", "tessa", "call",
    // stage 2: the interruption, out into the district
    "log", "tessaLane", "market", "trace", "van", "lane",
    // stage 3: the witness, by the long way round
    "alley", "alleyTalk", "sneak", "camera", "sade",
    // stage 4: street pressure
    "spotted", "collectors", "favour", "fight",
  ]);
});

test("every stage has more than one thing to do, or it is not a stage", () => {
  // The reason this test exists: M01 was measured at 1.2 minutes because it had
  // three conversations and two walks. A stage with one interaction in it is a
  // prompt, not a stage, and that is how a level ends up far shorter than its
  // author believed.
  const def = m01Definition();
  assert.ok(def.beats.length >= 18, `${def.beats.length} beats`);
  const talks = def.beats.filter((b) => b.kind === "talk").length;
  assert.ok(talks >= 6, `${talks} conversations`);
});

test("every conversation the mission names actually exists", () => {
  const def = m01Definition();
  for (const beat of def.beats) {
    if (!beat.conversation) continue;
    assert.ok(M01_CONVERSATIONS[beat.conversation], `${beat.conversation} is present`);
  }
});

test("the mission requires a lead — description or camera", () => {
  const def = m01Definition();
  assert.equal(def.requires.length, 1);
  assert.deepEqual(def.requires[0].anyOf,
    [M01_FLAGS.HAS_VEHICLE_DESC, M01_FLAGS.HAS_CAMERA_CLUE]);
});

test("a player who talked the collectors down is not sent to fight them", () => {
  const flags = { [M01_FLAGS.COLLECTORS]: "talked" };
  const def = m01Definition();
  const m = new Mission(def, { flags });
  m.start();
  // Walk to the fight beat directly. Resolved by id, not by index: an index in a
  // test is a number that silently starts pointing at a different beat the first
  // time the mission is reordered.
  m.index = def.beats.findIndex((b) => b.id === "fight");
  m._enterBeat();
  assert.equal(m.state, MISSION.COMPLETE, "the fight beat was skipped");
  assert.ok(m.completedBeats.some((b) => b.id === "fight" && b.reason === "condition"));
});

test("a player who chose to fight does get the fight beat", () => {
  const flags = { [M01_FLAGS.COLLECTORS]: "fought" };
  const def = m01Definition();
  const m = new Mission(def, { flags });
  m.start();
  m.index = def.beats.findIndex((b) => b.id === "fight");
  m._enterBeat();
  assert.equal(m.state, MISSION.ACTIVE, "the fight is required");
  assert.equal(m.beat.id, "fight");
});

test("the call beat accepts either answer", () => {
  for (const flag of [M01_FLAGS.ANSWERED_CALL, M01_FLAGS.DECLINED_CALL]) {
    const flags = { [flag]: true };
    const m = new Mission(m01Definition(), { flags });
    m.start();
    m.index = 2;
    m._enterBeat();
    m.tick(1 / 60, {});
    assert.notEqual(m.beat?.id, "call", `${flag} satisfied the call beat`);
  }
});

test("an incomplete mission reports what it is missing rather than completing silently", () => {
  let missing = null;
  const def = m01Definition();
  const m = new Mission(def, { flags: {}, onIncomplete: (reqs) => { missing = reqs; } });
  m.start();
  m.index = def.beats.findIndex((b) => b.id === "fight");
  m._enterBeat(); // fight beat, no unless-flag set, so it is required
  m.satisfy("fight"); // clears the last beat with no lead acquired
  assert.equal(m.state, MISSION.COMPLETE);
  assert.ok(missing, "the missing lead was reported");
});

test("the full canonical path completes with a lead", () => {
  const flags = {};
  const m = new Mission(m01Definition(), { flags });
  m.start();
  // Stage 1: charger, Tessa, the call.
  m.tick(1 / 60, { player: { x: -10.2, z: -8.4 }, interact: () => true });
  assert.equal(m.beat.id, "tessa");
  run(M01_SHOP, { flags, pick: 0 });
  m.satisfy("tessa");
  m.tick(1 / 60, {});
  // The call was answered, so the log beat is skipped and the player goes
  // straight to telling Tessa about it.
  assert.equal(m.beat.id, "tessaLane", "an answered call skips the log");
  // Stage 2: the lane.
  run(M01_TESSA_LANE, { flags });
  m.satisfy("tessaLane");
  m.tick(1 / 60, { player: { x: M01_PLACES.market.x, z: M01_PLACES.market.z } });
  assert.equal(m.beat.id, "trace", "reaching the market opens the stall conversation");
  run(M01_MARKET, { flags, pick: 0 });
  m.satisfy("trace");
  m.tick(1 / 60, { player: { x: M01_PLACES.van.x, z: M01_PLACES.van.z } });
  assert.equal(m.beat.id, "lane", "the van is a place, and reaching it does not need a prompt");
  m.tick(1 / 60, { player: { x: M01_PLACES.lane.x, z: M01_PLACES.lane.z } });
  assert.equal(m.beat.id, "alley");
  m.tick(1 / 60, { player: { x: M01_PLACES.alleyEast.x, z: M01_PLACES.alleyEast.z } });
  assert.equal(m.beat.id, "alleyTalk");
  run(M01_ALLEY, { flags });
  m.satisfy("alleyTalk");
  // Stage 3: cross the watched lane unseen, skip the camera, reach Sade.
  m.tick(1 / 60, { player: { x: M01_PLACES.laneShadow.x, z: M01_PLACES.laneShadow.z }, suspicion: 0 });
  const sneak = m.completedBeats.find((b) => b.id === "sneak");
  assert.equal(sneak.reason, "unseen", "crossing quietly is recorded as unseen");
  assert.equal(m.beat.id, "sade", "the optional camera beat is passed over");
  run(M01_SADE, { flags, pick: 0 });
  m.satisfy("sade");
  // Stage 4: never detected, so the early confrontation is skipped.
  m.tick(1 / 60, {});
  assert.equal(m.beat.id, "collectors", "the detected route did not fire");
  run(M01_COLLECTORS, { flags, pick: 0 });
  m.satisfy("collectors");
  // Talking them down opens the debrief where the obligation is walked through.
  assert.equal(m.beat.id, "favour", "the peace route costs a debrief");
  run(M01_FAVOUR, { flags, pick: 0 });
  m.satisfy("favour");
  // The fight is skipped because they were talked down.
  m.tick(1 / 60, {});
  assert.equal(m.state, MISSION.COMPLETE);
  assert.equal(flags[M01_FLAGS.HAS_VEHICLE_DESC], true);
  assert.equal(m.requirementsMet(), true);
});

test("a down mid-mission rewinds to the beat, keeping the flags", () => {
  const flags = { [M01_FLAGS.ANSWERED_CALL]: true };
  const m = new Mission(m01Definition(), { flags });
  m.start();
  const def = m01Definition();
  m.index = def.beats.findIndex((b) => b.id === "sade");
  m._enterBeat();
  const cp = m.playerDown();
  assert.equal(cp.index, m.index);
  assert.equal(cp.flags[M01_FLAGS.ANSWERED_CALL], true);
});
