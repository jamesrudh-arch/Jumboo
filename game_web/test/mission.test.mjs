// Mission tests. The promise is that a beat is *satisfied*, not timed, and that
// failure rewinds instead of wiping.

import test from "node:test";
import assert from "node:assert/strict";
import { Mission, BEAT, MISSION } from "../src/mission.js";

const def = () => ({
  id: "M01",
  title: "Last Call",
  beats: [
    { id: "inspect", kind: BEAT.INTERACT, at: { x: 0, z: 0, radius: 2.4 }, label: "Inspect the charger" },
    { id: "lane", kind: BEAT.REACH, at: { x: 30, z: 0, radius: 3 }, label: "Get to the lane" },
    { id: "fight", kind: BEAT.CLEAR, label: "Clear the street" },
  ],
});

const playerAt = (x, z) => ({ player: { x, z } });

test("a mission starts idle with nothing to do", () => {
  const m = new Mission(def());
  assert.equal(m.state, MISSION.IDLE);
  assert.equal(m.objective(), null);
});

test("starting shows the first objective", () => {
  const m = new Mission(def());
  const obj = m.start();
  assert.equal(m.state, MISSION.ACTIVE);
  assert.equal(obj.text, "Inspect the charger");
  assert.equal(obj.index, 0);
  assert.equal(obj.total, 3);
});

test("an interact beat needs the player close AND a press", () => {
  const m = new Mission(def());
  m.start();
  // Far away: pressing does nothing.
  m.tick(1 / 60, { ...playerAt(20, 20), interact: () => true });
  assert.equal(m.index, 0, "out of range, no advance");
  // Close, but not pressing.
  m.tick(1 / 60, { ...playerAt(1, 1), interact: () => false });
  assert.equal(m.index, 0, "in range but no press");
  // Close and pressing.
  m.tick(1 / 60, { ...playerAt(1, 1), interact: () => true });
  assert.equal(m.index, 1, "advanced");
});

test("the interact prompt appears only in range and clears when done", () => {
  const prompts = [];
  const m = new Mission(def(), { onPrompt: (p) => prompts.push(p) });
  m.start();
  m.tick(1 / 60, { ...playerAt(50, 50), interact: () => false });
  m.tick(1 / 60, { ...playerAt(1, 1), interact: () => false });
  assert.deepEqual(prompts.slice(-2), [null, "Inspect the charger"]);
});

test("a reach beat advances on arrival and not before", () => {
  const m = new Mission(def());
  m.start();
  m.satisfy("inspect");
  assert.equal(m.beat.id, "lane");
  m.tick(1 / 60, playerAt(10, 0));
  assert.equal(m.index, 1, "not there yet");
  m.tick(1 / 60, playerAt(29, 0));
  assert.equal(m.index, 2, "there");
});

test("a clear beat waits for every body, not the first", () => {
  const m = new Mission(def());
  m.start();
  m.satisfy("inspect");
  m.satisfy("lane");
  assert.equal(m.beat.id, "fight");
  const bodies = [{ dead: false }, { dead: true }];
  m.tick(1 / 60, { bodies });
  assert.equal(m.index, 2, "one alive is not clear");
  bodies[0].dead = true;
  m.tick(1 / 60, { bodies });
  assert.equal(m.state, MISSION.COMPLETE);
});

test("completing fires onComplete exactly once", () => {
  let n = 0;
  const m = new Mission(def(), { onComplete: () => { n += 1; } });
  m.start(); m.satisfy("inspect"); m.satisfy("lane"); m.satisfy("fight");
  assert.equal(m.state, MISSION.COMPLETE);
  m.tick(1 / 60, { bodies: [] });
  assert.equal(n, 1);
});

test("a completed mission has no objective", () => {
  const m = new Mission(def());
  m.start(); m.satisfy("inspect"); m.satisfy("lane"); m.satisfy("fight");
  assert.equal(m.objective(), null);
});

test("a flag beat waits for the flag and skips on timeout if given one", () => {
  const flags = {};
  const m = new Mission({
    id: "t",
    beats: [{ id: "call", kind: BEAT.FLAG, flag: "answeredCall", timeout: 5 }],
  }, { flags });
  m.start();
  m.tick(1, {});
  assert.equal(m.index, 0, "still waiting");
  m.tick(5, {});
  assert.equal(m.state, MISSION.COMPLETE, "timed out into the next state");
});

test("a flag beat advances immediately when the flag is set", () => {
  const flags = { answeredCall: true };
  const m = new Mission({
    id: "t",
    beats: [{ id: "call", kind: BEAT.FLAG, flag: "answeredCall" }],
  }, { flags });
  m.start();
  m.tick(1 / 60, {});
  assert.equal(m.state, MISSION.COMPLETE);
});

test("a hold beat needs the full duration", () => {
  const m = new Mission({ id: "t", beats: [{ id: "hold", kind: BEAT.HOLD, seconds: 3 }] });
  m.start();
  m.tick(2.9, {});
  assert.equal(m.state, MISSION.ACTIVE);
  m.tick(0.2, {});
  assert.equal(m.state, MISSION.COMPLETE);
});

test("going down rewinds to the current beat, not the start of the mission", () => {
  const m = new Mission(def());
  m.start();
  m.satisfy("inspect");
  assert.equal(m.index, 1);
  const cp = m.playerDown();
  assert.equal(cp.index, 1, "the checkpoint is the beat the player was on");
  assert.equal(m.state, MISSION.ACTIVE, "a down is not a mission failure");
});

test("a checkpoint restores the beat index and the flags", () => {
  const flags = { answeredCall: true };
  const m = new Mission(def(), { flags });
  m.start(); m.satisfy("inspect");
  const cp = m.checkpoint();
  const m2 = new Mission(def(), { flags: {} });
  m2.restore(cp);
  assert.equal(m2.index, 1);
  assert.equal(m2.flags.answeredCall, true, "flags came back with it");
});

test("restoring a finished checkpoint reports the mission complete", () => {
  const m = new Mission(def());
  m.start(); m.satisfy("inspect"); m.satisfy("lane"); m.satisfy("fight");
  const m2 = new Mission(def());
  m2.restore(m.checkpoint());
  assert.equal(m2.state, MISSION.COMPLETE);
});

test("a mission with no beats is rejected loudly", () => {
  assert.throws(() => new Mission({ id: "x", beats: [] }), /needs beats/);
  assert.throws(() => new Mission(null), /needs beats/);
});

test("satisfy refuses a beat id that is not current", () => {
  const m = new Mission(def());
  m.start();
  assert.equal(m.satisfy("lane"), false, "the lane is not the current beat");
  assert.equal(m.index, 0);
});

test("beats completed are recorded, so a save knows what happened", () => {
  const m = new Mission(def());
  m.start(); m.satisfy("inspect");
  assert.deepEqual(m.completedBeats.map((b) => b.id), ["inspect"]);
});
