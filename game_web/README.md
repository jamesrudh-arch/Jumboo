# LEVERAGE: Cinder City — "Last Call" loading-lane study (browser build)

**Status: unapproved gameplay study, not a shipping build.** Per `AGENTS.md` this
is a gameplay study that requires owner review. It is **not** part of the
approved opening (`game/main.tscn`) and nothing here has been inserted into it.
It adds no canon: the lane, props, collectors and objective flow are study
geometry and study rules built to exercise the approved story beat, not
established story facts. No part of this build is "finished", "production
ready" or rated.

What it is: a playable **3D third-person** stealth slice of the M01 "Last Call"
loading lane, standing in the middle of a walkable night district — Cinder City's
Hearthline. Reach Sade, take the lane, stay off the collectors' sightlines,
and survive the street: traffic that brakes, honks and knocks you down, crowds
that scatter, a canal and a harbour that will drown you, and a weather system
that changes how far you can see.

## Run it

```bash
cd game_web
npm run serve          # http://localhost:8080
```

Requires a browser with WebGL2. `npm test` runs the 44 headless checks. A real
browser check is available separately:

```bash
npm i -D playwright && npx playwright install chromium
npm run smoke          # drives the page, presses keys, checks the frame
```

`npm run smoke` skips with a message when Playwright is absent.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | Move |
| Mouse drag (or click to lock) | Look |
| Shift | Run — fast, loud |
| Ctrl / C | Crouch — slow, quiet, harder to see |
| E / Space | Talk, interact |
| Esc | Pause |
| Gamepad | Either stick, triggers, A |
| Mouse wheel | Camera distance |
| Touch (phone) | Left stick moves, right side looks; on-screen Run / Crouch / Act buttons appear on coarse pointers |

## What the slice contains

- **Simulation** (`src/world.js`, `src/collision.js`, `src/geom.js`): stamina,
  noise propagation, hearing, cone-of-sight detection, suspicion, hunt, catch,
  checkpoint restart, timed objective, scoring. Stealth has to be survivable:
  a crouch is silent, a walk carries ~5 m, a sprint ~9 m; a collector runs at
  1.55× their patrol walk while they can see you and jogs at 1.15× to where they
  last saw you, and gives up a hunt after 7.5 s without a sighting. Kerbs and
  quay lips are *steps*, not walls, so the lane mouth is open. 32 of the checks
  cover this, including a flood-fill that proves every objective is walkable
  from the spawn. `tools/bot.mjs` is a headless playthrough bot used to find the
  above; it reports win rate, time, sightings and where a run stalls. Run it
  with `--ghosts` to remove the collectors and test navigation on its own, and
  `--no-errands` for the approved beat alone.
- **Level** (`src/level.js`, `src/scene.js`): a night loading lane with shop
  fronts, cover, a walkway, a dock and a market mouth; 7 practicals, one
  shadow-casting moon, procedural canvas textures. All study geometry.
- **Player** (`src/anim.js`, `src/scene.js`): the approved Marcus asset with
  walk/run cross-fade, stride time-scaling and a composed crouch pose.
- **District** (`src/city.js`, `src/cityview.js`): a walkable 300 × 250 m night
  district around the lane — 104 buildings at the desktop tier (58 on a phone,
  thinned evenly so no district disappears), 4 landmark towers up to 79 m,
  100 trees, 84 street lamps, ~20 parked cars, container stacks, cranes and the
  harbour. Roads, pavements, kerbs, road paint, a canal with three bridges, a
  harbour basin and a park pond are all generated from the same plain data the
  tests use. 27 of the checks cover it, including that all three bridges are
  dry to walk across and the open canal is not.
- **Audio** (`src/audio.js`): a synthesised mixer, no audio assets. Rain, wind and
  city hum beds follow the weather blend; tyres are panned by distance and
  speed; footsteps follow the animation phase and change with stance and wetness;
  thunder, honks, splashes, landings and errand pings are event-driven. Fifteen
  voices, with the drop count kept. Starts only on the Begin click, `M` mutes.
- **Street life** (`src/traffic.js`): 4–14 vehicles on closed routes that keep to
  the road network, brake for the player, each other and pedestrians (brake
  lights flare as they do), honk when stuck, back out of a dead end or a jam
  that will not clear instead of parking in the junction, and knock the player
  down on contact; 8–16 pedestrians who keep to the
  pavement, flee fast cars, and can be scattered by the chaos director.
- **Wet streets** (`src/cityview.js` `setWetness`): the rain drives the ground, not
  just the sky. Asphalt darkens and glosses, pavement follows more slowly,
  ~120 puddles (24 on a phone) fade in, and every street lamp smears a thin
  additive reflection across the road under it. The look is authored rather than
  physically reflected — there is no environment map at night, and a phone at 1×
  does not sell a specular highlight — but it is what makes a downpour read as
  wet instead of as a clear scene with lines drawn on it.
- **Weather** (`src/weather.js`): five presets (drizzle, downpour, squall,
  breaking cloud, harbour fog) that blend over ~18 s and change every 55–125 s.
  Sky, fog distance, rain density, wind slant, ambient fill and exposure all come
  from one blend; wetness builds during rain and drains slowly afterwards and
  feeds the wet-street pass above. Lightning is disabled on the phone tier and
  under `prefers-reduced-motion`.
- **Chaos** (`src/world.js` `updateChaos`): every 11–22 s the district does
  something that is visible in the world, not only in a log:
  - **jam** — three cars in a row stop dead for 6–11 s (and honk);
  - **sweep** — one car ignores the player and runs the street at 125 % speed
    for 4 s, which is when it can knock you down;
  - **power cut** — a 26 m block of district lamps goes dark for 9–15 s, which
    darkens the street around you;
  - **detour** — a collector breaks its patrol;
  - **panic** — a pedestrian bolts and the crowd nearby follows.
  Every event is logged with position, kind and count, and the HUD names the
  most recent one.
- **Street errands** (`src/world.js` `updateErrands`): three optional objectives
  placed in the district — kill a block's power box (120 pts, loud), recover a
  dropped bag (90 pts, quiet), talk to a dockhand (150 pts). Each is a pulsing
  marker with a hold-to-complete prompt, they pay into the score, and the
  approved beat still wins the run without them.
- **Controls** (`src/input.js`, `src/main.js`): keyboard and mouse (pointer-lock
  or drag-to-look, wheel to zoom, `M` to mute), a four-button touch scheme plus
  a half-screen stick and look pad with its own pause button, and a standard
  gamepad — either stick, face buttons, triggers and Start-to-pause. The gamepad
  mapping is a pure function with its own tests, so it is not just written but
  exercised.
- **HUD** (`src/hud.js`): objective, compass, stamina, noise, stance, suspicion,
  prompt, timer, banners, the weather and wet-street readout, the named chaos
  event, and the errand progress/tally. Copy stays inside M01 / EV-01..EV-06.
- **Banners**: briefing states the beat, "Sade talked." opens the lane,
  "Spotted." / "Heard something." / "Taken." / "Lane reached." close it out.

## Known limits — read before judging the slice

1. **Marcus has only `walk` and `run` clips.** The idle is the walk clip at
   0.18 speed (a slow sway), not an authored idle. Crouch is a pose composed on
   the approved rig (thigh −50°, knee +105°, foot −40°, spine −8°, neck +4°,
   hips dropped 0.315 m), verified to take the head from 1.778 m to 1.462 m with
   the feet at 0.039 m — but there is **no crouch clip**, so it does not have
   authored weight shifts. Turn lean is a procedural body roll. The asset has
   no blend shape, so there is no facial performance.
2. **The asset's inverse bind matrices are in centimetres while the vertices are
   in metres.** Three's shader handles this through the mesh's model matrix, so
   GPU skinning is correct; CPU skinning must apply `matrixWorld` afterwards.
   `SkinnedMesh#applyBoneTransform()` deliberately omits that step. This is a
   real footgun, noted in `src/scene.js` and covered by `test/character.test.mjs`.
3. **Collectors and Sade are placeholder figures** (`tools/characters.mjs`
   primitives). They are not approved art and must be replaced before any
   review of the lane's readability as a scene.
4. **No audio.** Hearing is simulated (noise values feed detection) but nothing
   is played.
5. **Mobile is untested on device.** Touch sticks and a gamepad path exist;
   performance on real phones for a 167k-vertex skinned mesh plus 2048² shadows
   is unverified.
6. **No save, no settings, no accessibility pass** beyond large-ish HUD type and
   a pause screen.
7. **Balance is untuned by a human.** The numbers are tuned by simulation tests
   (a full run can be completed; a catch is recoverable), not by play feel.
8. **The district is study geometry, not canon.** It is a labelled study
   environment: no story fact, route or character lives there. The block names
   are plain data ids, not place names in the narrative.
9. **Water is a hole, not a swimming volume.** Wading in costs you the run and
   spits you back to the checkpoint; there is no swim animation or state.
10. **The map is 2.5D.** Buildings are solid volumes you cannot enter, and there
    is no interior beyond the approved lane. Roofs are viewable from outside
    only. Cars and pedestrians have no ragdoll or per-limb animation.

## Assets and provenance

- **Marcus**: `assets/marcus.glb`, sha256
  `6a8078dcde0e7cef15bac18786a5b525eacfc2d948a8d3cd4a6d2a83a6fb6fda` — the
  repo's **normalized test copy** of the approved character
  (`brand/characters/marcus/marcus_normalized_test.glb`), copied byte for byte.
  Its skin weights are normalized relative to the approved source
  (`c41f2bfc…2c4f`); appearance is unchanged. Source rights, provenance and
  validator results are in `brand/characters/marcus/README.md` and
  `brand/research/casual_man/README.md`. Because this is the *test* copy, the
  slice inherits the open items recorded there (deformation, device performance).
- **three.js r170**: `vendor/three/`, MIT, licence alongside. Copied unmodified
  from the npm tarball; no patches.
- **jpeg-js 0.4.4**: `tools/jpeg-js/`, Apache-2.0, used only by the offline
  diagnostic tools.
- **Fonts**: Bebas Neue and Inter, OFL, used from `game/assets/fonts/` via
  `serve.js`. No copy is vendored here.
- **Procedural art**: the district's buildings, roads, bridge, debris, landmarks
  and the character rig's staging are generated by this project. Textures for
  them are drawn at runtime in `src/scene.js`.
- **CC0 asset kits** — three packs, all public domain, vendored so the game has
  no third-party runtime dependency. Each has its licence file and a CREDITS.md
  recording what was taken, what it measured, and what was rejected:
  - **KayKit City Builder Bits 1.0** (`assets/kit/`, 26 models, 1.1 MB):
    cars, streetlights, traffic lights, hydrants, bins, benches, planters.
    All 26 validate against glTF 2.0 with 0 errors and 0 warnings
    (`tools/validate-kit.mjs`).
  - **Low Poly City Kit** by kkyqr (`assets/city/`, 20 models): trees and park
    landscaping, palette-authored rather than textured, so they instance cheaply.
  - **Kenney 3D library** (`assets/kenney/`, 700 models, 19.4 MB): nine packs —
    commercial, suburban, roads, cars, watercraft, buildings, modular buildings,
    retro urban and furniture. Measured at 268,818 triangles total across
    1,003 surveyed models, all textured, one colormap atlas per pack.

  Not every pack earned its place. Kenney's building bodies and its street
  dressing were both implemented, rendered and rejected: they lose to the
  generated district. The reasons and the evidence are in
  `assets/kenney/CREDITS.md` and the commit history.
- **Character optimisation**: `assets/marcus.glb` was 167,662 vertices and
  244,257 triangles for one character — 500,815 triangles per frame with the
  district around him. Simplified with gltf-transform and meshoptimizer to 41,633
  vertices and 38,800 triangles (3.7 MB from 13 MB) with both animation clips
  kept. Frame cost is now 90,057 triangles, verified against the offline
  renderer's own count and checked visually at the crouch close-up.

## Offline diagnostics

The shipping renderer cannot run in this environment (no GPU, no headless
browser), so the visuals were checked on the CPU:

```bash
node tools/render.mjs ../docs/previews/game 800 450      # 8 framed lane shots
node tools/city-shots.mjs ../docs/previews/city 800 450 # 11 district survey shots
node tools/look.mjs ../docs/previews/game/diag light     # A-G contact sheet
```

`tools/software-raster.mjs` is a small CPU rasteriser (perspective-correct
attributes, screen-linear NDC depth, real CPU shadow map, per-pixel fog,
ACES/sRGB tonemap) used only for these checks. It is a diagnostic, not a
renderer. Its projection is verified against the standard frustum formula in
`test/character.test.mjs`.

`tools/city-shots.mjs` refuses to record a camera that is inside a building, in
water or underground, and prints `CAMERA ...` next to the shot instead — two
rounds of district previews were blank before that check existed.

Fixed while building the slice, each with a regression test where possible:

- projection aliasing that halved the character's screen size;
- perspective-correct interpolation of *nonlinear* NDC depth, which let the
  140×170 m floor win the depth test and hide Marcus;
- a canvas shim sized before `canvas.width` was set, turning textures white;
- `ctx.drawImage` missing, which made every tinted material black;
- materials carrying both a tinted map *and* the same hex in `color`, squaring
  albedo to near-black;
- `TUNING.resetDelay` defined but never used, so being caught stranded the run;
- `boxList()` cutting wall openings along the wrong axis, which silently deleted
  every gapped wall from collision (no error, no collider);
- a hard building cap applied block-by-block, which exhausted itself in the
  north and left the whole southern district empty on the phone tier;
- the collision solver treating a 22 cm kerb as a wall, which sealed the lane
  mouth: the player could not walk out of the lane through its own entrance;
- every footstep beating the collectors' 7 m hearing radius, so walking near a
  guard pulled them onto you no matter what cover you used;
- pursuit at 2.05× patrol walk (2.15 m/s) against a 3.4 m/s sprint, with no
  give-up timer while you were within 10 m — once spotted, being caught was the
  only possible outcome;
- pedestrians that "fled" by advancing a walk animation but never moving;
- pedestrians pulling cars to a full stop, jamming every route permanently;
- vehicles reporting the heading of the *outbound* leg on the return leg, so
  half of every loop drove sideways;
- chaos that only existed in an event log: a jam cleared next tick, and a power
  cut switched off one lane lamp the player could not see;
- water with no gravity and no wet test above its surface, so the canal could
  be walked across;
- the market-end wall sealing the lane from the district it was built inside.

## Layout

```
game_web/
  index.html        page shell, import map, study labelling
  serve.js          static server (+ shared brand fonts)
  src/main.js       input, fixed-step loop, camera, banners
  src/anim.js       walk/run cross-fade, stride timing, crouch, lean
  src/hud.js        DOM HUD
  src/world.js      simulation (approved-tuned numbers)
  src/level.js      level definition + collision build
  src/city.js       district data + generator (roads, water, blocks, props)
  src/cityview.js   district renderer (merged/instanced, water, rain)
  src/traffic.js    vehicles + pedestrian crowds
  src/weather.js    weather presets, mood blend, wetness
  src/scene.js      level view, Marcus loading, crouch pose
  test/             world (25), city (26), character (7), integration (9), raster (3)
  tools/            CPU diagnostics + browser smoke test
  assets/marcus.glb approved character (provenance above)
```

## Next steps (owner review)

1. Decide whether the lane direction, pacing and the Sade beat are worth
   carrying forward; if not, the study stops here.
2. Approve or replace collector and Sade art — the placeholders cannot judge
   the scene.
3. Commission idle, crouch and turn clips for Marcus before any animation
   review; the composed crouch is a stopgap.
4. Then, and only then, discuss inserting anything into the approved opening.
