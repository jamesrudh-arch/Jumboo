# LEVERAGE: CINDER CITY — Narrative and Vertical-Slice Design

**Working draft 0.2 · 25 November 2026**  
**Status:** Proposed, not approved or implemented. Companion to `LEVERAGE_production_bible_draft.md`; the full campaign scripts, complete research dossier and production bible remain outstanding. All names, scenes, locations and branching specifics below are newly authored proposals, not recovered historic canon.

## 1. Creative decisions and continuity locks

The owner chose an international blend and delegated creative recommendations for an advanced, sophisticated, thrilling, chaotic, dramatic, fun and engaging experience. The prior draft recommends Marcus Vale, Eli Vale, a coastal trading city, family strain, the Blue Ledger, and two proposed Chapter One routes. These are a coherent working direction, not yet owner-approved canon. The original brief's two historical outcomes are unspecified; the branches here do not claim to reproduce them.

**Fixed foundation:** Marcus's brother is kidnapped; Marcus investigates a world of debt, family, crews, corporate interests and betrayal. The Blue Ledger is incomplete and consequential. Six acts, five fighting disciplines, story consequences, X/Y/A/B combat identity, and a campaign design target of at least 60 minutes remain intact.

**Proposed opening order:** studio identity → title → roughly 30-second cinematic → playable scene, following the controlling A–Z front section. The first pre-play accessibility screen must be available before any speech; branding does not require a player to miss spoken content.

### The brothers' contradiction
Marcus wants to leave without abandoning his family. Eli wants to protect people without admitting the cost of his own compromises. Their shared weakness is protecting each other through silence. Their conflict resolves through decisions and scenes, not a revelation that one brother was secretly right about everything.

## 2. Narrative causal chain and evidence contract

The first four missions are a vertical-slice story unit, not a promise that all must be built in the first implementation increment. A later production plan can split them while preserving their continuity.

| ID | Evidence or event | What it supports | What it cannot prove | Essential recovery |
|---|---|---|---|---|
| EV-01 | Interrupted call, originating near Hearthline loading lane | Eli was at or near the lane when the call ended | Who took him or where he was taken | Recent-call log persists; Ruth provides the location if the player misses the audio. |
| EV-02 | Sade's description of a damaged delivery van | A van departed soon after a struggle | Occupants or final destination | Market camera still, found through Tessa, supplies the vehicle description. |
| EV-03 | Omar's signed route copy | A van matching the description was allocated to a dock run | That the driver ordered the kidnapping | Dispatch docket in the garage; Omar can corroborate later. |
| EV-04 | Payment receipt from the Exchange | A debt connected to Eli was sold to a third party | Who physically abducted him | Pavel's interview provides a transaction reference even if the receipt is not collected. |
| EV-05 | Partial Blue Ledger export | There are suspicious transaction IDs and authorisation codes | Intent, guilt, full identity of recipients or a complete chain | Keira retains a separately sourced partial index. |
| EV-06 | Independent cargo manifest and signature comparison | A transfer was altered and an authorisation was used | Whether Eli knowingly authorised the altered shipment | Keira can obtain a delayed certified copy if the office route fails. |

Optional evidence improves certainty and dialogue but does not gate all paths. Each item records acquisition, integrity, reliability, source and disclosure. A statement is a statement, not automatic proof. Ledger identity and sensitive evidence must never appear in a character's dialogue before an explicit information-transfer event.

## 3. Story stages and designed flow

Times below are **planning hypotheses**, not observed durations. Each compact stage should be timed during playtests; dialogue may exceed the guide when needed. These missions alone are not represented as a 60-minute campaign.

### M01 — Last Call

**Narrative purpose:** establish ordinary attachment before its rupture. **Location:** Tessa and Marcus's shop and the adjacent loading lane. **Cast:** Marcus, Tessa, Eli by phone, Sade. **Entry:** new game after intro. **Designed duration:** four stages, each approximately 2–5 minutes before testing.

1. **Ordinary work:** inspect battery, speak to Tessa, answer Eli. Teach movement and interaction without a modal tutorial wall. Leaving the shop is initially gated by the call; pausing and skipping must not silently consume a required choice.
2. **The interruption:** the call ends; inspect call history and navigate to the loading lane. Marcus gets a clear objective, not a real-time rescue countdown.
3. **Witness:** Sade saw a damaged van. Approach with reassurance or pressure; neither option invents knowledge she lacks. Pressuring her lowers trust and makes her less willing to appear later, but does not permanently lose the lead.
4. **Street pressure:** two local collectors seek Eli. The player may talk them down by offering a shop-related favour, withdraw through the open lane or fight. A readable warning precedes a report to police. Damage to an ambient camera is optional; the critical backup clue remains elsewhere.

**Completion:** vehicle description or backup camera still acquired; mission progresses to M02. **Failure:** player incapacitation returns to the latest safe checkpoint; no unsaved relationship delta is duplicated on retry. **Save:** call, clue provenance, witness state, encounter choice and checkpoint. **Tests:** decline first call → recover from log; pressure Sade → alternate clue; defeat → reload without double favour; skip cinematic → mandatory first choice still appears.

#### M01 conversation script — opening and witness

*The battery charger clicks off. Tessa is checking a paper order; the street is visible beyond the open shutter. Cinematic framing returns control before interaction.*

**TESSA:** You fixed that light yet?  
**MARCUS:** It works when it wants to.  
**TESSA:** So do you. The customer comes at ten.  
*Phone vibrates. Caller: ELI. ANSWER and DECLINE appear; neither overlaps movement.*

**If answered:**  
**ELI:** You still owe me for the window.  
**MARCUS:** Ten years and you're still keeping accounts?  
**ELI:** Somebody in this family has to.  
*An engine cuts out on Eli's end. He lowers his voice.*  
**MARCUS:** Where are you?  
**ELI:** If anybody asks about me tonight, you haven't seen me.  
**MARCUS:** Eli—  
*[metal scrape; call disconnects]*  
**TESSA:** Marcus?  
**MARCUS:** That wasn't a goodbye.

**If declined:** a missed call is recorded. Tessa notices the second vibration; the player can open the call log and listen to a short recorded fragment, or Ruth calls later with the loading-lane lead. No required decision is skipped.

*At the lane, Sade moves crates under an awning; she keeps looking toward the road.*  
**MARCUS:** I'm looking for my brother. Did you see a man here?  
**SADE:** I saw a van. I didn't see who was inside.

- **Reassure:** “Tell me what you can. I won't put your name on it.”  
  **SADE:** “Back corner was dented. Blue tarp over the cargo. It went toward the market.” Record `sade_trust=protected`; the promise creates a later obligation.
- **Pressure:** “If you know more and keep quiet, someone else gets hurt.”  
  **SADE:** “I gave you what I saw. Don't bring this to my stall.” Record `sade_trust=afraid`; description remains valid, but later protection requires repair.
- **Leave:** Marcus can investigate the shop camera with Tessa. Sade remains uninformed about the Ledger.

Camera: short two-shot, then gameplay; no forced lip-sync claim. Subtitle speaker names and caption for the scrape are provided as design requirements. Holding skip must not select a dialogue choice.

### M02 — A Debt in Pieces

**Purpose:** show debt as access, silence and obligation, not just a number. **Locations:** market edge, Exchange, garage. **Entry:** M01 lead. **Failure/recovery:** losing a fight reloads a safe checkpoint; refusing both offers unlocks a slower route via Tessa rather than a dead end.

Stages: trace van allocation (EV-03); meet Pavel and inspect receipt (EV-04); decide whether to pay a limited amount, promise a defined delivery favour, or gather an independent transaction reference; confront a collector who challenges Marcus's story. Each option records its actual cost. The favour has a named creditor, due trigger, and repayment/failure response; it is not a repeating grind.

**Pavel dialogue:**  
**PAVEL:** Your brother's debt isn't a suitcase with one owner. It was divided.  
**MARCUS:** Who bought it?  
**PAVEL:** Someone who paid to keep their name off my paper. I can give you a transaction number. I can't give you a face I never saw.  
**MARCUS:** And what do you want?  
**PAVEL:** The delivery my driver can't make. Or enough cash to hire someone else.

**Acceptance:** independent route and payment reference are understandable; player can decline the deal; one obligation is recorded once across save/reload.

### M03 — A Blue Thread

**Purpose:** introduce the Ledger as incomplete evidence. **Locations:** garage, dock service office. **Cast:** Marcus, Tessa, Omar; Keira by recorded message if located. **Stages:** verify van allocation, navigate to office, examine partial export (EV-05), escape or negotiate after security notices entry.

Approaches: persuade Omar with EV-03; enter through a service path; or force a door at increased alert. Core evidence is a partial export, never the complete conspiracy. Optional receipt links a transaction to a shell name; Keira's delayed index supplies an alternate core lead if the export is destroyed. Escape has two readable exits and a checkpoint before alert escalation.

**Omar dialogue:**  
**OMAR:** My name's on the route because I was meant to drive it. Somebody swapped the keys.  
**MARCUS:** You reported it?  
**OMAR:** To the man who signs my wages. He told me I must have remembered wrong.  
**MARCUS:** Then we find the paper he can't make you forget.

**Acceptance:** the player can explain the difference between a suspicious entry and proof; alternatives and evidence integrity survive reload.

### M04 — Two Doors

**Purpose:** turn possession into a costly Chapter One decision. **Locations:** Keira's meeting point and records room. **Entry:** EV-05 or Keira's alternate index. **Stages:** establish provenance; gain access via persuasion, stealth or force; obtain corroborating data; choose a recipient and confirm the intended cost.

**Choice A — controlled disclosure:** disclose an authenticated partial copy to Lena and Keira, with a promise not to publish before corroboration. Security can respond to the leak; the witness is not automatically exposed unless identifying detail was actually shared. **Choice B — private bargain:** give Celia exclusive access to the partial copy for a time-limited route to Eli. Marcus retains an incomplete trace; Meridian gains an opportunity to suppress evidence. The exact historical endings remain unknown and need owner confirmation.

**Keira dialogue:**  
**KEIRA:** That's my index. It isn't the whole ledger.  
**MARCUS:** Can it prove what they did?  
**KEIRA:** It can prove these numbers don't belong together. To prove who changed them, we need the original authorisation.  
**LENA:** Give me a copy and I'll hold it until we can verify it.  
**CELIA (on call):** Give it to me alone and I can tell you where your brother was moved.  
**MARCUS:** Neither of you can promise he'll be safe.  
**KEIRA:** Then choose who gets to know—and remember they can't unknow it.

**Choice UI:** show recipients, what is shared and the known trade-off; no hidden automatic choice. **Commit:** record branch and knowledge recipients as one logical transaction before confirmation. On interruption, restore pre-choice state or completed transaction, never a half-applied branch. **Aftermath:** authored scene differs by branch, with explicit triggers in the state matrix below.

## 4. State and knowledge matrix

State labels describe design semantics, not an implemented schema. A player's choice should generate a visible response and an auditable information event.

| Trigger | Required precondition | Changes | Who learns | Feedback / test |
|---|---|---|---|---|
| Eli call answered | M01 active | `call_eli=answered`, EV-01 source=call | Marcus knows warning and lane | Call log reflects answer; suspend/resume preserves status. |
| Call declined | M01 active | `call_eli=missed` | Marcus does not know warning until recorded fragment heard | No premature dialogue referring to warning. |
| Sade reassured | witness interaction | `sade_trust=protected`, `promise_sade=anonymous` | Marcus learns van description; Sade knows he made promise | Later disclosure of identity must flag broken promise. |
| Sade pressured | witness interaction | `sade_trust=afraid` | Same description; no invented identification | Later witness help requires repair or alternate route. |
| Exchange deal | M02 active and choice confirmed | cash decreases OR `debt_pavel=delivery_due` | Marcus and Pavel know agreement | Retry/load does not charge twice. |
| EV-05 obtained | office or alternate route | partial Ledger + integrity/provenance | Marcus; Keira only upon explicit sharing or her own index | She cannot describe Marcus's copy before seeing it. |
| Disclosure branch | M04 verified copy and confirmed selection | `ledger_path=disclosure`, copy transferred | Lena and Keira learn precisely the shared entries | Branch persists; security learns leak only through authored leak event. |
| Bargain branch | M04 verified copy and confirmed selection | `ledger_path=bargain`, Celia promise recorded | Celia learns shared entries; Lena does not | Eli route available; no disclosure-only dialogue. |
| Sade identity shared | explicit identifying disclosure | `promise_sade=broken`, exposure increases | Named recipient, then only explicit downstream recipients | Contact reacts after learning, not immediately by magic. |

**Invariants:** one Ledger path per playthrough at this decision; branch selection can be revisited only before commit. Mission retry restores a consistent checkpoint snapshot. Logs distinguish evidence physically held, copies transferred, and what a person knows. Schema migrations must preserve meaning, not merely field names.

## 5. Vertical slice recommendation — pre-implementation gate

**Player experience:** one coherent neighbourhood block, the shop and loading lane; M01 from studio presentation through witness encounter, one nonviolent alternative, one combat encounter and persistent result. Include an intentionally small driving proof and crowd/traffic stress scenario as separate acceptance scenarios if the full driving sequence cannot fit the story slice; this reconciles the brief's story slice and its broader vehicle/crowd evaluation without silently declaring either done.

**Quality bar:** representative final-quality art/audio where licensed or commissioned; any temporary content explicitly flagged and rejected for final acceptance. One named character, one witness, one enemy family and a coherent safe-area touch layout. No unlicensed reference-game assets. A complete save/load and failure path is required, not a mockup.

| Gate | Proposed acceptance evidence | Status |
|---|---|---|
| Story and comprehension | New players can identify the objective, distinguish testimony from proof, and explain the consequence of their choice in a recorded session. | Test protocol needed; not tested. |
| Touch and combat | Simultaneous movement/camera input, all X/Y/A/B actions, visible telegraphs, interruption and recovery tested on both target devices; capture missed/accidental touches and fix observed blockers. | Not implemented or tested. |
| Calls and subtitles | Answer, decline, pause, interruption, speaker labels and captions for essential sounds tested with sound muted and with largest selected text. | Not implemented or tested. |
| Save integrity | Force-close at checkpoint and around choice commit; restore a complete pre- or post-choice state and retain the last valid save. | Atomicity is a design goal; platform behaviour must be verified. |
| Vehicle/crowd | Separate representative drive and crowd scenarios, with clear touch interactions, collisions, camera and spawn continuity. | Not implemented or tested. |
| Performance | Capture frame-time distribution, load time, memory and thermal trend after cold launch and sustained representative play; assess iPhone 16 and 13 mini separately against the brief's aspirational 60/30 FPS targets. | No hardware measurements. |
| Release quality | Log reproducible defects with severity, device, version and retest result. No progression blocker at acceptance. | No build. |

## 6. New research, checked 25 November 2026

- **Godot Engine, “Saving games,” 4.7**, publication date not stated: [official documentation](https://docs.godotengine.org/en/4.7/tutorials/io/saving_games.html) shows JSON and binary serialization with FileAccess. This demonstrates possible serialization mechanisms, not atomic replacement, corruption protection, version migration or iPhone suspension safety. **Recommendation:** evaluate a versioned data snapshot and recovery copy against alternatives; verify filesystem and interruption behaviour on the actual runtime. **Verdict:** test after approval; no persistence safety claim yet.
- **Microsoft, “Xbox Accessibility Guideline 104: Subtitles and captions,”** page updated 4 March 2026: [official guideline](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104) distinguishes subtitles for speech from captions for significant non-speech audio and recommends configurable presentation. **Recommendation:** default-on subtitles, optional sound captions, speaker labels and adjustable background; offer settings before first spoken scene. **Limit:** Xbox guidance informs design but does not establish iPhone layout dimensions or compliance. Test with users on the actual small screen.
- **Microsoft, “Accessibility metadata,”** page updated 3 March 2026: [official guide](https://learn.microsoft.com/en-us/gaming/game-publishing/concepts/metadata-accessibility) gives mobile subtitle scaling guidance and warns against overlap with important content. Treat its figures as a reference rather than a verified Xogot UI preset; validate actual scale and safe areas on iPhone. **Verdict:** test, not yet approved.

## 7. Open deliverables

Campaign beyond M04 still needs scene-by-scene scripts, cast dossiers, knowledge and consequence matrices, fight and vehicle specifications, detailed maps, sourcing and rights checks, performance tests and production costing. Research access is not the same as asset inspection or acquisition. Owner approval of the completed bible and vertical-slice plan is still required before game code or project creation.
