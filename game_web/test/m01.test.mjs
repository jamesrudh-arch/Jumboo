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

test("M01 has seven beats in the order the document describes", () => {
  const def = m01Definition();
  assert.deepEqual(def.beats.map((b) => b.id),
    ["charger", "tessa", "call", "lane", "sade", "collectors", "fight"]);
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
  const m = new Mission(m01Definition(), { flags });
  m.start();
  // Walk to the fight beat directly.
  m.index = 6;
  m._enterBeat();
  assert.equal(m.state, MISSION.COMPLETE, "the fight beat was skipped");
  assert.ok(m.completedBeats.some((b) => b.id === "fight" && b.reason === "condition"));
});

test("a player who chose to fight does get the fight beat", () => {
  const flags = { [M01_FLAGS.COLLECTORS]: "fought" };
  const m = new Mission(m01Definition(), { flags });
  m.start();
  m.index = 6;
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
  const m = new Mission(m01Definition(), { flags: {}, onIncomplete: (reqs) => { missing = reqs; } });
  m.start();
  m.index = 6;
  m._enterBeat(); // fight beat, no unless-flag set, so it is required
  m.satisfy("fight"); // clears the last beat with no lead acquired
  assert.equal(m.state, MISSION.COMPLETE);
  assert.ok(missing, "the missing lead was reported");
});

test("the full canonical path completes with a lead", () => {
  const flags = {};
  const m = new Mission(m01Definition(), { flags });
  m.start();
  // 1 charger
  m.tick(1 / 60, { player: { x: -10.2, z: -8.4 }, interact: () => true });
  assert.equal(m.beat.id, "tessa");
  // 2 tessa: the conversation runs, then satisfies the beat
  run(M01_SHOP, { flags, pick: 0 });
  m.satisfy("tessa");
  // 3 call memory
  m.tick(1 / 60, {});
  assert.equal(m.beat.id, "lane");
  // 4 walk there
  m.tick(1 / 60, { player: { x: -8.6, z: -22 } });
  assert.equal(m.beat.id, "sade");
  // 5 sade
  run(M01_SADE, { flags, pick: 0 });
  m.satisfy("sade");
  // 6 collectors
  run(M01_COLLECTORS, { flags, pick: 0 });
  m.satisfy("collectors");
  // 7 fight, skipped because they were talked down
  m.tick(1 / 60, {});
  assert.equal(m.state, MISSION.COMPLETE);
  assert.equal(flags[M01_FLAGS.HAS_VEHICLE_DESC], true);
  assert.equal(m.requirementsMet(), true);
});

test("a down mid-mission rewinds to the beat, keeping the flags", () => {
  const flags = { [M01_FLAGS.ANSWERED_CALL]: true };
  const m = new Mission(m01Definition(), { flags });
  m.start();
  m.index = 4; // sade
  m._enterBeat();
  const cp = m.playerDown();
  assert.equal(cp.index, 4);
  assert.equal(cp.flags[M01_FLAGS.ANSWERED_CALL], true);
});
