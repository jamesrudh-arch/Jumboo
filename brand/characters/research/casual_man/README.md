# Casual Man — isolated source evaluation

**Approved as Marcus by the owner.** The owner explicitly chose this complete rigged character over the earlier appearance and authorized adapting Marcus to its different face, hair, clothing and style. The source GLB is now `brand/characters/marcus/marcus_approved_source.glb`. It has not been integrated into the game or intro; motion, engine import and device quality remain under review.

## Source and rights

- Grab3D [Casual Man](https://grab3d.com/models/characters/man/) lists the model and its rigged version as CC0, with walk/run, and describes it as stylized. [Grab3D's licence](https://grab3d.com/license/) describes CC0. Grab3D describes high-detail models as AI/Meshy-assisted and subsequently cleaned up; do not present this as a hand-sculpted original.
- Actual investigated GLB obtained from [bnovc/san-francisco](https://github.com/bnovc/san-francisco/blob/33c8d6b6917914e2a52b1c8c88bce5fe4e60ffb8/public/assets/models/people/player_casual_man.glb) at commit `33c8d6b6917914e2a52b1c8c88bce5fe4e60ffb8`. Its [asset ledger](https://github.com/bnovc/san-francisco/blob/33c8d6b6917914e2a52b1c8c88bce5fe4e60ffb8/docs/SOURCES_AND_ASSETS.md) identifies it as Grab3D Casual Man, CC0, AI-assisted and states the same hash. We could not download Grab3D directly from this restricted environment to independently compare bytes; mirror provenance is not the same as a primary-source hash comparison.
- SHA-256: `c41f2bfc62b03a8dd8fbae37d201d4c73bba3806678984c6895f59a7cbf22c4f`; 13,051,272 bytes.

## What was actually checked

`tools/audit_character_candidate.py` inspects the binary container: one mesh, one skin, 54 joint entries, 244,257 indexed triangles, and `walk` and `run` animation entries. Source page's 498,580 triangle count refers to the full static asset and must not be confused with this rigged file. The older source FAQ's 24-bone description is not the count found in this GLB. 54 joint entries do not establish usable facial controls. Visual renders of its rest pose, rear and source walk are in `docs/previews/character_research/`; the walk render uses the source `walk` action in Blender. This showed an intact clothed character and moving limbs in the sampled views; foot contact, clipping, all poses and production quality have not been certified. These are the source model’s original animation clips; their game use is not yet validated.

The 244k-triangle count is high enough to make optimization and device profiling important, but there is no measured iPhone performance or defined automatic pass/fail budget. Godot/Xogot import, visual materials, retargeting and phone compatibility have not been tested. Blender renders used CPU Cycles and temporary no-op display-library stubs in headless mode; no GPU or GUI test. `tools/render_character_candidate_walk.py` rebuilds the candidate walk preview in Blender bpy 4.2 with Pillow.

The source was subsequently checked with Khronos glTF Validator: 4,152 weight-normalization errors and two warnings. A separate weight-normalized test copy has zero errors and the same two warnings; see `brand/characters/marcus/README.md` for methods, checks and limitations.
