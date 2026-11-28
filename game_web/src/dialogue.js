// Dialogue.
//
// A line is data: who says it, what they say, what it changes. Everything else —
// subtitles, choices, voice, save state — is derived from that.
//
// Design constraints, all of which come from the narrative document:
//
//  1. **Voice is optional per line.** A line with an `audio` id plays it; a line
//     without one shows text. That means the whole campaign can ship subtitled
//     and gain voice later by adding files, with no code change.
//  2. **Choices carry state, not just flow.** A choice writes flags the mission
//     reads later. "Pressuring Sade" has to be remembered to mean anything.
//  3. **Nothing is consumed silently.** Advancing past a line that requires an
//     answer is refused, because the narrative document is explicit that pausing
//     or skipping must not swallow a required choice.
//  4. **It is a state machine, not a cutscene.** No timers drive it. The player
//     advances it, so a death mid-conversation resumes rather than restarts.

/** Where a conversation is in its life. */
export const DIALOGUE = {
  IDLE: "idle",
  RUNNING: "running",
  AWAITING_CHOICE: "awaiting-choice",
  DONE: "done",
};

/**
 * One conversation.
 *
 * `lines` is an array. A line is either plain narration or a spoken line:
 *
 *   { speaker: "TESSA", text: "You fixed that light yet?" }
 *   { speaker: null, text: "The charger clicks off.", narration: true }
 *   { speaker: "ELI", text: "...", audio: "m01_eli_01" }
 *   { speaker: "MARCUS", text: "Choose", choices: [
 *       { text: "Answer", goto: "answered", flags: { answeredCall: true } },
 *       { text: "Decline", goto: "declined", flags: { declinedCall: true } },
 *     ] }
 *
 * A line may carry `goto` (a label) to jump, `end: true` to finish, or `flags`
 * to set state on arrival.
 */
export class Conversation {
  /**
   * @param {object} script  { id, lines, start? }
   * @param {object} [deps]  { onLine, onChoice, onEnd, flags }
   */
  constructor(script, deps = {}) {
    if (!script || !Array.isArray(script.lines) || !script.lines.length) {
      throw new Error("a conversation needs at least one line");
    }
    this.id = script.id ?? "conversation";
    this.lines = script.lines;
    this.deps = deps;
    // Flags are shared, not copied: a choice made here has to be visible to the
    // mission and to the save file.
    this.flags = deps.flags ?? {};
    this.state = DIALOGUE.IDLE;
    this.index = this._labelIndex(script.start ?? 0);
    this.current = null;
    this.log = [];
  }

  _labelIndex(at) {
    if (typeof at === "number") return Math.max(0, Math.min(this.lines.length, at));
    const i = this.lines.findIndex((l) => l.label === at);
    return i >= 0 ? i : 0;
  }

  /** Begin. Returns the first line, or null if there was nothing to say. */
  begin() {
    if (this.state !== DIALOGUE.IDLE) return this.current;
    this.state = DIALOGUE.RUNNING;
    return this._deliver();
  }

  /** The line currently on screen, as the HUD needs it. */
  view() {
    if (!this.current) return null;
    return {
      id: this.id,
      speaker: this.current.speaker ?? null,
      text: this.current.text ?? "",
      narration: !!this.current.narration,
      audio: this.current.audio ?? null,
      // Choices are shown only while the conversation is actually waiting on one,
      // so a stray keypress cannot pick an option the player never saw.
      choices: this.state === DIALOGUE.AWAITING_CHOICE
        ? (this.current.choices ?? []).map((c) => ({ text: c.text }))
        : [],
      awaiting: this.state === DIALOGUE.AWAITING_CHOICE,
    };
  }

  /** Take the current line's state effects and move to it. */
  _deliver() {
    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line.flags) Object.assign(this.flags, line.flags);
      if (line.effect) this.deps.onEffect?.(line.effect, this.flags);
      // A line that only sets flags and jumps is a label, not something to show.
      if (line.silent) {
        if (line.goto !== undefined) { this.index = this._labelIndex(line.goto); continue; }
        this.index += 1;
        continue;
      }
      this.current = line;
      this.log.push({ speaker: line.speaker ?? null, text: line.text ?? "" });
      this.deps.onLine?.(this.view());
      if (line.choices && line.choices.length) {
        this.state = DIALOGUE.AWAITING_CHOICE;
      } else {
        this.state = DIALOGUE.RUNNING;
      }
      return this.current;
    }
    this._finish();
    return null;
  }

  _finish() {
    this.state = DIALOGUE.DONE;
    this.current = null;
    this.deps.onEnd?.(this.flags);
  }

  /**
   * Advance past a line.
   *
   * Refused while a choice is pending: the player has to answer. Returns the new
   * line, or null when the conversation has ended or the advance was refused.
   */
  advance() {
    if (this.state === DIALOGUE.AWAITING_CHOICE) return null;
    if (this.state !== DIALOGUE.RUNNING) return null;
    const line = this.current;
    if (line?.goto !== undefined) this.index = this._labelIndex(line.goto);
    else this.index += 1;
    if (line?.end) { this._finish(); return null; }
    return this._deliver();
  }

  /**
   * Pick an option. Returns the next line, or null if there was nothing to pick.
   * Applies the choice's flags before delivering, so the mission can react.
   */
  choose(n) {
    if (this.state !== DIALOGUE.AWAITING_CHOICE) return null;
    const choices = this.current?.choices ?? [];
    const choice = choices[n];
    if (!choice) return null;
    if (choice.flags) Object.assign(this.flags, choice.flags);
    this.deps.onChoice?.(n, choice, this.flags);
    this.log.push({ choice: choice.text });
    if (choice.end) { this._finish(); return null; }
    if (choice.goto !== undefined) this.index = this._labelIndex(choice.goto);
    else this.index += 1;
    return this._deliver();
  }

  get done() {
    return this.state === DIALOGUE.DONE;
  }

  get awaiting() {
    return this.state === DIALOGUE.AWAITING_CHOICE;
  }
}

/**
 * Everything said so far, as plain text. Used by the subtitles panel's history
 * and by tests that assert a branch was taken.
 */
export function transcript(conversation) {
  return conversation.log
    .map((entry) => (entry.choice ? `> ${entry.choice}` : `${entry.speaker ?? ""}: ${entry.text}`))
    .join("\n");
}
