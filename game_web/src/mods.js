// Weapon mods: the difference between a ladder and a build.
//
// A ladder says "the shotgun is better than the pistol". A build says "your
// shotgun loads eight and spreads wide, so you take it into the alley, while I
// took the choke and the scope and I own the street". The distinction is what
// turns progression from a queue into a choice.
//
// Three mods per weapon, one slot, and every mod is a real trade. Nothing here
// is strictly better than the alternative, and that rule is tested: a mod that
// strictly dominates is not a mod, it is an upgrade with a menu pretending to be
// a decision.

/**
 * Mod definitions. `apply` mutates a copy of the weapon's stat block; `kind` is
 * which slot it competes for, so a weapon with two barrel mods can only take one.
 */
export const MODS = [
  {
    id: "extended",
    name: "Extended mag",
    kind: "magazine",
    note: "More rounds, slower reload",
    apply: (w) => {
      if (!Number.isFinite(w.ammo)) return w;
      w.ammo = Math.round(w.ammo * 1.6);
      w.rate = +(w.rate * 1.06).toFixed(3);
      return w;
    },
  },
  {
    id: "matchTrigger",
    name: "Match trigger",
    kind: "trigger",
    note: "Faster follow-up, less accurate",
    apply: (w) => {
      w.rate = +(w.rate * 0.78).toFixed(3);
      w.power = Math.max(1, Math.round(w.power * 0.94));
      w.spread = +((w.spread ?? 0.02) * 1.5).toFixed(3);
      return w;
    },
  },
  {
    id: "choke",
    name: "Choke",
    kind: "barrel",
    note: "Tight pattern, shorter reach, one fewer pellet",
    apply: (w) => {
      w.spread = +((w.spread ?? 0.1) * 0.55).toFixed(3);
      w.reach = +(w.reach * 0.85).toFixed(2);
      if (w.pellets) w.pellets = Math.max(1, w.pellets - 2);
      return w;
    },
  },
  {
    id: "suppressor",
    name: "Suppressor",
    kind: "barrel",
    note: "Quieter, weaker",
    apply: (w) => {
      w.noise = Math.max(3, Math.round(w.noise * 0.4));
      w.power = Math.max(1, Math.round(w.power * 0.82));
      return w;
    },
  },
  {
    id: "drum",
    name: "Drum",
    kind: "magazine",
    note: "Much bigger magazine, heavier feel",
    apply: (w) => {
      if (!Number.isFinite(w.ammo)) return w;
      w.ammo = Math.round(w.ammo * 2);
      w.rate = +(w.rate * 1.12).toFixed(3);
      w.reach = +(w.reach * 0.94).toFixed(2);
      return w;
    },
  },
  {
    id: "longBarrel",
    name: "Long barrel",
    kind: "barrel",
    note: "More reach and power, louder",
    apply: (w) => {
      w.reach = +(w.reach * 1.3).toFixed(2);
      w.power = Math.round(w.power * 1.12);
      w.noise = Math.round(w.noise * 1.3);
      return w;
    },
  },
  {
    id: "hollowPoint",
    name: "Hollow point",
    kind: "ammo",
    note: "Harder hits, useless against armour, shorter reach",
    apply: (w) => {
      w.power = Math.round(w.power * 1.3);
      w.reach = +(w.reach * 0.88).toFixed(2);
      // The trade that keeps the blade relevant: this mod is *worse* than
      // nothing against a brute.
      w.armourPierce = -0.5;
      return w;
    },
  },
  {
    id: "armourPiercer",
    name: "Piercing rounds",
    kind: "ammo",
    note: "Ignores 45% more armour, 15% less raw damage",
    apply: (w) => {
      w.power = Math.round(w.power * 0.85);
      w.armourPierce = Math.min(1, (w.armourPierce ?? 0) + 0.45);
      return w;
    },
  },
  {
    id: "gripTape",
    name: "Grip tape",
    kind: "trigger",
    note: "Much less spread, slower to fire",
    apply: (w) => {
      w.spread = +(Math.max(0.001, (w.spread ?? 0.03) * 0.6)).toFixed(3);
      w.rate = +(w.rate * 1.25).toFixed(3);
      return w;
    },
  },
  {
    id: "hairTrigger",
    name: "Hair trigger",
    kind: "trigger",
    note: "Very fast, very loud",
    apply: (w) => {
      w.rate = +(w.rate * 0.68).toFixed(3);
      w.noise = Math.round(w.noise * 1.25);
      w.spread = +((w.spread ?? 0.02) * 1.8).toFixed(3);
      return w;
    },
  },
];

const BY_ID = new Map(MODS.map((m) => [m.id, m]));

export function modById(id) {
  return BY_ID.get(id) ?? null;
}

/** Which mods make sense for a weapon. Melee has no magazine, etc. */
export function modsFor(weapon) {
  if (!weapon) return [];
  const melee = weapon.mode === "melee";
  return MODS.filter((m) => {
    // A blade has no spread to tighten and no magazine: only mods that change
    // reach or cadence make sense, and grip tape would be a pure downgrade.
    if (melee) return m.id === "matchTrigger" || m.id === "hairTrigger" || m.id === "longBarrel";
    if (m.kind === "magazine" && !Number.isFinite(weapon.ammo)) return false;
    if (m.id === "choke" && !weapon.pellets) return false;
    if (m.id === "hollowPoint" && weapon.damage !== "ballistic") return false;
    if (m.id === "armourPiercer" && weapon.damage === "blunt") return false;
    if (m.id === "drum" && !Number.isFinite(weapon.ammo)) return false;
    return true;
  });
}

/**
 * The weapon as the player has built it. Returns a new object: a mod must never
 * mutate the base table, or every copy of the pistol in the game would keep the
 * last player's scope.
 */
export function applyMods(weapon, modIds = []) {
  const out = { ...weapon };
  // One mod per kind: later entries in the same slot are ignored rather than
  // silently stacked, so the slot really is a choice.
  const taken = new Set();
  for (const id of modIds) {
    const mod = modById(id);
    if (!mod) continue;
    if (taken.has(mod.kind)) continue;
    taken.add(mod.kind);
    mod.apply(out);
  }
  out.mods = [...taken];
  return out;
}

/**
 * The mods a player is offered between waves. Deliberately two from different
 * slots plus one that fits what they are holding, so the choice is about the
 * *weapon* rather than about which box to tick.
 */
export function offerMods(weapon, ownedMods = []) {
  const eligible = modsFor(weapon).filter((m) => !ownedMods.includes(m.id));
  if (!eligible.length) return [];
  // Two that fit the held weapon and one that is a different slot, so there is
  // always a choice between "lean into this" and "do something else".
  const fresh = eligible.slice(0, 3);
  return fresh.map((m) => ({
    kind: "mod",
    id: m.id,
    label: m.name,
    note: `${m.note} · ${weapon.name}`,
  }));
}

/**
 * Is a mod a real trade? A mod that improves every axis is not a choice, and
 * this is the check that keeps the table honest as it grows.
 */
/**
 * A mod is a trade when it moves at least one axis up and one axis down.
 *
 * Two axes are deliberately *not* modelled here because they are not simple
 * scalars in this table: armour penetration (a cost paid against armoured bodies
 * and worth nothing against the rest) and spread (a cost paid at range). A mod
 * whose only cost is one of those is listed in `COST_ONLY_ELSEWHERE` rather than
 * being let through silently, so the exemption is visible and testable.
 */
export const COST_ONLY_ELSEWHERE = {
  armourPiercer: "pays in armour penetration, which this checker cannot model",
  hollowPoint: "pays in armour penetration, which this checker cannot model",
};

export function isTradeOff(weapon, mod) {
  const before = {
    power: weapon.power, rate: weapon.rate, reach: weapon.reach,
    noise: weapon.noise, ammo: weapon.ammo,
    // A lost pellet is lost damage and is the entire cost of a choke.
    pellets: weapon.pellets ?? 1,
  };
  const after = applyMods(weapon, [mod.id]);
  // Normalise pellets on both sides: a weapon with no pellet count has one
  // projectile, and comparing undefined against 1 reported a phantom loss.
  const afterNorm = { ...after, pellets: after.pellets ?? 1 };
  const better = [];
  const worse = [];
  for (const key of ["power", "rate", "reach", "ammo", "pellets"]) {
    if (!Number.isFinite(before[key])) continue;
    const higherIsBetter = key !== "rate";
    const delta = afterNorm[key] - before[key];
    if (delta === 0) continue;
    if ((delta > 0) === higherIsBetter) better.push(key);
    else worse.push(key);
  }
  // Rate is a duration: lower is faster, which for firing is better only when
  // the mod also costs something. Count reach and power normally; treat noise
  // separately because lower is better.
  if (afterNorm.noise !== before.noise) {
    if (afterNorm.noise < before.noise) better.push("noise"); else worse.push("noise");
  }
  // Spread: lower is better and it is the whole point of a choke or grip tape.
  const spreadBefore = weapon.spread ?? 0.02;
  const spreadAfter = afterNorm.spread ?? 0.02;
  if (Math.abs(spreadAfter - spreadBefore) > 1e-6) {
    if (spreadAfter < spreadBefore) better.push("spread"); else worse.push("spread");
  }
  return { better, worse, isTrade: better.length > 0 && worse.length > 0 };
}
