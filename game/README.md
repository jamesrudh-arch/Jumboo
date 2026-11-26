# LEVERAGE: CINDER CITY — identity-only build

The owner chose to remove the unapproved prototype. This project now contains only a minimal 3D opening using the approved studio mark, LEVERAGE wordmark, separate V/fulcrum icon, palette accents and their synthesized stings. There is **no gameplay, menu, story scene, character, city or save system** in this build. Those will be created through the agreed review and approval process. The studio, title and icon source scenes, multi-angle renders and credits are in `../brand/` and `../docs/previews/`.

## Open in Xogot

Copy this `game` folder, including `project.godot` and `assets`, to the device, open it as a project in Xogot, and allow imports to finish. The official [getting started guide](https://docs.xogot.com/documentation/xogot/getting-started/) describes unzipping and copying projects; [Differences from Godot](https://docs.xogot.com/documentation/xogot/differences/) states that iPhone/iPad logic and add-ons must use GDScript; this build uses GDScript with no compiled extension. The [asset guide](https://docs.xogot.com/documentation/xogot/importing-assets/) describes glTF and OBJ but does not explicitly confirm GLB support in the installed Xogot version. Desktop Godot imports the included binary GLBs; actual Xogot import and compatibility remain unverified.

The real-time lighting, framing and motion are an initial interpretation of the approved offline identity previews. They have not been visually or audibly verified in-engine or on iPhone, nor has device performance been measured. Test on the target devices and report the Xogot/Godot version and any error. This build does not claim to be the finished intro or game.

Fonts used in generating the approved meshes are Bebas Neue and Inter, licensed under SIL OFL; their source and licences are retained in `assets/fonts/`. Brand models and stings originate in `../brand/`.

## Desktop structural test

After importing in Godot 4.7.2, run `godot --headless --path game --script res://tests/identity_smoke.gd`. The test checks the identity scene and sequencing only; it cannot establish visual, audible or device quality.
