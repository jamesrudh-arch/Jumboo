# D’YOUNGS GAMES — studio identity, review 01

**Status: presented for owner review; not approved or integrated.** This is the first stage only. The owner previously selected a generated D/Y direction; the new mark is an independently drawn editable vector interpretation, not a vector trace. Its D and Y are separate paths. The studio wordmark in the presentation uses Inter Variable with expanded tracking; it is a type treatment, not bespoke letter outlines. Font and SIL OFL licence are in `game/assets/fonts/`.

## Review assets

- `dy_symbol.svg`: two-colour mark with transparent negative space; vector master.
- `dy_symbol_light.svg`, `dy_symbol_dark.svg`: single-colour variants.
- `docs/previews/dyoungs_studio_logo_presentation.png`: primary studio lockup with simulated metallic depth.
- `docs/previews/studio_mark_vector_study.png`: primary, monochrome and small-size tests.
- `docs/previews/dyoungs_studio_ident_concept.gif`: three-second, silent animated light/reveal concept (loops for review). It is a 2D composited effect, **not** a 3D rendered or in-game intro.
- `docs/previews/studio_identity_concept.png`: prior generated image selected by the owner; preserved for comparison.

## Studio palette

| Use | Hex | RGB |
|---|---|---|
| Deep ink ground | #080C0F | 8, 12, 15 |
| Steel vector | #67767A | 103, 118, 122 |
| Warm gold vector | #D6B989 | 214, 185, 137 |
| Light monochrome | #F0EEE6 | 240, 238, 230 |
| Dark monochrome | #20282A | 32, 40, 42 |

`tools/render_studio_mark.py` and `tools/render_studio_ident.py` reproduce the visuals with Pillow and resvg-py; the latter uses staged silhouettes and light gradients, not actual 3D geometry. Trademark/distinctiveness checks, final wordmark refinement, sound design, actual 3D modelling, in-engine motion and device review are not completed. These must not be represented as done or silently substituted for the owner's approval.
