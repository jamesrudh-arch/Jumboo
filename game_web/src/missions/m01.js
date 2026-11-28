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
  /** Set when the lane was walked loudly and the confrontation came to Marcus. */
  SPOTTED_ROUTE: "spottedRoute",
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
  // Stage 2's search: the phone's call log is at the counter, not in Marcus's
  // pocket, which is the whole reason he has to go back inside for it.
  callLog: { x: -9.4, z: -5.2, radius: 2.0 },
  // The camera the canon allows as an optional clue. It watches the lane mouth.
  camera: { x: -17.2, z: -21.4, radius: 2.2 },
  // Stage 3 is a route, not a point: these are the shadows it is walked through.
  laneShadow: { x: -11.5, z: -19.5, radius: 2.6 },
  // Stage 2 sends Marcus out to the market edge to find the van's paperwork,
  // which is the district the canon names and 60 m of street the level was not
  // using. The market is on the alley the city already has.
  market: { x: -34, z: -25, radius: 3.4 },
  // The van itself is parked where the alley meets the cross-street: visible from
  // the market, which is what makes tracing it a route rather than a fetch.
  van: { x: -48, z: -25, radius: 3 },
  // Stage 3's alleys, east of the lane: the long way round, walked quietly.
  alleyEast: { x: 20, z: -28, radius: 3.2 },
  // Back across the lane to the loading dock, which is where the collectors are
  // waiting and where the mission ends.
  dock: { x: -8.6, z: -40, radius: 3.4 },
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

/**
 * The shop, part two: the call log.
 *
 * Canon: "decline first call -> recover from log". Declining is not a dead end,
 * it is a slower route, so this is where the player gets the same lead by looking
 * for it. Eli's fragment is the evidence the mission actually needs; the call
 * itself was only the convenient way to hear it.
 */
export const M01_LOG = {
  id: "m01_log",
  lines: [
    { speaker: null, text: "The counter phone. The log holds four seconds of the call that never connected.", narration: true },
    { speaker: "MARCUS", text: "Play it." },
    { speaker: "ELI", text: "—if anybody asks about me tonight, you haven't seen me.", audio: null },
    { speaker: null, text: "A metal scrape. An engine, idling somewhere with a roof over it.", narration: true },
    { speaker: "TESSA", text: "That's a loading bay. Listen to it." },
    { speaker: "MARCUS", text: "It's not a goodbye." },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * Tessa at the shutter, before the lane.
 *
 * Her function is not exposition: she is the person who tells the player the
 * stakes in a way a menu cannot, and she is the one who notices whether Marcus
 * has started treating the street like an enemy.
 */
export const M01_TESSA_LANE = {
  id: "m01_tessa_lane",
  lines: [
    { speaker: "TESSA", text: "You're going out there because of a phone call." },
    { speaker: "MARCUS", text: "I'm going out there because he's my brother." },
    {
      speaker: "TESSA",
      text: "Those two men have been on this street since Tuesday. They are not looking for Eli. They are looking for someone who answers.",
      // No mechanical effect: a line that only exists to make a choice harder to
      // make is doing its job.
    },
    { speaker: "MARCUS", text: "Then I'll answer quietly." },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * The camera on the lane mouth.
 *
 * Canon: "damage to an ambient camera is optional; the critical backup clue
 * remains elsewhere." So this conversation offers the trade honestly — the camera
 * watches the lane, and taking it out covers a route the player has not walked
 * yet. It never becomes the only way forward.
 */
export const M01_CAMERA = {
  id: "m01_camera",
  lines: [
    { speaker: null, text: "A camera on a bracket, pointed down the lane. Its red light is steady.", narration: true },
    {
      speaker: "MARCUS",
      text: "If it saw the van, it saw it before the van was cleaned.",
      choices: [
        { text: "Kill the camera", goto: "kill", flags: { cameraOff: true, hasCameraClue: true } },
        { text: "Leave it running", goto: "leave", flags: { cameraOff: false } },
      ],
    },
    {
      label: "kill",
      speaker: null,
      text: "The bracket gives. The light goes out. Somewhere behind the shutter, a screen goes to static.",
      narration: true,
      goto: "end",
    },
    {
      label: "leave",
      speaker: "MARCUS",
      text: "Not yet. If I take it out, someone comes to fix it, and then they know I was here.",
      goto: "end",
    },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * Walking the collectors out.
 *
 * The peaceful route currently ends the mission the moment the conversation does,
 * which makes "offer a favour" strictly better than fighting: same lead, less
 * time, no risk. This is the cost — the obligation is walked through, not
 * stamped — and it is also where Marcus finds out what he has agreed to.
 */
export const M01_FAVOUR = {
  id: "m01_favour",
  lines: [
    { speaker: null, text: "They don't shake hands. One of them takes a folded invoice out of his coat and writes on the back of it.", narration: true },
    { speaker: "COLLECTOR", text: "Third unit, Thursday, the lift. Anything comes down that shaft after nine, it's ours." },
    { speaker: "MARCUS", text: "And Eli?" },
    { speaker: "COLLECTOR", text: "Eli's not a lift. Eli's a conversation we haven't had yet." },
    { speaker: null, text: "They walk back into the alley. The invoice is a delivery order for something Marcus has not been told the name of.", narration: true },
    {
      speaker: "MARCUS",
      text: "One delivery. Then we're square.",
      choices: [
        { text: "Keep the invoice", goto: "keep", flags: { favourInvoice: true } },
        { text: "Leave it on the crate", goto: "crate" },
      ],
    },
    {
      label: "keep",
      speaker: null,
      text: "The paper goes inside Marcus's coat. It is the only thing he has that says the debt was real.",
      narration: true,
      goto: "end",
    },
    {
      label: "crate",
      speaker: null,
      text: "The paper stays where he puts it. Rain will take the ink by morning, and the debt will not need it.",
      narration: true,
      goto: "end",
    },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * The market edge: tracing the van.
 *
 * Canon's stage 2 is "inspect call history and navigate to the loading lane", and
 * the state matrix gives it EV-03, the van allocation. This is where Marcus turns
 * a four-second fragment into something with a plate on it — and where the player
 * learns the alley is a place other people also watch.
 */
export const M01_MARKET = {
  id: "m01_market",
  lines: [
    { speaker: null, text: "The market edge never closes, it just gets quieter. A woman is folding a tarpaulin over crates that have been rained on.", narration: true },
    { speaker: "MARCUS", text: "The white van. Damaged front, passenger side. You'd have seen it if it came down this alley." },
    { speaker: "STALLHOLDER", text: "I see a lot of vans." },
    {
      speaker: "MARCUS",
      text: "This one came in loud and left quiet. Somebody paid for the quiet.",
      choices: [
        { text: "Show her the call fragment", goto: "fragment", flags: { marketCooperative: true } },
        { text: "Give her the shop's name", goto: "name" },
      ],
    },
    {
      label: "fragment",
      speaker: "STALLHOLDER",
      text: "That engine. That's the wholesaler's run. They load at the exchange and they don't come back empty.",
      flags: { hasVanAllocation: true },
      goto: "van",
    },
    {
      label: "name",
      speaker: "STALLHOLDER",
      text: "Tessa's boy. All right. The wholesaler's run loads at the exchange. Ask them what came back in the van instead.",
      flags: { hasVanAllocation: true, owedTessa: true },
      goto: "van",
    },
    {
      label: "van",
      speaker: null,
      text: "Beyond the tarpaulins, an alley, and in it a white van with a passenger-side wound. Nobody is standing next to it.",
      narration: true,
      flags: { hasVehicleDescription: true },
      goto: "end",
    },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * The dockside approach.
 *
 * Stage 3's long way round: the loading dock is watched from the lane, so the
 * alleys east of it are the route that does not walk through the watchers. This
 * is not a shortcut for the player — it is longer — it is a route that can be
 * taken quietly, which is the trade the stage is about.
 */
export const M01_ALLEY = {
  id: "m01_alley",
  lines: [
    { speaker: null, text: "The east alley runs behind the shuttered units. Water moves in the gutters with nowhere to go.", narration: true },
    { speaker: "MARCUS", text: "Every city has a back door. Most of them are wet." },
    { speaker: null, text: "A dog watches from under a pallet and decides Marcus is not worth the noise.", narration: true },
    { label: "end", silent: true, end: true },
  ],
};

/**
 * The collectors, arriving early.
 *
 * This is the same confrontation as M01_COLLECTORS, keyed off a different cause:
 * if the lane is walked loudly, they come to Marcus instead of waiting at the
 * mouth. It exists because a stealth stage that can only be failed silently is
 * not a stage — the player needs to see what being seen costs.
 */
export const M01_SPOTTED = {
  id: "m01_spotted",
  lines: [
    { speaker: null, text: "A torch cuts across the lane and holds on Marcus's hands.", narration: true },
    { speaker: "COLLECTOR", text: "You're the brother. You walk like you've got somewhere to be." },
    { speaker: "MARCUS", text: "I walk like a man carrying a battery." },
    {
      speaker: "COLLECTOR",
      text: "Put it down and we'll talk about Eli.",
      choices: [
        { text: "Talk", goto: "talk", flags: { [M01_FLAGS.COLLECTORS]: "talked", spottedRoute: true } },
        { text: "Move first", goto: "fight", flags: { [M01_FLAGS.COLLECTORS]: "fought", spottedRoute: true } },
      ],
    },
    { label: "talk", speaker: "MARCUS", text: "This does not have to be now.", goto: "end" },
    { label: "fight", speaker: null, text: "The torch hits the wet concrete before the first man does.", narration: true, goto: "end" },
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
    // Four stages, as the narrative document lays them out. Each one is satisfied
    // by what the player does rather than by a clock, which is what lets a careful
    // player take ten minutes and a reckless one take five without the mission
    // ever getting ahead of them.
    beats: [
      // ---------------------------------------------------- stage 1: ordinary work
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

      // ------------------------------------------------- stage 2: the interruption
      {
        // Declining the call means the log is the only way to the lead. Optional
        // when the call was answered, because the player already has the fragment
        // and making them re-hear it is a chore dressed as a stage.
        id: "log",
        kind: BEAT.TALK,
        conversation: M01_LOG.id,
        at: M01_PLACES.callLog,
        label: "Check the call log",
        unless: [M01_FLAGS.ANSWERED_CALL],
      },
      {
        id: "tessaLane",
        kind: BEAT.TALK,
        conversation: M01_TESSA_LANE.id,
        at: M01_PLACES.shop,
        label: "Say it to Tessa plainly",
      },
      {
        // The district, not a corridor: the market edge is 60 m of street the
        // level was not using, and tracing the van there is what turns a fragment
        // into a plate number.
        id: "market",
        kind: BEAT.REACH,
        at: M01_PLACES.market,
        label: "Find where the van came from",
      },
      {
        id: "trace",
        kind: BEAT.TALK,
        conversation: M01_MARKET.id,
        at: M01_PLACES.market,
        label: "Ask at the market",
      },
      {
        id: "van",
        kind: BEAT.REACH,
        at: M01_PLACES.van,
        label: "Look at the van",
      },
      {
        id: "lane",
        kind: BEAT.REACH,
        at: M01_PLACES.lane,
        label: "Get back to the loading lane",
      },

      // ---------------------------------------------------- stage 3: the witness
      {
        // The long way round. Not a shortcut — a route that can be walked quietly,
        // which is exactly the trade stage 3 is about.
        id: "alley",
        kind: BEAT.REACH,
        at: M01_PLACES.alleyEast,
        label: "Take the long way round",
      },
      {
        id: "alleyTalk",
        kind: BEAT.TALK,
        conversation: M01_ALLEY.id,
        at: M01_PLACES.alleyEast,
        label: "Through the east alley",
      },
      {
        // The lane is watched. This is the beat that makes stage 3 a stage: the
        // route in is the gameplay, and being seen is an alternative rather than
        // a failure.
        id: "sneak",
        kind: BEAT.SNEAK,
        at: M01_PLACES.laneShadow,
        tolerance: 1,
        label: "Cross the lane unseen",
      },
      {
        // Optional, and canon says so: the camera is an ambient clue, never the
        // only way to the vehicle description.
        id: "camera",
        kind: BEAT.TALK,
        conversation: M01_CAMERA.id,
        at: M01_PLACES.camera,
        label: "The camera on the lane mouth",
        optional: true,
      },
      {
        id: "sade",
        kind: BEAT.TALK,
        conversation: M01_SADE.id,
        at: M01_PLACES.sade,
        label: "Talk to Sade",
      },

      // ---------------------------------------------------- stage 4: street pressure
      {
        // If the lane was walked loudly, the collectors come to Marcus and the
        // confrontation starts here instead. `unless` keeps the two routes from
        // both firing.
        id: "spotted",
        kind: BEAT.TALK,
        conversation: M01_SPOTTED.id,
        at: M01_PLACES.laneShadow,
        label: "They saw you",
        unless: [M01_FLAGS.SPOTTED_ROUTE],
        // Only on the detected route: the runtime reads `detected` off the mission.
        requiresDetected: true,
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
        // The cost of talking your way out: the obligation gets walked through,
        // and the player hears what they actually agreed to. Without it the peace
        // route is strictly better than the fight and the choice is not a choice.
        id: "favour",
        kind: BEAT.TALK,
        conversation: M01_FAVOUR.id,
        at: M01_PLACES.collectors,
        label: "What you just agreed to",
        unless: [M01_FLAGS.COLLECTORS],
        // Only when they were actually talked down: withdrawing leaves them
        // following at a distance, which is a different problem for M02.
        unlessValue: ["fought", "withdrew"],
      },
      {
        id: "fight",
        kind: BEAT.CLEAR,
        label: "Clear the loading lane",
        // Only required when they were not talked down. The runtime skips a beat
        // whose `unless` flag is set.
        unless: [M01_FLAGS.COLLECTORS],
        unlessValue: ["talked", "withdrew"],
        // A fight here is not two bodies on a street: it is the collectors, their
        // backup, and enough weight that talking the player out of it earlier was
        // worth something. Tuned against the encounter audit, not by feel.
        // Two groups, not one list: the men at the alley, then the man they sent
        // for. A single group is one exchange; two is a fight that changes shape
        // halfway, which is the difference between a gate and a set piece.
        spawns: [
          { archetype: "runner", count: 2 },
          { archetype: "pack", count: 2 },
        ],
        waves: [
          { delay: 3, spawns: [
            { archetype: "heavy", count: 1 },
            { archetype: "runner", count: 2 },
          ] },
          { delay: 9, spawns: [
            { archetype: "pack", count: 3 },
          ] },
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
  [M01_LOG.id]: M01_LOG,
  [M01_TESSA_LANE.id]: M01_TESSA_LANE,
  [M01_CAMERA.id]: M01_CAMERA,
  [M01_SPOTTED.id]: M01_SPOTTED,
  [M01_MARKET.id]: M01_MARKET,
  [M01_FAVOUR.id]: M01_FAVOUR,
  [M01_ALLEY.id]: M01_ALLEY,
  [M01_SHOP.id]: M01_SHOP,
  [M01_SADE.id]: M01_SADE,
  [M01_COLLECTORS.id]: M01_COLLECTORS,
};
