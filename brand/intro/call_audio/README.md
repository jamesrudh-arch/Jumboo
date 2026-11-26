# First call — approved dialogue preview

`first_call_preview.wav` assembles separately synthesized speech lines into a proposed conversation. The owner selected the two voices in the voice auditions and subsequently approved the presented dialogue and assembled performances. The brother is intentionally unnamed. This is approval of the audio preview, not a finished cinematic or phone interaction.

**Marcus:** Hey. You all right?

**Brother:** Marcus, listen to me. I think someone's following me.

**Marcus:** Where are you?

**Brother:** I don't know. I thought I lost them, but they're here. Marcus, don't come looking for me.

**Marcus:** What? Tell me what you can see. I'll come get you.

**Brother:** Wait. Someone's at the door. I have to go.

**Marcus:** No, wait. Stay on the line. Hello?

The separate WAVs are synthesized speech (Marcus voice-05, brother voice-06 in the Arena session), with no human acting claim. `python3 tools/assemble_call_preview.py` joins them, resampling the brother's 24 kHz mono clips to 44.1 kHz and inserting short silent pauses. The preview contains **no ringing, vibration, phone filtering, music, pickup animation or call UI**. It has not been tested in Godot, Xogot or on an iPhone, and is not integrated in the game. Implementation, sound design, scene timing and technical QA remain pending. The planned call still requires automatic presentation and pickup, visible caller details, ringing, vibration and glow, without mandatory text or tapping.
