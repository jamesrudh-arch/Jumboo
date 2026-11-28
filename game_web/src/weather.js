// Weather and mood.
//
// A night city reads flat if the sky never changes. This module owns the
// atmosphere: the sky colour and fog, the rain (rate, wind, splash), the wind
// that drives both rain and tree sway, and a slow drift between weather states
// so a long run through the district does not look the same twice.
//
// All of it is simulation-side data; the renderer only reads it. That keeps the
// mood testable and keeps the frame budget predictable on phones.

import { clamp, lerp } from "./geom.js";

/**
 * Weather presets. `weight` is how often the director picks each one; the
 * numbers are tuned for a night harbour district, not for realism.
 */
export const WEATHER = {
  drizzle: {
    id: "drizzle",
    label: "Drizzle",
    sky: 0x101a22,
    fog: 0x17252e,
    fogNear: 26,
    fogFar: 130,
    rain: 0.35,
    wind: 0.25,
    ambient: 0.5,
    exposure: 1.05,
    weight: 3,
  },
  downpour: {
    id: "downpour",
    label: "Downpour",
    sky: 0x0a1218,
    fog: 0x121e26,
    fogNear: 16,
    fogFar: 82,
    rain: 1,
    wind: 0.8,
    ambient: 0.32,
    exposure: 1.18,
    weight: 2,
  },
  squall: {
    id: "squall",
    label: "Squall",
    sky: 0x0c151c,
    fog: 0x16232c,
    fogNear: 12,
    fogFar: 64,
    rain: 0.9,
    wind: 1,
    ambient: 0.28,
    exposure: 1.22,
    weight: 1,
  },
  break: {
    id: "break",
    label: "Breaking cloud",
    sky: 0x14212a,
    fog: 0x1c2b34,
    fogNear: 34,
    fogFar: 175,
    rain: 0.08,
    wind: 0.3,
    ambient: 0.62,
    exposure: 0.98,
    weight: 2,
  },
  harbourFog: {
    id: "harbourFog",
    label: "Harbour fog",
    sky: 0x18242b,
    fog: 0x27343a,
    fogNear: 8,
    fogFar: 52,
    rain: 0.12,
    wind: 0.12,
    ambient: 0.55,
    exposure: 1.1,
    weight: 2,
  },
};

const ORDER = ["drizzle", "downpour", "squall", "break", "harbourFog"];

/** Deterministic picker respecting the presets' relative weights. */
function pickWeather(rand, avoidId) {
  const pool = ORDER.filter((id) => id !== avoidId);
  const total = pool.reduce((n, id) => n + WEATHER[id].weight, 0);
  let roll = rand() * total;
  for (const id of pool) {
    roll -= WEATHER[id].weight;
    if (roll <= 0) return WEATHER[id];
  }
  return WEATHER[pool[0]];
}

export class Weather {
  constructor(options = {}) {
    this.rand = options.rand || Math.random;
    this.state = WEATHER[options.start || "drizzle"];
    this.next = null;
    // Seconds until the weather decides to change again. `interval` is the
    // mean time between changes; the actual wait jitters around it.
    this.meanInterval = options.interval || 55;
    this.jitter = options.jitter ?? (options.interval ? 0.5 : 70);
    this.timer = this.meanInterval + this.rand() * this.jitter;
    this.transition = 1; // 1 = settled on `state`
    this.transitionTime = 18;
    this.blend = { ...this.state };
    this.windPhase = 0;
    this.gust = 0;
    this.splashes = 0;
    this.changes = 0;
    // Lightning is only allowed in the heavier states, and never on phones
    // (a full-screen flash is a genuine accessibility concern).
    this.allowLightning = options.allowLightning !== false;
    this.flash = 0;
    this.rumble = 0;
    this.onEvent = options.onEvent || null;
  }

  get label() {
    return this.blend.id || this.state.label || this.state.id;
  }

  /** 0..1 rain rate, 0..1 wind, resolved from the current blend. */
  get rainRate() {
    return this.blend.rain;
  }

  get windStrength() {
    return this.blend.wind;
  }

  /** Wind direction in radians; gusts swing it slowly. */
  get windAngle() {
    return Math.sin(this.windPhase * 0.11) * 0.7 + Math.PI * 0.25;
  }

  update(dt) {
    this.windPhase += dt;
    // Gusts: a fast sine riding a slow one reads as weather rather than noise.
    this.gust = clamp(
      Math.sin(this.windPhase * 1.7) * 0.5 + Math.sin(this.windPhase * 0.43) * 0.5,
      -1,
      1,
    );

    if (this.transition < 1) {
      this.transition = Math.min(1, this.transition + dt / this.transitionTime);
      const t = smooth(this.transition);
      const a = this.state;
      const b = this.next || this.state;
      this.blend = {
        id: t < 0.5 ? a.id : b.id,
        label: t < 0.5 ? a.label : b.label,
        sky: lerpColor(a.sky, b.sky, t),
        fog: lerpColor(a.fog, b.fog, t),
        fogNear: lerp(a.fogNear, b.fogNear, t),
        fogFar: lerp(a.fogFar, b.fogFar, t),
        rain: lerp(a.rain, b.rain, t),
        wind: lerp(a.wind, b.wind, t),
        ambient: lerp(a.ambient, b.ambient, t),
        exposure: lerp(a.exposure, b.exposure, t),
      };
      if (this.transition >= 1) {
        this.state = this.next || this.state;
        this.next = null;
        this.blend = { ...this.state };
      }
    } else {
      this.timer -= dt;
      if (this.timer <= 0) {
        const next = pickWeather(this.rand, this.state.id);
        this.next = next;
        this.timer = this.meanInterval + this.rand() * this.jitter;
        this.transition = 0;
        this.changes += 1;
        if (this.onEvent) this.onEvent({ type: "weather-change", id: next.id, label: next.label });
      }
    }

    // Lightning: rare, brief, and always followed by thunder.
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.rumble = Math.max(0, this.rumble - dt);
    if (this.allowLightning && (this.state.id === "squall" || this.state.id === "downpour")) {
      if (this.rand() < dt * (this.state.id === "squall" ? 0.055 : 0.018)) {
        this.flash = 1;
        this.rumble = 2.4;
        if (this.onEvent) this.onEvent({ type: "lightning", strength: 1 });
      }
    }
  }

  /** Apply the resolved mood to a THREE scene. Kept generic for tests. */
  apply(scene, tier) {
    if (!scene) return;
    if (scene.background && scene.background.isColor) {
      scene.background.setHex(this.blend.sky, scene.background.colorSpace ? undefined : undefined);
    }
    if (scene.fog) {
      scene.fog.color.setHex(this.blend.fog);
      // Do not let a phone draw past its budget just because the fog lifted.
      scene.fog.near = Math.max(this.blend.fogNear, tier ? tier.fogNear : 0);
      scene.fog.far = Math.min(this.blend.fogFar, tier ? tier.fogFar : 1e6);
    }
    void tier;
  }
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(lerp(ar, br, t)) << 16) |
    (Math.round(lerp(ag, bg, t)) << 8) |
    Math.round(lerp(ab, bb, t))
  );
}

// ------------------------------------------------------------------ puddles
/**
 * Puddle growth after rain: a cheap, believable "the street is getting wet"
 * signal that the renderer uses to fade reflective patches in and out.
 */
export class Wetness {
  constructor() {
    this.level = 0.35;
  }

  update(dt, rainRate) {
    // Wetness rises with rain and drains slowly once it stops.
    const target = clamp(rainRate * 1.15, 0, 1);
    const rate = target > this.level ? 0.35 : 0.06;
    this.level += clamp(target - this.level, -rate * dt, rate * dt);
    return this.level;
  }
}
