# Identity production 01 — concepts and specimen

**Status:** exploratory assets, not approved final trademarks or a game screenshot. The owner compared two generated options for each identity and selected the images saved here; selection is not a final legal, design or in-engine approval. Preserve the established D’YOUNGS GAMES, LEVERAGE: CINDER CITY and “EVERYONE HAS LEVERAGE ON YOU.” wording. Specific Sade/Eli details in the specimen are existing provisional story choices, not newly established canon.

## Assets and decisions

- `previews/studio_identity_concept.png`: selected interlocking D/Y, warm metal studio concept. Recommend its interlock and controlled lighting, not a literal raster as the production logo. It requires vector construction, small-size and monochrome tests, trademark clearance, 3D modelling and animated/audio production.
- `previews/leverage_identity_concept.png`: selected metallic wordmark. Its pressure/fulcrum motif is an interesting theme, but the mechanical V and cracked finish risk suggesting science fiction or fantasy rather than a contemporary crime drama; refine lettering and simplify the mechanism before committing. The raster cannot supply clean scalable letter paths, an app icon, or a 3D asset. Trademark review remains necessary.
- `previews/brand_typography_colour_specimen.png`: reproducibly rendered type/palette exploration, **not a Godot image**; `tools/render_brand_specimen.py` requires Pillow and uses the font files in `game/assets/fonts`.

Bebas Neue is a temporary display test, Oswald a secondary title/menu test, and Inter a proposed readable interface/dialogue family. The concept wordmark is bespoke in appearance; Bebas is **not** the finished logo. Test glyph coverage against actual supported languages and font rendering, sizing, layout and screen distance on device; do not extrapolate the specimen to certification. The current game has not been redesigned to use this proposed system.

### Proposed base colours

| Token | Hex | RGB | Intended use |
|---|---|---|---|
| Ink | #10171D | 16, 23, 29 | dark interface ground |
| Paper | #F0EDE5 | 240, 237, 229 | primary text |
| Tidal | #8EBAB6 | 142, 186, 182 | information |
| Amber | #E0B77E | 224, 183, 126 | objective and warmth |
| Signal | #E88771 | 232, 135, 113 | warnings, paired with icon/text |

Specimen computes contrast for each opaque colour against Ink only. These ratios do not guarantee contrast over a moving scene, opacity blends, other UI surfaces or at small sizes. Use solid/adjustable backplates and non-colour cues; assess actual pixels and accessibility settings in-game. Xbox's guidance recommends 4.5:1 for standard text, 3:1 for large elements, and 7:1 in high-contrast mode, with colour not the sole carrier of meaning: https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102. Godot supports imported dynamic fonts and variable fonts; font fallback and metrics need testing: https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html.

## Source and verification

Inter variable font and SIL OFL 1.1 license: Google Fonts `ofl/inter`, revision `6ebe737e44fd64ee736bbc6feed6136a6dbfd222`, https://github.com/google/fonts/tree/6ebe737e44fd64ee736bbc6feed6136a6dbfd222/ofl/inter. Existing Bebas Neue and Oswald licenses are beside those fonts. Check the actual license files when distributing. Godot 4.7.2 headless editor imported Inter without an import error; that is not a rendered or iPhone test.

Next: translate and compare vector geometry (including dark/light/monochrome and icon-scale use), produce distinct material/motion studies in actual 3D, and inspect rendered Godot output before replacing the existing opening. Continue the requested cinematic, environmental, character, interface and gameplay production; none is implied complete by this identity study.
