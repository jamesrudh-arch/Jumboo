# LEVERAGE game identity — 3D wordmark study 01

**Status: first component of stage 2, awaiting owner review. Not an approved identity or in-game intro.** Built following the owner's instruction to polish the studio stage, commit and proceed. This is genuine 3D, not an image placed on a plane: the word, subtitle and tagline are extruded meshes, with a separate copper pin, metallic materials, lighting and a real camera. The Blender scene and exported model are included.

- `leverage_title_3d.blend`: editable Blender 4.2 scene.
- `leverage_title_3d.glb`: separate export, not integrated into the game.
- `docs/previews/leverage_logo_3d_front.png`, `leverage_logo_3d_three_quarter.png`, `leverage_logo_3d_side.png`, `leverage_logo_3d_rear.png`: Blender Cycles renders; rear lettering appears reversed because it is viewed from behind.
- `tools/build_leverage_logo_3d.py`: scene and geometry creation, requiring bpy 4.2 and suitable system libraries.

The wordmark currently uses Zilla Slab Bold as licensed base type with 3D treatment, not original bespoke lettering. The copper detail is exploratory; do not claim it is a finished custom logo. `ZillaSlab-Bold.ttf` and its SIL OFL licence are from https://github.com/google/fonts/tree/6ebe737e44fd64ee736bbc6feed6136a6dbfd222/ofl/zillaslab. Tagline uses the existing licensed Inter Variable font. The earlier selected image concept remains at `docs/previews/leverage_identity_concept.png` for comparison; this model is an interpretation, not a trace of it.

A separate Godot 4.7.2 headless import recognized four mesh instances and approximately 81,216 triangles. That verifies structural loading only, not rendered appearance or iPhone performance; mesh optimization remains open. The Blender glTF exporter logged unavailable optional Draco compression; the uncompressed GLB imported in headless Godot. A final custom wordmark, app icon, complete game colour/identity system, motion, sound and real-time device validation remain to be developed after review. Do not silently treat this initial component as approval of stage 2.

## Motion study and cleanup

`docs/previews/leverage_logo_3d_motion.gif` is a silent four-second camera/light study rendered as 32 frames from the actual Blender 3D scene. It is a low-sample review preview, not a final title reveal or an in-game recording; `tools/render_leverage_logo_3d_motion.py` reproduces it. The owner has not approved this game identity.

A separate custom-lettering attempt was inspected and rejected internally because its R/A openings did not render correctly; its broken outputs were removed rather than presented as finished. The working licensed-base wordmark remains available, and bespoke lettering is still an open task. The owner asked to keep the repository clean: stale local WIP ZIP exports and generated import/texture duplicates were removed, with the most recently delivered WIP archive retained locally and ignored by Git. The original tracked GLBs contain their texture images; a fresh Godot 4.7.2 headless import of tracked game files completed without reported errors. This does not verify device rendering.
