// Directional damage.
//
// A sniper forty metres away hits for 55 from off-screen. Today the player sees
// their health drop and has no idea which way to turn. That is not difficulty,
// it is a coin flip — and the sniper already telegraphs with a glint, so the
// failure is in the feedback rather than in the design.
//
// The indicator answers one question: where did that come from, relative to
// where I am looking? That is a bearing, not a vector, because the player can
// only turn.
//
// Bearing convention is the same one the compass and the audio panning use:
// forward is -p.yaw in local space, so a bearing of 0 is straight ahead and
// positive is to the right.

export const DAMAGE_MARK = {
  /** How long a mark stays on screen, in seconds. */
  life: 1.9,
  /** Marks closer than this many degrees merge into one. */
  mergeDegrees: 26,
  /** Above this many simultaneous marks the list is pruned oldest-first. */
  max: 5,
};

/**
 * Bearing from the camera to a world point, in radians, wrapped to -pi..pi.
 * 0 is straight ahead, positive is right, negative is left.
 */
export function bearingTo(from, to, cameraYaw) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  // Forward is (sin yaw, cos yaw); right is (cos yaw, -sin yaw).
  const forward = dx * Math.sin(cameraYaw) + dz * Math.cos(cameraYaw);
  const right = dx * Math.cos(cameraYaw) - dz * Math.sin(cameraYaw);
  // atan2(right, forward) gives 0 dead ahead and +/- pi behind, which is
  // exactly what the indicator needs to rotate by.
  return Math.atan2(right, forward);
}

/** Is the source behind the camera? Used to draw a rear mark differently. */
export function isBehind(bearing) {
  return Math.abs(bearing) > Math.PI * 0.5;
}

/**
 * The marker list. Marks decay, merge and cap, so a machine-gunner landing ten
 * rounds produces one readable arrow rather than ten overlapping ones.
 */
export class DamageMarks {
  constructor(opts = {}) {
    this.cfg = { ...DAMAGE_MARK, ...opts };
    this.marks = [];
  }

  /**
   * Add a hit. `bearing` is from bearingTo(). Returns the mark, which may be a
   * refreshed existing one rather than a new one.
   */
  add(bearing, amount = 1, meta = {}) {
    const mergeRad = (this.cfg.mergeDegrees * Math.PI) / 180;
    for (const m of this.marks) {
      let d = m.bearing - bearing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < mergeRad) {
        // Same source: refresh rather than stack. Keep the older bearing so the
        // arrow does not jitter as the body moves.
        m.life = this.cfg.life;
        m.amount += amount;
        return m;
      }
    }
    const mark = {
      bearing,
      amount,
      life: this.cfg.life,
      born: 0,
      ...meta,
    };
    this.marks.push(mark);
    if (this.marks.length > this.cfg.max) this.marks.shift();
    return mark;
  }

  tick(dt) {
    for (const m of this.marks) {
      m.life -= dt;
      m.born += dt;
    }
    this.marks = this.marks.filter((m) => m.life > 0);
    return this;
  }

  /** What the HUD draws: bearing, opacity and whether it is behind. */
  render() {
    return this.marks.map((m) => ({
      bearing: m.bearing,
      alpha: Math.max(0, Math.min(1, m.life / this.cfg.life)),
      behind: isBehind(m.bearing),
      amount: m.amount,
    }));
  }

  get count() {
    return this.marks.length;
  }

  clear() {
    this.marks = [];
    return this;
  }
}
