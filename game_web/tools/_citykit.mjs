// Load the .glb city kit in Node the way src/kit.js does in the browser, so the
// offline renderer can screenshot the same scene the player sees.
import * as THREE from "three";
import fs from "node:fs";
import { readGltf, flatten } from "./gltf.mjs";

export const CITY_DIR = "./assets/city/models";
export function makeCityKit(names) {
  const models = new Map();
  for (const name of names) {
    const buf = fs.readFileSync(`${CITY_DIR}/${name}.glb`);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
    const bin = buf.subarray(20 + jsonLen + 8);
    json.buffers = [{ byteLength: bin.length, uri: "data:application/octet-stream;base64," + bin.toString("base64") }];
    fs.writeFileSync("/tmp/_ck.json", JSON.stringify(json));
    const model = readGltf("/tmp/_ck.json");

    // Mirror flatten(), but keep each primitive separate with its material colour.
    const parts = [];
    const box = new THREE.Box3();
    model.parts().forEach((part) => {
      const flat = flatten({ parts: () => [part] });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(flat.position, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(flat.normal, 3));
      g.setIndex(new THREE.BufferAttribute(flat.index, 1));
      g.computeBoundingBox();
      box.union(g.boundingBox);
      const mat = model.json.materials?.[part.material] || {};
      const f = mat.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1];
      parts.push({ geometry: g, color: new THREE.Color(f[0], f[1], f[2]) });
    });
    models.set(name, { parts, size: box.getSize(new THREE.Vector3()), triangles: parts.reduce((n, p) => n + p.geometry.index.count / 3, 0) });
  }
  const cache = new Map();
  const material = (color) => {
    const key = color.getHexString();
    if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color: color.clone(), roughness: 0.85, metalness: 0.02 }));
    return cache.get(key);
  };
  return {
    has: (n) => models.has(n),
    size: (n) => models.get(n).size.clone(),
    parts: (n) => models.get(n).parts,
    material,
    triangles: (n) => models.get(n).triangles,
    make(n) {
      const src = models.get(n);
      if (!src) return null;
      const g = new THREE.Group();
      for (const p of src.parts) g.add(new THREE.Mesh(p.geometry, material(p.color)));
      g.userData.size = src.size.clone();
      return g;
    },
  };
}
