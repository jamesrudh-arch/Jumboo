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
  // A single saturated colour reserved for things that will hurt you. Nothing
  // else in the district uses it, so it reads as a warning at a glance.
  hazardPaint: 0xd8a13a,
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

  flush(parent, namePrefix = "merged", userData = null) {
    let i = 0;
    let tris = 0;
    for (const { material, geos } of this.bins.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${namePrefix}-${i++}`;
      // Tag swappable props so the asset kit can find and replace them later.
      if (userData) Object.assign(mesh.userData, userData);
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

/** Believable real-world height for a kit prop, in metres. */
function kindHeight(model) {
  switch (model) {
    case "bench": return 0.9;
    case "dumpster": return 1.2;
    case "firehydrant": return 0.75;
    case "box_A": return 0.7;
    case "box_B": return 0.6;
    case "bush": return 1.0;
    case "streetlight": return 7;
    default: return 1;
  }
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
    this.wetMaterials = []; // asphalt/sidewalk meshes that darken and gloss in rain
    this.puddles = [];
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
      hazardPaint: mat(C.hazardPaint, { roughness: 0.7 }),
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
    this.buildPuddles();
    this.buildRain();

    this.stats.meshes = this.countMeshes();
    return this;
  }

  /**
   * Swap the generated street furniture for the asset kit (CC0 KayKit city
   * models). Called after the kit loads, so the district is playable while it
   * streams: anything not swapped simply stays as the generated mesh.
   *
   * The generated mesh is hidden rather than deleted, so a caller can revert and
   * so the collision set (built from city data, not from meshes) is untouched.
   */
  applyKit(kit) {
    // 1. Street lamps: a real streetlight model beats a pole and a box.
    const generatedLamps = this.root.children.filter(
      (o) => o.name === "lamp-poles" || o.name === "lamp-heads",
    );
    if (kit.has("streetlight") && this.built.lamps?.length) {
      const proto = kit.make("streetlight");
      const size = kit.size("streetlight");
      const geo = proto.children[0]?.geometry;
      if (geo) {
        // Height comes from the simulation's lamp spec so lighting and collision
        // still line up; the model supplies the silhouette.
        const inst = new THREE.InstancedMesh(geo, kit.material, this.built.lamps.length);
        inst.name = "kit-streetlights";
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        this.built.lamps.forEach((l, i) => {
          const h = l.h || 7;
          const scale = size.y > 0.01 ? h / size.y : 1;
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.side < 0 ? Math.PI : 0);
          m.compose(new THREE.Vector3(l.x, 0, l.z), q, new THREE.Vector3(scale, scale, scale));
          inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        this.root.add(inst);
        this.stats.instances += this.built.lamps.length;
      }
      for (const o of generatedLamps) o.visible = false;
    }

    // 2. Parked cars. The generated ones are extruded boxes merged into three
    // batches; beside a kit car they read as placeholder. Hide them and instance
    // the kit's models at the same kerbside spots, keeping the authored yaw.
    const parkedBatch = this.root.children.filter((o) => /^parked-(bodies|glass|tyres)/.test(o.name));
    const parkedKinds = ["car_sedan", "car_hatchback", "car_taxi", "car_stationwagon", "car_police"].filter((n) => kit.has(n));
    if (parkedBatch.length && parkedKinds.length && this.built.vehiclesParked?.length) {
      for (const o of parkedBatch) o.visible = false;
      // Group the spots by body type so each type is one instanced draw.
      const byCar = new Map(parkedKinds.map((n) => [n, []]));
      this.built.vehiclesParked.forEach((v, i) => {
        const name = parkedKinds[i % parkedKinds.length];
        byCar.get(name).push(v);
      });
      for (const [name, spots] of byCar) {
        if (!spots.length) continue;
        const proto = kit.make(name);
        const geo = proto?.children[0]?.geometry;
        if (!geo) continue;
        const size = kit.size(name);
        // Fit each to the simulation's footprint so parking and collision match.
        const targetLen = 4.6;
        const scale = size.z > 0.01 ? targetLen / size.z : 1;
        const inst = new THREE.InstancedMesh(geo, kit.material, spots.length);
        inst.name = `kit-parked-${name}`;
        const m = new THREE.Matrix4();
        spots.forEach((v, i) => {
          m.compose(
            new THREE.Vector3(v.x, 0, v.z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, v.yaw, 0)),
            new THREE.Vector3(scale, scale, scale),
          );
          inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        this.root.add(inst);
        this.stats.instances += spots.length;
      }
    }

    // 3. Street props: hydrants, bins, benches, planters, utility boxes. Each
    // swappable prop was built as its own tagged mesh, so it can be hidden and a
    // kit model put exactly where it stood.
    const PROP_MODEL = {
      bench: "bench",
      bin: "dumpster",
      hydrant: "firehydrant",
      crate: "box_A",
      planter: "bush",
      utilityBox: "box_B",
    };
    const swapped = [];
    for (const child of [...this.root.children]) {
      const kind = child.userData.propKind;
      const model = kind ? PROP_MODEL[kind] : null;
      if (!model || !kit.has(model)) continue;
      child.visible = false;
      swapped.push({ model, x: child.userData.x, z: child.userData.z });
    }
    // One instanced draw per model kind, sized to the prop it replaces.
    const byModel = new Map();
    for (const s2 of swapped) {
      if (!byModel.has(s2.model)) byModel.set(s2.model, []);
      byModel.get(s2.model).push(s2);
    }
    for (const [model, spots] of byModel) {
      const proto = kit.make(model);
      const geo = proto?.children[0]?.geometry;
      if (!geo) continue;
      const size = kit.size(model);
      const inst = new THREE.InstancedMesh(geo, kit.material, spots.length);
      inst.name = `kit-${model}`;
      const m = new THREE.Matrix4();
      spots.forEach((spot, i) => {
        // Scale so the kit model is a believable size for the prop it replaces,
        // not the kitted display scale.
        const height = kindHeight(model);
        const scale = size.y > 0.01 ? height / size.y : 1;
        m.compose(
          new THREE.Vector3(spot.x, 0, spot.z),
          new THREE.Quaternion(),
          new THREE.Vector3(scale, scale, scale),
        );
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.root.add(inst);
      this.stats.instances += spots.length;
    }

    this.stats.meshes = this.countMeshes();
    return this;
  }

  /**
   * Replace the generated trees with the city kit's trees, and dress the parks
   * with its landscaping. Trees are the single biggest thing missing from the
   * street's silhouette: a cone on a stick is a place holder next to a modelled
   * araucaria, and the kit's trees are 500-600 triangles each.
   */
  applyCityKit(cityKit) {
    const TREES = ["araucaria", "buriti", "ipe_amarelo"].filter((n) => cityKit.has(n));
    if (!TREES.length || !this.built.trees?.length) return this;

    // Hide the generated trees: trunks, canopies and any narrow canopies.
    for (const o of this.root.children) {
      if (o.name && /^tree-/.test(o.name)) o.visible = false;
    }

    // One merged, coloured batch per tree species, so a hundred trees cost a few
    // dozen draw calls total instead of a hundred groups.
    const bySpecies = new Map(TREES.map((n) => [n, []]));
    this.built.trees.forEach((t, i) => {
      // Cypresses keep the generated narrow silhouette; the kit's three species
      // are broad, and a park row of them reads better varied than uniform.
      const species = TREES[i % TREES.length];
      bySpecies.get(species).push(t);
    });

    for (const [species, list] of bySpecies) {
      if (!list.length) continue;
      const parts = cityKit.parts(species);
      if (!parts.length) continue;
      // Group the species' parts by palette material and instance each group.
      const byMaterial = new Map();
      for (const part of parts) {
        const mat = cityKit.material(part.color);
        if (!byMaterial.has(mat)) byMaterial.set(mat, []);
        byMaterial.get(mat).push(part.geometry);
      }
      const size = cityKit.size(species);
      for (const [mat, geos] of byMaterial) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (!merged) continue;
        const inst = new THREE.InstancedMesh(merged, mat, list.length);
        inst.name = `kit-tree-${species}`;
        const m = new THREE.Matrix4();
        list.forEach((t, i) => {
          // Real trees: height from the authored model, scaled to the tree's own
          // height so a small street tree stays small.
          const height = (t.trunkH || 2.4) * 1.9 * (t.scale || 1);
          const scale = height / Math.max(size.y, 0.01);
          m.compose(
            new THREE.Vector3(t.x, 0, t.z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.yaw, 0)),
            new THREE.Vector3(scale, scale, scale),
          );
          inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = !!this.tier.propShadowCasters;
        this.root.add(inst);
        this.stats.instances += list.length;
      }
    }

    // Park dressing: one piece of kit furniture per park, placed at its centre so
    // a green rectangle becomes a place with a bench, a shelter and planting.
    const DRESS = ["quiosque", "parquinho", "banco_praca", "ecoparque"].filter((n) => cityKit.has(n));
    for (const park of this.city.parks || []) {
      const w = park.x2 - park.x1;
      const d = park.z2 - park.z1;
      DRESS.forEach((name, i) => {
        const model = cityKit.make(name);
        if (!model) return;
        const size = cityKit.size(name);
        // Each piece gets a share of the lawn, so a park reads as a place with
        // things in it rather than one object in an empty field.
        const spread = (i + 0.5) / DRESS.length;
        const scale = Math.min(3.2 / Math.max(size.x, 0.01), 3.2 / Math.max(size.z, 0.01));
        model.scale.setScalar(scale);
        model.position.set(
          park.x1 + w * (0.18 + spread * 0.64),
          0,
          park.z1 + d * (0.25 + (i % 2) * 0.5),
        );
        model.rotation.y = i * 1.31;
        this.root.add(model);
      });
    }

    this.stats.meshes = this.countMeshes();
    return this;
  }

  /**
   * Put the Kenney watercraft pack on the water. The district already has a
   * 300 m harbour and a canal with nothing floating in them, which reads as a
   * hole in the map rather than as water.
   */
  applyWaterKit(waterKit) {
    if (!waterKit) return this;
    const HARBOUR = this.city.water?.find((w) => w.kind === "harbour");
    const CANAL = this.city.water?.find((w) => w.kind === "canal");
    const place = (name, x, z, yaw, scaleHint, surfaceY = -0.6) => {
      if (!waterKit.has(name)) return null;
      const mesh = waterKit.make(name);
      if (!mesh) return null;
      const size = waterKit.size(name);
      // Scale to real-world length: a rowing boat is ~3 m, a cargo ship ~78 m.
      const s = scaleHint / Math.max(size.z, size.x, 0.001);
      mesh.scale.setScalar(s);
      mesh.rotation.y = yaw;
      // Sit the hull *in* the water: the bottom of the hull goes a little under
      // the surface and the freeboard stays clear. Placing these at y=0 (street
      // level) left every boat hovering 0.6 m above the harbour.
      const height = size.y * s;
      mesh.position.set(x, surfaceY - height * 0.30, z);
      this.root.add(mesh);
      this.stats.meshes = (this.stats.meshes || 0) + 1;
      return mesh;
    };

    if (HARBOUR) {
      const midZ = (HARBOUR.z1 + HARBOUR.z2) / 2;
      // Moored along the quay, then working boats out in the roads.
      const QUAY = [-110, -78, -46, 14, 46, 78, 110];
      const sy = HARBOUR.surfaceY ?? -0.6;
      // The harbour is 32 m deep, so nothing here is bigger than a working
      // vessel: an ocean liner scaled to 78 m turns the quay into a flat slab.
      const depth = HARBOUR.z2 - HARBOUR.z1;
      const maxLen = depth * 0.72;
      const fit = (want) => Math.min(want, maxLen);
      QUAY.forEach((x, i) => {
        const name = ["boat-fishing-small", "boat-tow-a", "boat-speed-b"][i % 3];
        place(name, x, HARBOUR.z1 + 7, Math.PI / 2 + (i % 2 ? 0.06 : -0.05), fit(9), sy);
      });
      place("ship-cargo-a", -44, midZ + 1, Math.PI / 2 + 0.02, fit(24), sy);
      place("ship-cargo-b", 58, midZ - 2, Math.PI / 2 - 0.03, fit(22), sy);
      place("boat-tug-a", 12, midZ + 8, -Math.PI / 2, fit(12), sy);
      place("boat-house-a", -126, midZ - 5, Math.PI / 2, fit(11), sy);
      place("boat-speed-c", 126, midZ + 7, -Math.PI / 2 + 0.3, fit(7), sy);
    }
    if (CANAL) {
      const z = (CANAL.z1 + CANAL.z2) / 2;
      // Narrow boats along the canal, bow to the towpath.
      const cy = CANAL.surfaceY ?? -0.45;
      [-52, -18, 22, 58, 96].forEach((x, i) => {
        place(i % 2 ? "boat-row-small" : "boat-fan", x, z, (i % 2 ? 0.02 : -0.02), 3.0, cy);
      });
    }
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
    // The two biggest surfaces in the frame: the weather drives how they read.
    this.wetMaterials.push({ material: this.materials.asphalt, kind: "asphalt" });
    this.wetMaterials.push({ material: this.materials.sidewalk, kind: "sidewalk" });
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

    // Poles: instanced cylinder, as before. The head is a second instanced
    // mesh. Lamps are the most numerous prop in the district; two draw calls
    // for all of them is already about as cheap as this gets.
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

    // Wet-road reflections. A real specular highlight needs a renderer that
    // does specular; a phone at 1x with fog does not sell it either. These are
    // thin additive streaks laid along the road under each lit lamp, which is
    // how the wet-street look is actually achieved: the light smears in the
    // water instead of sitting on it. Opacity is driven by wetness, so the
    // street only mirrors when it has rained.
    const streakGeo = new THREE.PlaneGeometry(1, 1);
    streakGeo.rotateX(-Math.PI / 2);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffc879,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const streaks = new THREE.InstancedMesh(streakGeo, streakMat, list.length);
    streaks.name = "wet-lamp-streaks";
    streaks.renderOrder = 2;
    const sm = new THREE.Matrix4();
    list.forEach((l, i) => {
      // Sit the smear on the road side of the pole and stretch it away from
      // the kerb, the way a lamp's reflection runs across wet asphalt.
      sm.compose(
        new THREE.Vector3(l.x + l.side * 2.2, 0.03, l.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),
        new THREE.Vector3(0.9, 1, 5.2),
      );
      streaks.setMatrixAt(i, sm);
    });
    streaks.instanceMatrix.needsUpdate = true;
    this.root.add(streaks);
    this.lampStreaks = streakMat;
  }

  // -------------------------------------------------------------- props
  buildProps() {
    const bin = new MergeBin();
    const M = this.materials;
    const instancedBoxes = [];
    // Props the asset kit can replace are built one at a time instead of into
    // the merged batch, so the kit can hide exactly those and take their place.
    const SWAPPABLE = new Set(["bench", "bin", "hydrant", "crate", "planter", "utilityBox"]);
    for (const p of this.built.props) {
      if (SWAPPABLE.has(p.kind)) {
        const solo = new MergeBin();
        this.buildPropInto(solo, p);
        solo.flush(this.root, `prop-${p.kind}`, { kind: p.kind, x: p.x, z: p.z });
        continue;
      }
      if (p.kind === "containerStack") {
        const cm = M.container[Math.floor(p.tone * M.container.length) % M.container.length];
        for (let i = 0; i < p.stack; i++) {
          bin.box(cm, p.x, 1.3 + i * 2.6, p.z, p.w, 2.5, p.d);
        }
      } else if (p.kind === "crane") {
        bin.box(M.rust, p.x, p.h / 2, p.z, 3.2, p.h, 3.2);
        bin.box(M.rust, p.x, p.h - 0.6, p.z, p.reach * 2, 0.9, 1.4);
        bin.box(M.metal, p.x + p.reach * 0.7, p.h - 3.2, p.z, 0.3, 5.4, 0.3);
      } else if (p.kind === "bollard") {
        bin.box(M.kerb, p.x, 0.42, p.z, 0.18, 0.84, 0.18);
        bin.box(M.markAmber, p.x, 0.8, p.z, 0.2, 0.08, 0.2);
      } else if (p.kind === "signpost") {
        bin.box(M.metal, p.x, 1.1, p.z, 0.09, 2.2, 0.09);
        bin.box(M.white, p.x, 2.05, p.z, 0.06, 0.5, 0.72);
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

  /** Geometry for one prop the kit can replace. */
  buildPropInto(bin, p) {
    const M = this.materials;
    if (p.kind === "bench") {
      bin.box(M.timber, p.x, 0.44, p.z, 2.0, 0.12, 0.62);
      bin.box(M.metal, p.x, 0.22, p.z, 1.7, 0.44, 0.12);
    } else if (p.kind === "bin") {
      bin.box(M.metal, p.x, 0.42, p.z, 0.62, 0.84, 0.62);
      bin.box(M.rust, p.x, 0.88, p.z, 0.7, 0.08, 0.7);
    } else if (p.kind === "hydrant") {
      bin.box(M.rust, p.x, 0.34, p.z, 0.26, 0.68, 0.26);
      bin.box(M.rust, p.x, 0.72, p.z, 0.4, 0.12, 0.4);
    } else if (p.kind === "crate") {
      bin.box(M.timber, p.x, 0.3, p.z, 0.72, 0.6, 0.62);
    } else if (p.kind === "planter") {
      bin.box(M.kerb, p.x, 0.26, p.z, 1.2, 0.52, 1.2);
      bin.box(M.leafDark, p.x, 0.66, p.z, 0.9, 0.5, 0.9);
    } else if (p.kind === "utilityBox") {
      bin.box(M.metal, p.x, 0.55, p.z, 1.0, 1.1, 0.7);
      bin.box(M.rust, p.x, 1.12, p.z, 1.06, 0.08, 0.76);
    } else if (p.kind === "barrel") {
      // A drum has to read as dangerous from a distance or it is just a bin. A
      // rusted band and a bright cap do that without a texture.
      bin.box(M.rust, p.x, 0.48, p.z, 0.62, 0.95, 0.62);
      bin.box(M.metal, p.x, 0.72, p.z, 0.66, 0.1, 0.66);
      bin.box(M.hazardPaint ?? M.rust, p.x, 0.97, p.z, 0.5, 0.06, 0.5);
    } else if (p.kind === "gasMain") {
      // A standpipe against the alley wall: a valve wheel and a painted band.
      bin.box(M.metal, p.x, 0.35, p.z, 0.18, 0.7, 0.18);
      bin.box(M.rust, p.x, 0.68, p.z, 0.44, 0.1, 0.44);
      bin.box(M.hazardPaint ?? M.rust, p.x, 0.78, p.z, 0.12, 0.2, 0.12);
    }
  }

  // ------------------------------------------------------------- puddles
  // Wet street response. In daylight a city can be dry and still read; in the
  // rain the ground is the biggest surface on screen, and leaving it matte is
  // what makes a rainy scene look like a clear one with lines drawn on it.
  // Puddles are flat discs with an additive grey-blue sheen whose opacity is
  // driven by the weather; the asphalt and pavement materials darken and gloss
  // with the same signal.
  buildPuddles() {
    const count = this.tier.puddles ?? 0;
    this.wetMaterials = [];
    this.puddles = [];
    if (!count) return;
    // Big, smooth-ish discs: 12 segments is plenty at this size and keeps the
    // whole set to one instanced draw call.
    const geo = new THREE.CircleGeometry(1, 12);
    geo.rotateX(-Math.PI / 2);
    // Puddles are read by their *shine*, so they get a cool emissive body that
    // sits just under the street's value. Plain reflective water is invisible
    // in this scene: there is no environment map at night and nothing to
    // reflect, so a physically-correct mirror just returns black.
    const material = new THREE.MeshStandardMaterial({
      color: 0x50646e,
      emissive: 0x33474f,
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const inst = new THREE.InstancedMesh(geo, material, count);
    inst.name = "puddles";
    const m = new THREE.Matrix4();
    const rand = mulberry32(0x9a17);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 40) {
      const r = this.city.roads[Math.floor(rand() * this.city.roads.length)];
      const x = r.x1 + rand() * (r.x2 - r.x1);
      const z = r.z1 + rand() * (r.z2 - r.z1);
      if (this.inWater(x, z)) continue;
      // Sit each puddle on the road surface, not the base slab.
      // Road surfaces sit at y = 0.02, so puddles go just above that.
      m.compose(
        new THREE.Vector3(x, 0.028, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0)),
        new THREE.Vector3(0.7 + rand() * 2.1, 1, 0.5 + rand() * 1.4),
      );
      inst.setMatrixAt(placed, m);
      placed += 1;
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    inst.renderOrder = 1;
    this.root.add(inst);
    this.puddleMaterial = material;
    this.stats.instances += placed;
  }

  /** Rain response for the ground: puddles fade in, streets darken and gloss. */
  setWetness(level) {
    const w = Math.max(0, Math.min(1, level));
    if (this.puddleMaterial) this.puddleMaterial.opacity = 0.03 + w * 0.34;
    if (this.lampStreaks) this.lampStreaks.opacity = w * 0.17;
    // Asphalt gets darker and much shinier as it soaks; the pavement follows
    // more slowly, which is what makes a street look wet rather than painted.
    for (const entry of this.wetMaterials) {
      const mat = entry.material;
      if (entry.kind === "asphalt") {
        mat.roughness = 0.62 - w * 0.4;
        mat.metalness = 0.12 + w * 0.5;
      } else {
        mat.roughness = 0.95 - w * 0.3;
        mat.metalness = 0.02 + w * 0.14;
      }
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
  update(dt, camera, weather = null, wetness = null) {
    this.time += dt;
    // Wet ground follows the same wetness signal the audio and HUD use, so the
    // puddles do not disagree with the rain the player can hear.
    if (wetness !== null && wetness !== undefined) {
      this.setWetness(wetness);
    } else if (weather) {
      this.setWetness(weather.rainRate ?? 0);
    }
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

// One shared tyre geometry for every vehicle: four instances of it are merged
// into each car's shell, so it is never a separate draw call.
const VEHICLE_TYRE = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 8);

/**
 * Vehicle mesh for the live traffic layer.
 *
 * One merged body mesh plus one lamp mesh plus one additive road wash: three
 * draw calls per car instead of twenty-eight. With fourteen cars, the naive
 * version was most of the frame's draw calls on a phone. The lamp mesh is
 * separate because brake lights change brightness per vehicle at runtime, and
 * the wash is separate because it is additive and needs its own render order.
 */
export function makeVehicleMesh(kind) {
  const dims = kind === "truck" ? [2.4, 2.9, 7.4] : kind === "van" ? [2.0, 2.2, 5.4] : [1.85, 1.4, 4.3];
  const [w, h, len] = dims;
  const g = new THREE.Group();

  // Body, cabin and tyres share one material set: merge each into a single
  // geometry so the whole shell is one draw call.
  const shell = new MergeBin();
  const paint = new THREE.MeshStandardMaterial({ color: srgb(0x3b4a54), roughness: 0.42, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: srgb(0x1a2228),
    roughness: 0.2,
    metalness: 0.5,
    emissive: srgb(0x2a3a42),
    emissiveIntensity: 0.4,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: srgb(0x15191c), roughness: 0.95 });
  shell.box(paint, 0, h * 0.55, 0, w, h * 0.9, len);
  shell.box(
    glass,
    0,
    h + 0.04,
    len * (kind === "truck" ? 0.3 : -0.04),
    w * 0.84,
    0.78,
    len * (kind === "truck" ? 0.2 : 0.42),
  );
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      // Tyres are cylinders lying on their side; MergeBin.add handles rotation
      // through the instance matrix, so build one and place four copies.
      shell.add(rubber, VEHICLE_TYRE, tyreMatrix(side * (w / 2 - 0.05), 0.36, end * len * 0.32));
    }
  }
  // Merged per material rather than into one vertex-coloured mesh: three shell
  // meshes (paint, glass, rubber) instead of eighteen, and the colours stay
  // faithful in both the GPU path and the offline rasteriser, which has no
  // vertex-colour support.
  const shellCount = shell.flush(g, "car-shell");
  void shellCount;

  // Lamps: one merged mesh, emissive, its material shared per vehicle so
  // syncStreetActors can flare the tail lights without touching the body.
  const lampBin = new MergeBin();
  const headMat = new THREE.MeshStandardMaterial({
    color: srgb(0xfff0d2),
    emissive: srgb(0xffe9c0),
    emissiveIntensity: 2.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: srgb(0x531f1a),
    emissive: srgb(0xe88771),
    emissiveIntensity: 1.4,
  });
  for (const side of [-1, 1]) {
    lampBin.box(headMat, side * w * 0.33, h * 0.62, len / 2, 0.34, 0.16, 0.06);
    lampBin.box(tailMat, side * w * 0.33, h * 0.66, -len / 2, 0.28, 0.14, 0.06);
  }
  lampBin.flush(g, "car-lamp");
  // Expose the merged tail lamps so the runtime can flare them on braking.
  const tailLamps = g.children.find((c) => c.isMesh && c.material === tailMat);
  g.userData.tailMaterial = tailMat;
  g.userData.tailLamps = tailLamps || null;

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

/** Matrix for one tyre at (x, y, z), lying on its side. */
function tyreMatrix(x, y, z) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
    new THREE.Vector3(1, 1, 1),
  );
}

/**
 * Pedestrian figure: a merged body with two separate legs.
 *
 * The legs stay separate because they swing: everything else (coat, head, bag)
 * is one merged mesh. Twenty pedestrians used to be a hundred draw calls.
 */
export function makePedestrianMesh(tone = 0.5) {
  const g = new THREE.Group();
  const coat = [0x3c4a52, 0x55483f, 0x2f3b33, 0x4a4050][Math.floor(tone * 4) % 4];
  const bin = new MergeBin();
  const coatMat = new THREE.MeshStandardMaterial({ color: srgb(coat), roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: srgb(0x9c7f6a), roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ color: srgb(0x24292c), roughness: 0.9 });
  // Torso in two blocks: a wider chest over a narrower waist, so the
  // silhouette is a person and not a wardrobe. Arms hang at the sides; at
  // street distance that is what separates a figure from a post.
  bin.box(coatMat, 0, 1.16, 0, 0.4, 0.44, 0.26); // chest
  bin.box(coatMat, 0, 0.86, 0, 0.34, 0.3, 0.24); // waist
  bin.box(coatMat, 0, 1.37, 0, 0.42, 0.07, 0.28); // shoulder line
  for (const side of [-1, 1]) {
    bin.box(coatMat, side * 0.26, 1.12, 0, 0.11, 0.5, 0.13); // upper arm
    bin.box(coatMat, side * 0.27, 0.86, 0.02, 0.1, 0.16, 0.12); // forearm
  }
  bin.box(coatMat, 0, 1.43, 0, 0.12, 0.08, 0.12); // neck
  bin.add(skinMat, SHARED.sphere, new THREE.Matrix4().compose(
    new THREE.Vector3(0, 1.55, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(0.24, 0.25, 0.24),
  ));
  // A shoulder bag on some of them, so a row of figures is not identical.
  if (Math.floor(tone * 7) % 3 === 0) {
    bin.box(legMat, 0.26, 0.98, 0.06, 0.16, 0.24, 0.14);
  }
  bin.flush(g, "ped-body");

  const legs = [];
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.5, 3, 6);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(side * 0.1, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.userData.legs = legs;
  return g;
}
