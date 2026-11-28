// The street as a weapon.
//
// The fiction of this game is that the player wins by leverage — a takedown from
// behind, a rifle you were not supposed to have, a truck. Then the street itself
// did nothing: barrels were scenery, the canal was a boundary rather than a
// threat, traffic was an animated hazard that killed only you.
//
// This module is the rule layer for the three hazards that already exist in the
// world geometry. It is deliberately pure: no meshes, no scene, no audio. It
// answers two questions — "what could this trigger hit" and "is this body
// standing where the hazard reaches" — and the arena does the killing. That way
// the whole thing is testable with plain objects, which is how everything else
// in this codebase works.

/** Kind-specific behaviour. Reach is in metres. */
export const HAZARD = {
  /** A fuel drum. Goes up, takes the barrel with it, and lights the ground. */
  barrel: {
    reach: 5.2,
    damage: 240,
    friendly: true,       // hurts bodies other than the shooter
    chain: 4.5,           // how far the blast can set off another barrel
    chainDepth: 3,        // and how many links before it stops, so a chain is finite
    fire: { radius: 3.4, seconds: 6, perSecond: 9 },
    noise: 42,
    label: "Fuel drum",
  },
  /** A gas line in a basement. One hit and the floor stops being a floor. */
  gasMain: {
    reach: 6.4,
    damage: 320,
    friendly: true,
    chain: 6.8,
    chainDepth: 2,
    fire: { radius: 4.2, seconds: 8, perSecond: 12 },
    noise: 55,
    label: "Gas main",
  },
  /**
   * The canal. Not triggered by a shot — it does not need to be. Anything
   * knocked into it past the bank drowns, and that includes you if you go in
   * after it.
   */
  canal: {
    reach: 0,
    damage: 999,
    friendly: true,
    chain: 0,
    chainDepth: 0,
    fire: null,
    noise: 6,             // a body entering water is quiet
    label: "Canal",
  },
  /** A car. Not an explosion, a battering ram. */
  vehicle: {
    reach: 2.6,
    damage: 180,
    friendly: true,
    chain: 0,
    chainDepth: 0,
    fire: null,
    noise: 30,
    label: "Vehicle",
  },
};

/** How close a player must be to a hazard to be allowed to use it. */
export const USE_REACH = 2.9;

/**
 * Is a hazard usable from here — close enough, and roughly in front?
 * `facing` is the aim yaw, and the hazard is a point, so this is a generous cone:
 * you are reaching out and touching something, not shooting it.
 */
export function canUse(hazard, player, facing, cone = 1.4) {
  if (!hazard || !player) return false;
  const dx = hazard.x - player.x;
  const dz = hazard.z - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > USE_REACH) return false;
  if (dist < 0.2) return true; // standing on it
  const toHazard = Math.atan2(dx, dz);
  // Same convention as the compass: forward is (sin yaw, cos yaw).
  const delta = Math.abs(wrapPi(toHazard - facing));
  return delta <= cone;
}

/**
 * Every body inside a hazard's reach at the moment it goes off.
 *
 * Returns `{ enemy, distance, falloff }` per body, nearest first. Falloff is
 * linear to zero at the edge rather than a step, so a body at the rim is hurt
 * and a body a metre outside is not, which is what makes the reach legible.
 */
export function blastTargets(origin, bodies, reach, { ignore = null, requireGrounded = false } = {}) {
  const out = [];
  for (const b of bodies) {
    if (!b || b === ignore) continue;
    if (b.dead) continue;
    const pos = b.root?.position ?? b;
    const d = Math.hypot(pos.x - origin.x, pos.z - origin.z);
    if (d > reach) continue;
    if (requireGrounded && b.behaviour?.hover) continue;
    out.push({ enemy: b.ref ?? b, distance: d, falloff: Math.max(0.25, 1 - d / reach) });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out;
}

/**
 * The chain: which other hazards are set off by this one.
 *
 * Bounded by `chainDepth` so a street of twenty barrels is a spectacular event
 * rather than an infinite loop, and by distance so it stays local. Returns the
 * hazards that should detonate next, excluding ones already spent.
 */
export function chainFrom(hazard, hazards, { depth = 0, spent = new Set() } = {}) {
  const spec = HAZARD[hazard.kind];
  if (!spec || spec.chainDepth === 0) return [];
  if (depth >= spec.chainDepth) return [];
  const out = [];
  for (const other of hazards) {
    if (other === hazard || other.spent || spent.has(other)) continue;
    if (!HAZARD[other.kind] || HAZARD[other.kind].chain === 0) continue;
    const d = Math.hypot(other.x - hazard.x, other.z - hazard.z);
    if (d <= spec.chain) out.push(other);
  }
  return out;
}

/**
 * Would a body at this point be in the canal?
 *
 * The canal is a strip with a bank height. A body whose feet are below the bank
 * and whose position is inside the water rectangle is going in. This is the same
 * rule the player's own drowning uses, so a body pushed in behaves like the
 * player falling in.
 */
export function fallsInWater(pos, water, bankHeight = -0.4) {
  if (!water) return false;
  const inside = pos.x >= Math.min(water.x1, water.x2) && pos.x <= Math.max(water.x1, water.x2)
    && pos.z >= Math.min(water.z1, water.z2) && pos.z <= Math.max(water.z1, water.z2);
  if (!inside) return false;
  // A canal is a channel: the water sits below the pavement, so standing on a
  // bridge over it is not falling in.
  return (pos.y ?? 0) <= (water.surfaceY ?? 0) + 0.35;
}

/**
 * Shove a body away from a blast. Returns the new position and yaw, so the
 * caller applies it — this does not mutate the argument, which keeps the rule
 * testable and the caller's existing integration order intact.
 *
 * `strength` scales with proximity: a body at the centre is thrown the full
 * `push` distance, a body at the rim is nudged. Bodies thrown into water drown,
 * which is the point.
 */
export function shove(pos, origin, push, minPush = 0.6) {
  const dx = pos.x - origin.x;
  const dz = pos.z - origin.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) {
    // Directly on top of it: there is no direction, so choose a fixed one
    // rather than a random one, and the blast stays reproducible.
    return { x: pos.x, z: pos.z + push, thrown: push };
  }
  const amount = Math.max(minPush, push * (1 - d / (push * 2.2)));
  return { x: pos.x + (dx / d) * amount, z: pos.z + (dz / d) * amount, thrown: amount };
}

/** Hazards the player could use from where they stand, nearest first. */
export function usableHazards(hazards, player, facing, cone) {
  const out = [];
  for (const h of hazards) {
    if (h.spent) continue;
    if (!HAZARD[h.kind]) continue;
    if (!canUse(h, player, facing, cone)) continue;
    const d = Math.hypot(h.x - player.x, h.z - player.z);
    out.push({ hazard: h, distance: d });
  }
  out.sort((a, b) => a.distance - b.distance);
  return out;
}

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
