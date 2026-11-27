// Character animation for the playable slice.
//
// The approved asset ships exactly two clips, `walk` and `run`. Everything here
// is built from those plus the measured crouch pose in scene.js: there is no
// authored crouch, turn or idle clip, so those states are cross-fades, stride
// time-scaling and a slow sway. Documented limits live in the game README; this
// module claims no more than it can do.

import * as THREE from "three";
import { wrapAngle } from "./geom.js";

const IDLE_SWAY_RATE = 0.18; // walk clip played this slow reads as breathing
const TURN_LEAN = 0.12; // radians of body lean into a hard turn
const BLEND_RATE = 9; // weight follow speed

export class CharacterAnimator {
  /**
   * @param {object} marcus result of loadMarcus()
   * @param {object} level LEVEL definition (needs walkSpeed, runSpeed, clip)
   */
  constructor(marcus, level) {
    this.marcus = marcus;
    this.level = level;
    this.walkAction = marcus.actions.walk || null;
    this.runAction = marcus.actions.run || null;
    this.runWeight = 0;
    this.phase = 0; // accumulated stride phase, used for planted-foot feedback
    this.lean = 0;
    this.crouch = 0;
    if (this.walkAction) {
      this.walkAction.setEffectiveWeight(1);
      this.walkAction.play();
    }
    if (this.runAction) {
      this.runAction.setEffectiveWeight(0);
      this.runAction.play();
    }
  }

  /** Copy the simulation's player state onto the model. */
  sync(player, dt) {
    const root = this.marcus.root;
    root.position.set(player.x, player.feetY, player.z);
    root.rotation.y = player.yaw;

    // Damp crouch rather than snapping: the pose is composed, not a clip.
    this.crouch = THREE.MathUtils.damp(this.crouch, player.crouch, 10, dt);
    this.marcus.setCrouch(this.crouch);

    const L = this.level;
    const speed = Math.abs(player.speed);
    const moving = speed > 0.08;
    const span = Math.max(0.01, L.runSpeed - L.walkSpeed);
    const targetRun = THREE.MathUtils.clamp((speed - L.walkSpeed) / span, 0, 1);
    this.runWeight = THREE.MathUtils.damp(this.runWeight, targetRun, BLEND_RATE, dt);

    if (this.walkAction) this.walkAction.setEffectiveWeight(1 - this.runWeight);
    if (this.runAction) this.runAction.setEffectiveWeight(this.runWeight);

    const nominal = THREE.MathUtils.lerp(L.clip.walk, L.clip.run, this.runWeight);
    // Feet plant when the clip advances at the rate the body actually moves.
    const strideScale = THREE.MathUtils.clamp(speed / Math.max(nominal, 0.01), 0.25, 2.2);
    if (moving) {
      this.phase += dt * strideScale;
      if (this.walkAction) this.walkAction.timeScale = strideScale;
      if (this.runAction) this.runAction.timeScale = strideScale;
    } else {
      // No idle clip exists: the walk clip at 0.18 speed reads as a slow sway
      // instead of a frozen A-pose. Honest placeholder, labelled as such.
      if (this.walkAction) this.walkAction.timeScale = IDLE_SWAY_RATE;
      if (this.runAction) this.runAction.timeScale = IDLE_SWAY_RATE;
    }

    // Lean the body into hard turns so direction changes read.
    const yawDelta = wrapAngle(player.yaw - (this.lastYaw ?? player.yaw));
    this.lastYaw = player.yaw;
    const targetLean = moving ? THREE.MathUtils.clamp((yawDelta / Math.max(dt, 1e-3)) * 0.02, -TURN_LEAN, TURN_LEAN) : 0;
    this.lean = THREE.MathUtils.damp(this.lean, targetLean, 8, dt);
    root.rotation.z = this.lean;
  }

  update(dt) {
    // scene.js overrides mixer.update so the crouch pose is re-applied after
    // every animated frame.
    this.marcus.mixer.update(dt);
  }

  /** Advance both simulation and model in one call, in the right order. */
  step(world, dt) {
    this.sync(world.player, dt);
    this.update(dt);
  }
}
