# Kenney 3D library (CC0)

Vendored from `github.com/shorepine/kenney`, a mirror of Kenney's CC0 game
assets organised for the Tulip asset service.

- **Licence:** CC0 1.0 Universal (public domain). Kenney releases all asset
  packs under CC0; no attribution is required. This file is a courtesy.
- **Source:** https://github.com/shorepine/kenney
- **Upstream:** https://kenney.nl

## What was vendored

| Pack | Models | Tris | Textured | Notes |
|---|---|---|---|---|
| city-commercial | 41 | 44,682 | yes | storefront buildings, awnings, signage |
| city-suburban | 40 | 30,035 | yes | houses, low blocks |
| city-roads | 72 | 12,662 | yes | road tiles, crossings, barriers, street furniture |
| car | 50 | 65,235 | yes | ambulance, police, taxi, van, pickup, sports cars |
| watercraft | 46 | 21,534 | yes | fishing boat, speedboat, houseboat, canal boat |
| building | 79 | 8,326 | yes | towers, roofs, details |
| modular-buildings | 108 | 6,950 | yes | wall, floor and roof modules |
| retro-urban | 124 | 3,612 | yes | low-poly city blocks |
| furniture | 140 | 26,737 | yes | interior and street furniture |

700 models, 19.4 MB. Each pack carries its own 1024² `Textures/colormap.png`;
models reference it by a relative URI, so the loader resolves it per pack.

## Integrity

Every model was parsed with `tools/gltf.mjs` and measured (`tools/_kaudit.mjs`):
glTF 2.0 magic header, real POSITION accessors, sane vertex counts, one material
per model. Contact sheets rendered from the geometry with the offline rasteriser
are the visual check.

## Other CC0 sources surveyed

- `kayquer/kit-cidade-lowpoly` — 129 models. In use for trees and park dressing.
- `trebeljahr/quaternius-showcase` — 1,545 Quaternius models. Surveyed; the
  nature subset (rocks, grass) is partly in use.
- `ToxSam/cc0-models-Polygonal-Mind` — 991 models, 2.2 GB. Surveyed.
- Quaternius' own packs (Downtown City MegaKit, Stylized Nature) are CC0 but
  only downloadable through a JS modal on quaternius.com, which this
  environment cannot reach.
