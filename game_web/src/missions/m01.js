// M01 — Last Call.
//
// Authored from `docs/LEVERAGE_narrative_slice_and_state_design.md` §3. The
// dialogue below is that document's script, not new writing: the rule is not to
// invent canon, and this mission is the proof that the existing canon is enough
// to build a playable level from.
//
// Four beats, as specified:
//
//   1. Ordinary work   — inspect the charger, talk to Tessa, answer or decline Eli
//   2. The interruption — the call ends; go to the loading lane
//   3. Witness          — Sade; reassure, pressure, or leave it
//   4. Street pressure  — collectors; talk down, withdraw, or fight
//
// The design promises this mission makes, from the document, each of which is
// enforced by the data below rather than by hope:
//
//   - Declining the call must not skip a required decision: a missed call is
//     recorded and the player can still reach the lane lead. The `declinedCall`
//     flag exists precisely so the branch is remembered, not skipped.
//   - Pressuring Sade lowers trust without losing the lead. Both branches set a
//     `sadeTrust` value and BOTH yield the vehicle description.
//   - Defeat returns to the last safe checkpoint without duplicating a favour.
//     Handled by the mission runtime: a down rewinds to the current beat.
//   - Skipping must not select a choice. Handled by the dialogue runtime: a
//     required choice refuses to be advanced past.

import { BEAT } from "../mission.js";

/** Flags this mission reads and writes. Named so a typo is a missing key, not a silent false. */
export const M01_FLAGS = {
  ANSWERED_CALL: "answeredCall",
  DECLINED_CALL: "declinedCall",
  HEARD_ELI: "heardEliWarning",
  SADE_TRUST: "sadeTrust",
  HAS_VEHICLE_DESC: "hasVehicleDescription",
  HAS_CAMERA_CLUE: "hasCameraClue",
  COLLECTORS: "collectorOutcome",
};

/** Positions are in the district. The shop is on the west lane, the loading lane south of it. */
export const M01_PLACES = {
  shop: { x: -8.6, z: -6, radius: 2.6 },
  charger: { x: -10.2, z: -8.4, radius: 2.2 },
  lane: { x: -8.6, z: -22, radius: 3.4 },
  sade: { x: -7.4, z: -26, radius: 2.6 },
  // The two men hold the mouth of the alley, not the lane itself: they are what
  // stands between Marcus and the way out. This is the only point for that scene;
  // an earlier duplicate `alleyMouth` had nothing in it.
  collectors: { x: -20, z: -24, radius: 3 },
};

// ---------------------------------------------------------------- conversations

/** Tessa, the charger, and the call. Runs at the shop. */
export const M01_SHOP = {
  id: "m01_shop",
  lines: [
    { speaker: null, text: "The battery charger clicks off. Tessa is checking a paper order; the street is visible beyond the open shutter.", narration: true },
    { speaker: "TESSA", text: "You fixed that light yet?" },
    { speaker: "MARCUS", text: "It works when it wants to." },
    { speaker: "TESSA", text: "So do you. The customer comes at ten." },
    { speaker: null, text: "Phone vibrates. Caller: ELI.", narration: true },
    {
      speaker: null,
      text: "Answer, or let it ring.",
      choices: [
        { text: "Answer", goto: "answer", flags: { [M01_FLAGS.ANSWERED_CALL]: true } },
        { text: "Decline", goto: "decline", flags: { [M01_FLAGS.DECLINED_CALL]: true } },
      ],
    },
    { label: "answer", speaker: "ELI", text: "You still owe me for the window." },
    { speaker: "MARCUS", text: "Ten years and you're still keeping accounts?" },
    { speaker: "ELI", text: "Somebody in this family has to." },
    { speaker: null, text: "An engine cuts out on Eli's end. He lowers his voice.", narration: true },
    { speaker: "MARCUS", text: "Where are you?" },
    { speaker: "ELI", text: "If anybody asks about me tonight, you haven't seen me.", flags: { [M01_FLAGS.HEARD_ELI]: true } },
    { speaker: "MARCUS", text: "Eli—" },
    { speaker: null, text: "[metal scrape; the call disconnects]", narration: true, goto: "after" },
    { label: "decline", speaker: null, text: "The phone stops. A missed call is recorded.", narration: true },
    { speaker: "TESSA", text: "You're not going to call him back?" },
    { speaker: "MARCUS", text: "He knows where I am." },
    { speaker: null, text: "The second vibration is the call log. A short fragment: Eli's voice, and an engine cutting out.", narration: true, goto: "after" },
    { label: "after", speaker: "TESSA", text: "Marcus?" },
    { speaker: "MARCUS", text: "That wasn't a goodbye." },
    { label: "end", silent: true, end: true },
  ],
};

/** Sade at the loading lane. Three ways through, all of which yield the lead. */
export const M01_SADE = {
  id: "m01_sade",
  lines: [
    { speaker: null, text: "Sade moves crates under an awning. She keeps looking toward the road.", narration: true },
    { speaker: "MARCUS", text: "I'm looking for my brother. Did you see a man here?" },
    { speaker: "SADE", text: "I saw a van. I didn't see who was inside." },
    {
      speaker: "MARCUS",
      text: "How do you want to play this?",
      choices: [
        {
          text: "Reassure her",
          goto: "reassure",
          flags: { [M01_FLAGS.SADE_TRUST]: "protected" },
        },
        {
          text: "Pressure her",
          goto: "pressure",
          flags: { [M01_FLAGS.SADE_TRUST]: "afraid" },
        },
        { text: "Leave it", goto: "leave" },
      ],
    },

    // Reassure: the lead, and a promise that becomes a later obligation.
    { label: "reassure", speaker: "MARCUS", text: "Tell me what you can. I won't put your name on it." },
    {
      speaker: "SADE",
      text: "Back corner was dented. Blue tarp over the cargo. It went toward the market.",
      flags: { [M01_FLAGS.HAS_VEHICLE_DESC]: true },
      goto: "end",
    },

    // Pressure: the same lead, and a debt. The document is explicit that the
    // description remains valid — pressure is a cost, not a failure.
    { label: "pressure", speaker: "MARCUS", text: "If you know more and keep quiet, someone else gets hurt." },
    {
      speaker: "SADE",
      text: "I gave you what I saw. Don't bring this to my stall.",
      flags: { [M01_FLAGS.HAS_VEHICLE_DESC]: true },
      goto: "end",
    },

    // Leave: the camera is the other route. Slower, not a dead end.
    { label: "leave", speaker: null, text: "Sade goes back to the crates. The shop camera still points at the lane.", narration: true },
    {
      speaker: "MARCUS",
      text: "Then I'll get it the long way.",
      flags: { [M01_FLAGS.HAS_CAMERA_CLUE]: true },
      goto: "end",
    },

    { label: "end", silent: true, end: true },
  ],
};

/** The collectors. A fight you can walk out of, and a warning before it turns. */
export const M01_COLLECTORS = {
  id: "m01_collectors",
  lines: [
    { speaker: null, text: "Two men come out of the alley mouth. Neither has shown their hands yet.", narration: true },
    { speaker: "COLLECTOR", text: "Eli owes. You're Eli's brother. That's close enough." },
    {
      speaker: "MARCUS",
      text: "This does not have to be now.",
      choices: [
        { text: "Offer a shop favour", goto: "favour", flags: { [M01_FLAGS.COLLECTORS]: "talked" } },
        { text: "Walk back into the lane", goto: "withdraw", flags: { [M01_FLAGS.COLLECTORS]: "withdrew" } },
        { text: "Say nothing", goto: "fight", flags: { [M01_FLAGS.COLLECTORS]: "fought" } },
      ],
    },
    {
      label: "favour",
      speaker: "MARCUS",
      text: "The shop has a lift and an address. One delivery, on me. That's more than Eli ever gave you.",
      goto: "favourReply",
    },
    {
      label: "favourReply",
      speaker: "COLLECTOR",
      text: "One delivery. And if it's late, we come back for the lift.",
      // Talking records an obligation, exactly once. The mission runtime's
      // checkpoint guarantee is what stops a reload duplicating it.
      flags: { collectorFavour: 1 },
      goto: "end",
    },
    { label: "withdraw", speaker: null, text: "Marcus backs into the lane. They let him go, and follow at a distance.", narration: true, goto: "end" },
    { label: "fight", speaker: "COLLECTOR", text: "Then it's now.", goto: "end" },
    { label: "end", silent: true, end: true },
  ],
};

// ------------------------------------------------------------------- the mission

/**
 * M01 as a mission definition.
 *
 * `spawns` describes the bodies the `clear` beat is allowed to bring in, so the
 * fight at the end is authored rather than a random wave.
 */
export function m01Definition() {
  return {
    id: "M01",
    title: "Last Call",
    act: "I",
    // Planning hypothesis from the document: 2-5 minutes per stage. The beats are
    // what enforce it, not a timer.
    beats: [
      {
        id: "charger",
        kind: BEAT.INTERACT,
        at: M01_PLACES.charger,
        label: "Inspect the charger",
      },
      {
        id: "tessa",
        kind: BEAT.TALK,
        conversation: M01_SHOP.id,
        at: M01_PLACES.shop,
        label: "Talk to Tessa",
      },
      {
        // The call is answered or declined inside the conversation above, so this
        // beat is the memory of it, not a second question.
        id: "call",
        kind: BEAT.FLAG,
        flag: M01_FLAGS.ANSWERED_CALL,
        optional: true,
        expect: true,
        timeout: null,
        label: "The call",
        // Waits rather than blocks: both outcomes continue the mission.
        anyOf: [M01_FLAGS.ANSWERED_CALL, M01_FLAGS.DECLINED_CALL],
      },
      {
        id: "lane",
        kind: BEAT.REACH,
        at: M01_PLACES.lane,
        label: "Get to the loading lane",
      },
      {
        id: "sade",
        kind: BEAT.TALK,
        conversation: M01_SADE.id,
        at: M01_PLACES.sade,
        label: "Talk to Sade",
      },
      {
        id: "collectors",
        kind: BEAT.TALK,
        conversation: M01_COLLECTORS.id,
        at: M01_PLACES.collectors,
        label: "Two men at the alley",
        // The conversation runs first and sets collectorOutcome; a `fought`
        // outcome then requires the fight beat, which is optional-conditional.
      },
      {
        id: "fight",
        kind: BEAT.CLEAR,
        label: "Clear the loading lane",
        // Only required when they were not talked down. The runtime skips a beat
        // whose `unless` flag is set.
        unless: [M01_FLAGS.COLLECTORS],
        unlessValue: ["talked", "withdrew"],
        spawns: [
          { archetype: "pack", from: "alley" },
          { archetype: "pack", from: "alley" },
        ],
      },
    ],
    // What the mission must have produced to count. The document requires the
    // vehicle description OR the camera clue.
    requires: [
      { anyOf: [M01_FLAGS.HAS_VEHICLE_DESC, M01_FLAGS.HAS_CAMERA_CLUE], note: "a lead" },
    ],
    next: "M02",
  };
}

/** Every conversation in the mission, keyed by id, so a loader can find them. */
export const M01_CONVERSATIONS = {
  [M01_SHOP.id]: M01_SHOP,
  [M01_SADE.id]: M01_SADE,
  [M01_COLLECTORS.id]: M01_COLLECTORS,
};
