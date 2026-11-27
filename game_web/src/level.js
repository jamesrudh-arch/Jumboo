// Level data for the vertical slice: "Last Call — the loading lane".
//
// The layout follows the approved working draft (M01, stages 2–3): Marcus
// leaves the shop front, crosses the street pressure of two local collectors,
// and reaches the loading lane where Sade gives a witness account. No new
// story facts are invented here; the environment, props and patrols are
// placeholder level design, not approved environment art.
//
// Everything is plain data so the level can be inspected by tests without a
// renderer. Units are metres; -Z is "deeper into the lane".

import { box } from "./collision.js";

export const LEVEL = {
  name: "Hearthline loading lane",
  bounds: { x1: -40, x2: 40, z1: -60, z2: 20 },
  spawn: { x: 0.0, z: 4.6, yaw: Math.PI },
  player: { radius: 0.32, height: 1.8, crouchHeight: 1.15, eye: 1.62, crouchEye: 1.05 },
  // Ground speeds. The approved clips are authored at these nominal stride
  // speeds, and anim.js time-scales them by (actual / nominal) so the feet do
  // not slide. Measured from marcus_normalized_test.glb: walk 0.935 m per 1.0 s
  // cycle, run 1.083 m per 0.625 s cycle.
  walkSpeed: 1.35,
  runSpeed: 3.4,
  crouchSpeed: 0.7,
  clip: { walk: 0.935, run: 1.733 },
  stepUp: 0.42,
  checkpoints: [
    { id: "start", x: 0.0, z: 4.6, label: "Shop front" },
    { id: "mid", x: -0.4, z: -13.0, label: "Street" },
    { id: "lane", x: 0.4, z: -24.0, label: "Lane mouth" },
  ],
  goal: { x: 0.0, z: -41.5, radius: 2.2, label: "Loading lane" },
  witness: { x: 5.0, z: -28.3, radius: 2.2, label: "Sade" },
  patrols: [
    {
      id: "collector-a",
      label: "Collector",
      points: [
        { x: -4.6, z: -8.0 },
        { x: 4.6, z: -8.2 },
        { x: 4.8, z: -13.2 },
        { x: -4.9, z: -18.8 },
      ],
      speed: 1.05,
      pauseAt: 1.1,
      hearing: 7.5,
      sight: 12.5,
      fov: 1.15,
    },
    {
      id: "collector-b",
      label: "Collector",
      points: [
        { x: 3.9, z: -20.6 },
        { x: -3.6, z: -21.0 },
        { x: -3.2, z: -27.6 },
        { x: 3.6, z: -27.2 },
      ],
      speed: 0.95,
      pauseAt: 1.6,
      hearing: 7.0,
      sight: 11.5,
      fov: 1.2,
    },
    {
      id: "collector-c",
      label: "Collector",
      points: [
        { x: -1.8, z: -33.5 },
        { x: 2.4, z: -35.6 },
        { x: 1.0, z: -43.0 },
        { x: -2.6, z: -42.0 },
      ],
      speed: 1.0,
      pauseAt: 1.4,
      hearing: 7.0,
      sight: 12.0,
      fov: 1.15,
    },
  ],
  lights: [
    // Warm sodium practicals down the lane.
    { x: -5.4, y: 4.2, z: 1.5, color: 0xe0b77e, intensity: 26, distance: 17 },
    { x: 5.2, y: 4.0, z: -12.0, color: 0xe0b77e, intensity: 30, distance: 19 },
    { x: -5.0, y: 4.1, z: -27.5, color: 0xffcf9a, intensity: 24, distance: 16 },
    { x: 4.8, y: 4.6, z: -39.0, color: 0xe0b77e, intensity: 34, distance: 20 },
    // Cold market spill from the far end.
    { x: 0.0, y: 3.0, z: -47.0, color: 0x8ebab6, intensity: 40, distance: 26 },
    // Shop glow behind the player.
    { x: -6.0, y: 2.4, z: 5.2, color: 0xffd7a3, intensity: 18, distance: 13 },
  ],
};

/**
 * Build the static collision set and the render spec for the level.
 * Returns { boxes, platforms, props, decals }.
 *
 * `boxes` are solid: they block walking, bullets of sight and detection.
 * `platforms` are walkable tops that also appear in `boxes` as solids.
 */
export function buildLevel() {
  const boxes = [];
  const platforms = [];
  const props = [];
  const decals = [];

  const solid = (x1, z1, x2, z2, y0, y1, tag) => {
    const b = box(x1, z1, x2, z2, y0, y1, tag);
    boxes.push(b);
    return b;
  };

  // ---------------------------------------------------------------- ground
  // The lane itself: a long strip of wet asphalt, with a slightly raised
  // walkway along the left shopfronts.
  props.push({ kind: "ground", x: 0, z: -20, w: 26, d: 66, mat: "asphalt" });
  props.push({ kind: "ground", x: -8.6, z: -18, w: 3.4, d: 60, mat: "concrete", y: 0.12 });
  solid(-10.3, -48, -6.9, 12, -0.4, 0.12, "floor");

  // Lane mouth narrows after z = -18: kerbs act as soft walls but stay low.
  solid(-27, -9.2, -7.0, -8.4, 0, 0.22, "kerb");
  solid(7.0, -9.2, 27, -8.4, 0, 0.22, "kerb");

  // -------------------------------------------------------- left shopfronts
  // Facade line at x = -7 with three recessed shop windows and awnings.
  solid(-13.4, -52, -7.0, 12, 0, 14, "wall");
  props.push({ kind: "facade", x: -7.02, z: -4, w: 0.14, d: 60, h: 14, mat: "brick" });
  for (const z of [3.4, -6.5, -16.5]) {
    props.push({ kind: "window", x: -6.9, z, w: 0.08, d: 3.2, h: 2.0, mat: "glassWarm", y: 1.15 });
    props.push({ kind: "awning", x: -6.1, z, w: 1.9, d: 3.8, h: 0.14, mat: "canvas", y: 2.75 });
    props.push({ kind: "sign", x: -6.85, z, w: 0.06, d: 2.4, h: 0.62, mat: "signPlate", y: 3.15 });
  }
  // Shop door with warm interior light behind the spawn point.
  props.push({ kind: "doorway", x: -6.9, z: 5.0, w: 0.1, d: 1.7, h: 2.5, mat: "glassWarm", y: 0 });
  // Upper-storey windows, unlit, for depth above the street.
  for (const z of [1.0, -4.0, -11.0, -19.0, -27.0]) {
    props.push({ kind: "window", x: -6.88, z, w: 0.06, d: 1.5, h: 1.3, mat: "glassDark", y: 5.2 });
    props.push({ kind: "window", x: -6.88, z, w: 0.06, d: 1.5, h: 1.3, mat: "glassDark", y: 8.0 });
  }
  // Fire escape silhouette: readable vertical detail, no collision.
  props.push({ kind: "fireEscape", x: -6.2, z: -16.5 });

  // ------------------------------------------------------- right-hand wall
  // Solid industrial wall with a recessed loading bay from z = -34 to -45.
  solid(7.0, -52, 13.4, -45.0, 0, 13, "wall");
  solid(7.0, -34.0, 13.4, 12, 0, 13, "wall");
  solid(12.6, -45.0, 13.4, -34.0, 0, 13, "backWall");
  props.push({ kind: "facade", x: 7.02, z: -16, w: 0.14, d: 56, h: 13, mat: "concrete" });
  props.push({ kind: "facade", x: 12.55, z: -39.5, w: 0.14, d: 11, h: 13, mat: "concrete" });
  // Roller shutters along the wall.
  for (const z of [-2.0, -20.0, -31.0]) {
    props.push({ kind: "shutter", x: 6.94, z, w: 0.1, d: 3.4, h: 3.2, mat: "shutter" });
  }
  // The loading bay: tall open shutter, pallets and a dock lip.
  props.push({ kind: "shutter", x: 12.5, z: -39.5, w: 0.1, d: 6.4, h: 4.4, mat: "dock", y: 0.0 });
  props.push({ kind: "bayLip", x: 11.6, z: -39.5, w: 1.8, d: 8.0, h: 1.05, mat: "concrete" });
  solid(10.7, -43.5, 12.55, -35.5, 0, 1.05, "platform");
  platforms.push(box(10.7, -43.5, 12.55, -35.5, 0, 1.05, "platform"));
  props.push({ kind: "pipe", x: 6.86, y: 6.4, z: -22.0 });
  props.push({ kind: "pipe", x: -6.86, y: 5.6, z: -35.0 });

  // ------------------------------------------------------------- far end
  // Market gate: the lane opens onto the market, but the slice ends here.
  solid(-7.2, -52.0, 13.4, -47.6, 0, 13, "wall");
  props.push({ kind: "marketGlow", x: 2.0, z: -47.4, w: 12.0, h: 4.6 });

  // ------------------------------------------------------------- cover
  // Placed to create a readable stealth rhythm: bench-height cover, a parked
  // van, stacked crates, and a dumpster that hides the crouch line.
  const crates = (x, z, n, seed, yaw) => {
    let y = 0;
    for (let i = 0; i < n; i++) {
      const s = 0.92 + ((seed * (i + 3)) % 7) * 0.035;
      props.push({ kind: "crate", x, z, s, y, yaw: yaw + (i === 0 ? 0 : (seed + i) % 5 * 0.09) });
      y += s;
    }
    solid(x - 0.52, z - 0.52, x + 0.52, z + 0.52, 0, y, "cover");
    if (n > 1) platforms.push(box(x - 0.52, z - 0.52, x + 0.52, z + 0.52, 0, y - 0.0, "platform"));
    return y;
  };

  crates(-5.0, -2.6, 2, 3, 0.12);
  crates(-5.4, -21.4, 3, 5, -0.06);
  crates(5.6, -24.2, 2, 2, 0.2);
  crates(-4.6, -29.0, 1, 4, 0.5);
  crates(2.6, -37.8, 2, 6, 0.33);
  crates(9.4, -37.4, 2, 7, 0.1);

  // Dumpsters: chest-high, block sight when crouched behind.
  for (const d of [
    { x: 4.9, z: -5.6, yaw: 0.04 },
    { x: -4.6, z: -17.0, yaw: -0.03 },
    { x: 4.4, z: -30.8, yaw: 0.02 },
  ]) {
    props.push({ kind: "dumpster", x: d.x, z: d.z, yaw: d.yaw });
    solid(d.x - 1.05, d.z - 0.62, d.x + 1.05, d.z + 0.62, 0, 1.28, "cover");
  }

  // A parked delivery van: full body cover in the middle of the street.
  props.push({ kind: "van", x: -3.3, z: -12.9, yaw: 0.02 });
  solid(-5.15, -15.1, -1.45, -10.7, 0, 2.3, "cover");

  // Low pallets and barrels: partial cover, break the sight-line at eye height.
  props.push({ kind: "palletStack", x: 1.2, z: -6.9, yaw: 0.14 });
  solid(0.0, -7.9, 2.4, -5.9, 0, 0.55, "cover");
  props.push({ kind: "barrel", x: -2.0, z: -25.2 });
  solid(-2.5, -25.7, -1.5, -24.7, 0, 0.95, "cover");
  props.push({ kind: "barrel", x: -1.3, z: -25.6 });
  solid(-1.8, -26.1, -0.8, -25.1, 0, 0.95, "cover");
  props.push({ kind: "generator", x: -5.9, z: -34.6, yaw: -0.35 });
  solid(-6.6, -35.3, -5.2, -33.9, 0, 0.75, "cover");

  // Sade's stall: crates under the shutter where she was working.
  props.push({ kind: "stall", x: 5.2, z: -30.4, yaw: -0.06 });
  solid(4.1, -31.4, 6.3, -29.4, 0, 1.0, "cover");

  // Lamp posts, bollards and street furniture (thin, no collision).
  for (const l of [
    { x: -5.4, z: 1.5 },
    { x: 5.2, z: -12.0 },
    { x: -5.0, z: -27.5 },
    { x: 4.8, z: -39.0 },
  ]) props.push({ kind: "lampPost", x: l.x, z: l.z, h: 4.4 });
  for (const b of [
    { x: -6.4, z: -8.0 },
    { x: 6.4, z: -18.5 },
    { x: -6.3, z: -23.0 },
  ]) props.push({ kind: "bollard", x: b.x, z: b.z });

  // Puddles and paint: decals that make the asphalt read as wet.
  for (const d of [
    { x: -1.4, z: -8.2, r: 1.9 },
    { x: 3.2, z: -16.4, r: 2.4 },
    { x: -3.0, z: -22.0, r: 1.6 },
    { x: 1.1, z: -33.0, r: 2.8 },
    { x: 7.9, z: -40.0, r: 2.2 },
    { x: -4.8, z: -44.0, r: 1.7 },
  ]) decals.push({ kind: "puddle", ...d, seed: Math.round(d.x * 13 + d.z * 7) });
  decals.push({ kind: "laneMark", x: 0.0, z: -41.5, r: 2.2 });
  decals.push({ kind: "laneMark", x: 5.0, z: -28.3, r: 1.6, tint: "tidal" });

  return { boxes, platforms, props, decals };
}
