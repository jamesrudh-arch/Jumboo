// Scratch: what clips does each vendored enemy actually carry?
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
const dir = "assets/arsenal/enemies";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".glb"));
// The loader needs a fetch; read the file and hand it a data URL instead.
const loader = new GLTFLoader();
async function load(url) {
  const buf = fs.readFileSync(url);
  return new Promise((res, rej) => {
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej);
  });
}
for (const f of files) {
  try {
    const g = await load(`${dir}/${f}`);
    const names = g.animations.map(a => a.name);
    let bones = 0, skinned = 0;
    g.scene.traverse(o => { if (o.isSkinnedMesh) skinned++; if (o.isBone) bones++; });
    console.log(`${f}\n   clips(${names.length}): ${names.slice(0,14).join(", ")}${names.length>14?" …":""}\n   bones ${bones} skinnedMeshes ${skinned}`);
  } catch (e) { console.log(`${f}  FAILED ${e.message}`); }
}
