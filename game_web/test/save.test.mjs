// Save tests. Every one of these is a bug that would otherwise ship as
// "my progress is corrupt" or "it didn't save".

import test from "node:test";
import assert from "node:assert/strict";
import {
  createStore, save, load, clear, hasSave, restore, validate,
  snapshot, SAVE_VERSION, SAVE_KEY,
} from "../src/save.js";

const runState = () => ({
  wave: 4, health: 62, maxHealth: 100, score: 1240, tier: 5,
  weapon: "shotgun", owned: ["fists", "knife", "pistol", "shotgun"],
  ammo: [["shotgun", 6]], reserve: [["shotgun", 30]], mods: [["shotgun", ["choke"]]],
  mission: { index: 2, flags: { answeredCall: true } },
  flags: { answeredCall: true, pressuredSade: false },
});

test("a save round-trips everything that matters", () => {
  const store = createStore({}); // no localStorage: memory
  assert.equal(save(store, runState()).ok, true);
  const res = load(store);
  assert.equal(res.ok, true);
  const r = restore(res.data);
  assert.equal(r.wave, 4);
  assert.equal(r.health, 62);
  assert.equal(r.weapon, "shotgun");
  assert.deepEqual(r.owned, ["fists", "knife", "pistol", "shotgun"]);
  assert.equal(r.ammo.get("shotgun"), 6);
  assert.equal(r.reserve.get("shotgun"), 30);
  assert.deepEqual(r.mods.get("shotgun"), ["choke"]);
});

test("flags survive, because a choice is what a save is for", () => {
  const store = createStore({});
  save(store, runState());
  const r = restore(load(store).data);
  assert.equal(r.flags.answeredCall, true);
  assert.equal(r.flags.pressuredSade, false);
  assert.equal(r.mission.flags.answeredCall, true);
});

test("nothing saved means no save, not a crash", () => {
  const store = createStore({});
  assert.equal(load(store).ok, false);
  assert.equal(load(store).reason, "empty");
  assert.equal(hasSave(store), false);
  assert.equal(restore(null), null);
});

test("a save from an older version is refused with a reason", () => {
  const store = createStore({});
  store.set(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION - 1, run: { wave: 1, health: 1, owned: [] } }));
  const res = load(store);
  assert.equal(res.ok, false);
  assert.match(res.reason, /version/);
});

test("malformed JSON is refused, not thrown", () => {
  const store = createStore({});
  store.set(SAVE_KEY, "{not json");
  const res = load(store);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not-json");
});

test("a save missing its run is refused", () => {
  assert.equal(validate({ version: SAVE_VERSION }).reason, "no-run");
});

test("non-numeric or impossible values are refused", () => {
  assert.equal(validate({ version: SAVE_VERSION, run: { wave: 0, health: 1, owned: [] } }).reason, "bad-wave");
  assert.equal(validate({ version: SAVE_VERSION, run: { wave: 1, health: "x", owned: [] } }).reason, "bad-health");
  assert.equal(validate({ version: SAVE_VERSION, run: { wave: 1, health: 1, owned: "nope" } }).reason, "bad-owned");
});

test("a valid save validates", () => {
  const data = snapshot(runState());
  assert.equal(validate(data).ok, true);
  assert.equal(validate(JSON.stringify(data)).ok, true, "and as a string");
});

test("clearing a save really clears it", () => {
  const store = createStore({});
  save(store, runState());
  assert.equal(hasSave(store), true);
  clear(store);
  assert.equal(hasSave(store), false);
});

test("a store backed by a broken localStorage falls back instead of throwing", () => {
  const throwing = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  const store = createStore({ localStorage: throwing });
  assert.equal(store.persistent, false, "it noticed");
  assert.equal(save(store, runState()).ok, true, "and still saves, in memory");
  assert.equal(load(store).ok, true);
});

test("a store with a working localStorage is used and reports persistence", () => {
  const mem = new Map();
  const local = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  const store = createStore({ localStorage: local });
  assert.equal(store.persistent, true);
  save(store, runState());
  assert.ok(mem.has(SAVE_KEY), "written to the real store");
});

test("a write failure is reported rather than swallowed", () => {
  // The probe must succeed and the real write must fail, or the store just falls
  // back to memory and the failure never reaches save(). That is the quota case.
  const mem = new Map();
  let first = true;
  const local = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem(k, v) {
      if (first) { first = false; mem.set(k, v); return; } // the probe
      const e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
    },
    removeItem: (k) => mem.delete(k),
  };
  const store = createStore({ localStorage: local });
  assert.equal(store.persistent, true, "the probe passed");
  const res = save(store, runState());
  assert.equal(res.ok, false);
  assert.match(res.reason, /write-failed/);
});

test("a store whose probe fails falls back to memory and keeps working", () => {
  const blocked = {
    getItem: () => null,
    setItem() { throw new Error("blocked"); },
    removeItem() {},
  };
  const store = createStore({ localStorage: blocked });
  assert.equal(store.persistent, false);
  assert.equal(save(store, runState()).ok, true, "still saves, in memory");
});

test("the snapshot is a copy, so mutating the run cannot corrupt a save already made", () => {
  const state = runState();
  const snap = snapshot(state);
  state.owned.push("sniper");
  assert.equal(snap.run.owned.includes("sniper"), false);
});
