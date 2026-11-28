// The roster: who comes for the player, and why each one is a different problem.
//
// The failure mode this file exists to avoid is the one where every enemy is
// the same body with a different colour and more health. Health scaling alone
// produces a game that gets *slower*, not harder. So each archetype changes one
// thing the player has to do:
//
//   watcher   — sees far, hits weakly, calls others. Punishes standing in the open.
//   runner    — fast, fragile, closes distance. Punishes reloading in the open.
//   brute     — slow, armoured. Blades beat it; bullets mostly do not. Punishes
//               panic-firing.
//   flyer     — above the street lamps, ignores ground cover. Forces vertical
//               awareness and rewards the weapons with reach.
//   pack      — small, many, cheap. Punishes a player who fights one at a time.
//   heavy     — ranged, explosive, slow to turn. Punishes standing still.
//   sniper    — long range, one shot, glints before firing. Punishes open lanes.
//
// Every archetype names a real rigged model from assets/arsenal/enemies
// (Quaternius and Kenney packs, CC0). The `model` is a file stem; if the file is
// missing the world falls back to a procedural silhouette rather than crashing.

export const ARCHETYPE = {
  WATCHER: "watcher",
  RUNNER: "runner",
  BRUTE: "brute",
  FLYER: "flyer",
  PACK: "pack",
  HEAVY: "heavy",
  SNIPER: "sniper",
};

/**
 * Base stat line per archetype. `speed` is m/s, `sight` is metres, `health` is
 * in the same units the arsenal's damage is in (a pistol does 26 a hit).
 */
export const ARCHETYPES = {
  [ARCHETYPE.WATCHER]: {
    label: "Watcher",
    health: 60,
    armour: 0.1,
    speed: 0.95,
    sight: 16,
    fov: 0.62,
    attack: null, // does not attack; calls
    calls: true,
    model: "cyberpunk_pack__Enemy_2Legs",
    height: 1.8,
    tone: 0x6f8fa8,
  },
  [ARCHETYPE.RUNNER]: {
    label: "Runner",
    health: 40,
    armour: 0,
    speed: 2.4,
    sight: 13,
    fov: 0.7,
    attack: { kind: "melee", power: 14, reach: 1.5, rate: 0.9 },
    model: "platformer_game_pack__Character",
    height: 1.75,
    tone: 0xa86f6f,
  },
  [ARCHETYPE.BRUTE]: {
    label: "Brute",
    health: 220,
    armour: 0.6,
    speed: 0.85,
    sight: 12,
    fov: 0.55,
    attack: { kind: "melee", power: 34, reach: 1.9, rate: 1.4 },
    model: "cyberpunk_pack__Enemy_Large",
    height: 2.4,
    tone: 0x8a7a6a,
  },
  [ARCHETYPE.FLYER]: {
    label: "Flyer",
    health: 45,
    armour: 0,
    speed: 2.0,
    sight: 18,
    fov: 0.8,
    flyHeight: 3.2,
    attack: { kind: "ranged", power: 9, reach: 14, rate: 1.1 },
    model: "cyberpunk_pack__Enemy_Flying",
    height: 1.2,
    tone: 0x8f6fa8,
  },
  [ARCHETYPE.PACK]: {
    label: "Pack",
    health: 18,
    armour: 0,
    speed: 2.8,
    sight: 11,
    fov: 0.9,
    attack: { kind: "melee", power: 6, reach: 1.2, rate: 0.7 },
    model: "easy_enemies_pack__Spider",
    height: 0.5,
    tone: 0x6a8a6a,
    spawns: 5,
  },
  [ARCHETYPE.HEAVY]: {
    label: "Heavy",
    health: 160,
    armour: 0.35,
    speed: 0.7,
    sight: 15,
    fov: 0.5,
    turnRate: 0.9,
    attack: { kind: "explosive", power: 45, reach: 22, rate: 2.4, splash: 4 },
    model: "cyberpunk_pack__Enemy_Large_Gun",
    height: 2.3,
    tone: 0xa86f8a,
  },
  [ARCHETYPE.SNIPER]: {
    label: "Sniper",
    health: 55,
    armour: 0.15,
    speed: 0.9,
    sight: 45,
    fov: 0.35,
    attack: { kind: "ranged", power: 55, reach: 45, rate: 3.0 },
    model: "cyberpunk_pack__Enemy_2Legs_Gun",
    height: 1.8,
    tone: 0x8a8a6a,
    // A glint gives the player a warning and a direction: without it a 45 m
    // one-shot kill is an unfair death, and unfair is not difficulty.
    tells: { glint: 1.1 },
  },
};

/**
 * What the player faces at each wave. Each entry is a list of
 * `{ archetype, count }`; the wave's total health and threat are derived, not
 * hand-written, so the curve can be checked.
 */
export const WAVES = [
  { n: 1, name: "The street notices", spawn: [{ archetype: ARCHETYPE.PACK, count: 1 }], reward: 1 },
  { n: 2, name: "Watchers", spawn: [{ archetype: ARCHETYPE.WATCHER, count: 1 }, { archetype: ARCHETYPE.PACK, count: 1 }], reward: 1 },
  { n: 3, name: "Runners", spawn: [{ archetype: ARCHETYPE.RUNNER, count: 3 }, { archetype: ARCHETYPE.WATCHER, count: 1 }], reward: 2 },
  { n: 4, name: "Eyes and teeth", spawn: [
    { archetype: ARCHETYPE.WATCHER, count: 2 },
    { archetype: ARCHETYPE.RUNNER, count: 2 },
    { archetype: ARCHETYPE.PACK, count: 1 },
  ], reward: 2 },
  { n: 5, name: "From above", spawn: [{ archetype: ARCHETYPE.FLYER, count: 2 }, { archetype: ARCHETYPE.PACK, count: 2 }], reward: 3 },
  { n: 6, name: "The brute", spawn: [
    { archetype: ARCHETYPE.BRUTE, count: 1 },
    { archetype: ARCHETYPE.RUNNER, count: 2 },
    { archetype: ARCHETYPE.WATCHER, count: 1 },
    { archetype: ARCHETYPE.FLYER, count: 3 },
  ], reward: 3 },
  { n: 7, name: "Crossfire", spawn: [
    { archetype: ARCHETYPE.SNIPER, count: 1 },
    { archetype: ARCHETYPE.HEAVY, count: 1 },
    { archetype: ARCHETYPE.BRUTE, count: 1 },
    { archetype: ARCHETYPE.RUNNER, count: 2 },
    { archetype: ARCHETYPE.WATCHER, count: 1 },
  ], reward: 4 },
  { n: 8, name: "The block", spawn: [
    { archetype: ARCHETYPE.BRUTE, count: 2 },
    { archetype: ARCHETYPE.WATCHER, count: 2 },
    { archetype: ARCHETYPE.HEAVY, count: 1 },
    { archetype: ARCHETYPE.SNIPER, count: 1 },
    { archetype: ARCHETYPE.RUNNER, count: 2 },
  ], reward: 4 },
  { n: 9, name: "Air and ground", spawn: [
    { archetype: ARCHETYPE.FLYER, count: 4 },
    { archetype: ARCHETYPE.PACK, count: 3 },
    { archetype: ARCHETYPE.BRUTE, count: 1 },
    { archetype: ARCHETYPE.HEAVY, count: 1 },
  ], reward: 5 },
  { n: 10, name: "Everything at once", spawn: [
    { archetype: ARCHETYPE.BRUTE, count: 1 },
    { archetype: ARCHETYPE.HEAVY, count: 1 },
    { archetype: ARCHETYPE.SNIPER, count: 1 },
    { archetype: ARCHETYPE.RUNNER, count: 2 },
    { archetype: ARCHETYPE.FLYER, count: 3 },
    { archetype: ARCHETYPE.PACK, count: 2 },
  ], reward: 6 },
];

/** Every enemy in a wave, expanded to individual spawns. */
export function waveEnemies(wave) {
  const out = [];
  for (const group of wave.spawn) {
    const def = ARCHETYPES[group.archetype];
    const count = (def.spawns ?? 1) * group.count;
    for (let i = 0; i < count; i++) out.push({ archetype: group.archetype, def });
  }
  return out;
}

/** Total health a wave presents, for checking the curve actually rises. */
export function waveHealth(wave) {
  return waveEnemies(wave).reduce((n, e) => n + e.def.health, 0);
}

/**
 * Difficulty of a wave as a single number: health is not the whole story, so
 * this weights what each archetype actually forces the player to do. A flyer is
 * worth more than its 45 health because ground cover does not apply to it.
 */
const THREAT_WEIGHT = {
  [ARCHETYPE.PACK]: 0.6,
  [ARCHETYPE.WATCHER]: 1.0,
  [ARCHETYPE.RUNNER]: 1.2,
  [ARCHETYPE.FLYER]: 1.8,
  [ARCHETYPE.BRUTE]: 2.2,
  [ARCHETYPE.SNIPER]: 2.4,
  [ARCHETYPE.HEAVY]: 2.6,
};

export function waveThreat(wave) {
  return Math.round(
    waveEnemies(wave).reduce(
      (n, e) => n + (THREAT_WEIGHT[e.archetype] ?? 1) * (1 + e.def.armour),
      0,
    ) * 10,
  ) / 10;
}

/** Waves are endless past the table: the table repeats with a rising scale. */
export function waveAt(n) {
  const base = WAVES[(n - 1) % WAVES.length];
  const lap = Math.floor((n - 1) / WAVES.length);
  if (lap === 0) return { ...base, n, scale: 1 };
  // Escalation is health and count, but the *mix* is what makes it harder; so
  // repeat the same shape with tougher bodies rather than throwing new types in.
  return { ...base, n, name: `${base.name} (ii)`.replace("(ii)", lap === 1 ? "again" : `x${lap + 1}`), scale: 1 + lap * 0.45 };
}

/** Stat line for one enemy of an archetype at a given wave scale. */
export function statLine(archetype, scale = 1) {
  const d = ARCHETYPES[archetype];
  return {
    ...d,
    archetype,
    health: Math.round(d.health * scale),
    armour: Math.min(0.85, d.armour * (1 + (scale - 1) * 0.35)),
    attack: d.attack
      ? { ...d.attack, power: Math.round(d.attack.power * (1 + (scale - 1) * 0.3)) }
      : null,
  };
}

// --------------------------------------------------------------- clip mapping
//
// The packs were authored by different people and name the same idea four ways:
// `Death` and `Dead`, `Run` and `Gallop`, `Frog_Attack` and `Attack`. Every clip
// also carries an armature prefix (`CharacterArmature|`). Rather than hard-code
// one pack's spelling and break when a wave uses another, map by *suffix* with
// synonyms and a documented fallback.

const CLIP_SYNONYMS = {
  idle: ["idle", "idle_neutral", "idle_gun", "idle_2", "flying", "float"],
  move: ["run", "walk", "gallop", "crawl", "swim"],
  attack: ["attack", "shoot", "gun_shoot", "punch", "punch_left", "punch_right", "kick_left", "kick_right", "bite"],
  hit: ["hitrecieve", "hit_recieve", "hitreact", "hitreact_left", "hitreact_right", "hitrecieve_2"],
  death: ["death", "dead", "die"],
};

/** The part of a clip name after the armature prefix, lowercased. */
export function clipSuffix(name) {
  const bar = name.indexOf("|");
  return (bar >= 0 ? name.slice(bar + 1) : name).toLowerCase();
}

/**
 * Map a pack's clip list onto the five states a combat body needs.
 *
 * Returns `{ idle, move, attack, hit, death, all }`, where any state may be
 * null: the wasp has no death clip and the snake has no death clip either, and
 * the view layer's job is to fade out instead of throwing. Missing `hit` is
 * common and is not an error — a beast that flinches on every bullet looks
 * worse than one that does not flinch at all.
 */
export function resolveClipMap(names = []) {
  const map = { idle: null, move: null, attack: null, hit: null, death: null, all: [...names] };
  for (const [state, synonyms] of Object.entries(CLIP_SYNONYMS)) {
    // Prefer an exact synonym match, then a suffix match, so `Idle_Gun_Shoot`
    // does not get picked for `idle` just because it contains the word.
    const exact = names.find((n) => synonyms.includes(clipSuffix(n)));
    if (exact) { map[state] = exact; continue; }
    const partial = names.find((n) => {
      const s = clipSuffix(n);
      return synonyms.some((syn) => s === syn || s.endsWith(`_${syn}`) || s.startsWith(`${syn}_`));
    });
    if (partial && !Object.values(map).includes(partial)) map[state] = partial;
  }
  // A body with no idle still needs a resting pose, and a hovering body has no
  // walk cycle because hovering *is* its walk: fill whichever one is missing
  // from the other.
  if (!map.idle && map.move) map.idle = map.move;
  if (!map.move && map.idle) map.move = map.idle;
  // Last resort for a body with neither: a body that cannot move its legs can
  // still be pushed, so the view layer plays nothing and moves the root.
  return map;
}

/**
 * Enemy bodies above their humanoid kits are authored at unknown scale. The
 * `.transformed` variants in the source packs are exported 100x, so a body is
 * normalised by its *measured* height rather than trusted to be in metres.
 */
export function scaleToHeight(measuredHeight, targetHeight) {
  if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return 1;
  return targetHeight / measuredHeight;
}
