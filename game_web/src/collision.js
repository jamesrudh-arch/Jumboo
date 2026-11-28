// 2.5D collision for a walking character on axis-aligned level geometry.
// Boxes are {x1, z1, x2, z2, y0, y1}. Movement is solved in the XZ plane and
// the vertical axis is handled separately by the player's support test, which
// keeps the maths cheap enough for phones and exact enough to unit test.

/**
 * Normalise a box so x1 <= x2 and z1 <= z2.
 *
 * `opts.skip` punches openings in a long wall: each entry is a z-range (for a
 * wall running along x) or an x-range (for one running along z). A wall with a
 * gap is returned as several boxes, so callers must use `boxList()` when they
 * pass skip ranges.
 */
export function box(x1, z1, x2, z2, y0 = 0, y1 = 2.4, tag = "", opts = null) {
  const b = {
    x1: Math.min(x1, x2),
    z1: Math.min(z1, z2),
    x2: Math.max(x1, x2),
    z2: Math.max(z1, z2),
    y0,
    y1,
    tag,
  };
  if (opts && opts.skip) return boxList(b, opts.skip);
  return b;
}

/** Split a box into segments, omitting each {z1,z2} or {x1,x2} opening. */
function boxList(b, gaps) {
  // Openings are cut along the wall's long axis. A wall that is long in Z takes
  // z-ranges ({ z1, z2 }); one that is long in X takes x-ranges ({ x1, x2 }).
  // A caller may pass either shape: the defined pair is the pair that is used.
  const longAxisIsZ = b.z2 - b.z1 >= b.x2 - b.x1;
  const spans = gaps
    .map((g) => {
      const pair = longAxisIsZ ? [g.z1, g.z2] : [g.x1, g.x2];
      const fallback = [g.x1, g.x2];
      const value = pair[0] !== undefined ? pair : fallback;
      return { a: Math.min(value[0], value[1]), b: Math.max(value[0], value[1]) };
    })
    .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b))
    .sort((p, q) => p.a - q.a);

  const out = [];
  let cursor = longAxisIsZ ? b.z1 : b.x1;
  const end = longAxisIsZ ? b.z2 : b.x2;
  for (const g of spans) {
    if (g.a > cursor) {
      out.push(longAxisIsZ ? { ...b, z1: cursor, z2: Math.min(g.a, end) } : { ...b, x1: cursor, x2: Math.min(g.a, end) });
    }
    cursor = Math.max(cursor, g.b);
  }
  if (cursor < end) out.push(longAxisIsZ ? { ...b, z1: cursor } : { ...b, x1: cursor });
  return out;
}

/**
 * Overlap of a vertical circle and a box footprint, as a penetration vector
 * that pushes the circle out of the box. Returns null when separated.
 */
export function circleBoxPenetration(px, pz, radius, b) {
  const cx = Math.max(b.x1, Math.min(px, b.x2));
  const cz = Math.max(b.z1, Math.min(pz, b.z2));
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > radius * radius) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    return { x: (dx / d) * push, z: (dz / d) * push };
  }
  // Centre is inside the box: push out along the shallowest axis.
  const left = px - b.x1;
  const right = b.x2 - px;
  const near = pz - b.z1;
  const far = b.z2 - pz;
  const m = Math.min(left, right, near, far);
  if (m === left) return { x: -(left + radius), z: 0 };
  if (m === right) return { x: right + radius, z: 0 };
  if (m === near) return { x: 0, z: -(near + radius) };
  return { x: 0, z: far + radius };
}

/** True when the box is relevant to a body occupying [feetY, headY]. */
function blocksBody(b, feetY, headY) {
  return b.y1 > feetY + 0.05 && b.y0 < headY;
}

/**
 * Resolve a circle against every box, iterating so corners settle.
 * Mutates and returns `pos` ({x, z}).
 */
export function resolveCircle(pos, radius, boxes, feetY = 0, headY = 1.8, iterations = 3) {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const b of boxes) {
      if (!blocksBody(b, feetY, headY)) continue;
      const pen = circleBoxPenetration(pos.x, pos.z, radius, b);
      if (pen) {
        pos.x += pen.x;
        pos.z += pen.z;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return pos;
}

/** Distance from a point to a box footprint (0 when inside). */
export function distanceToBox(px, pz, b) {
  const dx = Math.max(b.x1 - px, 0, px - b.x2);
  const dz = Math.max(b.z1 - pz, 0, pz - b.z2);
  return Math.hypot(dx, dz);
}

/** Does the 2D segment hit the box footprint? Slab method. */
export function segmentHitsBox(ax, az, bx, bz, b) {
  const dx = bx - ax;
  const dz = bz - az;
  let tmin = 0;
  let tmax = 1;
  for (const axis of ["x", "z"]) {
    const origin = axis === "x" ? ax : az;
    const dir = axis === "x" ? dx : dz;
    const lo = axis === "x" ? b.x1 : b.z1;
    const hi = axis === "x" ? b.x2 : b.z2;
    if (Math.abs(dir) < 1e-9) {
      if (origin < lo || origin > hi) return false;
      continue;
    }
    let t1 = (lo - origin) / dir;
    let t2 = (hi - origin) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

/**
 * Line of sight between two eye points. A box only blocks when its vertical
 * extent overlaps the sight line, so crates can be seen over and a crouched
 * player can hide behind low cover.
 */
export function hasLineOfSight(ax, ay, az, bx, by, bz, boxes) {
  for (const b of boxes) {
    if (b.tag === "floor" || b.tag === "platform") continue;
    if (!segmentHitsBox(ax, az, bx, bz, b)) continue;
    // The sight line is a straight 3D segment; compare the box's vertical
    // extent against the height range the segment actually sweeps at the
    // entry/exit points, not just the two endpoints.
    const lo = Math.min(ay, by);
    const hi = Math.max(ay, by);
    if (b.y1 > lo + 1e-6 && b.y0 < hi - 1e-6) return false;
  }
  return true;
}

/**
 * Support height under a point: the highest platform top at or below the
 * character's feet, plus a step allowance. Returns 0 for the ground plane.
 */
export function supportHeightAt(px, pz, platforms, feetY, stepUp = 0.4) {
  let best = 0;
  for (const p of platforms) {
    if (px < p.x1 || px > p.x2 || pz < p.z1 || pz > p.z2) continue;
    if (p.y1 <= feetY + stepUp && p.y1 > best) best = p.y1;
  }
  return best;
}

/** Deepest overlap check used to keep spawned props/waypoints clear of walls. */
export function overlapsAny(px, pz, radius, boxes, feetY = 0, headY = 1.8) {
  for (const b of boxes) {
    if (!blocksBody(b, feetY, headY)) continue;
    if (circleBoxPenetration(px, pz, radius, b)) return b;
  }
  return null;
}
