# LEVERAGE: CINDER CITY — arsenal, escalation and game feel

**Design document for owner review. 27 November 2026.** This covers the combat progression now built and playable in `game_web` (the browser study), and the plan for taking it further. Nothing here is canon, approved, balanced by playtest or performance-measured on a phone. Numbers are the ones in the shipped study code, so they can be checked and changed rather than taken on trust.

Related: `game_web/README.md` (what the study is), `docs/LEVERAGE_narrative_slice_and_state_design.md` (the approved M01 beat this sits inside), `docs/LEVERAGE_research_pipeline_review.md` (the reference-game reasoning this follows).

---

## 1. The problem this solves

The study had **no combat at all**. `src/world.js` carried `player {x, z, yaw, stance, stamina, noise}`, a `PHASE` machine of BRIEFING/PLAY/HUNT/CAUGHT/WON, and a score. Being *seen* was the only failure and there was no way to answer force with force. A stealth slice with no teeth teaches the player to avoid contact and never to risk it, which is half a game.

The brief was: start with hand-to-hand, climb to knives and then guns, raise the difficulty as the stages rise, and expand the enemy roster so it does not repeat — with "real movements and vibrations, effects, sounds, all etc". That phrase is the actual specification. It means game feel is not a polish pass after the systems work; it is part of whether the systems work.

## 2. What was built

Four layers, each testable without a browser, plus the browser wiring on top.

| File | Owns | Tests |
|---|---|---|
| `src/arsenal.js` | Twelve weapons, damage/armour/range resolution, the loadout | 21 |
| `src/enemies.js` | Seven archetypes, ten waves, the threat curve, clip mapping | 10 |
| `src/feel.js` | Shake, haptics, hitstop, decals | 20 |
| `src/progression.js` | Tier curve, rewards, the run and its score | 16 |
| `src/weaponview.js` | Held meshes, per-model orientation, muzzle flash | via enemyview |
| `src/enemyview.js` | Skinned clones, animation state machine, corpses | 13 |
| `src/combat.js` | Trigger → hit → noise → body → feel → sound | 21 |
| `src/arena.js` + `src/combathud.js` | The wave loop and its interface | 13 |

221 tests pass in total, 114 of them on the combat work.

## 3. The arsenal, and why each rung is a different game

Twelve weapons. The design constraint is that **each step changes how a fight is won, not how much damage a hit does**. Damage-per-second is the least interesting axis available; reach, noise and whether it kills quietly are the ones a player actually plans around.

| Weapon | Mode | Reach | Noise | Rounds | The point |
|---|---|---:|---:|---:|---|
| Fists | melee | 1.3 m | 2 | ∞ | Free, silent, and slow enough to be a real risk |
| Utility knife | melee | 1.6 m | 3 | ∞ | Pierces half of armour — the quiet route that works on armoured bodies |
| Pistol | single | 12 m | 26 | 12 | Reach arrives; so does the noise |
| Silenced pistol | single | 11 m | **7** | 12 | Trades damage for discretion |
| Machine pistol | automatic | 9 m | 30 | 32 | Volume of fire strips armour |
| Shotgun | spread | 7 m | 38 | 6 | Ends a close fight instantly and tells the block |
| Rifle | scoped | 60 m | 55 | 5 | A whole street of reach, one shot at a time |
| Machine gun | automatic | 14 m | 44 | 75 | Sustained pressure |
| Burner | automatic | 6 m | 20 | 120 | Burns after the trigger stops |
| Launcher | heavy | 30 m | 70 | 1 | 6 m splash; deafens the district |
| Salvaged blaster | single | 16 m | 12 | 20 | Energy damage at low noise |
| Frag | thrown | 18 m | 60 | 1 | Answers a group, once |

**Design claim, tested rather than asserted:** against a body with 60% armour, a knife does 15 and a pistol does 10. The quiet weapon is also the correct weapon against armour. That is the whole reason a player would ever choose to be quiet when they own a rifle.

### 3.1 The armour hole, and the fix

The first version had a genuine design failure that only appeared when the numbers were simulated rather than admired. The brute carries 220 hp behind 60% armour, so a wave-6 machine pistol needed **37 rounds and carried 32**. The weapon the game had just handed the player could not finish the fight it was for.

Two options were rejected before the third was chosen:

- **Lower the brute's armour.** Cheap, but it deletes the reason the knife exists.
- **Raise the machine pistol's power.** Turns a volume weapon into a worse rifle and flattens the ladder.

The chosen fix is a mechanic the game was already implying: **sustained fire degrades armour.** Each hit removes 12% of what remains, floored at a quarter of the original. So the knife still ignores half on the first exchange (its identity survives), volume of fire strips a vest (the machine pistol's identity), and a single pistol round does not (the pistol's identity). The machine pistol now needs 21 of its 32 rounds and the shotgun one six-shell tube. This is in `armourAt()` in `src/arsenal.js` with four tests around it.

## 4. The roster: seven problems, not seven skins

Health scaling alone makes a game *slower*, not harder. Each archetype changes one thing the player must do.

| Archetype | Health | Armour | Speed | Sight | Attack | What it forces |
|---|---:|---:|---:|---:|---|---|
| Watcher | 60 | 10% | 0.95 | 16 m | none — calls | Don't stand in the open |
| Runner | 40 | 0 | 2.4 | 13 m | melee 14 | Don't reload in the open |
| Brute | 220 | **60%** | 0.85 | 12 m | melee 34 | Don't panic-fire; blades work |
| Flyer | 45 | 0 | 2.0 | 18 m | ranged 9, 3.2 m up | Look up; ground cover is useless |
| Pack | 18 | 0 | 2.8 | 11 m | melee 6, ×5 bodies | Don't fight them one at a time |
| Heavy | 160 | 35% | 0.7 | 15 m | explosive 45, 4 m splash | Don't stand still |
| Sniper | 55 | 15% | 0.9 | **45 m** | ranged 55 | Don't walk an open lane |

Two of these are about *not* being unfair, which is different from being easy. The sniper **glints for 1.1 s** before firing: without a warning a 45 m one-shot kill is an ambush from off-screen, and unfair is not the same as difficult. The watcher cannot attack at all, so being seen has a cost other than damage — it brings the rest of the street.

All seven are rigged, animated models vendored from CC0 packs (Quaternius, Kenney), 17 files, 7.9 MB, with the clip vocabulary to act the parts: `Attack`, `Shoot`, `HitRecieve`, `Death`, `Idle`, `Run`, `Gallop`, `Flying`.

### 4.1 The wave table and the threat curve

Ten authored waves, then endless laps with a rising scale.

| Wave | Name | Bodies | Health | Threat | Reward |
|---:|---|---:|---:|---:|---|
| 1 | The street notices | 5 | 90 | 3.0 | Fists |
| 2 | Watchers | 6 | 150 | 4.1 | Knife |
| 3 | Runners | 4 | 180 | 4.7 | Pistol |
| 4 | Eyes and teeth | 9 | 290 | 7.6 | Pistol |
| 5 | From above | 12 | 270 | 9.6 | Silenced pistol |
| 6 | The brute | 7 | 495 | 12.4 | Machine pistol |
| 7 | Crossfire | 6 | 575 | 13.3 | Shotgun |
| 8 | The block | 8 | 855 | 17.9 | Rifle |
| 9 | Air and ground | 21 | 830 | 23.2 | Machine gun |
| 10 | Everything at once | 18 | 830 | 23.6 | Burner |

**Threat is derived, not authored.** Health alone would have produced a table that grows in hit points while shrinking in pressure — which is a game that gets easier as it goes. The first draft dipped at waves 3, 4, 6, 7, 8 and 9. Each dip was fixed by changing composition rather than by inflating numbers, and the curve is now monotonic by test.

The tier curve deliberately **lags** the wave: the weapon answers the problem you just met rather than pre-empting the next one. A player who never fights stays unarmed and only ever meets watchers.

A real bug worth recording: `rewardForWave` originally sorted by tier, so the frag — a side-arm unlocked early at tier 3 — outranked everything and waves 5 through 10 all rewarded a grenade. Rewards now walk a separate ladder, with a regression test named after the bug.

## 5. Game feel: four channels, because one is not enough

"Screen shake on shot" is the first thing everyone builds and it is not game feel. Four independent channels, all driven from one table so the eyes and the hands agree:

1. **Shake** — trauma-based, where the *offset* is trauma squared. That exponent is what makes a launcher read as violent and a pistol as barely there. Roll is capped at 3° so it reads as a flinch and not motion sickness.
2. **Haptics** — Gamepad `dual-rumble` when a pad is present, `navigator.vibrate` otherwise, both scaled by the same table. A distant shot does not buzz the player's hands: the scale drops to zero past 30 m.
3. **Hitstop** — the simulation freezes for 40–80 ms *on a connect only*, taking the longest stacked hit rather than the sum so it can never lock the game. This is where impact comes from; damage numbers are not.
4. **Decals** — a ring-buffered budget of 64. Unbounded blood sprites kill a phone's frame rate long before the enemy does.

Every weapon has a profile: the launcher is the most violent thing in the game (trauma 1.0, rumble 1.0), the silenced pistol the softest (0.10, 0.20), and the shotgun kicks more than a pistol — all asserted by test rather than left to taste.

**Audio** is synthesised, not sampled, following the existing `CityAudio` mixer: fourteen new voices — pistol crack, silencer, shotgun boom with a tail, rifle whip, launcher thump, energy zap, blade, dry fire, reload click, flesh and armour impacts — routed from combat events and attenuated by distance. No audio files, no loading cost, and a weapon sounds different from every other weapon by construction.

## 6. Findings from measuring instead of guessing

Four defects were found by simulating rather than by reading the code. They are recorded because the pattern matters: each was invisible on the page and obvious in the numbers.

| Finding | How it surfaced | Fix |
|---|---|---|
| Wave-6 weapon could not kill a wave-6 brute (37 rounds vs 32) | Cumulative-shots simulation against real stat lines | Armour degrades under sustained fire |
| The aim cone was 2π — the player could shoot behind themselves | A test asserting you cannot shoot a body at your back | 120° arc, 60° aimed |
| Point-blank ignored: could not kick a spider standing beside you | A test at 0.65 m off-axis | Cone widens to a half-circle inside 1.9 m |
| Five bodies killed an idle player in 11 s | Headless wave stepped to death | Incoming damage scaled to 0.42 of outbound |

The last is a scope decision worth stating: outgoing numbers are tuned so enemies die fast enough to be *readable*; the same numbers aimed at the player are brutal. One constant keeps both honest rather than two tables drifting apart.

## 7. On the rendering, honestly

The models are the real thing, and the pipeline around them is tested against the real files in Node:

- **Skinned clones** use three.js `SkeletonUtils.clone`. A plain `Object3D.clone()` shares one Skeleton instance, so every enemy in the district would snap to the same pose and the same frame. The vendored r170 utility is kept whole with only its import path changed.
- **Orientation is measured, not authored.** Kenney's pack is inconsistent: the launcher stands on its long axis, the pistol lies along Z. Taking the naive longest bounding-box axis laid the *uzi on its side*, because the uzi's tallest dimension is its magazine. Z is now the default and Y must win by a 1.25× margin, which rescues the uzi and the grenade and correctly lays down the launcher and knife.
- **Height is normalised from measurement.** The source packs are not in metres — Quaternius' `.transformed` variants are exported 100×. Every archetype now lands within 2 cm of its declared height.
- **No texture atlas in the weapon pack**, so weapons take solid materials by damage class. That is also a readability win: the gun looks like the threat it carries.
- **Animation clips are mapped by suffix with synonyms**, because the packs name the same idea four ways (`Death`/`Dead`, `Run`/`Gallop`, `Frog_Attack`/`Attack`). A body with no death clip topples instead of stopping, because a body that simply stops reads as a bug.

**The honest gap:** this machine has no browser and no GPU. The browser path is verified by resolving the whole module graph (31 modules, every named import checked against its target) and by running the boot sequence against a DOM shim up to the point where three.js requires a real GL context. The simulation is proven headless; the *rendering* is not, and needs one session on a real device before anyone calls it finished.

## 8. What to do next, in order

Ordered by how much each raises the game per unit of risk. The first two are the difference between "a combat prototype" and "a combat game".

### 8.1 Highest value

1. **Real device pass.** Load the page on a phone and a desktop. This is now the gating item: nothing above can be called done until someone has played it once. Specifically check the weapon mount on the hand bone, whether shake reads as impact or as nausea on a small screen, and whether the wave-1 fight teaches the controls before it kills.
2. **Enemy navigation.** Bodies currently close distance in a straight line. They should use the world's existing collision and the lane geometry, flank rather than queue, and use cover. The `agents` system in `src/world.js` already patrols around buildings; the wave should borrow its pathing rather than grow a second one.
3. **The takedown.** The game is a stealth game with a knife in it and no stealth kill. A crouched, unseen approach from behind should be a silent, automatic kill — the single highest-value verb in a game whose fiction is about leverage. It also gives the knife a purpose beyond a weak gun.

### 8.2 Raising the ceiling

4. **Authored boss per act.** `Stan`, `Mike` and `George` are 6.5 m rigged bosses with 18–20 clips each already vendored and unused. One boss at wave 10 and one at wave 20 would give the endless ladder a shape and a memory.
5. **Weapon upgrade path, not just a ladder.** Each weapon should have one mod that changes its role: a scope on the pistol (range), a drum on the machine pistol (magazine), a choke on the shotgun (spread). Three mods is enough. This is where *progression* becomes *expression*.
6. **Environmental kills.** `assets/kenney` already carries crates, barrels and street furniture, and the city already has traffic. A body pushed into a car, a lamp dropped on a brute, a launcher round into a fuel drum: the fiction is about using the street, so the street should be a weapon.
7. **Downed and revived, not dead.** On zero health, go down and bleed out over eight seconds; a wave clear revives. It keeps a bad wave from wiping twenty minutes of run, and it is more tense than a restart.

### 8.3 Depth, later

8. **Per-archetype death behaviour.** A brute should stagger and kneel; a flyer should fall and be grounded and finishable; a pack should scatter. Reads as authored rather than as one animation.
9. **Faction escalation.** The collectors are a faction; the roster should become *their* escalation — watchers first, then enforcers, then the heavy response — so the enemy mix tells a story about who is chasing you.
10. **Readable damage direction.** A directional indicator on hit. Currently the player is told they were hurt but not from where, which is unfair with a sniper in the mix.
11. **A range to practise on.** The blaster pack's targets and fragments make a shooting range trivial to build and give the progression a place to be learned without dying.
12. **Accessibility, not as a checkbox.** Shake intensity, haptic intensity and hitstop length as separate sliders, plus a no-flash option. All three are already separate values in `src/feel.js`, so exposing them is a settings panel, not a refactor.

## 9. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Untested on hardware | Everything about feel is a claim until it runs | Device pass before any of 8.2 |
| Enemies walk through each other | Straight-line approach makes clumps | Navigation in 8.1.2; body separation in the interim |
| Combat dilutes the stealth | Shots pull collectors, but a player may simply shoot everything | Noise is wired into the existing hunt model, and the armour rule keeps quiet weapons relevant; watch this in playtest |
| Difficulty curve is a guess | The threat score is a model of difficulty, not a measurement | Playtest per wave, then retune `WAVES` rather than the scoring model |
| Performance on low-end phones | 7 rigged bodies at 5–10 k tris each, plus shadows | Skinned-vertex budget already asserted (41,633 in the existing smoke test); add a per-wave cap if a device measurement demands it |

## 10. Controls

| Key | Action |
|---|---|
| `W A S D` / arrows | Move |
| `Shift` | Run |
| `Ctrl` / `C` | Crouch |
| `E` / `Space` | Interact |
| `F` | Fire (hold for automatic) |
| `R` | Reload, or get up after death |
| `Q` | Cycle weapon |
| `G` | Throw a frag |
| `1`–`6` | Select a weapon; `1`–`3` take a between-wave offer |
| Right `Shift` | Aim (narrows the cone) |
| Gamepad | Triggers fire, right stick looks, `A` interacts |
