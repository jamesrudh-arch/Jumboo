// Cinder City — district layout.
//
// The approved M01 beat happens in a small loading lane (src/level.js). This
// module grows a whole district around that lane: an avenue, cross-streets, a
// canal with two bridges, a harbour bay, a park with a pond, ranks of
// buildings, and street furniture. It is STUDY ENVIRONMENT: a procedural city
// that gives the gameplay somewhere to breathe. It adds no story facts, no
// dialogue and no canon — every name below is a working label for a grid cell.
//
// Layout grammar (metres, -Z is "deeper into the city"):
//
//        z = -150  ┌──────────────── harbour ────────────────┐
//        z = -120  │  docks, cranes, containers, warehouses    │
//        z =  -96  ├──── market avenue (x -90 .. 90) ──────────┤
//        z =  -76  │  canal (east-west water, two bridges)     │
//        z =  -60  ├──── cross-street ────────────────────────┤
//        z =  -52 ───── end of the approved loading lane ─────
//        z =   12 ───── shop front / spawn ───────────────────
//        z =   34  ├──── cross-street ────────────────────────┤
//        z =   60  └──── park with pond ──────────────────────┘
//
// Everything is plain data so it can be unit tested without a renderer, exactly
// like src/level.js.

import { box } from "./collision.js";

export const CITY = {
  name: "Cinder City — Hearthline district",
  bounds: { x1: -150, x2: 150, z1: -160, z2: 90 },
  // Wharf edge: no building may sit this close to water it does not span.
  waterMargin: 2,
  // The lane the approved mission uses, kept clear of city blocks.
  lane: { x1: -14, x2: 14, z1: -53, z2: 13 },

  roads: [
    // The avenue runs north-south: up to the lane mouth (the street outside the
    // shop), south to the canal, and on down to the harbour.
    { id: "avenue", x1: -9, x2: 9, z1: -150, z2: -70, kind: "avenue", lanes: 4 },
    // The street north of the lane mouth. The lane itself owns z -53..13 and
    // must stay clear, so this picks up where the lane's shop end stops.
    { id: "avenue-north", x1: -9, x2: 9, z1: 13, z2: 40, kind: "avenue", lanes: 2 },
    // Cross streets, each in its own clear band (see the layout note above).
    { id: "cross-north", x1: -140, x2: 140, z1: 40, z2: 54, kind: "street" },
    { id: "cross-mid", x1: -140, x2: 140, z1: -70, z2: -58, kind: "street" },
    { id: "cross-dock", x1: -140, x2: 140, z1: -108, z2: -100, kind: "street" },
    // (There is one dock road, `cross-dock`; an overlapping second "quay" road
    // used to double the paint and confuse the sidewalk builder.)
    // Side alleys feeding the approved lane.
    { id: "alley-west", x1: -52, x2: -14, z1: -28, z2: -22, kind: "alley" },
    { id: "alley-east", x1: 14, x2: 52, z1: -32, z2: -25, kind: "alley" },
  ],

  // Water is a hole in the ground: the existing gravity/respawn path already
  // handles falling in, and collision simply omits these areas.
  water: [
    {
      id: "canal",
      x1: -140, x2: 140, z1: -82, z2: -78,
      surfaceY: -0.45,
      bedY: -4.6,
      kind: "canal",
      flow: { x: 0.55, z: 0.12 },
    },
    {
      id: "harbour",
      x1: -150, x2: 150, z1: -160, z2: -128,
      surfaceY: -0.6,
      bedY: -9,
      kind: "harbour",
      flow: { x: -0.18, z: 0.42 },
    },
    {
      id: "pond",
      x1: -28, x2: 4, z1: 64, z2: 84,
      surfaceY: -0.35,
      bedY: -3.4,
      kind: "pond",
      round: true,
      flow: { x: 0, z: 0 },
    },
  ],

  // The towers that give the district a skyline. These are single lots, not
  // blocks: the city generator never invents anything taller than a mid-rise.
  towers: [
    { id: "hearthline-house", x1: -46, x2: -34, z1: 18, z2: 30, floors: 22, style: "midrise" },
    { id: "dock-office", x1: 96, x2: 108, z1: 16, z2: 28, floors: 18, style: "midrise" },
    { id: "canal-court", x1: 104, x2: 116, z1: -56, z2: -44, floors: 15, style: "midrise" },
    { id: "old-north-bank", x1: -78, x2: -66, z1: 60, z2: 72, floors: 12, style: "shophouse" },
  ],

  parks: [
    { id: "park-south", x1: -64, x2: 24, z1: 56, z2: 90, kind: "lawn" },
    { id: "park-east", x1: 62, x2: 108, z1: -8, z2: 36, kind: "lawn" },
  ],

  // Buildings fill these blocks. Each block must sit inside a clear band, so no
  // lot straddles a road or the water (see the band list at the top).
  blocks: [
    // North band, z 14..40: the west half ends just short of the avenue, then
    // resumes east of it, so the street stays open all the way to the lane.
    { x1: -64, x2: -14, z1: 14, z2: 40, style: "shophouse", floors: [3, 5] },
    { x1: -140, x2: -68, z1: 14, z2: 40, style: "midrise", floors: [5, 9] },
    { x1: 14, x2: 60, z1: 14, z2: 40, style: "shophouse", floors: [3, 5] },
    { x1: 64, x2: 140, z1: 14, z2: 40, style: "midrise", floors: [6, 11] },
    // Park band, south of the north cross-street.
    { x1: -140, x2: -70, z1: 56, z2: 88, style: "midrise", floors: [4, 8] },
    { x1: 30, x2: 56, z1: 56, z2: 88, style: "shophouse", floors: [2, 4] },
    { x1: 114, x2: 140, z1: 56, z2: 88, style: "midrise", floors: [5, 9] },
    // Flanking the approved lane, z -54..-14 (the lane itself stays clear).
    { x1: -140, x2: -18, z1: -52, z2: -14, style: "warehouse", floors: [2, 4] },
    { x1: 18, x2: 140, z1: -52, z2: -14, style: "industrial", floors: [2, 4] },
    // Canal banks: a narrow terrace either side of the water, houses facing
    // the canal. (The band must clear the canal's 2 m wharf margin.)
    { x1: -140, x2: -20, z1: -77.8, z2: -70, style: "terrace", floors: [3, 5] },
    { x1: 20, x2: 140, z1: -77.8, z2: -70, style: "terrace", floors: [3, 5] },
    // Between the canal and the dock road: taller blocks facing the water.
    { x1: -140, x2: -18, z1: -100, z2: -90, style: "midrise", floors: [4, 8] },
    { x1: 18, x2: 140, z1: -100, z2: -90, style: "midrise", floors: [5, 10] },
    // Harbour shore: containers, sheds and the fish market. The wharf margin
    // clips the south edge, so these lots line the road and face the water.
    { x1: -140, x2: -24, z1: -125, z2: -112, style: "warehouse", floors: [2, 3] },
    { x1: 24, x2: 140, z1: -125, z2: -112, style: "industrial", floors: [2, 4] },
  ],

  bridges: [
    { id: "bridge-avenue", x1: -10, x2: 10, z1: -84, z2: -76, kind: "road" },
    { id: "bridge-west", x1: -96, x2: -80, z1: -84, z2: -76, kind: "foot" },
    { id: "bridge-east", x1: 60, x2: 76, z1: -84, z2: -76, kind: "foot" },
  ],

  // Street lamps are placed along every road edge by the generator; these are
  // the hand-placed hero lamps the existing lane already uses.
  lampSpacing: 22,
  treeSpacing: 9,

  // Traffic routes: closed loops on the road network, in metres.
  trafficRoutes: [
    // Each route is a ring on a real road: out on one street, back on another.
    // A face that leaves the road network would drive through a block.
    {
      id: "avenue-circuit",
      speed: 9,
      points: [
        { x: 4.6, z: 47 },    // on cross-north, waiting to turn south
        { x: 4.6, z: 18 },    // avenue-north, outside the lane mouth
        { x: 4.6, z: -66 },   // dead end at cross-mid: back up and turn
        { x: 2.4, z: -62 },
      ],
    },
    {
      id: "cross-north-loop",
      speed: 8,
      points: [
        { x: -120, z: 44.8 },
        { x: 120, z: 44.8 },
        { x: 120, z: 49.2 },
        { x: -120, z: 49.2 },
      ],
    },
    {
      id: "cross-mid-loop",
      speed: 8,
      points: [
        { x: -120, z: -66.4 },
        { x: 120, z: -66.4 },
        { x: 120, z: -61.6 },
        { x: -120, z: -61.6 },
      ],
    },
    {
      id: "dock-loop",
      speed: 7,
      points: [
        { x: -120, z: -103 },
        { x: 120, z: -103 },
        { x: 120, z: -106.6 },
        { x: -120, z: -106.6 },
      ],
    },
  ],

  // Ambience anchors for the audio-free build (kept as data so audio can use
  // them later without inventing new places).
  ambience: [
    { id: "harbour-horn", x: 0, z: -140, radius: 90 },
    { id: "market-murmur", x: 0, z: -86, radius: 60 },
    { id: "canal-flow", x: 0, z: -69, radius: 40 },
  ],
};

// ------------------------------------------------------------------ helpers

/** Deterministic PRNG so the city looks identical on every load and in tests. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when a point is inside a rectangle {x1,z1,x2,z2}. */
export function insideRect(px, pz, r, pad = 0) {
  return px > r.x1 - pad && px < r.x2 + pad && pz > r.z1 - pad && pz < r.z2 + pad;
}

/**
 * True when a footprint is clear of water, including the wharf edge where the
 * ground drops into the canal. Bridges are exempt: a bridge spans the water.
 */
function clearOfWater(city, rect) {
  const margin = Number.isFinite(city.waterMargin) ? city.waterMargin : 2;
  for (const w of city.water) {
    const grown = { x1: w.x1 - margin, z1: w.z1 - margin, x2: w.x2 + margin, z2: w.z2 + margin };
    if (!intersects(rect, grown)) continue;
    if ((city.bridges || []).some((b) => rect.x1 >= b.x1 && rect.x2 <= b.x2 && rect.z1 >= b.z1 && rect.z2 <= b.z2)) {
      continue;
    }
    return false;
  }
  return true;
}

/** Is this footprint free of roads, water, parks and the approved lane? */
export function isBuildable(city, x1, z1, x2, z2, pad = 1) {
  const rect = { x1: x1 - pad, z1: z1 - pad, x2: x2 + pad, z2: z2 + pad };
  for (const r of city.roads) if (intersects(rect, r)) return false;
  // NOTE: parks are handled by the block table, not here: parks are where the
  // tree planner works, and the two would deadlock if parks blocked lots.
  if (!clearOfWater(city, rect)) return false;
  for (const p of city.parks) if (intersects(rect, p)) return false;
  if (intersects(rect, city.lane)) return false;
  for (const b of city.bridges) if (intersects(rect, b)) return false;
  return true;
}

/** Rectangle overlap. */
export function intersects(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.z1 < b.z2 && a.z2 > b.z1;
}

/** Water body containing a point, or null. */
export function waterAt(city, px, pz) {
  for (const w of city.water) {
    if (!insideRect(px, pz, w)) continue;
    if (w.round) {
      // A rounded pond: an ellipse inscribed in the rectangle.
      const cx = (w.x1 + w.x2) / 2;
      const cz = (w.z1 + w.z2) / 2;
      const rx = (w.x2 - w.x1) / 2;
      const rz = (w.z2 - w.z1) / 2;
      const d = ((px - cx) / (rx * 0.82)) ** 2 + ((pz - cz) / (rz * 0.72)) ** 2;
      if (d > 1) continue;
    }
    return w;
  }
  return null;
}

/** Road containing a point, or null. */
export function roadAt(city, px, pz, pad = 0) {
  for (const r of city.roads) if (insideRect(px, pz, r, pad)) return r;
  return null;
}

/** Park containing a point, or null. */
export function parkAt(city, px, pz) {
  for (const p of city.parks) if (insideRect(px, pz, p)) return p;
  return null;
}

// -------------------------------------------------------------- generation

const STYLE_MATERIALS = {
  shophouse: ["brick", "plaster", "timber"],
  midrise: ["concrete", "plaster", "glass"],
  warehouse: ["corrugated", "concrete", "brick"],
  industrial: ["corrugated", "concrete"],
  terrace: ["plaster", "brick", "timber"],
  edge: ["concrete", "glass"],
};

/**
 * Build the district: collision boxes, render specs, water, trees, vehicles and
 * street furniture. `tier` only changes how many of the optional props are
 * emitted (buildings are always full so the skyline never has gaps).
 *
 * Returns { boxes, platforms, buildings, water, roads, trees, props, lamps,
 *           vehiclesParked, bridges, blocks, stats }.
 */
export function buildCity(city = CITY, tier = { buildings: 84, treeCount: 200 }) {
  const rand = mulberry32(0x5eed);
  const boxes = [];
  const buildings = [];
  const buildingBoxes = [];
  const trees = [];
  const props = [];
  const lamps = [];
  const vehiclesParked = [];
  const water = city.water.map((w) => ({ ...w }));

  // ------------------------------------------------------------- buildings
  // Every block is inset before lots are laid out: a lot flush with the block
  // edge would overlap the road's pavement pad and be rejected, which silently
  // emptied whole bands of the city.
  const INSET = 1.4;
  for (const block of city.blocks) {
    // Fill the block in rows of lots so the district reads as dense city, not
    // a few sheds in a field. Rows run back from the street-facing edge.
    const lots = [];
    const bx1 = block.x1 + INSET;
    const bx2 = block.x2 - INSET;
    const bz1 = block.z1 + INSET;
    const bz2 = block.z2 - INSET;
    const horizontal = bx2 - bx1 >= bz2 - bz1;
    const span = horizontal ? bx2 - bx1 : bz2 - bz1;
    const runOut = horizontal ? bz2 - bz1 : bx2 - bx1;
    let rowStart = 0;
    while (rowStart < runOut - 4) {
      const rowDepth = 9 + rand() * 7;
      const rowDepthClamped = Math.min(rowDepth, runOut - rowStart);
      let cursor = 0;
      while (cursor < span - 4) {
        const lotW = 7 + rand() * 8;
        const w = Math.min(lotW, span - cursor);
        if (w < 4.5) break;
        // `across` is the short (frontage) axis, `along` the run-back axis.
        // Rows always run towards +x/+z from the block's inset origin, so the
        // x1..x2 pair is the frontage when the block is long in X.
        lots.push(
          horizontal
            ? {
                x1: bx1 + cursor,
                x2: bx1 + cursor + w,
                z1: bz1 + rowStart,
                z2: bz1 + rowStart + rowDepthClamped,
              }
            : {
                x1: bx1 + cursor,
                x2: bx1 + cursor + rowDepthClamped,
                z1: bz1 + rowStart,
                z2: bz1 + rowStart + w,
              },
        );
        cursor += w + 0.7;
      }
      rowStart += rowDepthClamped + 1.2;
    }
    for (const lot of lots) {
      if (!isBuildable(city, lot.x1, lot.z1, lot.x2, lot.z2, 0.5)) continue;
      const [minF, maxF] = block.floors;
      const floors = Math.round(minF + rand() * (maxF - minF));
      const floorH = block.style === "warehouse" || block.style === "industrial" ? 4.6 : 3.3;
      const h = floors * floorH;
      const mats = STYLE_MATERIALS[block.style] || STYLE_MATERIALS.midrise;
      const mat = mats[Math.floor(rand() * mats.length)];
      buildings.push({
        x1: lot.x1,
        z1: lot.z1,
        x2: lot.x2,
        z2: lot.z2,
        h,
        floors,
        floorH,
        style: block.style,
        mat,
        // Window rhythm, split so the renderer can instance window quads.
        colStep: block.style === "warehouse" ? 6.5 : 2.6 + rand() * 0.8,
        lit: rand() < 0.62,
        roof: rand() < 0.45 ? "tank" : rand() < 0.6 ? "ac" : "none",
        shopfront: block.style === "shophouse" || block.style === "midrise",
        seed: Math.floor(rand() * 1000),
      });
      // Solid collision: the whole footprint, full height. Kept index-aligned
      // with `buildings` so the tier filter can drop both together.
      buildingBoxes.push(box(lot.x1, lot.z1, lot.x2, lot.z2, 0, h, "building"));
    }
  }

  // ----------------------------------------------------------------- towers
  for (const t of (city.towers || [])) {
    if (!isBuildable(city, t.x1, t.z1, t.x2, t.z2, 0.5)) continue;
    const floorH = 3.6;
    const h = t.floors * floorH;
    buildings.push({
      x1: t.x1, z1: t.z1, x2: t.x2, z2: t.z2,
      h, floors: t.floors, floorH, style: t.style, id: t.id,
      mat: STYLE_MATERIALS[t.style] ? STYLE_MATERIALS[t.style][0] : "concrete",
      colStep: 2.8, lit: true, roof: "antenna", shopfront: true, seed: 7,
    });
    buildingBoxes.push(box(t.x1, t.z1, t.x2, t.z2, 0, h, "building"));
  }

  // ------------------------------------------------------------- tier budget
  // Apply the building budget across the whole map, not block by block: a
  // running cap would exhaust itself in the first district and leave the
  // harbour empty on a phone. Buildings and their collision volumes are thinned
  // together, evenly, so every district survives at every tier.
  const budget = tier.buildings ?? Infinity;
  if (Number.isFinite(budget) && buildings.length > budget) {
    // Landmarks are never thinned, so the skyline survives on a phone.
    const landmark = (b) => Boolean(b.id) || b.h >= 40;
    const landmarks = buildings.map((b, i) => (landmark(b) ? i : -1)).filter((i) => i >= 0);
    const stride = (buildings.length - landmarks.length) / Math.max(1, budget - landmarks.length);
    const keptBuildings = [];
    const keptBoxes = [];
    for (const i of landmarks) {
      keptBuildings.push(buildings[i]);
      keptBoxes.push(buildingBoxes[i]);
    }
    for (let i = 0; i < buildings.length && keptBuildings.length < budget; i++) {
      if (landmark(buildings[i])) continue;
      if (Math.floor(i / stride) === Math.floor((i + 1) / stride)) continue;
      keptBuildings.push(buildings[i]);
      keptBoxes.push(buildingBoxes[i]);
    }
    buildings.length = 0;
    buildings.push(...keptBuildings);
    buildingBoxes.length = 0;
    buildingBoxes.push(...keptBoxes);
  }
  boxes.push(...buildingBoxes);

  // ------------------------------------------------------------ bridges
  for (const b of city.bridges) {
    boxes.push(box(b.x1, b.z1, b.x2, b.z2, -2.4, 0.18, b.kind === "road" ? "bridge" : "footbridge"));
  }

  // ------------------------------------------------------------ kerbs/piers
  // Quay edge along the harbour so the water is a sharp lip, not a fade.
  boxes.push(box(-150, -128.4, 150, -126, -3, 0.42, "quay"));
  // Canal walls keep the water channel readable from the street.
  // Low lips only: the canal has to be visible from the street, and a tall
  // bank box would hide the water entirely.
  boxes.push(box(-140, -81.2, 140, -79.8, -4.6, 0.12, "canalBank"));
  boxes.push(box(-140, -72.2, 140, -70.8, -4.6, 0.12, "canalBank"));

  // ------------------------------------------------------------ trees
  const treeBudget = Math.min(tier.treeCount || 200, 420);
  const parkSpots = [];
  for (const park of city.parks) {
    const cols = Math.floor((park.x2 - park.x1) / city.treeSpacing);
    const rows = Math.floor((park.z2 - park.z1) / city.treeSpacing);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = park.x1 + city.treeSpacing * (i + 0.5) + (rand() - 0.5) * 4;
        const z = park.z1 + city.treeSpacing * (j + 0.5) + (rand() - 0.5) * 4;
        if (waterAt(city, x, z)) continue;
        parkSpots.push({ x, z, park: park.id });
      }
    }
  }
  // Street trees along the avenue and the quay.
  for (let z = -122; z < 76; z += 11) {
    for (const side of [-1, 1]) {
      const x = side * (10.6 + rand() * 1.2);
      if (waterAt(city, x, z) || roadAt(city, x, z)) continue;
      parkSpots.push({ x, z, park: "street" });
    }
  }
  // Canal-side plane trees and park avenue rows: line the water so the district
  // has a green edge, then top up along every non-alley sidewalk.
  for (let x = -138; x < 140; x += 17) {
    for (const z of [-83.5, -68.5]) {
      const jx = x + (rand() - 0.5) * 3;
      if (waterAt(city, jx, z) || roadAt(city, jx, z)) continue;
      if (Math.abs(jx) < 12 || (jx > -100 && jx < -76) || (jx > 56 && jx < 80)) continue;
      parkSpots.push({ x: jx, z, park: "canal" });
    }
  }
  for (let z = -50; z < 40; z += 15) {
    for (const side of [-1, 1]) {
      const x = side * (12.5 + rand() * 2.5);
      if (waterAt(city, x, z) || roadAt(city, x, z)) continue;
      parkSpots.push({ x, z, park: "street" });
    }
  }

  const take = Math.min(treeBudget, parkSpots.length);
  for (let i = 0; i < take; i++) {
    const spot = parkSpots[Math.floor((i * parkSpots.length) / take)];
    const scale = 0.8 + rand() * 0.75;
    trees.push({
      x: spot.x,
      z: spot.z,
      scale,
      yaw: rand() * Math.PI * 2,
      // Two silhouettes: broad canopy and narrow cypress.
      kind: rand() < 0.7 ? "broadleaf" : "cypress",
      trunkH: 1.9 + rand() * 1.1,
      tone: rand(),
      zone: spot.park,
    });
    boxes.push(box(spot.x - 0.28 * scale, spot.z - 0.28 * scale, spot.x + 0.28 * scale, spot.z + 0.28 * scale, 0, 2.4, "tree"));
  }

  // ------------------------------------------------------------ street lamps
  const lampBudget = Math.max(6, Math.round((tier.streetLampLightBudget || 4) * 9));
  const lampSpots = [];
  for (const road of city.roads) {
    if (road.kind === "alley") continue;
    const along = road.x2 - road.x1 > road.z2 - road.z1;
    const step = Math.max(city.lampSpacing, 18);
    if (along) {
      for (let x = road.x1 + 6; x < road.x2 - 6; x += step) {
        lampSpots.push({ x, z: road.z1 + 1.2, side: -1, road: road.id });
        lampSpots.push({ x, z: road.z2 - 1.2, side: 1, road: road.id });
      }
    } else {
      for (let z = road.z1 + 6; z < road.z2 - 6; z += step) {
        lampSpots.push({ x: road.x1 + 1.2, z, side: -1, road: road.id });
        lampSpots.push({ x: road.x2 - 1.2, z, side: 1, road: road.id });
      }
    }
  }
  for (let i = 0; i < lampSpots.length; i++) {
    const spot = lampSpots[i];
    if (waterAt(city, spot.x, spot.z)) continue;
    const withLight = lamps.length < lampBudget;
    lamps.push({ ...spot, h: 6.2, lit: withLight, index: i });
  }

  // ------------------------------------------------------- parked vehicles
  // Kerbside parking along the avenue and the quay.
  for (let z = -118; z < 70; z += 17) {
    for (const side of [-1, 1]) {
      const x = side * 7.1;
      if (waterAt(city, x, z) || roadAt(city, x, z)?.kind === "alley") continue;
      if (rand() < 0.42) continue;
      vehiclesParked.push({
        x,
        z,
        yaw: side > 0 ? Math.PI : 0,
        kind: rand() < 0.3 ? "van" : rand() < 0.7 ? "sedan" : "truck",
        tone: rand(),
        seed: Math.floor(rand() * 999),
      });
      boxes.push(box(x - 1.1, z - 2.4, x + 1.1, z + 2.4, 0, 1.7, "vehicle"));
    }
  }
  // A loading rank on the quay.
  for (let x = -100; x < 100; x += 13) {
    if (rand() < 0.55) continue;
    const z = -84.4;
    vehiclesParked.push({
      x,
      z,
      yaw: Math.PI / 2,
      kind: rand() < 0.55 ? "truck" : "van",
      tone: rand(),
      seed: Math.floor(rand() * 999),
    });
    boxes.push(box(x - 2.6, z - 1.2, x + 2.6, z + 1.2, 0, 1.9, "vehicle"));
  }

  // ------------------------------------------------------------ harbour kit
  // Container stacks and cranes on the far quay.
  for (let i = 0; i < 14; i++) {
    const x = -120 + (i % 7) * 34 + rand() * 6;
    const z = -138 - Math.floor(i / 7) * 12;
    const w = 12.2;
    const d = 2.6;
    const stack = 1 + Math.floor(rand() * 3);
    props.push({ kind: "containerStack", x, z, w, d, stack, tone: rand() });
    boxes.push(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, 2.6 * stack, "container"));
  }
  for (const c of [
    { x: -70, z: -132 },
    { x: 10, z: -134 },
    { x: 78, z: -130 },
  ]) {
    props.push({ kind: "crane", x: c.x, z: c.z, h: 26, reach: 22 });
    boxes.push(box(c.x - 2.2, c.z - 2.2, c.x + 2.2, c.z + 2.2, 0, 4, "craneBase"));
  }

  // ------------------------------------------------------------ harbour kit 2
  // A moored barge, a pier and channel buoys: the basin needs something in it.
  props.push({ kind: "barge", x: -34, z: -140, w: 30, d: 9, yaw: 0.02 });
  props.push({ kind: "barge", x: 44, z: -150, w: 22, d: 8, yaw: -0.03 });
  props.push({ kind: "pier", x: 0, z: -132, len: 18, w: 4.2 });
  for (let i = 0; i < 6; i++) {
    props.push({ kind: "buoy", x: -60 + i * 24, z: -126 - (i % 2) * 6 });
  }
  for (const b of props.filter((p) => p.kind === "barge")) {
    boxes.push(box(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, -0.3, 2.2, "barge"));
  }

  // ------------------------------------------------------------- park kit
  for (const park of city.parks) {
    for (let i = 0; i < 5; i++) {
      const x = park.x1 + 6 + rand() * (park.x2 - park.x1 - 12);
      const z = park.z1 + 6 + rand() * (park.z2 - park.z1 - 12);
      if (waterAt(city, x, z)) continue;
      props.push({ kind: "bench", x, z, yaw: rand() * 0.8 - 0.4 });
      boxes.push(box(x - 1.1, z - 0.35, x + 1.1, z + 0.35, 0, 0.5, "bench"));
    }
  }

  // ------------------------------------------------------- street furniture
  // A city earns its "solid" feel from kerbside clutter. Everything here is
  // generated along the pavement bands, clear of the road surface.
  const furnitureRand = mulberry32(0x5f00d);
  const lampClear = (x, z) => !lamps.some((l) => Math.abs(l.x - x) < 2.4 && Math.abs(l.z - z) < 2.4);
  const roadClear = (x, z, pad = 0) => !roadAt(city, x, z, pad);
  for (const road of city.roads) {
    if (road.kind === "alley") continue;
    const alongX = road.x2 - road.x1 >= road.z2 - road.z1;
    const len = alongX ? road.x2 - road.x1 : road.z2 - road.z1;
    const step = 11;
    for (let d = 4; d < len - 4; d += step) {
      const side = furnitureRand() < 0.5 ? -1 : 1;
      // Put the prop just outside the road edge, on the pavement band.
      const off = 1.1 + furnitureRand() * 1.2;
      const x = alongX ? road.x1 + d : side < 0 ? road.x1 - off : road.x2 + off;
      const z = alongX ? (side < 0 ? road.z1 - off : road.z2 + off) : road.z1 + d;
      if (!insideRect(x, z, city.bounds, -3)) continue;
      if (waterAt(city, x, z) || !lampClear(x, z) || !roadClear(x, z, 0.6)) continue;
      const roll = furnitureRand();
      const kind =
        roll < 0.24 ? "bin" :
        roll < 0.42 ? "hydrant" :
        roll < 0.58 ? "bollard" :
        roll < 0.72 ? "signpost" :
        roll < 0.82 ? "crate" :
        roll < 0.92 ? "planter" : "utilityBox";
      props.push({ kind, x, z, yaw: furnitureRand() * 0.7 - 0.35, tone: furnitureRand() });
      if (kind === "utilityBox") boxes.push(box(x - 0.5, z - 0.35, x + 0.5, z + 0.35, 0, 1.1, "utilityBox"));
      if (kind === "planter") boxes.push(box(x - 0.6, z - 0.6, x + 0.6, z + 0.6, 0, 0.55, "planter"));
      if (kind === "bin") boxes.push(box(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 0, 0.9, "bin"));
    }
  }

  // ------------------------------------------------------------ canal rails
  // Low rails stop the player wandering into the canal from the sidewalk.
  for (let x = -140; x < 140; x += 4) {
    if (Math.abs(x) < 11 || (x > -98 && x < -78) || (x > 58 && x < 78)) continue; // bridge openings
    props.push({ kind: "railing", x, z: -70.4, len: 4, axis: "x" });
  }

  const stats = {
    buildings: buildings.length,
    boxes: boxes.length,
    trees: trees.length,
    lamps: lamps.length,
    lampsLit: lamps.filter((l) => l.lit).length,
    parked: vehiclesParked.length,
    water: water.length,
  };

  return {
    boxes,
    platforms: [],
    buildings,
    water,
    roads: city.roads,
    trees,
    props,
    lamps,
    vehiclesParked,
    bridges: city.bridges,
    parks: city.parks,
    stats,
  };
}
