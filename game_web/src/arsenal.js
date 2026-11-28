// The arsenal: what the player can hold, in the order they earn it.
//
// Design intent, stated once so the data below can be judged against it:
//
//  1. The game opens with nothing. A player who starts with a rifle has already
//     skipped the part of a fight that is about nerve.
//  2. Every step up the ladder changes *how* a fight is won, not just how much
//     damage a hit does. Reach, noise and whether it kills quietly are the axes
//     that matter; damage per second is the least interesting one.
//  3. Louder and stronger are the same trade. A shotgun ends a fight in one
//     second and pulls every collector within 40 m toward you; a knife ends it
//     in three and pulls nobody.
//  4. Nothing here is a reskin. Each entry names a real model in
//     assets/arsenal/weapons (Kenney's weapon and blaster packs, CC0); the
//     melee entries point at the same pack's knives and the blaster pack's
//     heavier silhouettes for the improvised tier.
//
// Numbers are tuned to the existing simulation, whose player walks at 1.35 m/s
// and whose collectors patrol at ~1 m/s: an effective range of 8 m is a real
// threat in a 12 m street, and 24 m is a whole city block.

/** How a weapon is used, which decides what the animation and the input do. */
import { applyMods, modById, modsFor } from "./mods.js";

export const MODE = {
  MELEE: "melee", // a swing with a short arc; silent
  THROWN: "thrown", // one use, silent-ish, then gone
  SIDEARM: "sidearm", // single shots, accurate, moderate noise
  AUTO: "auto", // holds down, spreads
  SPREAD: "spread", // one trigger pull, many projectiles
  SCOPE: "scope", // one shot, long range, very loud
  HEAVY: "heavy", // slow, enormous, deafening
};

/** What the damage is good against. Enemies carry resistances. */
export const DAMAGE = {
  BLUNT: "blunt",
  BLADE: "blade",
  BALLISTIC: "ballistic",
  ENERGY: "energy",
  EXPLOSIVE: "explosive",
};

/**
 * The ladder. Ordered: index is the tier at which it becomes available, so a
 * run that never kills anything never sees past the fists.
 *
 * `noise` is the radius in metres within which collectors are alerted by a use.
 * `reach` is effective range. `rate` is seconds between uses.
 */
export const WEAPONS = [
  {
    id: "fists",
    name: "Fists",
    mode: MODE.MELEE,
    damage: DAMAGE.BLUNT,
    power: 8,
    reach: 1.3,
    rate: 0.55,
    noise: 2,
    ammo: Infinity,
    tier: 0,
    model: null,
    sound: "swing",
    // A punch is a commitment: it costs stamina and pulls the shoulder across.
    stamina: 6,
  },
  {
    id: "knife",
    name: "Utility knife",
    mode: MODE.MELEE,
    damage: DAMAGE.BLADE,
    power: 22,
    reach: 1.6,
    rate: 0.42,
    noise: 3,
    ammo: Infinity,
    tier: 1,
    model: "knife_sharp",
    sound: "blade",
    stamina: 4,
    // Blades ignore half of a target's armour: that is why the quiet route is
    // also the route that works on the armoured enemy later.
    armourPierce: 0.5,
  },
  {
    id: "pistol",
    name: "Pistol",
    mode: MODE.SIDEARM,
    damage: DAMAGE.BALLISTIC,
    power: 26,
    reach: 12,
    rate: 0.45,
    noise: 26,
    ammo: 12,
    reserve: 60,
    tier: 2,
    model: "pistol",
    sound: "pistolShot",
  },
  {
    id: "pistolSilencer",
    name: "Silenced pistol",
    mode: MODE.SIDEARM,
    damage: DAMAGE.BALLISTIC,
    power: 22,
    reach: 11,
    rate: 0.5,
    // The whole point of this weapon: it barely makes a sound.
    noise: 7,
    ammo: 12,
    reserve: 48,
    tier: 3,
    model: "pistolSilencer",
    sound: "silencedShot",
  },
  {
    id: "uzi",
    name: "Machine pistol",
    mode: MODE.AUTO,
    damage: DAMAGE.BALLISTIC,
    power: 14,
    reach: 9,
    rate: 0.11,
    noise: 30,
    ammo: 32,
    reserve: 160,
    tier: 4,
    model: "uzi",
    sound: "autoShot",
    spread: 0.055,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    mode: MODE.SPREAD,
    damage: DAMAGE.BALLISTIC,
    power: 13,
    pellets: 7,
    reach: 7,
    rate: 0.85,
    noise: 38,
    ammo: 6,
    reserve: 36,
    tier: 5,
    model: "shotgun",
    sound: "shotgunBlast",
    spread: 0.16,
  },
  {
    id: "sniper",
    name: "Rifle",
    mode: MODE.SCOPE,
    damage: DAMAGE.BALLISTIC,
    power: 120,
    reach: 60,
    rate: 1.15,
    noise: 55,
    ammo: 5,
    reserve: 25,
    tier: 6,
    model: "sniper",
    sound: "rifleCrack",
  },
  {
    id: "machinegun",
    name: "Machine gun",
    mode: MODE.AUTO,
    damage: DAMAGE.BALLISTIC,
    power: 18,
    reach: 14,
    rate: 0.09,
    noise: 44,
    ammo: 75,
    reserve: 300,
    tier: 7,
    model: "machinegun",
    sound: "autoShot",
    spread: 0.07,
  },
  {
    id: "flamethrower",
    name: "Burner",
    mode: MODE.AUTO,
    damage: DAMAGE.ENERGY,
    power: 9,
    reach: 6,
    rate: 0.08,
    noise: 20,
    ammo: 120,
    reserve: 240,
    tier: 8,
    model: "flamethrower_long",
    sound: "flame",
    spread: 0.12,
    // Fire keeps burning: damage over time, applied by the world.
    burn: 3.5,
  },
  {
    id: "rocketlauncher",
    role: "heavy",
    name: "Launcher",
    mode: MODE.HEAVY,
    damage: DAMAGE.EXPLOSIVE,
    power: 90,
    splash: 6,
    reach: 30,
    rate: 1.6,
    noise: 70,
    ammo: 1,
    reserve: 8,
    tier: 9,
    model: "rocketlauncher",
    sound: "launcherThump",
  },
  {
    id: "blaster",
    name: "Salvaged blaster",
    mode: MODE.SIDEARM,
    damage: DAMAGE.ENERGY,
    power: 34,
    reach: 16,
    rate: 0.34,
    noise: 12,
    ammo: 20,
    reserve: 100,
    tier: 10,
    model: "blaster-d",
    sound: "energyZap",
  },
  {
    id: "grenade",
    role: "thrown",
    name: "Frag",
    mode: MODE.THROWN,
    damage: DAMAGE.EXPLOSIVE,
    power: 70,
    splash: 5,
    reach: 18,
    rate: 1.2,
    noise: 60,
    ammo: 1,
    reserve: 6,
    tier: 3,
    model: "grenade-a",
    sound: "launcherThump",
  },
];

const BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));

export function weaponById(id) {
  return BY_ID.get(id) || WEAPONS[0];
}

/** Weapons a player at this tier may hold, best last. */
export function unlockedAt(tier) {
  return WEAPONS.filter((w) => w.tier <= tier);
}

/**
 * Armour is not a constant. A vest stops the first rounds and then stops
 * stopping them: plates crack, padding compresses, and a body that has taken
 * twenty hits is not protected the way it was at the first.
 *
 * This exists because without it the ladder has a hole. The brute carries 60%
 * armour, so a wave-6 uzi needed 37 rounds to kill one and carried 32 — the
 * weapon the game had just handed the player could not finish the fight it was
 * for. Decking the brute's armour instead would have broken the knife's
 * identity, which is that a blade goes *through* armour. The correct answer is
 * that sustained fire degrades armour, so:
 *
 *   - the knife still ignores half of it on the first hit (its identity)
 *   - volume of fire strips it (the machine pistol's identity)
 *   - a single pistol round does not (the pistol's identity)
 *
 * `priorHits` is how many times this target has already been hit.
 */
export function armourAt(baseArmour, priorHits = 0) {
  if (!baseArmour) return 0;
  // Each hit takes 12% of what is left, floored at a quarter of the original:
  // armour gets worse, never free.
  return baseArmour * Math.max(0.25, Math.pow(0.88, priorHits));
}

/**
 * What a use of this weapon actually delivers, after armour and range.
 * Kept as a pure function so the tests can check the ladder makes sense.
 *
 * armour: 0..1, fraction of a hit absorbed; armourPierce reduces it.
 * distance: metres to the target.
 * priorHits: hits this target has already taken, which degrades its armour.
 */
export function resolveHit(weapon, { armour = 0, distance = 0, priorHits = 0 } = {}) {
  if (distance > weapon.reach) return { damage: 0, hit: false, reason: "out of range" };
  const pierce = weapon.armourPierce ?? 0;
  const degraded = armourAt(armour, priorHits);
  const effectiveArmour = Math.max(0, degraded * (1 - pierce));
  // Damage falls off past half range for everything except melee.
  let falloff = 1;
  if (weapon.mode !== MODE.MELEE && distance > weapon.reach * 0.5) {
    falloff = 1 - 0.45 * ((distance - weapon.reach * 0.5) / (weapon.reach * 0.5));
  }
  const per = weapon.power * falloff;
  const hits = weapon.pellets ?? 1;
  // At long range a spread weapon loses pellets to the spread, not damage each.
  const landed = weapon.mode === MODE.SPREAD
    ? Math.max(1, Math.round(hits * (1 - 0.5 * (distance / Math.max(weapon.reach, 0.001)))))
    : hits;
  const raw = per * landed;
  const damage = Math.max(1, Math.round(raw * (1 - effectiveArmour)));
  return { damage, hit: true, landed, falloff, effectiveArmour, degraded };
}

/**
 * The player's held kit: which weapon is out, what ammo is left, and what has
 * been unlocked. Deliberately independent of the world so it can be tested and
 * so a run can be replayed from a seed plus a list of uses.
 */
export class Loadout {
  constructor({ tier = 0, ammo = {} } = {}) {
    this.tier = tier;
    this.owned = new Set(unlockedAt(tier).map((w) => w.id));
    this.current = this.owned.has("pistol") ? "pistol" : "fists";
    this.ammo = new Map();
    for (const w of WEAPONS) {
      if (ammo[w.id] !== undefined) this.ammo.set(w.id, ammo[w.id]);
      else if (Number.isFinite(w.ammo)) this.ammo.set(w.id, w.ammo);
    }
    this.reserve = new Map(WEAPONS.map((w) => [w.id, w.reserve ?? 0]));
    this.cooldown = 0;
    this.swinging = 0;
    // True while the held weapon is the one the game gave the player rather than
    // one they asked for. Starts true: the opening loadout is not a choice.
    this.autoPicked = true;
    // Mods fitted per weapon, so a build is a property of the gun rather than of
    // the run. Empty until the player is offered one.
    this.mods = new Map();
  }

  /**
   * The weapon as it actually is: base stats with any fitted mods applied.
   *
   * Everything downstream reads this, so fitting a suppressor changes what the
   * combat loop sees rather than being a number on a sheet.
   */
  get weapon() {
    const base = weaponById(this.current);
    const fitted = this.mods.get(base.id);
    if (!fitted || !fitted.length) return base;
    return applyMods(base, fitted);
  }

  /** Fit a mod to a weapon, replacing whatever is in that slot. */
  fitMod(weaponId, modId) {
    const mod = modById(modId);
    if (!mod) return false;
    const base = weaponById(weaponId);
    if (!base || !modsFor(base).some((m) => m.id === modId)) return false;
    // Mods compete by `kind`, which is the slot. Reading `.slot` here compared
    // undefined to undefined and let every mod stack, which silently turned a
    // choice into a shopping list.
    const fitted = (this.mods.get(weaponId) ?? []).filter((id) => modById(id)?.kind !== mod.kind);
    fitted.push(modId);
    this.mods.set(weaponId, fitted);
    return true;
  }

  /** Which mods are on a weapon. */
  modsOn(weaponId) {
    return [...(this.mods.get(weaponId) ?? [])];
  }

  /** Unlock everything up to a tier, without touching ammo already spent. */
  raiseTier(tier) {
    this.tier = Math.max(this.tier, tier);
    for (const w of unlockedAt(this.tier)) this.owned.add(w.id);
    // Draw the best thing that just became available, unless the player has
    // deliberately chosen something.
    //
    // Without this the player keeps whatever they were holding when the tier
    // rose — which in practice is fists, because the opening weapon is fists and
    // nothing ever put a gun in their hands. A run could reach the boss on wave
    // ten and be fighting it bare-handed. `autoPicked` is what separates "the
    // game handed me this" from "I chose this": a player who picks the knife
    // back up keeps it, and one who never chooses always carries the best.
    if (this.autoPicked) {
      // The last thing *worth drawing*, not the last thing unlocked. The ladder
      // ends with thrown and specialist weapons (a grenade, a rocket launcher),
      // and handing a player a grenade as their primary because it happens to
      // sort last is how an auto-equip quietly ruins a run.
      const drawable = unlockedAt(this.tier).filter((w) => !w.role || w.role === "primary");
      const best = drawable.at(-1);
      if (best && this.owned.has(best.id) && best.id !== this.current) {
        this.current = best.id;
      }
    }
    return this;
  }

  has(id) {
    return this.owned.has(id);
  }

  /** Switch to a weapon by id, or to the next one up/down. Returns the new id. */
  select(id, { byPlayer = true } = {}) {
    if (id && this.owned.has(id)) {
      this.current = id;
      if (byPlayer) this.autoPicked = false;
      return this.current;
    }
    return this.current;
  }

  cycle(direction = 1) {
    const list = unlockedAt(this.tier).filter((w) => this.owned.has(w.id)).map((w) => w.id);
    if (!list.length) return this.current;
    const at = list.indexOf(this.current);
    const next = (at + direction + list.length) % list.length;
    this.current = list[next];
    return this.current;
  }

  /** Rounds left for the held weapon. Melee is always ready. */
  roundsLeft() {
    const w = this.weapon;
    if (!Number.isFinite(w.ammo)) return Infinity;
    return this.ammo.get(w.id) ?? 0;
  }

  reserveLeft() {
    return this.reserve.get(this.weapon.id) ?? 0;
  }

  /**
   * Consume one use of the held weapon. Returns what the use was worth, or
   * null when it could not happen (cooldown, empty magazine).
   */
  use(dt = 0) {
    if (this.cooldown > 0) return null;
    const w = this.weapon;
    if (Number.isFinite(w.ammo)) {
      const left = this.ammo.get(w.id) ?? 0;
      if (left <= 0) {
        // Dry fire still takes time, so an empty gun is not a free pass.
        this.cooldown = 0.25;
        return { weapon: w, dry: true };
      }
      this.ammo.set(w.id, left - 1);
    }
    this.cooldown = w.rate;
    if (w.mode === MODE.MELEE) this.swinging = 0.22;
    return { weapon: w, dry: false };
  }

  /** Reload: top up from reserve. Returns rounds moved. */
  reload() {
    const w = this.weapon;
    if (!Number.isFinite(w.ammo)) return 0;
    const left = this.ammo.get(w.id) ?? 0;
    const pool = this.reserve.get(w.id) ?? 0;
    const need = w.ammo - left;
    if (need <= 0 || pool <= 0) return 0;
    const moved = Math.min(need, pool);
    this.ammo.set(w.id, left + moved);
    this.reserve.set(w.id, pool - moved);
    this.cooldown = Math.max(this.cooldown, 0.7);
    return moved;
  }

  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.swinging = Math.max(0, this.swinging - dt);
  }

  /** Plain snapshot for the HUD and for the tests. */
  snapshot() {
    const w = this.weapon;
    return {
      id: w.id,
      name: w.name,
      tier: w.tier,
      mode: w.mode,
      ammo: this.roundsLeft(),
      reserve: this.reserveLeft(),
      owned: [...this.owned],
      reloading: this.cooldown > 0 && w.rate > 0.6,
    };
  }
}
