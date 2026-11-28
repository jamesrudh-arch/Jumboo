// Rendering for the district.
//
// Everything here is built for phones first: repeated geometry (windows, trees,
// railings, kerbs, containers) goes into InstancedMesh, static detail is merged
// per material, and only a handful of objects cast shadows. Draw calls are
// reported by `stats()` so the cost is measurable, not guessed.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./city.js";

const SHARED = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 9),
};

const C = {
  ink: 0x10171d,
  paper: 0xf0ede5,
  steel: 0x8b9b9b,
  tidal: 0x8ebab6,
  amber: 0xe0b77e,
  signal: 0xe88771,
  asphalt: 0x1c2429,
  concrete: 0x565f63,
  kerb: 0x6c757a,
  brick: 0x4a3a34,
  plaster: 0x8d8a7e,
  timber: 0x5a4634,
  corrugated: 0x4d5a60,
  glassWarm: 0xe0b77e,
  glassCold: 0x6f93a3,
  rust: 0x7a4a34,
  leafDark: 0x2c4030,
  leafLight: 0x44603c,
  trunk: 0x453529,
};

function srgb(hex) {
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
}

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: srgb(hex),
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive !== undefined ? srgb(opts.emissive) : undefined,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
  });
}

/** Collects static geometry per material and merges it into one mesh each. */
class MergeBin {
  constructor() {
    this.bins = new Map();
  }

  add(material, geometry, matrix) {
    const key = material.uuid;
    if (!this.bins.has(key)) this.bins.set(key, { material, geos: [] });
    const g = geometry.clone();
    g.applyMatrix4(matrix);
    // Merging requires identical attribute sets.
    if (!g.attributes.uv) {
      const count = g.attributes.position.count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.deleteAttribute("tangent");
    this.bins.get(key).geos.push(g);
  }

  box(material, x, y, z, w, h, d, rotY = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
      new THREE.Vector3(w, h, d),
    );
    this.add(material, SHARED.box, m);
  }

  flush(parent, namePrefix = "merged") {
    let i = 0;
    let tris = 0;
    for (const { material, geos } of this.bins.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${namePrefix}-${i++}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false; // static detail never casts; too costly on phones
      parent.add(mesh);
      tris += merged.attributes.position.count / 3;
    }
    this.bins.clear();
    return { meshes: i, triangles: Math.round(tris) };
  }
}

/** Flat ribbon geometry for a road surface with painted markings. */
function roadGeometry(rect, kind) {
  const w = rect.x2 - rect.x1;
  const d = rect.z2 - rect.z1;
  const g = new THREE.PlaneGeometry(w, d, 1, Math.max(1, Math.round(d / 12)));
  g.rotateX(-Math.PI / 2);
  g.translate((rect.x1 + rect.x2) / 2, kind === "alley" ? 0.012 : 0.02, (rect.z1 + rect.z2) / 2);
  return g;
}

export class CityView {
  constructor(scene, city, built, tier) {
    this.scene = scene;
    this.city = city;
    this.built = built;
    this.tier = tier;
    this.root = new THREE.Group();
    this.root.name = "city";
    scene.add(this.root);
    this.stats = { meshes: 0, instances: 0, triangles: 0 };
    this.time = 0;
    this.waterMeshes = [];
    this.lampLights = [];
    this.rand = mulberry32(0xc17a1);
  }

  build() {
    this.materials = {
      asphalt: mat(C.asphalt, { roughness: 0.62, metalness: 0.12 }),
      sidewalk: mat(0x6a7176, { roughness: 0.95 }),
      kerb: mat(C.kerb, { roughness: 0.9 }),
      brick: mat(C.brick, { roughness: 0.95 }),
      plaster: mat(C.plaster, { roughness: 0.92 }),
      timber: mat(C.timber, { roughness: 0.9 }),
      concrete: mat(C.concrete, { roughness: 0.9 }),
      baseStone: mat(0x343a3f, { roughness: 0.95 }),
      corrugated: mat(C.corrugated, { roughness: 0.75, metalness: 0.25 }),
      glass: mat(C.glassCold, { roughness: 0.25, metalness: 0.35 }),
      glassLitCool: mat(0x232730, {
        roughness: 0.4,
        emissive: 0xbfd0dd,
        emissiveIntensity: 1.05,
      }),
      glassLit: mat(0x2a2620, {
        roughness: 0.4,
        emissive: C.glassWarm,
        emissiveIntensity: 1.35,
      }),
      rust: mat(C.rust, { roughness: 0.95 }),
      leafDark: mat(C.leafDark, { roughness: 0.95 }),
      leafLight: mat(C.leafLight, { roughness: 0.95 }),
      trunk: mat(C.trunk, { roughness: 0.95 }),
      metal: mat(0x5c666b, { roughness: 0.45, metalness: 0.7 }),
      white: mat(0xd8d5cc, { roughness: 0.6, emissive: 0x9aa4a8, emissiveIntensity: 0.25 }),
      amber: mat(C.amber, { roughness: 0.6, emissive: C.amber, emissiveIntensity: 0.8 }),
      mark: mat(0xd9d4c2, { roughness: 0.7 }),
      markAmber: mat(C.amber, { roughness: 0.7, emissive: C.amber, emissiveIntensity: 0.35 }),
      park: mat(0x39492f, { roughness: 0.98 }),
      sand: mat(0x6d6552, { roughness: 0.98 }),
      container: [mat(0x4a5a63, { roughness: 0.8, metalness: 0.3 }), mat(0x6b4a3a, { roughness: 0.8, metalness: 0.3 }), mat(0x38564a, { roughness: 0.8, metalness: 0.3 })],
      water: null,
    };

    this.buildGround();
    this.buildRoads();
    this.buildWater();
    this.buildBuildings();
    this.buildTrees();
    this.buildLamps();
    this.buildProps();
    this.buildParkedVehicles();
    this.buildRain();

    this.stats.meshes = this.countMeshes();
    return this;
  }

  countMeshes() {
    let n = 0;
    this.root.traverse((o) => {
      if (o.isMesh) n++;
    });
    return n;
  }

  // ------------------------------------------------------------- ground
  buildGround() {
    const b = this.city.bounds;
    const bin = new MergeBin();
    const sidewalkMat = this.materials.sidewalk;
    const kerbMat = this.materials.kerb;

    // Base slab, split into tiles so a single huge plane never covers the whole
    // water hole at once (the rasteriser samples per triangle).
    const tile = 10;
    for (let x = b.x1; x < b.x2; x += tile) {
      for (let z = b.z1; z < b.z2; z += tile) {
        const cx = x + tile / 2;
        const cz = z + tile / 2;
        // Leave the water areas empty so the canal and harbour read as holes.
        // The tile is small enough that the hole's edge is the water edge, not
        // a 40 m chunk of missing street.
        if (this.inWater(cx, cz)) continue;
        bin.box(this.materials.asphalt, cx, -0.32, cz, tile, 0.6, tile);
      }
    }

    // Sidewalks hug every road except alleys.
    for (const r of this.city.roads) {
      if (r.kind === "alley") continue;
      const pad = 2.2;
      const along = r.x2 - r.x1 > r.z2 - r.z1;
      if (along) {
        bin.box(sidewalkMat, (r.x1 + r.x2) / 2, 0.06, r.z1 - pad / 2, r.x2 - r.x1, 0.12, pad);
        bin.box(sidewalkMat, (r.x1 + r.x2) / 2, 0.06, r.z2 + pad / 2, r.x2 - r.x1, 0.12, pad);
        bin.box(kerbMat, (r.x1 + r.x2) / 2, 0.1, r.z1 - 0.1, r.x2 - r.x1, 0.2, 0.2);
        bin.box(kerbMat, (r.x1 + r.x2) / 2, 0.1, r.z2 + 0.1, r.x2 - r.x1, 0.2, 0.2);
      } else {
        bin.box(sidewalkMat, r.x1 - pad / 2, 0.06, (r.z1 + r.z2) / 2, pad, 0.12, r.z2 - r.z1);
        bin.box(sidewalkMat, r.x2 + pad / 2, 0.06, (r.z1 + r.z2) / 2, pad, 0.12, r.z2 - r.z1);
        bin.box(kerbMat, r.x1 - 0.1, 0.1, (r.z1 + r.z2) / 2, 0.2, 0.2, r.z2 - r.z1);
        bin.box(kerbMat, r.x2 + 0.1, 0.1, (r.z1 + r.z2) / 2, 0.2, 0.2, r.z2 - r.z1);
      }
    }

    // Parks: a raised lawn pad with a path band.
    for (const park of this.city.parks) {
      bin.box(this.materials.park, (park.x1 + park.x2) / 2, 0.04, (park.z1 + park.z2) / 2, park.x2 - park.x1, 0.1, park.z2 - park.z1);
      bin.box(this.materials.sand, (park.x1 + park.x2) / 2, 0.09, (park.z1 + park.z2) / 2, park.x2 - park.x1, 0.06, 3.2);
    }

    // Quay apron and canal banks.
    bin.box(this.materials.concrete, 0, 0.05, -127, 300, 0.4, 6);
    // Canal coping: a 2 m ledge on each bank, at kerb height, so the water is
    // visible from the street and the drop into it is obvious.
    bin.box(this.materials.concrete, 0, 0.06, -83.1, 280, 0.24, 2.2);
    bin.box(this.materials.concrete, 0, 0.06, -76.9, 280, 0.24, 2.2);

    const merged = bin.flush(this.root, "ground");
    this.stats.triangles += merged.triangles;
  }

  inWater(x, z) {
    for (const w of this.city.water) {
      if (x > w.x1 && x < w.x2 && z > w.z1 && z < w.z2) return true;
    }
    return false;
  }

  // -------------------------------------------------------------- roads
  buildRoads() {
    const bin = new MergeBin();
    for (const r of this.city.roads) {
      const geo = roadGeometry(r, r.kind);
      const m = new THREE.Matrix4();
      bin.add(this.materials.asphalt, geo, m);

      // Painted markings. Dashed centre line, plus lane edges on the avenue.
      const along = r.x2 - r.x1 > r.z2 - r.z1;
      const length = along ? r.x2 - r.x1 : r.z2 - r.z1;
      const dash = 3;
      const gap = 5;
      const centres = r.kind === "avenue" ? [-4.5, 0, 4.5] : [0];
      for (const off of centres) {
        if (r.kind === "avenue" && off === 0) continue; // double line handled below
        for (let t = 0; t < length; t += dash + gap) {
          const mid = t + dash / 2;
          if (along) bin.box(this.materials.mark, r.x1 + mid, 0.035, (r.z1 + r.z2) / 2 + off, dash, 0.02, 0.16);
          else bin.box(this.materials.mark, (r.x1 + r.x2) / 2 + off, 0.035, r.z1 + mid, 0.16, 0.02, dash);
        }
      }
      if (r.kind === "avenue") {
        for (let t = 0; t < length; t += 0.9) {
          if (along) {
            bin.box(this.materials.markAmber, r.x1 + t, 0.035, (r.z1 + r.z2) / 2 - 0.18, 1.4, 0.02, 0.13);
            bin.box(this.materials.markAmber, r.x1 + t, 0.035, (r.z1 + r.z2) / 2 + 0.18, 1.4, 0.02, 0.13);
          }
        }
      }
    }
    // Zebra crossings at the two main intersections.
    for (const z of [-60, 48]) {
      for (let x = -8; x <= 8; x += 1.5) {
        bin.box(this.materials.mark, x, 0.04, z, 0.7, 0.02, 3.4);
      }
    }
    const merged = bin.flush(this.root, "roads");
    this.stats.triangles += merged.triangles;
  }

  // -------------------------------------------------------------- water
  buildWater() {
    const detail = this.tier.waterDetail ?? 1;
    for (const w of this.city.water) {
      const width = w.x2 - w.x1;
      const depth = w.z2 - w.z1;
      // Enough segments for visible waves, but nothing silly on phones.
      const segX = Math.max(2, Math.min(64, Math.round(width / (detail === 0 ? 26 : detail === 1 ? 15 : 9))));
      const segZ = Math.max(2, Math.min(40, Math.round(depth / (detail === 0 ? 26 : detail === 1 ? 15 : 9))));
      const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
      geo.rotateX(-Math.PI / 2);

      const material = new THREE.MeshStandardMaterial({
        color: srgb(w.kind === "harbour" ? 0x24404e : w.kind === "pond" ? 0x25423a : 0x234252),
        roughness: 0.1,
        metalness: 0.62,
        // A touch of self-lit body keeps the water separate from asphalt in a
        // dark frame without pretending it is glowing.
        emissive: srgb(w.kind === "harbour" ? 0x0d1a22 : 0x0c1b16),
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.94,
        envMapIntensity: 1.1,
      });
      // Drive the waves on the CPU: a vertex shader would be free, but the
      // offline rasteriser and the smoke test both need real geometry.
      material.userData.water = {
        base: geo.attributes.position.array.slice(),
        kind: w.kind,
        phase: this.rand() * 10,
        amp: w.kind === "harbour" ? 0.34 : w.kind === "pond" ? 0.05 : 0.16,
      };
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = `water-${w.id}`;
      mesh.position.set((w.x1 + w.x2) / 2, w.surfaceY, (w.z1 + w.z2) / 2);
      mesh.receiveShadow = !!this.tier.shadows;
      this.root.add(mesh);
      this.waterMeshes.push({ mesh, spec: w, material });

      // Foam: a narrow pale strip on each bank makes the shoreline legible at
      // night, when the water and the asphalt are otherwise the same value.
      const foam = new MergeBin();
      const foamMat = mat(0x9fb4b8, { roughness: 0.8, emissive: 0x2a3a3e, emissiveIntensity: 0.6 });
      const fy = w.surfaceY + 0.04;
      foam.box(foamMat, (w.x1 + w.x2) / 2, fy, w.z1 + 0.5, width, 0.03, 1.0);
      foam.box(foamMat, (w.x1 + w.x2) / 2, fy, w.z2 - 0.5, width, 0.03, 1.0);
      foam.box(foamMat, w.x1 + 0.5, fy, (w.z1 + w.z2) / 2, 1.0, 0.03, depth);
      foam.box(foamMat, w.x2 - 0.5, fy, (w.z1 + w.z2) / 2, 1.0, 0.03, depth);
      foam.flush(this.root, `foam-${w.id}`);

      // The bed under the water, so looking down shows depth, not sky.
      const bed = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        mat(w.kind === "harbour" ? 0x0b1418 : 0x101a16, { roughness: 1 }),
      );
      bed.rotateX(-Math.PI / 2);
      bed.position.set((w.x1 + w.x2) / 2, w.bedY, (w.z1 + w.z2) / 2);
      bed.name = `bed-${w.id}`;
      this.root.add(bed);

      // Vertical walls so the water edge is a solid lip, not a floating plane.
      const wallMat = mat(0x3b4349, { roughness: 0.95 });
      const wallH = w.surfaceY - w.bedY + 1;
      const walls = new MergeBin();
      walls.box(wallMat, (w.x1 + w.x2) / 2, w.bedY + wallH / 2, w.z1, width, wallH, 0.6);
      walls.box(wallMat, (w.x1 + w.x2) / 2, w.bedY + wallH / 2, w.z2, width, wallH, 0.6);
      walls.box(wallMat, w.x1, w.bedY + wallH / 2, (w.z1 + w.z2) / 2, 0.6, wallH, depth);
      walls.box(wallMat, w.x2, w.bedY + wallH / 2, (w.z1 + w.z2) / 2, 0.6, wallH, depth);
      walls.flush(this.root, `waterwall-${w.id}`);
    }
  }

  // ---------------------------------------------------------- buildings
  buildBuildings() {
    const bin = new MergeBin();
    // Lit windows come in two tones. One emissive colour across the whole city
    // makes every tower glow the same; warm and cool batches cost one extra
    // draw call and break the grid up at night.
    const windowWarm = [];
    const windowCool = [];
    const windowDark = [];
    const M = this.materials;

    for (const b of this.built.buildings) {
      const w = b.x2 - b.x1;
      const d = b.z2 - b.z1;
      const cx = (b.x1 + b.x2) / 2;
      const cz = (b.z1 + b.z2) / 2;
      const body = M[b.mat] || M.concrete;
      bin.box(body, cx, b.h / 2, cz, w, b.h, d);

      // Roof: a parapet lip plus a rooftop kit. Roofs are what the player
      // actually sees from the street and from the bridge cameras, so they get
      // the same treatment as the facades rather than being flat lids.
      bin.box(M.concrete, cx, b.h + 0.25, cz, w + 0.2, 0.5, d + 0.2);
      if (b.roof === "tank") {
        // A water tank on legs: the silhouette that says "city" from a distance.
        const tx = cx + w * 0.16;
        const tz = cz - d * 0.1;
        for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
          bin.box(M.metal, tx + ox, b.h + 0.9, tz + oz, 0.14, 1.8, 0.14);
        }
        const tank = new THREE.Matrix4().compose(
          new THREE.Vector3(tx, b.h + 2.9, tz),
          new THREE.Quaternion(),
          new THREE.Vector3(1.7, 2.4, 1.7),
        );
        bin.add(M.metal, SHARED.cylinder, tank);
        bin.box(M.rust, tx, b.h + 4.15, tz, 1.8, 0.12, 1.8);
      } else if (b.roof === "ac") {
        for (let i = 0; i < 3; i++) {
          bin.box(M.metal, cx - w * 0.24 + i * (w * 0.22), b.h + 0.75, cz + d * 0.18, 1.3, 0.8, 1.1);
        }
      } else if (b.roof === "antenna" || b.h > 40) {
        // Landmarks get a mast with a red aircraft light on top.
        bin.box(M.metal, cx, b.h + 4, cz, 0.22, 8, 0.22);
        bin.box(M.metal, cx - 1.4, b.h + 6.4, cz, 2.8, 0.12, 0.12);
        bin.box(M.markAmber, cx, b.h + 8.1, cz, 0.42, 0.42, 0.42);
      }
      // Rooftop clutter on every building: vents, boxes, a parapet door.
      if (w > 6 && d > 6) {
        const vents = 1 + (b.seed % 3);
        for (let i = 0; i < vents; i++) {
          const vx = b.x1 + 1.6 + ((b.seed * (i + 3)) % 7) * (w - 3.2) / 7;
          const vz = b.z1 + 1.6 + ((b.seed * (i + 5)) % 5) * (d - 3.2) / 5;
          bin.box(M.metal, vx, b.h + 0.9, vz, 0.7, 0.8, 0.7);
        }
        bin.box(M.timber, cx - w * 0.3, b.h + 1.2, cz + d * 0.3, 0.9, 1.6, 0.9);
      }
      // A lit rooftop sign on some corner lots: the amber that gives the
      // Hearthline its colour at night.
      if (b.seed % 4 === 0 && b.h > 12) {
        bin.box(M.amber, cx, b.h + 1.8, b.z1 + 0.4, Math.min(w * 0.6, 4.2), 1.1, 0.18);
      }

      // Facade relief. A single extruded box reads as a slab from the street;
      // a plinth, string courses every few floors and corner pilasters give the
      // wall something for the moonlight to catch.
      bin.box(M.baseStone, cx, 0.55, cz, w + 0.12, 1.1, d + 0.12);
      if (b.h > 14) {
        const courses = Math.min(5, Math.floor(b.h / 16));
        for (let i = 1; i <= courses; i++) {
          const y = i * (b.h / (courses + 1));
          bin.box(M.concrete, cx, y, cz, w + 0.34, 0.22, d + 0.34);
        }
        const px = w / 2 - 0.18;
        const pz = d / 2 - 0.18;
        for (const [ox, oz] of [[-px, -pz], [px, -pz], [-px, pz], [px, pz]]) {
          bin.box(M.concrete, cx + ox, b.h / 2, cz + oz, 0.5, b.h, 0.5);
        }
      }
      // Ground floor: a darker recessed shopfront band with a lit sill.
      bin.box(M.baseStone, cx, 2.1, cz, w + 0.06, 3.0, d + 0.06);

      // Windows on the two street-facing sides (cheapest big win for detail).
      const instanced = this.tier.name === "phone" ? 0 : 1;
      if (instanced) {
        const step = b.colStep;
        const rows = Math.max(1, Math.floor((b.h - b.floorH * 0.8) / b.floorH));
        const colsX = Math.max(1, Math.floor(w / step));
        const colsZ = Math.max(1, Math.floor(d / step));
        for (let r = 0; r < rows; r++) {
          const y = b.floorH * 1.15 + r * b.floorH;
          if (y + 0.6 > b.h) break;
          for (let c = 0; c < colsX; c++) {
            const x = b.x1 + step * (c + 0.5);
            const warm = (b.seed * 3 + r * 17 + c * 29) % 100 < 62;
            const litPick = (b.seed + r * 7 + c * 13) % 100 < (b.lit ? 58 : 26);
            const bucketX = litPick ? (warm ? windowWarm : windowCool) : windowDark;
            bucketX.push({ x, y, z: b.z1 - 0.02, rotY: 0, sx: 1.05, sy: 1.5 });
            bucketX.push({ x, y, z: b.z2 + 0.02, rotY: Math.PI, sx: 1.05, sy: 1.5 });
          }
          for (let c = 0; c < colsZ; c++) {
            const z = b.z1 + step * (c + 0.5);
            const warm = (b.seed * 5 + r * 19 + c * 31) % 100 < 55;
            const litPick = (b.seed + r * 11 + c * 5) % 100 < (b.lit ? 52 : 22);
            const bucketZ = litPick ? (warm ? windowWarm : windowCool) : windowDark;
            bucketZ.push({ x: b.x1 - 0.02, y, z, rotY: -Math.PI / 2, sx: 1.05, sy: 1.5 });
            bucketZ.push({ x: b.x2 + 0.02, y, z, rotY: Math.PI / 2, sx: 1.05, sy: 1.5 });
          }
        }
      }

      // Ground-floor shopfront: a bright band with a canopy.
      if (b.shopfront) {
        bin.box(M.glassLit, cx, 1.5, Math.min(b.z1, b.z2) - 0.06, Math.min(w - 1.2, 6), 1.9, 0.1);
        bin.box(M.timber, cx, 2.7, Math.min(b.z1, b.z2) - 0.5, Math.min(w - 0.6, 6.6), 0.16, 0.9);
      }

      // A lit sign block above the shopfront on some lots.
      if (b.seed % 3 === 0) {
        bin.box(M.amber, b.x1 + w * 0.5, 3.4, b.z1 - 0.1, Math.min(3.2, w * 0.5), 0.5, 0.12);
      }
    }

    const merged = bin.flush(this.root, "buildings");
    this.stats.triangles += merged.triangles;

    // Instanced windows: two draw calls for the whole city.
    this.windowMeshes = [];
    for (const [list, material, name] of [
      [windowWarm, M.glassLit, "windows-lit-warm"],
      [windowCool, M.glassLitCool, "windows-lit-cool"],
      [windowDark, M.glass, "windows-dark"],
    ]) {
      if (!list.length) continue;
      const geo = new THREE.PlaneGeometry(1, 1);
      const inst = new THREE.InstancedMesh(geo, material, list.length);
      inst.name = name;
      inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      list.forEach((it, i) => {
        pos.set(it.x, it.y, it.z);
        q.setFromEuler(new THREE.Euler(0, it.rotY, 0));
        scl.set(it.sx, it.sy, 1);
        m.compose(pos, q, scl);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      this.root.add(inst);
      this.stats.instances += list.length;
      this.windowMeshes.push(inst);
    }
  }

  // -------------------------------------------------------------- trees
  buildTrees() {
    const M = this.materials;
    const trunks = [];
    const canopies = [];
    const narrow = [];
    for (const t of this.built.trees) {
      trunks.push(t);
      (t.kind === "cypress" ? narrow : canopies).push(t);
    }

    const make = (list, material, geoFn, name) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(geoFn(), material, list.length);
      inst.name = name;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      list.forEach((t, i) => {
        pos.set(t.x, 0, t.z);
        q.setFromEuler(new THREE.Euler(0, t.yaw, 0));
        scl.set(1, 1, 1);
        m.compose(pos, q, scl);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = !!this.tier.propShadowCasters;
      this.root.add(inst);
      this.stats.instances += list.length;
    };

    // Trunks: one instanced cylinder scaled per tree.
    if (trunks.length) {
      const geo = new THREE.CylinderGeometry(0.16, 0.24, 1, 6);
      geo.translate(0, 0.5, 0);
      const inst = new THREE.InstancedMesh(geo, M.trunk, trunks.length);
      inst.name = "tree-trunks";
      const m = new THREE.Matrix4();
      trunks.forEach((t, i) => {
        m.compose(
          new THREE.Vector3(t.x, 0, t.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.yaw, 0)),
          new THREE.Vector3(t.scale, t.trunkH, t.scale),
        );
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = !!this.tier.propShadowCasters;
      this.root.add(inst);
      this.stats.instances += trunks.length;
    }

    const canopyGeo = () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(1.7, 1.35, 1.7);
      return g;
    };
    const cypressGeo = () => {
      const g = new THREE.ConeGeometry(1, 3.4, 7);
      g.translate(0, 1.7, 0);
      return g;
    };

    const build = (list, geoFn, material, name, scaleY) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(geoFn(), material, list.length);
      inst.name = name;
      const m = new THREE.Matrix4();
      list.forEach((t, i) => {
        m.compose(
          new THREE.Vector3(t.x, t.trunkH + (scaleY ? 0.9 * t.scale : 0), t.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.yaw, 0)),
          new THREE.Vector3(t.scale, t.scale, t.scale),
        );
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = !!this.tier.propShadowCasters;
      this.root.add(inst);
      this.stats.instances += list.length;
    };

    build(canopies.filter((t) => t.tone > 0.45), canopyGeo, M.leafLight, "canopy-light", true);
    build(canopies.filter((t) => t.tone <= 0.45), canopyGeo, M.leafDark, "canopy-dark", true);
    build(narrow, cypressGeo, M.leafDark, "cypress", false);

    // Second, smaller blob per broadleaf crown. One sphere per tree reads as a
    // lollipop; an offset clump turns the silhouette lumpy and makes the
    // street canopy overlap the way real plane trees do.
    const clumpGeo = () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(1.05, 0.85, 1.05);
      return g;
    };
    const hash = (n) => {
      const x = Math.sin(n * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    const buildClumps = (list, material, name) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(clumpGeo(), material, list.length);
      inst.name = name;
      const m = new THREE.Matrix4();
      const color = new THREE.Color();
      list.forEach((t, i) => {
        const a = hash(t.x * 1.7 + t.z * 3.1) * Math.PI * 2;
        const r = t.scale * 0.62;
        m.compose(
          new THREE.Vector3(t.x + Math.cos(a) * r, t.trunkH + t.scale * 1.5, t.z + Math.sin(a) * r),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)),
          new THREE.Vector3(t.scale * 0.72, t.scale * 0.6, t.scale * 0.72),
        );
        inst.setMatrixAt(i, m);
        // Per-tree tint keeps a row of street trees from looking stamped.
        const k = 0.78 + hash(t.x * 0.7 - t.z * 1.3) * 0.44;
        inst.setColorAt(i, color.setRGB(k, k * (0.94 + hash(i) * 0.12), k * 0.92));
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = !!this.tier.propShadowCasters;
      this.root.add(inst);
      this.stats.instances += list.length;
    };
    buildClumps(canopies.filter((t) => t.tone > 0.45), M.leafLight, "canopy-clump-light");
    buildClumps(canopies.filter((t) => t.tone <= 0.45), M.leafDark, "canopy-clump-dark");
  }

  // -------------------------------------------------------------- lamps
  buildLamps() {
    const M = this.materials;
    const list = this.built.lamps;
    if (!list.length) return;

    // Poles: instanced cylinder.
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 1, 6);
    poleGeo.translate(0, 0.5, 0);
    const poles = new THREE.InstancedMesh(poleGeo, M.metal, list.length);
    poles.name = "lamp-poles";
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.16, 0.3), M.amber, list.length);
    heads.name = "lamp-heads";
    const m = new THREE.Matrix4();
    list.forEach((l, i) => {
      m.compose(
        new THREE.Vector3(l.x, 0, l.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, l.h, 1),
      );
      poles.setMatrixAt(i, m);
      m.compose(
        new THREE.Vector3(l.x + l.side * 0.35, l.h, l.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      heads.setMatrixAt(i, m);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.root.add(poles, heads);

    // Only the budget allows real point lights; the rest are emissive only.
    for (const l of list) {
      if (!l.lit) continue;
      const light = new THREE.PointLight(C.amber, 16, 17, 2);
      light.position.set(l.x + l.side * 0.4, l.h - 0.2, l.z);
      light.userData.lamp = l;
      light.userData.base = 16;
      this.root.add(light);
      this.lampLights.push(light);
    }
    this.stats.instances += list.length * 2;
  }

  // -------------------------------------------------------------- props
  buildProps() {
    const bin = new MergeBin();
    const M = this.materials;
    const instancedBoxes = [];
    for (const p of this.built.props) {
      if (p.kind === "containerStack") {
        const cm = M.container[Math.floor(p.tone * M.container.length) % M.container.length];
        for (let i = 0; i < p.stack; i++) {
          bin.box(cm, p.x, 1.3 + i * 2.6, p.z, p.w, 2.5, p.d);
        }
      } else if (p.kind === "crane") {
        bin.box(M.rust, p.x, p.h / 2, p.z, 3.2, p.h, 3.2);
        bin.box(M.rust, p.x, p.h - 0.6, p.z, p.reach * 2, 0.9, 1.4);
        bin.box(M.metal, p.x + p.reach * 0.7, p.h - 3.2, p.z, 0.3, 5.4, 0.3);
      } else if (p.kind === "bench") {
        bin.box(M.timber, p.x, 0.44, p.z, 2.0, 0.12, 0.62);
        bin.box(M.metal, p.x, 0.22, p.z, 1.7, 0.44, 0.12);
      } else if (p.kind === "bin") {
        bin.box(M.metal, p.x, 0.42, p.z, 0.62, 0.84, 0.62);
        bin.box(M.rust, p.x, 0.88, p.z, 0.7, 0.08, 0.7);
      } else if (p.kind === "hydrant") {
        bin.box(M.rust, p.x, 0.34, p.z, 0.26, 0.68, 0.26);
        bin.box(M.rust, p.x, 0.72, p.z, 0.4, 0.12, 0.4);
      } else if (p.kind === "bollard") {
        bin.box(M.kerb, p.x, 0.42, p.z, 0.18, 0.84, 0.18);
        bin.box(M.markAmber, p.x, 0.8, p.z, 0.2, 0.08, 0.2);
      } else if (p.kind === "signpost") {
        bin.box(M.metal, p.x, 1.1, p.z, 0.09, 2.2, 0.09);
        bin.box(M.white, p.x, 2.05, p.z, 0.06, 0.5, 0.72);
      } else if (p.kind === "crate") {
        bin.box(M.timber, p.x, 0.3, p.z, 0.72, 0.6, 0.62);
      } else if (p.kind === "planter") {
        bin.box(M.kerb, p.x, 0.26, p.z, 1.2, 0.52, 1.2);
        bin.box(M.leafDark, p.x, 0.66, p.z, 0.9, 0.5, 0.9);
      } else if (p.kind === "utilityBox") {
        bin.box(M.metal, p.x, 0.55, p.z, 1.0, 1.1, 0.7);
        bin.box(M.rust, p.x, 1.12, p.z, 1.06, 0.08, 0.76);
      } else if (p.kind === "barge") {
        bin.box(M.rust, p.x, 0.7, p.z, p.w, 1.9, p.d);
        bin.box(M.metal, p.x, 1.75, p.z, p.w * 0.55, 1.1, p.d * 0.7);
        bin.box(M.markAmber, p.x - p.w * 0.3, 2.2, p.z, 0.5, 0.8, 0.5);
      } else if (p.kind === "pier") {
        bin.box(M.timber, p.x, 0.35, p.z, p.w, 0.3, p.len);
        for (let z = p.z - p.len / 2; z <= p.z + p.len / 2; z += 3.2) {
          bin.box(M.timber, p.x - p.w / 2 + 0.3, 0.1, z, 0.24, 0.7, 0.24);
          bin.box(M.timber, p.x + p.w / 2 - 0.3, 0.1, z, 0.24, 0.7, 0.24);
        }
      } else if (p.kind === "buoy") {
        bin.box(M.markAmber, p.x, -0.15, p.z, 0.7, 0.9, 0.7);
        bin.box(M.metal, p.x, 0.32, p.z, 0.18, 0.5, 0.18);
      } else if (p.kind === "railing") {
        instancedBoxes.push({ x: p.x, y: 0.55, z: p.z, w: p.len, h: 1.1, d: 0.08 });
      }
    }
    const merged = bin.flush(this.root, "props");
    this.stats.triangles += merged.triangles;

    if (instancedBoxes.length) {
      const inst = new THREE.InstancedMesh(SHARED.box, M.metal, instancedBoxes.length);
      inst.name = "railings";
      const m = new THREE.Matrix4();
      instancedBoxes.forEach((b, i) => {
        m.compose(
          new THREE.Vector3(b.x, b.y, b.z),
          new THREE.Quaternion(),
          new THREE.Vector3(b.w, b.h, b.d),
        );
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      this.stats.instances += instancedBoxes.length;
    }

    // Bridge decks.
    for (const b of this.built.bridges) {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(b.x2 - b.x1, 0.4, b.z2 - b.z1),
        M.concrete,
      );
      deck.name = `bridge-${b.id}`;
      deck.position.set((b.x1 + b.x2) / 2, 0, (b.z1 + b.z2) / 2);
      deck.receiveShadow = true;
      this.root.add(deck);
      // Rails along the bridge edges.
      const rail = new MergeBin();
      for (const side of [-1, 1]) {
        if (b.kind === "road") {
          rail.box(M.kerb, (b.x1 + b.x2) / 2, 0.5, side > 0 ? b.z2 - 0.2 : b.z1 + 0.2, b.x2 - b.x1, 1.0, 0.3);
        } else {
          for (let x = b.x1; x <= b.x2; x += 1.6) {
            rail.box(M.metal, x, 0.6, side > 0 ? b.z2 - 0.2 : b.z1 + 0.2, 0.08, 1.2, 0.08);
          }
        }
      }
      rail.flush(this.root, `bridge-rail-${b.id}`);
    }
  }

  // ----------------------------------------------------- parked vehicles
  buildParkedVehicles() {
    const M = this.materials;
    const bodies = new MergeBin();
    const glass = new MergeBin();
    const tyres = [];
    for (const v of this.built.vehiclesParked) {
      const dims = v.kind === "truck" ? [2.4, 2.9, 7.4] : v.kind === "van" ? [2.0, 2.2, 5.4] : [1.85, 1.4, 4.3];
      const [w, h, len] = dims;
      const yaw = v.yaw;
      const tone = [0x2c3a44, 0x5a4a3c, 0x6d7174, 0x35424a, 0x8a5a48][Math.floor(v.tone * 5) % 5];
      const paint = mat(tone, { roughness: 0.45, metalness: 0.35 });
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      // Offset helper in vehicle space.
      const at = (lx, lz) => ({ x: v.x + lx * c + lz * s * 0 + lz * s, z: v.z + lz * c - lx * s });
      void at;
      const place = (bin, lx, ly, lz, bw, bh, bd) => {
        const px = v.x + lx * c + lz * s;
        const pz = v.z - lx * s + lz * c;
        bin.box(bin === glass ? M.glass : paint, px, ly, pz, bw, bh, bd, -yaw);
      };
      place(bodies, 0, h * 0.55, 0, w, h * 0.9, len);
      if (v.kind === "truck") {
        place(bodies, 0, h + 0.1, -len * 0.18, w * 0.92, 0.5, len * 0.55);
        place(glass, 0, h * 0.95, len * 0.32, w * 0.82, 0.7, 0.2);
      } else {
        place(glass, 0, h + 0.05, -len * 0.05, w * 0.84, 0.75, len * 0.42);
      }
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
          tyres.push({
            x: v.x + side * (w / 2 - 0.1) * c + end * len * 0.32 * s,
            z: v.z - side * (w / 2 - 0.1) * s + end * len * 0.32 * c,
            yaw: -yaw,
          });
        }
      }
    }
    const m = bodies.flush(this.root, "parked-bodies");
    glass.flush(this.root, "parked-glass");
    this.stats.triangles += m.triangles;

    if (tyres.length) {
      const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
      geo.rotateZ(Math.PI / 2);
      const inst = new THREE.InstancedMesh(geo, mat(0x15191c, { roughness: 0.95 }), tyres.length);
      inst.name = "parked-tyres";
      const arr = new THREE.Matrix4();
      tyres.forEach((t, i) => {
        arr.compose(
          new THREE.Vector3(t.x, 0.36, t.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.yaw, 0)),
          new THREE.Vector3(1, 1, 1),
        );
        inst.setMatrixAt(i, arr);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      this.stats.instances += tyres.length;
    }
  }

  // --------------------------------------------------------------- rain
  buildRain() {
    const count = this.tier.rain || 0;
    if (!count) return;
    const positions = new Float32Array(count * 6);
    this.rain = { positions, count, speeds: new Float32Array(count) };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xa9c4cd,
      transparent: true,
      opacity: 0.34,
    });
    const lines = new THREE.LineSegments(geo, material);
    lines.name = "rain";
    lines.frustumCulled = false;
    this.root.add(lines);
    this.rainMesh = lines;
    for (let i = 0; i < count; i++) {
      this.rain.speeds[i] = 16 + this.rand() * 14;
      this.resetDrop(i, -1);
    }
  }

  resetDrop(i, cameraY = 0) {
    const { positions } = this.rain;
    const x = (this.rand() - 0.5) * 70;
    const z = (this.rand() - 0.5) * 70;
    const y = cameraY + this.rand() * 22;
    const i6 = i * 6;
    positions[i6] = x;
    positions[i6 + 1] = y;
    positions[i6 + 2] = z;
    positions[i6 + 3] = x + 0.12;
    positions[i6 + 4] = y - 0.85;
    positions[i6 + 5] = z;
  }

  // --------------------------------------------------------------- update
  update(dt, camera, weather = null) {
    this.time += dt;
    if (weather) {
      this.rainRate = weather.rainRate;
      const wa = weather.windAngle;
      this.windX = Math.cos(wa) * weather.windStrength + (weather.gust || 0) * 0.3;
      this.windZ = Math.sin(wa) * weather.windStrength;
    }

    // Waves: a cheap two-sine swell on the CPU.
    for (const { mesh, material } of this.waterMeshes) {
      const data = material.userData.water;
      const arr = mesh.geometry.attributes.position.array;
      const base = data.base;
      const amp = data.amp;
      const t = this.time + data.phase;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        const z = base[i + 2];
        arr[i + 1] =
          Math.sin(x * 0.35 + t * 1.1) * amp * 0.5 +
          Math.sin(z * 0.22 - t * 0.7) * amp * 0.4 +
          Math.sin((x + z) * 0.14 + t * 0.4) * amp * 0.25;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }

    // Power cuts: a whole block of practicals dies, which changes what the
    // player can see and where the crowd is safe to walk.
    const now = this.time;
    for (const l of this.lampLights) {
      const spec = l.userData.lamp;
      const cut = spec && spec.cutUntil !== undefined && spec.cutUntil > now;
      l.intensity = cut ? (Math.sin(now * 37) > 0.7 ? 2.5 : 0.2) : l.userData.base || 16;
    }

    // Rain falls around the camera and wraps. Rate and slant come from the
    // weather, so a squall is visibly wind-driven and a dry break is empty.
    if (this.rainMesh && camera) {
      const { positions, speeds, count } = this.rain;
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      const rate = this.rainRate ?? 0.5;
      const active = Math.round(count * Math.min(1, rate * 1.35));
      const windX = (this.windX ?? 0) * 5.5;
      const windZ = (this.windZ ?? 0) * 5.5;
      for (let i = 0; i < count; i++) {
        const i6 = i * 6;
        if (i >= active) {
          // Park unused drops far below the world instead of drawing them.
          positions[i6 + 1] = -999;
          positions[i6 + 4] = -999;
          continue;
        }
        const fall = speeds[i] * dt;
        positions[i6] += windX * dt;
        positions[i6 + 2] += windZ * dt;
        positions[i6 + 1] -= fall;
        positions[i6 + 4] -= fall;
        positions[i6 + 3] = positions[i6] + 0.09 + windX * 0.05;
        positions[i6 + 5] = positions[i6 + 2] + windZ * 0.05;
        const dx = positions[i6] - cx;
        const dz = positions[i6 + 2] - cz;
        if (positions[i6 + 1] < cy - 6 || Math.abs(dx) > 36 || Math.abs(dz) > 36) {
          this.resetDrop(i, cy);
        }
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
      this.rainMesh.position.set(0, 0, 0);
      if (this.rainMesh.material) {
        this.rainMesh.material.opacity = 0.18 + rate * 0.34;
        this.rainMesh.visible = rate > 0.03;
      }
    }
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose && m.dispose());
      }
    });
  }
}

/** Vehicle meshes for the live traffic layer (instanced per vehicle kind). */
export function makeVehicleMesh(kind) {
  const dims = kind === "truck" ? [2.4, 2.9, 7.4] : kind === "van" ? [2.0, 2.2, 5.4] : [1.85, 1.4, 4.3];
  const [w, h, len] = dims;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h * 0.9, len),
    new THREE.MeshStandardMaterial({ color: srgb(0x3b4a54), roughness: 0.42, metalness: 0.35 }),
  );
  body.position.y = h * 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.84, 0.78, len * (kind === "truck" ? 0.2 : 0.42)),
    new THREE.MeshStandardMaterial({
      color: srgb(0x1a2228),
      roughness: 0.2,
      metalness: 0.5,
      emissive: srgb(0x2a3a42),
      emissiveIntensity: 0.4,
    }),
  );
  cabin.position.set(0, h + 0.04, len * (kind === "truck" ? 0.3 : -0.04));
  g.add(cabin);
  // Headlights and tail lights: two quads each, no separate lights (phones).
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: srgb(0xfff0d2), emissive: srgb(0xffe9c0), emissiveIntensity: 2.2 }),
    );
    head.position.set(side * w * 0.33, h * 0.62, len / 2);
    g.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.06),
      new THREE.MeshStandardMaterial({ color: srgb(0x531f1a), emissive: srgb(0xe88771), emissiveIntensity: 1.4 }),
    );
    tail.position.set(side * w * 0.33, h * 0.66, -len / 2);
    tail.name = "tail-light";
    g.add(tail);
  }
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const tyre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.26, 8),
        new THREE.MeshStandardMaterial({ color: srgb(0x15191c), roughness: 0.95 }),
      );
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(side * (w / 2 - 0.05), 0.36, end * len * 0.32);
      g.add(tyre);
    }
  }
  // Headlight wash on the road. A real SpotLight per car is far too expensive on
  // a phone, and the CPU rasteriser has no spot path either, so this is a flat
  // additive wedge that the car drags along with it: cheap, and it reads as
  // "light is coming from that car" in a dark frame.
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.5, 9),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(0, 0.045, len / 2 + 4.2);
  wash.name = "headlight-wash";
  wash.renderOrder = 2;
  g.add(wash);

  g.name = `traffic-${kind}`;
  g.userData.kind = kind;
  g.userData.headlight = wash;
  return g;
}

/** Simple pedestrian figure: two legs, a body and a head. */
export function makePedestrianMesh(tone = 0.5) {
  const g = new THREE.Group();
  const coat = [0x3c4a52, 0x55483f, 0x2f3b33, 0x4a4050][Math.floor(tone * 4) % 4];
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.21, 0.62, 4, 8),
    new THREE.MeshStandardMaterial({ color: srgb(coat), roughness: 0.9 }),
  );
  body.position.y = 1.06;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 6),
    new THREE.MeshStandardMaterial({ color: srgb(0x9c7f6a), roughness: 0.85 }),
  );
  head.position.y = 1.56;
  g.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: srgb(0x24292c), roughness: 0.9 });
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 3, 6), legMat);
    leg.position.set(side * 0.1, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}
