# LEVERAGE: CINDER CITY — M01 blockout

This is an **early, temporary vertical-slice blockout**, not final art or a complete game. It uses simple generated shapes so the first story interaction can be evaluated before a licensed character/animation pipeline is ready. It does not satisfy the final-quality vertical-slice acceptance gate.

## Open

Open this folder as a Godot 4.7 project, or import the folder into Xogot on iPhone. The exact installed Xogot/Godot version, renderer support and iPhone import workflow have not been verified for this project. The main scene is `main.tscn`.

## What is included

- A simple third-person camera and temporary street/character geometry.
- A written incoming call with answer and decline paths.
- Touch-direction buttons and an interact button; desktop keyboard movement uses WASD or arrow keys, with Enter/Space to interact.
- Two Sade dialogue choices, a lead and a small local JSON save that remembers the choice. New game and continue are available from the title screen.

## Important limitations

- No cinematic, voice, combat, driving, crowds, phone history UI, full mission or later consequences yet.
- Touch layout is a fixed 1280 × 720 blockout and is **not yet safe-area, screen-size or accessibility validated**. It uses directional buttons rather than the specified virtual joystick and camera drag. These are temporary test controls, not an approved final layout.
- Save data has basic format checking only. It overwrites its file directly and does **not** yet have atomic writes, backups, recovery, migration or interruption-safety; do not rely on it for valuable progress.
- The street has simple movement boundaries, not proper world collisions or navigation.
- This project has not yet been run in the Godot editor or on an iPhone, and no performance claims are made. The GDScript was parsed using gdtoolkit; that does not substitute for engine validation.
- Full pre-production deliverables, asset licensing and the complete vertical-slice quality gate remain outstanding.
