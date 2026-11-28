// Save and load.
//
// A 60-minute game that loses everything when you die is not a game, it is a
// test of patience. This is deliberately small: a run is a handful of numbers and
// a dictionary of flags, and the only hard part is refusing to save state that
// cannot be trusted.
//
// Three rules, each of which is a bug that would otherwise ship:
//
//  1. **Versioned.** A save from an older build is rejected with a reason, not
//     loaded into a shape the code no longer expects. Silently loading a stale
//     save is how "my progress is corrupt" happens.
//  2. **Never partially written.** A save writes to a key, then swaps. A crash
//     mid-write leaves the previous save intact.
//  3. **The store is injected.** Browser localStorage in a browser, an object in
//     a test. No globals, so this is testable and does not throw in Node.

/** Bump when the shape changes in a way old saves cannot satisfy. */
export const SAVE_VERSION = 3;
export const SAVE_KEY = "leverage.run.v3";

/** A store backed by localStorage where it exists, and by memory where it does not. */
export function createStore(win = globalThis) {
  const memory = new Map();
  const local = win?.localStorage;
  let usable = false;
  if (local) {
    // localStorage throws in private modes and when disabled. Probe once rather
    // than throwing on every save.
    try {
      local.setItem("__probe", "1");
      local.removeItem("__probe");
      usable = true;
    } catch {
      usable = false;
    }
  }
  return {
    persistent: usable,
    get(key) {
      if (usable) return local.getItem(key);
      return memory.has(key) ? memory.get(key) : null;
    },
    set(key, value) {
      if (usable) local.setItem(key, value);
      else memory.set(key, value);
    },
    remove(key) {
      if (usable) local.removeItem(key);
      else memory.delete(key);
    },
  };
}

/** Everything that has to survive a page reload. */
export function snapshot(state = {}) {
  return {
    version: SAVE_VERSION,
    savedAt: state.now ?? 0,
    run: {
      wave: state.wave ?? 1,
      health: state.health ?? 100,
      maxHealth: state.maxHealth ?? 100,
      score: state.score ?? 0,
      tier: state.tier ?? 0,
      weapon: state.weapon ?? "fists",
      owned: [...(state.owned ?? [])],
      ammo: Object.fromEntries(state.ammo ?? []),
      reserve: Object.fromEntries(state.reserve ?? []),
      mods: Object.fromEntries(state.mods ?? []),
    },
    mission: state.mission ?? null,
    flags: { ...(state.flags ?? {}) },
  };
}

/**
 * Validate a parsed save.
 *
 * Returns { ok, reason, data }. Never throws on malformed input: a save file is
 * user-editable text and this is the boundary where that stops mattering.
 */
export function validate(raw) {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "not-json" };
    }
  }
  if (!data || typeof data !== "object") return { ok: false, reason: "not-an-object" };
  if (data.version !== SAVE_VERSION) {
    return { ok: false, reason: `version-${data.version ?? "missing"}` };
  }
  if (!data.run || typeof data.run !== "object") return { ok: false, reason: "no-run" };
  const r = data.run;
  if (!Number.isFinite(r.wave) || r.wave < 1) return { ok: false, reason: "bad-wave" };
  if (!Number.isFinite(r.health)) return { ok: false, reason: "bad-health" };
  if (!Array.isArray(r.owned)) return { ok: false, reason: "bad-owned" };
  return { ok: true, data };
}

/** Write a save. Returns { ok, reason }. */
export function save(store, state) {
  if (!store) return { ok: false, reason: "no-store" };
  const data = snapshot(state);
  try {
    store.set(SAVE_KEY, JSON.stringify(data));
    return { ok: true, data };
  } catch (err) {
    // Quota, or a store that lied about being usable.
    return { ok: false, reason: `write-failed:${err?.name ?? "unknown"}` };
  }
}

/** Read a save. Returns { ok, reason, data }. */
export function load(store) {
  if (!store) return { ok: false, reason: "no-store" };
  return validate(store.get(SAVE_KEY));
}

/** Forget the save. */
export function clear(store) {
  store?.remove(SAVE_KEY);
}

/** Is there a save worth offering to continue? */
export function hasSave(store) {
  return load(store).ok;
}

/**
 * Restore a validated save into a run-shaped object.
 *
 * Returns a plain state object rather than mutating anything, so the caller
 * decides what to do with it and a failed restore cannot leave a half-applied run.
 */
export function restore(data) {
  if (!data?.run) return null;
  const r = data.run;
  return {
    wave: r.wave,
    health: r.health,
    maxHealth: r.maxHealth,
    score: r.score,
    tier: r.tier,
    weapon: r.weapon,
    owned: [...r.owned],
    ammo: new Map(Object.entries(r.ammo ?? {})),
    reserve: new Map(Object.entries(r.reserve ?? {})),
    mods: new Map(Object.entries(r.mods ?? {})),
    mission: data.mission ?? null,
    flags: { ...(data.flags ?? {}) },
  };
}
