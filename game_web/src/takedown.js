// The takedown: the verb this game was missing.
//
// The fiction is about leverage — using position, timing and information instead
// of force. A game with that fiction and a knife in the arsenal, where the knife
// is only a weak gun, has thrown its own premise away. Being *behind* someone
// and *unseen* should be worth more than any weapon in the ladder.
//
// The rules, in the order they are checked, because each one is a thing the
// player must have actually done:
//
//   1. Be close. A takedown is a reach, not a shot.
//   2. Be behind them. Their back, not their front — the cone is generous
//      because this is a third-person game and exact rear arcs are miserable.
//   3. Be unseen. If any other body can see you, this is a fight, not a kill.
//   4. Be slow. Running up is a shove; crouch-walking up is a takedown.
//
// No noise at all. That is the entire point: the only kill in the game that
// costs the player nothing but time and nerve.

import { angleDelta } from "./combat.js";

export const TAKEDOWN = {
  /** Furthest centre-to-centre distance, in metres. */
  reach: 1.7,
  /** How far behind the body's facing counts as "behind", in radians. */
  rearCone: Math.PI * 0.62,
  /** Another body closer than this which can see the player spoils it. */
  witnessRange: 18,
  /** A running approach is a shove, not a takedown. */
  maxSpeed: 1.9,
  /** How long the animation locks the player, so it reads as a move not a cut. */
  duration: 0.75,
  /** Score multiplier over a loud kill, because it costs the most. */
  reward: 2.4,
};

/**
 * Can the player take this body down? Returns a verdict with a reason, so the
 * HUD can tell the player what they are missing rather than staying silent.
 */
export function canTakedown(player, enemy, others = [], opts = {}) {
  const R = { ...TAKEDOWN, ...opts };
  if (!player || !enemy || enemy.dead) return { ok: false, reason: "no-target" };
  const dx = enemy.root.position.x - player.x;
  const dz = enemy.root.position.z - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist > R.reach) return { ok: false, reason: "far", distance: dist };

  // The body's own facing. If it is looking at the player, this is a fight.
  const bodyYaw = enemy.root.rotation?.y ?? 0;
  const toPlayer = Math.atan2(player.x - enemy.root.position.x, player.z - enemy.root.position.z);
  const behind = Math.abs(angleDelta(toPlayer, bodyYaw));
  // `behind` is 0 when the player is directly in the body's line of sight and
  // pi when directly behind it, so the test is inverted on purpose.
  if (behind < Math.PI - R.rearCone) return { ok: false, reason: "seen-by-target", angle: behind };

  if ((player.speed ?? 0) > R.maxSpeed) return { ok: false, reason: "too-fast" };

  // Witnesses: anything else that can see the player turns this into a fight.
  for (const other of others) {
    if (!other || other === enemy || other.dead) continue;
    const od = Math.hypot(other.root.position.x - player.x, other.root.position.z - player.z);
    if (od > R.witnessRange) continue;
    const oy = other.root.rotation?.y ?? 0;
    const facingPlayer = Math.abs(
      angleDelta(
        Math.atan2(player.x - other.root.position.x, player.z - other.root.position.z),
        oy,
      ),
    );
    // Within ~62 degrees of its facing and close enough to matter.
    if (facingPlayer < 1.1) return { ok: false, reason: "witnessed", witness: other };
  }

  return { ok: true, reason: "ready", distance: dist, behind };
}

/**
 * The move itself. Runs the kill, holds the sim for `duration`, and reports what
 * to do to the score. Kept separate from `canTakedown` so the check can drive a
 * prompt every frame without side effects.
 */
export function performTakedown(player, enemy, { run = null, onKill = null } = {}) {
  if (!enemy || enemy.dead) return null;
  enemy.die?.();
  enemy.takenDown = true;
  // No noise, no alert, no recoil: the whole reward is the absence of everything.
  if (run?.registerKill) run.registerKill({ quiet: true, archetype: enemy.stats?.archetype });
  onKill?.(enemy);
  return {
    enemy,
    duration: TAKEDOWN.duration,
    reward: TAKEDOWN.reward,
    silent: true,
  };
}

/**
 * Which body, if any, is takedown-able right now. Picks the closest eligible
 * one, so a prompt appears for the body the player meant rather than an
 * arbitrary member of a crowd.
 */
export function findTakedownTarget(player, live = [], opts = {}) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of live) {
    if (!enemy || enemy.dead) continue;
    const verdict = canTakedown(player, enemy, live, opts);
    if (!verdict.ok) continue;
    if (verdict.distance < bestDist) {
      bestDist = verdict.distance;
      best = { enemy, verdict };
    }
  }
  return best;
}

/**
 * Why the player cannot do it, in words the HUD can show. Silence is the worst
 * possible feedback: a player who cannot tell "too far" from "watched" learns
 * nothing about the game's rules.
 */
export function promptFor(verdict) {
  switch (verdict?.reason) {
    case "ready": return "Take down";
    case "far": return "Get closer";
    case "seen-by-target": return "Behind them";
    case "too-fast": return "Slow down";
    case "witnessed": return "Watched";
    default: return null;
  }
}
