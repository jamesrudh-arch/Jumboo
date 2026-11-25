# LEVERAGE: CINDER CITY — M01 work in progress

This is a **partial, experimental build**, not the finished game, cinematic, or final-quality vertical slice. The owner has not accepted its art direction or quality. The character and prop assets are CC0 stock assets used temporarily; they are not the original Marcus, final clothing, or the finished city.

## Open on iPhone

Unzip the project into a fresh folder and import the folder containing `project.godot` into Xogot. Wait for assets to import. Opening an older project copy will not update it. The main scene is `main.tscn`. This project was tested with Godot 4.7.2 headless on Linux; the installed Xogot version, import, rendering, and operation on iPhone are **not verified**.

## Current contents

- The opening uses extruded 3D text and a concentric-ring emblem for the D’YOUNGS GAMES studio mark, followed by LEVERAGE and CINDER CITY reveals, with moving lighting and a synthesized ident sound. The later menu still uses a generated city image.
- New game now opens on a 3D workshop with an interim Marcus rig, moving camera, practical lighting and synthesized room hum, before the existing 3D ringing phone shot. Answering starts an experimental rigged pickup and procedural arm reach, then a paced written call. Skip requires confirmation; X advances single dialogue beats without choosing an option. No physical-device haptic is implemented. Appearance, audio and iPhone performance are unverified.
- The player and witness now use an interim rigged stock human body and clothing instead of capsules, with idle/walk animation on the player. The exact look, proportions, animation and mobile performance still require visual review. See `assets/characters/README.md` for provenance.
- Temporary CC0 props dress the street; see `assets/props/README.md`. The buildings, camera, controls and much of the world remain blockout quality.
- Written incoming call with answer/decline paths, touch arrows and interaction, a witness choice and basic JSON save. Desktop movement uses WASD or arrow keys, with Enter/Space to interact.

## Limitations

- **The requested authored Marcus performance does not exist yet:** the pickup and arm reach are procedural experiments using stock animation; contact, phone-to-ear placement and visual believability are unverified. There is no facial acting, voice acting or complete workshop scene. The incoming call is still a text dialog.
- The street is not a polished city, and the stock fantasy clothing is only recolored, not final contemporary costume art. There is no combat, driving, crowd simulation or finished campaign.
- Touch layout is fixed at 1280 × 720 and is not safe-area, screen-size or accessibility validated. It uses arrows rather than the intended virtual joystick and camera drag.
- Save data is a basic direct JSON overwrite without atomic writes, backup or recovery. Do not rely on it for valuable progress.
- An automated **headless** smoke test passed in Godot 4.7.2 on Linux, including title/skip/call transitions and animation playback. Headless testing does not verify actual appearance, audio quality, touch usability, frame rate, Xogot compatibility or physical-device behaviour. No screenshot is claimed.

## Test on a desktop with Godot 4.7.2

Import the project in the Godot editor once, then run `godot --headless --path game --script res://tests/smoke.gd` from the repository root. Tests cover a narrow set of transitions, not acceptance of the full game.

## Other licensing

Oswald font is distributed under the SIL Open Font License; `assets/fonts/OFL.txt` contains the license. `assets/opening_city.png` is AI-generated temporary presentation art. The phone vibration is a procedurally synthesized test sound created for this project.
