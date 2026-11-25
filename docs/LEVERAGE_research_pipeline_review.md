# LEVERAGE: CINDER CITY — research and production pipeline review

**Research checkpoint: 25 November 2026. Status: recommendations for owner review; not production approval.** This is the first targeted research pass, not the completed A–Z research, final asset register or a claim of 10/10 quality. No assets or plugins listed here have been downloaded, imported, licensed for this specific production, tested in Xogot, or approved for final use. No engine, device, asset-performance or price benchmarks were measured in this pass.

## 1. Correcting the direction

The existing project is a crude experiment: capsule characters, limited interaction, text dialogue, a static image and no physical phone performance. It is **not** the cinematic vertical slice requested. Replacing one background image with another would not fix acting, staging, animation, sound or mobile usability. Suspend new game implementation until a research-backed asset and cinematic pipeline is selected and an opening quality gate is defined.

The authoritative A–Z brief specifies high-contrast **low-poly comic noir with a premium cinematic finish**, not generic photorealism or a blanket neon filter. Preserve character-readable skin and materials, detailed dark values, controlled cyan and pink accents, international city identity and original branding. Its opening order is D’YOUNGS GAMES logo → LEVERAGE → CINDER CITY → approximately 30-second story-relevant cinematic. X advances dialogue; a deliberate hold/confirmation should distinguish cinematic skip from line advance. The opening must show a physical ringing phone and Marcus's interaction, not simply claim it occurred in text. The exact phone-to-ear staging below is a proposed production solution, not established historical canon.

## 2. Reference games: learn systems, not assets

| Reference | Evidence | Transfer to LEVERAGE | Don't copy / research gap |
|---|---|---|---|
| **Sifu** | Sloclap describes credible movement, readable defense, environmental options and managing simultaneous enemy aggression; its developer interview describes an attack-ticket system. [1][2] | Prototype readable wind-up, impact and recovery; constrain concurrent threats; test touch inputs and camera visibility. | Do not copy its Structure UI, specific Pak Mei moves or difficulty curve; five disciplines need their own identity. |
| **Sleeping Dogs** | Designer Mike Skupa describes multidirectional strikes, counters, grapples and contextual environment interaction, refined through feedback. [3] | Build one original environmental move with clear affordance and interruption rules before expanding. | No copied takedowns, Hong Kong identity or assumptions about scalable physics. |
| **Max Payne 3** | Rockstar's Rob Nelson describes animation blending and environment-aware reactions as part of making shooting responsive and believable. [4] | Evaluate recoil, sound, pose, camera and hit response as one authored interaction, including transitions. | Do not assume its proprietary Euphoria system or AAA animation volume is available on phones. |
| **Hitman** | An IO level designer describes public, purpose-driven and restricted spaces, and how social expectations guide player behaviour. [5] | Give the market and workshop understandable public/private boundaries and alternative evidence routes. | No copied disguises, maps or assassination puzzles; test whether the player understands original rules. |
| **Watch Dogs: Legion** | Ubisoft describes recruitable characters and procedural character/mission complexity. [6] | Give a small number of authored people meaningful relationships and knowledge; represent distant populations at lower fidelity. | Do not promise play-as-anyone or equivalent city simulation. |
| **Mafia: Definitive Edition** | The brief asks for crime-drama staging, city mood and character-driven mission pacing. | Benchmark shot composition, readable urban architecture and transitions between travel and story. | Developer-level evidence and direct comparative analysis still needed; no claim the game has been hands-on studied in this pass. |

These references are research only. Do not ship or reproduce their characters, art, dialogue, music, interface or maps. Reference research should continue with primary developer sources, accessibility comparisons and documented in-game observation; publisher descriptions are not performance measurements.

## 3. Recommended opening production pipeline

**Recommended target, not yet made:** a real-time, authored, skippable 3D scene with a designed Marcus, workshop, phone, controlled camera, performance, subtitles and sound. Use an original coherent low-poly comic-noir art bible and material palette. A short, complete, repeatable scene should prove the quality before a city is built.

1. **Direction and previs:** write shot-by-shot boards and action beats, record temporary timing and storyboard in original artwork; confirm screen readability at phone size. Set design shows Marcus's occupation and relationship without narration-heavy text.
2. **Hero character:** commission or create an original Marcus model with face, hands, clothes, skin weights and a humanoid skeleton. Verify creator rights, facial-expression capability and usable performance on close-up and mobile. CC0 base models may be used for rig tests only until they pass art direction; a generic rig is not a final performance.
3. **Phone action:** author a coordinated performance: phone resting on workbench → vibrating with rhythmic sound and visible white screen light → Marcus notices, reaches, grips → phone transfers from bench to hand at the contact frame without a visible jump → hand raises it to ear → speaking/answer choice. Hand/finger pose and eye line are deliberately animated, not assumed from a generic walk animation. Test camera occlusion, grip, silhouette and the declined-call branch. Separate animation clips or a continuous authored take can be evaluated; neither is implemented.
4. **Technique to test:** create and retarget animation in a DCC application, export GLB, use Godot's SkeletonProfileHumanoid and BoneMap where suitable, attach the phone at contact using a hand bone attachment while preserving world transform, and drive animation/camera cues from a timeline. Godot warns retargeting can change results or produce poor rest-pose fixes; test the actual rig rather than trusting automatic mapping. [7][8][9] A custom authored interaction may be necessary.
5. **Sound and feedback:** layer a licensed or original phone vibration/rattle, room tone, rain, mechanic cloth and movement; caption meaningful non-speech audio. Author voice performances with agreements and approved scripts; do not simulate voices of identifiable people. Configure separate music/effects/dialogue/subtitle settings. Test the sound in a quiet and noisy setting.
6. **Approval:** user reviews a genuine screen recording and still captured from the actual build. No concept art or mockup should be labeled an engine screenshot. After feedback, revise; visual polish is evaluated against the brief and references, never awarded by the developer alone.

Opening timing, dialogue and shot list need an additional authored review; the scene must be approximately 30 seconds after the logo/title sequence, not a rigid excuse to compress performance.

## 4. Tools and plugin evaluation

| Tool | Role and evidence | Decision / risks |
|---|---|---|
| **Godot 4 / GDScript** | Native animation, 3D and audio; Godot recommends Mobile renderer for newer mobile 3D, with feature limits. [10] | Candidate engine. Verify the exact installed Xogot/Godot version and actual rendering, import and touch behaviour before pinning a version. Current project has not passed this test. |
| **Xogot for iPhone/iPad** | Xogot states iOS/iPadOS plugins must be GDScript; C++, C# and other compiled extensions are unsupported. [11] | Treat pure-GDScript compatibility as a hard requirement for editing/testing in Xogot. Verify exact workflow and feature support on the owner's device. |
| **Blender** | Candidate for modeling, animation, materials and GLB export; its official manual documents glTF support. [12] | Recommend a desktop DCC pipeline if available; verify tool availability, current version, artist capacity and export results. Do not assume desktop access. |
| **Mixamo** | Adobe says its service is free with an eligible Adobe ID and lists royalty-free commercial game use for its characters/animations; humanoids only. [13] | Candidate for motion prototypes; do not assume it supplies the required specific phone performance or redistribution rights. Review actual terms, export, retargeting, artistic fit and source-file storage before use. |
| **Quaternius Universal Animation Library** | Creator lists humanoid GLB/FBX/Blend animations and CC0; source/download tiers differ. [14] | Compare locomotion and combat as prototypes, not a shortcut to final animation quality; examine actual clips and license at download. Precise phone clip availability unverified. |
| **FMOD / native extensions** | Example FMOD integration is a GDExtension and proprietary FMOD licensing is separate from plugin license. [15] | Not a Xogot iOS editing dependency: native plugin conflicts with Xogot's stated restrictions. Start with built-in audio; consider middleware only after a compatible workflow, version and commercial terms are independently verified. |

For standalone iOS publishing, upstream Godot 4.7's documented export requires macOS, Xcode and export templates, plus signing/configuration. [16] Running inside Xogot is not proof of App Store export readiness. Xogot Connect's documentation says the remote workflow requires a subscription or license on the paired device; exact current price and availability have not been verified. [17]

## 5. Asset shortlist — research candidates only

| Candidate / creator | Use and verified source facts | Rights / cost / format | Decision and missing checks |
|---|---|---|---|
| **Combination Wrench**, BKS / Poly Haven | Workshop dressing, listing reports 2K triangles. [18] | CC0; Poly Haven says commercial use, modification and redistribution allowed without required attribution. [19] Listing is free; chosen actual format/resolution not verified. | **Candidate to modify** into comic-noir look; inspect mesh/material, import size, silhouette and device cost before acceptance. |
| **Tool Cart**, Poly Haven | Workshop dressing; listing reports 29K triangles and 8K source. [20] | CC0, free site asset. [19] Actual package and format not checked. | **Candidate only**: 29K/8K is not automatically suitable on a phone; make/test lower-detail version or commission alternative. |
| **ambientCG materials**, various creators | Surfaces for wood, concrete and metal; site licenses its assets CC0. [21] | Commercial use and modification allowed, no attribution required; free. Exact material/format/size not selected. | **Search candidates**, not an approved blanket register. Select actual files, confirm license/date, downsample and evaluate style and memory. |
| **Universal Base Characters**, Quaternius | Creator reports humanoid rigs, glTF/FBX and average 13K triangles. [22] | Listed CC0 with free and source options; exact tier and download contents must be verified. | **Rig test only**, not automatically Marcus or approved final art. Check proportions, face/fingers, outfit and retargeting. |
| **Universal Animation Library**, Quaternius | Humanoid animations, GLB/FBX/Blend, root-motion and in-place variants according to creator. [14] | CC0; creator distinguishes full source/download tiers. Exact price/contents not confirmed. | **Prototype candidate**, inspect exact clips; bespoke phone pickup and grounded acting remain unverified. |
| **Freesound**, individual contributors | Source for rain, workshop room tone, phone rattle. [23] | Licenses vary per recording: CC0, CC BY or CC BY-NC. No asset chosen; account/download terms and price unverified. | **Search only**; prefer CC0 or properly credited CC BY; reject NC for a potentially commercial release unless explicit rights obtained. |
| **Marcus, phone, logo, score, voices** | Original hero-specific assets and performance required. | Rights, price, creator, rig spec and format **not yet established**. | **Create or commission**, with written commercial game, derivative, platform, recording and promotional rights; do not use celebrity likeness. |

An actual production register must record each selected file's precise name, creator, URL, acquisition date, license and version, commercial/modification/redistribution/attribution terms, price and tier, formats, rig and texture/triangle data, source checksum, provenance, import settings, test results, and approval. Individual marketplace assets and fonts require their own terms; site-wide assumptions are not enough. No downloads or asset fitness have been independently verified here.

## 6. Performance and acceptance, not unsupported promises

- Target iPhone 16 and iPhone 13 mini in landscape; OS version, installed Xogot, thermal conditions and availability remain unknown. Establish a **proposed** 30 fps sustained baseline and optionally test 60 fps on the newer device; these are hypotheses to negotiate, not measured results or guaranteed targets.
- Test the same scene and interaction at cold start and after a repeatable longer session. Record model, OS, build, renderer, display/resolution, settings, scene, ambient conditions, frame-time distribution and 1% lows, memory, loading, battery/thermal changes, visual defects, crashes and test duration. Use Godot counters and, where available, platform profiling; distinguish editor from exported builds. No figures are yet available.
- Evaluate material/texture compression, lighting, shadow cost, LOD and occlusion empirically. Godot describes occlusion as most useful with substantial occluders and notes CPU cost; test rather than assuming it always helps. [24] No universal poly, draw-call or FPS budget is justified without measurement.
- **Cinematic gate:** real rigged Marcus; no obvious hand/phone clipping or pop at attachment; physical white screen lighting visible without blowing out skin; audible ring/rattle with optional subtitles; purposeful camera and readable action; X advance versus confirmed/hold skip; skip returns to correct state exactly once; answer/decline coherent; no duplicated call; safe-area readable on both devices.
- **Playable slice gate:** add movement/camera, witness investigation with genuinely differentiated outcomes, at least one readable and responsive combat encounter, mission resolution and persistent state. Test save interruption/recovery, input-state isolation, subtitle settings and repeatability. The full 60+ minute campaign is not established by this gate.
- Acceptance needs separate statuses: designed / implemented / editor-tested / device-tested / defects / measured performance / owner-approved. None of the above proposed gates has passed.

## 7. Next research actions before building

1. Verify versions, actual Xogot import and deployment restrictions, desktop access and production constraints; do not presume the owner has a Mac, budget or an artist.
2. Deepen the six reference studies with specific official gameplay/developer material and capture lawful, sourced study observations; complete the missing Mafia evidence and mobile touch/accessibility comparison.
3. Select exact candidate files and inspect licenses, geometry, rigs, credits, costs and style compatibility before downloading/committing; investigate original Marcus, phone, clothing, workshop modules and authentic acting.
4. Create a detailed 30-second shot list and production-ready animation/audio/interaction contract; compare choices against the brief and get owner review.
5. Develop a measured two-device test protocol and actual estimates after a representative benchmark; do not extrapolate performance from desktop screenshots.
6. Only after review, build the single opening-quality test, show actual screenshots/video, iterate; expand the game only after it meets the agreed gate. Continue the wider bible, budget, cast, world, licenses and production planning in parallel rather than treating this document as complete pre-production.

## Sources

[1] Sloclap, Sifu combat: https://blog.playstation.com/2021/11/18/how-sifus-kung-fu-combat-works/
[2] Sloclap developer interview: https://www.unrealengine.com/developer-interviews/old-boy-john-wick-sifu-the-design-of-a-pak-mei-master
[3] United Front Games designer interview: https://www.siliconera.com/sleeping-dogs-fighting-system-inspired-by-tony-jaa-action-flick-the-protector/
[4] Rockstar developer interview: https://www.the-independent.com/games/interview-rockstar-s-rob-nelson-on-max-payne-3-7745583.html
[5] IO Interactive level designer talk report: https://www.pcgamer.com/how-the-creators-of-hitman-use-social-science-to-design-perfect-murder-playgrounds/
[6] Ubisoft Toronto, Watch Dogs: Legion: https://toronto.ubisoft.com/games/watch-dogs-legion/
[7] Godot, retargeting: https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/retargeting_3d_skeletons.html
[8] Godot, AnimationTree: https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html
[9] Godot, bone attachment example: https://docs.godotengine.org/en/stable/tutorials/physics/soft_body.html
[10] Godot renderers, version 4.4: https://docs.godotengine.org/en/4.4/tutorials/rendering/renderers.html (verify against installed version)
[11] Xogot differences: https://docs.xogot.com/documentation/xogot/differences/
[12] Blender glTF manual: https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html
[13] Adobe Mixamo FAQ: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
[14] Quaternius Universal Animation Library: https://quaternius.com/packs/universalanimationlibrary.html
[15] Godot-FmodPlayer documentation: https://godot-fmodplayerdocs.readthedocs.io/en/latest/
[16] Godot 4.7 iOS export: https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_ios.html
[17] Xogot Connect: https://docs.xogot.com/documentation/xogot/xogot-connect/
[18] Poly Haven Combination Wrench: https://polyhaven.com/a/combination_wrench
[19] Poly Haven license: https://polyhaven.com/license
[20] Poly Haven Tool Cart: https://polyhaven.com/a/tool_cart
[21] ambientCG license: https://docs.ambientcg.com/license/
[22] Quaternius Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html
[23] Freesound FAQ: https://freesound.org/help/faq/
[24] Godot occlusion culling: https://github.com/godotengine/godot-docs/blob/master/tutorials/3d/occlusion_culling.rst
