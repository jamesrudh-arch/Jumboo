// Game feel. The difference between a game that has combat and a game that
// *feels* like combat is almost entirely in this file.
//
// Four independent channels, because a single "screen shake on shot" is the
// thing everyone builds first and it is not enough:
//
//   shake    — camera translate + rotate, with per-weapon trauma and a spring
//              back to zero, so heavy weapons are felt and pistols are not
//   rumble   — platform haptics: navigator.vibrate on touch, dual-rumble on a
//              gamepad, scaled by the same trauma so both agree
//   hitstop  — the simulation freezes for 30-80 ms on a melee connect, which is
//              where the sense of *impact* comes from rather than damage numbers
//   flash    — muzzle/impact light and a decal budget, so a firefight leaves a
//              mark on the street and the frame budget stays honest
//
// Everything here is pure state plus a tick(dt): no DOM, no timers, no globals.
// A test can drive it deterministically and a renderer only has to read it.

/** Per-weapon feel profile. Trauma is 0..1 shaken per use. */
export const FEEL = {
  fists: { trauma: 0.16, hitstop: 0.055, rumble: 0.35, flash: 0 },
  knife: { trauma: 0.12, hitstop: 0.07, rumble: 0.3, flash: 0 },
  pistol: { trauma: 0.24, hitstop: 0.02, rumble: 0.45, flash: 0.5 },
  pistolSilencer: { trauma: 0.1, hitstop: 0.015, rumble: 0.2, flash: 0.22 },
  uzi: { trauma: 0.17, hitstop: 0.012, rumble: 0.4, flash: 0.42 },
  shotgun: { trauma: 0.55, hitstop: 0.05, rumble: 0.85, flash: 0.95 },
  sniper: { trauma: 0.62, hitstop: 0.06, rumble: 0.9, flash: 1 },
  machinegun: { trauma: 0.22, hitstop: 0.014, rumble: 0.55, flash: 0.6 },
  flamethrower: { trauma: 0.12, hitstop: 0, rumble: 0.3, flash: 0.8 },
  rocketlauncher: { trauma: 1, hitstop: 0.08, rumble: 1, flash: 1 },
  blaster: { trauma: 0.2, hitstop: 0.02, rumble: 0.35, flash: 0.7 },
  grenade: { trauma: 0.5, hitstop: 0.05, rumble: 0.7, flash: 0.6 },
};

/**
 * Trauma-based camera shake. Trauma decays linearly; the *offset* is trauma
 * squared, which is what makes a big hit read as violent and a small one read
 * as barely there. Offsets are sampled with a cheap deterministic noise so the
 * shake is reproducible in tests.
 */
export class Shake {
  constructor({ maxOffset = 0.42, maxRoll = 0.055, decay = 1.9 } = {}) {
    this.trauma = 0;
    this.maxOffset = maxOffset;
    this.maxRoll = maxRoll;
    this.decay = decay;
    this.time = 0;
    this.offset = { x: 0, y: 0, z: 0 };
    this.roll = 0;
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
    return this;
  }

  /** Deterministic stand-in for noise: two incommensurate sines. */
  static wobble(t, seed) {
    return Math.sin(t * 37.1 + seed) * 0.6 + Math.sin(t * 19.7 + seed * 2.3) * 0.4;
  }

  tick(dt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const s = this.trauma * this.trauma;
    const t = this.time;
    this.offset.x = Shake.wobble(t, 0) * this.maxOffset * s;
    this.offset.y = Shake.wobble(t, 1.7) * this.maxOffset * s * 0.7;
    this.offset.z = Shake.wobble(t, 3.1) * this.maxOffset * s * 0.45;
    this.roll = Shake.wobble(t, 5.3) * this.maxRoll * s;
    return this;
  }

  /** Where the camera should sit, given the pre-shake position. */
  applyTo(x, y, z) {
    return { x: x + this.offset.x, y: y + this.offset.y, z: z + this.offset.z, roll: this.roll };
  }
}

/**
 * Haptics. Three platforms, one API:
 *   - gamepad: Gamepad.vibrationActuator dual-rumble (weak = fine, strong = low)
 *   - touch:   navigator.vibrate, a single pattern in ms
 *   - none:    no-op, and `supported` says so, so the HUD can stop promising it
 *
 * The scaling is the important part: a pistol should be a flick, a launcher a
 * jolt you feel in your palms. Same FEEL table drives camera and hands.
 */
export class Haptics {
  constructor(env = globalThis) {
    this.env = env;
    this.pads = [];
    this.supported = this.detect();
    this.lastAt = -1;
    this.time = 0;
    this.queued = [];
  }

  detect() {
    const env = this.env;
    const hasVibrate = typeof env.navigator?.vibrate === "function";
    const hasPad = typeof env.navigator?.getGamepads === "function";
    return { vibrate: hasVibrate, gamepad: hasPad, any: hasVibrate || hasPad };
  }

  /** Refresh the connected pad list; call on gamepadconnected and per wave. */
  pollPads() {
    const nav = this.env.navigator;
    if (typeof nav?.getGamepads !== "function") return this.pads;
    this.pads = [...nav.getGamepads()].filter((p) => p && p.connected);
    return this.pads;
  }

  /**
   * Fire haptics for a weapon use. `scale` is 0..1 from distance/importance, so
   * an enemy's shot heard from across the street does not buzz the player.
   */
  fire(weaponId, scale = 1) {
    const profile = FEEL[weaponId] ?? { rumble: 0.3 };
    const strength = Math.max(0, Math.min(1, profile.rumble * scale));
    if (strength <= 0.02) return false;
    this.time = 0;
    let fired = false;

    for (const pad of this.pads) {
      const act = pad.vibrationActuator;
      if (!act || typeof act.playEffect !== "function") continue;
      const duration = Math.round(40 + strength * 220);
      act.playEffect("dual-rumble", {
        startDelay: 0,
        duration,
        weakMagnitude: Math.min(1, strength * 0.8),
        strongMagnitude: strength,
      }).catch?.(() => {});
      fired = true;
    }

    const nav = this.env.navigator;
    if (!fired && typeof nav?.vibrate === "function") {
      // A launcher is one hard thump; a pistol is a single tick. Multi-pulse
      // only above 0.55 so automatic fire does not turn into a massage chair.
      const base = Math.round(18 + strength * 55);
      const pattern = strength > 0.55 ? [base, 28, Math.round(base * 0.6)] : [base];
      try {
        nav.vibrate(pattern);
        fired = true;
      } catch { /* a hardened browser can throw; haptics are optional */ }
    }
    return fired;
  }

  /** Ambient low rumble for a distant explosion or a passing train. */
  ambient(strength = 0.3) {
    return this.fire("pistol", strength * 0.6);
  }
}

/**
 * Hitstop: freeze the *simulation* while the camera keeps moving. Short, and
 * only on connects, so it reads as weight rather than as a stutter. Returns the
 * dt the simulation should actually consume.
 */
export class Hitstop {
  constructor() {
    this.remaining = 0;
    this.last = null;
  }

  trigger(seconds, cause = "hit") {
    // Take the longest, never the sum: stacked hits would lock the game.
    if (seconds <= 0) return 0;
    if (seconds > this.remaining) this.remaining = seconds;
    this.last = cause;
    return this.remaining;
  }

  get active() {
    return this.remaining > 0;
  }

  /** Consume dt; returns the time the simulation is allowed to advance. */
  consume(dt) {
    if (this.remaining <= 0) return dt;
    const used = Math.min(dt, this.remaining);
    this.remaining -= used;
    return Math.max(0, dt - used);
  }
}

/**
 * The marks a fight leaves. A decal budget is a real constraint: unbounded
 * blood sprites will kill the frame budget of a phone before the enemy does, so
 * this ring-buffers to `max` and recycles the oldest.
 */
export class Decals {
  constructor({ max = 64 } = {}) {
    this.max = max;
    this.items = [];
    this.next = 0;
    this.dropped = 0;
  }

  add(decal) {
    const item = {
      kind: "bullet",
      size: 0.12,
      life: 30,
      age: 0,
      ...decal,
    };
    item.age = 0;
    if (this.items.length < this.max) {
      this.items.push(item);
      item.slot = this.items.length - 1;
    } else {
      // Recycle the oldest: a firefight in one doorway should not erase the
      // whole street, so the ring buffer is the right shape here.
      const slot = this.next % this.max;
      this.items[slot] = item;
      item.slot = slot;
      this.dropped += 1;
    }
    this.next = (this.next + 1) % this.max;
    return item;
  }

  tick(dt) {
    for (const d of this.items) d.age += dt;
    const before = this.items.length;
    this.items = this.items.filter((d) => d.age < d.life);
    return before - this.items.length;
  }

  get count() {
    return this.items.length;
  }
}

/**
 * One object the renderer can read per frame instead of four.
 */
export class CombatFeel {
  constructor(env = globalThis) {
    this.shake = new Shake();
    this.haptics = new Haptics(env);
    this.hitstop = new Hitstop();
    this.decals = new Decals();
    this.muzzle = { lit: 0, strength: 0 };
    this.events = [];
  }

  /**
   * The single entry point the world calls when a weapon is used. `hit` is the
   * result of resolveHit, or null for a miss.
   */
  onUse(weapon, { hit = null, scale = 1 } = {}) {
    const feel = FEEL[weapon.id] ?? FEEL.pistol;
    this.shake.add(feel.trauma * scale);
    this.haptics.fire(weapon.id, scale);
    this.muzzle.lit = 0.055;
    this.muzzle.strength = feel.flash;
    if (hit) {
      this.hitstop.trigger(feel.hitstop);
      if (hit.armoured) this.decals.add({ kind: "spark", size: 0.06, life: 3 });
      else this.decals.add({ kind: "blood", size: 0.1 + Math.min(0.2, hit.damage / 400), life: 22 });
    }
    this.events.push({ type: hit ? "impact" : "shot", weapon: weapon.id });
    if (this.events.length > 32) this.events.shift();
    return this;
  }

  /** An explosion somewhere else: shake and rumble without a muzzle flash. */
  onBlast(distance = 0) {
    const falloff = Math.max(0, 1 - distance / 30);
    if (falloff <= 0) return this;
    this.shake.add(0.9 * falloff);
    this.haptics.ambient(0.9 * falloff);
    this.decals.add({ kind: "scorch", size: 1.2, life: 40 });
    return this;
  }

  tick(dt) {
    this.shake.tick(dt);
    this.muzzle.lit = Math.max(0, this.muzzle.lit - dt);
    this.decals.tick(dt);
    const sim = this.hitstop.consume(dt);
    return sim;
  }
}
