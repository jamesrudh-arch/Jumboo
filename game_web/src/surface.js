// What the player is walking on.
//
// The world already knows where the water is (it drowns you) and where the roads
// are (it built them). This turns that knowledge into a surface name, which the
// mixer uses to pick a footstep.
//
// Kept as a pure function of position and the level data so it can be tested
// without a renderer, and so a caller can ask "what is under this point" for any
// other reason — a landing sound, a splash, a clue.

/** Surface names the mixer knows. */
export const SURFACE = {
  TARMAC: "tarmac",
  PAVEMENT: "tarmac",
  GRATING: "grating",
  GRAVEL: "gravel",
  WATER: "water",
};

/**
 * Surface under a point.
 *
 * Order matters: water beats everything (you are in it), then a raised metal
 * surface, then gravel, then the road/pavement default. A point that matches
 * nothing is tarmac, because that is what the street is.
 */
export function surfaceAt(x, z, { water = null, gravel = [], gratings = [], roads = [] } = {}) {
  if (water && pointInWater(x, z, water)) return SURFACE.WATER;
  for (const g of gratings) {
    if (inside(x, z, g)) return SURFACE.GRATING;
  }
  for (const g of gravel) {
    if (inside(x, z, g)) return SURFACE.GRAVEL;
  }
  // The district's roads are long thin boxes; anything on one is tarmac.
  for (const r of roads) {
    if (inside(x, z, r)) return SURFACE.TARMAC;
  }
  return SURFACE.TARMAC;
}

/**
 * Surface under a point, read straight off the generated city.
 *
 * The city already knows where the water is and where the roads are; this just
 * asks it, so the footstep surface cannot drift out of sync with the geometry.
 * Parks are lawn, which is quiet; alleys are broken concrete over gravel, which
 * is not.
 */
export function citySurfaceAt(city, x, z, { waterAt, roadAt, parkAt } = {}) {
  if (!city) return SURFACE.TARMAC;
  if (waterAt && waterAt(city, x, z)) return SURFACE.WATER;
  if (parkAt && parkAt(city, x, z)) return SURFACE.GRAVEL;
  const road = roadAt ? roadAt(city, x, z) : null;
  if (road && road.kind === "alley") return SURFACE.GRAVEL;
  return SURFACE.TARMAC;
}

/** Whether a step on this surface makes a splash rather than a tap. */
export function isWet(surface) {
  return surface === SURFACE.WATER;
}

/**
 * Relative loudness of a step on a surface, 0..1. Used by the stealth model as
 * well as the mixer: gravel betrays you, tarmac does not.
 */
export function surfaceNoise(surface) {
  switch (surface) {
    // Water is the loudest thing you can stand in, and the reason the flood
    // section of the district changes how you move through it.
    case SURFACE.WATER: return 1.5;
    case SURFACE.GRAVEL: return 1.35;
    case SURFACE.GRATING: return 1.15;
    default: return 1.0;
  }
}

function inside(x, z, box) {
  if (!box) return false;
  const x1 = box.x1 ?? box.x0;
  const z1 = box.z1 ?? box.z0;
  const x2 = box.x2 ?? box.x1;
  const z2 = box.z2 ?? box.z1;
  if (x1 === undefined || x2 === undefined) return false;
  return x >= Math.min(x1, x2) && x <= Math.max(x1, x2)
    && z >= Math.min(z1, z2) && z <= Math.max(z1, z2);
}

function pointInWater(x, z, water) {
  if (Array.isArray(water)) return water.some((w) => inside(x, z, w));
  return inside(x, z, water);
}
