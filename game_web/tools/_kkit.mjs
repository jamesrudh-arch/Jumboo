// Node-side loader for the Kenney packs, mirroring loadKenneyPack() in src/kit.js.
import * as THREE from "three";
import fs from "node:fs";
import { decodePNG } from "./png.mjs";

function readGlb(file) {
  const buf = fs.readFileSync(file);
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
  const bin = buf.subarray(20 + jl + 8);
  const views = json.bufferViews || [], acc = json.accessors || [];
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const TY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  function read(i) {
    const a = acc[i], v = views[a.bufferView];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const n = NC[a.type], A = TY[a.componentType];
    const stride = v.byteStride || A.BYTES_PER_ELEMENT * n;
    const out = new A(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const o = off + k * stride + c * A.BYTES_PER_ELEMENT;
      out[k * n + c] =
        A === Float32Array ? bin.readFloatLE(o) :
        A === Uint16Array ? bin.readUInt16LE(o) :
        A === Uint32Array ? bin.readUInt32LE(o) :
        A === Int16Array ? bin.readInt16LE(o) : bin[o];
    }
    return out;
  }
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  // Node transforms: these packs are flat single-node models, but read them anyway.
  for (const m of json.meshes || []) for (const p of m.primitives) {
    const P = read(p.attributes.POSITION);
    for (let i = 0; i < P.length; i++) pos.push(P[i]);
    if (p.attributes.NORMAL !== undefined) { const N = read(p.attributes.NORMAL); for (let i = 0; i < N.length; i++) nor.push(N[i]); }
    else for (let i = 0; i < P.length / 3; i++) nor.push(0, 1, 0);
    if (p.attributes.TEXCOORD_0 !== undefined) { const U = read(p.attributes.TEXCOORD_0); for (let i = 0; i < U.length; i++) uv.push(U[i]); }
    else for (let i = 0; i < P.length / 3 * 2; i++) uv.push(0);
    if (p.indices !== undefined) { const I = read(p.indices); for (let i = 0; i < I.length; i++) idx.push(I[i] + base); }
    else for (let i = 0; i < P.length / 3; i++) idx.push(i + base);
    base += P.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  g.computeBoundingBox();
  return g;
}

const PACKS = {
  commercial: "city-commercial", suburban: "city-suburban", roads: "city-roads",
  vehicles: "car", water: "watercraft", building: "building",
  modular: "modular-buildings", retro: "retro-urban", furniture: "furniture",
};

export function makeKenneyKit(packKey, names) {
  const dir = `./assets/kenney/${PACKS[packKey]}`;
  let texture = null;
  const atlasFile = `${dir}/Textures/colormap.png`;
  if (fs.existsSync(atlasFile)) {
    const img = decodePNG(fs.readFileSync(atlasFile));
    texture = new THREE.Texture();
    texture.image = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data), uuid: `kenney-${packKey}` };
    texture.flipY = false;
  }
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0.03 });
  const models = new Map();
  for (const n of names) {
    const f = `${dir}/${n}.glb`;
    if (!fs.existsSync(f)) continue;
    models.set(n, readGlb(f));
  }
  return {
    has: (n) => models.has(n),
    make(n) {
      const g = models.get(n);
      if (!g) return null;
      const mesh = new THREE.Mesh(g, material);
      mesh.userData.size = g.boundingBox.getSize(new THREE.Vector3());
      return mesh;
    },
    size(n) { const g = models.get(n); return g ? g.boundingBox.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 1, 1); },
    names: () => [...models.keys()],
    triangles: () => [...models.values()].reduce((s, g) => s + (g.index ? g.index.count / 3 : 0), 0),
  };
}
