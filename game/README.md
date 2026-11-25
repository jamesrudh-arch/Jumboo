# LEVERAGE: CINDER CITY — M01 work in progress

This is a **partial, experimental build**, not the finished game, cinematic, or final-quality vertical slice. The owner has not accepted its art direction or quality. The character and prop assets are CC0 stock assets used temporarily; they are not the original Marcus, final clothing, or the finished city.

## Open on iPhone

Unzip the project into a fresh folder and import the folder containing `project.godot` into Xogot. Wait for assets to import. Opening an older project copy will not update it. The main scene is `main.tscn`. This project was tested with Godot 4.7.2 headless on Linux; the installed Xogot version, import, rendering, and operation on iPhone are **not verified**.

## Current contents

- The opening uses extruded 3D text and a concentric-ring emblem for the D’YOUNGS GAMES studio mark, followed by LEVERAGE and CINDER CITY reveals, with moving lighting and a synthesized ident sound. The later menu still uses a generated city image.
- New game opens on a 3D workshop with an interim Marcus rig, moving camera, practical lighting and synthesized room hum, followed by the 3D ringing phone shot. Answering uses a stock pickup clip with custom arm pose keys and a hand-relative phone attachment. The 3D shot stays visible during the voiced call, with speaker-responsive head motion and lower-screen subtitles. Skip requires confirmation; X advances single dialogue beats without choosing an option. No physical-device haptic is implemented.
- The menu and opening use licensed CC0 music, switching to a tension cue at the broken call; music is ducked during voiced lines. Pickup, engine cutoff and disconnect have synthetic effects. See `assets/audio/README.md` for music credits, sources and limitations. The tracks are licensed stock, not an original commissioned score; the voice performances are AI-generated.
- The player and witness now use an interim rigged stock human body and clothing instead of capsules, with idle/walk animation on the player. The exact look, proportions, animation and mobile performance still require visual review. See `assets/characters/README.md` for provenance.
- Temporary CC0 props dress the street; see `assets/props/README.md`. The buildings, camera, controls and much of the world remain blockout quality.
- Answer or decline the call, speak to Sade, inspect a 3D damaged van and confront a collector. The collector can be bargained with, avoided, or fought; the selected outcome is saved and changes Tessa's voiced response. The bargain records a delivery obligation, but fulfilling it is not implemented. Desktop movement uses WASD or arrow keys, Enter/Space to interact, J to strike and K to guard; touch buttons provide the same actions.
- Combat is an early one-opponent prototype: visible attack warning, movement, timed guard, strikes, health and retry/withdraw on defeat. The van and street use temporary procedural geometry; no polished or physically realistic fighting is claimed.

## Limitations

- The Marcus phone performance combines a stock pickup with custom pose keys, a rigid hand attachment and subtle head movement. It is not a final character performance: hand contact, phone-to-ear placement and believability are unverified, and there is no facial acting or lip sync. The workshop and Marcus model remain provisional. The call, Tessa's lines, witness encounter and collector confrontation have AI-generated voices; descriptions and incidental text remain unvoiced. The performances and audio mix have not been reviewed in-engine or on a phone.
- The street and van are not polished final art, and the stock fantasy clothing is only recolored, not final contemporary costume art. Combat is a basic prototype, and there is no driving, crowd simulation or finished campaign. The collector's delivery obligation and Sade's trust do not yet have later gameplay consequences.
- Touch layout is fixed at 1280 × 720 and is not safe-area, screen-size or accessibility validated. It uses arrows rather than the intended virtual joystick and camera drag.
- Save data is a basic direct JSON overwrite without atomic writes, backup or recovery. Do not rely on it for valuable progress.
- An automated **headless** smoke test passed in Godot 4.7.2 on Linux, including title/skip/call transitions and animation playback. Headless testing does not verify actual appearance, audio quality, touch usability, frame rate, Xogot compatibility or physical-device behaviour. No screenshot is claimed.

## Test on a desktop with Godot 4.7.2

Import the project in the Godot editor once, then run `godot --headless --path game --script res://tests/smoke.gd` from the repository root. Tests cover a narrow set of transitions, not acceptance of the full game.

## Other licensing

Oswald font is distributed under the SIL Open Font License; `assets/fonts/OFL.txt` contains the license. `assets/opening_city.png` is AI-generated temporary presentation art. The phone vibration is a procedurally synthesized test sound created for this project.
