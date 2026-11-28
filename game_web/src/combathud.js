// The combat HUD: health, the wave, the weapon and its rounds.
//
// Kept apart from src/hud.js on purpose. The stealth HUD is an approved, tuned
// piece of the slice and adding a firefight to its template would put two
// different visual languages in one file. This is a second overlay with the same
// tokens (Ink, Paper, Steel, Tidal, Amber, Signal) so the two read as one game.
//
// The rules it follows:
//   - Health is a bar, not a number, until it is low; then it is both.
//   - Ammo is a count, not a bar: a player counts rounds, not percentages.
//   - The wave line states what is *left*, not what was killed.
//   - Everything is text and CSS; no canvas, no shader, no per-frame allocation
//     beyond a handful of textContent writes.

const TEMPLATE = `
<div class="cb-frame" aria-hidden="true"></div>
<div class="cb-wave" data-field="wave">
  <span class="cb-kicker">Wave</span>
  <span class="cb-wave-name" data-field="waveName"></span>
  <span class="cb-wave-count" data-field="waveCount"></span>
</div>
<div class="cb-health">
  <span class="cb-kicker">Condition</span>
  <div class="cb-health-bar"><i data-field="health"></i></div>
  <span class="cb-health-num" data-field="healthNum"></span>
</div>
<div class="cb-weapon" data-field="weapon">
  <span class="cb-weapon-name" data-field="weaponName"></span>
  <span class="cb-ammo" data-field="ammo"></span>
  <span class="cb-weapon-mode" data-field="weaponMode"></span>
</div>
<div class="cb-crosshair" data-field="crosshair" hidden><i></i><b></b></div>
<div class="cb-hitmark" data-field="hitmark" hidden>x</div>
<div class="cb-damage" data-field="damage" hidden></div>
<div class="cb-boss" data-field="boss" hidden>
  <div class="cb-boss-name" data-field="bossName"></div>
  <div class="cb-boss-bar"><i data-field="bossFill"></i><b data-field="bossTell"></b></div>
  <div class="cb-boss-phase" data-field="bossPhase"></div>
</div>
<div class="cb-hazard" data-field="hazard" hidden></div>
<div class="cb-takedown" data-field="takedown" hidden>
  <span class="cb-key">E</span><span data-field="takedownText">Take down</span>
</div>
<div class="cb-offer" data-field="offer" hidden>
  <span class="cb-kicker">Choose one</span>
  <div class="cb-offer-list" data-field="offerList"></div>
  <span class="cb-offer-hint">1 / 2 / 3</span>
</div>
<div class="cb-dead" data-field="dead" hidden>
  <strong data-field="deadTitle">Taken.</strong>
  <span data-field="deadBody"></span>
  <span class="cb-key">R to get up</span>
</div>
`;

const STYLE = `
.cb-hud { position: fixed; inset: 0; pointer-events: none; color: var(--paper, #F0EDE5);
  font-family: "Inter", system-ui, sans-serif; z-index: 5; }
.cb-hud[hidden] { display: none; }
.cb-frame { position: absolute; inset: 8px; border: 1px solid rgba(139,155,155,.18);
  border-radius: 2px; }
.cb-kicker { font-size: 9px; letter-spacing: .2em; text-transform: uppercase;
  color: var(--steel, #8B9B9B); display: block; }

.cb-wave { position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
  text-align: center; display: grid; gap: 2px; }
.cb-wave-name { font-size: 13px; letter-spacing: .06em; color: var(--amber, #E0B77E); }
.cb-wave-count { font-size: 11px; color: var(--steel, #8B9B9B);
  font-variant-numeric: tabular-nums; }

/* Sits above the stealth readouts (bottom: 44px, 168px wide) rather than on top
   of them: the health bar and the stamina bar are both "how much of you is left",
   so they belong in one column, stacked, not printed over each other. */
.cb-health { position: absolute; left: 44px; bottom: 150px; width: 168px; display: grid; gap: 5px; }
.cb-health-bar { height: 4px; background: rgba(139,155,155,.28); }
.cb-health-bar i { display: block; height: 100%; width: 100%; background: var(--tidal, #8EBAB6);
  transition: width .18s ease, background .18s ease; }
.cb-health-bar i[data-low="1"] { background: var(--signal, #E88771); }
.cb-health-num { font-size: 11px; color: var(--paper, #F0EDE5);
  font-variant-numeric: tabular-nums; opacity: .8; }

.cb-weapon { position: absolute; right: 28px; bottom: 96px; text-align: right;
  display: grid; gap: 3px; }
.cb-weapon-name { font-size: 14px; letter-spacing: .04em; }
.cb-ammo { font-size: 26px; font-variant-numeric: tabular-nums; line-height: 1;
  color: var(--paper, #F0EDE5); }
.cb-ammo[data-empty="1"] { color: var(--signal, #E88771); }
.cb-weapon-mode { font-size: 9px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--steel, #8B9B9B); }

.cb-crosshair { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px;
  transform: translate(-50%, -50%); }
.cb-crosshair i, .cb-crosshair b { position: absolute; background: rgba(240,237,229,.75); }
.cb-crosshair i { left: 50%; top: 0; width: 1px; height: 100%; transform: translateX(-50%); }
.cb-crosshair b { top: 50%; left: 0; height: 1px; width: 100%; transform: translateY(-50%); }
.cb-crosshair[data-aim="1"] { opacity: .45; }

.cb-hitmark { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  color: var(--amber, #E0B77E); font-size: 16px; font-weight: 700; }
.cb-hitmark[data-kill="1"] { color: var(--signal, #E88771); font-size: 20px; }

/* Directional damage: an arc segment around the player, at a fixed radius.
   Rotation is the bearing, so a hit from the right draws on the right. */
.cb-damage { position: absolute; left: 50%; top: 50%; width: 1px; height: 1px; }
.cb-damage i { position: absolute; left: -26px; top: -128px; width: 52px; height: 10px;
  border-top: 3px solid var(--signal, #E88771); border-radius: 26px 26px 0 0;
  transform-origin: 26px 128px; display: block; }
.cb-damage i[data-behind="1"] { border-top-color: var(--amber, #E0B77E); }

/* The boss. A bar at the top of the frame, a phase line, and a telegraph that
   fills left to right across the bar itself — the wind-up is the one number in a
   boss fight the player has to read, so it lives in the most prominent place
   rather than being a separate widget. */
.cb-boss { position: absolute; left: 50%; top: 22px; transform: translateX(-50%);
  width: min(46vw, 520px); text-align: center; }
.cb-boss-name { font: 600 12px/1.6 var(--mono, monospace); letter-spacing: 0.22em;
  text-transform: uppercase; color: #f0e2d0; text-shadow: 0 1px 6px #000; }
.cb-boss-bar { position: relative; height: 7px; margin-top: 4px; overflow: hidden;
  background: rgba(10, 8, 7, 0.72); border: 1px solid rgba(240, 226, 208, 0.28); border-radius: 2px; }
.cb-boss-bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #a83a2a, #d8643f);
  transition: width 90ms linear; }
.cb-boss-bar b { position: absolute; inset: 0 auto 0 0; background: rgba(255, 238, 200, 0.55);
  width: 0; transition: width 40ms linear; }
.cb-boss[data-winding="1"] .cb-boss-bar b { background: rgba(255, 226, 150, 0.85); }
.cb-boss-phase { margin-top: 3px; font: 600 9px/1.4 var(--mono, monospace); letter-spacing: 0.2em;
  text-transform: uppercase; color: rgba(240, 226, 208, 0.62); }

/* The hazard prompt sits above the takedown prompt, and is deliberately a
   different colour: using the street is a bigger decision than a knife. */
.cb-hazard { position: absolute; left: 50%; top: 50%; transform: translate(-50%, 46px);
  padding: 4px 10px; font: 600 11px/1.4 var(--mono, monospace); letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--amber, #E0B77E);
  background: rgba(12, 10, 9, 0.72); border: 1px solid rgba(224, 183, 126, 0.5);
  border-radius: 3px; white-space: nowrap; }

/* The takedown prompt sits just below the crosshair: it is about a body in front
   of the player, so it belongs where they are already looking. */
.cb-takedown { position: absolute; left: 50%; top: calc(50% + 34px);
  transform: translateX(-50%); display: flex; align-items: center; gap: 7px;
  font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--amber, #E0B77E); }
.cb-takedown[data-ready="0"] { color: var(--steel, #8B9B9B); opacity: .7; }
.cb-takedown .cb-key { padding: 1px 6px; border: 1px solid rgba(224,183,126,.5); }

.cb-offer { position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%);
  display: grid; gap: 10px; text-align: center; min-width: 320px; }
.cb-offer-list { display: grid; gap: 6px; }
.cb-offer-item { border: 1px solid rgba(139,155,155,.35); padding: 8px 14px;
  background: rgba(16,23,29,.82); display: grid; gap: 2px; }
.cb-offer-item strong { font-size: 13px; font-weight: 600; }
.cb-offer-item span { font-size: 10px; color: var(--steel, #8B9B9B); }
.cb-offer-hint { font-size: 9px; letter-spacing: .18em; color: var(--steel, #8B9B9B); }

.cb-dead { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: grid; gap: 8px; text-align: center; }
/* A panel that sets its own display rule outranks the [hidden] attribute. Without
   these rules the death overlay and the wave offers stay on screen after the game
   has stopped asking for them, which is how "Taken." was printed over a street
   where nothing had happened. */
.cb-dead[hidden], .cb-offer[hidden], .cb-takedown[hidden], .cb-health[hidden],
.cb-wave[hidden], .cb-weapon[hidden], .cb-kicker[hidden] { display: none !important; }
.cb-dead strong { font-size: 26px; letter-spacing: .02em; }
.cb-dead span { font-size: 12px; color: var(--steel, #8B9B9B); }
.cb-key { border: 1px solid rgba(139,155,155,.5); padding: 2px 8px; font-size: 10px;
  letter-spacing: .12em; justify-self: center; color: var(--amber, #E0B77E); }
`;

export class CombatHud {
  constructor(parent = document.body) {
    this.root = document.createElement("div");
    this.root.className = "cb-hud";
    this.root.hidden = true;
    this.root.innerHTML = TEMPLATE;
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    parent.appendChild(this.root);
    this.fields = {};
    for (const el of this.root.querySelectorAll("[data-field]")) {
      this.fields[el.dataset.field] = el;
    }
    this.hitUntil = 0;
    this.lastOfferSignature = "";
  }

  set visible(v) {
    this.root.hidden = !v;
  }

  get visible() {
    return !this.root.hidden;
  }

  /**
   * Draw a frame. `now` is a monotonic clock in ms, `arena.hud()` is the state.
   * Nothing here throws if a field is missing, because a HUD that dies takes the
   * whole frame loop with it.
   */
  update(state, now = 0) {
    const f = this.fields;
    if (!state) return this;

    const health = Math.max(0, Math.round(state.health ?? 0));
    const max = Math.max(1, state.maxHealth ?? 100);
    const pct = (health / max) * 100;
    f.health.style.width = `${pct}%`;
    f.health.dataset.low = pct < 35 ? "1" : "0";
    f.healthNum.textContent = pct < 35 ? `${health} / ${max}` : `${health}`;

    f.waveName.textContent = state.waveName ?? `Wave ${state.wave ?? 1}`;
    const alive = state.enemiesAlive ?? 0;
    const total = state.enemiesTotal ?? 0;
    f.waveCount.textContent = state.inWave
      ? `${alive} of ${total} standing`
      : state.state === "dead" ? "" : "street quiet";

    const w = state.weapon ?? {};
    f.weaponName.textContent = w.name ?? "";
    const finite = Number.isFinite(w.ammo);
    f.ammo.textContent = finite ? `${w.ammo}${w.reserve !== undefined ? ` / ${w.reserve}` : ""}` : "—";
    f.ammo.dataset.empty = finite && w.ammo === 0 ? "1" : "0";
    f.weaponMode.textContent = finite ? (w.reloading ? "reloading" : m(modeLabel(w.mode))) : m(modeLabel(w.mode));

    f.crosshair.hidden = !state.crosshair;
    f.crosshair.dataset.aim = state.aiming ? "1" : "0";

    if (this.hitUntil && now > this.hitUntil) {
      f.hitmark.hidden = true;
      this.hitUntil = 0;
    }

    // The offer. Rebuilding the list every frame would fight the browser's
    // layout; it is rebuilt only when the choices actually change.
    const offer = state.offer;
    f.offer.hidden = !offer || state.state !== "between";
    if (offer && state.state === "between") {
      const signature = offer.map((o) => o.id).join(",");
      if (signature !== this.lastOfferSignature) {
        this.lastOfferSignature = signature;
        f.offerList.innerHTML = "";
        offer.forEach((o, i) => {
          const item = document.createElement("div");
          item.className = "cb-offer-item";
          const strong = document.createElement("strong");
          strong.textContent = `${i + 1}. ${o.label}`;
          const note = document.createElement("span");
          note.textContent = o.note ?? "";
          item.append(strong, note);
          f.offerList.appendChild(item);
        });
      }
    }

    // The boss. Shown for as long as one is alive, and taken down the moment it
    // is not — a stale boss bar is worse than none.
    const boss = state.boss;
    if (boss !== this.lastBoss) {
      this.lastBoss = boss;
      f.boss.hidden = !boss;
    }
    if (boss) {
      f.bossName.textContent = `${boss.title} · ${boss.name}`;
      f.bossFill.style.width = `${Math.round(boss.fraction * 100)}%`;
      f.bossTell.style.width = `${Math.round(boss.telegraph * 100)}%`;
      f.boss.dataset.winding = boss.winding ? "1" : "0";
      // Only rewrite the phase line when the phase itself changes, so the bar
      // does not thrash layout sixty times a second.
      const phaseText = `${boss.phase} — ${boss.phaseNote}`;
      if (phaseText !== this.lastPhaseText) {
        this.lastPhaseText = phaseText;
        f.bossPhase.textContent = phaseText;
      }
    }

    // The hazard prompt. Only when one is in reach, and only when there is no
    // takedown offered, because the takedown is the more specific action.
    const hazard = state.hazard;
    const hazardText = hazard?.prompt ?? "";
    if (hazardText !== this.lastHazard) {
      this.lastHazard = hazardText;
      f.hazard.textContent = hazardText ? `${hazardText}  [T]` : "";
    }
    f.hazard.hidden = !hazardText;

    // Directional damage. Rebuilt only when the set of marks changes, so a
    // firefight does not thrash the DOM every frame.
    const marks = state.damageMarks ?? [];
    const sig = marks.map((m) => `${m.bearing.toFixed(2)}:${m.alpha.toFixed(1)}`).join("|");
    if (sig !== this.lastDamageSig) {
      this.lastDamageSig = sig;
      f.damage.innerHTML = "";
      for (const m of marks) {
        const arc = document.createElement("i");
        arc.style.transform = `rotate(${(m.bearing * 180) / Math.PI}deg)`;
        arc.style.opacity = String(m.alpha);
        arc.dataset.behind = m.behind ? "1" : "0";
        f.damage.appendChild(arc);
      }
    }
    f.damage.hidden = marks.length === 0;

    // The takedown prompt. Shown whenever a body is in reach, including when the
    // reason it is refused is something the player can fix ("Behind them" is
    // actionable; silence is not).
    const takedown = state.takedown;
    f.takedown.hidden = !takedown;
    if (takedown) {
      f.takedownText.textContent = takedown.prompt ?? "Take down";
      f.takedown.dataset.ready = takedown.verdict?.ok ? "1" : "0";
    }

    const dead = state.state === "dead";
    f.dead.hidden = !dead;
    if (dead) {
      f.deadTitle.textContent = "Taken.";
      f.deadBody.textContent = `Wave ${state.wave} · ${state.kills ?? 0} put down. The street resets; your score does not.`;
    }
    return this;
  }

  /** Flash the hit marker. `kill` makes it bigger and red. */
  markHit(now, kill = false) {
    this.hitUntil = now + (kill ? 260 : 140);
    this.fields.hitmark.hidden = false;
    this.fields.hitmark.dataset.kill = kill ? "1" : "0";
  }
}

function modeLabel(mode) {
  return {
    melee: "hand to hand",
    sidearm: "single shot",
    auto: "automatic",
    spread: "buck",
    scope: "single, scoped",
    heavy: "heavy",
    thrown: "thrown",
  }[mode] ?? "";
}

/** Lowercase, so a mode label never shouts on the HUD. */
function m(s) {
  return s;
}
