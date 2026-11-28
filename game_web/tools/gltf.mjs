// A small glTF 2.0 reader for the offline tools: .gltf + .bin pairs, the subset
// that asset packs actually ship (indexed triangles, POSITION/NORMAL/TEXCOORD_0,
// TRS or matrix nodes, one base-colour texture).
//
// It exists so the kit can be audited and baked without a browser: three's
// GLTFLoader needs Image/createImageBitmap and a fetch, neither of which a
// headless Node run has.

import fs from "node:fs";
import path from "node:path";

const COMPONENTS = {
  5120: { array: Int8Array, size: 1 },
  5121: { array: Uint8Array, size: 1 },
  5122: { array: Int16Array, size: 2 },
  5123: { array: Uint16Array, size: 2 },
  5125: { array: Uint32Array, size: 4 },
  5126: { array: Float32Array, size: 4 },
};
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Read a glTF file and its buffers. Images are returned as file paths. */
export function readGltf(file) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const dir = path.dirname(file);
  const buffers = (json.buffers || []).map((b) => {
    if (b.uri && b.uri.startsWith("data:")) {
      return Buffer.from(b.uri.slice(b.uri.indexOf(",") + 1), "base64");
    }
    return fs.readFileSync(path.join(dir, b.uri));
  });

  function accessor(index) {
    const a = json.accessors[index];
    const view = json.bufferViews[a.bufferView];
    const comp = COMPONENTS[a.componentType];
    const count = a.count * TYPES[a.type];
    const byteOffset = (view.byteOffset || 0) + (a.byteOffset || 0);
    const buf = buffers[a.bufferView === undefined ? 0 : view.buffer ?? 0];
    // Copy into a typed array so no view assumptions leak out of this function.
    const out = new comp.array(count);
    const byteStride = view.byteStride || comp.size * TYPES[a.type];
    const stride = byteStride / comp.size;
    if (stride === TYPES[a.type]) {
      for (let i = 0; i < count; i++) out[i] = buf.readFloatLE
        ? readComponent(buf, byteOffset + i * comp.size, comp, a.normalized)
        : 0;
    } else {
      for (let e = 0; e < a.count; e++) {
        for (let c = 0; c < TYPES[a.type]; c++) {
          out[e * TYPES[a.type] + c] = readComponent(
            buf,
            byteOffset + e * byteStride + c * comp.size,
            comp,
            a.normalized,
          );
        }
      }
    }
    return out;
  }

  function readComponent(buf, offset, comp, normalized) {
    let v;
    switch (comp.array) {
      case Int8Array: v = buf.readInt8(offset); break;
      case Uint8Array: v = buf.readUInt8(offset); break;
      case Int16Array: v = buf.readInt16LE(offset); break;
      case Uint16Array: v = buf.readUInt16LE(offset); break;
      case Uint32Array: v = buf.readUInt32LE(offset); break;
      default: v = buf.readFloatLE(offset); break;
    }
    if (normalized) {
      if (comp.array === Uint8Array) return v / 255;
      if (comp.array === Uint16Array) return v / 65535;
      if (comp.array === Int8Array) return Math.max(v / 127, -1);
      if (comp.array === Int16Array) return Math.max(v / 32767, -1);
    }
    return v;
  }

  /** World matrix of a node, as a flat column-major 4x4. */
  function nodeMatrix(node) {
    if (node.matrix) return node.matrix.slice();
    const t = node.translation || [0, 0, 0];
    const r = node.rotation || [0, 0, 0, 1];
    const s = node.scale || [1, 1, 1];
    const [x, y, z, w] = r;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    return [
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      t[0], t[1], t[2], 1,
    ];
  }

  function multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  /** Every mesh instance with its geometry in model space. */
  function parts() {
    const out = [];
    const scene = json.scenes?.[json.scene ?? 0];
    const roots = scene ? scene.nodes || [] : (json.nodes || []).map((_, i) => i);
    const walk = (index, parent) => {
      const node = json.nodes[index];
      if (!node) return;
      const world = multiply(parent, nodeMatrix(node));
      if (node.mesh !== undefined) {
        const mesh = json.meshes[node.mesh];
        for (const prim of mesh.primitives) {
          out.push({
            name: node.name || mesh.name || `mesh${node.mesh}`,
            matrix: world,
            material: prim.material ?? 0,
            position: accessor(prim.attributes.POSITION),
            normal: prim.attributes.NORMAL !== undefined ? accessor(prim.attributes.NORMAL) : null,
            uv: prim.attributes.TEXCOORD_0 !== undefined ? accessor(prim.attributes.TEXCOORD_0) : null,
            index: prim.indices !== undefined ? accessor(prim.indices) : null,
          });
        }
      }
      for (const child of node.children || []) walk(child, world);
    };
    for (const r of roots) walk(r, identity);
    return out;
  }

  return {
    json,
    parts,
    images: (json.images || []).map((img) => (img.uri ? path.join(dir, img.uri) : null)),
    textures: json.textures || [],
    materials: json.materials || [],
  };
}

/** Apply a column-major 4x4 to a point, in place. */
export function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  p[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  p[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  p[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return p;
}

/** Flatten a model into one triangle soup: positions, normals, uvs, indices. */
export function flatten(model) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let base = 0;
  for (const part of model.parts()) {
    const m = part.matrix;
    const count = part.position.length / 3;
    for (let i = 0; i < count; i++) {
      const p = [part.position[i * 3], part.position[i * 3 + 1], part.position[i * 3 + 2]];
      transformPoint(m, p);
      positions.push(p[0], p[1], p[2]);
      if (part.normal) {
        const n = [part.normal[i * 3], part.normal[i * 3 + 1], part.normal[i * 3 + 2]];
        // Rotation only: these models use uniform scale or none.
        const w = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
        const len = Math.hypot(w[0], w[1], w[2]) || 1;
        normals.push(w[0] / len, w[1] / len, w[2] / len);
      } else {
        normals.push(0, 1, 0);
      }
      if (part.uv) uvs.push(part.uv[i * 2], part.uv[i * 2 + 1]);
      else uvs.push(0, 0);
    }
    if (part.index) {
      for (let i = 0; i < part.index.length; i++) indices.push(part.index[i] + base);
    } else {
      for (let i = 0; i < count; i++) indices.push(i + base);
    }
    base += count;
  }
  return {
    position: new Float32Array(positions),
    normal: new Float32Array(normals),
    uv: new Float32Array(uvs),
    index: new Uint32Array(indices),
  };
}

/** Axis-aligned bounds of a flattened model. */
export function bounds(geo) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geo.position.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c], geo.position[i + c]);
      max[c] = Math.max(max[c], geo.position[i + c]);
    }
  }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}
