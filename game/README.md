# LEVERAGE: CINDER CITY — M01 work in progress

This is a **partial, experimental build**, not the finished game, cinematic, or final-quality vertical slice. The owner has not accepted its art direction or quality. The character and prop assets are CC0 stock assets used temporarily; they are not the original Marcus, final clothing, or the finished city.

## Open on iPhone

Unzip the project into a fresh folder and import the folder containing `project.godot` into Xogot. Wait for assets to import. Opening an older project copy will not update it. The main scene is `main.tscn`. This project was tested with Godot 4.7.2 headless on Linux; the installed Xogot version, import, rendering, and operation on iPhone are **not verified**.

## Current contents

- The opening uses extruded 3D text and a concentric-ring emblem for the D’YOUNGS GAMES studio mark, followed by LEVERAGE and CINDER CITY reveals, with moving lighting and a synthesized ident sound. The later menu still uses a generated city image.
- New game opens on a 3D workshop and ringing phone showing Eli's name. Marcus answers automatically; there is no call-choice page or tap-to-advance call dialogue. The pickup uses a stock clip, custom arm keys and a hand-relative phone attachment; the 3D shot continues during the voiced call. Cinematic subtitles are off by default, with an optional toggle on the title menu. Skip requires confirmation. No physical-device haptic is implemented.
- The menu and opening use licensed CC0 music, switching to a tension cue at the broken call; music is ducked during voiced lines. Pickup, engine cutoff and disconnect have synthetic effects. See `assets/audio/README.md` for music credits, sources and limitations. The tracks are licensed stock, not an original commissioned score; the voice performances are AI-generated.
- The player and witness now use an interim rigged stock human body and clothing instead of capsules, with idle/walk animation on the player. The exact look, proportions, animation and mobile performance still require visual review. See `assets/characters/README.md` for provenance.
- The prototype district now includes distinct open-front 3D storefronts, a warehouse checkpoint, streetlights and a distant harbor with a freighter, cranes and skyline. See `assets/props/README.md` for CC0 props. Interiors are open cutaways without collision; the harbor is a non-navigable backdrop. Art and performance are not final or visually verified.
- After the call, gameplay starts inside a warehouse hideout. Speak to Sade, inspect a 3D damaged van and confront a collector. The collector can be bargained with, avoided, or fought; the selected outcome is saved and changes Tessa's voiced response. The bargain records a delivery obligation, but fulfilling it is not implemented. Desktop movement uses WASD or arrow keys, Enter/Space to interact, J to strike and K to guard; touch buttons provide the same actions.
- Combat is an early one-opponent prototype: visible attack warning, movement, timed guard, strikes, health and retry/withdraw on defeat. The van and street use temporary procedural geometry; no polished or physically realistic fighting is claimed.

## Limitations

- The Marcus phone performance combines a stock pickup with custom pose keys, a rigid hand attachment and subtle head movement. It is not a final character performance: hand contact, phone-to-ear placement and believability are unverified, and there is no facial acting or lip sync. The workshop and Marcus model remain provisional. The call, Tessa's later lines, witness encounter and collector confrontation have AI-generated voices; descriptions and incidental text remain unvoiced. The revised mix and performances have not been reviewed in-engine or on a phone.
- The street and van are not polished final art, and the stock fantasy clothing is only recolored, not final contemporary costume art. Combat is a basic prototype, and there is no driving, crowd simulation or finished campaign. The collector's delivery obligation and Sade's trust do not yet have later gameplay consequences.
- Touch layout is fixed at 1280 × 720 and is not safe-area, screen-size or accessibility validated. It uses arrows rather than the intended virtual joystick and camera drag.
- Save data is a basic direct JSON overwrite without atomic writes, backup or recovery. Do not rely on it for valuable progress.
- An automated **headless** smoke test passed in Godot 4.7.2 on Linux, including title/skip/call transitions and animation playback. Headless testing does not verify actual appearance, audio quality, touch usability, frame rate, Xogot compatibility or physical-device behaviour. No screenshot is claimed.

## Test on a desktop with Godot 4.7.2

Import the project in the Godot editor once, then run `godot --headless --path game --script res://tests/smoke.gd` from the repository root. Tests cover a narrow set of transitions, not acceptance of the full game.

## Other licensing

Oswald and Bebas Neue fonts are distributed under the SIL Open Font License; see `assets/fonts/OFL.txt` and `assets/fonts/BebasNeue-OFL.txt`. `assets/opening_city.png` is AI-generated temporary presentation art. The phone vibration is a procedurally synthesized test sound created for this project.

### Controls and district navigation (WIP)
Left stick / WASD moves relative to the camera. Right stick / Q and E rotates it. X / J punches, Y / L heavy-strikes, A / I kicks, B / K dodges in combat; B / Enter interacts outside combat. X advances a single dialogue option; controller View / M toggles the district map. Touch: left analog stick, right-side drag to look, and action buttons. The map shows the current playable block and a straight-line bearing to the objective, not turn-by-turn routing. Real controller, multitouch and safe-area behaviour still require testing on your iPhone/Xogot; see AUDIT.md.

### Opening troubleshooting
If the call appears stuck or silent in Xogot, allow imports to complete, check device volume and the Xogot debugger, and record the Xogot/Godot version and exact error if available. Captions can be enabled in the title menu for diagnosis; the intended call still advances automatically. The current fallback prevents a missing voice file from stopping progression, but device playback and the reported hang have not been verified fixed. The title background is original AI-generated 2D key art, not footage of the game.

The title menu has an optional vibration toggle. Phone buzzes and combat impacts request handheld vibration or controller rumble; actual behavior depends on hardware, iOS settings and Xogot and has not been device-tested. The new 2K wood and concrete material maps are credited in `assets/materials/README.md`; they are an early physical-material pass, not the finished realistic world.

The opening phone now sits on a real-scale textured table model; a textured modular factory facade and 2K asphalt are part of the 3D district. These are early steps toward the grounded reference image, not a completed realistic city or character. Asset provenance is in `assets/realistic/README.md` and `assets/materials/README.md`. Import may take longer because the original 2K assets are included.

This build requests the iOS Playback audio category (so it may play when the silent switch is on) and offers a Sound toggle on the title screen. Xogot embedded playback and the reported missing voices still need a real-device test. Textured Rocketbox-derived character models and a detailed passenger van are interim assets; see their asset folders and AUDIT.md for licenses and remaining limitations.

Movement now uses character physics against selected warehouse/shop walls and the van, and the camera checks those obstacles. Collision is still incomplete throughout the district; see `AUDIT.md`.

The smoke suite uses `user://leverage_smoke_test/` rather than the player's save slots; files with the test slot names in that dedicated directory are cleared when the suite starts. Lifecycle pause behavior has only been simulated in headless Godot, not verified in Xogot on iPhone.
