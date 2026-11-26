# D’YOUNGS GAMES — studio identity, review 01

**Status: presented for owner review; not approved or integrated.** This is the first stage only. The owner previously selected a generated D/Y direction; the new mark is an independently drawn editable vector interpretation, not a vector trace. Its D and Y are separate paths. The studio wordmark in the presentation uses Inter Variable with expanded tracking; it is a type treatment, not bespoke letter outlines. Font and SIL OFL licence are in `game/assets/fonts/`.

## Review assets

- `dy_symbol.svg`: two-colour mark with transparent negative space; vector master.
- `dy_symbol_light.svg`, `dy_symbol_dark.svg`: single-colour variants.
- `docs/previews/dyoungs_studio_logo_presentation.png`: primary studio lockup with simulated metallic depth.
- `docs/previews/studio_mark_vector_study.png`: primary, monochrome and small-size tests.
- `docs/previews/dyoungs_studio_ident_concept.gif`: three-second, silent animated light/reveal concept (loops for review). It is a 2D composited effect, **not** a 3D rendered or in-game intro.
- `docs/previews/studio_identity_concept.png`: prior generated image selected by the owner; preserved for comparison.

## Studio palette

| Use | Hex | RGB |
|---|---|---|
| Deep ink ground | #080C0F | 8, 12, 15 |
| Steel vector | #67767A | 103, 118, 122 |
| Warm gold vector | #D6B989 | 214, 185, 137 |
| Light monochrome | #F0EEE6 | 240, 238, 230 |
| Dark monochrome | #20282A | 32, 40, 42 |

`tools/render_studio_mark.py` and `tools/render_studio_ident.py` reproduce the visuals with Pillow and resvg-py; the latter uses staged silhouettes and light gradients, not actual 3D geometry. Trademark/distinctiveness checks, final wordmark refinement, sound design, actual 3D modelling, in-engine motion and device review are not completed. These must not be represented as done or silently substituted for the owner's approval.

## 3D revision — owner review 02

The owner rejected the previous 2D/faux-depth presentation and requested 3D. This revision models the D frame, Y and lettering as separate **volumetric Blender meshes**, with bevels, metallic materials, real lights, a stage and a moving camera. It is not a flat image or embossed filter.

- `dyoungs_studio_ident.blend`: editable Blender 4.2 scene.
- `dyoungs_studio_mark_3d.glb`: exported 3D mesh and material asset, not integrated into the game.
- `docs/previews/dyoungs_3d_front.png`, `dyoungs_3d_three_quarter.png`, `dyoungs_3d_side.png`, `dyoungs_3d_rear.png`: actual Blender Cycles renders; the reversed wordmark on the rear view is the back of the physical lettering.
- `docs/previews/dyoungs_studio_3d_motion.gif`: silent four-second preview from 32 actual Blender-rendered frames with moving camera and light; low-sample preview, not a final audio-mixed intro.
- `tools/build_studio_ident_3d.py` and `tools/render_studio_ident_3d_motion.py`: procedural scene and render sources. They require Blender's bpy 4.2 environment, Pillow for the GIF, and compatible system libraries. Font licence is included under `game/assets/fonts/`.

A separate Godot 4.7.2 headless project imported the GLB and found three mesh instances and approximately 56,708 triangles. This proves structural import only, not actual Godot rendering or iPhone performance; the mesh budget must be profiled and may need careful optimization. The original bpy process wrote the model and four renders but segfaulted on Python shutdown; Blender logged unavailable optional Draco compression. The separate 3D-motion render exited successfully. These artifacts are review WIP, not final production approval. Still required: owner review/refinement, studio sound identity, a final 3D intro, real-time appearance and device validation. No game integration or stage-two work has been performed for this revision.
