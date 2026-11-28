// Contact sheet of the KayKit city kit: every model, lit, textured, at a matched
// angle. This is the "is it actually 10/10" check, done visually.
import * as THREE from "three";
import fs from "node:fs";
import { readGltf, flatten, bounds } from "./gltf.mjs";
import { decodePNG } from "./png.mjs";
import { rasterize, encodePNG } from "./software-raster.mjs";

const DIR = "/tmp/kaykit/addons/kaykit_city_builder_bits/Assets/gltf";
const ATLAS = `${DIR}/citybits_texture.png`;

function toGeometry(geo) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(geo.position), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(geo.normal), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.uv), 2));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(geo.index), 1));
  return g;
}

const decoded = decodePNG(fs.readFileSync(ATLAS));

function makeCanvasLike(tex) {
  // The rasteriser's decodeTexture() reads {width,height,data} off image.data.
  const canvas = { width: tex.width, height: tex.height, data: new Uint8ClampedArray(tex.data) };
  const image = { width: tex.width, height: tex.height, data: canvas.data, uuid: "kit-atlas" };
  return image;
}
const atlasImage = makeCanvasLike(decoded);
const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 });
const tex = new THREE.Texture();
tex.image = atlasImage;
tex.needsUpdate = true;
material.map = tex;

export function kitScene(names, { spacing = 1.4, y = 0, scale = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  const group = new THREE.Group();
  names.forEach((name, i) => {
    const model = readGltf(`${DIR}/${name}.gltf`);
    const flat = flatten(model);
    const b = bounds(flat);
    const g = toGeometry(flat);
    const mesh = new THREE.Mesh(g, material);
    // Put each model's feet on the ground and centre it in its slot.
    mesh.position.set((i - (names.length - 1) / 2) * spacing, y - b.min[1] * scale, 0);
    mesh.scale.setScalar(scale);
    mesh.name = name;
    group.add(mesh);
  });
  scene.add(group);
  const hemi = new THREE.HemisphereLight(0x9db4d8, 0x2a2620, 0.75);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.5);
  key.position.set(3, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fb0ff, 0.5);
  fill.position.set(-5, 3, -4);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = y - 0.001;
  scene.add(ground);
  return { scene, group };
}

export function shoot(names, out, { width = 1000, height = 380, dist = 9, heightY = 3.2, look = 1.2, spacing = 1.4 } = {}) {
  const { scene } = kitScene(names, { spacing });
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 200);
  camera.position.set(0, heightY, dist);
  camera.lookAt(0, look, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const { color } = rasterize(scene, camera, { width, height, defaultLighting: false });
  // rasterize returns a float RGB buffer in linear space; tone-map to sRGB bytes.
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) {
      const v = Math.max(0, color[i * 3 + c]);
      const tm = v / (1 + v);
      const s = tm <= 0.0031308 ? tm * 12.92 : 1.055 * Math.pow(tm, 1 / 2.4) - 0.055;
      rgb[i * 3 + c] = Math.min(1, Math.max(0, s)); // encodePNG takes 0..1
    }
  }
  fs.writeFileSync(out, encodePNG(width, height, rgb));
  console.log("wrote", out);
}

if (process.argv[1].endsWith("_render_kit.mjs")) {
  const all = fs.readdirSync(DIR).filter((f) => f.endsWith(".gltf")).map((f) => f.replace(".gltf", ""));
  shoot(all.filter((n) => n.startsWith("building") && !n.includes("withoutBase")), "/tmp/kit_buildings.png", { width: 1100, height: 420, dist: 12, heightY: 4.5, look: 1.4 });
  shoot(all.filter((n) => n.startsWith("car_")), "/tmp/kit_cars.png", { width: 1000, height: 300, dist: 6.5, heightY: 2.0, look: 0.35, spacing: 1.3 });
  shoot(all.filter((n) => n.startsWith("trafficlight") || n === "streetlight" || n === "watertower" || n === "firehydrant" || n === "dumpster" || n === "bench" || n === "trash_A" || n === "bush"), "/tmp/kit_props.png", { width: 1000, height: 340, dist: 7, heightY: 2.6, look: 0.8, spacing: 1.1 });
  shoot(all.filter((n) => n.startsWith("road_")), "/tmp/kit_roads.png", { width: 900, height: 420, dist: 9, heightY: 7, look: 0, spacing: 2.4 });
}
