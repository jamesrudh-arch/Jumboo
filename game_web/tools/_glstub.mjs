// Scratch: give Node a fake canvas so THREE.WebGLRenderer can construct. This is
// not a renderer — it is the smallest object that satisfies the constructor so
// the rest of main.js's boot sequence runs for real.
const ctx = new Proxy({}, {
  get(t, k) {
    if (k === "canvas") return { width: 1280, height: 720, style: {} };
    // A constant, not a call. Must be answered before the getParameter branch so
    // `gl.VERSION` is a number and `gl.getParameter(gl.VERSION)` is the string.
    if (k === "VERSION") return 0x1F02;
    if (k === "SHADING_LANGUAGE_VERSION") return 0x8B8C;
    if (k === "getParameter") return (name) => {
      // three reads VERSION looking for "WebGL"; anything else a number.
      if (name === 0x1F02 || name === "VERSION") return "WebGL 2.0";
      if (name === 0x8B8C || name === "SHADING_LANGUAGE_VERSION") return "WebGL GLSL ES 3.00";
      if (name === 0x1F00) return "Arena";
      if (name === 0x1F01) return "Shim";
      return 4096;
    };
    if (k === "getExtension") return () => null;
    if (k === "getShaderPrecisionFormat") return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (k === "getContextAttributes") return () => ({});
    if (typeof k === "string" && k.startsWith("create")) return () => ({});
    if (typeof k === "string" && k.startsWith("get") && k.endsWith("InfoLog")) return () => "";
    if (typeof k === "string" && k.startsWith("get")) return () => 4096;
    if (typeof k === "string" && k.startsWith("is")) return () => false;
    if (typeof k === "string" && k.startsWith("check")) return () => true;
    if (typeof k === "string" && /^[A-Z][A-Z0-9_]+$/.test(k)) return 1;
    // Any other property access is treated as a WebGL call. Returning a function
    // for a constant like VERSION is how this shim lied the first time.
    return () => ({});
  },
});
const canvas = {
  width: 1280, height: 720, style: {}, clientWidth: 1280, clientHeight: 720,
  getContext: (kind) => {
    if (kind === "2d") {
      // A canvas 2D context that satisfies procedural texture painting: the
      // code only draws and reads back through createImageData/getImageData.
      const grad = { addColorStop() {} };
      return {
        canvas,
        fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, globalAlpha: 1,
        font: "", textAlign: "", textBaseline: "",
        createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, fillRect() {}, clearRect() {}, strokeRect() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
        fill() {}, stroke() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
        drawImage() {}, fillText() {}, measureText: () => ({ width: 0 }), setTransform() {},
      };
    }
    return ctx;
  },
  addEventListener() {}, removeEventListener() {},
  setPointerCapture() {}, releasePointerCapture() {}, requestPointerLock() {},
  hasPointerCapture: () => false, toDataURL: () => "",
};
class El {
  constructor(tag = "div") { this.tagName = String(tag).toUpperCase(); this.children = []; this.dataset = {}; this.style = {}; this.classList = { add(){}, remove(){}, toggle(){} }; this.hidden = false; this._html = ""; }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html; }
  set textContent(v) { this._text = v; } get textContent() { return this._text ?? ""; }
  appendChild(c) { this.children.push(c); return c; } append(...c) { this.children.push(...c); }
  addEventListener() {} removeEventListener() {}
  querySelectorAll(sel) {
    if (sel === "[data-field]") {
      const names = [...(this._html ?? "").matchAll(/data-field="([^"]+)"/g)].map(m => m[1]);
      return names.map(n => { const e = new El(); e.dataset.field = n; return e; });
    }
    return [];
  }
  querySelector() { return null; }
}
globalThis.document = {
  body: new El("body"), head: new El("head"), createElement: (t) => (t === "canvas" ? canvas : new El(t)),
  getElementById: () => Object.assign(new El(), canvas),
  querySelectorAll: () => [], querySelector: () => null,
  addEventListener() {}, exitPointerLock() {}, pointerLockElement: null,
  createElementNS: () => new El(),
};
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener(){}, matchMedia: () => ({ matches: false, addEventListener(){} }) };
Object.defineProperty(globalThis, "navigator", { value: { vibrate: () => true, getGamepads: () => [], userAgent: "node" }, configurable: true });
globalThis.requestAnimationFrame = () => 0;
globalThis.matchMedia = () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.devicePixelRatio = 1;
globalThis.gc = () => {};
globalThis.localStorage = { getItem: () => null, setItem(){} };
