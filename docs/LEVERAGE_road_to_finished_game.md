# LEVERAGE: CINDER CITY — the road to a finished game

A-Z plan, written against measured facts rather than estimates. Every number in
the "where we are" section was taken from the running code in this repository on
28 November 2026.

---

## 1. Where we actually are

Measured, not remembered.

| Thing | Actual |
|---|---|
| Wave templates authored | **10** (numbers 1–10, then they loop with a health multiplier) |
| Enemy archetypes | **7** (Watcher, Runner, Brute, Flyer, Pack, Heavy, Sniper) |
| Weapons | **12** |
| Bosses | **3** (waves 10, 20, 30) |
| Districts | **1** (one 140 × 280 m street, no streaming) |
| Story missions in the web build | **0** — the narrative exists in `docs/`, not in the game |
| Dialogue runtime | **none** |
| Save system | **none** |
| Voice-over assets | **0** |
| Audio files total | **14** (two stings, a ring, a call preview, plus generated synth voices) |
| **Time to clear all 15 waves** | **1.7 minutes**, measured with a bot that aims, kites and reloads |
| Boss wave 10 clear time | **7 seconds** |
| Visually verified in a browser | **no** |

### The gap, stated plainly

You asked for levels of 5–8 minutes and a game that does not end at 60 minutes.
That is roughly **50–60 minutes of authored, paced, escalating content** across
perhaps 8–12 missions.

The build currently contains **1.7 minutes**, and that 1.7 minutes is 15 identical
"kill everything that spawns" arenas.

That is a gap of about **35× in content volume**, plus three systems that do not
exist at all (missions, dialogue, save). It is not a gap that closes with more
waves, and adding 50 more waves would produce a longer version of the same
1.7-minute experience, not a game.

---

## 2. Can it be built in one go?

**No.** Not by me in one turn, and not by anyone by writing volume. Three separate
reasons, each with a different answer:

### Reason 1 — the foundation is unverified

Nothing in the web build has been seen running. Every measurement in this
repository comes from Node against fakes that I hand-matched to production. That
catches logic errors — it found the inverted aim and the missing auto-equip, both
of which made the game unplayable — but it cannot tell you whether a punch *feels*
like a punch.

Building 35× more content on an unverified foundation compounds risk. If the
camera, the animation blending or the frame rate is wrong, every mission is built
on those and has to be redone.

**Answer:** one browser session, ideally on the target phone. This is a half-day of
someone's time and it gates everything else.

### Reason 2 — content volume is not a code problem

The 35× is authored material: mission layouts, encounter design, dialogue, voice,
music, bespoke set pieces. Code generates *systems*; it does not generate *levels
that are worth playing*. A procedural mission generator exists and is worth
having, but it produces filler, and filler is exactly what you said you do not
want.

**Answer:** this is real production work with a real duration. Table in §6.

### Reason 3 — voice and music are licensing and cost problems

The "conversation, chatting" part of your brief needs voice acting or
synthesised speech. That is a procurement decision with money attached, not
something code can solve. Options in §5.

**Answer:** needs a decision from you, then a purchase, then integration.

---

## 3. What "advanced, solid, sophisticated" actually requires

Nine systems. Three exist, six do not.

| # | System | State | Why it is required |
|---|---|---|---|
| 1 | Combat | **exists** | Weapons, mods, takedowns, hazards, bosses, feel. Strongest part of the build. |
| 2 | Enemy roster | **exists, thin** | 7 archetypes. Enough for a fight, not for 60 minutes. |
| 3 | Audio | **exists, synthetic** | Occlusion, reverb, panning, surfaces. All generated — no recorded sound. |
| 4 | **Mission/objective scripting** | **missing** | Without it there are only waves. This is the single biggest structural gap. |
| 5 | **Dialogue runtime** | **missing** | Subtitles, speakers, choices, state. The story cannot be told without it. |
| 6 | **Save/checkpoint** | **missing** | A 60-minute game that loses everything on death is not 10/10. |
| 7 | **Traversal** | **missing** | Walk only. No vault, climb, slide, drive. This is what makes action games feel physical. |
| 8 | **Difficulty director** | **missing** | Escalation over 60 minutes needs pacing, not a health multiplier. |
| 9 | **Streaming / multi-district** | **missing** | One district. A campaign needs several, or one that changes. |

### The architecture point that matters most

**35× content by hand is years. 35× content through systems is months.**

Concretely: the district already contains roads, pavements, alleys, a canal, a
harbour, cover boxes and street furniture. A mission is currently impossible to
express because there is no language for one. Building four things converts the
existing city into a level space:

1. **Mission script format** — objectives, triggers, spawn tables, dialogue cues,
   completion and failure conditions, all as data.
2. **Encounter director** — chooses *where* and *when* bodies arrive based on the
   mission beat and player state, instead of spawning on a ring.
3. **Dialogue runtime** — a line is data: speaker, text, audio id, optional choice,
   optional state change.
4. **Checkpoint/save** — serialises run state at named points.

With those four, each mission becomes 200–400 lines of data instead of a month of
bespoke code. That is the difference between 12 missions being feasible and 12
missions being impossible.

---

## 4. What I need from you

Not skills — decisions. In priority order.

| # | Decision | Why it blocks |
|---|---|---|
| 1 | **Play the current build on a real device.** Tell me what feels wrong. | Everything else is built on the camera and the feel. |
| 2 | **Do you want the web build (`game_web/`) or the Godot build (`game/`)?** | They are now parallel products. `game_web` has all the combat; `game` has the approved identity and the call. Doing both is 2× the work forever. |
| 3 | **Voice: pay for TTS, hire actors, or ship subtitles-only?** | Determines whether "conversation" is achievable and at what cost. |
| 4 | **Is the story in `docs/LEVERAGE_narrative_slice_and_state_design.md` still canon?** | M01–M04 are written. I should not invent past them. |
| 5 | **Target device and frame budget** | A phone at 30 fps and a desktop at 60 are different games. |
| 6 | **Budget and timeline you are willing to spend** | Determines whether this is a solo build or a hired team. |

---

## 5. Recommendations: repos, tools, licences, costs

Everything below was screened in `docs/LEVERAGE_playable_template_screening.md`
or is verifiable from the repository. I have not re-cloned them here, so treat
licence lines as *to be confirmed before use*, which is the rule in `AGENTS.md`.

### Code and templates

| Source | Licence | Verdict |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | MIT | **In use, vendored.** r170. Keep. |
| [webgl-games/opencity](https://github.com/webgl-games/opencity) | MIT code, CC0 assets | Best web reference for third-person traversal, vehicles and traffic. Same stack as `game_web`. **Worth reading, not dropping in.** |
| [Godot TPS demo](https://github.com/godotengine/tps-demo) | MIT code, CC BY 3.0 art | Only relevant if you choose the Godot path. Mechanics reference, not a warehouse. |
| [GDQuest RoboBlast](https://github.com/gdquest-demos/godot-4-3D-third-person-controller) | MIT code, CC BY 4.0 art | Same: Godot path only. Art style does not match. |
| [Neonfire controller](https://github.com/NeonfireStudio/godot-advanced-third-person-controller) | **Conflicting** — MIT root, README restricts resale | **Do not import** without written clarification. |

### Animation and characters

| Source | Licence | Cost | Note |
|---|---|---|---|
| Quaternius Universal Animation Library | **CC0** | free | Already credited in the repo. Best free source for locomotion clips — idle, walk, run, crouch, vault, climb. **This is how traversal (§3.7) gets built without an animator.** |
| [Mixamo](https://www.mixamo.com) | Adobe account, **free for use**, but **redistribution of the raw files is restricted** | free | Do not commit raw FBX to the repo. Convert and integrate. Requires an Adobe login, which is an account restriction I must not bypass. |
| [Kenney](https://kenney.nl) | **CC0** | free | Already in use for the city kit. |

### Voice

| Option | Licence / terms | Cost | Verdict |
|---|---|---|---|
| **Azure AI Speech** | Commercial use permitted; neural voices | ≈ $15 per 1M characters | **Recommended.** ~500 lines × 60 chars ≈ 30k chars ≈ **under $1** for the whole campaign. Best quality-to-price for this scope. |
| **ElevenLabs** | Commercial tier required | ≈ $5–$99/mo | Better emotional range for a lead character. Worth it for Marcus and Tessa only. |
| **Hire actors** | Work-for-hire contract needed | $200–$2000 for a small cast | Best result, slowest, needs contracts. |
| **Subtitles only** | none | free | **Ships now.** Honest fallback that still delivers "conversation". |

> A decision is needed here before §6's dialogue work can finish. Subtitles-only is
> a legitimate choice and I can build the whole runtime around it, with voice
> added later by dropping in audio files.

### Music

| Option | Licence | Note |
|---|---|---|
| Generated (current) | ours | The synth already produces ambience and stings. Extendable, no licensing risk. |
| [Free Music Archive](https://freemusicarchive.org) CC BY tracks | attribution required | Cheap, but each track needs checking per-track. |

### Things I would refuse to use

- Any pack whose repository has **no licence file** — public source is not a
  licence. `CityLifeOnline` was screened and rejected for exactly this.
- Any asset requiring an account I would have to bypass.
- Anything that contradicts an approved design in `brand/` or `docs/`.

---

## 6. Content volume: what 60 minutes costs

Assumes the four systems in §3 exist first.

| Layer | Volume needed | Effort (one experienced dev + pipeline) |
|---|---|---|
| **Mission framework** (§3.4–7) | 4 systems | 8–12 weeks |
| **Missions** | 8–12 × 5–8 min | 1–2 weeks each = **8–24 weeks** |
| **Enemy roster** | 7 → 14 archetypes | 3–4 weeks |
| **Weapons** | 12 → 18, plus 10 mods → 24 | 2–3 weeks |
| **Bosses** | 3 → 6 (two per act) | 3–4 weeks |
| **Traversal** | vault, climb, slide, cover | 4–6 weeks |
| **Dialogue runtime + 400–600 lines** | 1 system + writing | 6–8 weeks |
| **Voice** | 400–600 lines | 1 week integration + cost |
| **Music and SFX** | per mission ambience, stings | 4–6 weeks |
| **Polish, balancing, bugfix** | — | 8–12 weeks |
| **Device testing and optimisation** | — | 4 weeks |

**Total: ≈ 7–14 months for one strong developer. ≈ 4–6 months for three people
working in parallel.**

That is the honest number. I would rather give it to you now than after six weeks
of promising.

---

## 7. What I can do next, in one go, that is genuinely worth it

Not 60 minutes of content. **One vertical slice of 6 minutes** — because it proves
the pipeline and gives you something real to judge, and because it is the only
thing that de-risks everything in §6.

### Slice: M01 "Last Call", playable end to end

1. **Mission script runtime** — objectives, triggers, completion, failure, as data.
2. **Dialogue runtime** — subtitle box, speaker names, choices, state effects.
   Voice-ready: a line with no audio file shows text.
3. **Checkpoint/save** — localStorage, survives reload.
4. **M01 authored** — the four beats already written in the narrative doc:
   ordinary work → the interruption → the witness (Sade) → street pressure.
   Includes the choice that changes her later willingness, and a fight you can
   avoid by talking.
5. **Encounter director v1** — bodies arrive from the alley mouths and the canal
   path instead of a ring, and stop arriving when the beat is satisfied.
6. **Difficulty director v1** — rest beats between pressure, so escalation has shape.

That is one 6-minute mission with real story, real choices, real combat and a save
file — and it is the template for the other eleven.

**I should not start it until you have played the current build and told me what
feels wrong**, because the slice is built on the camera and the feel, and those are
the two things Node cannot verify.

---

## 8. The order I would actually work in

1. **You play it.** (blocks everything)
2. Fix what is broken in feel, on the device.
3. Mission runtime + dialogue runtime + save. (the 35× unlock)
4. M01 slice, playable, 6 minutes, with story.
5. You judge the slice. Iterate until it is right.
6. Then produce M02–M12 against the proven template.
7. Traversal, then roster, then weapons, then bosses — in that order, because
   traversal changes every level layout and must land before they are built.
8. Voice, music, polish.
9. Device pass, optimisation, ship.

Steps 3 and 4 are the ones I can do without waiting on a decision, once step 1 has
happened.
