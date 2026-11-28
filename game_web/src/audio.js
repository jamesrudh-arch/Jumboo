// Procedural city audio.
//
// There are no audio assets in this repo and none will be invented for a study
// build, so every sound here is synthesised: noise buffers through filters for
// rain and wind, oscillators for the city hum, short shaped bursts for footsteps,
// honks and impacts. That keeps provenance clean (nothing to license) and the
// memory cost near zero, which matters because phones are the target device.
//
// The mixer is deliberately separated from WebAudio: `CityAudio` takes an
// injected context, so `test/audio.test.mjs` can drive the whole thing with a
// fake one and assert on the gains, without an audio device.

/** Small deterministic noise buffer used by rain/wind/tyres. */
function noiseBuffer(ctx, seconds = 2, seed = 1) {
  const rate = ctx.sampleRate || 44100;
  const frames = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  let s = seed >>> 0;
  for (let i = 0; i < frames; i++) {
    // xorshift: cheap and deterministic, so the buffer is identical per load.
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    data[i] = (s / 4294967296) * 2 - 1;
  }
  return buffer;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Named sound descriptors. `kind` selects the synth path; the numbers are
 * tuned by ear against the references (a wet, low, close city at night).
 */
const VOICES = {
  honk: { kind: "tone", freq: 392, toFreq: 370, dur: 0.42, gain: 0.32, wave: "sawtooth" },
  honkFar: { kind: "tone", freq: 330, toFreq: 300, dur: 0.5, gain: 0.16, wave: "sawtooth" },
  thunder: { kind: "noise", dur: 2.4, gain: 0.5, filter: "lowpass", freq: 180, q: 0.7 },
  step: { kind: "noise", dur: 0.075, gain: 0.1, filter: "bandpass", freq: 1350, q: 1.4 },
  // Surfaces. A city has tarmac, metal grating, gravel and standing water, and
  // one footstep for all of them is the sound of a car park. Each differs
  // mainly in centre frequency and decay: metal rings, gravel scatters, tarmac
  // is a dull thud.
  stepGrating: { kind: "noise", dur: 0.16, gain: 0.13, filter: "bandpass", freq: 2600, q: 4.2 },
  stepGravel: { kind: "noise", dur: 0.11, gain: 0.12, filter: "highpass", freq: 2400, q: 0.7 },
  stepTarmac: { kind: "noise", dur: 0.07, gain: 0.095, filter: "lowpass", freq: 900, q: 0.8 },
  // A wet step is slightly louder and much brighter than a dry one: the splash
  // adds energy, it does not replace the footfall.
  stepWet: { kind: "noise", dur: 0.12, gain: 0.15, filter: "bandpass", freq: 2100, q: 0.9 },
  splash: { kind: "noise", dur: 0.7, gain: 0.4, filter: "lowpass", freq: 900, q: 0.5 },
  thud: { kind: "tone", freq: 110, toFreq: 48, dur: 0.28, gain: 0.45, wave: "sine" },
  ping: { kind: "tone", freq: 880, toFreq: 660, dur: 0.2, gain: 0.18, wave: "triangle" },
  denimRustle: { kind: "noise", dur: 0.12, gain: 0.06, filter: "highpass", freq: 3200, q: 0.6 },
  lampPop: { kind: "noise", dur: 0.18, gain: 0.25, filter: "bandpass", freq: 2600, q: 3 },

  // ---------------------------------------------------------------- arsenal
  // Each weapon gets a voice that says what it is without seeing it: a pistol
  // is a crack, a shotgun is a boom with a tail, a rifle is a whip that snaps
  // back, and a silenced shot is mostly mechanism. All synthesised, no files.
  swing: { kind: "noise", dur: 0.14, gain: 0.12, filter: "bandpass", freq: 700, q: 1.2 },
  blade: { kind: "noise", dur: 0.1, gain: 0.14, filter: "highpass", freq: 3400, q: 0.8 },
  hitFlesh: { kind: "tone", freq: 160, toFreq: 70, dur: 0.16, gain: 0.3, wave: "triangle" },
  hitArmour: { kind: "noise", dur: 0.12, gain: 0.26, filter: "bandpass", freq: 2900, q: 4 },
  pistolShot: { kind: "noise", dur: 0.16, gain: 0.36, filter: "lowpass", freq: 2400, q: 0.7 },
  silencedShot: { kind: "noise", dur: 0.09, gain: 0.12, filter: "lowpass", freq: 900, q: 0.9 },
  autoShot: { kind: "noise", dur: 0.08, gain: 0.24, filter: "lowpass", freq: 1900, q: 0.6 },
  shotgunBlast: { kind: "noise", dur: 0.34, gain: 0.5, filter: "lowpass", freq: 1200, q: 0.5 },
  rifleCrack: { kind: "noise", dur: 0.42, gain: 0.55, filter: "lowpass", freq: 3000, q: 0.4 },
  launcherThump: { kind: "tone", freq: 90, toFreq: 34, dur: 0.5, gain: 0.5, wave: "sine" },
  explosion: { kind: "noise", dur: 1.1, gain: 0.6, filter: "lowpass", freq: 700, q: 0.4 },
  flame: { kind: "noise", dur: 0.3, gain: 0.16, filter: "bandpass", freq: 1500, q: 0.5 },
  energyZap: { kind: "tone", freq: 1400, toFreq: 240, dur: 0.18, gain: 0.24, wave: "square" },
  dryFire: { kind: "tone", freq: 220, toFreq: 190, dur: 0.06, gain: 0.1, wave: "square" },
  // A body hitting the street: low, short, and the only confirmation a fight is
  // actually over. Without it a kill is silent except for the shot that made it.
  bodyFall: { kind: "noise", dur: 0.22, gain: 0.3, filter: "lowpass", freq: 320, q: 0.8 },
  reloadClick: { kind: "noise", dur: 0.07, gain: 0.14, filter: "bandpass", freq: 1800, q: 2.4 },
};

/**
 * How much of each voice goes to the reverb, 0..1.
 *
 * Not a global "reverb amount": a shot in a street needs a tail and a reload
 * click in the player's own hands needs none. Sending everything equally is what
 * makes a mix sound like it is playing in a cave.
 */
const REVERB_SEND = {
  pistolShot: 0.5, silencedShot: 0.22, autoShot: 0.45, shotgunBlast: 0.62,
  rifleCrack: 0.75, launcherThump: 0.6, explosion: 0.85, energyZap: 0.4,
  flame: 0.2, blade: 0.18, swing: 0.12, hitFlesh: 0.1, hitArmour: 0.3,
  bodyFall: 0.3, honk: 0.5, honkFar: 0.7, thunder: 0.4,
  step: 0.12, stepWet: 0.16, splash: 0.3, thud: 0.2, ping: 0.1,
  stepGrating: 0.3, stepGravel: 0.14, stepTarmac: 0.1,
};

/** Sounds that must stay dry: they are in the player's hands, not the world. */
const DRY_ONLY = new Set(["dryFire", "reloadClick"]);

import { throughWalls } from "./occlusion.js";

export class CityAudio {
  /**
   * @param {object} options
   * @param {AudioContext} options.ctx  an AudioContext (or a test double)
   * @param {number} [options.master]   master gain, 0..1
   */
  constructor(options = {}) {
    this.ctx = options.ctx || null;
    this.enabled = Boolean(this.ctx);
    this.masterGain = options.master ?? 0.85;
    this.ready = false;
    this.nodes = {};
    this.tyres = [];
    this.voices = [];
    this.pending = [];
    this.lastStepPhase = null;
    this.lastStepIndex = null;
    this.stepToggle = false;
    this.stats = { voices: 0, dropped: 0 };
    // Where the camera is pointing, in the same convention as the camera basis
    // in src/world.js. Set once per frame from main.js; the mixer never guesses
    // it from the player's facing, because a player can look over a shoulder.
    this.listenerYaw = 0;
    this.listener = null;
    if (this.enabled) this.build();
  }

  // ------------------------------------------------------------------ graph
  build() {
    const ctx = this.ctx;
    try {
      this.master = ctx.createGain();
      this.master.gain.value = 0; // faded in by start(), so autoplay rules are moot
      this.master.connect(ctx.destination);

      // A gentle limiter keeps a honk next to the player from clipping the mix.
      if (ctx.createDynamicsCompressor) {
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -14;
        this.limiter.knee.value = 12;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.004;
        this.limiter.release.value = 0.18;
        this.limiter.connect(this.master);
        this.bus = this.limiter;
      } else {
        this.bus = this.master;
      }

      // ------------------------------------------------------------- space
      // A reverb send. Without one every sound arrives dry, which is the single
      // most "prototype" thing a synth mix can do: a gunshot in a street with
      // buildings on both sides has a tail, and a shot in the open does not.
      //
      // The impulse is *generated* rather than loaded: a decaying noise burst
      // with a slight pre-delay. That keeps the build file-free, and it means the
      // reverb length can follow the district (the canal is open, the lane is
      // not) without shipping two more files.
      if (ctx.createConvolver) {
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this.makeImpulse(1.5, 2.4);
        this.reverbReturn = ctx.createGain();
        this.reverbReturn.gain.value = 0.34;
        this.reverb.connect(this.reverbReturn);
        this.reverbReturn.connect(this.bus);
        // Send level per source is decided at play time; this is the master.
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 1;
        this.reverbSend.connect(this.reverb);
      }

      // Rain: broadband noise, low-passed, level from the weather.
      this.rain = this.loopNoise("rain", { freq: 3400, q: 0.6, type: "lowpass", seed: 7 });
      // Wind: a narrower band that swings with the gusts.
      this.wind = this.loopNoise("wind", { freq: 620, q: 1.1, type: "bandpass", seed: 13 });
      // Distant city: two detuned low oscillators, barely audible but felt.
      this.hum = ctx.createGain();
      this.hum.gain.value = 0.05;
      for (const [f, gain] of [[54, 0.5], [81, 0.28], [122, 0.12]]) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = gain;
        osc.connect(g);
        g.connect(this.hum);
        osc.start();
      }
      this.hum.connect(this.bus);

      // Shared noise source for one-shot voices.
      this.noise = noiseBuffer(ctx, 2, 3);
      this.ready = true;
    } catch (err) {
      // A locked or unsupported context must not take the game down.
      this.enabled = false;
      this.ready = false;
      this.error = String(err && err.message ? err.message : err);
    }
  }

  loopNoise(name, { freq, q, type, seed }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 2, seed);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    src.start();
    this.nodes[name] = { src, filter, gain };
    return this.nodes[name];
  }

  /** Fog-horn-style swell used when the weather turns or the harbour speaks. */
  swell(dur = 3.2, freq = 92, gain = 0.2) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, now + dur);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // ------------------------------------------------------------------ state
  /** Must be called from a user gesture (the Start button). */
  start() {
    if (!this.enabled) return false;
    const ctx = this.ctx;
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    this.master.gain.setTargetAtTime(this.masterGain, ctx.currentTime, 0.4);
    return true;
  }

  setMuted(muted) {
    if (!this.enabled) return;
    this.muted = muted;
    this.master.gain.setTargetAtTime(muted ? 0 : this.masterGain, this.ctx.currentTime, 0.1);
  }

  setMaster(v) {
    this.masterGain = clamp01(v);
    if (this.enabled && !this.muted) {
      this.master.gain.setTargetAtTime(this.masterGain, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * One frame of ambience. Everything here writes into existing nodes, so the
   * steady-state cost is a handful of AudioParam writes, not node creation.
   */
  update(dt, mix) {
    if (!this.enabled || !this.ready) return;
    const now = this.ctx.currentTime;
    const { weather, player, cameraYaw = 0, vehicles = [], phase = "play" } = mix || {};

    // Rain: level and brightness both follow the weather, so a drizzle is a
    // hiss and a squall is a wall of sound.
    const rainRate = weather ? weather.rainRate : 0;
    const rainGain = 0.02 + rainRate * 0.16;
    this.rain.gain.gain.setTargetAtTime(rainGain, now, 0.6);
    this.rain.filter.frequency.setTargetAtTime(2600 + rainRate * 2600, now, 0.8);

    // Wind: gusts swing the band and the level together.
    const gust = weather ? (weather.gust || 0) : 0;
    const windStrength = weather ? weather.windStrength : 0;
    this.wind.gain.gain.setTargetAtTime(0.012 + windStrength * 0.05 + Math.abs(gust) * 0.03, now, 0.5);
    this.wind.filter.frequency.setTargetAtTime(500 + windStrength * 480 + gust * 120, now, 0.5);

    // City hum drops away when the player is far from the roads.
    this.hum.gain.setTargetAtTime(phase === "caught" ? 0.03 : 0.055, now, 0.9);

    // Tyres: one voice per nearby car, panned by side and level by distance.
    this.updateTyres(now, vehicles, player, cameraYaw);
  }

  /**
   * Traffic is the sound the player actually navigates by: a car you cannot see
   * but can hear is the difference between a street and a set.
   */
  updateTyres(now, vehicles, player, cameraYaw) {
    if (!player) return;
    while (this.tyres.length < vehicles.length && this.tyres.length < 8) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      if (panner) {
        filter.connect(panner);
        panner.connect(gain);
      } else {
        filter.connect(gain);
      }
      gain.connect(this.bus);
      src.start();
      this.tyres.push({ src, filter, panner, gain });
    }
    for (let i = 0; i < this.tyres.length; i++) {
      const t = this.tyres[i];
      const v = vehicles[i];
      if (!v) {
        t.gain.gain.setTargetAtTime(0, now, 0.2);
        continue;
      }
      const dx = v.x - player.x;
      const dz = v.z - player.z;
      const dist = Math.hypot(dx, dz);
      // Audible to about 45 m, and clearly closer as it comes.
      const level = clamp01(1 - dist / 45) ** 2 * 0.11 * (0.35 + (v.speed || 0) / 14);
      t.gain.gain.setTargetAtTime(level, now, 0.12);
      t.filter.frequency.setTargetAtTime(500 + (v.speed || 0) * 55, now, 0.2);
      if (t.panner) {
        // Camera basis, same convention as src/world.js: forward is
        // (sin yaw, cos yaw), so right is (cos yaw, -sin yaw).
        const side = Math.cos(cameraYaw) * dx - Math.sin(cameraYaw) * dz;
        t.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, side / 18)), now, 0.1);
      }
    }
  }

  /**
   * A generated reverb impulse: exponentially decaying noise with a short
   * pre-delay. `seconds` is the tail length and `decay` how fast it falls; a
   * higher decay is a tighter, more enclosed space.
   */
  makeImpulse(seconds = 1.5, decay = 2.4) {
    const rate = this.ctx.sampleRate || 44100;
    const length = Math.max(1, Math.floor(rate * seconds));
    const buffer = this.ctx.createBuffer(2, length, rate);
    // Deterministic noise: a reverb that differs every load makes two identical
    // shots sound different, which is exactly the sort of thing that reads as a
    // bug to a player without them being able to name it.
    let seed = 0x2f6e2b1;
    const rand = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) / 4294967296) * 2 - 1;
    };
    const preDelay = Math.floor(rate * 0.012);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        if (i < preDelay) { data[i] = 0; continue; }
        const t = (i - preDelay) / (length - preDelay);
        // A little damping at the tail, as a real room's high end dies first.
        data[i] = rand() * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  // ---------------------------------------------------------------- one-shots
  /**
   * Stereo position for a one-shot, from its world position and the camera yaw.
   *
   * Returns null when the sound has no position (a UI click, a reload in the
   * player's own hands) so it stays centred rather than snapping to a side.
   * The divisor is the distance at which panning saturates: a sound 18 m to the
   * side is hard left, and everything nearer fades in toward the middle.
   */
  panFor(options = {}) {
    const { x, z, yaw } = options;
    const player = options.player ?? this.listener;
    if (!player || x === undefined || z === undefined) return null;
    if (!this.ctx?.createStereoPanner) return null;
    const cameraYaw = yaw ?? player.yaw ?? 0;
    const dx = x - player.x;
    const dz = z - player.z;
    const side = Math.cos(cameraYaw) * dx - Math.sin(cameraYaw) * dz;
    return Math.max(-1, Math.min(1, side / 18));
  }

  /** Play a named voice. Returns false when it could not be created. */
  play(name, options = {}) {
    if (!this.enabled || !this.ready) return false;
    const spec = VOICES[name];
    if (!spec) return false;
    if (this.voices.length > 14) {
      this.stats.dropped += 1;
      return false;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime + (options.delay || 0);
    const gain = ctx.createGain();
    // Walls cost level as well as brightness; both are in throughWalls().
    const wallGain = options.walls > 0 ? throughWalls(options.walls).gain : 1;
    const level = (spec.gain ?? 0.2) * (options.gain ?? 1) * wallGain;
    let source;
    let tail = now + spec.dur;

    if (spec.kind === "tone") {
      source = ctx.createOscillator();
      source.type = spec.wave || "sine";
      source.frequency.setValueAtTime(spec.freq, now);
      if (spec.toFreq) source.frequency.exponentialRampToValueAtTime(spec.toFreq, now + spec.dur);
    } else {
      source = ctx.createBufferSource();
      source.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = spec.filter || "lowpass";
      filter.frequency.value = spec.freq || 1200;
      filter.Q.value = spec.q || 1;
      source.connect(filter);
      filter.connect(gain);
      source.loop = false;
    }

    // Sound through walls. A muzzle report behind a warehouse wall is a dull
    // thud, not a bright crack, and a player uses that distinction to decide
    // where to face. `options.walls` is the count from src/occlusion.js; the
    // mixer does not do the geometry itself.
    let occluder = null;
    if (options.walls > 0) {
      const spec2 = throughWalls(options.walls);
      if (spec2.muffled) {
        occluder = ctx.createBiquadFilter();
        occluder.type = "lowpass";
        occluder.frequency.value = spec2.cutoff;
        occluder.Q.value = 0.7;
      }
    }

    // A short attack and a longer release: no clicks, and it sits in the mix.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + Math.min(0.02, spec.dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
    if (spec.kind === "tone") source.connect(gain);

    // Where did it come from? A gunshot to the player's right must arrive on the
    // right. The tyre loop already panned; the one-shots did not, so every
    // combat sound played dead centre and the player could not hear which side
    // the street was closing from. Same camera convention as updateTyres:
    // forward is (sin yaw, cos yaw), so right is (cos yaw, -sin yaw).
    const pan = this.panFor(options);
    // `pan === 0` means "dead ahead", not "no pan". A falsy check here silently
    // dropped the panner for every sound on the player's centre line.
    const out = pan !== null && pan !== undefined && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (occluder) {
      gain.connect(occluder);
      if (out) {
        occluder.connect(out);
        out.pan.value = pan;
        out.connect(this.bus);
      } else {
        occluder.connect(this.bus);
      }
    } else if (out) {
      out.pan.value = pan;
      gain.connect(out);
      out.connect(this.bus);
    } else {
      gain.connect(this.bus);
    }

    // Reverb send, taken from the panned (or raw) output so the tail sits where
    // the sound sits. Dry-only voices skip it: a reload in your hands does not
    // echo off the buildings.
    if (this.reverbSend && !DRY_ONLY.has(name)) {
      const amount = (REVERB_SEND[name] ?? 0.18) * (options.reverb ?? 1);
      if (amount > 0.01) {
        const send = ctx.createGain();
        send.gain.value = amount;
        (out ?? gain).connect(send);
        send.connect(this.reverbSend);
      }
    }

    source.start(now);
    source.stop(tail + 0.02);
    const voice = { source, gain, name, end: tail };
    this.voices.push(voice);
    this.stats.voices += 1;
    // Release the slot when the sound is done; the set is tiny on purpose.
    source.onended = () => {
      const i = this.voices.indexOf(voice);
      if (i >= 0) this.voices.splice(i, 1);
    };
    return true;
  }

  /**
   * Footsteps from walking animation phase. Called every frame with the phase
   * (0..1 per stride) so a step lands exactly when the foot does.
   */
  /**
   * Footsteps from walking animation phase.
   *
   * `surface` picks the voice: "tarmac", "grating", "gravel" or "wet". A city has
   * all four underfoot and one footstep for the lot is the sound of a car park.
   * Wet wins over the rest, because a wet street is the loudest thing about it.
   */
  footsteps(phase, { running = false, wet = false, crouch = false, moving = false, surface = null } = {}) {
    if (!moving) {
      // Forgetting the index on a stop means the next start does not fire a
      // phantom step for a crossing that happened while standing still.
      this.lastStepPhase = phase;
      this.lastStepIndex = Math.floor(phase * 2) % 2;
      return false;
    }
    // Two steps per stride: the foot that is down changes at 0.5 and at the
    // wrap. Comparing the half-stride index handles both, and tolerates the
    // phase jitter that a cross-fade produces (a naive "crossed 0.5" test
    // fired twice whenever the phase wobbled back and forth).
    const index = Math.floor(phase * 2) % 2;
    if (!this.enabled) {
      this.lastStepIndex = index;
      this.lastStepPhase = phase;
      return false;
    }
    const changed = this.lastStepPhase !== null && index !== this.lastStepIndex;
    this.lastStepPhase = phase;
    this.lastStepIndex = index;
    if (!changed) return false;
    const name = wet ? "stepWet"
      : surface === "grating" ? "stepGrating"
      : surface === "gravel" ? "stepGravel"
      : surface === "tarmac" ? "stepTarmac"
      : "step";
    // Crouching is the quiet option, so it is scaled down first and the wet
    // multiplier cannot push it back above a normal walk.
    const base = running ? 1.5 : crouch ? 0.4 : 1;
    const gain = crouch ? base : base * (wet ? 1.1 : 1);
    return this.play(name, { gain });
  }

  /** Convenience for the world's event stream. */
  playEvent(event, player) {
    if (!event || !player) return false;
    const dist = event.x !== undefined ? Math.hypot(event.x - player.x, event.z - player.z) : 0;
    const near = clamp01(1 - dist / 40);
    // Every branch below forwards the position and the camera yaw so the
    // one-shot can be placed in the stereo field.
    const at = { x: event.x, z: event.z, yaw: this.listenerYaw, player };
    switch (event.type) {
      case "honk":
        return this.play(near > 0.35 ? "honk" : "honkFar", { gain: 0.4 + near * 0.6 });
      case "hit-by-car":
        return this.play("thud");
      case "drowned":
        return this.play("splash");
      case "errand":
        return this.play("ping");
      case "lightning":
        return this.play("thunder");
      case "land":
        return this.play("thud", { gain: 0.5 });
      case "chaos":
        return event.kind === "power" ? this.play("lampPop", { gain: 0.6 + near }) : false;
      // Combat: played from the event stream, attenuated by distance so a shot
      // across the district is a distant pop and not a bang in the ear.
      case "shot":
        return this.play(event.sound || "pistolShot", { gain: 0.45 + near * 0.55, ...at });
      case "dry-fire":
        return this.play("dryFire", { gain: 0.8 });
      case "reload":
        return this.play("reloadClick", { gain: 0.9 });
      case "swing":
        return this.play(event.sound || "swing", { gain: 0.8 + near * 0.2, ...at });
      case "hit":
        return this.play(event.armoured ? "hitArmour" : "hitFlesh", { gain: 0.7 + near * 0.3, ...at });
      case "explosion":
        return this.play("explosion", { gain: 0.5 + near * 0.5, ...at });
      // New combat events: a body falling is the confirmation that a fight is
      // over, and an enemy's blow landing on the player needs its own sound or
      // the player takes damage with no idea a hit was incoming.
      case "death":
        return this.play(event.armoured ? "hitArmour" : "bodyFall", { gain: 0.55 + near * 0.45, ...at });
      case "enemy-attack":
        return this.play(event.kind === "explosive" ? "launcherThump" : "swing", { gain: 0.7 + near * 0.3, ...at });
      case "player-hit":
        return this.play("hitFlesh", { gain: 1 });
      default:
        return false;
    }
  }
}

/**
 * Builds a CityAudio against the browser's AudioContext, or returns a silent
 * instance when the browser has none (older Safari, or a hardened profile).
 */
export function createAudio(win) {
  const Ctor = win && (win.AudioContext || win.webkitAudioContext);
  if (!Ctor) {
    const silent = new CityAudio({});
    silent.enabled = false;
    return silent;
  }
  try {
    return new CityAudio({ ctx: new Ctor() });
  } catch {
    const silent = new CityAudio({});
    silent.enabled = false;
    return silent;
  }
}
