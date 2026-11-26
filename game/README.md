# LEVERAGE: CINDER CITY — identity-only build

The owner chose to remove the unapproved prototype. This project now contains only a minimal 3D opening using the approved studio mark, LEVERAGE wordmark, separate V/fulcrum icon, palette accents and their synthesized stings. There is **no gameplay, menu, story scene, character, city or save system** in this build. Those will be created through the agreed review and approval process. The studio, title and icon source scenes, multi-angle renders and credits are in `../brand/` and `../docs/previews/`.

## Open in Xogot

Copy this `game` folder, including `project.godot` and `assets`, to the device, open it as a project in Xogot, and allow imports to finish. The official [getting started guide](https://docs.xogot.com/documentation/xogot/getting-started/) describes unzipping and copying projects; [Differences from Godot](https://docs.xogot.com/documentation/xogot/differences/) states that iPhone/iPad logic and add-ons must use GDScript; this build uses GDScript with no compiled extension. The official [Xogot FAQ](https://docs.xogot.com/documentation/xogot/faq/) describes Xogot as Godot 4.4-based; the exact installed Xogot version remains unknown. The [Godot 4.4 format documentation](https://docs.godotengine.org/en/4.4/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html) supports binary glTF (.glb), but that does not verify import or runtime behavior in this particular Xogot installation. Desktop Godot 4.7.2 imported the included binary GLBs; actual Xogot import and compatibility remain unverified.

The real-time lighting, framing and motion are an initial interpretation of the approved offline identity previews. They have not been visually or audibly verified in-engine or on iPhone, nor has device performance been measured. Test on the target devices and report the Xogot/Godot version and any error. This build does not claim to be the finished intro or game.

Fonts used in generating the approved meshes are Bebas Neue and Inter, licensed under SIL OFL; their source and licences are retained in `assets/fonts/`. Brand models and stings originate in `../brand/`.

## Desktop structural test

After importing in Godot 4.7.2, run `godot --headless --path game --script res://tests/identity_smoke.gd`. The test checks the identity scene and sequencing only; it cannot establish visual, audible or device quality.

## Reported grey screen

An owner screenshot shows a grey running view instead of the identity. The cause is not established; Godot 4.7.2 headless tests do not verify compatibility with Xogot or its 4.4-based engine. Capture the Xogot version and the first error from Xogot output/debugger or the floating toolbar console if available. The [Xogot FAQ](https://docs.xogot.com/documentation/xogot/faq/) notes imports can take time without a visible progress indicator; its compressed texture import settings apply to the specific texture errors listed there, not automatically to every grey screen.
