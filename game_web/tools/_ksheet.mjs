import * as THREE from "three";
import fs from "node:fs";
import { decodePNG } from "./png.mjs";
import { rasterize, encodePNG } from "./software-raster.mjs";

// Minimal GLB reader for the browser-style path: geometry + one shared atlas.
function loadGlb(file, atlasOf) {
  const buf = fs.readFileSync(file);
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
  let binOff = 20 + jl + 8;
  const bin = buf.subarray(binOff);
  const views = json.bufferViews || [];
  const acc = json.accessors || [];
  function read(i) {
    const a = acc[i]; const v = views[a.bufferView];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const comps = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const A = comps[a.componentType];
    const stride = v.byteStride || A.BYTES_PER_ELEMENT * nComp;
    const out = new A(a.count * nComp);
    for (let i2 = 0; i2 < a.count; i2++) {
      for (let c = 0; c < nComp; c++) {
        const o = off + i2 * stride + c * A.BYTES_PER_ELEMENT;
        out[i2 * nComp + c] = A === Float32Array ? bin.readFloatLE(o)
          : A === Uint16Array ? bin.readUInt16LE(o)
          : A === Uint32Array ? bin.readUInt32LE(o)
          : A === Uint8Array ? bin[o] : A === Int16Array ? bin.readInt16LE(o) : bin[o];
      }
    }
    return out;
  }
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (const m of json.meshes || []) {
    for (const p of m.primitives) {
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
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  g.computeBoundingBox();
  return g;
}

const ATLASES = {};
function atlasFor(pack) {
  if (!(pack in ATLASES)) {
    const f = `/tmp/kassets/3d/${pack}/Textures/colormap.png`;
    if (!fs.existsSync(f)) { ATLASES[pack] = null; return null; }
    const img = decodePNG(fs.readFileSync(f));
    const tex = new THREE.Texture();
    tex.image = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data), uuid: `atlas-${pack}` };
    ATLASES[pack] = tex;
  }
  return ATLASES[pack];
}

const GROUPS = {
  commercial: ["city-commercial", ["building-a", "building-b", "building-c", "building-d", "building-e", "building-f", "building-g", "building-h"]],
  suburban: ["city-suburban", ["building-type-a", "building-type-b", "building-type-c", "building-type-d", "building-type-e", "building-type-f", "building-type-g", "building-type-h"]],
  vehicles: ["car", ["ambulance", "police", "suv", "taxi", "truck", "van", "sedan", "hatchback-sports"]],
  water: ["watercraft", ["boat-fishing-small", "boat-speed-a", "sail-boat-a", "boat-house-a", "jetski", "dinghy", "ship-cargo-a", "boat-sloop-a"]],
};

for (const [name, [pack, list]] of Object.entries(GROUPS)) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d24);
  const tex = atlasFor(pack);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  let placed = 0;
  for (const m of list) {
    const f = `/tmp/kassets/3d/${pack}/${m}.glb`;
    if (!fs.existsSync(f)) { console.log(`  miss ${pack}/${m}`); continue; }
    const g = loadGlb(f);
    const mesh = new THREE.Mesh(g, mat);
    const size = g.boundingBox.getSize(new THREE.Vector3());
    const s = 5 / Math.max(size.x, size.y, size.z, 0.01);
    mesh.scale.setScalar(s);
    mesh.position.set((placed - (list.length - 1) / 2) * 5.6, -g.boundingBox.min.y * s, 0);
    scene.add(mesh);
    placed++;
  }
  scene.add(new THREE.HemisphereLight(0x9fb4d0, 0x2a2620, 1.0));
  const key = new THREE.DirectionalLight(0xfff2dc, 1.6); key.position.set(8, 14, 16); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fa8d8, 0.7); fill.position.set(-12, 6, -10); scene.add(fill);
  const W = 1200, H = 360;
  const cam = new THREE.PerspectiveCamera(38, W / H, 0.3, 400);
  cam.position.set(0, 9, 34);
  cam.lookAt(0, 3.5, 0);
  cam.updateMatrixWorld();
  const { color } = rasterize(scene, cam, { width: W, height: H, defaultLighting: false });
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) {
    const v = Math.max(0, color[i]);
    const t = v / (1 + v);
    rgb[i] = t <= 0.0031308 ? t * 12.92 : 1.055 * Math.pow(t, 1 / 2.4) - 0.055;
  }
  fs.writeFileSync(`/tmp/k_${name}.png`, encodePNG(W, H, rgb));
  console.log(`wrote /tmp/k_${name}.png (${placed} models)`);
}
