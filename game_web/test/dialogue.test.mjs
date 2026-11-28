// Dialogue tests. The narrative document makes specific promises about choices
// and about not swallowing them; these hold those promises.

import test from "node:test";
import assert from "node:assert/strict";
import { Conversation, DIALOGUE, transcript } from "../src/dialogue.js";

const script = () => ({
  id: "m01",
  lines: [
    { speaker: null, text: "The charger clicks off.", narration: true },
    { speaker: "TESSA", text: "You fixed that light yet?" },
    { speaker: "MARCUS", text: "It works when it wants to." },
    {
      speaker: "MARCUS", text: "The phone is ringing.",
      choices: [
        { text: "Answer", goto: "answered", flags: { answeredCall: true } },
        { text: "Decline", goto: "declined", flags: { declinedCall: true } },
      ],
    },
    { label: "answered", speaker: "ELI", text: "You still owe me for the window." },
    { speaker: "ELI", text: "Somebody in this family has to keep accounts.", goto: "end" },
    { label: "declined", speaker: null, text: "The phone stops.", narration: true, goto: "end" },
    { label: "end", silent: true, end: true },
  ],
});

test("a conversation starts idle and delivers its first line", () => {
  const c = new Conversation(script());
  assert.equal(c.state, DIALOGUE.IDLE);
  const line = c.begin();
  assert.equal(line.text, "The charger clicks off.");
  assert.equal(c.state, DIALOGUE.RUNNING);
});

test("narration has no speaker and is marked as narration", () => {
  const c = new Conversation(script());
  c.begin();
  const v = c.view();
  assert.equal(v.speaker, null);
  assert.equal(v.narration, true);
});

test("speaker and text reach the HUD view", () => {
  const c = new Conversation(script());
  c.begin();
  c.advance();
  const v = c.view();
  assert.equal(v.speaker, "TESSA");
  assert.equal(v.text, "You fixed that light yet?");
});

test("a choice line stops the conversation and waits", () => {
  const c = new Conversation(script());
  c.begin();
  c.advance(); c.advance(); c.advance();
  assert.equal(c.state, DIALOGUE.AWAITING_CHOICE);
  assert.equal(c.view().choices.length, 2);
  assert.match(c.view().choices[0].text, /Answer/);
});

test("you cannot advance past a required choice — the document is explicit", () => {
  const c = new Conversation(script());
  c.begin(); c.advance(); c.advance(); c.advance();
  assert.equal(c.advance(), null, "pressing on does not skip the question");
  assert.equal(c.state, DIALOGUE.AWAITING_CHOICE, "and the question is still there");
});

test("choices are shown only while awaiting, so a stray key cannot pick unseen options", () => {
  const c = new Conversation(script());
  c.begin();
  assert.deepEqual(c.view().choices, [], "no choices while reading a line");
});

test("answering takes the branch and sets the flag", () => {
  const flags = {};
  const c = new Conversation(script(), { flags });
  c.begin(); c.advance(); c.advance(); c.advance();
  const next = c.choose(0);
  assert.equal(next.text, "You still owe me for the window.");
  assert.equal(flags.answeredCall, true);
  assert.equal(flags.declinedCall, undefined, "the other branch did not run");
});

test("declining takes the other branch and sets the other flag", () => {
  const flags = {};
  const c = new Conversation(script(), { flags });
  c.begin(); c.advance(); c.advance(); c.advance();
  c.choose(1);
  assert.equal(flags.declinedCall, true);
  assert.equal(flags.answeredCall, undefined);
});

test("both branches end the conversation cleanly", () => {
  for (const pick of [0, 1]) {
    const c = new Conversation(script());
    c.begin(); c.advance(); c.advance(); c.advance();
    c.choose(pick);
    for (let i = 0; i < 20 && !c.done; i++) c.advance();
    assert.ok(c.done, `branch ${pick} finished`);
    assert.equal(c.view(), null, "nothing left on screen");
  }
});

test("a choice that jumps to the end really ends", () => {
  const c = new Conversation({
    id: "t",
    lines: [
      { speaker: "A", text: "Well?", choices: [{ text: "Go", goto: "end" }] },
      { speaker: "A", text: "unreachable" },
      { label: "end", silent: true, end: true },
    ],
  });
  c.begin();
  c.choose(0);
  assert.ok(c.done);
});

test("a silent label line is never shown", () => {
  const seen = [];
  const c = new Conversation(script(), { onLine: (v) => seen.push(v.text) });
  c.begin();
  for (let i = 0; i < 40 && !c.done && !c.awaiting; i++) c.advance();
  if (c.awaiting) c.choose(1);
  for (let i = 0; i < 40 && !c.done; i++) c.advance();
  assert.ok(!seen.includes(""), "no blank line was delivered");
  assert.ok(!seen.some((t) => t === undefined));
});

test("onEnd fires exactly once with the flags", () => {
  let ends = 0; let finalFlags = null;
  const c = new Conversation(script(), {
    onEnd: (f) => { ends += 1; finalFlags = f; },
  });
  c.begin(); c.advance(); c.advance(); c.advance(); c.choose(1);
  for (let i = 0; i < 20 && !c.done; i++) c.advance();
  assert.equal(ends, 1);
  assert.equal(finalFlags.declinedCall, true);
});

test("the transcript records what was said and chosen", () => {
  const c = new Conversation(script());
  c.begin(); c.advance(); c.advance(); c.advance(); c.choose(0);
  const t = transcript(c);
  assert.match(t, /TESSA: You fixed that light yet\?/);
  assert.match(t, /> Answer/);
});

test("a conversation with no lines is rejected loudly", () => {
  assert.throws(() => new Conversation({ id: "x", lines: [] }), /at least one line/);
  assert.throws(() => new Conversation(null), /at least one line/);
});

test("choosing out of order is refused", () => {
  const c = new Conversation(script());
  c.begin();
  assert.equal(c.choose(0), null, "no choice is pending yet");
});

test("an out-of-range choice is refused rather than crashing", () => {
  const c = new Conversation(script());
  c.begin(); c.advance(); c.advance(); c.advance();
  assert.equal(c.choose(9), null);
  assert.equal(c.state, DIALOGUE.AWAITING_CHOICE, "still waiting");
});

test("starting twice does not restart or duplicate", () => {
  const c = new Conversation(script());
  const first = c.begin();
  const second = c.begin();
  assert.equal(second, first, "same line, not a new beginning");
});
