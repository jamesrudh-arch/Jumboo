// HUD for the playable slice. DOM-based on purpose: it keeps the render loop
// free of text layout, and the copy here is the only player-facing wording.
//
// Visual language follows brand/leverage/README.md: Ink #10171D,
// Paper #F0EDE5, Steel #8B9B9B, Tidal #8EBAB6, Amber #E0B77E, Signal #E88771.

const TEMPLATE = `
<div class="lv-frame" aria-hidden="true"></div>
<div class="lv-objective" data-field="objectiveBlock">
  <span class="lv-kicker">Objective</span>
  <span class="lv-objective-label" data-field="objectiveLabel">—</span>
  <span class="lv-objective-distance" data-field="distance">—</span>
</div>
<div class="lv-compass" aria-hidden="true">
  <div class="lv-compass-mark" data-field="bearing"></div>
</div>
<div class="lv-readouts">
  <div class="lv-stamina">
    <span class="lv-label">Wind</span>
    <div class="lv-bar"><i data-field="stamina"></i></div>
  </div>
  <div class="lv-noise">
    <span class="lv-label">Noise</span>
    <div class="lv-noise-pips" data-field="noise"></div>
  </div>
</div>
<div class="lv-stance" data-field="stance">Standing</div>
<div class="lv-weather" data-field="weather">Drizzle</div>
<div class="lv-chaos" data-field="chaos" hidden><span class="lv-label">Chaos</span><span data-field="chaosList"></span></div>
<div class="lv-errand" data-field="errand" hidden>
  <span class="lv-errand-label" data-field="errandLabel"></span>
  <span class="lv-errand-bar"><i data-field="errandBar"></i></span>
  <span class="lv-errand-tally" data-field="errandTally"></span>
</div>
<div class="lv-story" data-field="story" hidden>
  <span class="lv-kicker" data-field="storyAct">Act I</span>
  <span class="lv-story-text" data-field="storyText"></span>
</div>
<div class="lv-subtitle" data-field="subtitle" hidden>
  <span class="lv-speaker" data-field="speaker"></span>
  <p class="lv-line" data-field="line"></p>
  <ol class="lv-choices" data-field="choices"></ol>
</div>
<div class="lv-prompt" data-field="prompt" hidden><span class="lv-key">E</span><span data-field="promptText"></span><i data-field="progress"></i></div>
<div class="lv-suspicion" data-field="suspicion" hidden>
  <div class="lv-suspicion-ring" data-field="ring"></div>
  <span class="lv-label" data-field="suspicionText">Seen</span>
</div>
<div class="lv-timer" data-field="time">0:00</div>
<div class="lv-banner" data-field="banner" hidden>
  <strong data-field="bannerTitle"></strong>
  <span data-field="bannerBody"></span>
</div>
`;

const STYLE = `
.lv-hud { position: fixed; inset: 0; pointer-events: none; color: var(--paper);
  font-family: "Inter", system-ui, sans-serif; }
.lv-hud[hidden] { display: none; }
.lv-frame { position: absolute; inset: 18px; border: 1px solid
  color-mix(in srgb, var(--steel) 30%, transparent); border-radius: 2px; }
.lv-frame::before, .lv-frame::after { content: ""; position: absolute; width: 26px;
  height: 26px; border: 2px solid color-mix(in srgb, var(--amber) 70%, transparent); }
.lv-frame::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.lv-frame::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
.lv-kicker, .lv-label { font-size: 10px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--steel); }
.lv-objective { position: absolute; top: 40px; left: 44px; display: grid; gap: 3px; }
.lv-objective-label { font-size: 17px; letter-spacing: .01em; }
.lv-objective-distance { font-size: 12px; color: var(--tidal); font-variant-numeric: tabular-nums; }
.lv-compass { position: absolute; top: 40px; left: 50%; width: 132px; height: 2px;
  transform: translateX(-50%); background: color-mix(in srgb, var(--steel) 35%, transparent); }
.lv-compass-mark { position: absolute; top: -4px; width: 2px; height: 10px; background: var(--amber);
  transition: transform .08s linear; }
.lv-readouts { position: absolute; left: 44px; bottom: 44px; display: grid; gap: 10px; width: 168px; }
.lv-bar { height: 3px; background: color-mix(in srgb, var(--steel) 30%, transparent); margin-top: 5px; }
.lv-bar i { display: block; height: 100%; background: var(--tidal); transition: width .12s linear; }
.lv-bar i[data-low="1"] { background: var(--signal); }
.lv-noise-pips { display: flex; gap: 3px; margin-top: 6px; height: 8px; }
.lv-noise-pips b { flex: 1; background: color-mix(in srgb, var(--steel) 26%, transparent); }
.lv-noise-pips b[data-on="1"] { background: var(--amber); }
.lv-noise-pips b[data-on="1"][data-loud="1"] { background: var(--signal); }
.lv-stance { position: absolute; right: 44px; bottom: 44px; font-size: 11px;
  letter-spacing: .16em; text-transform: uppercase; color: var(--steel); }
.lv-weather { position: absolute; right: 44px; bottom: 62px; font-size: 10px;
  letter-spacing: .16em; text-transform: uppercase; color: var(--tidal); }
.lv-chaos { position: absolute; right: 44px; bottom: 84px; display: flex; gap: 8px;
  align-items: baseline; font-size: 10px; letter-spacing: .12em; color: var(--amber); }
.lv-chaos[hidden] { display: none; }
.lv-errand { position: absolute; left: 44px; bottom: 88px; display: flex; flex-direction: column;
  gap: 6px; width: 232px; font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--paper); }
.lv-errand[hidden] { display: none; }
.lv-errand-label { color: var(--amber); }
.lv-errand-bar { display: block; height: 2px; background: rgba(240, 237, 229, .18); }
.lv-errand-bar i { display: block; height: 100%; width: 0%; background: var(--amber); }
.lv-errand-tally { color: var(--steel); }
.lv-story { position: absolute; top: 40px; left: 44px; display: grid; gap: 3px; max-width: 40ch; }
.lv-story[hidden] { display: none; }
.lv-kicker { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--tidal); }
.lv-story-text { font-size: 17px; letter-spacing: .01em; }
.lv-subtitle { position: absolute; left: 50%; bottom: 92px; transform: translateX(-50%);
  width: min(64ch, 72vw); display: grid; gap: 6px; padding: 14px 18px;
  background: color-mix(in srgb, var(--ink) 82%, transparent);
  border-left: 2px solid var(--tidal); backdrop-filter: blur(3px); }
.lv-subtitle[hidden] { display: none; }
.lv-speaker { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--amber); }
.lv-speaker:empty { display: none; }
.lv-line { margin: 0; font-size: 16px; line-height: 1.45; }
.lv-line[data-narration="1"] { font-style: italic; color: var(--steel); }
.lv-choices { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 4px; }
.lv-choices:empty { display: none; }
.lv-choices li { font-size: 14px; color: var(--paper); opacity: .78; }
.lv-choices li b { color: var(--tidal); margin-right: 8px; font-weight: 600; }
.lv-choices li[data-selected="1"] { opacity: 1; }
.lv-prompt { position: absolute; left: 50%; bottom: 132px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 9px; padding: 9px 15px;
  background: color-mix(in srgb, var(--ink) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--amber) 45%, transparent); position: absolute; }
.lv-prompt[hidden] { display: none; }
.lv-key { display: grid; place-items: center; width: 20px; height: 20px; font-size: 11px;
  background: var(--amber); color: var(--ink); font-weight: 700; }
.lv-prompt i { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--tidal); }
.lv-suspicion { position: absolute; top: 40px; right: 44px; display: flex; align-items: center;
  gap: 9px; }
.lv-suspicion[hidden] { display: none; }
.lv-suspicion-ring { width: 26px; height: 26px; border-radius: 50%;
  background: conic-gradient(var(--signal) var(--fill, 0deg), color-mix(in srgb, var(--steel) 26%, transparent) 0); }
.lv-timer { position: absolute; right: 44px; top: 76px; font-size: 12px; color: var(--steel);
  font-variant-numeric: tabular-nums; }
.lv-banner { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
  display: grid; gap: 6px; text-align: center; padding: 22px 30px;
  background: color-mix(in srgb, var(--ink) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--steel) 34%, transparent); }
.lv-banner[hidden] { display: none; }
.lv-banner strong { font-size: 20px; letter-spacing: .04em; font-weight: 500; }
.lv-banner span { font-size: 12px; color: var(--steel); max-width: 320px; }
`;

const NOISE_PIPS = 5;

export class Hud {
  constructor(root = document.body) {
    this.el = document.createElement("div");
    this.el.className = "lv-hud";
    this.el.innerHTML = TEMPLATE;
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);
    root.append(this.el);
    this.fields = {};
    for (const node of this.el.querySelectorAll("[data-field]")) {
      this.fields[node.dataset.field] = node;
    }
    this.pips = [];
    for (let i = 0; i < NOISE_PIPS; i++) {
      const pip = document.createElement("b");
      this.fields.noise.append(pip);
      this.pips.push(pip);
    }
    this.banner = { title: "", body: "" };
    this._choiceKey = null;
  }

  get visible() {
    return !this.el.hidden;
  }

  set visible(v) {
    this.el.hidden = !v;
  }

  /** Render one HUD sample. Values come straight from World#hud(). */
  update(hud, extra = {}) {
    const f = this.fields;
    f.objectiveLabel.textContent = hud.objectiveLabel;
    f.distance.textContent = `${hud.distance.toFixed(1)} m`;
    // Compass: bearing is relative to the camera, so 0 = straight ahead.
    const bearing = hud.bearing || 0;
    f.bearing.style.transform = `translateX(${Math.max(-64, Math.min(64, (bearing / Math.PI) * 64)) + 64}px)`;
    const staminaPct = Math.max(0, Math.min(100, hud.stamina));
    f.stamina.style.width = `${staminaPct}%`;
    f.stamina.dataset.low = hud.exhausted || staminaPct < 25 ? "1" : "0";
    // Noise 0..9 (TUNING.noise.run) mapped onto the pips.
    const loud = Math.min(NOISE_PIPS, Math.round((hud.noise / 9) * NOISE_PIPS));
    this.pips.forEach((pip, i) => {
      pip.dataset.on = i < loud ? "1" : "0";
      pip.dataset.loud = hud.noise >= 7 ? "1" : "0";
    });
    f.stance.textContent = hud.crouch > 1.5 ? "Crouched" : hud.running ? "Running" : "Standing";
    f.time.textContent = formatTime(hud.time);
    if (extra.weather) {
      const wetPct = Math.round((extra.wet ?? 0) * 100);
      f.weather.textContent = `${extra.weather} · street ${wetPct}% wet`;
    }
    const errand = hud.errand;
    f.errand.hidden = !errand;
    if (errand) {
      f.errandLabel.textContent = errand.label;
      f.errandBar.style.width = `${Math.round(errand.progress * 100)}%`;
      f.errandTally.textContent = `${hud.errandsDone}/${hud.errandsTotal} street errands · ${hud.errandPoints} pts`;
    }
    const chaosCount = extra.chaos ?? 0;
    f.chaos.hidden = chaosCount <= 0;
    if (chaosCount > 0) {
      // Name the newest event: a bare count tells the player nothing about
      // whether the road ahead is a trap or just noisy.
      const label = extra.chaosLabel || "trouble";
      f.chaosList.textContent = chaosCount > 1 ? `${label} +${chaosCount - 1}` : label;
    }

    const seen = hud.suspicion > 0.02;
    f.suspicion.hidden = !seen;
    if (seen) {
      f.ring.style.setProperty("--fill", `${Math.round(hud.suspicion * 360)}deg`);
      f.suspicionText.textContent = hud.suspicion >= 0.999 ? "Spotted" : "Seen";
    }

    const prompt = extra.prompt || null;
    f.prompt.hidden = !prompt;
    if (prompt) {
      f.promptText.textContent = prompt.text;
      f.progress.style.width = `${Math.round((prompt.progress || 0) * 100)}%`;
    }

    // Story: the mission's objective supersedes the level's when one is running.
    const story = extra.story || null;
    f.story.hidden = !story;
    // A mission's objective replaces the level's: two objectives on screen at once
    // means one of them is pointing the player the wrong way.
    f.objectiveBlock.hidden = !!story;
    f.bearing.parentElement.hidden = !!story;
    if (story) {
      f.storyAct.textContent = story.act ? `Act ${story.act}` : "Objective";
      f.storyText.textContent = story.text;
    }

    // Subtitles. A conversation line owns the bottom of the screen; the choices
    // are numbered so the keyboard mapping is visible rather than memorised.
    const sub = extra.subtitle || null;
    f.subtitle.hidden = !sub;
    if (sub) {
      // An empty speaker is a narration line, and a narration line has nobody
      // saying it — showing a label there would be a lie.
      f.speaker.textContent = sub.speaker || "";
      f.line.textContent = sub.text;
      f.line.dataset.narration = sub.narration ? "1" : "0";
      const wanted = sub.choices ?? [];
      const key = wanted.map((c) => c.text).join("|");
      if (this._choiceKey !== key) {
        this._choiceKey = key;
        f.choices.innerHTML = "";
        wanted.forEach((c, i) => {
          const li = document.createElement("li");
          const n = document.createElement("b");
          n.textContent = String(i + 1);
          li.append(n, document.createTextNode(c.text));
          f.choices.append(li);
        });
      }
    }

    const banner = extra.banner || null;
    f.banner.hidden = !banner;
    if (banner && (banner.title !== this.banner.title || banner.body !== this.banner.body)) {
      this.banner = banner;
      f.bannerTitle.textContent = banner.title;
      f.bannerBody.textContent = banner.body;
    }
  }
}

/** Format seconds as m:ss. */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}
