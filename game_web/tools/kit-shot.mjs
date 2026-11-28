// Render the real CityView, then swap its furniture for the asset kit the same
// way main.js does, so the offline shot shows what the browser will show.
import * as THREE from "three";
import fs from "node:fs";
import { readGltf, flatten } from "./gltf.mjs";
import { decodePNG } from "./png.mjs";
import { rasterize, encodePNG } from "./software-raster.mjs";
import { buildCity, CITY } from "../src/city.js";
import { CityView, makeVehicleMesh } from "../src/cityview.js";
import { TIERS } from "../src/config.js";

const DIR = "./assets/kit/models";
const atlas = decodePNG(fs.readFileSync("./assets/kit/textures/citybits_texture.png"));
const image = { width: atlas.width, height: atlas.height, data: new Uint8ClampedArray(atlas.data), uuid: "kit-atlas" };
const texture = new THREE.Texture();
texture.image = image;
const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0.04 });

const cache = new Map();
function geometryFor(name) {
  if (cache.has(name)) return cache.get(name);
  const model = readGltf(`${DIR}/${name}.gltf`);
  const flat = flatten(model);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flat.position), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(flat.normal), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(flat.uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(flat.index), 1));
  cache.set(name, g);
  return g;
}
const kit = {
  material,
  has: (n) => fs.existsSync(`${DIR}/${n}.gltf`),
  size(n) {
    const g = geometryFor(n);
    g.computeBoundingBox();
    return g.boundingBox.getSize(new THREE.Vector3());
  },
  make(n) {
    const g = geometryFor(n);
    const mesh = new THREE.Mesh(g, material);
    return { children: [mesh], userData: {} };
  },
};

// ---- build the district and swap furniture in
const tier = TIERS.desktop;
const built = buildCity(CITY, tier);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
const view = new CityView(scene, CITY, built, tier).build();
view.applyKit(kit);

// cars: put one of every kit model along the avenue, at driving size
const CAR = ["car_sedan", "car_hatchback", "car_taxi", "car_police", "car_stationwagon"];
CAR.forEach((name, i) => {
  const g = geometryFor(name);
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new THREE.Vector3());
  const mesh = new THREE.Mesh(g, material);
  const scale = 4.3 / size.z;
  mesh.scale.setScalar(scale);
  mesh.position.set(-14 + i * 7, -g.boundingBox.min.y * scale, -60);
  scene.add(mesh);
});

// lights: a night key so the shot reads like the game
const hemi = new THREE.HemisphereLight(0x8fa8c8, 0x1c1a18, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xbfd4ff, 0.85);
moon.position.set(30, 60, 20);
scene.add(moon);
const warm = new THREE.DirectionalLight(0xffc98a, 0.5);
warm.position.set(-40, 20, -30);
scene.add(warm);

function shoot(cam, out, w = 900, h = 450) {
  const c = new THREE.PerspectiveCamera(45, w / h, 0.2, 400);
  c.position.set(...cam.pos);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const { color } = rasterize(scene, c, { width: w, height: h, defaultLighting: false });
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h * 3; i++) {
    const v = Math.max(0, color[i]);
    const tm = v / (1 + v);
    rgb[i] = tm <= 0.0031308 ? tm * 12.92 : 1.055 * Math.pow(tm, 1 / 2.4) - 0.055;
  }
  fs.writeFileSync(out, encodePNG(w, h, rgb));
  console.log("wrote", out);
}

shoot({ pos: [-26, 3.2, -46], look: [0, 2, -62] }, "/tmp/kit_street.png");
shoot({ pos: [-2, 9, -34], look: [-6, 1, -62] }, "/tmp/kit_avenue.png");
