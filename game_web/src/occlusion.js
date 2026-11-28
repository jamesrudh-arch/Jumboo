// Sound through walls.
//
// Every combat sound in this game arrives as if the street were an open field: a
// shotgun four metres away through a warehouse wall is exactly as bright as one
// in the open. That is the single biggest remaining lie in the audio, because a
// player uses sound to decide where to face, and a muffled report from the right
// is a different and more useful piece of information than a bright one.
//
// The rule is deliberately simple and cheap: cast one segment from the listener to
// the source, count how many solid boxes it crosses, and turn that into a low-pass
// and a level cut. Buildings in this district are axis-aligned boxes on a spatial
// index, so a segment test costs almost nothing at the handful of sounds playing
// at once.
//
// It is kept pure — a count in, a filter out — so it can be tested without an
// AudioContext, which is how the rest of the mixer is tested.

/** How much sound survives a wall, by how many walls. */
export const WALLS = [
  { cutoff: 20000, gain: 1.0 },  // open air
  { cutoff: 900, gain: 0.62 },   // one wall: clearly through something
  { cutoff: 380, gain: 0.34 },   // two: a rumour of a shot
  { cutoff: 220, gain: 0.18 },   // three or more: a thud from somewhere
];

/**
 * The filter for a number of intervening walls.
 * Returns { cutoff, gain, muffled } where `muffled` is what the mixer uses to
 * decide whether a filter node is needed at all.
 */
export function throughWalls(count) {
  const i = Math.max(0, Math.min(WALLS.length - 1, Math.round(count)));
  const spec = WALLS[i];
  return { cutoff: spec.cutoff, gain: spec.gain, muffled: i > 0 };
}

/**
 * Count the solid boxes between two points.
 *
 * `boxes` should already be filtered to what is near the segment — the caller has
 * a spatial index and this module deliberately does not. Floors and platforms are
 * skipped: a bullet is not muffled by the ground it lands on.
 */
export function wallsBetween(ax, az, bx, bz, boxes) {
  let count = 0;
  for (const b of boxes) {
    if (!b) continue;
    if (b.tag === "floor" || b.tag === "platform" || b.tag === "ground") continue;
    if (segmentCrosses(ax, az, bx, bz, b)) count += 1;
  }
  return count;
}

/**
 * Does the segment cross a box footprint?
 *
 * Slab clipping in 2D. Written here rather than imported so this module has no
 * dependencies and the test file has nothing to fake.
 */
export function segmentCrosses(ax, az, bx, bz, b) {
  const x1 = Math.min(b.x1, b.x2);
  const x2 = Math.max(b.x1, b.x2);
  const z1 = Math.min(b.z1, b.z2);
  const z2 = Math.max(b.z1, b.z2);
  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;
  for (const [dir, lo, hi, start] of [[dx, x1, x2, ax], [dz, z1, z2, az]]) {
    if (Math.abs(dir) < 1e-9) {
      // Parallel to this slab: either entirely inside it or entirely outside.
      if (start < lo || start > hi) return false;
      continue;
    }
    let tA = (lo - start) / dir;
    let tB = (hi - start) / dir;
    if (tA > tB) [tA, tB] = [tB, tA];
    t0 = Math.max(t0, tA);
    t1 = Math.min(t1, tB);
    if (t0 > t1) return false;
  }
  return true;
}
