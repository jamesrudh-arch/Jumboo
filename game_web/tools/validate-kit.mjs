// Validate every vendored kit model against the glTF 2.0 spec. This is the
// "verify" half of audit-and-verify: if these pass, three's GLTFLoader in the
// browser will accept them, because both read the same spec.
import fs from "node:fs";
import path from "node:path";
import validator from "gltf-validator";

const DIR = "assets/kit/models";
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".gltf"));
let bad = 0, warn = 0, totalBytes = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  const data = new Uint8Array(fs.readFileSync(p));
  totalBytes += data.length;
  // Resolve the sibling .bin for the validator.
  const json = JSON.parse(Buffer.from(data).toString("utf8"));
  for (const b of json.buffers || []) {
    if (!b.uri || b.uri.startsWith("data:")) continue;
    const bin = fs.readFileSync(path.join(DIR, b.uri));
    b.uri = "data:application/octet-stream;base64," + bin.toString("base64");
  }
  const report = await validator.validateString(JSON.stringify(json), {
    maxIssues: 20,
    // The atlas is the only external resource; hand it over so the validator can
    // check that every UV lands inside the image it samples.
    externalResourceFunction: (uri) => {
      const file = path.join(DIR, path.basename(uri));
      if (fs.existsSync(file)) return Promise.resolve(new Uint8Array(fs.readFileSync(file)));
      const atlas = "assets/kit/textures/citybits_texture.png";
      return Promise.resolve(new Uint8Array(fs.readFileSync(atlas)));
    },
  });
  const e = report.issues.numErrors;
  const w = report.issues.numWarnings;
  const i = report.issues.numInfos;
  const key = report.info?.resourceDetails?.totalTriangleCount ?? "?";
  if (e) bad++;
  if (w) warn++;
  console.log(`${f.replace(".gltf", "").padEnd(28)} errors ${e}  warnings ${w}  infos ${i}  tris ${key}`);
}
console.log(`\n${files.length} models, ${bad} with errors, ${warn} with warnings, ${(totalBytes / 1024).toFixed(0)} KB of JSON`);
process.exit(bad ? 1 : 0);
