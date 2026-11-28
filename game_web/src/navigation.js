// How a body gets to the player.
//
// The first version of this had enemies walk in a straight line from their spawn
// to the player. Three things go wrong with that in a city:
//
//  1. They walk through walls. The street is 104 buildings and a canal.
//  2. They arrive on top of each other. Ten bodies on one bearing turn into a
//     pile of overlapping meshes that reads as a rendering bug.
//  3. They queue. Every body takes the same line, so the fight is ten copies of
//     one enemy arriving in single file.
//
// This module answers all three with the cheapest honest technique: *steering*,
// not a navmesh. Context steering with obstacle feelers and separation costs a
// few dozen distance checks per body and produces flanking and spread as an
// emergent property rather than as a scripted behaviour.
//
// A navmesh would be better and is the right long-term answer; a district this
// size would need a bake step and a pipeline this study does not have. Steering
// is the technique that gets 80% of the read for 1% of the cost, and the design
// document says so rather than pretending otherwise.

import { distanceToBox, segmentHitsBox } from "./collision.js";

/** Steering weights. Tuned so avoidance wins over pursuit but not by much. */
export const STEER = {
  pursue: 1.0,
  avoid: 1.7,
  separate: 1.25,
  flank: 0.55,
  /** How far ahead the avoidance feelers look, in metres. */
  lookahead: 2.4,
  /** Bodies closer than this to each other push apart. */
  personalSpace: 1.1,
};

/**
 * A unit-ish direction that steers `from` toward `to` while stepping around the
 * boxes in the way.
 *
 * `boxes` should be the local set (world.boxesNear), not the whole district: the
 * cost of this function is linear in what it is given and it runs per body per
 * frame.
 */
export function avoid(ax, az, targetX, targetZ, boxes, radius = 0.4, lookahead = STEER.lookahead) {
  const dx = targetX - ax;
  const dz = targetZ - az;
  const dist = Math.hypot(dx, dz) || 0.0001;
  const want = { x: dx / dist, z: dz / dist };

  // The straight line is clear: no need to look further than that.
  if (!pathBlocked(ax, az, targetX, targetZ, boxes, radius)) {
    return { x: want.x, z: want.z, blocked: false };
  }

  // Feel ahead and to both sides. Whichever side is free becomes the steer; if
  // both are free, the one closer to the target wins, which is what produces a
  // natural corner rather than a symmetric dither.
  const probe = Math.min(lookahead, dist);
  const angles = [0.5, -0.5, 1.0, -1.0, 1.55, -1.55];
  let best = null;
  for (const a of angles) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Rotate the wanted heading by `a` about Y.
    const sx = want.x * c - want.z * s;
    const sz = want.x * s + want.z * c;
    const px = ax + sx * probe;
    const pz = az + sz * probe;
    if (pathBlocked(ax, az, px, pz, boxes, radius)) continue;
    // Prefer a steer that keeps the target in view.
    const deviation = Math.abs(a);
    if (!best || deviation < best.deviation) best = { x: sx, z: sz, deviation, blocked: true };
  }
  if (best) return { x: best.x, z: best.z, blocked: true };

  // Everything ahead is blocked: back off along the wall rather than pressing
  // into it, and let the next frame re-evaluate.
  return { x: -want.x, z: -want.z, blocked: true };
}

/** Does the segment cross a box that is tall enough to matter? */
export function pathBlocked(ax, az, bx, bz, boxes, radius = 0.4) {
  if (!boxes || !boxes.length) return false;
  for (const b of boxes) {
    // Floors and low kerbs are walkable; only things the body would hit count.
    if (b.tag === "floor") continue;
    if (b.y1 !== undefined && b.y1 - (b.y0 ?? 0) < 0.35) continue;
    // Inflate by the body radius so a shoulder does not clip a corner.
    const grown = {
      x1: b.x1 - radius, z1: b.z1 - radius,
      x2: b.x2 + radius, z2: b.z2 + radius,
      y0: -Infinity, y1: Infinity,
    };
    if (segmentHitsBox(ax, az, bx, bz, grown)) return true;
  }
  return false;
}

/**
 * Push apart from neighbours. This is what stops ten bodies arriving as one
 * blob, and it is deliberately local: each body only looks at its nearest few.
 */
export function separate(self, neighbours, personalSpace = STEER.personalSpace) {
  let x = 0;
  let z = 0;
  let n = 0;
  for (const other of neighbours) {
    if (other === self) continue;
    const dx = self.x - other.x;
    const dz = self.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d >= personalSpace || d < 1e-4) continue;
    // Inverse falloff: the closer they are, the harder the push.
    const push = (personalSpace - d) / personalSpace;
    x += (dx / d) * push;
    z += (dz / d) * push;
    n += 1;
  }
  if (!n) return { x: 0, z: 0, weight: 0 };
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, weight: Math.min(1, n / 3) };
}

/**
 * A flanking offset: bodies approach on a spread of bearings around the player
 * instead of all on the direct line. `slot` and `count` come from the wave, so
 * the spread is a property of the formation rather than of chance.
 */
export function flankOffset(slot, count, radius = 3.2) {
  if (count <= 1) return { x: 0, z: 0 };
  // Spread evenly around the player, offset from the direct bearing so the
  // first slot is not dead ahead and the last is not dead behind.
  const angle = ((slot / count) * Math.PI * 2) + Math.PI * 0.35;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

/**
 * The whole decision for one body, in one call. Returns a unit heading.
 *
 * `ctx` carries { x, z, targetX, targetZ, boxes, neighbours, slot, count,
 * radius }. Pure, so a test can hand it any arrangement of bodies and boxes and
 * check the result rather than watching a browser.
 */
export function steer(ctx) {
  const {
    x, z, targetX, targetZ, boxes = [], neighbours = [],
    slot = 0, count = 1, radius = 0.4, avoidWeight = STEER.avoid,
  } = ctx;

  // Where this body wants to be relative to the player: a flank slot.
  //
  // The offset shapes the *approach*, it is not the destination. Applied at full
  // strength it became a destination, and five bodies settled into an orbit
  // about three metres out, each satisfied it had arrived and none of them close
  // enough to swing. So the spread fades out as the body closes: at 12 m a body
  // is on its flank lane, and at 2 m it is going for the player.
  const flank = flankOffset(slot, count);
  const approachDistance = Math.hypot(targetX - x, targetZ - z);
  const spread = Math.min(1, Math.max(0, (approachDistance - 2) / 8));
  const aimedX = targetX + flank.x * 0.5 * spread;
  const aimedZ = targetZ + flank.z * 0.5 * spread;

  const pursuit = avoid(x, z, aimedX, aimedZ, boxes, radius);
  const sep = separate({ x, z }, neighbours);

  // Separation must never cancel pursuit outright. The first version let it:
  // five bodies ringed the player at 1.6 m, each pushed back by its neighbours,
  // and none of them could close to the 1.3 m their attack needed. The fix is to
  // damp separation by how badly the body wants to be somewhere — a body at its
  // standoff separates freely, and a body still closing barely separates at all.
  const hunger = ctx.closing ?? 1;
  const sepWeight = sep.weight * STEER.separate * (1 - hunger * 0.75);
  const wantX = pursuit.x * STEER.pursue * (pursuit.blocked ? avoidWeight : 1);
  const wantZ = pursuit.z * STEER.pursue * (pursuit.blocked ? avoidWeight : 1);
  const mixX = wantX + sep.x * sepWeight;
  const mixZ = wantZ + sep.z * sepWeight;

  const len = Math.hypot(mixX, mixZ) || 1;
  return {
    x: mixX / len,
    z: mixZ / len,
    blocked: pursuit.blocked,
    separating: sep.weight > 0,
  };
}

/** Convenience for the caller: is a body's target reachable in a straight line? */
export function canSee(ax, az, bx, bz, boxes, radius = 0.4) {
  return !pathBlocked(ax, az, bx, bz, boxes, radius);
}

/** Distance from a point to the nearest solid box, for range checks. */
export function nearestObstacle(x, z, boxes) {
  let best = Infinity;
  for (const b of boxes) {
    if (b.tag === "floor") continue;
    best = Math.min(best, distanceToBox(x, z, b));
  }
  return best;
}


/**
 * Push overlapping bodies apart until they are not overlapping.
 *
 * Steering keeps them from *wanting* to occupy the same space, but it is a
 * preference, not a constraint: a body shoved by a crowd or crowded against a
 * wall can still end up inside another one, and two enemies intersecting is one
 * of the things a player reads instantly as broken.
 *
 * This is O(n^2) over the bodies actually near each other, which for a wave of
 * twenty bodies is four hundred distance checks a frame at worst, and usually
 * far fewer once steering has done its work. It runs after movement, so the
 * steering remains the intention and this is the correction.
 *
 * Returns the number of corrections applied, which the caller can use to notice
 * a wave that is jammed.
 */
export function resolveOverlaps(bodies, minDistance = 0.72, iterations = 2) {
  let corrections = 0;
  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!a) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (!b) continue;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        if (d >= minDistance) continue;
        if (d < 1e-5) {
          // Exactly coincident: pick a deterministic direction rather than a
          // random one, so a wave is still reproducible frame for frame.
          const angle = (i * 2.399 + j) % (Math.PI * 2);
          dx = Math.sin(angle);
          dz = Math.cos(angle);
          d = 1;
        }
        const overlap = (minDistance - d) * 0.5;
        const nx = (dx / d) * overlap;
        const nz = (dz / d) * overlap;
        // Split the correction: both bodies move half the overlap, so a crowd
        // does not shove one body across the street.
        a.x -= nx; a.z -= nz;
        b.x += nx; b.z += nz;
        corrections += 1;
      }
    }
  }
  return corrections;
}
