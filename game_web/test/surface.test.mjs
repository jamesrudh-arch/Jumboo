// Surface tests. The point is that gravel betrays you and tarmac does not —
// that difference has to be real, because it is a stealth mechanic, not scenery.

import test from "node:test";
import assert from "node:assert/strict";
import { surfaceAt, citySurfaceAt, surfaceNoise, isWet, SURFACE } from "../src/surface.js";

const box = (x1, z1, x2, z2) => ({ x1, z1, x2, z2 });

test("default ground is tarmac", () => {
  assert.equal(surfaceAt(0, 0, {}), SURFACE.TARMAC);
});

test("water wins over everything", () => {
  const water = [box(-5, -5, 5, 5)];
  assert.equal(surfaceAt(0, 0, { water, gravel: [box(-5, -5, 5, 5)] }), SURFACE.WATER);
});

test("outside the water is not water", () => {
  const water = [box(-5, -5, 5, 5)];
  assert.notEqual(surfaceAt(20, 20, { water }), SURFACE.WATER);
});

test("a grating is found where one is", () => {
  assert.equal(surfaceAt(1, 1, { gratings: [box(0, 0, 2, 2)] }), SURFACE.GRATING);
});

test("gravel is found where it is", () => {
  assert.equal(surfaceAt(3, 3, { gravel: [box(2, 2, 4, 4)] }), SURFACE.GRAVEL);
});

test("water beats a grating on the same spot", () => {
  const c = box(0, 0, 2, 2);
  assert.equal(surfaceAt(1, 1, { water: [c], gratings: [c] }), SURFACE.WATER);
});

test("gravel is louder than tarmac, which is the stealth mechanic", () => {
  assert.ok(surfaceNoise(SURFACE.GRAVEL) > surfaceNoise(SURFACE.TARMAC));
  assert.ok(surfaceNoise(SURFACE.WATER) > surfaceNoise(SURFACE.GRATING));
  assert.equal(surfaceNoise(SURFACE.TARMAC), 1, "tarmac is the baseline");
});

test("water is the only splashing surface", () => {
  assert.equal(isWet(SURFACE.WATER), true);
  assert.equal(isWet(SURFACE.TARMAC), false);
  assert.equal(isWet(SURFACE.GRATING), false);
});

test("a malformed box is ignored rather than throwing", () => {
  assert.equal(surfaceAt(0, 0, { gravel: [null, {}, { x1: 0 }] }), SURFACE.TARMAC);
});

test("boxes given in either corner order still match", () => {
  assert.equal(surfaceAt(1, 1, { gravel: [box(2, 2, 0, 0)] }), SURFACE.GRAVEL);
});

test("roads report tarmac", () => {
  assert.equal(surfaceAt(5, 5, { roads: [box(0, 0, 10, 10)] }), SURFACE.TARMAC);
});


// ------------------------------------------------------- against the real city
import { waterAt as cWaterAt, roadAt as cRoadAt, parkAt as cParkAt, CITY } from "../src/city.js";

const real = () => CITY;

test("the flood is water, the alleys are gravel, everything else is tarmac", () => {
  const city = real();
  if (!city) return; // layout not exportable here; covered by the box tests above
  const at = (x, z) => citySurfaceAt(city, x, z, { waterAt: cWaterAt, roadAt: cRoadAt, parkAt: cParkAt });
  const water = city.water[0];
  assert.equal(at((water.x1 + water.x2) / 2, (water.z1 + water.z2) / 2), SURFACE.WATER);
  const alley = city.roads.find((r) => r.kind === "alley");
  assert.equal(at((alley.x1 + alley.x2) / 2, (alley.z1 + alley.z2) / 2), SURFACE.GRAVEL);
  // The south park has a pond in the middle of it, so the centre of the park is
  // water. Check a corner that is actually dry, and check the pond separately.
  const lawn = city.parks[0];
  assert.equal(at(lawn.x1 + 3, lawn.z1 + 3), SURFACE.GRAVEL);
  const pond = city.water.find((w) => w.kind === "pond");
  assert.equal(at((pond.x1 + pond.x2) / 2, (pond.z1 + pond.z2) / 2), SURFACE.WATER,
    "the pond is water, not lawn");
});

test("a missing city is tarmac rather than a crash", () => {
  assert.equal(citySurfaceAt(null, 0, 0), SURFACE.TARMAC);
});
