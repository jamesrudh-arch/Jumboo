# LEVERAGE game identity — production register

The owner explicitly approved the **custom 3D wordmark** and subsequently approved the **3D V/fulcrum icon**. Preserve both designs; approval of the separate title-reveal preview below has not yet been given. No design has been integrated into the game.

## Approved custom 3D wordmark

`leverage_custom_3d.blend` and `leverage_custom_3d.glb` contain the original geometric, beveled title construction; individual components and their seams are part of this study. Subtitle and tagline use licensed Bebas Neue (`game/assets/fonts/`). Four Blender Cycles renders are `docs/previews/leverage_custom_front.png`, `leverage_custom_three_quarter.png`, `leverage_custom_side.png`, and `leverage_custom_rear.png`. Rebuild with `tools/build_leverage_custom_3d.py` using bpy 4.2 and compatible system libraries.

A separate Godot 4.7.2 headless import found 32 mesh instances and approximately 40,672 triangles. This is structural validation, not runtime appearance or iPhone profiling; component draw calls and geometry need device measurement. The exporter logged unavailable optional Draco; the uncompressed GLB imported successfully.

## Approved 3D icon

`leverage_icon_3d.blend` and `leverage_icon_3d.glb` contain the approved V-and-fulcrum icon and its physical housing. Front, three-quarter, side and rear Cycles views are `docs/previews/leverage_icon_3d_*.png`. Source: `tools/build_leverage_icon_3d.py` and `tools/render_leverage_icon_views.py`. A separate headless Godot import found four meshes and approximately 1,632 triangles. This is not an app-store package, device rendering or small-icon legibility test.

## Title reveal — awaiting review

`docs/previews/leverage_approved_title_reveal.mp4` is a four-second **3D-rendered** camera/light pass around the approved lettering with the original synthesized `leverage_title_sting.wav`. Source: `tools/render_approved_title_reveal.py` (bpy 4.2, Pillow/imageio-ffmpeg and system libraries) and `tools/create_leverage_title_sting.py` (Python standard library; no external samples). The review preview is 800×450, 8 rendered frames/second, and uses low-sample Cycles rendering; motion smoothness and mix are **not final**. It has video and audio streams, but has not been auditioned or evaluated in Xogot or on iPhone. This is not an in-game intro.

## Repository hygiene and remaining work

After owner approval of the custom direction, the earlier unapproved stock-font 3D wordmark study and its separate preview files were removed from the current tree to avoid duplicates; they remain recoverable in Git history. The earlier selected generated concept remains at `docs/previews/leverage_identity_concept.png` for reference and is not a 3D model. No approved asset was replaced. Final motion/audio mix, app-icon sizing and packaging, complete stage-2 colour/identity system, real-time implementation and device verification remain unfinished. Explicit owner approval is required before beginning the next production stage.
