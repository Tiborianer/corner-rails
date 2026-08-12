"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AudioBus } from "./game/audio";
import {
  LENGTH_COSTS,
  MISSIONS,
  PLATFORM_COSTS,
  REGIONS,
  SYSTEMS,
  TIER_COSTS,
  TRAINS,
  createInitialState,
} from "./game/data";
import { decodeSave, encodeSave } from "./game/save";
import {
  DEVELOPMENT_CAP,
  SEASONS,
  canPurchase,
  claimMission,
  cleanStation,
  cleaningCost,
  debugState,
  isNight,
  placeFreePlatform,
  prestigeStation,
  purchaseUpgrade,
  selectRegion,
  setSpeed,
  stationRating,
  stationRatingBreakdown,
  tickGame,
  tierUp,
  trainMeetsRequirements,
  triggerEvent,
  undoLastUpgrade,
  visibleTrains,
} from "./game/simulation";
import type {
  GameState,
  SystemId,
  TrainDefinition,
  UpgradeAction,
} from "./game/types";

const StationScene = dynamic(() => import("./game/Scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Preparing the station diorama…</div>,
});

type Action =
  | { type: "tick"; delta: number }
  | { type: "select-region" }
  | { type: "place-platform" }
  | { type: "purchase"; upgrade: UpgradeAction }
  | { type: "undo" }
  | { type: "tier-up" }
  | { type: "clean" }
  | { type: "speed"; speed: 1 | 2 | 3 }
  | { type: "claim-mission" }
  | { type: "event"; eventId: "ice-s" | "br01" }
  | { type: "prestige" }
  | { type: "debug"; mode: "tier5" | "rain" | "night" | "dirty" }
  | { type: "import"; state: GameState }
  | { type: "toast"; message: string | null };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick":
      return tickGame(state, action.delta);
    case "select-region":
      return selectRegion(state);
    case "place-platform":
      return placeFreePlatform(state);
    case "purchase":
      return purchaseUpgrade(state, action.upgrade);
    case "undo":
      return undoLastUpgrade(state);
    case "tier-up":
      return tierUp(state);
    case "clean":
      return cleanStation(state);
    case "speed":
      return setSpeed(state, action.speed);
    case "claim-mission":
      return claimMission(state);
    case "event":
      return triggerEvent(state, action.eventId);
    case "prestige":
      return prestigeStation(state);
    case "debug":
      return debugState(state, action.mode);
    case "import":
      return action.state;
    case "toast":
      return { ...state, toast: action.message };
  }
}

function formatCoins(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 100_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Math.floor(value));
}

function clockLabel(simSeconds: number) {
  const cycle = simSeconds % 900;
  const minutes = cycle < 600 ? 360 + (cycle / 600) * 840 : 1_200 + ((cycle - 600) / 300) * 600;
  const wrapped = Math.floor(minutes % 1_440);
  const hours = Math.floor(wrapped / 60).toString().padStart(2, "0");
  const mins = (wrapped % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function cleanTone(cleanliness: number) {
  if (cleanliness >= 80) return "clean";
  if (cleanliness >= 60) return "used";
  if (cleanliness >= 35) return "dirty";
  return "filthy";
}

function RequirementPill({ met, children }: { met: boolean; children: React.ReactNode }) {
  return <span className={`requirement-pill ${met ? "met" : "unmet"}`}>{met ? "✓" : "·"} {children}</span>;
}

function TrainRequirement({ train, state }: { train: TrainDefinition; state: GameState }) {
  const platformMet = state.platforms >= train.requirements.platforms;
  const lengthMet = state.lengthLevel >= train.requirements.lengthLevel;
  const systemsMet = train.requirements.systems.every((system) => state.systems[system]);
  const timeMet = !train.requirements.nightOnly || isNight(state);
  const ready = trainMeetsRequirements(state, train);
  return (
    <article className={`train-card ${ready ? "ready" : "locked"}`}>
      <div className="train-card-head">
        <div className="livery-swatch" style={{ background: `linear-gradient(135deg, ${train.colors.body} 0 52%, ${train.colors.accent} 52% 68%, ${train.colors.roof} 68%)` }} />
        <div>
          <strong>{train.name}</strong>
          <span>{train.operator} · {train.cars} car{train.cars === 1 ? "" : "s"}</span>
        </div>
        <b>{ready ? "READY" : "LOCKED"}</b>
      </div>
      <div className="requirement-row">
        <RequirementPill met={platformMet}>{train.requirements.platforms} platforms</RequirementPill>
        <RequirementPill met={lengthMet}>length {train.requirements.lengthLevel}</RequirementPill>
        {train.requirements.systems.map((system) => (
          <RequirementPill key={system} met={state.systems[system]}>{SYSTEMS[system].name}</RequirementPill>
        ))}
        {train.requirements.nightOnly && <RequirementPill met={timeMet}>night service</RequirementPill>}
      </div>
      <p>{train.fact}</p>
      <footer>
        <span>{train.payout[0] === train.payout[1] ? formatCoins(train.payout[0]) : `${formatCoins(train.payout[0])}–${formatCoins(train.payout[1])}`} coins</span>
        <a href={train.source} target="_blank" rel="noreferrer">Source ↗</a>
        <span className="sr-only">Systems {systemsMet ? "met" : "missing"}</span>
      </footer>
    </article>
  );
}

function Metric({ icon, label, value, tone, children }: { icon: string; label: string; value: string; tone?: string; children?: React.ReactNode }) {
  return (
    // The metric becomes keyboard-focusable only when it owns an explanatory popover.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className={`metric ${tone ?? ""}`} tabIndex={children ? 0 : undefined}>
      <span aria-hidden="true">{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
      {children}
    </div>
  );
}

export default function CornerRails() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState());
  const [drawer, setDrawer] = useState<"build" | "trains" | "tier" | "save" | "help" | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState<UpgradeAction | null>(null);
  const [importCode, setImportCode] = useState("");
  const [saveCode, setSaveCode] = useState("");
  const [muted, setMuted] = useState(true);
  const [showPrestige, setShowPrestige] = useState(false);
  const debugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const audio = useRef(new AudioBus());
  const previousTrain = useRef<string | null>(null);
  const previousPhase = useRef<string | null>(null);
  const previousCoins = useRef(0);

  const rating = stationRating(state);
  const ratingDetails = stationRatingBreakdown(state).slice(0, 3);
  const visible = useMemo(() => visibleTrains(state), [state]);
  const currentMission = MISSIONS[state.mission.id];
  const cleanPrice = cleaningCost(state);
  const activeDefinition = state.activeTrain ? TRAINS.find((train) => train.id === state.activeTrain?.trainId) : null;

  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", delta: Math.min(0.25, (now - previous) / 1_000) });
      previous = now;
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => dispatch({ type: "toast", message: null }), 4_000);
    return () => window.clearTimeout(timer);
  }, [state.toast]);

  useEffect(() => {
    const active = state.activeTrain;
    if (active?.trainId !== previousTrain.current) {
      if (active) {
        const definition = TRAINS.find((train) => train.id === active.trainId);
        if (definition) audio.current.approach(definition.style);
      } else if (previousTrain.current) {
        audio.current.reward();
      }
      previousTrain.current = active?.trainId ?? null;
    }
    if (active?.phase !== previousPhase.current && active?.phase === "dwell") audio.current.dwell();
    previousPhase.current = active?.phase ?? null;
    if (state.coins > previousCoins.current && previousCoins.current > 0 && !active) audio.current.reward();
    previousCoins.current = state.coins;
  }, [state.activeTrain, state.coins]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "1" || event.key === "2" || event.key === "3") dispatch({ type: "speed", speed: Number(event.key) as 1 | 2 | 3 });
      if (event.key.toLowerCase() === "b") setDrawer((current) => current === "build" ? null : "build");
      if (event.key.toLowerCase() === "r") setDrawer((current) => current === "trains" ? null : "trains");
      if (event.key === "Escape") {
        setDrawer(null);
        setConfirmUpgrade(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function requestPurchase(upgrade: UpgradeAction) {
    const eligibility = canPurchase(state, upgrade);
    if (!eligibility.allowed) {
      dispatch({ type: "purchase", upgrade });
      return;
    }
    if (state.tier < 5 && state.upgradesUsed === DEVELOPMENT_CAP - 1) {
      setConfirmUpgrade(upgrade);
      return;
    }
    dispatch({ type: "purchase", upgrade });
  }

  function confirmFinalUpgrade() {
    if (!confirmUpgrade) return;
    dispatch({ type: "purchase", upgrade: confirmUpgrade });
    setConfirmUpgrade(null);
  }

  async function toggleAudio() {
    const nextMuted = !muted;
    await audio.current.setMuted(nextMuted);
    setMuted(nextMuted);
  }

  async function exportSave() {
    const code = encodeSave(state);
    setSaveCode(code);
    try {
      await navigator.clipboard.writeText(code);
      dispatch({ type: "toast", message: "Save code copied to clipboard." });
    } catch {
      dispatch({ type: "toast", message: "Save code ready — select and copy it below." });
    }
  }

  function importSave() {
    try {
      dispatch({ type: "import", state: decodeSave(importCode) });
      setImportCode("");
      setDrawer(null);
    } catch (error) {
      dispatch({ type: "toast", message: error instanceof Error ? error.message : "Save import failed." });
    }
  }

  const tutorialStep = !state.region ? 0 : !state.platformPlaced ? 1 : !state.firstTrainComplete ? 2 : 3;
  const phaseProgress = state.activeTrain ? Math.min(1, state.activeTrain.phaseElapsed / state.activeTrain.phaseDuration) : 0;

  return (
    <main className={`game-shell ${isNight(state) ? "night" : "day"} ${state.raining ? "rainy" : ""}`}>
      <section className="world" aria-label="Corner Rails station diorama">
        <StationScene state={state} onPlacePlatform={() => dispatch({ type: "place-platform" })} />
        <div className="world-vignette" />
      </section>

      <header className="brand">
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /></div>
        <div><small>INCREMENTAL STATION</small><h1>CORNER RAILS</h1></div>
      </header>

      {state.region && (
        <div className="hud" aria-label="Station status">
          <Metric icon="💰" label="Coins" value={formatCoins(state.coins)} />
          <Metric icon="⭐" label="Rating" value={`${rating}%`} tone={rating >= 61 ? "good" : rating <= 20 ? "warn" : ""}>
            <div className="metric-popover">
              <strong>Top rating effects</strong>
              {ratingDetails.map((detail, index) => <span key={`${detail.label}-${index}`}>{detail.label}<b>{detail.value > 0 ? "+" : ""}{detail.value}</b></span>)}
              <em>Cleanliness contributes {Math.round(state.cleanliness * 0.2)} points.</em>
            </div>
          </Metric>
          <Metric icon="🧹" label="Clean" value={`${Math.round(state.cleanliness)}%`} tone={cleanTone(state.cleanliness)} />
          <Metric icon={state.raining ? "🌧️" : isNight(state) ? "🌙" : "☀️"} label={`${SEASONS[state.seasonIndex]} · ${state.raining ? "Rain" : isNight(state) ? "Night" : "Clear"}`} value={clockLabel(state.simSeconds)} />
        </div>
      )}

      {state.region && (
        <div className="speed-audio">
          <div className="speed-control" aria-label="Simulation speed">
            {[1, 2, 3].map((speed) => (
              <button key={speed} className={state.speed === speed ? "active" : ""} onClick={() => dispatch({ type: "speed", speed: speed as 1 | 2 | 3 })}>{speed}×</button>
            ))}
          </div>
          <button className="icon-button" onClick={toggleAudio} aria-label={muted ? "Turn sound on" : "Mute sound"}>{muted ? "🔇" : "🔊"}</button>
          <button className="icon-button" onClick={() => setDrawer("help")} aria-label="Help">?</button>
        </div>
      )}

      {state.region && state.platformPlaced && (
        <aside className={`mission-chip ${state.mission.complete ? "complete" : ""}`}>
          <span>DAILY BOARD</span>
          <strong>{currentMission.title}</strong>
          <p>{currentMission.description}</p>
          <div className="mission-progress"><i style={{ width: `${(state.mission.progress / currentMission.goal) * 100}%` }} /></div>
          <footer>{state.mission.progress}/{currentMission.goal} · 💰 {currentMission.reward}</footer>
          {state.mission.complete && <button onClick={() => dispatch({ type: "claim-mission" })}>Claim reward</button>}
        </aside>
      )}

      {state.region && state.platformPlaced && activeDefinition && state.activeTrain && (
        <div className="arrival-card">
          <div className="arrival-livery" style={{ backgroundColor: activeDefinition.colors.accent }} />
          <div>
            <small>{state.activeTrain.phase.toUpperCase()} · PLATFORM 1</small>
            <strong>{activeDefinition.name}</strong>
            <span>{activeDefinition.operator} · +{formatCoins(state.activeTrain.payout)} coins</span>
          </div>
          <div className="arrival-progress"><i style={{ width: `${phaseProgress * 100}%` }} /></div>
        </div>
      )}

      {state.region && state.platformPlaced && !state.activeTrain && (
        <div className="next-arrival">Next service in <strong>{Math.max(0, Math.ceil(state.spawnCountdown))}s</strong></div>
      )}

      {state.region && (
        <nav className="game-nav" aria-label="Station tools">
          <button className={drawer === "build" ? "active" : ""} onClick={() => setDrawer(drawer === "build" ? null : "build")}><span>＋</span>Build <kbd>B</kbd></button>
          <button className={drawer === "trains" ? "active" : ""} onClick={() => setDrawer(drawer === "trains" ? null : "trains")}><span>🚆</span>Trains <kbd>R</kbd></button>
          <button className={drawer === "tier" ? "active" : ""} onClick={() => setDrawer(drawer === "tier" ? null : "tier")}><span>⌂</span>Tier {state.tier}</button>
          <button onClick={() => { setDrawer("save"); setSaveCode(encodeSave(state)); }}><span>⌁</span>Save code</button>
          <button className={`clean-button ${cleanTone(state.cleanliness)}`} onClick={() => { dispatch({ type: "clean" }); audio.current.clean(); }} disabled={cleanPrice === 0}><span>🧹</span>{cleanPrice === 0 ? "Spotless" : `Clean · ${formatCoins(cleanPrice)}`}</button>
        </nav>
      )}

      {drawer && state.region && (
        <aside className={`drawer drawer-${drawer}`} aria-label={`${drawer} panel`}>
          <div className="drawer-head">
            <div><small>STATION CONTROL</small><h2>{drawer === "build" ? "Develop" : drawer === "trains" ? "Train requirements" : drawer === "tier" ? "Tier progression" : drawer === "save" ? "Manual save" : "How to play"}</h2></div>
            <button onClick={() => setDrawer(null)} aria-label="Close panel">×</button>
          </div>

          {drawer === "build" && (
            <div className="build-panel">
              <div className="development-meter">
                <span>Development uses</span>
                <div>{state.tier === 5 ? <b>UNLIMITED AT TIER 5</b> : <>{Array.from({ length: DEVELOPMENT_CAP }, (_, slot) => <i key={slot} className={slot < state.upgradesUsed ? "used" : ""} />)}<em>{state.upgradesUsed}/{DEVELOPMENT_CAP}</em></>}</div>
              </div>
              <h3>Station structure</h3>
              <button className="build-option" onClick={() => requestPurchase({ kind: "platform" })}>
                <span className="build-icon">▤</span><div><strong>Add platform</strong><small>{state.platforms >= 5 ? "Maximum 5 platforms" : `${state.platforms} → ${state.platforms + 1} platforms`}</small></div><b>{PLATFORM_COSTS[state.platforms - 1]?.toLocaleString() ?? "MAX"}</b>
              </button>
              <button className="build-option" onClick={() => requestPurchase({ kind: "length" })}>
                <span className="build-icon">↔</span><div><strong>Extend platforms</strong><small>{state.lengthLevel >= 5 ? "International length complete" : `Length ${state.lengthLevel} → ${state.lengthLevel + 1}`}</small></div><b>{LENGTH_COSTS[state.lengthLevel - 1]?.toLocaleString() ?? "MAX"}</b>
              </button>
              <h3>Station systems</h3>
              {Object.entries(SYSTEMS).map(([key, system]) => {
                const id = key as SystemId;
                const locked = state.tier < system.unlockTier;
                return (
                  <button key={key} className={`build-option ${state.systems[id] ? "owned" : locked ? "locked" : ""}`} onClick={() => requestPurchase({ kind: "system", system: id })}>
                    <span className="build-icon">{system.icon}</span><div><strong>{system.name}</strong><small>{state.systems[id] ? "Installed" : locked ? `Unlocks at Tier ${system.unlockTier}` : system.description}</small></div><b>{state.systems[id] ? "✓" : system.cost.toLocaleString()}</b>
                  </button>
                );
              })}
              {state.lastUpgrade?.undoAvailable && <button className="undo-button" onClick={() => dispatch({ type: "undo" })}>↶ Undo last upgrade · refund {state.lastUpgrade.cost.toLocaleString()}</button>}
            </div>
          )}

          {drawer === "trains" && (
            <div className="train-list">
              <p className="drawer-intro">Only services unlocked by your current tier are shown. Meet every badge to add a train to automatic arrivals.</p>
              {[1, 2, 3, 4, 5].filter((tier) => tier <= state.tier).map((tier) => (
                <section key={tier}>
                  <h3>Tier {tier} services</h3>
                  {visible.filter((train) => train.tier === tier).map((train) => <TrainRequirement key={train.id} train={train} state={state} />)}
                </section>
              ))}
              <section>
                <h3>Special events</h3>
                {TRAINS.filter((train) => train.kind === "event" && train.tier <= state.tier).map((train) => (
                  <div key={train.id} className="event-row">
                    <TrainRequirement train={train} state={state} />
                    {debugEnabled && <button onClick={() => dispatch({ type: "event", eventId: train.id as "ice-s" | "br01" })}>Debug dispatch</button>}
                  </div>
                ))}
              </section>
            </div>
          )}

          {drawer === "tier" && (
            <div className="tier-panel">
              <div className="tier-emblem"><span>{state.tier}</span><small>STATION TIER</small></div>
              {state.tier < 5 ? (
                <>
                  <p>Spend all three shared development uses, then invest in the station building. Train infrastructure can be added in any tier.</p>
                  <dl>
                    <div><dt>Tier-up cost</dt><dd>{TIER_COSTS[state.tier - 1].toLocaleString()} coins</dd></div>
                    <div><dt>Development</dt><dd>{state.upgradesUsed}/{DEVELOPMENT_CAP} uses</dd></div>
                    <div><dt>Next unlocks</dt><dd>{TRAINS.filter((train) => train.kind === "scheduled" && train.tier === state.tier + 1).map((train) => train.name.replace(/^DB /u, "")).join(" · ")}</dd></div>
                  </dl>
                  <button className="primary-action" onClick={() => dispatch({ type: "tier-up" })}>Upgrade station to Tier {state.tier + 1} · {TIER_COSTS[state.tier - 1].toLocaleString()}</button>
                </>
              ) : (
                <>
                  <p>Tier 5 removes the development cap. Complete the international terminus, or prestige for a permanent rating bonus.</p>
                  <dl>
                    <div><dt>Prestige level</dt><dd>{state.prestige}</dd></div>
                    <div><dt>Permanent bonus</dt><dd>+{state.prestige * 5}% rating</dd></div>
                    <div><dt>Next prestige</dt><dd>+{(state.prestige + 1) * 5}% rating</dd></div>
                  </dl>
                  <button className="primary-action danger" onClick={() => setShowPrestige(true)}>Prestige this station</button>
                </>
              )}
            </div>
          )}

          {drawer === "save" && (
            <div className="save-panel">
              <p>Corner Rails never saves automatically. Copy this code before closing the page; importing it grants no offline earnings.</p>
              <label>Current save code<textarea readOnly value={saveCode || encodeSave(state)} onFocus={(event) => event.currentTarget.select()} /></label>
              <button className="primary-action" onClick={exportSave}>Copy current save code</button>
              <label>Import a code<textarea value={importCode} onChange={(event) => setImportCode(event.target.value)} placeholder="Paste a CR1 save code…" /></label>
              <button className="secondary-action" onClick={importSave} disabled={!importCode.trim()}>Validate and import</button>
            </div>
          )}

          {drawer === "help" && (
            <div className="help-panel">
              <ol>
                <li><b>1</b><div><strong>Place your free platform</strong><p>Choose Germany, then click the gold platform ghost in the diorama.</p></div></li>
                <li><b>2</b><div><strong>Welcome the first train</strong><p>Trains arrive automatically. Keep the station clean to protect its rating.</p></div></li>
                <li><b>3</b><div><strong>Develop three times, then tier up</strong><p>Every permanent purchase uses a shared slot until Tier 5. Better infrastructure attracts better trains.</p></div></li>
              </ol>
              <p className="keyboard-note"><kbd>B</kbd> Build · <kbd>R</kbd> Trains · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Speed · <kbd>Esc</kbd> Close</p>
            </div>
          )}
        </aside>
      )}

      {!state.region && (
        <section className="region-screen">
          <div className="region-intro">
            <span className="eyebrow">A POCKET-SIZED RAIL EMPIRE</span>
            <h2>Build a corner.<br />Connect a continent.</h2>
            <p>Start with one free platform. Welcome real trains, earn fares, keep the station clean, and grow a tiny German stop into an international terminus.</p>
            <div className="region-features"><span>18 scheduled trains</span><span>2 special events</span><span>Manual save codes</span></div>
          </div>
          <div className="region-picker">
            <small>CHOOSE A STARTING REGION</small>
            {REGIONS.map((region) => (
              <button key={region.id} className={region.enabled ? "enabled" : "disabled"} disabled={!region.enabled} onClick={() => dispatch({ type: "select-region" })}>
                <span>{region.mark}</span><div><strong>{region.name}</strong><small>{region.subtitle}</small></div><b>{region.enabled ? "START →" : "COMING SOON"}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {state.region && tutorialStep < 3 && (
        <div className="tutorial">
          <span>STEP {tutorialStep} OF 3</span>
          <strong>{tutorialStep === 1 ? "Place your free platform" : "Welcome the first local train"}</strong>
          <p>{tutorialStep === 1 ? "Click the gold platform in the diorama. Your first station structure costs nothing." : "It will stop, board passengers, and pay 10 coins automatically."}</p>
          {tutorialStep === 1 && <button onClick={() => dispatch({ type: "place-platform" })}>Place platform</button>}
        </div>
      )}

      {confirmUpgrade && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <span className="modal-icon">Ⅲ</span>
            <small>THIRD DEVELOPMENT USE</small>
            <h2 id="confirm-title">This locks development until tier-up.</h2>
            <p>You can undo this purchase until the next train is dispatched. Tier-up itself has no infrastructure requirement.</p>
            <div><button className="secondary-action" onClick={() => setConfirmUpgrade(null)}>Cancel</button><button className="primary-action" onClick={confirmFinalUpgrade}>Confirm upgrade</button></div>
          </section>
        </div>
      )}

      {showPrestige && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="prestige-title">
            <span className="modal-icon">↻</span><small>PRESTIGE RESET</small><h2 id="prestige-title">Rebuild with +{(state.prestige + 1) * 5}% base rating?</h2>
            <p>Coins, platforms, systems, missions, and the current station reset. Your prestige bonus remains in manual save codes.</p>
            <div><button className="secondary-action" onClick={() => setShowPrestige(false)}>Keep station</button><button className="primary-action danger" onClick={() => { dispatch({ type: "prestige" }); setShowPrestige(false); setDrawer(null); }}>Prestige and reset</button></div>
          </section>
        </div>
      )}

      {debugEnabled && state.region && (
        <div className="debug-tools">
          <span>DEBUG</span>
          {(["tier5", "night", "rain", "dirty"] as const).map((mode) => <button key={mode} onClick={() => dispatch({ type: "debug", mode })}>{mode}</button>)}
          <button onClick={() => dispatch({ type: "event", eventId: "ice-s" })}>ICE-S</button>
          <button onClick={() => dispatch({ type: "event", eventId: "br01" })}>BR 01</button>
        </div>
      )}

      {state.toast && <div className="toast" role="status">{state.toast}</div>}
    </main>
  );
}
