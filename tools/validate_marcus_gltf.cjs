// Run with NODE_PATH pointing to an installation of gltf-validator 2.0.0-dev.3.10.
// The output is format validation, not visual, animation or device testing.
const fs = require('fs');
const path = require('path');
const validator = require('gltf-validator');
const root = path.resolve(__dirname, '..');
(async () => {
  const report = {validator: 'gltf-validator 2.0.0-dev.3.10', scope: 'Validator only, not rendering, animation QA or device compatibility', files: {}};
  for (const name of ['marcus_approved_source.glb', 'marcus_normalized_test.glb']) {
    const bytes = fs.readFileSync(path.join(root, 'brand/characters/marcus', name));
    const result = await validator.validateBytes(new Uint8Array(bytes), {uri: name, maxIssues: 0});
    if (result.validatorVersion !== '2.0.0-dev.3.10') throw new Error(`Unexpected validator ${result.validatorVersion}`);
    const counts = {};
    for (const message of result.issues.messages) counts[message.code] = (counts[message.code] || 0) + 1;
    report.files[name] = {errors: result.issues.numErrors, warnings: result.issues.numWarnings, infos: result.issues.numInfos, hints: result.issues.numHints, issue_codes: counts};
  }
  fs.writeFileSync(path.join(root, 'docs/previews/character_research/marcus_gltf_validation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.files['marcus_normalized_test.glb'].errors) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
