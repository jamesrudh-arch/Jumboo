# Opening audio credits and provenance

This build uses **temporary licensed score**, not music composed exclusively for LEVERAGE. It is included as a practical first audio pass, not a final mix.

- `prologue_theme.ogg`: **Prologue Theme** by Cleyton Kauffman, CC0 1.0. Original: https://opengameart.org/content/prologue-theme ; artist: https://soundcloud.com/cleytonkauffman/ . The included Ogg conversion came from https://github.com/mattyan1053/pj-legion/tree/a19c2b849295d5e42b459584b777c5d85d8a06a9/assets/audio/oga-bgm-sets ; that mirror reports conversion from WAV to Ogg Vorbis and removal of metadata.
- `confrontation.ogg`: **The Confrontation** by Umplix, CC0 1.0. Original: https://opengameart.org/content/the-confrontation ; artist: https://opengameart.org/users/umplix . Included Ogg came from https://github.com/mattyan1053/pj-legion/tree/a19c2b849295d5e42b459584b777c5d85d8a06a9/assets/audio/oga-talk ; mirror reports conversion from WAV to Ogg Vorbis, metadata removal and silence trimming.
- CC0 text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- `engine_cut.wav`, `call_lost.wav`, and `phone_pickup.wav` are original synthetic effects generated for this project with `tools/create_opening_sfx.py` in the source repository. They are stylized effects, not field recordings.
- Existing `phone_vibration.wav` and `studio_ident.wav` were procedurally synthesized for the prototype. Workshop ambience is generated at runtime.

## Dialogue

The files in `../voice/` are AI-synthesized spoken performances selected for Marcus, Eli, Tessa and Sade in this session. The answered call, Tessa's missed-call line and Sade's witness encounter are voiced. Narrative descriptions and incidental gameplay text are not spoken. The performances are preliminary; voice direction, editing, sound mix, phone processing and listening/device review remain outstanding.

## Design references

The intended hierarchy is score, environmental texture, effects and clear speech; music is manually ducked under voice and returns afterwards. This applies general game-audio techniques, not copied recordings or scores: https://blog.playstation.com/archive/2019/12/05/how-sound-designer-takafumi-fujisawa-created-the-original-playstations-iconic-startup-sound ; https://egmatic.com/blog/game-audio-sound-design-guide ; https://blog.playstation.com/2025/07/21/the-secrets-behind-final-fantasy-tactics-the-ivalice-chronicles-makeover/ . The result has not been audibly auditioned in the engine or on iPhone.
