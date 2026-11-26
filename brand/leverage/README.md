# LEVERAGE game identity — production register

The owner approved the **custom 3D wordmark**, **3D V/fulcrum icon**, title-reveal direction and presented colour palette. Preserve these directions. The approved models and stings are now used by the identity-only game opening; runtime appearance and audio on iPhone remain unverified.

## Approved custom 3D wordmark

`leverage_custom_3d.blend` and `leverage_custom_3d.glb` contain the original geometric, beveled title construction; individual components and their seams are part of this study. Subtitle and tagline use licensed Bebas Neue (`game/assets/fonts/`). Four Blender Cycles renders are `docs/previews/leverage_custom_front.png`, `leverage_custom_three_quarter.png`, `leverage_custom_side.png`, and `leverage_custom_rear.png`. Rebuild with `tools/build_leverage_custom_3d.py` using bpy 4.2 and compatible system libraries.

A separate Godot 4.7.2 headless import found 32 mesh instances and approximately 40,672 triangles. This is structural validation, not runtime appearance or iPhone profiling; component draw calls and geometry need device measurement. The exporter logged unavailable optional Draco; the uncompressed GLB imported successfully.

## Approved 3D icon

`leverage_icon_3d.blend` and `leverage_icon_3d.glb` contain the approved V-and-fulcrum icon and its physical housing. Front, three-quarter, side and rear Cycles views are `docs/previews/leverage_icon_3d_*.png`. Source: `tools/build_leverage_icon_3d.py` and `tools/render_leverage_icon_views.py`. A separate headless Godot import found four meshes and approximately 1,632 triangles. This is not an app-store package, device rendering or small-icon legibility test.

## Approved title-reveal direction

`docs/previews/leverage_approved_title_reveal.mp4` is a four-second **3D-rendered** camera/light pass around the approved lettering with the original synthesized `leverage_title_sting.wav`. Source: `tools/render_approved_title_reveal.py` (bpy 4.2, Pillow/imageio-ffmpeg and system libraries) and `tools/create_leverage_title_sting.py` (Python standard library; no external samples). The review preview is 800×450, 8 rendered frames/second, and uses low-sample Cycles rendering; motion smoothness and mix are **not final**. It has video and audio streams, but has not been auditioned or evaluated in Xogot or on iPhone. This is not an in-game intro.

## Repository hygiene and remaining work

After owner approval of the custom direction, the earlier unapproved stock-font 3D wordmark study and its separate preview files were removed from the current tree to avoid duplicates; they remain recoverable in Git history. The earlier generated 2D concept was removed from the current tree and remains in Git history. No approved asset was replaced. Final motion/audio mix, app-icon sizing and packaging, broader palette application and device verification remain unfinished. The identity-only game opening now instantiates the approved studio, title and icon GLBs and plays their stings; its real-time lighting and animation are an interpretation of the review renders, not a proven visual match. Explicit owner approval is required before beginning the next production stage.

## Approved colour palette

The owner approved the four-second title-reveal direction. Preserve the approved geometry and cinematic direction; this approval does not change the preview's 8 fps/low-sample status into a final mix, real-time sequence or device test.

`leverage_palette_3d.blend` and `docs/previews/leverage_palette_3d.png` present proposed brand colours as actual 3D swatches and extruded labels. `tools/build_leverage_palette_3d.py` reconstructs the Blender scene. These are design tokens, not a mandate to tint every environment; the renderer's lighting and tone mapping change the apparent pixels, so the image is not a color-calibrated proof.

| Token | Hex (sRGB) | RGB | Role |
|---|---|---|---|
| Ink | #10171D | 16, 23, 29 | dark neutral / background |
| Paper | #F0EDE5 | 240, 237, 229 | primary type |
| Steel | #8B9B9B | 139, 155, 155 | structural / metallic neutral |
| Tidal | #8EBAB6 | 142, 186, 182 | information accent |
| Amber | #E0B77E | 224, 183, 126 | objective / warm accent |
| Signal | #E88771 | 232, 135, 113 | warning, with symbol and text |

On an opaque Ink background, calculated sRGB contrast for Paper/Steel/Tidal/Amber/Signal is approximately 15.44/6.25/8.47/9.67/7.00:1 respectively (rounded); these are token comparisons, not evidence of in-game contrast on changing imagery or high-contrast compliance. Reference: https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102. The owner approved the presented palette; faction/district colours, actual game UI application, lighting, accessibility and device verification are not complete.

## Prototype integration

`game/studio_intro_3d.gd` instantiates the approved studio mark, wordmark and icon and plays the original studio and title stings. It reveals Cinder City and the tagline in sequence; the icon appears as a separate 3D object. The opening background uses Ink and a warm light uses Amber; the existing menu uses selected palette tokens. This is an initial application, not a complete UI recolouring or an app-store icon. Headless Godot smoke tests validate structure and transitions, not rendering, sound, performance or iPhone/Xogot behaviour.
