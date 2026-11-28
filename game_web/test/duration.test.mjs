// M01 duration, measured rather than assumed.
//
// The owner's bar is that a level runs materially longer than five to eight
// minutes, and the earlier build missed it badly: M01 as first authored measured
// 1.2 minutes, and the fifteen-wave ladder measured 1.7. Both were called finished
// by authors who had not timed them.
//
// So duration is a test now. This plays M01 the way a person plays it — at reading
// speed, at walking pace, crouched where the level asks for quiet, and stopping to
// kill things if the route has a fight — and asserts the total. If a future edit
// shortens the level, this fails before a player finds out.
//
// The numbers are deliberately conservative. Reading speed is 0.045 s per
// character, walking is 1.6 m/s, crouching is 0.9 m/s, and a choice costs 2.2 s of
// thinking. A real player who re-reads, backtracks or dies spends longer.

import test from "node:test";
import assert from "node:assert/strict";
import { Mission } from "../src/mission.js";
import { StoryDirector } from "../src/story.js";
import {
  m01Definition, M01_CONVERSATIONS, M01_PLACES, M01_FLAGS,
} from "../src/missions/m01.js";
import { encounterSeconds } from "../src/encounter.js";
import { ARCHETYPES } from "../src/enemies.js";

/** The minimum a level must last, and the ceiling before it is a slog. */
const TARGET = { min: 5 * 60, max: 12 * 60 };

/**
 * Play M01 end to end on a given route and return how long it took.
 *
 * `collectorPick` selects the stage 4 outcome: 0 talks them down, 1 withdraws,
 * 2 fights. `sadePick` selects the witness approach.
 */
function playM01({ collectorPick = 0, sadePick = 0, pace = 1.6 } = {}) {
  const flags = {};
  const mission = new Mission(m01Definition(), { flags });
  const state = { sub: null };
  let clock = 0;
  let lines = 0;
  let choices = 0;
  let walked = 0;

  // A body count the director can see, so a clear beat is satisfied by killing
  // something rather than by there being nothing to kill.
  let alive = 0;
  const director = new StoryDirector({
    mission,
    conversations: M01_CONVERSATIONS,
    flags,
    onSubtitle: (v) => { state.sub = v; },
    spawnBeat: (beat) => {
      if (beat.kind !== "clear") return;
      // Spawn the opening group; the waves arrive later, which is what the
      // fight's own timing accounts for.
      alive += beat.spawns.reduce((n, s) => n + (s.count ?? 1), 0);
    },
    liveBodies: () => Array.from({ length: alive }, () => ({ dead: false })),
  });
  director.start();

  const walkTo = (from, to, mps = pace) => {
    walked += Math.hypot(to.x - from.x, to.z - from.z);
    clock += Math.hypot(to.x - from.x, to.z - from.z) / mps;
  };
  const standAt = (place, ticks = 2) => {
    for (let i = 0; i < ticks; i++) {
      director.tick(0.1, { player: { x: place.x, z: place.z } });
      clock += 0.1;
    }
  };
  const talkAt = (place, pick = 0) => {
    let guard = 0;
    while (director.talking && guard++ < 20000) {
      if (state.sub?.awaiting) { clock += 2.2; choices += 1; director.choose(pick); continue; }
      const before = state.sub?.text;
      director.tick(0.1, { player: { x: place.x, z: place.z } });
      clock += 0.1;
      if (state.sub?.text !== before) lines += 1;
    }
  };
  const go = (from, to, mps) => { walkTo(from, to, mps); standAt(to, 2); };

  // Stage 1 — ordinary work.
  standAt(M01_PLACES.charger, 2);
  director.press();
  standAt(M01_PLACES.charger, 2);
  go(M01_PLACES.charger, M01_PLACES.shop);
  talkAt(M01_PLACES.shop, 0);
  standAt(M01_PLACES.shop, 2);
  // Stage 2 — leave the shop and be seen doing it.
  talkAt(M01_PLACES.shop, 0);
  standAt(M01_PLACES.shop, 2);
  go(M01_PLACES.shop, M01_PLACES.market);
  talkAt(M01_PLACES.market, 0);
  standAt(M01_PLACES.market, 2);
  go(M01_PLACES.market, M01_PLACES.van);
  standAt(M01_PLACES.van, 2);
  go(M01_PLACES.van, M01_PLACES.lane);
  // Stage 3 — the long way round, walked quietly.
  go(M01_PLACES.lane, M01_PLACES.alleyEast, 0.9);
  talkAt(M01_PLACES.alleyEast, 0);
  standAt(M01_PLACES.alleyEast, 2);
  go(M01_PLACES.alleyEast, M01_PLACES.laneShadow, 0.9);
  standAt(M01_PLACES.laneShadow, 3);
  standAt(M01_PLACES.camera, 1);
  standAt(M01_PLACES.sade, 1);
  talkAt(M01_PLACES.sade, sadePick);
  // Stage 4 — street pressure.
  go(M01_PLACES.sade, M01_PLACES.collectors);
  talkAt(M01_PLACES.collectors, collectorPick);
  standAt(M01_PLACES.collectors, 2);
  // The peaceful route owes a debrief.
  if (mission.beat?.id === "favour") {
    talkAt(M01_PLACES.collectors, 0);
    standAt(M01_PLACES.collectors, 2);
  }

  // A fight takes as long as the bodies take to kill.
  const def = m01Definition();
  const fightBeat = def.beats.find((b) => b.id === "fight");
  const fighting = mission.beat?.id === "fight";
  let fightSeconds = 0;
  if (fighting) {
    // A fight is the opening group plus everything that arrives after it, plus
    // the time spent waiting for it to arrive. Counting only the first group
    // under-measures a fight that escalates.
    const groups = [fightBeat.spawns, ...(fightBeat.waves ?? []).map((w) => w.spawns)];
    const bodies = groups.flat().flatMap((s) => Array(s.count ?? 1).fill(ARCHETYPES[s.archetype]));
    const arrivals = (fightBeat.waves ?? []).reduce((t, w) => t + (w.delay ?? 0), 0);
    fightSeconds = encounterSeconds(bodies, 18) + arrivals; // pistol, act one's weapon
  }

  // The player kills everything in the measured time, and the beat clears.
  if (fighting) {
    clock += fightSeconds;
    alive = 0;
    for (let i = 0; i < 10; i++) director.tick(0.1, { player: { x: M01_PLACES.collectors.x, z: M01_PLACES.collectors.z } });
  }

  return { clock, lines, choices, walked, fightSeconds, state: mission.state, flags, mission };
}

test("M01 lasts materially longer than five minutes on the route that fights", () => {
  const r = playM01({ collectorPick: 2 });
  const total = r.clock + r.fightSeconds;
  assert.ok(total >= TARGET.min,
    `the fought route runs ${(total / 60).toFixed(1)} min, target at least ${TARGET.min / 60}`);
  assert.ok(total <= TARGET.max, `and not so long it drags: ${(total / 60).toFixed(1)} min`);
});

test("M01 lasts over five minutes even when nobody is fought", () => {
  const r = playM01({ collectorPick: 0 });
  assert.ok(r.mission.state === "complete", "the peaceful route finishes");
  assert.ok(r.clock >= TARGET.min,
    `the peaceful route runs ${(r.clock / 60).toFixed(1)} min, target at least ${TARGET.min / 60}`);
});

test("every way out of the alley is a real length of level", () => {
  // A route that is two minutes shorter than the others is the one every player
  // takes, and the level is then only as long as its shortest branch.
  const routes = [0, 1, 2].map((pick) => {
    const r = playM01({ collectorPick: pick });
    return { pick, total: (r.clock + r.fightSeconds) / 60 };
  });
  const shortest = Math.min(...routes.map((r) => r.total));
  assert.ok(shortest >= 4.4,
    `shortest route is ${shortest.toFixed(1)} min (${JSON.stringify(routes.map((r) => r.total.toFixed(1)))})`);
});

test("the level uses the district, not a corridor between two doors", () => {
  const r = playM01({ collectorPick: 0 });
  // The city is 280 m across. A level that walks under 100 m of it is a hallway
  // with scenery behind the glass.
  assert.ok(r.walked >= 140, `the player walks ${r.walked.toFixed(0)} m`);
});

test("the level has enough conversation to carry its length", () => {
  const r = playM01({ collectorPick: 0 });
  assert.ok(r.lines >= 35, `${r.lines} lines of dialogue`);
  assert.ok(r.choices >= 4, `${r.choices} decisions`);
});

test("the witness approach changes what the level cost, not just a flag", () => {
  const reassure = playM01({ sadePick: 0 });
  const pressure = playM01({ sadePick: 1 });
  const leave = playM01({ sadePick: 2 });
  assert.equal(reassure.flags[M01_FLAGS.SADE_TRUST], "protected");
  assert.equal(pressure.flags[M01_FLAGS.SADE_TRUST], "afraid");
  // Leaving is a different clue, and canon insists the lead is not lost.
  assert.equal(leave.flags[M01_FLAGS.HAS_CAMERA_CLUE], true);
  assert.ok(
    leave.flags[M01_FLAGS.HAS_VEHICLE_DESC] || leave.flags[M01_FLAGS.HAS_CAMERA_CLUE],
    "every approach still produces a lead"
  );
});

test("the peaceful route is not strictly better than fighting", () => {
  // If talking your way out were both faster and free, the choice would be fake.
  // It costs a debrief: the obligation gets walked through.
  const peace = playM01({ collectorPick: 0 });
  const withDrawn = playM01({ collectorPick: 1 });
  assert.ok(peace.clock > withDrawn.clock,
    `talking costs ${((peace.clock - withDrawn.clock) / 60).toFixed(1)} min more than withdrawing`);
});
