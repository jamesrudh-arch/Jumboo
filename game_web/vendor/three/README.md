# three.js r170 (vendored)

Unmodified copy of `three@0.170.0` from the npm registry, MIT licensed
(`LICENSE` alongside). Only these files are kept:

- `three.module.js` (the whole library, minified single module)
- `examples/jsm/loaders/GLTFLoader.js`
- `examples/jsm/utils/BufferGeometryUtils.js`
- `examples/jsm/environments/RoomEnvironment.js`

Vendored so the browser build, the tests and the offline diagnostic tools all
load the same renderer without a network fetch. To update: copy the same paths
from a new tarball, keep the licence, and re-run `npm test`.
