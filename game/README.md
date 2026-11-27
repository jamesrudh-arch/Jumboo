# LEVERAGE: CINDER CITY — identity opening and standalone call test

The owner chose to remove the unapproved prototype. The default project runs a minimal 3D opening using the approved studio mark, LEVERAGE wordmark, separate V/fulcrum icon, palette accents and their synthesized stings. A separate provisional call test scene is included but is not part of that opening. There is **no gameplay, menu, city or save system** in this build. Those will be created through the agreed review and approval process. The studio, title and icon source scenes, multi-angle renders and credits are in `../brand/` and `../docs/previews/`.

## Open in Xogot

Copy this `game` folder, including `project.godot` and `assets`, to the device, open it as a project in Xogot, and allow imports to finish. The official [getting started guide](https://docs.xogot.com/documentation/xogot/getting-started/) describes unzipping and copying projects; [Differences from Godot](https://docs.xogot.com/documentation/xogot/differences/) states that iPhone/iPad logic and add-ons must use GDScript; this build uses GDScript with no compiled extension. The official [Xogot FAQ](https://docs.xogot.com/documentation/xogot/faq/) describes Xogot as Godot 4.4-based; the exact installed Xogot version remains unknown. The [Godot 4.4 format documentation](https://docs.godotengine.org/en/4.4/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html) supports binary glTF (.glb), but that does not verify import or runtime behavior in this particular Xogot installation. Desktop Godot 4.7.2 imported the included binary GLBs; actual Xogot import and compatibility remain unverified.

The real-time lighting, framing and motion are an initial interpretation of the approved offline identity previews. They have not been visually or audibly verified in-engine or on iPhone, nor has device performance been measured. Test on the target devices and report the Xogot/Godot version and any error. This build does not claim to be the finished intro or game.

Fonts used in generating the approved meshes are Bebas Neue and Inter, licensed under SIL OFL; their source and licences are retained in `assets/fonts/`. Brand models and stings originate in `../brand/`.

## Desktop structural test

After importing in Godot 4.7.2, run `godot --headless --path game --script res://tests/identity_smoke.gd`. The test checks the identity scene and sequencing only; it cannot establish visual, audible or device quality.

## Reported grey screen

An owner screenshot shows a grey running view instead of the identity. The cause is not established; Godot 4.7.2 headless tests do not verify compatibility with Xogot or its 4.4-based engine. Capture the Xogot version and the first error from Xogot output/debugger or the floating toolbar console if available. The [Xogot FAQ](https://docs.xogot.com/documentation/xogot/faq/) notes imports can take time without a visible progress indicator; its compressed texture import settings apply to the specific texture errors listed there, not automatically to every grey screen.


## Startup resilience

A pristine copy without an editor import cache reproduced a preload compilation failure in desktop Godot 4.7.2. The opening now loads the imported resources if available or parses the original GLB/WAV files at runtime if they are not yet imported. A missing 3D asset produces an on-screen diagnostic rather than silently continuing. This fixes the reproduced missing-import case in desktop headless tests, but the iPhone grey screen may have a different cause; the updated project still needs Xogot/device testing. The fallback needs the source GLB/WAV files accessible at runtime; if producing an exported package later, include them explicitly or verify the imported-resource path works. Runtime GLB loading can add startup work. The approved designs have not been replaced.

## Godot 4.4 compatibility check

The revised identity ZIP was also checked with a locally compiled Godot 4.4.1 desktop headless build. Nine structural checks passed from a fresh unimported copy and after an editor import. This custom build has no rendering drivers or fontconfig and emitted renderer/fontconfig errors during import, so the checks are not visual/audio verification and do not prove Xogot compatibility or iPhone performance. The owner subsequently reported that the revised opening showed on the phone; audio, exact Xogot/Godot build and performance were not separately verified.

## Provisional 3D call assets (not in the opening yet)

The owner directed proceeding with the existing imperfect work as a game. `assets/intro/provisional_pickup.glb` and `provisional_conversation.glb` are separate exports of the existing table-pickup and connected-call performance studies, with actual skinned meshes and baked 3D animation rather than video. The main scene does not load them and the missing preceding cinematic has not been skipped. They are used by the separate provisional call test documented below; gameplay and the complete opening sequence are not wired in.

The known pickup-to-conversation cut and phone regrip discontinuity are unchanged. The conversation's screen counter is frozen at 00:00 because glTF does not export Blender's visibility animation; the pickup screen likewise does not switch automatically. Its mouth remains an approximate audio-driven deformation from the original offline study, not validated lip sync. The pickup slab is a diagnostic set, not approved environmental design. No assumption of approval or production readiness is implied by these exports.

`tools/export_provisional_call_3d.py` (run from the repository root with Blender Python 4.2) produces both GLBs without modifying the source `.blend` files. The conversation source's 78-frame duration is remapped to 24.3596 seconds; the pickup is 3.6667 seconds. `tools/test_provisional_call_3d.py` reimports each GLB in Blender and compares wrist and phone positions at start, midpoint and end to the original scenes (within 0.1 mm). The test passed locally; it does not establish contact, appearance, animation quality, audio synchronization or Godot compatibility. Export logged a skinned-mesh parent warning. The local headless `bpy` run used temporary no-op display/OpenGL stubs; it is not a GPU, device, or Godot test. A Godot binary download was blocked, so no runtime test or Xogot test was possible in this environment. Verify import, skin deformation, animated mouth, textures, frame timing, memory and performance on the target before wiring these into the game.

## Standalone provisional call test

`provisional_call.tscn` is a separate real-time 3D test using the existing pickup and conversation GLBs. It starts a three-second synthesized ring automatically, plays the pickup, then cuts to the conversation and the approved dialogue audio; no tap is required. It emits `call_completed` after the conversation animation. It is **not connected to `main.tscn`**: the preceding approximately 30-second cinematic is not yet built, and preserving its required order takes precedence over skipping directly from the title to this call. There is no warehouse/city transition or gameplay. In Xogot, open the project and run `provisional_call.tscn` as a separate scene to examine the test; the normal run still opens the identity.

The scene has a known abrupt pose/phone regrip discontinuity at the cut. The phone screen in each GLB is static: there is no functioning answer transition, elapsed-time update, vibration, or glow animation. The visible table is the pickup diagnostic slab, not an approved environment. The reaction animation and mouth remain provisional. Loading both models can be expensive; camera, lighting, materials, skinning, audio mix, screen readability and performance have not been visually or audibly verified in Godot or on an iPhone. This test is not the finished cinematic.

The dialogue WAV is a byte-identical copy of the approved `brand/intro/call_audio/first_call_preview.wav` (SHA-256 `a41df0925c411629c0825736ab089f6b5cbb2631dc50c3655253fac82b234f41`). `tools/build_runtime_ring.py` reproduces the original incoming-call study's synthesized ring (SHA-256 `b682cbb0c910d8e373b01fa014e66ce67facdbfd7c7dfcfc08ce8c2c2123b9fd`). Both GLBs are loaded as imported scenes when available, with runtime GLB/WAV fallbacks for a fresh project. Exported packages must include source files if relying on fallback.

A locally compiled Godot 4.4.1 **headless template** ran `godot --headless --path game --script res://tests/provisional_call_smoke.gd`: ten checks passed for loading, timing, automatic transitions and completion. The existing nine-check identity smoke test also passed. The build had no rendering drivers, reported `No renderers available` and lacked a global script cache; it cannot verify pictures, sound, mobile performance or Xogot compatibility. The call test reported an ObjectDB leak warning on exit, which remains to be investigated. Actual Xogot/device testing is still required.
