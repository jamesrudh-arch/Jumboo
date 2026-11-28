// Audio tests. There is no device here, so the whole mixer runs against a fake
// AudioContext: every node the synth touches is checked for existence, and the
// audio params are inspected directly. This proves the graph is built, that the
// levels react to the simulation, and that nothing throws without a browser.

import test from "node:test";
import assert from "node:assert/strict";

import { CityAudio, createAudio } from "../src/audio.js";

/** The smallest AudioContext that satisfies the graph in src/audio.js. */
function fakeContext() {
  const calls = { started: 0, stopped: 0, created: 0 };
  const param = (initial = 0) => ({
    value: initial,
    _sets: [],
    setValueAtTime(v, t) {
      this.value = v;
      this._sets.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      this.value = v;
      this._sets.push(["linear", v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.value = v;
      this._sets.push(["exp", v, t]);
    },
    setTargetAtTime(v, t, c) {
      this.value = v;
      this._sets.push(["target", v, t, c]);
    },
  });
  const node = (extra = {}) => {
    calls.created += 1;
    return {
      connect(target) {
        this._connected = target;
        return target;
      },
      disconnect() {},
      ...extra,
    };
  };
  return {
    _calls: calls,
    sampleRate: 44100,
    currentTime: 0,
    state: "suspended",
    destination: node(),
    resume() {
      this.state = "running";
      return Promise.resolve();
    },
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () => node({ type: "lowpass", frequency: param(1000), Q: param(1) }),
    createOscillator: () =>
      node({
        type: "sine",
        frequency: param(440),
        start() {
          calls.started += 1;
        },
        stop() {
          calls.stopped += 1;
        },
        onended: null,
      }),
    createBufferSource: () =>
      node({
        buffer: null,
        loop: false,
        playbackRate: param(1),
        start() {
          calls.started += 1;
        },
        stop() {
          calls.stopped += 1;
        },
        onended: null,
      }),
    createBuffer: (channels, frames, rate) => ({
      numberOfChannels: channels,
      length: frames,
      sampleRate: rate,
      _data: new Float32Array(frames),
      getChannelData() {
        return this._data;
      },
    }),
    createDynamicsCompressor: () =>
      node({
        threshold: param(-24),
        knee: param(30),
        ratio: param(12),
        attack: param(0.003),
        release: param(0.25),
      }),
    createStereoPanner: () => node({ pan: param(0) }),
  };
}

const fakeWeather = (rain = 0.5, wind = 0.5, gust = 0) => ({
  rainRate: rain,
  windStrength: wind,
  gust,
});

test("the audio graph builds and starts muted until a gesture", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  assert.equal(audio.enabled, true);
  assert.equal(audio.ready, true);
  assert.ok(audio.rain && audio.wind && audio.hum, "ambience nodes missing");
  assert.equal(audio.master.gain.value, 0, "master must start silent");
  audio.start();
  assert.equal(ctx.state, "running", "start() must resume a suspended context");
  assert.ok(audio.master.gain.value > 0.5, "start() must fade the master up");
});

test("rain, wind and the city hum follow the weather", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  audio.update(1 / 60, { weather: fakeWeather(0.05, 0.1, 0), player: { x: 0, z: 0 } });
  const quiet = {
    rain: audio.rain.gain.gain.value,
    wind: audio.wind.gain.gain.value,
    bright: audio.rain.filter.frequency.value,
  };
  audio.update(1 / 60, { weather: fakeWeather(1, 1, 0.9), player: { x: 0, z: 0 } });
  const loud = {
    rain: audio.rain.gain.gain.value,
    wind: audio.wind.gain.gain.value,
    bright: audio.rain.filter.frequency.value,
  };
  assert.ok(loud.rain > quiet.rain * 2, "a downpour must be louder than a drizzle");
  assert.ok(loud.wind > quiet.wind, "wind must rise with the weather");
  assert.ok(loud.bright > quiet.bright, "heavy rain must be brighter, not just louder");
});

test("tyre voices exist per nearby car and fall silent with distance", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  const player = { x: 0, z: 0 };
  const near = [{ x: 3, z: 0, speed: 12 }, { x: 6, z: 2, speed: 9 }];
  audio.update(1 / 60, { weather: fakeWeather(), player, vehicles: near, cameraYaw: 0 });
  assert.equal(audio.tyres.length, 2, "one tyre voice per car");
  const nearLevel = audio.tyres[0].gain.gain.value;
  assert.ok(nearLevel > 0, "a car 3 m away must be audible");

  const far = [{ x: 90, z: 0, speed: 12 }, { x: 6, z: 2, speed: 9 }];
  audio.update(1 / 60, { weather: fakeWeather(), player, vehicles: far, cameraYaw: 0 });
  assert.ok(audio.tyres[0].gain.gain.value < nearLevel, "a car 90 m away must be quieter");
});

test("a car to the player's right pans right", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  audio.update(1 / 60, {
    weather: fakeWeather(),
    player: { x: 0, z: 0 },
    vehicles: [{ x: 8, z: 0, speed: 10 }],
    cameraYaw: 0,
  });
  const pan = audio.tyres[0].panner.pan.value;
  assert.ok(pan > 0.1, `expected a right-hand pan, got ${pan}`);
});

test("named voices play, cap themselves and release their slots", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  assert.equal(audio.play("honk"), true);
  assert.equal(audio.play("thunder"), true);
  assert.equal(audio.play("nope"), false, "an unknown voice must not throw");
  assert.equal(audio.voices.length, 2);

  // The cap protects the mixer from a pile-up.
  for (let i = 0; i < 40; i++) audio.play("step");
  assert.ok(audio.voices.length <= 15, `voice cap exceeded: ${audio.voices.length}`);
  assert.ok(audio.stats.dropped > 0, "dropped voices must be counted");

  // Releasing a voice (what onended does) frees the slot.
  audio.voices[0].source.onended?.();
  assert.ok(audio.voices.length < 15);
});

test("footsteps fire on stride crossings, not on a timer", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  let steps = 0;
  const realPlay = audio.play.bind(audio);
  audio.play = (name, opts) => {
    if (name === "step" || name === "stepWet") steps += 1;
    return realPlay(name, opts);
  };
  // Walk a phase from 0 to 1 in small increments: two crossings, two steps.
  for (let p = 0; p <= 1.0001; p += 1 / 60) {
    audio.footsteps(p % 1, { moving: true, running: false });
  }
  assert.equal(steps, 2, `expected one step per stride crossing, got ${steps}`);

  // Standing still makes no noise, and re-crossing does not retrigger.
  steps = 0;
  for (let p = 0; p <= 1.0001; p += 1 / 60) audio.footsteps(p % 1, { moving: false });
  assert.equal(steps, 0, "a stationary player must not make footsteps");
});

test("wet streets change the footstep, and running is louder than crouching", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  const heard = [];
  const realPlay = audio.play.bind(audio);
  audio.play = (name, opts) => {
    heard.push({ name, gain: opts?.gain ?? 1 });
    return realPlay(name, opts);
  };
  // Drive one full stride per mode, the way the walk cycle actually moves:
  // 0 -> 1, so the foot index changes once. (Calling 0.4 then 0.6 repeatedly is
  // two strides, not one, and would rightly fire twice.)
  const stride = (opts) => {
    const before = heard.length;
    for (let p = 0; p <= 1.0001; p += 1 / 60) audio.footsteps(p % 1, { moving: true, ...opts });
    return heard[before];
  };
  const walk = stride({});
  const wet = stride({ wet: true });
  const run = stride({ running: true });
  const crouch = stride({ crouch: true });
  assert.equal(walk.name, "step");
  assert.equal(wet.name, "stepWet", "wet ground must sound different");
  assert.ok(wet.gain > walk.gain, "a splash adds energy, it does not replace the step");
  assert.ok(run.gain > walk.gain, "running must be louder than walking");
  assert.ok(crouch.gain < walk.gain, "crouching must be quieter than walking");
});

test("the world's event stream maps onto sounds", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  const player = { x: 0, z: 0 };
  const played = [];
  const realPlay = audio.play.bind(audio);
  audio.play = (name, opts) => {
    played.push(name);
    return realPlay(name, opts);
  };
  audio.playEvent({ type: "honk", x: 2, z: 0 }, player);
  audio.playEvent({ type: "honk", x: 120, z: 0 }, player);
  audio.playEvent({ type: "hit-by-car", x: 1, z: 0 }, player);
  audio.playEvent({ type: "drowned", x: 1, z: 0 }, player);
  audio.playEvent({ type: "errand", x: 1, z: 0 }, player);
  audio.playEvent({ type: "step" }, player);
  assert.deepEqual(played, ["honk", "honkFar", "thud", "splash", "ping"]);
});

test("muting and volume are honoured", () => {
  const ctx = fakeContext();
  const audio = new CityAudio({ ctx });
  audio.start();
  audio.setMuted(true);
  assert.equal(audio.master.gain.value, 0);
  audio.setMuted(false);
  assert.ok(audio.master.gain.value > 0.5);
  audio.setMaster(0.25);
  assert.equal(audio.masterGain, 0.25);
});

test("no AudioContext means no crash, and no sound", () => {
  const silent = createAudio({});
  assert.equal(silent.enabled, false);
  assert.equal(silent.play("honk"), false);
  silent.update(1 / 60, {});
  silent.footsteps(0.5, { moving: true });
  silent.playEvent({ type: "honk", x: 0, z: 0 }, { x: 0, z: 0 });
});

test("a context that throws while building is swallowed", () => {
  const broken = new Proxy(
    {},
    {
      get() {
        throw new Error("AudioContext is locked");
      },
    },
  );
  const audio = new CityAudio({ ctx: broken });
  assert.equal(audio.enabled, false);
  assert.match(audio.error, /locked/);
  assert.equal(audio.play("honk"), false);
});
