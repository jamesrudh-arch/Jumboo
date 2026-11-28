// The one fake AudioContext.
//
// Shared rather than copied: a second hand-rolled fake is a second thing that can
// fall behind the production code and silently disable an optional branch, which
// is exactly how a finished reverb once shipped doing nothing.

export function fakeContext() {
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
  const nodes = [];
  const node = (extra = {}) => {
    calls.created += 1;
    const n = {
      connect(target) {
        this._connected = target;
        return target;
      },
      disconnect() {},
      ...extra,
    };
    n.kind = extra.type ? `biquad:${extra.type}` : "node";
    nodes.push(n);
    return n;
  };
  return {
    _calls: calls,
    // Every node built, in order, so a test can ask what the graph looks like
    // rather than only how many things it made.
    _nodes: nodes,
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
      get duration() { return frames / rate; },
      _data: new Float32Array(frames),
      getChannelData() {
        return this._data;
      },
    }),
    // A convolver: the reverb bus. Present here so the fake is as capable as a
    // real browser; a mixer that silently skips reverb on capable hardware is
    // exactly what an untested optional branch looks like.
    createConvolver: () => ({ buffer: null, connect() {}, disconnect() {} }),
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
