// Pure-CPU software rasteriser used only by the automated visual check
// (tools/render.mjs). It is NOT part of the game and is never shipped.
//
// Purpose: this environment has no GPU, no headless browser and no Godot build,
// so the only way to see whether the scene composes correctly is to rasterise
// the real Three.js scene graph on the CPU. It supports:
//   - static and CPU-skinned meshes (the approved rig, posed by its own mixer)
//   - per-vertex Lambert + emissive shading from the scene's real lights
//   - 2.5D height-field shadows for the static geometry
//   - fog, a vertical gradient sky, and a depth buffer
// It does not sample textures, bloom, tone-map, or draw the HTML HUD.

import * as THREE from "three";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePNG } from "./png.mjs";

// The game root, so a texture given as "./assets/kit/..." resolves from disk.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------------------------------------------ PNG out
// Match what the WebGL renderer does at the end of its pipeline: ACES filmic
// tone mapping, then linear -> sRGB. Without this the CPU frames look far
// darker than the real game.
function aces(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)));
}

function linearToSRGB(x) {
  return x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

export function tonemapInPlace(color, exposure = 1.0) {
  for (let i = 0; i < color.length; i++) {
    const v = aces(color[i] * exposure);
    color[i] = linearToSRGB(v);
  }
  return color;
}

export function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[o++] = clamp8(rgb[i]);
      raw[o++] = clamp8(rgb[i + 1]);
      raw[o++] = clamp8(rgb[i + 2]);
    }
  }
  const chunks = [];
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", zlib.deflateSync(raw, { level: 9 })));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat([sig, ...chunks]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  }
}

function clamp8(v) {
  return Math.max(0, Math.min(255, Math.round((v <= 0 ? 0 : v >= 1 ? 1 : v) * 255)));
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

// ------------------------------------------------------------- shadow map
// CPU shadow map for the directional light: rasterise every shadow caster from
// the light's orthographic view into a depth buffer, then compare fragments
// against it in light space. This matches what Three's shadow pass does, so the
// diagnostic can validate the directional lighting and grounding.
export function buildShadowMap(scene, light, { size = 1024, center = new THREE.Vector3(0, 0, -22), radius = 34 } = {}) {
  const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.5, radius * 4);
  const dir = new THREE.Vector3().copy(light.position).normalize();
  cam.position.copy(center).addScaledVector(dir, radius * 1.5);
  cam.lookAt(center);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const viewProj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const depth = new Float32Array(size * size).fill(Infinity);
  const v = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.castShadow || !obj.visible) return;
    const geo = obj.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < n; i += 3) {
      const ia = idx ? idx.getX(i) : i;
      const ib = idx ? idx.getX(i + 1) : i + 1;
      const ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(obj.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(obj.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(obj.matrixWorld);
      const pa = a.clone().applyMatrix4(viewProj);
      const pb = b.clone().applyMatrix4(viewProj);
      const pc = c.clone().applyMatrix4(viewProj);
      const sx = (p) => (p.x * 0.5 + 0.5) * size;
      const sy = (p) => (1 - (p.y * 0.5 + 0.5)) * size;
      const minX = Math.max(0, Math.floor(Math.min(sx(pa), sx(pb), sx(pc))));
      const maxX = Math.min(size - 1, Math.ceil(Math.max(sx(pa), sx(pb), sx(pc))));
      const minY = Math.max(0, Math.floor(Math.min(sy(pa), sy(pb), sy(pc))));
      const maxY = Math.min(size - 1, Math.ceil(Math.max(sy(pa), sy(pb), sy(pc))));
      if (minX > maxX || minY > maxY) continue;
      const ax = sx(pa), ay = sy(pa), bx = sx(pb), by = sy(pb), cx = sx(pc), cy = sy(pc);
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(area) < 1e-9) continue;
      const inv = 1 / area;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) * inv;
          const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * pa.z + w1 * pb.z + w2 * pc.z;
          const k = y * size + x;
          if (z < depth[k]) depth[k] = z;
        }
      }
    }
  });
  return { matrix: viewProj, depth, size, bias: 0.0016 };
}

export function shadowFactor(shadow, worldPos, nDotL) {
  if (!shadow) return 1;
  const p = worldPos.clone().applyMatrix4(shadow.matrix);
  const x = Math.floor((p.x * 0.5 + 0.5) * shadow.size);
  const y = Math.floor((1 - (p.y * 0.5 + 0.5)) * shadow.size);
  if (x < 0 || y < 0 || x >= shadow.size || y >= shadow.size) return 1;
  let lit = 0;
  let total = 0;
  const bias = shadow.bias + (1 - nDotL) * 0.0025;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = Math.min(shadow.size - 1, Math.max(0, x + dx));
      const sy = Math.min(shadow.size - 1, Math.max(0, y + dy));
      const d = shadow.depth[sy * shadow.size + sx];
      total++;
      if (p.z - bias <= d) lit++;
    }
  }
  return lit / total;
}

// ------------------------------------------------------- shadow height field
const HF_CELL = 0.25;

export function buildHeightField(scene, bounds) {
  const w = Math.ceil((bounds.x2 - bounds.x1) / HF_CELL);
  const d = Math.ceil((bounds.z2 - bounds.z1) / HF_CELL);
  const h = new Float32Array(w * d).fill(-Infinity);
  const v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.castShadow) return;
    if (o.isSkinnedMesh) return; // the character does not cast a shadow here
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) return;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const vi = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
      pts.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < pts.length; i += 9) {
      const xs = [pts[i], pts[i + 3], pts[i + 6]];
      const ys = [pts[i + 1], pts[i + 4], pts[i + 7]];
      const zs = [pts[i + 2], pts[i + 5], pts[i + 8]];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const cx0 = Math.max(0, Math.floor((minX - bounds.x1) / HF_CELL));
      const cx1 = Math.min(w - 1, Math.ceil((maxX - bounds.x1) / HF_CELL));
      const cz0 = Math.max(0, Math.floor((minZ - bounds.z1) / HF_CELL));
      const cz1 = Math.min(d - 1, Math.ceil((maxZ - bounds.z1) / HF_CELL));
      const top = Math.max(...ys);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const k = cz * w + cx;
          if (top > h[k]) h[k] = top;
        }
      }
    }
  });
  return { w, d, originX: bounds.x1, originZ: bounds.z1, h };
}

function sampleHeight(hf, x, z) {
  const cx = Math.round((x - hf.originX) / HF_CELL);
  const cz = Math.round((z - hf.originZ) / HF_CELL);
  if (cx < 0 || cz < 0 || cx >= hf.w || cz >= hf.d) return -Infinity;
  return hf.h[cz * hf.w + cx];
}

/** Soft shadow term for a surface point lit by a point light. */
export function shadowTerm(hf, px, py, pz, lx, ly, lz) {
  if (!hf) return 1;
  const dx = lx - px;
  const dz = lz - pz;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.35) return 1;
  const steps = Math.min(26, Math.max(4, Math.ceil(dist / 0.4)));
  let blocked = 0;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = px + dx * t;
    const sz = pz + dz * t;
    const sy = py + (ly - py) * t;
    const h = sampleHeight(hf, sx, sz);
    if (h > sy + 0.12) blocked++;
  }
  return Math.max(0, 1 - (blocked / (steps - 1)) * 1.6);
}

// --------------------------------------------------------------- textures
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
let jpegDecode = null;
try {
  jpegDecode = require_("./jpeg-js").decode;
} catch {
  jpegDecode = null;
}

const texCache = new Map();

/**
 * Decode an image from the GLB into a plain RGBA array. Textures are used for
 * albedo *tint* only (mid-grey multiplier), which is enough to tell materials
 * apart in these diagnostic frames.
 */
export function decodeTexture(image) {
  if (!image) return null;
  const key = image.uuid || image.src || image;
  if (!key) return null;
  if (texCache.has(key)) return texCache.get(key);
  let out = null;
  try {
    if (image.data && image.width && image.width > 8) {
      // A canvas-like source (the procedural textures): read its pixels.
      out = { width: image.width, height: image.height, data: image.data };
    } else if (typeof image.src === "string" && image.src.endsWith(".png")) {
      // A file-backed texture: the asset kit's shared atlas and any PNG the game
      // loads from disk. Decoding it here is what lets the offline shots show
      // real textured models instead of falling back to flat white.
      const file = path.join(ROOT, image.src);
      if (fs.existsSync(file)) out = decodePNG(fs.readFileSync(file));
    } else if (image.data) {
      const src = image.data;
      if (typeof src === "string" && jpegDecode) {
        const buf = Buffer.from(src, "base64");
        const img = jpegDecode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
        out = { width: img.width, height: img.height, data: img.data };
      } else if (src && src.data && src.width) {
        // CanvasImageSource stub: no pixels available.
        out = null;
      }
    } else if (image.image && image.image.data) {
      out = { width: image.image.width, height: image.image.height, data: image.image.data };
    }
  } catch (e) {
    out = null;
  }
  texCache.set(key, out);
  return out;
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Sample an albedo texture's linear RGB at a UV. */
function sampleTextureColor(tex, u, v) {
  if (!tex) return [1, 1, 1];
  const { width, height, data } = tex;
  const x = Math.min(width - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * height)));
  const i = (y * width + x) * 4;
  if (data[i] === undefined) return [1, 1, 1];
  return [
    srgbToLinear(data[i] / 255),
    srgbToLinear(data[i + 1] / 255),
    srgbToLinear(data[i + 2] / 255),
  ];
}

/** Resolve a decoded texture for a material, tolerating Three's wrappers. */
export function materialTexture(mat) {
  const map = mat && (mat.map || null);
  if (!map) return null;
  const candidates = [map.image, map.source?.data, map.source?.image];
  for (const c of candidates) {
    const tex = c ? decodeTexture(c) : null;
    if (tex) return tex;
  }
  return null;
}

// ------------------------------------------------------------------ raster
export function rasterize(scene, camera, opts = {}) {
  const W = opts.width || 640;
  const H = opts.height || 360;
  const hf = opts.heightField || null;
  const mode = opts.mode || "light"; // light | flat | albedo | ids | depth | normals
  const perObject = opts.perObject || null; // Map/Object to accumulate screen area
  let meshSeq = 0;
  const color = new Float32Array(W * H * 3);
  const depth = new Float32Array(W * H).fill(Infinity);

  const bg = scene.background && scene.background.isColor ? scene.background.clone() : new THREE.Color(0x0b1116);
  const horizon = bg.clone().lerp(new THREE.Color(0x33454f), 0.7);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const c = horizon.clone().lerp(bg, Math.pow(t, 0.8));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      color[i] = c.r;
      color[i + 1] = c.g;
      color[i + 2] = c.b;
    }
  }

  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  scene.updateMatrixWorld(true);
  const viewProj = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  const lights = { points: [], sun: null, ambient: new THREE.Color(0, 0, 0), hemi: null };
  scene.traverse((o) => {
    if (o.isHemisphereLight) lights.hemi = o;
    if (o.isAmbientLight) lights.ambient.add(new THREE.Color(o.color).multiplyScalar(o.intensity));
    if (o.isDirectionalLight) lights.sun = o;
    if (o.isPointLight) {
      lights.points.push({
        obj: o,
        pos: o.getWorldPosition(new THREE.Vector3()),
        color: new THREE.Color(o.color),
        intensity: o.intensity,
        distance: o.distance,
      });
    }
  });
  const sunDir = new THREE.Vector3(0, 1, 0);
  if (lights.sun) {
    const t = lights.sun.target ? lights.sun.target.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    sunDir.copy(lights.sun.position).sub(t).normalize();
  }

  const stats = { triangles: 0, meshes: 0, skinnedVerts: 0, attempted: 0, clipped: 0, culled: 0 };
  // Fog is per pixel: a 140x170 m floor is two triangles, so evaluating fog at a
  // triangle centroid gives the whole floor one constant haze value.
  const fog = scene.fog
    ? {
        near: scene.fog.near,
        far: scene.fog.far,
        color: [scene.fog.color.r, scene.fog.color.g, scene.fog.color.b],
      }
    : null;
  const c2 = new THREE.Vector3();
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const s0 = new THREE.Vector3();
  const s1 = new THREE.Vector3();
  const s2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  scene.traverse((obj) => {
    // Instanced meshes are as important as plain meshes in this build: the whole
    // city's windows, trees and railings are instanced.
    if (!obj.isMesh) return;
    let visible = obj.visible;
    for (let p = obj.parent; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;
    const geo = obj.geometry;
    if (!geo || !geo.attributes.position) return;
    stats.meshes++;
    const objectId = meshSeq++;
    const idColor = new THREE.Color().setHSL(((objectId * 0.61803398875) % 1), 0.75, 0.55);
    const scratch = perObject !== null ? new Uint8Array(W * H) : null;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const groups = geo.groups && geo.groups.length
      ? geo.groups
      : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];

    const skinned = obj.isSkinnedMesh;
    // Cache skinned vertex positions once per mesh.
    let skinCache = null;
    if (skinned) {
      // Bone matrices are normally refreshed by the renderer; there is none
      // here, so update the skeleton explicitly before sampling vertices.
      obj.updateMatrixWorld(true);
      if (obj.skeleton) {
        obj.skeleton.update();
        if (obj.skeleton.boneTexture) obj.skeleton.computeBoneTexture?.();
      }
      skinCache = new Float32Array(pos.count * 3);
      // Mirror the GPU path exactly: the vertex shader applies bindMatrix, the
      // skinning matrices and bindMatrixInverse to the raw vertex, then the
      // model matrix. (Three's SkinnedMesh#applyBoneTransform leaves out that
      // final model matrix, and this export bakes the rig scale into it.)
      const sv = new THREE.Vector3();
      const bindPos = new THREE.Vector3();
      const acc = new THREE.Vector3();
      const skinMat = new THREE.Matrix4();
      const skinIndex = obj.geometry.attributes.skinIndex;
      const skinWeight = obj.geometry.attributes.skinWeight;
      const bones = obj.skeleton.bones;
      const inverses = obj.skeleton.boneInverses;
      for (let i = 0; i < pos.count; i++) {
        sv.fromBufferAttribute(pos, i).applyMatrix4(obj.bindMatrix);
        bindPos.copy(sv);
        sv.set(0, 0, 0);
        for (const axis of ["X", "Y", "Z", "W"]) {
          const w = skinWeight[`get${axis}`](i);
          if (w === 0) continue;
          const j = skinIndex[`get${axis}`](i);
          const bone = bones[j];
          const inv = inverses[j];
          if (!bone || !inv) continue;
          skinMat.multiplyMatrices(bone.matrixWorld, inv);
          acc.copy(bindPos).applyMatrix4(skinMat).multiplyScalar(w);
          sv.add(acc);
        }
        sv.applyMatrix4(obj.bindMatrixInverse).applyMatrix4(obj.matrixWorld);
        skinCache[i * 3] = sv.x;
        skinCache[i * 3 + 1] = sv.y;
        skinCache[i * 3 + 2] = sv.z;
      }
      stats.skinnedVerts += pos.count;
    }

    // Instanced meshes: a matrix per instance, applied on top of matrixWorld.
    const isInstanced = !!obj.isInstancedMesh;
    const instanceMatrices = isInstanced ? obj.instanceMatrix.array : null;
    let instanceMatrix = null;
    if (isInstanced) {
      instanceMatrix = new THREE.Matrix4();
      instanceMatrix.elements = obj.instanceMatrix.array;
      stats.instances = (stats.instances || 0) + obj.count;
    }
    const skinMatTmp = new THREE.Matrix4();
    const c0 = [0, 0, 0], c1 = [0, 0, 0], c2 = [0, 0, 0];
    const getVertFor = (instance, i, out) => {
      if (skinCache) return out.set(skinCache[i * 3], skinCache[i * 3 + 1], skinCache[i * 3 + 2]);
      out.fromBufferAttribute(pos, i);
      if (isInstanced) {
        skinMatTmp.fromArray(instanceMatrices, instance * 16);
        skinMatTmp.premultiply(obj.matrixWorld);
        return out.applyMatrix4(skinMatTmp);
      }
      return out.applyMatrix4(obj.matrixWorld);
    };
    const getVert = (i, out) => getVertFor(0, i, out);

    const instanceCount = isInstanced ? obj.count : 1;
    let objWritten = 0;
    for (let instance = 0; instance < instanceCount; instance++) {
      for (const g of groups) {
      const mat = mats[g.materialIndex || 0] || mats[0];
      if (!mat) continue;
      if (mat.transparent && (mat.opacity ?? 1) < 0.03) continue;
      const base = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
      // Vertex colours (palette-authored kits) are sampled per pixel below, not
      // averaged per face: a triangle that spans green foliage and brown trunk
      // averages to grey, which is worse than not shading it at all.
      const vcolAttr = mat.vertexColors && geo && geo.getAttribute
        ? geo.getAttribute("color")
        : null;
      const diffuseTex = materialTexture(mat);
      const emissive = mat.emissive
        ? new THREE.Color(mat.emissive).multiplyScalar(mat.emissiveIntensity ?? 1)
        : null;
      const doubleSided = mat.side === THREE.DoubleSide;
      const unlit = !!mat.isMeshBasicMaterial;
      const count = Math.min(g.count, (idx ? idx.count : pos.count) - g.start);

      for (let i = 0; i < count; i += 3) {
        const ia = idx ? idx.getX(g.start + i) : g.start + i;
        const ib = idx ? idx.getX(g.start + i + 1) : g.start + i + 1;
        const ic = idx ? idx.getX(g.start + i + 2) : g.start + i + 2;
        getVertFor(instance, ia, v0);
        getVertFor(instance, ib, v1);
        getVertFor(instance, ic, v2);

        // Face normal (skinned meshes: derive from posed vertices).
        nrm.copy(v1).sub(v0).cross(tmp.copy(v2).sub(v0));
        if (nrm.lengthSq() < 1e-14) continue;
        nrm.normalize();
        const centroid = s0.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);
        const toCam = tmp.copy(camera.position).sub(centroid);
        let facing = nrm.dot(toCam);
        if (doubleSided && facing < 0) {
          nrm.negate();
          facing = -facing;
        }
        if (!doubleSided && facing <= 0) {
          stats.culled++;
          continue;
        }

        // Shading
        const lit = new THREE.Color(0, 0, 0).add(lights.ambient);
        if (unlit) lit.set(1, 1, 1);
        if (mode === "flat") lit.set(1, 1, 1);
        if (lights.hemi && !unlit) {
          const up = nrm.y * 0.5 + 0.5;
          lit.add(new THREE.Color(lights.hemi.color).multiplyScalar(up * lights.hemi.intensity));
          lit.add(new THREE.Color(lights.hemi.groundColor).multiplyScalar((1 - up) * lights.hemi.intensity));
        }
        if (lights.sun && !unlit) {
          const ndl = Math.max(0, nrm.dot(sunDir));
          lit.add(new THREE.Color(lights.sun.color).multiplyScalar(ndl * lights.sun.intensity * 0.8));
        }
        for (const L of unlit ? [] : lights.points) {
          const d = L.pos.distanceTo(centroid);
          if (L.distance > 0 && d > L.distance) continue;
          const dir = s1.copy(L.pos).sub(centroid).normalize();
          const ndl = Math.max(0, nrm.dot(dir));
          if (ndl <= 0) continue;
          const falloff = L.distance > 0 ? Math.max(0, 1 - d / L.distance) ** 1.6 : 1;
          lit.add(L.color.clone().multiplyScalar((L.intensity * ndl * falloff) / 22));
        }
        // Wet-surface sheen: a little sky reflectance on smooth, upward faces.
        if (!unlit && mode === "light") {
          const gloss = Math.max(0, 1 - (mat.roughness ?? 0.85));
          const up = Math.max(0, nrm.y);
          const sheen = gloss * up * 0.16;
          lit.r += sheen;
          lit.g += sheen * 1.1;
          lit.b += sheen * 1.25;
        }
        // Keep the diagnostic in a readable range; the real renderer tone-maps.
        lit.r = Math.min(lit.r, 2.4);
        lit.g = Math.min(lit.g, 2.4);
        lit.b = Math.min(lit.b, 2.4);
        const out = new THREE.Color(base.r * lit.r, base.g * lit.g, base.b * lit.b);

        if (emissive && mode !== "flat" && mode !== "ids") out.add(emissive);
        if (mode === "albedo") out.set(base.r, base.g, base.b);
        if (mode === "ids") out.copy(idColor);
        if (mode === "normals") out.set(nrm.x * 0.5 + 0.5, nrm.y * 0.5 + 0.5, nrm.z * 0.5 + 0.5);
        if (mode === "depth") {
          const d = centroid.distanceTo(camera.position);
          const g = 1 - Math.min(1, d / 80);
          out.set(g, g, g);
        }

        stats.attempted++;
        // Project with near-plane clipping. A large ground plane always straddles
        // the near plane, so skipping such triangles would erase the floor.
        const clipPts = [];
        let clipped = false;
        const viewVerts = [v0, v1, v2].map((v) => {
          const view = v.clone().applyMatrix4(camera.matrixWorldInverse);
          if (-view.z < camera.near) clipped = true;
          return view;
        });
        const near = -camera.near;
        let poly = [];
        if (!clipped) {
          poly = viewVerts;
        } else {
          // Clip the view-space triangle against z = -near (keep z <= -near).
          const inside = (p) => p.z <= near;
          for (let i = 0; i < 3; i++) {
            const a = viewVerts[i];
            const b = viewVerts[(i + 1) % 3];
            const ina = inside(a);
            const inb = inside(b);
            if (ina) poly.push(a.clone());
            if (ina !== inb) {
              const t = (near - a.z) / (b.z - a.z);
              poly.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, near));
            }
          }
          if (poly.length < 3) {
            stats.clipped++;
            continue;
          }
        }
        for (const vv of poly) {
          if (!Number.isFinite(vv.x) || !Number.isFinite(vv.y) || !Number.isFinite(vv.z)) {
            clipped = true;
            break;
          }
          // Apply the projection matrix to the view-space vertex. (Do not reuse
          // this temporary: `clip` aliases it and a later write would corrupt it.)
          // Vector3#applyMatrix4 divides by w and discards it, so the clip-space
          // w has to come from the view-space depth.
          const viewDepth = -vv.z;
          if (!(viewDepth > 0)) {
            clipped = true;
            break;
          }
          const clip = vv.clone().applyMatrix4(camera.projectionMatrix);
          clipPts.push({
            x: (clip.x * 0.5 + 0.5) * W,
            y: (1 - (clip.y * 0.5 + 0.5)) * H,
            // NDC z is already clip.z/clip.w, so it interpolates *linearly* in
            // screen space (see fillTri). invDepth backs perspective-correct
            // distance for per-pixel fog.
            z: clip.z,
            viewDepth,
            invDepth: 1 / viewDepth,
          });
        }
        if (clipped && clipPts.length !== poly.length) continue;
        // Fan-triangulate the clipped polygon.
        const tris = [];
        if (opts.debugTriangles && opts.debugTriangles.length < 6) {
          opts.debugTriangles.push({
            name: obj.name,
            view: viewVerts.map((v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]),
            screen: clipPts.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1), +p.viewDepth.toFixed(2)]),
          });
        }
        for (let i = 1; i + 1 < clipPts.length; i++) tris.push([clipPts[0], clipPts[i], clipPts[i + 1]]);
        stats.triangles++;

        // Corner colours: shading is constant across a flat-shaded face, but the
        // texture and any vertex colour are not. Sampling both per pixel is what
        // turns a 1k atlas from smeared blocks into a readable facade.
        const uvAttr = geo.attributes.uv;
        const cornerColor = (i, outC) => {
          let r = out.r, g = out.g, b = out.b;
          if (vcolAttr) {
            // glTF vertex colours are linear, like the lighting, so multiply.
            r *= vcolAttr.getX(i);
            g *= vcolAttr.getY(i);
            b *= vcolAttr.getZ(i);
          }
          if (diffuseTex) {
            const t = uvAttr
              ? sampleTextureColor(diffuseTex, uvAttr.getX(i), uvAttr.getY(i))
              : [1, 1, 1];
            r *= t[0]; g *= t[1]; b *= t[2];
          }
          outC[0] = r; outC[1] = g; outC[2] = b;
        };
        let rgb = [out.r, out.g, out.b];
        if (diffuseTex || vcolAttr) {
          cornerColor(ia, c0);
          cornerColor(ib, c1);
          cornerColor(ic, c2);
          rgb = [c0, c1, c2];
        }
        const alpha = mat.transparent ? (mat.opacity ?? 1) : 1;
        for (const tri of tris) {
          stats.triangles++;
          if (mat.transparent) {
            blendTri({ color, depth, W, H, fog }, tri, rgb, alpha);
          } else {
            fillTri({ color, depth, W, H, fog }, tri, rgb, scratch);
          }
        }
      }
      }
    }
    if (scratch) {
      let n = 0;
      for (let i = 0; i < scratch.length; i++) n += scratch[i];
      const list = perObject.list || (perObject.list = []);
      list.push({
        name: obj.name || obj.type,
        area: n,
        id: objectId,
        hex: "#" + idColor.getHexString(),
        world: obj.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
      });
    }
  });

  return { color, depth, stats, lights };
}

function fillTri({ color, depth, W, H, fog }, p, rgb, objectBuf = null) {
  const perCorner = Array.isArray(rgb[0]);
  if (!Number.isFinite(p[0].x + p[1].x + p[2].x + p[0].y + p[1].y + p[2].y)) return;
  const minX = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x)));
  const minY = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y)));
  if (minX > maxX || minY > maxY) return;
  const area = (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[2].x - p[0].x) * (p[1].y - p[0].y);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  const i0 = p[0].invDepth, i1 = p[1].invDepth, i2 = p[2].invDepth;
  const z0 = p[0].z, z1 = p[1].z, z2 = p[2].z;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((p[1].x - px) * (p[2].y - py) - (p[2].x - px) * (p[1].y - py)) * inv;
      const w1 = ((p[2].x - px) * (p[0].y - py) - (p[0].x - px) * (p[2].y - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2;
      const k = y * W + x;
      if (z >= depth[k]) continue;
      depth[k] = z;
      const c = k * 3;
      let r, g, b;
      if (perCorner) {
        r = w0 * rgb[0][0] + w1 * rgb[1][0] + w2 * rgb[2][0];
        g = w0 * rgb[0][1] + w1 * rgb[1][1] + w2 * rgb[2][1];
        b = w0 * rgb[0][2] + w1 * rgb[1][2] + w2 * rgb[2][2];
      } else {
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      }
      if (fog) {
        const invD = w0 * i0 + w1 * i1 + w2 * i2;
        const dist = invD > 0 ? 1 / invD : fog.far;
        const t = (dist - fog.near) / (fog.far - fog.near);
        if (t > 0) {
          const ft = t > 1 ? 1 : t;
          r += (fog.color[0] - r) * ft;
          g += (fog.color[1] - g) * ft;
          b += (fog.color[2] - b) * ft;
        }
      }
      color[c] = r;
      color[c + 1] = g;
      color[c + 2] = b;
      if (objectBuf) objectBuf[k] = 1;
    }
  }
}

function blendTri({ color, depth, W, H }, p, rgb, alpha) {
  const perCorner = Array.isArray(rgb[0]);
  const a2 = Math.min(1, alpha);
  if (a2 <= 0) return;
  const minX = Math.max(0, Math.floor(Math.min(p[0].x, p[1].x, p[2].x)));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(p[0].x, p[1].x, p[2].x)));
  const minY = Math.max(0, Math.floor(Math.min(p[0].y, p[1].y, p[2].y)));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(p[0].y, p[1].y, p[2].y)));
  const area = (p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[2].x - p[0].x) * (p[1].y - p[0].y);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((p[1].x - px) * (p[2].y - py) - (p[2].x - px) * (p[1].y - py)) * inv;
      const w1 = ((p[2].x - px) * (p[0].y - py) - (p[0].x - px) * (p[2].y - py)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * p[0].z + w1 * p[1].z + w2 * p[2].z;
      const k = y * W + x;
      if (z > depth[k] + 0.002) continue;
      const c = k * 3;
      let sr, sg, sb;
      if (perCorner) {
        sr = w0 * rgb[0][0] + w1 * rgb[1][0] + w2 * rgb[2][0];
        sg = w0 * rgb[0][1] + w1 * rgb[1][1] + w2 * rgb[2][1];
        sb = w0 * rgb[0][2] + w1 * rgb[1][2] + w2 * rgb[2][2];
      } else {
        sr = rgb[0]; sg = rgb[1]; sb = rgb[2];
      }
      color[c] = color[c] * (1 - a2) + sr * a2;
      color[c + 1] = color[c + 1] * (1 - a2) + sg * a2;
      color[c + 2] = color[c + 2] * (1 - a2) + sb * a2;
    }
  }
}

// ------------------------------------------------------------ diagnostics
export function describeImage(color, W, H) {
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * color[i * 3] + 0.7152 * color[i * 3 + 1] + 0.0722 * color[i * 3 + 2];
    sum += l;
    if (l < 0.02) dark++;
    if (l > 0.6) bright++;
  }
  return {
    meanLuma: +(sum / (W * H)).toFixed(4),
    darkFraction: +(dark / (W * H)).toFixed(3),
    brightFraction: +(bright / (W * H)).toFixed(3),
  };
}

/** Fraction of the character's screen-space bounding box that is drawn on top. */
export function characterCoverage(perObject, name) {
  if (!perObject || !perObject.list) return 0;
  const entry = perObject.list.find((o) => o.name === name);
  return entry ? entry.area : 0;
}
