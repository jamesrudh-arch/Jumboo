# LEVERAGE: Cinder City — "Last Call" loading-lane study (browser build)

**Status: unapproved gameplay study, not a shipping build.** Per `AGENTS.md` this
is a gameplay study that requires owner review. It is **not** part of the
approved opening (`game/main.tscn`) and nothing here has been inserted into it.
It adds no canon: the lane, props, collectors and objective flow are study
geometry and study rules built to exercise the approved story beat, not
established story facts. No part of this build is "finished", "production
ready" or rated.

What it is: a playable 3D third-person stealth slice of the M01 "Last Call"
loading lane — reach Sade, take the lane, stay off the collectors' sightlines.

## Run it

```bash
cd game_web
npm run serve          # http://localhost:8080
```

Requires a browser with WebGL2. `npm test` runs the 42 headless checks. A real
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

## What the slice contains

- **Simulation** (`src/world.js`, `src/collision.js`, `src/geom.js`): stamina,
  noise propagation, hearing, cone-of-sight detection, suspicion, hunt, catch,
  checkpoint restart, timed objective, scoring. 25 of the checks cover this.
- **Level** (`src/level.js`, `src/scene.js`): a night loading lane with shop
  fronts, cover, a walkway, a dock and a market mouth; 7 practicals, one
  shadow-casting moon, procedural canvas textures. All study geometry.
- **Player** (`src/anim.js`, `src/scene.js`): the approved Marcus asset with
  walk/run cross-fade, stride time-scaling and a composed crouch pose.
- **HUD** (`src/hud.js`): objective, compass, stamina, noise, stance, suspicion,
  prompt, timer, banners. Copy stays inside M01 / EV-01..EV-06.
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
- **Procedural art**: textures are drawn at runtime in `src/scene.js`; no
  third-party images.

## Offline diagnostics

The shipping renderer cannot run in this environment (no GPU, no headless
browser), so the visuals were checked on the CPU:

```bash
node tools/render.mjs ../docs/previews/game 800 450   # 8 framed shots
node tools/look.mjs ../docs/previews/game/diag light  # A-G contact sheet
```

`tools/software-raster.mjs` is a small CPU rasteriser (perspective-correct
attributes, screen-linear NDC depth, real CPU shadow map, per-pixel fog,
ACES/sRGB tonemap) used only for these checks. It is a diagnostic, not a
renderer. Its projection is verified against the standard frustum formula in
`test/character.test.mjs`.

Fixed while building the slice, each with a regression test where possible:

- projection aliasing that halved the character's screen size;
- perspective-correct interpolation of *nonlinear* NDC depth, which let the
  140×170 m floor win the depth test and hide Marcus;
- a canvas shim sized before `canvas.width` was set, turning textures white;
- `ctx.drawImage` missing, which made every tinted material black;
- materials carrying both a tinted map *and* the same hex in `color`, squaring
  albedo to near-black;
- `TUNING.resetDelay` defined but never used, so being caught stranded the run.

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
  src/scene.js      level view, Marcus loading, crouch pose
  test/             world (25), character (7), integration (7), raster (3)
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
