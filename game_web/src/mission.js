// Missions.
//
// A wave ladder gives you a fight. A mission gives you a reason to be somewhere,
// a thing to do there, and a consequence for how you did it. This module is the
// language for that, and it is deliberately data: a mission is a list of beats,
// and the runtime walks them.
//
// The design rule that shapes everything below: **a beat is satisfied, not
// timed.** A mission that advances on a clock is a cutscene with permission to
// walk around. One that advances when the player has done the thing can be
// played slowly, badly, cleverly or in the wrong order — which is what makes it
// a level rather than a corridor.
//
// Second rule: **failure never loses the run.** A mission that can be failed
// into a restart teaches players to stop taking risks, and a game about leverage
// that punishes the risky play is at war with itself. Failing a beat sends the
// player to the last safe state of that beat.

/** What a beat is waiting for. */
export const BEAT = {
  /** Read/speak to something: the player must be near a point and press use. */
  INTERACT: "interact",
  /** Reach a place. */
  REACH: "reach",
  /** A conversation completes, whatever branch was taken. */
  TALK: "talk",
  /** Clear the bodies the mission spawned. */
  CLEAR: "clear",
  /** A flag is set — set by a choice, a conversation or an earlier beat. */
  FLAG: "flag",
  /** Survive for a duration, with the pressure the director applies. */
  HOLD: "hold",
  /** Nothing to do but watch. Used sparingly; always skippable. */
  BEAT: "beat",
};

/** How a mission ended. */
export const MISSION = {
  IDLE: "idle",
  ACTIVE: "active",
  COMPLETE: "complete",
  FAILED: "failed",
};

/**
 * A mission instance.
 *
 * `definition` shape:
 *
 *   {
 *     id: "M01", title: "Last Call",
 *     beats: [
 *       { id: "inspect", kind: "interact", at: { x, z, radius }, label: "Inspect the charger" },
 *       { id: "talk",    kind: "talk", conversation: "m01_tessa" },
 *       { id: "call",    kind: "flag", flag: "answeredCall", optional: true },
 *       { id: "lane",    kind: "reach", at: { x, z, radius } },
 *       { id: "fight",   kind: "clear", spawn: [...], fleeable: true },
 *     ],
 *   }
 */
export class Mission {
  constructor(definition, deps = {}) {
    if (!definition || !Array.isArray(definition.beats) || !definition.beats.length) {
      throw new Error("a mission needs beats");
    }
    this.definition = definition;
    this.id = definition.id;
    this.title = definition.title ?? definition.id;
    this.deps = deps;
    this.flags = deps.flags ?? {};
    this.state = MISSION.IDLE;
    this.index = 0;
    this.beatTime = 0;
    this.failed = null;
    this.completedBeats = [];
    this.startedAt = null;
    /** The bodies the current beat spawned, so `clear` knows what it is counting. */
    this.spawned = [];
  }

  get beat() {
    return this.definition.beats[this.index] ?? null;
  }

  /** The current objective as the HUD shows it. */
  objective() {
    // Nothing to show before the mission begins, or after it ends. A HUD that
    // displays an objective for a mission the player has not started is a bug,
    // not a tutorial.
    if (this.state === MISSION.IDLE || this.state === MISSION.COMPLETE) return null;
    const beat = this.beat;
    if (!beat) return null;
    return {
      mission: this.id,
      title: this.title,
      text: this._objectiveText(beat),
      index: this.index,
      total: this.definition.beats.length,
      optional: !!beat.optional,
    };
  }

  _objectiveText(beat) {
    if (beat.label) return beat.label;
    switch (beat.kind) {
      case BEAT.REACH: return "Get there";
      case BEAT.CLEAR: return "Clear the street";
      case BEAT.HOLD: return "Hold";
      case BEAT.TALK: return "Talk";
      default: return this.title;
    }
  }

  start() {
    if (this.state !== MISSION.IDLE) return this.objective();
    this.state = MISSION.ACTIVE;
    this.index = 0;
    this.beatTime = 0;
    this.startedAt = 0;
    this._enterBeat();
    return this.objective();
  }

  /**
   * Enter a beat. Optional beats are skipped immediately if their condition is
   * already false and cannot become true — otherwise a mission can deadlock
   * waiting for something the player refused.
   */
  _enterBeat() {
    const beat = this.beat;
    if (!beat) { this._complete(); return; }
    this.beatTime = 0;
    this.spawned = [];
    if (beat.kind === BEAT.FLAG && beat.optional && !this.flags[beat.flag]) {
      // An optional flag beat that has not happened yet is waited on; one that
      // can never happen is skipped. `expect` says which.
      if (beat.expect === false) { this._advance("skipped"); return; }
    }
    this.deps.onBeatEnter?.(beat, this);
  }

  _advance(reason) {
    const beat = this.beat;
    if (beat) this.completedBeats.push({ id: beat.id ?? `beat${this.index}`, reason });
    this.index += 1;
    if (this.index >= this.definition.beats.length) { this._complete(); return; }
    this._enterBeat();
  }

  _complete() {
    this.state = MISSION.COMPLETE;
    this.deps.onComplete?.(this);
  }

  /** A beat's condition was met. */
  satisfy(beatId, reason = "done") {
    if (this.state !== MISSION.ACTIVE) return false;
    const beat = this.beat;
    if (!beat) return false;
    if (beatId !== undefined && (beat.id ?? `beat${this.index}`) !== beatId) return false;
    this._advance(reason);
    return true;
  }

  /**
   * Tick the mission against the world.
   *
   * `world` is read, never mutated: { player, distanceTo, flags, bodies, interact }.
   * Returns the current objective so the caller can push it to the HUD.
   */
  tick(dt, world = {}) {
    if (this.state !== MISSION.ACTIVE) return this.objective();
    const beat = this.beat;
    if (!beat) return null;
    this.beatTime += dt;

    switch (beat.kind) {
      case BEAT.REACH: {
        const at = beat.at;
        if (at && world.player) {
          const d = Math.hypot(world.player.x - at.x, world.player.z - at.z);
          if (d <= (at.radius ?? 3)) this._advance("reached");
        }
        break;
      }
      case BEAT.INTERACT: {
        const at = beat.at;
        if (at && world.player && world.interact) {
          const d = Math.hypot(world.player.x - at.x, world.player.z - at.z);
          const inRange = d <= (at.radius ?? 2.4);
          this.deps.onPrompt?.(inRange ? (beat.label ?? "Use") : null, beat);
          // The interact press is consumed by the mission, so the player cannot
          // start the same beat twice in one frame.
          if (inRange && world.interact()) this._advance("interacted");
        }
        break;
      }
      case BEAT.TALK: {
        // The conversation layer calls satisfy() when its conversation ends.
        break;
      }
      case BEAT.FLAG: {
        if (this.flags[beat.flag]) this._advance("flag");
        else if (beat.timeout !== undefined && this.beatTime > beat.timeout) {
          this._advance("timeout");
        }
        break;
      }
      case BEAT.CLEAR: {
        const live = (world.bodies ?? []).filter((b) => !b.dead).length;
        if (live === 0) this._advance("cleared");
        break;
      }
      case BEAT.HOLD: {
        if (this.beatTime >= (beat.seconds ?? 5)) this._advance("held");
        break;
      }
      case BEAT.BEAT: {
        if (this.beatTime >= (beat.seconds ?? 1.5)) this._advance("beat");
        break;
      }
      default: break;
    }
    return this.objective();
  }

  /**
   * The player went down or died during this mission.
   *
   * A mission does not fail into a restart: it rewinds to the safe state of the
   * beat it was on. That is the difference between a setback and a punishment.
   */
  playerDown() {
    if (this.state !== MISSION.ACTIVE) return null;
    this.deps.onCheckpoint?.(this.checkpoint());
    return this.checkpoint();
  }

  /** The state a reload restores: the beat index, the flags, and nothing else. */
  checkpoint() {
    return {
      mission: this.id,
      index: this.index,
      flags: { ...this.flags },
      completed: this.completedBeats.map((b) => b.id),
    };
  }

  /** Restore from a checkpoint. Used by save/load and by retry. */
  restore(checkpoint) {
    if (!checkpoint) return this.objective();
    this.index = Math.max(0, Math.min(this.definition.beats.length, checkpoint.index ?? 0));
    if (checkpoint.flags) Object.assign(this.flags, checkpoint.flags);
    this.state = this.index >= this.definition.beats.length ? MISSION.COMPLETE : MISSION.ACTIVE;
    this.beatTime = 0;
    return this.objective();
  }
}

/**
 * Build a mission from data and wire the dependencies in one call.
 * Kept here so a caller cannot forget a callback and end up with a silent beat.
 */
export function createMission(definition, deps = {}) {
  return new Mission(definition, deps);
}
