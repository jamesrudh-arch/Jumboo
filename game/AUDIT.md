# Build audit — 25 November 2026

**Status: experimental prototype, not a finished game or a release candidate.** This project does not meet the master bible's final-game acceptance criteria.

## Comparison with the brief

- Opening: extruded 3D studio and title text, a dimensional ring emblem and a timed 3D workshop prologue exist. Their visual quality and cinematic impact have not been assessed in a rendered run. This is not a finished CAD-quality logo or a finished story cinematic.
- Phone: the answer path combines a stock-rig pickup with custom arm pose keys and a hand-relative phone attachment; the 3D shot continues during the voiced call. It is still a provisional performance: hand contact, framing, phone-to-ear placement and believability are not visually verified; facial performance and lip sync are not implemented.
- Character and city: temporary stock rigged character, imported props and simple blockout buildings. They are not final character or world art.
- Audio: the call, Tessa's lines, witness encounter and collector confrontation have AI-synthesized voices, licensed stock music and synthetic effects. Descriptions and incidental text remain unvoiced; the mix and performances have not been reviewed in-engine or on iPhone.
- Play: the short prototype continues from the witness to a 3D van and a collector encounter with a confirmed bargain, withdrawal, or basic timed combat. The saved outcome changes Tessa's immediate response. Fulfilling the bargain, later Sade consequences, driving and a 60-minute campaign are not implemented. The named dialogue and characters are proposed, not established canon.
- Mobile: touch controls are preliminary, not validated for safe areas or accessibility. Xogot, iPhone 16 and iPhone 13 mini operation, performance and compatibility have not been tested.

## Verification

Godot 4.7.2 Linux headless can import the project and run the automated smoke script (`godot --headless --path . --script res://tests/smoke.gd`). The tests cover scene construction, extruded mesh creation, timing and skipping, phone scene transition, character animation clips, witness interaction, and movement after the slice. They do not render pixels or test a real phone. Headless uses a dummy display driver, not a graphical rendering check: https://docs.godotengine.org/en/stable/classes/class_displayserver.html

Research references and original creative proposals are in the repository's `docs/LEVERAGE_worldwide_creative_research.md`. Relevant technical guidance: Godot's TextMesh creates 3D text geometry (https://docs.godotengine.org/en/stable/tutorials/3d/3d_text.html); Godot recommends measuring 3D performance on target hardware (https://docs.godotengine.org/en/stable/tutorials/performance/optimizing_3d_performance.html). Neither proves this prototype meets the visual or performance brief.

## Audit fixes

The witness now has a name marker matching the objective, entering dialogue stops the walk animation, and movement remains available after finishing the interaction. These are usability fixes, not completion of the game.
