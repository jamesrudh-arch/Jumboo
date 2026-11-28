// KayKit City Builder Bits: the street-level asset kit.
//
// Why this exists: the district's buildings are generated extrusions, and a
// generated extrusion is fine for a 40 m tower seen from a bridge but reads as a
// slab at arm's length. These are CC0 modular models (Kay Lousberg), one shared
// 1k texture atlas, 27k triangles across the whole pack — so the whole street
// kit costs less than two of the old hand-built cars.
//
// The models are vendored under assets/kit/ so the game has no third-party
// network dependency at runtime. See assets/kit/LICENSE-KayKit-City-Builder-Bits.txt.
//
// Loading strategy: one texture atlas, one shared material, and every model
// parsed once then cloned. Traffic clones share geometry, so fourteen cars of
// four kinds are four geometry uploads, not fourteen.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BASE = "./assets/kit/";
const MODEL_DIR = `${BASE}models/`;
const ATLAS = `${BASE}textures/citybits_texture.png`;

/** Models the game uses, and what each one is for. */
export const KIT_MODELS = {
  cars: ["car_sedan", "car_hatchback", "car_taxi", "car_police", "car_stationwagon"],
  buildings: [
    "building_A_withoutBase",
    "building_B_withoutBase",
    "building_C_withoutBase",
    "building_D_withoutBase",
    "building_E_withoutBase",
    "building_F_withoutBase",
    "building_G_withoutBase",
    "building_H_withoutBase",
  ],
  props: ["streetlight", "trafficlight_A", "trafficlight_B", "trafficlight_C", "firehydrant", "dumpster", "bench", "trash_A", "trash_B", "bush", "watertower", "box_A", "box_B"],
};

/** Every model name in the kit, flattened. */
export function allModelNames() {
  return [...KIT_MODELS.cars, ...KIT_MODELS.buildings, ...KIT_MODELS.props];
}

/**
 * Decode the shared atlas through the browser's own decoder.
 *
 * three's GLTFLoader would otherwise fetch and decode each model's texture
 * separately; with one atlas there is exactly one texture for the whole kit, and
 * decoding it once means the material can be shared by every model.
 */
async function loadAtlas(renderer) {
  const image = new Image();
  image.src = ATLAS;
  await image.decode();
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF UV convention
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

/** Parse one .gltf from the vendored folder, with its .bin inlined. */
async function parseModel(name) {
  const gltfUrl = `${MODEL_DIR}${name}.gltf`;
  const json = await (await fetch(gltfUrl)).json();
  // The .gltf references its .bin as a sibling file. Serving it from disk is one
  // extra request per model, so inline it: the files are tiny, and this makes
  // loading a single promise per model instead of two.
  await Promise.all(
    (json.buffers || []).map(async (buffer) => {
      if (!buffer.uri || buffer.uri.startsWith("data:")) return;
      const bin = await fetch(`${MODEL_DIR}${buffer.uri}`).then((r) => r.arrayBuffer());
      let binary = "";
      const bytes = new Uint8Array(bin);
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      buffer.uri = `data:application/octet-stream;base64,${btoa(binary)}`;
    }),
  );
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(JSON.stringify(json), "", resolve, reject);
  });
}

/**
 * Load the kit. Returns a library with a fresh clone per call, plus the shared
 * material, plus measured bounds so placement code can work in real metres.
 */
export async function loadKit(renderer, { onProgress } = {}) {
  const atlas = await loadAtlas(renderer);
  // One material for the entire kit: the atlas holds every colour, and the
  // models carry no per-model material variation beyond that.
  const material = new THREE.MeshStandardMaterial({
    map: atlas,
    roughness: 0.82,
    metalness: 0.04,
  });

  const names = allModelNames();
  const sources = new Map();
  let done = 0;
  // Parse sequentially in small batches: each parse is cheap, and serialising it
  // keeps the main thread responsive while the title screen is up.
  for (const name of names) {
    try {
      const gltf = await parseModel(name);
      const meshes = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        // Bake the node transform into the geometry so clones need no rig: these
        // are static props, and a baked geometry merges and instances cleanly.
        const geo = o.geometry.clone();
        geo.applyMatrix4(o.matrixWorld);
        // Drop attributes the shared material does not use, or three will keep
        // them alive for nothing.
        for (const key of Object.keys(geo.attributes)) {
          if (!["position", "normal", "uv"].includes(key)) geo.deleteAttribute(key);
        }
        const part = new THREE.Mesh(geo, material);
        part.name = o.name || name;
        meshes.push(part);
      });
      const box = new THREE.Box3();
      for (const m of meshes) {
        m.geometry.computeBoundingBox();
        box.union(m.geometry.boundingBox);
      }
      sources.set(name, {
        // Car parts are kept separate so wheels can be spun; everything else is
        // collapsed into one mesh.
        group: gltf.scene,
        meshes,
        bounds: box,
        size: box.getSize(new THREE.Vector3()),
      });
    } catch (err) {
      console.warn(`[kit] failed to load ${name}`, err);
    }
    done++;
    onProgress?.(done / names.length, name);
  }

  /** A fresh clone. Car wheels stay live as userData.wheels. */
  function make(name) {
    const src = sources.get(name);
    if (!src) return null;
    const group = new THREE.Group();
    const wheels = [];
    for (const m of src.meshes) {
      const mesh = new THREE.Mesh(m.geometry, material);
      mesh.name = m.name;
      group.add(mesh);
      if (/wheel/i.test(m.name)) wheels.push(mesh);
    }
    group.userData.wheels = wheels;
    group.userData.size = src.size.clone();
    group.userData.bounds = src.bounds.clone();
    return group;
  }

  return {
    material,
    atlas,
    sources,
    make,
    /** Size in metres of a model as authored. */
    size(name) {
      return sources.get(name)?.size?.clone() || new THREE.Vector3(1, 1, 1);
    },
    has(name) {
      return sources.has(name);
    },
  };
}
