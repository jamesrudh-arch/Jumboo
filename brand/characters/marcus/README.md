# Marcus — approved source and prior appearance studies

**Current approved appearance:** the owner chose the complete Grab3D Casual Man rigged character as Marcus, explicitly accepting his different face and clothing. The approved source is `marcus_approved_source.glb`; provenance, source rights and inspection results are in `../research/casual_man/README.md`. The owner subsequently approved the presented Blender source-walk preview (`docs/previews/character_research/casual_man_walk.gif`). That approval applies to the preview, not comprehensive motion or technical QA. This model is not yet integrated into the game or intro; full deformation, Xogot import and device performance remain unverified.

## Source and normalization test

`marcus_approved_source.glb` is the unchanged, approved appearance source. The separate `marcus_normalized_test.glb` modifies only skin weights: `tools/normalize_marcus_weights.py` normalizes each four-weight tuple, and `tools/test_marcus_normalized.py` verifies that every other byte remains unchanged. The source hash remains `c41f2bfc62b03a8dd8fbae37d201d4c73bba3806678984c6895f59a7cbf22c4f`; the test copy is `6a8078dcde0e7cef15bac18786a5b525eacfc2d948a8d3cd4a6d2a83a6fb6fda`.

Khronos glTF Validator `2.0.0-dev.3.10` reported **4,152 non-normalized weight errors and 2 warnings** in the original, and **0 errors and 2 warnings** in the normalized test copy. The remaining warnings concern missing tangent space and a non-root skinned mesh. See `docs/previews/character_research/marcus_gltf_validation.json`. Reproduce with `npm install --prefix /tmp/marcus-validate gltf-validator@2.0.0-dev.3.10` and `NODE_PATH=/tmp/marcus-validate/node_modules node tools/validate_marcus_gltf.cjs`. This checks format only: Blender/Godot visual equivalence, tangent behavior, motion, retargeting and iPhone performance are **not** confirmed. Neither GLB is integrated into the game.

## Superseded graft study (historical record)

**Superseded by the owner’s approval of the intact character above.** This is a static Blender appearance study for Marcus, exploring a more detailed face and hair, muted work jacket, shirt, jeans and boots. Appearance, clothing and the previously proposed surname are creative proposals, not established canon. The prior generic face study was superseded after the owner asked us to continue; it remains in Git history.

`marcus_character_study.blend` is an editable Blender 4.2 scene; textures are packed. Actual Cycles renders are `docs/previews/marcus/front.png`, `three_quarter.png`, `side.png`, `rear.png` and `face_closeup.png`. The visible neckline seam, generic clothing and overall fidelity need further refinement before production. The A-pose is a static review pose, not an animation.

This is a modified assembly, **not** a character sculpted from scratch: the face and hair are extracted from a Grab3D model, combined with a baked MakeHuman-derived body and separately skinned workwear. The face and body are separate cut surfaces with an approximate neck join; the body is baked static and the clothing uses separate armatures. This is not a unified or animation-ready rig. Garment masking, topology, deformation, expressions, animation, GLB export, Godot/Xogot import and phone performance remain unverified or unfinished. The character has not been integrated into the intro.

## Source and rights

- Body and clothing: [kblood/CharacterCreator](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78), commit `852e48f316b90a0937234886630e4fb4cdfd1f78`, `output/base_body.glb`, `clothing_jacket.glb`, `clothing_jeans.glb`, `clothing_shirt.glb` and `clothing_boots.glb`. Its README states generated output assets from MakeHuman and project-original data are CC0; `output/clothing.json` lists the garments as CC0 and `output/asset_licenses.json` lists MakeHuman elements as CC0. Its source code is GPL-3.0-or-later and is not incorporated in our builder.
- Face and hair: [Grab3D Man Base Mesh, rigged](https://grab3d.com/models/characters/man-base-character/), declared CC0 by [the source licence](https://grab3d.com/dl/man-base-character-rigged/LICENSE.txt). The source explicitly discloses **AI-assisted Meshy generation and automatic rigging**, followed by Blender cleanup. We used the unchanged GLB mirrored in [ayushpathak-957/health-plus](https://github.com/ayushpathak-957/health-plus/tree/c5fe67f85df90ee1605eaa112cb97341a2bfb6a3/public/assets/avatars), commit `c5fe67f85df90ee1605eaa112cb97341a2bfb6a3`; the mirror reports it as unmodified. We did not independently download from Grab3D to compare bytes.
- [CC0 1.0 legal text](https://creativecommons.org/publicdomain/zero/1.0/).

Rebuild with `tools/build_marcus_3d_study.py` and `MARCUS_SOURCE_DIR` pointing to the six input GLBs. The mirror's `man-athletic.glb` must be named `grab3d_man_base_rigged.glb` in that directory. Requires bpy 4.2, NumPy and compatible system libraries. Input SHA-256:

```
base_body.glb                 b5b450af89f6fbf8debf387eda8da40cd0a8c3253a2d59871c730ce7e7f46469
clothing_jacket.glb           22c489abb90fa3af3381948a91016ae2fa5dc5ab1c1152721527ac74c70e9dbd
clothing_jeans.glb            dac0e90aba219415e895eed0e471c0a9aab6b53f8870be1f8dfd41cd89c25d11
clothing_shirt.glb            c3467876f712e63a901fa664b1d54eb0127c56d20888dbbb0a606973fd26e9cc
clothing_boots.glb            ca9bd57f279006c5114cc47fbbc8143d0e53ac5ddb9b40c78099a53a0c904895
grab3d_man_base_rigged.glb    3038f56e1225d0ef9692189ed19ff688f1424e669281148a4cc6995fed568496
```

## Exploratory motion test

After appearance approval, `marcus_motion_test.blend` and `docs/previews/marcus/deformation_test.gif` were created as a **Blender-only deformation experiment**, not a walk or performance preview. The formerly static body now uses its preserved 53 weight groups, and its armature and four clothing armatures receive matching simple keys. The head is fixed, the neck remains unjoined, the arms remain out, and the feet slide/float; the motion is deliberately diagnostic and not representative of a final walk. It is not a unified rig or a game asset. The experiment exposes the need to consolidate/rebind the rig, join and weight the neck, fit the clothing and create grounded animation before a meaningful animation review. `tools/build_marcus_motion_test.py` rebuilds it from the approved appearance scene.

## Single-skeleton experiment

`marcus_unified_rig_test.blend` is a separate experimental Blender scene made from the approved appearance study. Its one skeleton drives the body, the cut head graft, and all four garments. Clothing rigs were consolidated only after checking their rest bone matrices; `tools/test_marcus_unified_rig.py` also confirmed the four garments' evaluated rest vertices stayed unchanged (maximum difference 0.0 in this test), that six meshes reference one armature, and that animation keys exist. It is not an export or gameplay validation.

`docs/previews/marcus/unified_rig_test.gif` is a short head-turn deformation experiment, not a walk or performance. `unified_neck_front.png` and `unified_neck_rear.png` show close views during the test; the **rear neck is visibly open and jagged**, and the head/body surfaces are not welded. Head weights are only an approximation; pose, shoulders, garment deformation, expressions, grounded walk and skinning require further work. Do not use this as a finished production rig. The historical graft study is unchanged.

The render was produced by bpy 4.2 CPU Cycles in a headless environment using temporary no-op stubs for unavailable display/OpenGL libraries; this did not test GUI or GPU rendering. No runtime, Xogot, animation export or device test was performed. The Blender file and generated renders are review artifacts, not integrated into the game. `tools/build_marcus_unified_rig_test.py` rebuilds the scene and GIF with normal bpy 4.2 and Pillow installations.

## Rear neck extension experiment

`marcus_neck_test.blend` is a separate experiment based on the unified rig, not a replacement for the approved appearance or a final model. Its rear graft edge was cut and extended downward into the jacket; the prior open black gap is less obvious in the rear test. See `docs/previews/marcus/neck_test_{front,rear,side}.png` and `neck_test_motion.gif` for actual Cycles renders. There is still a conspicuous horizontal tonal seam and an unnatural triangular neck silhouette in profile. The head and body are **not welded**; texture continuity, topology, neck weights and jacket deformation remain unfinished. The tiny head turn is not a walk.

`tools/test_marcus_neck_test.py` checks one skeleton, binding and finite evaluated head coordinates at five key frames. It does not test surface continuity, clipping, natural movement or game export. The experiment was rendered with CPU Cycles in the same headless, temporary display-library stub setup noted above; it was not tested in Blender's GUI, Godot, Xogot or on a phone.

## Deformation research and audit

See `docs/LEVERAGE_marcus_character_technical_audit.md` for the source-backed production assessment, measured structural baseline and visible limitations. `marcus_deformation_audit.blend` and the four `stress_*.png` renders are deliberately non-final stress poses, not natural animation.

## Foot-contact and garment experiment

`marcus_contact_study.blend` and `contact_study_side.gif` are a separate IK contact experiment with covered leg skin removed to address observed knee poke-through. This is not a finished walk or proof of collision-free clothing. See the follow-up in `docs/LEVERAGE_marcus_character_technical_audit.md` for measured stance drift, precise limitations, and the unsuccessful physical neck-bridge result. The approved appearance and prior unmasked model remain unchanged.

## Outsole contact refinement

`marcus_ground_contact.blend` is a separate diagnostic that refines sole weights and target height. Its sampled stance measurements are in `docs/previews/marcus/ground_contact_measurement.json`; they do not establish a finished walk, neck repair, complete clothing QA or game compatibility. See the ground-contact follow-up in the technical audit.
