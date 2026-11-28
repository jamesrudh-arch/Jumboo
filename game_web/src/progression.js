// Progression: the rule that ties the arsenal to the roster.
//
// The game is not "kill things to get a bigger gun". It is: the street escalates
// on a schedule you can read, and the tier you hold is a *response* to what has
// already been thrown at you. A player who never fights stays at fists and faces
// nothing but watchers; a player who clears wave six has earned the rifle axe.
//
// This module is pure: it takes a run state in and gives a decision out. The
// world owns the bodies, this owns the rules.

import { Loadout, weaponById, unlockedAt, WEAPONS } from "./arsenal.js";
import { offerMods } from "./mods.js";
import { bossForWave, bossStats } from "./bosses.js";
import { WAVES, waveAt, statLine, waveEnemies, waveThreat, ARCHETYPE } from "./enemies.js";

/**
 * The tier a player should hold when a wave begins. Deliberately *behind* the
 * wave number: the weapon answers the problem you just met, it does not pre-empt
 * the one you are about to meet.
 *
 *   wave 1  -> fists          (nothing to shoot, and nothing to shoot with)
 *   wave 2  -> knife          (a pack is a melee problem)
 *   wave 3  -> pistol         (runners are fast; reach matters)
 *   wave 5  -> silenced pistol (the wave after flyers teaches discretion)
 *   wave 6  -> uzi            (a brute needs volume, not precision)
 *   wave 7  -> shotgun        (crossfire at close range)
 *   wave 8  -> rifle          (the snipers have shown you what reach is)
 *   wave 9  -> machine gun    (air and ground at once)
 *   wave 10 -> burner         (the block will not stay still)
 *   wave 11 -> launcher       (everything at once)
 */
export function tierForWave(waveNumber) {
  if (waveNumber <= 1) return 0;
  if (waveNumber === 2) return 1;
  if (waveNumber <= 4) return 2;
  if (waveNumber === 5) return 3;
  if (waveNumber === 6) return 4;
  if (waveNumber === 7) return 5;
  if (waveNumber === 8) return 6;
  if (waveNumber === 9) return 7;
  if (waveNumber === 10) return 8;
  return 9 + Math.floor((waveNumber - 11) / 3);
}

/**
 * The order the game *hands out* weapons, which is not the same as tier order:
 * the frag is a side-arm you find early, not the reward for wave ten. Keeping a
 * separate ladder means an early-unlocked weapon can never outrank a later one
 * just because of how the arsenal table happens to be sorted.
 */
const REWARD_LADDER = [
  "fists", "knife", "pistol", "pistolSilencer", "uzi", "shotgun",
  "sniper", "machinegun", "flamethrower", "rocketlauncher", "blaster",
];

/** The weapon the game hands you for a wave: the top rung you have reached. */
export function rewardForWave(waveNumber) {
  const tier = tierForWave(waveNumber);
  // Highest rung on the ladder whose weapon is unlocked at this tier, so the
  // frag found at tier 3 does not block the shotgun earned at tier 5.
  let best = weaponById(REWARD_LADDER[0]);
  for (const id of REWARD_LADDER) {
    const w = weaponById(id);
    if (w.tier <= tier) best = w;
  }
  return best;
}

/**
 * What the player is offered between waves. Not a shop: three fixed choices so
 * a run has identity — do you take the quiet rung, the loud rung, or reload?
 */
export function offerFor({ waveNumber, loadout }) {
  const next = rewardForWave(waveNumber);
  const options = [];
  if (next && !loadout.has(next.id)) {
    options.push({ kind: "weapon", id: next.id, label: next.name, note: describe(next) });
  }
  const held = loadout.weapon;
  if (Number.isFinite(held.ammo)) {
    options.push({ kind: "ammo", id: held.id, label: `Ammo for the ${held.name.toLowerCase()}`, note: `+${held.ammo * 2} rounds` });
  }
  options.push({ kind: "health", id: "health", label: "Field patch", note: "restore 25" });
  // A mod for the held weapon, every third wave. Not every wave: a build that
  // completes by wave ten is a build nobody had to choose.
  if (waveNumber % 3 === 0) {
    const fitted = loadout.modsOn ? loadout.modsOn(held.id) : [];
    const mod = offerMods(held, fitted)[0];
    if (mod) options.push({ kind: "mod", id: mod.id, weapon: held.id, label: mod.label, note: mod.note });
  }
  return options;
}

function describe(w) {
  const tags = [];
  if (w.noise <= 4) tags.push("silent");
  if (w.armourPierce) tags.push("pierces armour");
  if (w.splash) tags.push(`${w.splash} m splash`);
  if (w.mode === "auto") tags.push("full auto");
  if (w.reach >= 20) tags.push(`${w.reach} m reach`);
  return tags.join(" · ") || "reliable";
}

/**
 * A run. Owns the wave counter, the loadout, health and score. The world drives
 * it; it never touches the renderer.
 */
export class Run {
  static DOWN_SECONDS = 8;

  constructor({ startWave = 1, health = 100, deathsAllowed = 2 } = {}) {
    this.wave = startWave;
    this.maxHealth = health;
    this.health = health;
    this.score = 0;
    this.kills = 0;
    this.quietKills = 0;
    this.loadout = new Loadout({ tier: tierForWave(startWave) });
    this.state = "briefing"; // briefing | fighting | between | down | dead
    // Two revives per run, then the third bleed-out is final. A limit is what
    // keeps the downed state from making death toothless.
    this.deathsAllowed = deathsAllowed;
    this.downTimer = 0;
    this.lastOffer = null;
  }

  get tier() {
    return this.loadout.tier;
  }

  /** Begin the current wave: raise the tier, build the (scaled) body list. */
  beginWave() {
    const wave = waveAt(this.wave);
    this.loadout.raiseTier(tierForWave(this.wave));
    this.state = "fighting";
    const enemies = waveEnemies(wave).map((e, i) => {
      const stats = statLine(e.archetype, wave.scale ?? 1);
      return { ...stats, slot: i };
    });
    // Boss waves. A boss replaces the ordinary mix rather than joining it: a
    // boss plus a crowd is a difficulty spike, and a spike is not a fight you
    // remember, it is a fight you lose and do not understand.
    const boss = bossForWave(this.wave);
    if (boss) {
      enemies.length = 0;
      const stats = bossStats(boss, wave.scale ?? 1);
      // The bar needs to know its own ceiling: health is scaled by the wave, so
      // the definition's health is not it on a replay.
      enemies.push({ ...stats, maxHealth: stats.health, slot: 0 });
      wave.boss = boss.id;
      wave.name = boss.name;
    }
    return { wave, enemies, threat: waveThreat(wave), boss };
  }

  /** A kill. Quiet kills pay more, because they cost more nerve. */
  registerKill({ quiet = false, archetype } = {}) {
    this.kills += 1;
    if (quiet) this.quietKills += 1;
    const base = { watcher: 60, runner: 80, pack: 30, flyer: 90, brute: 200, heavy: 240, sniper: 220 }[archetype] ?? 50;
    const value = Math.round(base * (quiet ? 1.6 : 1) * (1 + (this.wave - 1) * 0.12));
    this.score += value;
    return value;
  }

  /**
   * Damage, with a downed state instead of instant death.
   *
   * A wave can last three minutes. Losing all of it to one unlucky brute is the
   * kind of death that makes a player put the game down, and it is not more tense
   * than a bleed-out — it is just more punishing. At zero health the player goes
   * down for `downSeconds`, and clearing the wave revives them.
   */
  takeDamage(n) {
    if (this.state === "down") return this.health;
    this.health = Math.max(0, this.health - Math.max(0, n));
    if (this.health === 0 && this.state !== "dead") {
      if (this.deathsAllowed > 0) {
        this.deathsAllowed -= 1;
        this.state = "down";
        this.downTimer = Run.DOWN_SECONDS;
        this.downCount = (this.downCount ?? 0) + 1;
      } else {
        this.state = "dead";
      }
    }
    return this.health;
  }

  /** The bleed-out clock. Returns false when the player has finally died. */
  tickDown(dt) {
    if (this.state !== "down") return true;
    this.downTimer = Math.max(0, this.downTimer - dt);
    if (this.downTimer === 0) {
      this.state = "dead";
      return false;
    }
    return true;
  }

  /** Brought back by a cleared wave: a third of health, and one fewer revive. */
  revive() {
    if (this.state !== "down") return this.health;
    this.state = "between";
    this.health = Math.max(1, Math.round(this.maxHealth * 0.35));
    this.downTimer = 0;
    return this.health;
  }

  heal(n) {
    this.health = Math.min(this.maxHealth, this.health + n);
    return this.health;
  }

  /** Finish a wave: hand out the offer, advance the counter. */
  endWave() {
    this.wave += 1;
    this.state = "between";
    this.lastOffer = offerFor({ waveNumber: this.wave, loadout: this.loadout });
    return this.lastOffer;
  }

  /** Take one of the offered options. Returns true if it applied. */
  take(option) {
    if (!option) return false;
    if (option.kind === "weapon") return this.loadout.owned.add(option.id), this.loadout.select(option.id), true;
    if (option.kind === "ammo") {
      const w = weaponById(option.id);
      const cur = this.loadout.reserve.get(w.id) ?? 0;
      this.loadout.reserve.set(w.id, cur + w.ammo * 2);
      this.loadout.ammo.set(w.id, Math.min(w.ammo, (this.loadout.ammo.get(w.id) ?? 0) + w.ammo));
      return true;
    }
    if (option.kind === "health") return this.heal(25) > 0;
    // Fit it to the weapon the offer named, not to whatever is held now: the
    // player can change weapons between seeing the offer and taking it.
    if (option.kind === "mod") return this.loadout.fitMod(option.weapon ?? this.loadout.weapon.id, option.id);
    return false;
  }

  snapshot() {
    return {
      wave: this.wave,
      state: this.state,
      health: this.health,
      maxHealth: this.maxHealth,
      score: this.score,
      kills: this.kills,
      quietKills: this.quietKills,
      tier: this.tier,
      weapon: this.loadout.snapshot(),
      offer: this.lastOffer,
    };
  }
}

/** Used by the README and the tests: the whole curve as a table. */
export function curveTable() {
  return WAVES.map((w) => ({
    wave: w.n,
    name: w.name,
    threat: waveThreat(w),
    health: waveEnemies(w).reduce((n, e) => n + statLine(e.archetype, 1).health, 0),
    tier: tierForWave(w.n),
    reward: rewardForWave(w.n)?.name,
  }));
}

export { WEAPONS };
