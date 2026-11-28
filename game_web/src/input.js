// Input mapping that has no DOM in it, so it can be tested.
//
// The keyboard and touch paths live in main.js because they are made of
// listeners. The gamepad path, though, is pure data in / data out — and it was
// the one control scheme that had never been exercised. Pulling it out here
// means a test can hand it a synthetic pad and check the mapping.

/**
 * Deadzone for an analogue axis. Standard gamepads rest a few hundredths off
 * centre, which would otherwise read as a permanent drift.
 */
export function deadzone(v, threshold = 0.18) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.abs(n) < threshold ? 0 : n;
}

/**
 * Map a standard-mapping gamepad onto the game's intent shape and merge it with
 * whatever the keyboard or touch layer already produced.
 *
 * Standard mapping: button 0 = A/cross (interact), 1 = B/circle (crouch),
 * 5/7 = shoulder/trigger (run), 10 = left stick click (crouch). Right stick
 * turns the camera. Analogue movement beats a digital key press when the stick
 * is actually deflected, because the stick is the more deliberate input.
 *
 * Returns `{ intent, look, pause }`, where `look` is the camera delta to apply
 * (null when the right stick is at rest) and `pause` is true while the start
 * button is held. The caller applies both, so this module never needs the
 * camera or the pause menu.
 */
export function applyGamepad(pad, intent = {}) {
  const base = {
    moveX: Number(intent.moveX) || 0,
    moveZ: Number(intent.moveZ) || 0,
    run: !!intent.run,
    crouch: !!intent.crouch,
    interact: !!intent.interact,
  };
  if (!pad || !pad.connected) return { intent: base, look: null, pause: false };

  const axes = pad.axes || [];
  const lx = deadzone(axes[0]);
  const ly = deadzone(axes[1]);
  const rx = deadzone(axes[2]);
  const ry = deadzone(axes[3]);
  const pressed = (i) => !!(pad.buttons && pad.buttons[i] && pad.buttons[i].pressed);

  return {
    intent: {
      moveX: lx || base.moveX,
      // Stick up is negative in the standard mapping; forward is +z here.
      moveZ: ly ? -ly : base.moveZ,
      run: base.run || pressed(5) || pressed(7),
      crouch: base.crouch || pressed(1) || pressed(10),
      interact: base.interact || pressed(0),
    },
    // Right stick: push right to look right, which is a negative yaw change.
    look: rx || ry ? { dx: rx * 0.045, dy: ry * 0.03 } : null,
    // Standard mapping button 9 is Start.
    pause: pressed(9),
  };
}

/** First connected pad out of a `navigator.getGamepads()` result. */
export function firstConnectedPad(list) {
  if (!list) return null;
  for (const p of Array.from(list)) if (p && p.connected) return p;
  return null;
}
