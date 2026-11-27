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

## Experimental speech-informed mouth timing (not approved lip sync)

`marcus_viseme_candidates.json` contains preliminary Rhubarb mouth-shape cues derived separately from the four approved Marcus WAVs using the corresponding transcript. This is an experiment toward improving on the existing amplitude-only mouth, **not** a phoneme ground truth, finished facial rig, visual result, or an animation used by the game. Rhubarb's shape labels are intended for a stylized 2D mouth; Marcus has no native viseme shapes. The timing and shapes have not been manually checked against the audio or adapted to his face. Do not drive the provisional mouth patch with these labels and call it realistic lip sync without creating an appropriate facial rig and reviewing coarticulation, diction, emotion and rendered results.

The extraction uses Rhubarb Lip Sync 1.13.0, PocketSphinx recognizer with dialogue text and one thread. Rhubarb's [license](https://github.com/DanielSWolf/rhubarb-lip-sync/blob/v1.13.0/LICENSE.md) identifies its code as MIT and lists its dependencies' terms; it states output created by processing audio belongs to the operator. The executable used was contained in the third-party npm package `rhubarb-lip-sync@0.0.1-alfa-3`, not independently verified against an official release binary. Its SHA-256 is `03e82c9c76c4e691a058f38a9cf7e75331e2f3c31a9c1fab90c00944b3ef7dc2`; the downloaded npm tarball SHA-256 is `d797623611a61b7e0c7f2c2e6f4c5c79eec2325f4447c6aaebb037083c082239`. The binary and models are not included in the repository. A direct official 1.14.0 release download was blocked in this environment, so the executable's provenance remains a limitation and must be independently verified before wider use.

Rebuild with Python 3.11 and the exact investigated binary and resource directory: `python3 tools/extract_call_viseme_candidates.py --rhubarb /path/to/rhubarb --output brand/intro/call_audio/marcus_viseme_candidates.json`. The script reproduces the assembly's sample-level resampling and pauses and refuses to emit cues if the reconstructed PCM differs from `first_call_preview.wav`. Cue times are local to each line; add `mix_start_sample / mix_rate_hz` for the mix timeline. Brother segments have no Marcus cues. Two independent runs produced byte-identical JSON and all cues passed bounds and ordering checks. Those checks do **not** establish recognition accuracy, visible speech quality, or absence of motion during a listener's line in any runtime. Python's `audioop` is deprecated and removed in 3.13; this experiment uses it to match the existing Python 3.11 assembler exactly.

## Dialogue timing data

`dialogue_timeline.json` records sample-accurate boundaries for the seven approved speech clips and their existing pauses in `first_call_preview.wav`. It is infrastructure for later editing and runtime integration, not a change to the conversation, a completed scene, pickup, lip sync or game feature. The builder reconstructs the mix using the original assembler's resampling and refuses to emit a timeline if its PCM differs from the approved mix. Each event stores a source-file SHA-256 and uses an exclusive `end_sample`; `pause_end_sample` is the next line's start. The timing does not establish word-level alignment or dictate how Marcus should react.

Rebuild with Python 3.11 or 3.12: `python3 tools/build_call_timeline.py --output brand/intro/call_audio/dialogue_timeline.json`. Run `python3 tools/test_build_call_timeline.py` to check line order, contiguous pause boundaries, alignment with the experimental cue file and rejection of a modified mix. Those checks do not validate speech performance, visual sync or playback on Xogot.
