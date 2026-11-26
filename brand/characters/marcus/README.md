# Marcus — 3D appearance study

**Awaiting owner review, not a finished or approved character.** This first actual 3D Blender study explores an adult protagonist with a practical jacket, shirt, jeans and boots. Appearance, clothing and the previously proposed surname are creative proposals, not established canon. The head, hair and skin are currently generic and visibly stylized; they do not yet meet the intended grounded cinematic fidelity. Shoes appear slightly above the presentation floor in some views. This is a starting point for review, not an assertion that the hero is complete.

`marcus_character_study.blend` is an editable Blender 4.2 scene; its textures are packed. Actual Cycles renders are `docs/previews/marcus/front.png`, `three_quarter.png`, `side.png`, `rear.png`, and `face_closeup.png`. `tools/build_marcus_3d_study.py` describes the build and generates the scene/renders using the six original component files, downloaded separately to `MARCUS_SOURCE_DIR`.

The study is assembled from independently skinned parts and currently has multiple separate armatures. Body and garment masking, joint rest-pose adjustments, deformation, unified rig, expressions, animation, GLB export, Godot/Xogot import and phone performance have **not** been verified or completed. The A-pose is a model review pose, not an animation. The character is not integrated with the approved title or any intro.

## Source and rights

Sources: [kblood/CharacterCreator](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78), commit `852e48f316b90a0937234886630e4fb4cdfd1f78`, files `output/base_body.glb`, `output/clothing_jacket.glb`, `output/clothing_jeans.glb`, `output/clothing_shirt.glb`, `output/clothing_boots.glb` and `output/hair_short02.glb`. The upstream README states its generated output assets from MakeHuman and project-original data are CC0; the upstream `output/clothing.json` lists these garments CC0 and `output/asset_licenses.json` lists the skin, hair and other MakeHuman elements CC0. Source code is GPL-3.0-or-later; this scene and our script do not incorporate that code. See [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). This is a modified assembly of third-party assets, not an original sculpt created from scratch.

SHA-256 of source files, in the same order:

```
b5b450af89f6fbf8debf387eda8da40cd0a8c3253a2d59871c730ce7e7f46469
22c489abb90fa3af3381948a91016ae2fa5dc5ab1c1152721527ac74c70e9dbd
dac0e90aba219415e895eed0e471c0a9aab6b53f8870be1f8dfd41cd89c25d11
c3467876f712e63a901fa664b1d54eb0127c56d20888dbbb0a606973fd26e9cc
ca9bd57f279006c5114cc47fbbc8143d0e53ac5ddb9b40c78099a53a0c904895
eb341c197acf3948dac1f41f7722e9dad31018149541504a13ebcc8b6aa9d5aa
```
