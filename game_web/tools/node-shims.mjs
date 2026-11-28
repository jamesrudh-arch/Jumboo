// Node-side browser shims for the offline diagnostic tools only.
//
// The renderer tools need enough of the browser to let Three.js load the GLB
// and decode its JPEG textures, and enough of the DOM for the procedural canvas
// textures the level builder creates. None of this ships with the game.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const jpeg = require_("./jpeg-js");

/** A decoded image usable as a Three.js texture source. */
export function imageFromJPEG(buffer) {
  const raw = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 512, formatAsRGBA: true });
  return raw; // { width, height, data }
}

/**
 * Minimal 2D canvas: real enough to produce pixel data for the procedural
 * textures (asphalt grain, crate planks, grime) that the level uses, so the CPU
 * rasteriser can sample them. Supports the subset of the API the builders call.
 */
class TinyCanvas {
  constructor(w = 256, h = 256) {
    this._width = w;
    this._height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    this._ctx = makeCtx(this);
  }
  // The level builder sets canvas.width/height after creating the element, so
  // the pixel buffer has to follow. A stale buffer leaves part of the texture
  // undefined, which samples as white.
  get width() { return this._width; }
  set width(v) { this._resize(v, this._height); }
  get height() { return this._height; }
  set height(v) { this._resize(this._width, v); }
  _resize(w, h) {
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    this._ctx = makeCtx(this);
  }
  getContext() {
    return this._ctx;
  }
}

function makeCtx(canvas) {
  const { width, height, data } = canvas;
  const st = { fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, globalAlpha: 1, globalCompositeOperation: "source-over", font: "10px sans-serif", textAlign: "left" };
  const parse = (c) => {
    if (typeof c !== "string") return [0, 0, 0, 1];
    if (c.startsWith("#")) {
      const h = c.slice(1);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map((s) => parseFloat(s.trim()));
      return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1];
    }
    return [128, 128, 128, 1];
  };
  const blend = (x, y, r, g, b, a) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    const sa = a * st.globalAlpha;
    if (st.globalCompositeOperation === "multiply") {
      data[i] = (data[i] * r) / 255;
      data[i + 1] = (data[i + 1] * g) / 255;
      data[i + 2] = (data[i + 2] * b) / 255;
      data[i + 3] = Math.max(data[i + 3], 255 * sa);
      return;
    }
    data[i] = data[i] * (1 - sa) + r * sa;
    data[i + 1] = data[i + 1] * (1 - sa) + g * sa;
    data[i + 2] = data[i + 2] * (1 - sa) + b * sa;
    data[i + 3] = Math.max(data[i + 3], sa * 255);
  };
  return {
    canvas,
    get fillStyle() { return st.fillStyle; },
    set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; },
    set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; },
    set lineWidth(v) { st.lineWidth = v; },
    get globalAlpha() { return st.globalAlpha; },
    set globalAlpha(v) { st.globalAlpha = v; },
    get globalCompositeOperation() { return st.globalCompositeOperation; },
    set globalCompositeOperation(v) { st.globalCompositeOperation = v; },
    get font() { return st.font; },
    set font(v) { st.font = v; },
    get textAlign() { return st.textAlign; },
    set textAlign(v) { st.textAlign = v; },
    fillRect(x, y, w, h) {
      const [r, g, b, a] = parse(st.fillStyle);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) blend(xx, yy, r, g, b, a);
    },
    strokeRect(x, y, w, h) {
      const [r, g, b, a] = parse(st.strokeStyle);
      const lw = Math.max(1, st.lineWidth);
      for (let i = 0; i < lw; i++) {
        for (let xx = x; xx < x + w; xx++) {
          blend(xx, y + i, r, g, b, a);
          blend(xx, y + h - i, r, g, b, a);
        }
        for (let yy = y; yy < y + h; yy++) {
          blend(x + i, yy, r, g, b, a);
          blend(x + w - i, yy, r, g, b, a);
        }
      }
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc(cx, cy, rad) {
      const [r, g, b, a] = parse(st.fillStyle);
      for (let yy = Math.floor(cy - rad); yy <= cy + rad; yy++)
        for (let xx = Math.floor(cx - rad); xx <= cx + rad; xx++)
          if ((xx - cx) ** 2 + (yy - cy) ** 2 <= rad * rad) blend(xx, yy, r, g, b, a);
    },
    ellipse(cx, cy, rx, ry) {
      const [r, g, b, a] = parse(st.strokeStyle);
      for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++)
        for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++)
          if (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1) if (Math.random() < 0.5) blend(xx, yy, r, g, b, a);
    },
    fill() {
      const [r, g, b, a] = parse(st.fillStyle);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) blend(x, y, r, g, b, a);
    },
    stroke() {},
    fillText(text, x, y) {
      // Draw blocky placeholder glyphs so signs are not empty.
      const [r, g, b, a] = parse(st.fillStyle);
      const size = parseInt((st.font.match(/(\d+)px/) || [0, 24])[1], 10) || 24;
      let cursor = x - (text.length * size * 0.32) / 1;
      for (const ch of text) {
        if (ch !== " ") for (let yy = y - size; yy < y; yy += 2) for (let xx = 0; xx < size * 0.55; xx += 2) if ((ch.charCodeAt(0) * 7 + yy + xx) % 5 !== 0) blend(cursor + xx, yy, r, g, b, a);
        cursor += size * 0.62;
      }
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    drawImage(src, dx = 0, dy = 0) {
      // Copy the source canvas' pixels. The level builder tints a shared grime
      // texture by drawing it, then multiplying a flat colour over it; without
      // this the tint is black.
      const sw = src.width | 0;
      const sh = src.height | 0;
      const sdata = src.data;
      if (!sdata) return;
      for (let yy = 0; yy < sh; yy++) {
        for (let xx = 0; xx < sw; xx++) {
          const si = (yy * sw + xx) * 4;
          blend(dx + xx, dy + yy, sdata[si], sdata[si + 1], sdata[si + 2], sdata[si + 3] / 255);
        }
      }
    },
    getImageData(x, y, w, h) {
      const out = new Uint8ClampedArray(w * h * 4);
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const si = ((y + yy) * width + (x + xx)) * 4;
          const di = (yy * w + xx) * 4;
          out[di] = data[si];
          out[di + 1] = data[si + 1];
          out[di + 2] = data[si + 2];
          out[di + 3] = data[si + 3];
        }
      return { data: out, width: w, height: h };
    },
    putImageData() {},
  };
}

/** Install the browser globals the loaders and level builder need. */
export function installShims() {
  const blobs = new Map();
  let blobSeq = 0;

  globalThis.window = globalThis;
  globalThis.self = globalThis;

  globalThis.document = {
    createElement: (tag) => {
      if (tag === "canvas") {
        const c = new TinyCanvas(256, 256);
        return c;
      }
      return {};
    },
    createElementNS: () => new TinyCanvas(1, 1),
  };

  globalThis.ImageData = class ImageData {
    constructor(data, w, h) {
      this.data = data;
      this.width = w;
      this.height = h;
    }
  };
  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      return new TinyCanvas(w, h);
    }
  };

  globalThis.ProgressEvent = class ProgressEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.lengthComputable = !!init.lengthComputable;
      this.loaded = init.loaded || 0;
      this.total = init.total || 0;
    }
  };

  globalThis.Blob = class Blob {
    constructor(parts) {
      this.parts = parts;
    }
    async arrayBuffer() {
      return this.parts[0];
    }
    get type() {
      return "image/jpeg";
    }
  };

  const realCreate = globalThis.URL.createObjectURL;
  globalThis.URL.createObjectURL = (blob) => {
    const id = `blob:stub-${blobSeq++}`;
    blobs.set(id, blob);
    return id;
  };
  globalThis.URL.revokeObjectURL = (id) => blobs.delete(id);

  globalThis.createImageBitmap = async (source) => {
    const blob = typeof source === "string" ? blobs.get(source) : source;
    const buf = blob && blob.arrayBuffer ? Buffer.from(await blob.arrayBuffer()) : null;
    if (!buf || buf.length < 4) return { width: 1, height: 1, data: new Uint8ClampedArray(4), close() {} };
    const img = imageFromJPEG(buf);
    return { width: img.width, height: img.height, data: img.data, close() {} };
  };

  // Load files from disk instead of the network.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = typeof url === "string" ? url : url.url;
    // ImageBitmapLoader fetches the object URL it was handed; resolve it back to
    // the Blob we stored so embedded JPEGs decode instead of silently failing.
    if (u.startsWith("blob:")) {
      const blob = blobs.get(u);
      if (!blob) return new Response(null, { status: 404 });
      return new Response(await blob.arrayBuffer(), { status: 200 });
    }
    if (u.startsWith("file://")) {
      return new Response(fs.readFileSync(new URL(u)), { status: 200 });
    }
    if (u.startsWith("./") || u.startsWith("../")) {
      const file = path.resolve(u);
      if (fs.existsSync(file)) return new Response(fs.readFileSync(file), { status: 200 });
    }
    return realFetch(url, opts);
  };
}
