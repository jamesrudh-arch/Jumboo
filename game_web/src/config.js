// Hardware tiers.
//
// The slice has to run on phones, so every expensive thing is gated here rather
// than scattered through the renderer: shadow casters, instance counts, rain
// density, draw distance and pixel ratio all come from one tier object.
//
// Detection is deliberately conservative: a device that reports fewer cores, no
// pointer precision and a small screen is treated as a phone even if its
// user-agent lies.

export const TIERS = {
  phone: {
    name: "phone",
    pixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    propShadowCasters: false,
    rain: 900,
    fogNear: 26,
    fogFar: 120,
    drawDistance: 150,
    buildings: 58,
    treeCount: 120,
    streetLampLightBudget: 2,
    waterDetail: 0,
    reflections: false,
    traffic: 6,
    crowd: 8,
    anisotropy: 1,
    antialias: false,
  },
  laptop: {
    name: "laptop",
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    propShadowCasters: false,
    rain: 1800,
    fogNear: 30,
    fogFar: 160,
    drawDistance: 220,
    buildings: 84,
    treeCount: 200,
    streetLampLightBudget: 4,
    waterDetail: 1,
    reflections: false,
    traffic: 10,
    crowd: 14,
    anisotropy: 2,
    antialias: true,
  },
  desktop: {
    name: "desktop",
    pixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    propShadowCasters: true,
    rain: 3200,
    fogNear: 34,
    fogFar: 190,
    drawDistance: 260,
    buildings: 104,
    treeCount: 280,
    streetLampLightBudget: 6,
    waterDetail: 2,
    reflections: true,
    traffic: 14,
    crowd: 20,
    anisotropy: 4,
    antialias: true,
  },
};

/** Pick a tier from a navigator-like object. Pure, so it can be tested. */
export function detectTier(nav = {}) {
  if (nav.forceTier && TIERS[nav.forceTier]) return TIERS[nav.forceTier];

  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  const coarse = !!(nav.maxTouchPoints && nav.maxTouchPoints > 0 && !nav.pointerFine);
  const ua = String(nav.userAgent || "");
  const phoneUa = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
  const smallScreen = (nav.screenWidth || 1280) < 820;

  if (coarse || phoneUa || (smallScreen && cores <= 6)) return TIERS.phone;
  if (cores >= 8 && mem >= 8 && (nav.screenWidth || 1280) >= 1440) return TIERS.desktop;
  return TIERS.laptop;
}

/** Read the real environment. Kept separate so tests can pass plain objects. */
export function detectTierFromWindow(win = globalThis) {
  if (typeof win === "undefined" || !win.navigator) return TIERS.laptop;
  return detectTier({
    userAgent: win.navigator.userAgent,
    hardwareConcurrency: win.navigator.hardwareConcurrency,
    deviceMemory: win.navigator.deviceMemory,
    maxTouchPoints: win.navigator.maxTouchPoints,
    screenWidth: win.screen ? win.screen.width : undefined,
    pointerFine: win.matchMedia ? win.matchMedia("(pointer: fine)").matches : true,
  });
}
