# LEVERAGE: CINDER CITY — worldwide creative research and proposed direction

**Research checkpoint — 25 November 2026.** This is a substantive research and creative-direction pass, not a finished game, full master bible or proof that the production can reach the desired fidelity on an iPhone. It draws on developer interviews, conference material, original research on cities, platform guidance and engine documentation beyond the games named in the owner's brief. It does not claim hands-on study of games or tools not tested here. Source findings are separated from proposals. No source game's assets, music, characters, story or interface should be copied.

## Executive creative direction

**The earlier build is rejected as a quality benchmark.** A capsule on an empty road, a rectangular phone panel, flat captions and a static image do not establish a premium experience. The latest phone shot is also not a completed cinematic. Continuing to decorate that architecture without proper art, animation, scene direction, sound and validation would repeat the error.

**Proposed creative promise:** LEVERAGE is an intimate crime thriller inside a city that trades in favours, secrets and obligations. The excitement comes from making difficult decisions under pressure, seeing the city respond and occasionally turning an adversary's leverage against them. High action is punctuated by human moments, humour, friction and quiet observation. The city should feel like a place where ordinary people have lives beyond Marcus's mission—not a neon combat arena.

This is a proposal based on the established foundation (Marcus, his brother, debt, factions, corruption and the incomplete Blue Ledger), not a claim about unspecified canon. Marcus Vale, Eli, Tessa and any named faction or business in earlier drafts remain proposed names, not owner-established facts. The international coastal-city concept is a recommendation, not a claim that Cinder City is any particular real city.

## 1. What premium games are really doing

Each row states an observed design principle, a LEVERAGE experiment and a reason not to simply copy the source.

| Outside reference and source | What the source actually says | Original experiment for LEVERAGE | Cost / risk / non-copy boundary |
|---|---|---|---|
| **God of War** — cinematography director Dori Arazi describes camera as a character, coordinated staging and clean gameplay transitions; a single-shot approach forced tradeoffs in writing and blocking. [1] | Emotional viewpoint depends on movement, framing and character staging, not only detail. | Design the opening around Marcus's attention. Give the audience one brief quiet connection with his brother before danger; camera scale changes only when the emotional reason changes. | Do **not** mandate a no-cut camera. Use motivated cuts when needed for acting, performance and accessibility. No copied shots or story. |
| **Marvel's Spider-Man** — Insomniac describes movement as a combination of camera, field of view, animation and environment; its animation director discusses traversal/combat pipeline. [2][3] | Movement feel is a whole-body-and-camera system, not just translation speed. | Prototype Marcus walking, stopping, turning and interacting: feet plant, body anticipates, camera follows without obscuring the action. Compare touch latency and responsiveness, not just animation beauty. | Not a superhero locomotion system. Each transition multiplies animation and QA work. |
| **Resident Evil 4 remake** — producer Yoshiaki Hirabayashi describes increasing control flexibility while rebalancing enemies and level design around it. [4] | A control change affects opponents, space and timing; speed alone does not make action better. | A first fight should tune one attack, dodge, block and enemy response together. Reward positioning and recovery, not random button mashing. | No copied combat encounters or fixed difficulty promises. Test touch controls and camera together. |
| **Sifu** — Sloclap describes credible animation, defense, environment and pressure from groups. [5] | Readable intent and the pacing of multiple attackers are as important as the number of moves. | Prototype one attacker at a time with clearly signalled pressure from others, then test escalation. Original five-discipline identity comes later. | Ticket counts, timings and difficulty are design hypotheses, not proven rules. Do not reproduce its UI or techniques. |
| **Control** — Remedy's director connects architecture, material behaviour, lighting and gameplay. [6] | Art direction is strongest when forms and materials support what the player does. | Make workshop surfaces and market layouts explain use: marks where tools rest, a busy counter, routes visible by light, doors with believable access. | No supernatural government-building aesthetic or promise of extensive destruction on mobile. |
| **Ghost of Tsushima** — Sucker Punch discusses using environmental wind as direction while retaining player exploration; the wind points directly rather than pathfinding around obstacles. [7] | Navigation can preserve attention on the world, but visual guidance must not silently mislead. | Test original local cues: a witness's directions, distinctive light, sound, landmarks and optional route assistance. The player can still choose explicit navigation and accessibility aids. | Do not copy guiding wind. Complex roads require actual route testing; directional cues cannot replace accessible guidance. |
| **GTA V** — Rockstar's Aaron Garbut describes beginning with roads, vistas, district transitions, skyline and landmarks, then placing story content. [8] | A city is coherent at the street-network and landmark level before individual props are added. | Design a navigable waterfront-to-market-to-workshop route with silhouette, traffic logic, work patterns and distinct sightlines. | Do not promise Rockstar's scale, crowds, streaming or performance. Cinder City should not reproduce Los Santos. |
| **Disco Elysium** — writer Justin Keenan discusses character-specific writing and resists simplistic 'good/bad/sarcastic' framing. [9] | Dialogue can reveal personality and social context without reducing people to a moral meter. | Write choices as credible intentions with different risks: protect a witness, ask for proof, or bargain for time. Characters can refuse and remember only what they actually learn. | Do not copy its internal-voice mechanic, prose or politics. Branching requires authored testing. |
| **Returnal** — Housemarque explains information conveyed through UI sound and haptics, and a music cue that becomes clearer as the player approaches. [10][11] | Audio can carry tension, information and direction instead of merely filling silence. | Establish a sound identity for the workshop, distance-to-docks and changing danger; offer captions and visual alternatives for essential cues. | No assumption PS5 spatial audio/haptics translate to iPhone or Xogot. Mono/speaker mode must still work. |
| **The Last of Us Part II** — designers describe early accessibility planning and iteration with testers and advocates, including adjustable rather than mandatory presets. [12] | Accessibility is a production discipline and user research problem, not one checkbox. | Test subtitle size/background, input remapping, hold alternatives, camera comfort and readability with disabled players; preserve separate settings. | Do not imply equivalent coverage is already implemented or guaranteed. |
| **Environmental storytelling** — designer Matthias Worch describes players inferring history from environment and its reaction, rather than only consuming exposition. [13] | Environmental detail should communicate a knowable event or relationship, not just clutter. | An unpaid invoice, an improvised repair and the position of two tools can suggest pressure and family history; player interpretation can later be confirmed or challenged. | Details must relate to authored canon, not invent a plot fact through decoration. |

A further idea, drawn from a branching-design GDC summary [14]: use **meaningfully different local routes that rejoin at an authored story beat while preserving their consequences**. This is a candidate for controlling cost, not a reason to make every choice cosmetic. Decisions need legible downstream changes in access, trust, exposure or evidence; design and test each one.

## 2. Original identity: the city as a network of obligations

**Proposal:** build a coastal trading metropolis where cargo, money, relationships and information pass through the same streets. A courier, mechanic, market seller, port clerk and corporate executive participate in different versions of the same system. The player's strength is not ownership of everyone: it is understanding who knows what, who owes whom, who can safely be approached and what it costs to act.

Research on the Lagos–Abidjan corridor describes cross-border travel, markets and formal/informal trade; a Lagos urban study discusses multiple economic and spatial forms. [15][16] These are **inspiration for research questions**, not permission to turn real communities into crime stereotypes or conflate different cities. The city should also include prosperity, family life, civic institutions, creative culture, humour, leisure and honest work. Consult people with lived experience and use original names, architecture and signage. No fieldwork or local cultural consultation has been completed.

### Proposed distinctiveness tests

1. **The city has a daily purpose:** choose a location and explain what ordinary people do there before anything criminal happens. An industrial lane supports deliveries, maintenance and shift changes; it should not exist solely for a shootout.
2. **Landmarks communicate function:** signs, buses, shutters, drainage, overhead cables, entrances and loading access should have spatial logic. Establish a clear skyline and routes before filling a street with props. [8]
3. **Consequences are observable:** if Marcus exposes a source, the next relevant scene changes in a concrete, authored way; the affected person cannot know information that never reached them.
4. **Contrast is controlled:** wealth and neglect, noise and quiet, warmth and danger can coexist without presenting any real culture as a monolith.
5. **The player's own city story matters:** a small number of recurring characters and authored reactions can feel richer than hundreds of decorative, identical NPCs. Population scale and fidelity remain device-test questions.

### Possible original systems to investigate — not implemented or approved

- **Information provenance:** each lead records its source and who has received it. Sharing creates opportunity and exposure. Show the player what Marcus knows, what is inferred and what remains uncertain.
- **Leverage as a relationship, not a score:** a favour, debt, proof or threat gives a specific person a reason to act; using it can damage trust or expose a third party. Avoid a universal 'leverage points' currency that makes every person interchangeable.
- **Pressure with human cost:** a timed situation may change who can help or what evidence survives, but never remove a critical path without a readable alternative. Offer adjustable assistance; no global countdown imposed by default.
- **Consequence at several scales:** immediate reaction, later practical consequence, and a changed relationship or environment. Limit each choice to consequences that can be authored and tested.
- **Memorable quiet interactions:** a mechanic returning a tool to its place, an interrupted joke, a market vendor choosing whether to trust Marcus. Not every discovery is a combat or dialogue prompt.

These ideas deliberately extend the brief; they are creative proposals for owner review, not existing features or settled canon.

## 3. The opening: specific direction rather than a text sequence

**Hard requirement:** D’YOUNGS GAMES logo → LEVERAGE → CINDER CITY → approximately 30-second opening story sequence. The opening must establish Marcus, brother/family, the city and the first disturbance. The user explicitly wants a ringing/vibrating phone with white light, Marcus physically picking it up and putting it to his ear. The logo is an original designed asset, not just a line of default-font text.

### Shot and sound proposal, after studio and title presentation

| Approx. time | Picture and performance | Sound / purpose |
|---|---|---|
| 0–5 s | Establish a lived-in workshop with a view or sound of the coastal city. Marcus finishes a specific task; his body and hands show fatigue rather than standing in a default pose. | Working machinery winds down; distant city character. Establish place and occupation without exposition. |
| 5–11 s | A small detail suggests a personal connection to his brother—an original, story-approved object or gesture, not an unapproved backstory. Marcus has a human moment before the danger. | Room tone and a brief, specific emotional cue. No mandatory narration. |
| 11–17 s | A phone on the bench vibrates. White screen illumination affects nearby surfaces; camera guides attention without turning the phone into a giant UI panel. Marcus notices. | Rattle has a physical contact sound; a caption conveys the event when sound is unavailable. |
| 17–24 s | Marcus reaches, grips, lifts and brings the phone to his ear. Fingers, eye line, contact, weight and phone position must be authored as one performance. | Tool movement and clothing foley; phone sound changes as the object leaves the surface. |
| 24–30 s | The call connects; an emotionally specific exchange begins, then a small but unmistakable disturbance changes its tone. Transition cleanly into the player's call interaction. | Distinct voices and silence between lines; speaker-labelled subtitles. Final script and exact moment require narrative approval. |

Timing is a **previsualization target**, not an assertion the scene has been authored or can be achieved with existing assets. It can be revised to allow genuine acting. Avoid promising a seamless one-shot transition before it is proven. The answer/decline state must be resolved coherently: if interaction precedes pickup, the animation and dialogue must branch appropriately; no finished clip should show the call being answered before the player chooses to decline.

### Shot-level acceptance

- Distinct, readable silhouettes and composition at the size of the iPhone 13 mini; no default text overlay masquerading as cinematic direction.
- Marcus is an original, clothed character with expressive face/hands, appropriate rig and skin deformation. A generic mannequin or capsule is not accepted as final Marcus.
- Phone and hand make contact without an obvious jump, floating grip, clipping or hand-through-bench; the phone's world-to-hand attachment is frame-accurate. Lighting and sound respond to the action.
- Proper title typography and original studio mark; no unlicensed type, logo, image, music or likeness. Test dark scenes for readable blacks and skin tones.
- No important information depends on sound alone. Subtitles have speaker labels, optional background and scalable size. A clearly presented X action advances dialogue; cinematic skipping requires hold or confirmation, never an accidental single tap that also advances dialogue.
- Owner receives **actual in-engine stills and a screen recording**, with build identifier, platform and known defects. A concept is labeled concept; a diagram is labeled diagram. Device captures are distinct from editor renders.

## 4. Production art and performance pipeline

### A. Design and provenance

Produce original character turnarounds, silhouette studies, material references, workshop plan, prop references and logo explorations. Document sources, creators, license terms, modifications, cost, format, download date and hash. Use stock only when its license, style, scale and actual files have been checked. Do not copy a real city, an existing game set or a person's face. The brief's stylized low-poly comic-noir direction is compatible with sophisticated human performance; low-poly does not mean generic capsules or blank walls.

### B. Hero character and animation

1. A character artist creates or lawfully adapts Marcus's model, clothing and facial expression setup, with documented source and rights.
2. Technical artist validates skeleton, skinning, hand poses, face, rest pose, scale and export. Choose a humanoid profile only after testing the actual rig.
3. Capture or keyframe the specific phone performance with a real prop reference; animate body mechanics and facial/eye acting. Library motion can be an initial reference but is not proof of a convincing unique performance.
4. Export and inspect the result in the actual engine. Blender documents glTF object/bone transforms and shape keys, but unsupported property tracks can be ignored; camera, material and lighting animation may need separate engine authoring. [17] Check the installed Blender/exporter version, do not assume a specific exporter label or feature.
5. Direct sound, camera, lighting and acting **together**. Iterate against an actual recording, not a list of nodes.

Actual character, animator, performance-capture, cost, timeline and tool availability are unverified. A free animation library is not automatically a 10/10 actor, and AI-generated stills are not a 3D rig.

### C. Audio and rights

Commission or record a distinctive studio ident cue; establish workshop room tone, object foley, phone vibration on a surface, exterior city ambience, character voices and music. Original or properly licensed assets need documented rights for game use, modification, territories, distribution, promotion and any performer/voice permissions. Mix dialogue, sound effects and music separately. Test built-in Godot audio first, because Xogot's iPhone/iPad documentation limits plugins to GDScript; native middleware cannot be assumed to run in the editor. [18] No actor, music, license or budget has been secured.

### D. Mobile rendering and version reality

Godot's official guidance recommends considering baked lighting on mobile and measuring LOD/culling; its architecture notes that mobile bandwidth and effects such as glow/depth of field can be costly. [19][20] The result is **not** 'disable all lighting' or 'use desktop settings': test art direction with selective dynamic light, authored materials and available baked techniques on actual devices. Avoid inventing universal triangle, frame-rate or memory limits. Verify installed Godot/Xogot and renderer before choosing a pipeline. Xogot on Mac documents an App Store packaging route, while upstream Godot documents a macOS/Xcode iOS export workflow; neither proves the owner's current setup has those capabilities. [21][22]

## 5. Mobile interaction and accessibility research

Apple's handheld-games guidance distinguishes screen safe areas, point-based tap targets, flexible thumbstick areas and camera zones. [23] Its general starting point is **44 × 44 points**, not 44 physical pixels; fast game controls may need larger areas and more separation. [24] These are starting points, not proof of comfortable combat controls. Test the full HUD, cutouts, thumbs covering key action, left/right-handed use, one-finger and multitouch conflicts, safe areas and finger reach on the actual iPhone 16 and iPhone 13 mini.

Recommended interaction contract:
- One active context owns a touch: gameplay, combat, phone, dialogue, pause or cinematic. X advances the active dialogue; cinematic skip has explicit confirmation or accessible equivalent. A single input must not activate two contexts.
- Preserve the requested X/Y/A/B combat assignments. Surface other controls contextually, without concealing critical state. Give visual and audio feedback on successful input, interruption and unavailable actions.
- Provide optional remapping, hold/toggle alternatives, camera sensitivity, reduced camera shake, subtitles and sound cues. Accessibility requires actual evaluation with players, not a checklist alone. [12]
- Avoid equating 'cinematic' with unreadable text, hidden controls, excessive darkness, unskippable scenes or forced camera motion.

## 6. User research and quality gates

Thatgamecompany's development discussion describes frequent playtests and multiple iterations rather than assuming an idea works; Santa Monica's GDC session identifies playtesting as an ongoing production input. [25][26] For LEVERAGE, these lead to a **proposed** protocol:

1. **First viewing:** do not explain the scene. Ask viewers what they think Marcus is doing, who calls and why the tone changes. Record confusion and spontaneous emotional responses.
2. **Silent viewing:** repeat with sound off and captions enabled. The player should understand the phone and essential story change.
3. **Action and accessibility:** test skip confirmation, dialogue advance, phone answer/decline, screen-safe layout and readable text. Include players with different accessibility needs and obtain consent for recordings.
4. **Scene mechanics:** repeat hand/phone contact, camera angles and branch transitions; record clipping, pops, lighting failures, audio dropout and broken state.
5. **Devices:** record build ID, actual device/OS, renderer, duration, thermal conditions, frame-time distribution, memory, battery/temperature indicators where available and loading. Test both cold and sustained use; avoid inventing results. The device targets are iPhone 16 and iPhone 13 mini, availability unconfirmed.
6. **Owner review:** show genuine footage and defects. A failed quality gate sends the work back for revision, rather than adding another unvalidated feature.

**Release gates:** original logo and title; compelling 30-second scene and branching call; polished walk/camera; investigation with real consequences; readable combat; safe persistent save; accessibility; meaningful audio; and verified sustained device operation. The wider 60+ minute story and the full sixteen-identity roster need complete writing, art, systems and testing beyond the opening. A 10/10 ambition is a direction for iteration, not a score the developer can award.

## 7. Decisions, unknowns and current status

- **Established:** Marcus, his kidnapped brother, family debt, factions, corporate corruption, betrayal, incomplete Blue Ledger, six acts, sixteen-identity core roster, five combat disciplines, owner-specified controls and mobile target.
- **Proposed:** all specific new systems and artistic treatments in this document; prior invented proper names are not established canon.
- **Not verified:** actual Godot/Xogot version; iOS deployment/export path on owner's setup; artist/tool access; budget; character assets; licenses for any actual final asset; voice talent; real-device performance; user acceptance.
- **Current build:** remains an early blockout with default-style UI, temporary capsules, static art and a rudimentary phone test. It fails the requested artistic and cinematic gate. No claims of studio-quality animation, logo, responsive combat or final art are justified.
- **Immediate next production task:** create a real original opening asset/animation pipeline and test scene, capture actual engine footage, and review the result before scaling. This research is not a substitute for the build or its review.

## Sources consulted

[1] Dori Arazi / God of War camera interview, Variety: https://variety.com/2018/gaming/features/god-of-war-single-shot-camera-1202793441/
[2] Insomniac traversal technology interview, Variety: https://variety.com/2018/gaming/news/spider-man-tech-insomniac-interview-1202930094/
[3] Insomniac animation director's GDC session summary: https://gdcvault.com/play/1025971/The-Animation-of-Marvel-s
[4] Resident Evil 4 remake producer interview, Xbox Wire: https://news.xbox.com/en-us/2023/03/10/talking-resident-evil-4-updated-combat/amp/
[5] Sloclap, Sifu combat: https://blog.playstation.com/2021/11/18/how-sifus-kung-fu-combat-works/
[6] Remedy director interview, Control: https://www.dualshockers.com/control-interview-e3-2018/
[7] Sucker Punch, Ghost of Tsushima effects and navigation: https://blog.playstation.com/2021/01/12/how-stunning-visual-effects-bring-ghost-of-tsushima-to-life/
[8] Rockstar's Aaron Garbut, GTA V world-building interview: https://www.gamesradar.com/games/grand-theft-auto/the-making-of-gta-5-how-the-gta-6-predecessor-helped-rockstar-pave-the-way-for-its-return-to-vice-city-with-jason-and-lucia/
[9] Disco Elysium writer Justin Keenan interview: https://www.rpgfan.com/feature/dream-quests-and-desires-an-interview-with-disco-elysiums-justin-keenan/
[10] Housemarque, Returnal UX: https://blog.playstation.com/2021/05/11/unpacking-returnals-ux-design-gameplay-first-ui-retro-futuristic-tech-and-accessibility/
[11] Housemarque, Returnal sound and encounter direction: https://blog.playstation.com/2021/05/28/returnal-the-making-of-that-unforgettable-hyperion-fight/
[12] Naughty Dog accessibility designers interview: https://www.gamesindustry.biz/the-last-of-us-part-2-has-around-60-different-accessibility-features
[13] Matthias Worch, design lectures and environmental storytelling summary: https://www.worch.com/lectures/
[14] Liam Esler, GDC branching narrative session summary: https://www.gdcvault.com/play/1023386/Finding-the-Right-Branching-Narrative
[15] NPR reporting on Lagos–Abidjan corridor: https://apps.npr.org/west-africa-trade-growth-economy-nigeria-ghana-lagos/
[16] African Cities Research Consortium, Lagos city study: https://www.african-cities.org/wp-content/uploads/2021/12/ACRC_Lagos_City-Scoping-Study.pdf
[17] Blender glTF manual, version 5.3: https://docs.blender.org/manual/en/5.3/addons/scene_gltf2.html (verify against installed version)
[18] Xogot iPhone/iPad differences: https://docs.xogot.com/documentation/xogot/differences/
[19] Godot 4.7 3D performance: https://docs.godotengine.org/en/4.7/tutorials/performance/optimizing_3d_performance.html
[20] Godot 4.7 rendering architecture: https://docs.godotengine.org/en/4.7/engine_details/architecture/internal_rendering_architecture.html
[21] Xogot Mac differences: https://docs.xogot.com/documentation/xogot/differences-mac/
[22] Godot 4.7 iOS export: https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_ios.html
[23] Apple, handheld game interfaces: https://developer.apple.com/videos/play/meet-with-apple/243/
[24] Apple, UI design tips: https://developer.apple.com/design/tips/
[25] Thatgamecompany development/playtesting discussion: https://gdconf.com/news/whats_next_thatgamecompanys_su
[26] Santa Monica Studio playtesting GDC session summary: https://schedule2019.gdconf.com/session/playtesting-god-of-war/861302
