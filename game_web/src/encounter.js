// Encounter shape.
//
// Measured problem: with the current stat lines, a Pack dies in 0.4 s of
// machine-gun fire and a Runner in 1.0 s. A wave of five bodies is two seconds of
// shooting. That is why 15 waves clear in 1.7 minutes — the bodies are the
// problem, not the number of waves.
//
// An encounter that lasts 3-5 minutes cannot be made of things that die
// instantly. It needs four properties, and this module is the arithmetic for all
// four so a designer can check a level before playing it:
//
//  1. **Time to kill** — a body must survive long enough to be a decision. 2-4 s
//     for a basic enemy, 10-25 s for a heavy.
//  2. **Arrival pacing** — bodies must not all arrive at once, because a fight
//     that is over before it started is not difficulty, it is a cutscene.
//  3. **Cover and reload** — the player must be forced to stop shooting, or the
//     fight is a hose. Ammo economy is the pressure that makes cover matter.
//  4. **Escalation inside the fight** — the last third must differ from the first,
//     or a 4-minute fight is the same 30 seconds repeated eight times.
//
// The numbers below are the tuning surface. They are deliberately not buried in
// the archetype table, because retuning a fight should not mean editing enemies.

/**
 * Target seconds-to-kill by weight class, measured against the weapon the player
 * is expected to be holding at that point in the campaign.
 */
export const TTL_TARGET = {
  /** Trash: dies fast, exists to make the player move and spend ammo. */
  light: { min: 1.2, max: 2.5 },
  /** Standard: the bulk of a fight. */
  medium: { min: 2.5, max: 5 },
  /** Armoured: forces a weapon change or a flank. */
  heavy: { min: 8, max: 18 },
  /** Boss: a phase, not a body. */
  boss: { min: 40, max: 120 },
};

/** Which weight class each archetype is. */
export const WEIGHT = {
  pack: "light",
  flyer: "light",
  runner: "medium",
  watcher: "light",
  sniper: "medium",
  brute: "heavy",
  heavy: "heavy",
};

/**
 * Effective health a body needs to hit a target time-to-kill against a given dps.
 * `dps` should be the *player's expected* damage per second at that point, after
 * armour: pass `weaponDps * (1 - armour)`.
 */
export function healthForTtl(targetSeconds, effectiveDps) {
  if (!Number.isFinite(effectiveDps) || effectiveDps <= 0) return 1;
  return Math.round(targetSeconds * effectiveDps);
}

/**
 * How long a fight lasts, given the bodies and the player's real output.
 *
 * `bodies` is a list of `{ health, armour }`. Returns seconds, assuming the player
 * engages one at a time — which is optimistic, and that is the point: if the
 * optimistic number is under the target, the fight is certainly too short.
 */
export function encounterSeconds(bodies, dps) {
  let total = 0;
  for (const b of bodies) {
    const effective = dps * (1 - (b.armour ?? 0));
    if (effective <= 0) return Infinity;
    total += b.health / effective;
  }
  return total;
}

/**
 * How many bodies of a given kind are needed for a target duration.
 * Rounded up, with a warning if the answer is absurd.
 */
export function bodiesForSeconds(targetSeconds, body, dps) {
  const per = encounterSeconds([body], dps);
  if (!Number.isFinite(per) || per <= 0) return 1;
  return Math.max(1, Math.ceil(targetSeconds / per));
}

/**
 * Audits an encounter against the shape it claims to have.
 *
 * Returns `{ ok, seconds, problems[] }`. This is what a mission should be checked
 * against before it is called finished, because "it felt fine" is not a
 * measurement and the current content was called finished while lasting 1.7
 * minutes.
 */
export function auditEncounter(bodies, { dps = 20, target = { min: 60, max: 300 } } = {}) {
  const problems = [];
  const seconds = encounterSeconds(bodies, dps);
  if (seconds < target.min) {
    problems.push(`too short: ${seconds.toFixed(1)}s for a target of ${target.min}-${target.max}s`);
  }
  if (seconds > target.max) {
    problems.push(`too long: ${seconds.toFixed(1)}s for a target of ${target.min}-${target.max}s`);
  }
  // A fight needs at least three distinct bodies or it has no shape.
  if (bodies.length < 3) {
    problems.push(`only ${bodies.length} bodies: an encounter needs at least three`);
  }
  // And it must include something that is not trash, or there is nothing to decide.
  const hasWeight = bodies.some((b) => (b.health ?? 0) >= 120 || (b.armour ?? 0) >= 0.3);
  if (!hasWeight) problems.push("no armoured or heavy body: nothing forces a decision");
  return { ok: problems.length === 0, seconds, problems };
}

/**
 * Propose a body list for a target duration, from an archetype table.
 *
 * Deliberately naive — it fills with medium bodies then adds one heavy, because an
 * encounter made entirely of the same body is the thing this module exists to
 * prevent. A designer overrides the result; this is a starting point that is
 * already the right *shape*, not a generator of finished fights.
 */
export function shapeEncounter(archetypes, { target = 150, dps = 20 } = {}) {
  const byWeight = { light: [], medium: [], heavy: [] };
  for (const [name, def] of Object.entries(archetypes)) {
    const w = WEIGHT[name] ?? "medium";
    byWeight[w].push({ name, health: def.health, armour: def.armour ?? 0 });
  }
  const out = [];
  let seconds = 0;
  // One heavy first: the fight should announce that it is serious.
  if (byWeight.heavy.length) {
    const h = byWeight.heavy[0];
    out.push(h);
    seconds += encounterSeconds([h], dps);
  }
  // Then mediums to fill, with a light between each for rhythm.
  let i = 0;
  while (seconds < target && out.length < 40) {
    const pool = i % 3 === 2 && byWeight.light.length ? byWeight.light : byWeight.medium;
    const pick = (pool.length ? pool : byWeight.medium)[i % Math.max(1, (pool.length || byWeight.medium.length))];
    if (!pick) break;
    out.push(pick);
    seconds += encounterSeconds([pick], dps);
    i += 1;
  }
  return { bodies: out, seconds };
}
