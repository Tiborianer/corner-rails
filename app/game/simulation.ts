import {
  CLEANING_MAX,
  LENGTH_COSTS,
  MISSIONS,
  PLATFORM_COSTS,
  SYSTEMS,
  TIER_COSTS,
  TRAINS,
  createInitialState,
} from "./data";
import type {
  ActiveTrain,
  GameState,
  MissionState,
  SystemId,
  TrainDefinition,
  UpgradeAction,
} from "./types";

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function nextRandom(seed: number): [number, number] {
  const next = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
  return [next / 4_294_967_296, next];
}

function randomInteger(seed: number, minimum: number, maximum: number): [number, number] {
  const [random, nextSeed] = nextRandom(seed);
  return [Math.round(minimum + random * (maximum - minimum)), nextSeed];
}

export function isNight(state: Pick<GameState, "simSeconds">): boolean {
  return state.simSeconds % 900 >= 600;
}

export function stationRating(state: GameState): number {
  const systemScore = Object.entries(state.systems).reduce((score, [key, enabled]) => {
    if (!enabled) return score;
    return score + (key === "advancedSignaling" ? 3 : 5);
  }, 0);
  const temporary = state.boosts.reduce((total, boost) => total + boost.amount, 0);
  const permanent =
    state.tier * 5 +
    state.platforms * 3 +
    state.lengthLevel * 2 +
    systemScore +
    state.prestige * 5;
  return Math.round(
    clamp(permanent + state.cleanliness * 0.2 + temporary - (state.raining ? 4 : 0), 0, 100),
  );
}

export function ratingMultiplier(rating: number): number {
  if (rating <= 20) return 0.8;
  if (rating <= 60) return 1;
  if (rating <= 90) return 1.25;
  return 1.5;
}

export function stationRatingBreakdown(state: GameState): { label: string; value: number }[] {
  const entries = [
    { label: "Cleanliness", value: Math.round(state.cleanliness * 0.2) },
    { label: `Tier ${state.tier} station`, value: state.tier * 5 },
    { label: "Platforms", value: state.platforms * 3 },
    { label: "Platform length", value: state.lengthLevel * 2 },
    { label: "Prestige", value: state.prestige * 5 },
    ...Object.entries(state.systems)
      .filter(([, enabled]) => enabled)
      .map(([key]) => ({ label: SYSTEMS[key as SystemId].name, value: key === "advancedSignaling" ? 3 : 5 })),
    ...state.boosts.map((boost) => ({ label: boost.label, value: boost.amount })),
    ...(state.raining ? [{ label: "Rain", value: -4 }] : []),
  ];
  return entries.filter((entry) => entry.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function cleaningCost(state: GameState): number {
  const dirt = clamp(100 - state.cleanliness, 0, 100);
  if (dirt < 0.01) return 0;
  return Math.max(1, Math.ceil((CLEANING_MAX[state.tier - 1] * dirt) / 100));
}

export function trainMeetsRequirements(state: GameState, train: TrainDefinition): boolean {
  return (
    state.tier >= train.tier &&
    state.platforms >= train.requirements.platforms &&
    state.lengthLevel >= train.requirements.lengthLevel &&
    train.requirements.systems.every((system) => state.systems[system]) &&
    (!train.requirements.nightOnly || isNight(state))
  );
}

export function visibleTrains(state: GameState): TrainDefinition[] {
  return TRAINS.filter((train) => train.kind === "scheduled" && train.tier <= state.tier);
}

export function eligibleTrains(state: GameState): TrainDefinition[] {
  return visibleTrains(state).filter((train) => trainMeetsRequirements(state, train));
}

function chooseWeightedTrain(state: GameState, trains: TrainDefinition[]): [TrainDefinition, number] {
  const total = trains.reduce((sum, train) => sum + train.spawnWeight, 0);
  const [roll, nextSeed] = nextRandom(state.rng);
  let cursor = roll * total;
  for (const train of trains) {
    cursor -= train.spawnWeight;
    if (cursor <= 0) return [train, nextSeed];
  }
  return [trains[trains.length - 1], nextSeed];
}

function startTrain(state: GameState, forcedTrain?: TrainDefinition): GameState {
  let train: TrainDefinition | undefined = forcedTrain;
  let rng = state.rng;
  const isFirst = !state.firstTrainComplete && !forcedTrain;
  if (isFirst) {
    train = TRAINS.find((candidate) => candidate.id === "br650");
  } else if (!train && state.eventWindow) {
    train = TRAINS.find((candidate) => candidate.id === state.eventWindow);
  }
  if (!train) {
    const eligible = eligibleTrains(state);
    if (eligible.length === 0) return { ...state, spawnCountdown: 5 };
    [train, rng] = chooseWeightedTrain(state, eligible);
  }
  if (!train || (!isFirst && !trainMeetsRequirements(state, train))) {
    return { ...state, eventWindow: null, eventRemaining: 0, spawnCountdown: 8, toast: "That special train's requirements are not met yet." };
  }
  const [dwell, dwellSeed] = randomInteger(rng, train.dwell[0], train.dwell[1]);
  const [payout, payoutSeed] = isFirst
    ? [10, dwellSeed]
    : randomInteger(dwellSeed, train.payout[0], train.payout[1]);
  const activeTrain: ActiveTrain = {
    trainId: train.id,
    phase: "approach",
    phaseElapsed: 0,
    phaseDuration: 5,
    payout,
    firstService: isFirst,
  };
  return {
    ...state,
    activeTrain,
    rng: payoutSeed,
    eventWindow: null,
    eventRemaining: 0,
    lastUpgrade: state.lastUpgrade ? { ...state.lastUpgrade, undoAvailable: false } : null,
    toast: `${train.name} is approaching platform 1.`,
    spawnCountdown: 0,
    // Rain extends the dwell after the approach phase.
    ...(state.raining ? { rng: payoutSeed, activeTrain: { ...activeTrain, phaseDuration: 5 + dwell * 0 } } : {}),
  };
}

function incrementMission(state: GameState, mission: MissionState["id"], amount = 1): GameState {
  if (state.mission.id !== mission || state.mission.complete) return state;
  const goal = MISSIONS[mission].goal;
  const progress = clamp(state.mission.progress + amount, 0, goal);
  return {
    ...state,
    mission: { ...state.mission, progress, complete: progress >= goal },
    ...(progress >= goal ? { toast: `Mission ready to claim: ${MISSIONS[mission].title}` } : {}),
  };
}

function completeTrain(state: GameState, active: ActiveTrain): GameState {
  const train = TRAINS.find((candidate) => candidate.id === active.trainId)!;
  const dirt = (0.8 + 0.1 * train.cars) * (state.raining ? 1.5 : 1);
  const rating = stationRating(state);
  const interval = clamp(48 / ratingMultiplier(rating), 10, 60);
  const eventBoost =
    train.id === "ice-s"
      ? { id: `ice-s-${state.simSeconds}`, label: "ICE-S record excitement", amount: 20, remaining: 600 }
      : train.id === "br01"
        ? { id: `br01-${state.simSeconds}`, label: "Steam festival", amount: 15, remaining: 600 }
        : null;
  let next: GameState = {
    ...state,
    activeTrain: null,
    coins: state.coins + active.payout,
    lifetimeCoins: state.lifetimeCoins + active.payout,
    cleanliness: clamp(state.cleanliness - dirt, 0, 100),
    firstTrainComplete: true,
    arrivals: state.arrivals + 1,
    spawnCountdown: interval,
    boosts: eventBoost ? [...state.boosts, eventBoost] : state.boosts,
    toast: `${train.name} departed · +${active.payout.toLocaleString()} coins`,
  };
  next = incrementMission(next, "serve");
  return next;
}

function advanceActiveTrain(state: GameState, delta: number): GameState {
  const active = state.activeTrain;
  if (!active) return state;
  const elapsed = active.phaseElapsed + delta;
  if (elapsed < active.phaseDuration) {
    return { ...state, activeTrain: { ...active, phaseElapsed: elapsed } };
  }
  const train = TRAINS.find((candidate) => candidate.id === active.trainId)!;
  if (active.phase === "approach") {
    const [dwell, rng] = randomInteger(state.rng, train.dwell[0], train.dwell[1]);
    return {
      ...state,
      rng,
      activeTrain: {
        ...active,
        phase: "dwell",
        phaseElapsed: 0,
        phaseDuration: dwell * (state.raining ? 1.1 : 1),
      },
      toast: `${train.name} boarding · ${Math.ceil(dwell)}s dwell`,
    };
  }
  if (active.phase === "dwell") {
    return {
      ...state,
      activeTrain: { ...active, phase: "depart", phaseElapsed: 0, phaseDuration: 5 },
      toast: `${train.name} ready to depart.`,
    };
  }
  return completeTrain(state, active);
}

function rollSeasonWeather(state: GameState): GameState {
  const [rainRoll, seedAfterRain] = nextRandom(state.rng);
  const [duration, seedAfterDuration] = randomInteger(seedAfterRain, 120, 300);
  const raining = rainRoll < 0.15;
  return {
    ...state,
    rng: seedAfterDuration,
    seasonIndex: (state.seasonIndex + 1) % SEASONS.length,
    nextSeasonAt: state.nextSeasonAt + 1_800,
    raining,
    rainRemaining: raining ? duration : 0,
    toast: raining ? "Rain has begun — dwell and dirt are increasing." : `${SEASONS[(state.seasonIndex + 1) % 4]} has arrived.`,
  };
}

export function tickGame(state: GameState, wallDelta: number): GameState {
  if (!state.region || !state.platformPlaced) return { ...state, wallSeconds: state.wallSeconds + wallDelta };
  const delta = wallDelta * state.speed;
  let next: GameState = {
    ...state,
    wallSeconds: state.wallSeconds + wallDelta,
    simSeconds: state.simSeconds + delta,
    boosts: state.boosts
      .map((boost) => ({ ...boost, remaining: boost.remaining - delta }))
      .filter((boost) => boost.remaining > 0),
  };

  if (next.raining) {
    next = {
      ...next,
      rainRemaining: Math.max(0, next.rainRemaining - delta),
      cleanliness: clamp(next.cleanliness - (0.5 / 60) * delta, 0, 100),
    };
    if (next.rainRemaining <= 0) {
      next = { ...next, raining: false, toast: "The rain has cleared." };
    }
  }

  if (next.simSeconds >= next.nextSeasonAt) next = rollSeasonWeather(next);

  if (next.activeTrain) {
    next = advanceActiveTrain(next, delta);
  } else {
    const spawnCountdown = next.spawnCountdown - delta;
    next = { ...next, spawnCountdown };
    if (spawnCountdown <= 0) next = startTrain(next);
  }

  const crossedHour = Math.floor(state.wallSeconds / 3_600) < Math.floor(next.wallSeconds / 3_600);
  if (crossedHour && !next.eventWindow && !next.activeTrain) {
    const candidates = TRAINS.filter((train) => train.kind === "event" && trainMeetsRequirements(next, train));
    if (candidates.length > 0) {
      const [roll, rng] = nextRandom(next.rng);
      next = { ...next, rng };
      if (roll < 0.35) {
        const chosen = candidates[Math.floor(roll * candidates.length) % candidates.length];
        next = { ...next, eventWindow: chosen.id as "ice-s" | "br01", eventRemaining: 600, spawnCountdown: 1, toast: `${chosen.name} announced!` };
      }
    }
  }

  return next;
}

export function selectRegion(state: GameState): GameState {
  return { ...state, region: "germany", toast: "Germany selected — place your free platform." };
}

export function placeFreePlatform(state: GameState): GameState {
  if (state.platformPlaced) return state;
  return { ...state, platformPlaced: true, spawnCountdown: 2, toast: "Platform ready. A local DMU is on its way." };
}

export function purchaseCost(state: GameState, action: UpgradeAction): number | null {
  if (action.kind === "platform") return PLATFORM_COSTS[state.platforms - 1] ?? null;
  if (action.kind === "length") return LENGTH_COSTS[state.lengthLevel - 1] ?? null;
  return state.systems[action.system] ? null : SYSTEMS[action.system].cost;
}

export function canPurchase(state: GameState, action: UpgradeAction): { allowed: boolean; reason?: string; cost?: number } {
  if (!state.platformPlaced) return { allowed: false, reason: "Place the free platform first." };
  if (state.tier < 5 && state.upgradesUsed >= 2) return { allowed: false, reason: "Development cap reached — tier up next." };
  const cost = purchaseCost(state, action);
  if (cost === null) return { allowed: false, reason: "Already fully developed." };
  if ((action.kind === "platform" && state.platforms === 4) || (action.kind === "length" && state.lengthLevel === 4)) {
    if (state.tier < 5) return { allowed: false, reason: "The international upgrade unlocks at Tier 5." };
  }
  if (action.kind === "system") {
    const system = SYSTEMS[action.system];
    if (state.tier < system.unlockTier) return { allowed: false, reason: `Unlocks at Tier ${system.unlockTier}.` };
  }
  if (state.coins < cost) return { allowed: false, reason: `Need ${(cost - state.coins).toLocaleString()} more coins.`, cost };
  return { allowed: true, cost };
}

export function purchaseUpgrade(state: GameState, action: UpgradeAction): GameState {
  const eligibility = canPurchase(state, action);
  if (!eligibility.allowed || eligibility.cost === undefined) {
    return { ...state, toast: eligibility.reason ?? "That upgrade is not available." };
  }
  const cost = eligibility.cost;
  let next: GameState = {
    ...state,
    coins: state.coins - cost,
    upgradesUsed: state.tier < 5 ? state.upgradesUsed + 1 : state.upgradesUsed,
  };
  if (action.kind === "platform") {
    next = {
      ...next,
      platforms: state.platforms + 1,
      lastUpgrade: { kind: "platform", key: "platforms", cost, previous: state.platforms, undoAvailable: true },
      toast: `Platform ${state.platforms + 1} opened.`,
    };
  } else if (action.kind === "length") {
    next = {
      ...next,
      lengthLevel: state.lengthLevel + 1,
      lastUpgrade: { kind: "length", key: "lengthLevel", cost, previous: state.lengthLevel, undoAvailable: true },
      toast: `Platforms extended to length ${state.lengthLevel + 1}.`,
    };
  } else {
    next = {
      ...next,
      systems: { ...state.systems, [action.system]: true },
      lastUpgrade: { kind: "system", key: action.system, cost, previous: false, undoAvailable: true },
      toast: `${SYSTEMS[action.system].name} installed.`,
    };
  }
  return incrementMission(next, "develop");
}

export function undoLastUpgrade(state: GameState): GameState {
  const receipt = state.lastUpgrade;
  if (!receipt?.undoAvailable) return { ...state, toast: "Undo expired when the next train was dispatched." };
  let next: GameState = {
    ...state,
    coins: state.coins + receipt.cost,
    upgradesUsed: state.tier < 5 ? Math.max(0, state.upgradesUsed - 1) : state.upgradesUsed,
    lastUpgrade: null,
    toast: `Upgrade undone · +${receipt.cost.toLocaleString()} coins`,
  };
  if (receipt.kind === "platform") next = { ...next, platforms: receipt.previous as number };
  if (receipt.kind === "length") next = { ...next, lengthLevel: receipt.previous as number };
  if (receipt.kind === "system") next = { ...next, systems: { ...next.systems, [receipt.key]: false } };
  return next;
}

export function tierUp(state: GameState): GameState {
  if (state.tier >= 5) return { ...state, toast: "Tier 5 is the international terminus." };
  if (state.upgradesUsed < 2) return { ...state, toast: `Use ${2 - state.upgradesUsed} more development slot${state.upgradesUsed === 1 ? "" : "s"} first.` };
  const cost = TIER_COSTS[state.tier - 1];
  if (state.coins < cost) return { ...state, toast: `Need ${(cost - state.coins).toLocaleString()} more coins to tier up.` };
  const tier = (state.tier + 1) as GameState["tier"];
  return {
    ...state,
    coins: state.coins - cost,
    tier,
    upgradesUsed: 0,
    lastUpgrade: null,
    toast: `Station Tier ${tier} opened — new services unlocked.`,
  };
}

export function cleanStation(state: GameState): GameState {
  const cost = cleaningCost(state);
  if (cost === 0) return { ...state, toast: "The station is already spotless." };
  if (state.coins < cost) return { ...state, toast: `Need ${(cost - state.coins).toLocaleString()} more coins to clean.` };
  return incrementMission(
    { ...state, coins: state.coins - cost, cleanliness: 100, toast: `Station cleaned · −${cost.toLocaleString()} coins` },
    "clean",
  );
}

export function setSpeed(state: GameState, speed: 1 | 2 | 3): GameState {
  return { ...state, speed, toast: `${speed}× simulation speed` };
}

export function claimMission(state: GameState): GameState {
  if (!state.mission.complete) return state;
  const order: MissionState["id"][] = ["serve", "develop", "clean"];
  const nextMission = order[(order.indexOf(state.mission.id) + 1) % order.length];
  const reward = MISSIONS[state.mission.id].reward;
  return {
    ...state,
    coins: state.coins + reward,
    lifetimeCoins: state.lifetimeCoins + reward,
    boosts: [...state.boosts, { id: `mission-${state.simSeconds}`, label: "Mission momentum", amount: 5, remaining: 300 }],
    mission: { id: nextMission, progress: 0, complete: false },
    toast: `Mission claimed · +${reward.toLocaleString()} coins and +5 rating`,
  };
}

export function triggerEvent(state: GameState, eventId: "ice-s" | "br01"): GameState {
  const train = TRAINS.find((candidate) => candidate.id === eventId)!;
  if (!trainMeetsRequirements(state, train)) {
    return { ...state, toast: `${train.name} is locked — check its requirements.` };
  }
  return startTrain({ ...state, activeTrain: null, eventWindow: eventId, eventRemaining: 600, spawnCountdown: 0 }, train);
}

export function prestigeStation(state: GameState): GameState {
  if (state.tier < 5) return { ...state, toast: "Reach Tier 5 before prestiging." };
  const next = createInitialState(state.prestige + 1);
  return { ...next, region: "germany", toast: `Prestige ${next.prestige}: permanent +${next.prestige * 5} rating.` };
}

export function debugState(state: GameState, mode: "tier5" | "rain" | "night" | "dirty"): GameState {
  if (mode === "tier5") {
    return {
      ...state,
      region: "germany",
      platformPlaced: true,
      coins: 150_000,
      tier: 5,
      upgradesUsed: 0,
      platforms: 5,
      lengthLevel: 5,
      firstTrainComplete: true,
      systems: Object.fromEntries(Object.keys(state.systems).map((key) => [key, true])) as GameState["systems"],
      spawnCountdown: 2,
      toast: "Debug: Tier 5 station ready.",
    };
  }
  if (mode === "rain") return { ...state, raining: true, rainRemaining: 180, toast: "Debug: rain started." };
  if (mode === "night") return { ...state, simSeconds: Math.floor(state.simSeconds / 900) * 900 + 610, toast: "Debug: night lighting active." };
  return { ...state, cleanliness: 22, toast: "Debug: heavy station dirt applied." };
}
