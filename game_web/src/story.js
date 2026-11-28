// The story director.
//
// `Mission` knows what a beat is waiting for. `Conversation` knows what a line is.
// Neither of them knows about the street, the camera or the keyboard — and that is
// deliberate, because a mission that imports the renderer cannot be tested.
//
// This is the seam. It owns the three things a mission needs from a running game:
//
//   1. **a tick** — feed the mission the world every frame and let it decide;
//   2. **an interact press** — decide whether E goes to a conversation, an
//      objective, or nothing at all;
//   3. **a subtitle** — turn a conversation into the small amount of text a HUD
//      can draw, one line at a time, at a readable pace.
//
// The pacing rule matters as much as the logic. A conversation that dumps five
// lines on screen at once is a wall of text; one that waits for a keypress per
// line is a hostage situation. So lines advance themselves after a duration that
// scales with their length, the player can skip ahead with the same key that
// starts a conversation, and a choice stops the clock because a choice is the
// player's turn to speak.

import { Conversation as ConversationRuntime } from "./dialogue.js";

/** How long a line stays up, given its length. Reading speed, not drama. */
export function lineSeconds(text, { min = 1.6, perCharacter = 0.045, max = 6 } = {}) {
  const chars = (text ?? "").length;
  return Math.max(min, Math.min(max, min + chars * perCharacter));
}

/**
 * Drives one mission inside the running game.
 *
 * Constructed with the mission and the conversation scripts it can start. Every
 * dependency that touches the browser is injected, so this class runs in a test.
 */
export class StoryDirector {
  constructor({
    mission,
    conversations = {},
    flags = {},
    onSubtitle = null,
    onObjective = null,
    onMissionEnd = null,
    /** Called with a place id when the mission wants bodies: (beat) => bodies[]. */
    spawnBeat = null,
    /** How many bodies from the current beat are still alive. */
    liveBodies = null,
  } = {}) {
    if (!mission) throw new Error("a story director needs a mission");
    this.mission = mission;
    this.conversations = conversations;
    this.flags = flags;
    this.onSubtitle = onSubtitle;
    this.onObjective = onObjective;
    this.onMissionEnd = onMissionEnd;
    this.spawnBeat = spawnBeat;
    this.liveBodies = liveBodies;

    /** The running conversation, if any. */
    this.conversation = null;
    this.lineTimer = 0;
    this.lineDuration = 0;
    /** Set for one tick when E was pressed. Consumed by `interact()`. */
    this.interactRequested = false;
    /** The beat id whose conversation has already been played. */
    this.played = new Set();
    this.finished = false;
    this._lastObjectiveKey = null;
  }

  /** Begin the mission. */
  start() {
    this.mission.start();
    this._announceObjective();
    return this.mission.objective();
  }

  get subtitle() {
    if (!this.conversation) return null;
    return this.conversation.view();
  }

  get talking() {
    return !!this.conversation;
  }

  /**
   * E was pressed. Returns true if something consumed it, so the caller knows not
   * to forward the press to a mundane interaction.
   */
  press() {
    this.interactRequested = true;
    return true;
  }

  /**
   * Advance the story. `world` is the mission's world plus whatever the caller
   * can tell us: the bodies the beat spawned, and whether bodies are still alive.
   */
  tick(dt, world = {}) {
    // A conversation owns the screen while it is up. The mission does not advance
    // underneath it — otherwise a beat could complete mid-sentence and the
    // objective would change under the player's eyes.
    if (this.conversation) return this._tickConversation(dt);

    const press = this.interactRequested;
    this.interactRequested = false;

    const result = this.mission.tick(dt, {
      ...world,
      interact: press ? () => true : null,
      bodies: this.liveBodies ? this.liveBodies() : (world.bodies ?? []),
    });

    this._announceObjective();

    if (this.mission.state === "complete" && !this.finished) {
      this.finished = true;
      this.onSubtitle?.(null);
      this.onMissionEnd?.(this.mission, this.flags);
    }

    // A beat that just became current and needs bodies asks for them exactly once.
    const beat = this.mission.beat;
    if (beat && beat.spawn && !this.played.has(`spawn:${beat.id}`)) {
      this.played.add(`spawn:${beat.id}`);
      this.spawnBeat?.(beat);
    }

    // The beats that are conversations start themselves on arrival: the player
    // walked there, so making them press E again is a second lock on one door.
    if (beat && beat.kind === "talk" && !this.played.has(beat.id) && this._near(beat, world)) {
      this._startConversation(beat);
    }

    return result;
  }

  _near(beat, world) {
    const at = beat.at;
    if (!at || !world.player) return true;
    const d = Math.hypot(world.player.x - at.x, world.player.z - at.z);
    return d <= (at.radius ?? 3.2);
  }

  _startConversation(beat) {
    const script = this.conversations[beat.conversation];
    if (!script) {
      // A beat that names a conversation which does not exist is a content bug.
      // Satisfy it rather than deadlocking the mission on a typo.
      this.played.add(beat.id);
      this.mission.satisfy(beat.id, "missing-script");
      this.onObjective?.(this.mission.objective());
      return;
    }
    this.played.add(beat.id);
    this.conversation = new ConversationRuntime(script, {
      // Flags are shared with the mission, so a choice here is visible to the
      // save file and to every beat that tests it.
      flags: this.flags,
      onLine: (view) => {
        this.onSubtitle?.(view);
        this.lineDuration = lineSeconds(view.text);
        this.lineTimer = 0;
      },
      onEnd: () => {
        const beatId = this._beatForConversation(script.id);
        this.conversation = null;
        this.onSubtitle?.(null);
        if (beatId) this.mission.satisfy(beatId, "talked");
        this.onObjective?.(this.mission.objective());
        this._checkEnd();
      },
      onChoice: (n, choice) => {
        this.onSubtitle?.(this.conversation?.view() ?? null);
      },
    });
    this.conversation.begin();
  }

  _beatForConversation(conversationId) {
    return this.mission.definition.beats.find((b) => b.conversation === conversationId)?.id ?? null;
  }

  _tickConversation(dt) {
    const conv = this.conversation;
    if (!conv) return this.mission.objective();

    // An interact press either answers the pending choice or skips the line.
    if (this.interactRequested) {
      this.interactRequested = false;
      if (conv.awaiting) return this.mission.objective();
      conv.advance();
      return this.mission.objective();
    }

    if (conv.awaiting) return this.mission.objective();

    this.lineTimer += dt;
    if (this.lineTimer >= this.lineDuration) conv.advance();
    return this.mission.objective();
  }

  /** Pick a choice by index, from the keyboard or the HUD. */
  choose(index) {
    if (!this.conversation?.awaiting) return false;
    this.conversation.choose(index);
    return true;
  }

  _announceObjective() {
    const obj = this.mission.objective();
    const key = obj ? `${obj.index}:${obj.text}` : null;
    if (key !== this._lastObjectiveKey) {
      this._lastObjectiveKey = key;
      this.onObjective?.(obj);
    }
  }

  _checkEnd() {
    if (this.mission.state === "complete" && !this.finished) {
      this.finished = true;
      this.onMissionEnd?.(this.mission, this.flags);
    }
  }

  /** The player died. Rewind to the start of the beat rather than the mission. */
  rewind() {
    this.conversation = null;
    this.onSubtitle?.(null);
    // playerDown() emits the checkpoint and hands back the safe state of the beat
    // the player was on. Restoring it keeps the progress they earned: a death
    // costs the fight, never the mission.
    const safe = this.mission.playerDown();
    if (safe) this.mission.restore(safe);
    this._announceObjective();
    return this.mission.objective();
  }
}

