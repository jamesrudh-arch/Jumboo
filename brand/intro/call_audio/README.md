# First call — dialogue audition, not approved

`first_call_preview.wav` assembles separately synthesized speech lines into a proposed conversation. The owner selected the two voices in the voice auditions; the assembled script and performance have **not** been approved. The brother is intentionally unnamed. Dialogue is a proposal, not established canon. The words and voices are provided for review, not presented as a finished cinematic or phone interaction.

**Marcus:** Hey. You all right?

**Brother:** Marcus, listen to me. I think someone's following me.

**Marcus:** Where are you?

**Brother:** I don't know. I thought I lost them, but they're here. Marcus, don't come looking for me.

**Marcus:** What? Tell me what you can see. I'll come get you.

**Brother:** Wait. Someone's at the door. I have to go.

**Marcus:** No, wait. Stay on the line. Hello?

The separate WAVs are synthesized speech (Marcus voice-05, brother voice-06 in the Arena session), with no human acting claim. `python3 tools/assemble_call_preview.py` joins them, resampling the brother's 24 kHz mono clips to 44.1 kHz and inserting short silent pauses. The preview contains **no ringing, vibration, phone filtering, music, pickup animation or call UI**. It has not been tested in Godot, Xogot or on an iPhone, and is not integrated in the game. Audio quality, naturalistic performance, pacing and story continuity remain for owner review. The planned call still requires automatic presentation and pickup, visible caller details, ringing, vibration and glow, without mandatory text or tapping.
