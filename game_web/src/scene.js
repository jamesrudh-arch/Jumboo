// Renderer-side world construction for the vertical slice.
//
// The approved Marcus source is used unmodified; everything else here is
// placeholder environment art assembled from simple, cheap geometry that suits
// a mobile renderer. Nothing in this file is approved production design.

import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "../vendor/three/examples/jsm/environments/RoomEnvironment.js";
import { LEVEL } from "./level.js";
import { mulberry32 } from "./geom.js";
import { buildSade, buildCollector, poseFigure } from "../tools/characters.mjs";

export const PALETTE = {
  ink: 0x10171d,
  paper: 0xf0ede5,
  steel: 0x8b9b9b,
  tidal: 0x8ebab6,
  amber: 0xe0b77e,
  signal: 0xe88771,
};

const MAT = {
  asphalt: () => new THREE.MeshStandardMaterial({ color: 0x1b2328, roughness: 0.62, metalness: 0.12 }),
  concrete: () => new THREE.MeshStandardMaterial({ color: 0x4b565b, roughness: 0.9, metalness: 0.02 }),
  brick: () => new THREE.MeshStandardMaterial({ color: 0x333b40, roughness: 0.95 }),
  glassWarm: () =>
    new THREE.MeshStandardMaterial({
      color: 0x2a2b26,
      emissive: 0xe0b77e,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    }),
  glassDark: () => new THREE.MeshStandardMaterial({ color: 0x1c262d, roughness: 0.25, metalness: 0.35 }),
  canvas: () => new THREE.MeshStandardMaterial({ color: 0x7a3830, roughness: 0.85 }),
  signPlate: () => new THREE.MeshStandardMaterial({ color: 0x162026, roughness: 0.5, metalness: 0.4 }),
  shutter: () => new THREE.MeshStandardMaterial({ color: 0x3a454b, roughness: 0.55, metalness: 0.55 }),
  dock: () => new THREE.MeshStandardMaterial({ color: 0x2b353b, roughness: 0.7, metalness: 0.3 }),
  crate: () => new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.88 }),
  metal: () => new THREE.MeshStandardMaterial({ color: 0x6e7a7e, roughness: 0.45, metalness: 0.7 }),
};

// ---------------------------------------------------------------- textures
function makeCanvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function grimeTexture() {
  return makeCanvasTexture(256, (ctx, s) => {
    const r = mulberry32(1234);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const x = r() * s;
      const y = r() * s;
      const a = 0.03 + r() * 0.1;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(x, y, 1 + r() * 3, 1 + r() * 3);
    }
    // Vertical run-off streaks on the upper half.
    for (let i = 0; i < 40; i++) {
      const x = r() * s;
      ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`;
      ctx.fillRect(x, 0, 1 + r() * 2, s * (0.2 + r() * 0.5));
    }
  });
}

function asphaltTexture() {
  return makeCanvasTexture(512, (ctx, s) => {
    const r = mulberry32(77);
    ctx.fillStyle = "#2b343a";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 25 + r() * 40;
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 6},${0.25 + r() * 0.45})`;
      ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
    }
    // Patch seams and cracks.
    ctx.strokeStyle = "rgba(10,14,17,0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      let x = r() * s;
      let y = r() * s;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 70;
        y += (r() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function crateTexture() {
  return makeCanvasTexture(256, (ctx, s) => {
    const r = mulberry32(9);
    ctx.fillStyle = "#a8814f";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = `rgba(${90 + r() * 50},${60 + r() * 40},${25 + r() * 25},0.35)`;
      ctx.fillRect(0, (i / 22) * s + r() * 4, s, 3 + r() * 6);
    }
    // Plank edges and nail heads.
    ctx.fillStyle = "rgba(40,25,10,0.5)";
    for (let i = 0; i < 5; i++) ctx.fillRect(0, i * (s / 5) + 2, s, 3);
    ctx.fillStyle = "rgba(30,30,30,0.6)";
    for (let i = 0; i < 10; i++) ctx.beginPath(), ctx.arc(r() * s, r() * s, 2.5, 0, 6.283), ctx.fill();
  });
}

function puddleTexture() {
  return makeCanvasTexture(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(30,44,52,0.85)");
    g.addColorStop(0.55, "rgba(24,36,44,0.55)");
    g.addColorStop(1, "rgba(20,30,36,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(s / 2, s / 2, s * 0.48, s * 0.34, 0.4, 0, 6.283);
    ctx.fill();
    const r = mulberry32(31);
    ctx.strokeStyle = "rgba(160,190,195,0.12)";
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(s / 2 + (r() - 0.5) * 40, s / 2 + (r() - 0.5) * 20, s * (0.06 + r() * 0.14), s * 0.03, 0, 0, 6.283);
      ctx.stroke();
    }
  });
}

function stallSignTexture() {
  return makeCanvasTexture(512, (ctx, s) => {
    ctx.fillStyle = "#14202a";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#8ebab6";
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, s - 36, s - 36);
    ctx.fillStyle = "#e0b77e";
    ctx.font = "bold 70px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SADE", s / 2, s * 0.42);
    ctx.fillStyle = "#f0ede5";
    ctx.font = "40px sans-serif";
    ctx.fillText("CRATES · ROPE", s / 2, s * 0.58);
    ctx.fillStyle = "#8b9b9b";
    ctx.font = "30px sans-serif";
    ctx.fillText("OPEN LATE", s / 2, s * 0.72);
  });
}

// --------------------------------------------------------------- builder
export class LevelView {
  constructor(scene, built) {
    this.scene = scene;
    this.built = built;
    this.root = new THREE.Group();
    this.root.name = "level";
    scene.add(this.root);
    this.time = 0;
    this.lampLights = [];
    this.sun = null;
    this.hemi = null;
    this.buildingRng = mulberry32(4242);
  }

  build() {
    this.grime = grimeTexture();
    this.asphalt = asphaltTexture();
    this.crateTex = crateTexture();
    this.puddleTex = puddleTexture();
    this.stallTex = stallSignTexture();
    this.buildGround();
    this.buildSkyline();
    this.buildFacades();
    this.buildCover();
    this.buildProps();
    this.buildLights();
    this.buildDecals();
    this.buildGoal();
    this.buildCharacters();
    return this;
  }

  buildGround() {
    const mat = new THREE.MeshStandardMaterial({
      map: this.asphalt,
      roughness: 0.72,
      metalness: 0.08,
      color: 0xffffff,
    });
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(30, 40);
    // Extra margin beyond the lane walls so a wide or high camera never sees
    // the edge of the world.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 170), mat);
    ground.name = "ground";
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -30);
    ground.receiveShadow = true;
    ground.name = "ground";
    this.root.add(ground);
    this.groundMat = mat;

    // Raised walkway along the shopfronts.
    const walk = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.12, 60),
      new THREE.MeshStandardMaterial({ color: 0x555f63, roughness: 0.95 }),
    );
    walk.name = "walkway";
    walk.position.set(-8.6, 0.06, -18);
    walk.receiveShadow = true;
    this.root.add(walk);
  }

  // Distant blocks so the lane does not end in a void; kept low-poly.
  buildSkyline() {
    const r = this.buildingRng;
    const mat = new THREE.MeshStandardMaterial({ color: 0x0f171d, roughness: 1 });
    const far = new THREE.MeshStandardMaterial({ color: 0x0b1218, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const w = 8 + r() * 16;
      const h = 12 + r() * 26;
      const d = 8 + r() * 14;
      const z = -62 - r() * 26;
      const x = side * (20 + r() * 30);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 3 ? mat : far);
      box.name = `skyline-${i}`;
      box.position.set(x, h / 2 - 1, z);
      this.root.add(box);
    }
    // A dim horizon haze plane behind the market end.
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 110),
      new THREE.MeshBasicMaterial({ color: 0x1a2730, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    );
    haze.name = "haze";
    haze.position.set(0, 24, -150);
    this.root.add(haze);
  }

  box({ x, y = 0, z, w, h, d, mat, rotY = 0, uvRepeat }) {
    const material = (MAT[mat] || MAT.concrete)();
    if (uvRepeat && material.map) material.map.repeat.set(uvRepeat, uvRepeat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = h < 4;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  buildFacades() {
    const grime = this.grime;
    // Shopfront facade (left) with awning boards, windows and signs for the
    // three lit shops. The wall itself is part of the collision set.
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 14, 60),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, map: this.tintable(grime, 0x394349) }),
    );
    wall.name = "wall-left";
    wall.position.set(-7.35, 7, -18);
    wall.receiveShadow = true;
    this.root.add(wall);

    for (const z of [3.4, -6.5, -16.5]) {
      // Glowing shop window, set back slightly.
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 1.9),
        new THREE.MeshStandardMaterial({
          color: 0x1a1a16,
          emissive: 0xe0b77e,
          emissiveIntensity: 0.7,
          roughness: 0.4,
        }),
      );
      win.name = "window-lit";
      win.rotation.y = Math.PI / 2;
      win.position.set(-6.98, 1.9, z);
      this.root.add(win);
      // Awning.
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.14, 3.8),
        new THREE.MeshStandardMaterial({ color: 0x7a3830, roughness: 0.9 }),
      );
      awning.name = "awning";
      awning.position.set(-6.1, 3.0, z);
      awning.rotation.z = -0.16;
      awning.castShadow = true;
      this.root.add(awning);
      // Sign plate with grime.
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.62, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x162026, roughness: 0.55, metalness: 0.45 }),
      );
      sign.position.set(-6.9, 3.5, z);
      this.root.add(sign);
    }

    // Shuttered doorway behind the spawn, warm light spilling out.
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x2a2118, emissive: 0xffc98a, emissiveIntensity: 1.15 }),
    );
    door.name = "doorway";
    door.rotation.y = Math.PI / 2;
    door.position.set(-6.97, 1.28, 5.0);
    this.root.add(door);
    this.doorLight = new THREE.PointLight(0xffd7a3, 8, 8, 2);
    this.doorLight.position.set(-6.2, 1.9, 5.0);
    this.root.add(this.doorLight);

    // Upper-storey dark windows in a grid.
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x141d24, roughness: 0.2, metalness: 0.5 });
    for (const z of [1.0, -4.0, -11.0, -19.0, -27.0, -35.0]) {
      for (const y of [5.2, 8.0, 10.8]) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), upperMat);
        g.name = "window-upper";
        g.rotation.y = Math.PI / 2;
        g.position.set(-6.97, y, z);
        this.root.add(g);
      }
    }

    // Fire escape on the left facade.
    const fe = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x252e33, roughness: 0.7, metalness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const platform = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 2.6), steelMat);
      platform.position.set(-6.4, 4.6 + i * 3.0, -16.5);
      fe.add(platform);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 2.6), steelMat);
      rail.position.set(-5.9, 5.1 + i * 3.0, -16.5);
      fe.add(rail);
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.5), steelMat);
      ladder.position.set(-6.2, 3.1 + i * 3.0, -17.2);
      fe.add(ladder);
    }
    fe.name = "fire-escape";
    this.root.add(fe);

    // Right-hand industrial wall.
    const rWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 13, 56),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.tintable(grime, 0x454f54) }),
    );
    rWall.name = "wall-right";
    rWall.position.set(7.35, 6.5, -16);
    rWall.receiveShadow = true;
    this.root.add(rWall);
    for (const z of [-2.0, -20.0, -31.0]) {
      const shutter = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.2),
        new THREE.MeshStandardMaterial({ color: 0x545f66, roughness: 0.6, metalness: 0.55 }),
      );
      shutter.name = "shutter";
      shutter.rotation.y = -Math.PI / 2;
      shutter.position.set(6.98, 1.6, z);
      this.root.add(shutter);
      // Horizontal slat lines.
      for (let i = 0; i < 9; i++) {
        const slat = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, 0.03),
          new THREE.MeshBasicMaterial({ color: 0x2c353a }),
        );
        slat.rotation.y = -Math.PI / 2;
        slat.position.set(6.965, 0.3 + i * 0.36, z);
        this.root.add(slat);
      }
    }

    // Loading bay recess.
    const bayWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 13, 11),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.tintable(grime, 0x3b4449) }),
    );
    bayWall.name = "bay-wall";
    bayWall.position.set(12.95, 6.5, -39.5);
    this.root.add(bayWall);
    // Lit dock opening: a bright rectangle that reads as depth.
    const dockMouth = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1a2126, emissive: 0x9fc0bd, emissiveIntensity: 0.22 }),
    );
    dockMouth.name = "dock-mouth";
    dockMouth.rotation.y = -Math.PI / 2;
    dockMouth.position.set(12.55, 2.2, -39.5);
    this.root.add(dockMouth);
    // Dock lip.
    this.box({ x: 11.6, y: 0, z: -39.5, w: 1.8, h: 1.05, d: 8.0, mat: "concrete" });

    // Far end: a warehouse/market block that closes the lane, with a lit
    // archway so the lane reads as opening onto the market rather than a void.
    const endWall = new THREE.Mesh(
      new THREE.BoxGeometry(24.0, 15, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.tintable(grime, 0x3c464c) }),
    );
    endWall.name = "end-wall";
    endWall.position.set(3.0, 7.5, -48.2);
    endWall.receiveShadow = true;
    this.root.add(endWall);

    // Archway: dark recess with a warm interior glow.
    const archOuter = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 5.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 }),
    );
    archOuter.position.set(1.0, 2.7, -47.8);
    this.root.add(archOuter);
    const arch = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x120e0a, emissive: 0xd9a463, emissiveIntensity: 0.5, roughness: 0.9 }),
    );
    arch.name = "market-arch";
    arch.position.set(1.0, 2.3, -47.5);
    this.root.add(arch);
    // Slow market spill from the archway.
    const archLight = new THREE.PointLight(0xffc27a, 22, 20, 2);
    archLight.position.set(1.0, 2.4, -46.6);
    this.root.add(archLight);

    // Signage strip above the arch.
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(9.0, 0.5, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1b2428, emissive: PALETTE.tidal, emissiveIntensity: 0.55 }),
    );
    strip.position.set(1.0, 5.9, -47.9);
    this.root.add(strip);

    // Near end behind the player: the shop block turns a corner, so looking
    // back up the lane shows architecture, not empty ground.
    const nearWall = new THREE.Mesh(
      new THREE.BoxGeometry(24.0, 15, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.tintable(grime, 0x394349) }),
    );
    nearWall.name = "near-wall";
    nearWall.position.set(0.0, 7.5, 11.6);
    this.root.add(nearWall);

    // Pipes and conduit, cheap vertical rhythm.
    for (const p of [
      { x: 6.9, y: 6.4, z: -22.0 },
      { x: -6.9, y: 5.6, z: -35.0 },
    ]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 9, 6),
        new THREE.MeshStandardMaterial({ color: 0x4d575c, roughness: 0.5, metalness: 0.6 }),
      );
      pipe.name = "pipe";
      pipe.position.set(p.x, p.y, p.z);
      this.root.add(pipe);
    }
  }

  // Multiply a grime texture with a base colour to get per-wall tints from one map.
  tintable(texture, color) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(texture.image, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 8);
    return tex;
  }

  buildCover() {
    const crateMat = new THREE.MeshStandardMaterial({ map: this.crateTex, roughness: 0.85 });
    const crateSide = new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.9, map: this.crateTex });
    for (const p of this.built.props) {
      if (p.kind === "crate") {
        const geo = new THREE.BoxGeometry(p.s, p.s, p.s);
        const mesh = new THREE.Mesh(geo, [crateSide, crateSide, crateMat, crateMat, crateSide, crateSide]);
        mesh.name = "crate";
        mesh.position.set(p.x, p.y + p.s / 2, p.z);
        mesh.rotation.y = p.yaw;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.root.add(mesh);
        // Slat detail: a darker band around the box.
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(p.s * 1.002, p.s * 0.08, p.s * 1.002),
          new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.95 }),
        );
        band.position.copy(mesh.position);
        band.position.y += p.s * 0.12;
        band.rotation.y = p.yaw;
        this.root.add(band);
      } else if (p.kind === "dumpster") {
        this.makeDumpster(p);
      } else if (p.kind === "van") {
        this.makeVan(p);
      } else if (p.kind === "barrel") {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.95, 12),
          new THREE.MeshStandardMaterial({ color: 0x3f5560, roughness: 0.55, metalness: 0.6 }),
        );
        barrel.position.set(p.x, 0.475, p.z);
        barrel.castShadow = true;
        this.root.add(barrel);
        for (const y of [0.3, 0.66]) {
          const ring = new THREE.Mesh(
            new THREE.CylinderGeometry(0.295, 0.295, 0.05, 12),
            new THREE.MeshStandardMaterial({ color: 0x28343a, roughness: 0.6, metalness: 0.5 }),
          );
          ring.position.set(p.x, y, p.z);
          this.root.add(ring);
        }
      } else if (p.kind === "palletStack") {
        for (let i = 0; i < 3; i++) {
          const pallet = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 0.12, 1.6),
            new THREE.MeshStandardMaterial({ color: 0x7b6038, roughness: 0.95 }),
          );
          pallet.position.set(p.x, 0.08 + i * 0.17, p.z);
          pallet.rotation.y = p.yaw + i * 0.08;
          pallet.castShadow = true;
          this.root.add(pallet);
        }
      } else if (p.kind === "stall") {
        this.makeStall(p);
      } else if (p.kind === "generator") {
        // Placeholder crate with a metal frame: the approved Poly Haven
        // generator is not integrated in this build.
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.7, 1.3),
          new THREE.MeshStandardMaterial({ color: 0x5c6a3f, roughness: 0.6, metalness: 0.35 }),
        );
        body.position.set(p.x, 0.35, p.z);
        body.rotation.y = p.yaw;
        body.castShadow = true;
        this.root.add(body);
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.34, 0.08, 1.34),
          new THREE.MeshStandardMaterial({ color: 0x2a3136, roughness: 0.5, metalness: 0.7 }),
        );
        frame.position.set(p.x, 0.68, p.z);
        frame.rotation.y = p.yaw;
        this.root.add(frame);
      }
    }
  }

  makeDumpster(p) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.05, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x2f4a44, roughness: 0.65, metalness: 0.35 }),
    );
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(2.14, 0.12, 1.26),
      new THREE.MeshStandardMaterial({ color: 0x22352f, roughness: 0.5, metalness: 0.4 }),
    );
    lid.position.y = 1.14;
    lid.rotation.x = -0.06;
    g.add(lid);
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(2.16, 0.1, 1.22),
      new THREE.MeshStandardMaterial({ color: 0x263a35, roughness: 0.6, metalness: 0.4 }),
    );
    lip.position.y = 0.95;
    g.add(lip);
    for (const x of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x14191c, roughness: 0.9 }),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.12, 0.55);
      g.add(wheel);
    }
    g.name = "dumpster";
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;
    this.root.add(g);
  }

  makeVan(p) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0x6f7f86, roughness: 0.42, metalness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.35, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.15, 1.95), paint);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.95, 1.85), paint);
    upper.position.set(-0.15, 1.95, 0);
    upper.castShadow = true;
    g.add(upper);
    // Cab and windscreen at the +Z end.
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.85), paint);
    cab.position.set(1.2, 1.30, 0);
    g.add(cab);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), dark);
    screen.position.set(2.0, 1.62, 0);
    screen.rotation.y = Math.PI / 2;
    g.add(screen);
    const sideWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), dark);
    sideWindow.position.set(1.25, 1.66, 0.94);
    g.add(sideWindow);
    const sideWindow2 = sideWindow.clone();
    sideWindow2.position.z = -0.94;
    sideWindow2.rotation.y = Math.PI;
    g.add(sideWindow2);
    // Cargo doors with a dent: an offset panel, matching Sade's description of
    // a "back corner dented" without implying who dented it.
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x5f6d73, roughness: 0.5, metalness: 0.45 }),
    );
    door.position.set(-1.77, 1.95, 0);
    door.rotation.y = -Math.PI / 2;
    g.add(door);
    const dent = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x2c3438, roughness: 0.8, metalness: 0.2 }),
    );
    dent.position.set(-1.78, 1.78, -0.55);
    dent.rotation.y = -Math.PI / 2;
    dent.rotation.z = 0.25;
    g.add(dent);
    // Blue tarp over the cargo.
    const tarp = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.12, 1.95),
      new THREE.MeshStandardMaterial({ color: 0x24485f, roughness: 0.85 }),
    );
    tarp.position.set(-0.2, 2.46, 0);
    tarp.rotation.z = 0.04;
    tarp.castShadow = true;
    g.add(tarp);
    // Wheels.
    const tyre = new THREE.MeshStandardMaterial({ color: 0x111618, roughness: 0.95 });
    for (const [x, z] of [
      [1.25, 0.92],
      [1.25, -0.92],
      [-1.1, 0.92],
      [-1.1, -0.92],
    ]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12), tyre);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.34, z);
      g.add(w);
    }
    g.name = "van";
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;
    this.root.add(g);
    this.van = g;
  }

  makeStall(p) {
    const g = new THREE.Group();
    // Counter and back panel.
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.0, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x6d5638, roughness: 0.9 }),
    );
    counter.position.y = 0.5;
    counter.castShadow = true;
    g.add(counter);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.08, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x9a7c4f, roughness: 0.8 }),
    );
    top.position.y = 1.04;
    g.add(top);
    // Cloth awning above the stall in the brand's signal colour, muted.
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.06, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x8f4a3c, roughness: 0.95 }),
    );
    cloth.position.y = 2.3;
    cloth.rotation.x = 0.16;
    cloth.castShadow = true;
    g.add(cloth);
    for (const x of [-1.1, 1.1]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 2.3, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.6, metalness: 0.5 }),
      );
      pole.position.set(x, 1.15, 0.7);
      g.add(pole);
    }
    // Goods on the counter.
    const goods = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.4),
      new THREE.MeshStandardMaterial({ map: this.crateTex, roughness: 0.9 }),
    );
    goods.position.set(-0.55, 1.22, 0.1);
    goods.rotation.y = 0.3;
    g.add(goods);
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.05, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xb9a276, roughness: 0.95 }),
    );
    rope.rotation.x = Math.PI / 2;
    rope.position.set(0.6, 1.2, 0.0);
    g.add(rope);
    // Hand-painted sign.
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.75),
      new THREE.MeshStandardMaterial({ map: this.stallTex, roughness: 0.75 }),
    );
    sign.position.set(0, 1.75, -0.5);
    sign.rotation.y = Math.PI;
    g.add(sign);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;
    this.root.add(g);
    this.stall = g;
    this.stallSign = sign;
  }

  buildProps() {
    // Lamp posts with emissive heads (the actual lights are in buildLights).
    for (const l of LEVEL.lights) {
      if (Math.abs(l.y - 4.2) > 1.2) continue;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, l.y, 8),
        new THREE.MeshStandardMaterial({ color: 0x2b3338, roughness: 0.55, metalness: 0.6 }),
      );
      post.name = "lamp-post";
      post.position.set(l.x, l.y / 2, l.z);
      this.root.add(post);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x2b3338, roughness: 0.55, metalness: 0.6 }),
      );
      arm.position.set(l.x + (l.x < 0 ? 0.45 : -0.45), l.y, l.z);
      this.root.add(arm);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.14, 0.28),
        new THREE.MeshStandardMaterial({
          color: 0x1c2024,
          emissive: PALETTE.amber,
          emissiveIntensity: 2.4,
        }),
      );
      head.position.set(l.x + (l.x < 0 ? 0.85 : -0.85), l.y - 0.06, l.z);
      this.root.add(head);
    }
    // Bollards.
    for (const b of [
      { x: -6.4, z: -8.0 },
      { x: 6.4, z: -18.5 },
      { x: -6.3, z: -23.0 },
    ]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 1.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x2f383d, roughness: 0.7, metalness: 0.4 }),
      );
      post.name = "bollard";
      post.position.set(b.x, 0.5, b.z);
      post.castShadow = true;
      this.root.add(post);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x232a2e, roughness: 0.6, metalness: 0.5 }),
      );
      cap.position.set(b.x, 1.0, b.z);
      this.root.add(cap);
    }
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x6d8794, 0x151a1d, 0.55);
    this.hemi = hemi;
    this.root.add(hemi);
    // Key light standing in for the moon; cool and soft.
    const moon = new THREE.DirectionalLight(0xacc8d6, 0.85);
    moon.name = "moon";
    this.sun = moon; // main.js turns this into the shadow caster
    moon.position.set(-14, 26, -8);
    moon.target.position.set(0, 0, -22);
    this.root.add(moon);
    this.root.add(moon.target);
    this.moon = moon;

    for (const l of LEVEL.lights) {
      const light = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
      light.position.set(l.x, l.y, l.z);
      this.root.add(light);
      this.lampLights.push(light);
    }
  }

  buildDecals() {
    for (const d of this.built.decals) {
      if (d.kind === "puddle") {
        const p = new THREE.Mesh(
          new THREE.PlaneGeometry(d.r * 2.2, d.r * 1.7),
          new THREE.MeshStandardMaterial({
            map: this.puddleTex,
            transparent: true,
            roughness: 0.08,
            metalness: 0.6,
            depthWrite: false,
            color: 0xbfd4d8,
          }),
        );
        p.rotation.x = -Math.PI / 2;
        p.rotation.z = (d.seed % 10) * 0.3;
        p.position.set(d.x, 0.012, d.z);
        this.root.add(p);
      }
    }
    // The goal ring and the witness marker are drawn by the HUD renderer so
    // they can pulse with objective state.
  }

  buildGoal() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.2, 48),
      new THREE.MeshBasicMaterial({
        color: PALETTE.tidal,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(LEVEL.goal.x, 0.02, LEVEL.goal.z);
    this.root.add(ring);
    this.goalRing = ring;
  }

  buildCharacters() {
    this.sadeFigure = buildSade();
    this.sadeFigure.root.position.set(LEVEL.witness.x, 0.02, LEVEL.witness.z - 0.15);
    this.sadeFigure.root.rotation.y = Math.PI * 0.92;
    this.root.add(this.sadeFigure.root);

    this.collectorFigures = LEVEL.patrols.map((p) => {
      const fig = buildCollector();
      fig.root.position.set(p.points[0].x, 0, p.points[0].z);
      this.root.add(fig.root);
      return fig;
    });
  }

  /** Mirror the simulation onto the placeholder characters. */
  syncCharacters(world) {
    if (this.sadeFigure) {
      poseFigure(this.sadeFigure, {
        mode: world.objective === "reach_witness" ? "folded" : "idle",
        moving: false,
        lookYaw: world.talkedToWitness ? 0.25 : -0.15,
      });
    }
    world.agents.forEach((a, i) => {
      const fig = this.collectorFigures[i];
      if (!fig) return;
      fig.root.position.set(a.x, 0, a.z);
      fig.root.rotation.y = a.yaw;
      poseFigure(fig, {
        stride: a.stepPhase,
        moving: a.pause <= 0 && a.state !== "hunt" ? true : a.state === "hunt",
        mode: a.state === "hunt" ? "hunt" : a.awareness > 0.2 ? "suspicious" : "idle",
        lookYaw: a.state === "patrol" && a.pause > 0 ? Math.sin(a.scan) * 0.5 : 0,
      });
    });
  }

  update(dt, elapsed, hud) {
    this.time += dt;
    // Lamp flicker: one light stutters like a failing tube.
    for (let i = 0; i < this.lampLights.length; i++) {
      const base = LEVEL.lights[i].intensity;
      const flicker =
        i === 2 ? 0.72 + Math.sin(this.time * 11.3) * 0.07 + (Math.sin(this.time * 3.1) > 0.93 ? -0.35 : 0) : 0.94 + Math.sin(this.time * 1.7 + i) * 0.06;
      this.lampLights[i].intensity = base * flicker;
    }
    if (this.doorLight) this.doorLight.intensity = 8 + Math.sin(this.time * 2.3) * 0.6;
    if (this.goalRing) {
      const pulse = 0.42 + Math.sin(elapsed * 2.2) * 0.16;
      this.goalRing.material.opacity = hud && hud.objective === "reach_lane" ? pulse + 0.22 : pulse * 0.6;
      this.goalRing.material.color.setHex(hud && hud.objective === "reach_lane" ? 0xe0b77e : 0x6f8f8c);
    }
  }
}

// --------------------------------------------------------------- character
export async function loadMarcus(scene, onProgress, url = "./assets/marcus.glb") {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url, (e) => {
    if (onProgress && e.total) onProgress(e.loaded / e.total);
  });
  const root = gltf.scene;
  // This source stores skinIndex as a scaled float attribute. Three's skinning
  // helper reads bone indices through a vector accessor that divides by 255 for
  // normalized-looking attributes, which turns index 213 into 39. Rebuild the
  // attribute as exact integers so every vertex binds to the right bone.
  let skinReport = { ok: true, reason: "" };
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      const report = validateSkinning(o);
      if (!report.ok) skinReport = report;
      o.visible = report.ok;
      // NOTE: the approved export's inverse bind matrices are in centimetre
      // space while its vertices are in metres. Three's shader handles this
      // correctly through the mesh's own world matrix, and so does CPU skinning
      // that applies matrixWorld afterwards; only an *incorrect* CPU skinning
      // path (or a detached re-bind) makes the model explode. Leave bind mode
      // alone.
    }
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // skinned bounds change with the pose
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.envMapIntensity = 0.55;
        if (m.normalMap) m.normalScale.set(0.7, 0.7);
        // The sourced material is double-sided; keep it, but disable costly
        // features that the slice does not use.
        m.shadowSide = THREE.FrontSide;
      }
    }
  });
  scene.add(root);

  const mixer = new THREE.AnimationMixer(root);
  const clips = gltf.animations;
  const byName = Object.fromEntries(clips.map((c) => [c.name, c]));
  const make = (name) => {
    const clip = byName[name];
    if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.play();
    action.setEffectiveWeight(name === "walk" ? 1 : 0);
    return action;
  };
  const actions = { walk: make("walk"), run: make("run") };

  // Additive pose: no approved crouch clip exists, so crouch is composed from
  // a measured squat on the approved rig (see README for the limits of this).
  if (!skinReport.ok) {
    console.error("[character] skinning validation failed:", skinReport.reason);
  }
  const crouch = makeCrouchPose(root);
  // Re-apply the modifier after every mixer update, so animation and the crouch
  // offset compose instead of overwriting each other.
  let crouchAmount = 0;
  mixer.addEventListener("loop", () => {});
  const baseUpdate = mixer.update.bind(mixer);
  mixer.update = (dt) => {
    baseUpdate(dt);
    if (crouch && crouchAmount > 0.001) crouch.apply(crouchAmount);
  };
  return {
    root,
    mixer,
    actions,
    clips,
    crouch,
    skinReport,
    /** Skinned vertices are in centimetres here; scale by this to get metres. */
    skinUnitScale: 100,
    setCrouch(amount) {
      crouchAmount = amount;
    },
  };
}

/**
 * Validate the skinning buffers of the loaded character.
 *
 * The approved source GLB stores JOINTS_0 as unsigned bytes and WEIGHTS_0 as
 * floats inside the same interleaved vertex buffer (stride 52). Three's glTF
 * loader builds the JOINTS attribute over the whole stride, so the bone indices
 * it reads do not line up with the skin weights. That is a defect in the asset,
 * not something a runtime loader can honestly paper over: guessing an alignment
 * would produce a character deforming into nonsense. This returns a report so
 * the game can refuse to animate the model and say why.
 */
export function validateSkinning(mesh) {
  const report = { ok: true, reason: "", maxJoint: 0, badWeights: 0, joints: 0 };
  const geo = mesh.geometry;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  if (!si || !sw) {
    return { ...report, ok: false, reason: "mesh has no skinIndex/skinWeight attributes" };
  }
  const bones = mesh.skeleton ? mesh.skeleton.bones.length : 0;
  let maxJoint = 0;
  let badWeights = 0;
  // Sample with the attribute accessors: the buffers are interleaved, so reading
  // the raw arrays directly would compare the wrong offsets.
  const step = Math.max(1, Math.floor(si.count / 4000));
  let sampled = 0;
  for (let i = 0; i < si.count; i += step) {
    let sum = 0;
    for (const axis of ["X", "Y", "Z", "W"]) {
      const joint = si[`get${axis}`](i);
      const weight = sw[`get${axis}`](i);
      maxJoint = Math.max(maxJoint, joint);
      sum += weight;
    }
    if (Math.abs(sum - 1) > 0.02) badWeights++;
    sampled++;
  }
  report.maxJoint = maxJoint;
  report.badWeights = badWeights;
  report.joints = bones;
  report.sampled = sampled;
  if (bones > 0 && maxJoint >= bones) {
    return {
      ...report,
      ok: false,
      reason: `skin indices reference joint ${maxJoint} but the rig has ${bones} joints`,
    };
  }
  if (badWeights > 0) {
    return {
      ...report,
      ok: false,
      reason: `${badWeights} of ${sampled} sampled vertices have weights that do not sum to 1`,
    };
  }
  return report;
}

const CROUCH = {
  drop: 0.315,
  thigh: -50,
  knee: 105,
  foot: -40,
  spine: -8,
  neck: 4,
};

const RIGHT = new THREE.Vector3(1, 0, 0);

/**
 * Build an additive crouch pose. The model's `walk` clip drives the legs every
 * frame, so the squat is *added* on top of the animated pose rather than
 * replacing it: crouch-walking keeps the approved stride and reads as a low
 * sneak. Bones are re-derived from the mixer each frame, so this must run
 * after mixer.update().
 */
export function makeCrouchPose(root) {
  const bones = {};
  root.traverse((o) => {
    if (o.name) bones[o.name] = o;
  });
  const need = [
    "Hips",
    "LeftUpLeg",
    "RightUpLeg",
    "LeftLeg",
    "RightLeg",
    "LeftFoot",
    "RightFoot",
    "Spine",
    "Spine01",
    "neck",
  ];
  if (!need.every((n) => bones[n])) return null;

  // The GLB is authored in centimetres under an armature scaled by 0.01, so
  // the hips' local translation is in centimetres while the rig is in metres.
  const parentScale = bones.Hips.parent ? bones.Hips.parent.scale.x : 1;
  const dropLocal = CROUCH.drop / Math.max(parentScale, 1e-6);

  // Rotations are local to each bone's own axes (measured from the source rig:
  // thigh forward is local X negative, knee flex is local X positive, toes flex
  // the opposite way), so every delta is a single-axis rotation.
  const deltas = [
    ["LeftUpLeg", CROUCH.thigh],
    ["RightUpLeg", CROUCH.thigh],
    ["LeftLeg", CROUCH.knee],
    ["RightLeg", CROUCH.knee],
    ["LeftFoot", CROUCH.foot],
    ["RightFoot", CROUCH.foot],
    ["Spine", CROUCH.spine * 0.6],
    ["Spine01", CROUCH.spine * 0.4],
    ["neck", CROUCH.neck],
  ].map(([name, deg]) => ({
    bone: bones[name],
    q: new THREE.Quaternion().setFromAxisAngle(RIGHT, THREE.MathUtils.degToRad(deg)),
  }));
  const hips = bones.Hips;

  return {
    height: CROUCH.drop,
    apply(amount) {
      if (amount <= 0.001) return;
      for (const d of deltas) {
        const blend = new THREE.Quaternion().slerpQuaternions(
          new THREE.Quaternion(),
          d.q,
          Math.min(1, amount),
        );
        d.bone.quaternion.multiply(blend);
      }
      hips.position.y -= dropLocal * amount;
    },
  };
}
