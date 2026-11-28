// Bosses.
//
// A wave ladder of the same five bodies gets faster and then stops being a
// ladder. What it lacks is a memory: a fight you will describe afterwards. That
// is what a boss is for, and it is not a health bar.
//
// A boss here is a body with a rule the player has to learn and can beat. Each
// one is built from a model that already exists in the repo — the six-metre
// Enemy_Large rig, scaled — because writing a boss that needs assets the project
// does not have is how a feature becomes a wish.
//
// Design constraint, applied to all three: every boss attack must be survivable
// if you understood it, and must be telegraphed before it lands. Difficulty that
// comes from surprise is not difficulty.

/**
 * Boss definition.
 *
 * `phases` is the interesting part. A boss that behaves identically at 10% and
 * 100% health is a wall with a number on it. Each phase changes one thing about
 * how the fight works, and the change is announced (the HUD gets `phase`), so it
 * reads as escalation rather than a difficulty spike.
 */
export const BOSSES = {
  /** Slow, armoured, and closes out the game's first act. */
  enforcer: {
    id: "enforcer",
    name: "The Enforcer",
    title: "Act I",
    archetype: "brute",
    model: "cyberpunk_pack__Enemy_Large",
    health: 620,
    armour: 0.45,
    speed: 1.05,
    scale: 1.35,
    height: 3.1,
    // One rule: it charges. The tell is a wind-up that costs it its footing, so
    // the punish window is the mistake it made, not a random opening.
    attack: { kind: "charge", power: 46, reach: 8.5, rate: 2.6, windup: 0.9, recover: 1.1 },
    phases: [
      { at: 1.0, name: "Advance", speed: 1.05, note: "Walks you down" },
      { at: 0.55, name: "Bloodied", speed: 1.35, note: "Charges more often" },
      { at: 0.22, name: "Cornered", speed: 1.5, note: "Stops recovering" },
    ],
    // What makes it a boss rather than a big brute: it is not fooled by the same
    // trick twice, and spotting the player is not the same as reaching them.
    ignoresTakedown: true,
    tone: 0x8a5a4a,
  },

  /** Ranged, patient, and the act two answer to the rifle. */
  marksman: {
    id: "marksman",
    name: "The Marksman",
    title: "Act II",
    archetype: "sniper",
    model: "cyberpunk_pack__Enemy_2Legs_Gun",
    health: 460,
    armour: 0.2,
    speed: 1.2,
    scale: 1.18,
    height: 2.1,
    attack: { kind: "ranged", power: 62, reach: 60, rate: 3.4, windup: 1.35, recover: 1.15 },
    phases: [
      { at: 1.0, name: "Sighting", speed: 1.2, note: "Glints before it fires" },
      { at: 0.6, name: "Repositioning", speed: 1.9, note: "Moves after every shot" },
      { at: 0.25, name: "Desperate", speed: 2.2, note: "Fires twice" },
    ],
    // A marksman who stands still is a target. A marksman who never stands still
    // is unfair. This one relocates *after* firing, which is learnable.
    relocatesAfterShot: true,
    tone: 0x6a7a8a,
  },

  /** The end. Everything the player has learned, tested at once. */
  warden: {
    id: "warden",
    name: "The Warden",
    title: "Act III",
    archetype: "heavy",
    model: "cyberpunk_pack__Enemy_Large_Gun",
    health: 900,
    armour: 0.55,
    speed: 0.95,
    scale: 1.5,
    height: 3.45,
    attack: { kind: "explosive", power: 58, reach: 26, rate: 2.8, splash: 4.5, windup: 1.1, recover: 1.25 },
    phases: [
      { at: 1.0, name: "Garrison", speed: 0.95, note: "Shells you from range" },
      { at: 0.65, name: "Breached", speed: 1.15, note: "Calls the street in" },
      { at: 0.3, name: "Last stand", speed: 1.35, note: "Fights at contact" },
    ],
    summons: { at: 0.65, archetype: "pack", count: 2 },
    ignoresTakedown: true,
    tone: 0x7a5a7a,
  },
};

/** Which wave each boss appears on. One per act, then none. */
export const BOSS_WAVES = { 10: "enforcer", 20: "marksman", 30: "warden" };

/** Is this wave a boss wave, and which boss? */
export function bossForWave(waveNumber) {
  const id = BOSS_WAVES[waveNumber];
  return id ? BOSSES[id] : null;
}

/**
 * The stat line a boss is spawned with, derived from its definition and the
 * wave's difficulty scale so a boss on a replay is not a pushover.
 */
export function bossStats(boss, waveScale = 1) {
  return {
    archetype: `boss_${boss.id}`,
    label: boss.name,
    boss: boss.id,
    health: Math.round(boss.health * waveScale),
    armour: boss.armour,
    speed: boss.speed,
    sight: boss.attack.reach + 8,
    fov: 0.7,
    height: boss.height,
    scale: boss.scale,
    model: boss.model,
    tone: boss.tone,
    attack: boss.attack,
    ignoresTakedown: boss.ignoresTakedown ?? false,
    phases: boss.phases,
  };
}

/** Which phase is active at a given health fraction. */
export function phaseAt(boss, healthFraction) {
  if (!boss?.phases?.length) return null;
  // `at` is the health fraction at which a phase *begins*, and the list descends.
  // The active phase is the lowest threshold the player has not yet fallen past —
  // i.e. the last phase in the list whose threshold is still at or above current
  // health. Walking the list forwards and taking the first phase below health
  // picks the wrong one a third of the time.
  const above = boss.phases.filter((p) => p.at >= healthFraction);
  return above.length ? above[above.length - 1] : boss.phases[boss.phases.length - 1];
}

/**
 * Has the boss crossed into a new phase this frame?
 *
 * Returns the new phase only on the frame the threshold is crossed, so the HUD
 * announces it once rather than every frame after.
 */
export function phaseCrossed(boss, before, after) {
  if (!boss?.phases?.length) return null;
  const a = phaseAt(boss, before);
  const b = phaseAt(boss, after);
  return a && b && a !== b ? b : null;
}

/**
 * What a boss does when it is not simply walking at you.
 *
 * Kept as a rule with an explicit clock rather than a state machine scattered
 * through the step loop: `windup` is time spent telegraphing, `active` is when
 * the blow lands, `recover` is the punish window. Every boss attack goes through
 * this, so none of them can be an unreadable instant hit.
 */
export const BOSS_ACTION = {
  windup: "windup",
  strike: "strike",
  recover: "recover",
  idle: "idle",
};

/**
 * Advance a boss's action clock by dt and report what happened.
 * Returns { state, changed, damage, hit } where `hit` is true only on the frame
 * the strike actually lands, so the caller applies damage once.
 */
export function tickBossAction(clock, attack, dt) {
  const out = { state: clock.state, changed: false, hit: false, damage: 0 };
  const windup = attack.windup ?? 0.6;
  const recover = attack.recover ?? 0.9;

  if (clock.state === BOSS_ACTION.idle) {
    // Not attacking; the caller decides when to start one.
    return out;
  }
  clock.t += dt;
  if (clock.state === BOSS_ACTION.windup && clock.t >= windup) {
    clock.state = BOSS_ACTION.strike;
    clock.t = 0;
    out.state = clock.state;
    out.changed = true;
    out.hit = true;
    out.damage = attack.power;
    return out;
  }
  if (clock.state === BOSS_ACTION.strike && clock.t >= 0.12) {
    clock.state = BOSS_ACTION.recover;
    clock.t = 0;
    out.state = clock.state;
    out.changed = true;
    return out;
  }
  if (clock.state === BOSS_ACTION.recover && clock.t >= recover) {
    clock.state = BOSS_ACTION.idle;
    clock.t = 0;
    out.state = clock.state;
    out.changed = true;
  }
  return out;
}

/** Start an attack. Returns the clock, so the caller stores one per boss. */
export function beginBossAction() {
  return { state: BOSS_ACTION.windup, t: 0 };
}

/**
 * How long a boss telegraphs before it can hurt you, in seconds. The HUD shows a
 * bar for this, and the audio layer plays a rising tone, so the window is
 * readable without looking at a health bar.
 */
export function telegraphSeconds(boss) {
  return boss?.attack?.windup ?? 0.6;
}
