# Intro: 3D shot study — not approved

`cinematic_shot_study.blend` is a packed Blender 4.2 scene, and `docs/previews/intro/cinematic_shot_study.png` is its actual CPU Cycles render. This is a **single proposed framing and lighting study**, not the 30-second cinematic, an approved warehouse design, gameplay or a phone screenshot. Marcus is shown in a sampled frame of his source walk, not a new performance. The environment is visibly sparse and needs further detailing, dressing and cinematic direction; the pose and ground contact have not been motion-QA'd. There is no call, animation sequence, dialogue or sound in this still. The game remains unchanged.

The warehouse imagery is a possible later setting; it does **not** change the required order: studio identity, title/reveal, roughly 30-second cinematic, automatic voiced phone call with visible pickup, then warehouse and city. No new story facts are implied.

## Sources

- Marcus: owner-approved original `brand/characters/marcus/marcus_approved_source.glb`, unchanged; rights and provenance in that directory's README.
- [Cardboard Box 01](https://polyhaven.com/a/cardboard_box_01), [Steel Frame Shelves 02](https://polyhaven.com/a/steel_frame_shelves_02), [Wooden Crate 01](https://polyhaven.com/a/wooden_crate_01): Poly Haven assets, [CC0](https://polyhaven.com/license). The 1K glTF files came from the third-party [RoboSim mirror at commit `1c39c50ddb8a0043ba2a500485fec687728d8a6d`](https://github.com/rsasaki0109/RoboSim/tree/1c39c50ddb8a0043ba2a500485fec687728d8a6d/assets/props/polyhaven_warehouse). All 15 used input files matched the mirror's pinned SHA-256 manifest; hashes are in `prop_hashes.json`. We did not independently compare the binary files with Poly Haven's direct downloads. Assets were positioned and the shelving rotated; procedural architecture and lighting are original study geometry.

Rebuild with Blender's Python (`bpy` 4.2) and `INTRO_ASSET_DIR` set to a directory containing the three named glTF asset folders and their `.bin` and texture dependencies. `tools/build_intro_study.py` replaces this scene and render. CPU render used headless Blender Python with temporary display-library stubs; no Blender GUI, Godot, Xogot or device test is implied.
