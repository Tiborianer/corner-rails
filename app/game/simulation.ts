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
import { BADGES } from "./badges";
import type {
  ActiveTrain,
  BadgeId,
  GameState,
  MissionState,
  SystemId,
  TrainDefinition,
  UpgradeAction,
  WeatherKind,
} from "./types";
import {
  CAB_CAR_LEADING_CHANCE,
  eligibleTrainVisualVariants,
  selectTrainVisualVariant,
  trainVisualCabCarLeadingChance,
} from "./trainVisuals";

export const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;
export const DEVELOPMENT_CAP = 3;
export const EVENT_DURATION = 300;
export const PUSH_PULL_LOCOMOTIVE_LEADING_CHANCE = 1 - CAB_CAR_LEADING_CHANCE;
export const PUSH_PULL_CAB_CAR_LEADING_CHANCE = CAB_CAR_LEADING_CHANCE;
// Compatibility names retained for existing Nightjet tests and save documentation.
export const NIGHTJET_TAURUS_LEADING_CHANCE = PUSH_PULL_LOCOMOTIVE_LEADING_CHANCE;
export const NIGHTJET_CAB_CAR_LEADING_CHANCE = PUSH_PULL_CAB_CAR_LEADING_CHANCE;
export const WEATHER_RAIN_CHANCE = 0.25;
export const WEATHER_THUNDERSTORM_CHANCE = 0.1;

export function weatherFromRoll(roll: number): WeatherKind {
  const normalized = clamp(roll, 0, 0.999999999);
  if (normalized < WEATHER_THUNDERSTORM_CHANCE) return "thunderstorm";
  if (normalized < WEATHER_THUNDERSTORM_CHANCE + WEATHER_RAIN_CHANCE) return "rain";
  return "clear";
}

export function isWetWeather(state: Pick<GameState, "weather">): boolean {
  return state.weather !== "clear";
}

export function weatherRatingPenalty(weather: WeatherKind): number {
  if (weather === "thunderstorm") return 25;
  if (weather === "rain") return 10;
  return 0;
}

export function weatherArrivalDirtMultiplier(weather: WeatherKind): number {
  if (weather === "thunderstorm") return 2;
  if (weather === "rain") return 1.5;
  return 1;
}

export function weatherDirtPerMinute(weather: WeatherKind): number {
  if (weather === "thunderstorm") return 1.5;
  if (weather === "rain") return 0.5;
  return 0;
}

export function weatherDwellMultiplier(weather: WeatherKind): number {
  if (weather === "thunderstorm") return 1.15;
  if (weather === "rain") return 1.1;
  return 1;
}

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

/** Continuous daylight used by the renderer: dusk 09:00–10:00, night,
 * then dawn 14:00–15:00 in the game's fifteen-minute cycle. */
export function daylightFactor(simSeconds: number): number {
  const cycle = ((simSeconds % 900) + 900) % 900;
  if (cycle < 540) return 1;
  if (cycle < 600) {
    const t = (cycle - 540) / 60;
    return 1 - t * t * (3 - 2 * t);
  }
  if (cycle < 840) return 0;
  const t = (cycle - 840) / 60;
  return t * t * (3 - 2 * t);
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
    clamp(permanent + state.cleanliness * 0.2 + temporary - weatherRatingPenalty(state.weather), 0, 100),
  );
}

function hasCompletedEveryDevelopment(state: GameState): boolean {
  return (
    state.tier === 5 &&
    state.platforms === 5 &&
    state.lengthLevel === 5 &&
    Object.values(state.systems).every(Boolean)
  );
}

function meetsBadgeRequirement(id: BadgeId, previous: GameState, state: GameState): boolean {
  const scheduledIds = TRAINS.filter((train) => train.kind === "scheduled").map((train) => train.id);
  switch (id) {
    case "grand-terminus":
      return state.tier === 5;
    case "storm-watcher":
      return state.weather === "thunderstorm" || state.lightningStrikeId > 0;
    case "midnight-arrival":
      return state.servedTrainIds.includes("nightjet");
    case "perfect-score":
      return stationRating(state) === 100;
    case "rush-hour":
      return Math.max(
        previous.platformLanes.filter((lane) => lane.activeTrain).length,
        state.platformLanes.filter((lane) => lane.activeTrain).length,
      ) >= 5;
    case "clean-comeback":
      return state.cleanedFromCritical;
    case "millionaire":
      return state.lifetimeCoins >= 1_000_000;
    case "master-engineer":
      return hasCompletedEveryDevelopment(state);
    case "event-curator":
      return state.servedTrainIds.includes("ice-s") && state.servedTrainIds.includes("br01");
    case "complete-timetable":
      return scheduledIds.every((trainId) => state.servedTrainIds.includes(trainId));
    case "storm-sleeper":
      return state.stormNightjetServed;
    case "triple-prestige":
      return state.prestige >= 3;
  }
}

/** Apply achievement rules after a normal game transition. Debug actions skip
 * this helper in the UI reducer so the testing bar cannot award real badges. */
export function awardBadges(previous: GameState, state: GameState): GameState {
  const unlocked = new Set(state.unlockedBadges);
  const newlyUnlocked = BADGES.filter((badge) => !unlocked.has(badge.id) && meetsBadgeRequirement(badge.id, previous, state));
  if (newlyUnlocked.length === 0) return state;
  newlyUnlocked.forEach((badge) => unlocked.add(badge.id));
  return {
    ...state,
    unlockedBadges: [...unlocked],
    toast: `🏅 Badge unlocked: ${newlyUnlocked[0].name}${newlyUnlocked.length > 1 ? ` · +${newlyUnlocked.length - 1} more` : ""}`,
  };
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
    ...(state.weather === "rain" ? [{ label: "Rain", value: -10 }] : []),
    ...(state.weather === "thunderstorm" ? [{ label: "Thunderstorm", value: -25 }] : []),
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

function chooseTrainVisualVariantId(
  train: Pick<TrainDefinition, "id" | "modelKey">,
  lengthLevel: number,
  seed: number,
): [string, number] {
  const variants = eligibleTrainVisualVariants(train, lengthLevel);
  if (variants.length === 1) return [variants[0].id, seed];
  const [roll, nextSeed] = nextRandom(seed);
  return [selectTrainVisualVariant(train, lengthLevel, roll).id, nextSeed];
}

/** Deterministically turns a true push-pull consist so either its locomotive or
 * driving trailer leads along the same left-to-right operating path. */
export function chooseTrainFormationOrientation(visualVariantId: string, seed: number): [1 | -1, number] {
  const cabCarLeadingChance = trainVisualCabCarLeadingChance(visualVariantId);
  if (cabCarLeadingChance <= 0) return [1, seed];
  const [roll, nextSeed] = nextRandom(seed);
  return [pushPullFormationOrientationForRoll(roll, cabCarLeadingChance), nextSeed];
}

export function pushPullFormationOrientationForRoll(roll: number, cabCarLeadingChance = PUSH_PULL_CAB_CAR_LEADING_CHANCE): 1 | -1 {
  const locomotiveLeadingChance = 1 - clamp(cabCarLeadingChance, 0, 1);
  return clamp(roll, 0, 0.999999999) < locomotiveLeadingChance ? 1 : -1;
}

export function nightjetFormationOrientationForRoll(roll: number): 1 | -1 {
  return pushPullFormationOrientationForRoll(roll, NIGHTJET_CAB_CAR_LEADING_CHANCE);
}

function updatePlatformLane(state: GameState, platformIndex: number, update: Partial<GameState["platformLanes"][number]>): GameState {
  return {
    ...state,
    platformLanes: state.platformLanes.map((lane) => lane.platformIndex === platformIndex ? { ...lane, ...update } : lane),
  };
}

function startTrain(state: GameState, platformIndex: number, forcedTrain?: TrainDefinition): GameState {
  const lane = state.platformLanes.find((candidate) => candidate.platformIndex === platformIndex);
  if (!lane || lane.activeTrain) return state;
  let train: TrainDefinition | undefined = forcedTrain;
  let rng = state.rng;
  const anyTrainActive = state.platformLanes.some((candidate) => candidate.activeTrain);
  const isFirst = platformIndex === 0 && !state.firstTrainComplete && !anyTrainActive && !forcedTrain;
  if (isFirst) {
    train = TRAINS.find((candidate) => candidate.id === "br650");
  }
  if (!train) {
    const eligible = eligibleTrains(state);
    if (eligible.length === 0) return updatePlatformLane(state, platformIndex, { spawnCountdown: 5 });
    [train, rng] = chooseWeightedTrain(state, eligible);
  }
  if (!train || (!isFirst && !trainMeetsRequirements(state, train))) {
    const cancelEvent = forcedTrain?.kind === "event";
    return {
      ...updatePlatformLane(state, platformIndex, { spawnCountdown: 8 }),
      eventWindow: cancelEvent ? null : state.eventWindow,
      eventRemaining: cancelEvent ? 0 : state.eventRemaining,
      eventPassesRemaining: cancelEvent ? 0 : state.eventPassesRemaining,
      eventNextPassIn: cancelEvent ? 0 : state.eventNextPassIn,
      toast: "That special train's requirements are not met yet.",
    };
  }
  const [payout, payoutSeed] = isFirst
    ? [10, rng]
    : randomInteger(rng, train.payout[0], train.payout[1]);
  const [visualVariantId, visualSeed] = chooseTrainVisualVariantId(train, state.lengthLevel, payoutSeed);
  const [formationOrientation, orientationSeed] = chooseTrainFormationOrientation(visualVariantId, visualSeed);
  const supportsCabCarLeading = trainVisualCabCarLeadingChance(visualVariantId) > 0;
  const activeTrain: ActiveTrain = {
    trainId: train.id,
    visualVariantId,
    ...(supportsCabCarLeading ? { formationOrientation } : {}),
    phase: train.kind === "event" ? "pass" : "approach",
    phaseElapsed: 0,
    phaseDuration: train.kind === "event" ? (train.id === "br01" ? 14 : 10) : 5,
    payout,
    firstService: isFirst,
  };
  return {
    ...updatePlatformLane(state, platformIndex, { activeTrain, spawnCountdown: 0 }),
    rng: orientationSeed,
    lastUpgrade: state.lastUpgrade ? { ...state.lastUpgrade, undoAvailable: false } : null,
    toast: train.kind === "event"
      ? `Special event: ${train.name} is running through platform ${platformIndex + 1}!`
      : `${train.name} is approaching platform ${platformIndex + 1}.`,
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

function completeTrain(state: GameState, platformIndex: number, active: ActiveTrain): GameState {
  const train = TRAINS.find((candidate) => candidate.id === active.trainId)!;
  const dirt = (0.8 + 0.1 * train.cars) * weatherArrivalDirtMultiplier(state.weather);
  const rating = stationRating(state);
  const interval = clamp(48 / ratingMultiplier(rating), 10, 60);
  let next: GameState = {
    ...updatePlatformLane(state, platformIndex, { activeTrain: null, spawnCountdown: interval }),
    coins: state.coins + active.payout,
    lifetimeCoins: state.lifetimeCoins + active.payout,
    cleanliness: clamp(state.cleanliness - dirt, 0, 100),
    firstTrainComplete: true,
    arrivals: state.arrivals + 1,
    servedTrainIds: state.servedTrainIds.includes(train.id) ? state.servedTrainIds : [...state.servedTrainIds, train.id],
    stormNightjetServed: state.stormNightjetServed || (train.id === "nightjet" && state.weather === "thunderstorm"),
    boosts: state.boosts,
    toast: train.kind === "event"
      ? `Platform ${platformIndex + 1}: ${train.name} completed its run-through · +${active.payout.toLocaleString()} coins`
      : `Platform ${platformIndex + 1}: ${train.name} departed · +${active.payout.toLocaleString()} coins`,
  };
  next = incrementMission(next, "serve");
  return next;
}

function advanceActiveTrain(state: GameState, platformIndex: number, delta: number): GameState {
  const active = state.platformLanes.find((lane) => lane.platformIndex === platformIndex)?.activeTrain;
  if (!active) return state;
  const elapsed = active.phaseElapsed + delta;
  if (elapsed < active.phaseDuration) {
    return updatePlatformLane(state, platformIndex, { activeTrain: { ...active, phaseElapsed: elapsed } });
  }
  const train = TRAINS.find((candidate) => candidate.id === active.trainId)!;
  if (active.phase === "pass") return completeTrain(state, platformIndex, active);
  if (active.phase === "approach") {
    const [dwell, rng] = randomInteger(state.rng, train.dwell[0], train.dwell[1]);
    return {
      ...updatePlatformLane(state, platformIndex, { activeTrain: {
        ...active,
        phase: "dwell",
        phaseElapsed: 0,
        phaseDuration: dwell * weatherDwellMultiplier(state.weather),
      } }),
      rng,
      toast: `Platform ${platformIndex + 1}: ${train.name} boarding · ${Math.ceil(dwell)}s dwell`,
    };
  }
  if (active.phase === "dwell") {
    return {
      ...updatePlatformLane(state, platformIndex, { activeTrain: { ...active, phase: "depart", phaseElapsed: 0, phaseDuration: 5 } }),
      toast: `Platform ${platformIndex + 1}: ${train.name} ready to depart.`,
    };
  }
  return completeTrain(state, platformIndex, active);
}

function dispatchEventPass(state: GameState): GameState {
  if (!state.eventWindow || state.eventPassesRemaining <= 0 || state.eventNextPassIn > 0) return state;
  const eventTrain = TRAINS.find((train) => train.id === state.eventWindow);
  const eventAlreadyRunning = state.platformLanes.some((lane) => {
    const active = lane.activeTrain;
    return active && TRAINS.find((train) => train.id === active.trainId)?.kind === "event";
  });
  const idleLane = state.platformLanes.find((lane) => !lane.activeTrain);
  if (!eventTrain || eventAlreadyRunning || !idleLane) return state;

  const started = startTrain(state, idleLane.platformIndex, eventTrain);
  if (started.platformLanes.find((lane) => lane.platformIndex === idleLane.platformIndex)?.activeTrain?.trainId !== eventTrain.id) return started;
  const remainingPasses = state.eventPassesRemaining - 1;
  return {
    ...started,
    eventPassesRemaining: remainingPasses,
    eventNextPassIn: remainingPasses > 0 ? Math.min(135, Math.max(45, state.eventRemaining / 2)) : 0,
  };
}

function beginEvent(state: GameState, eventId: "ice-s" | "br01"): GameState {
  const train = TRAINS.find((candidate) => candidate.id === eventId)!;
  const [passRoll, rng] = nextRandom(state.rng);
  const passCount = passRoll < 0.5 ? 1 : 2;
  const boost = eventId === "ice-s"
    ? { id: `ice-s-event-${state.simSeconds}`, label: "ICE-S record excitement", amount: 30, remaining: EVENT_DURATION }
    : { id: `br01-event-${state.simSeconds}`, label: "Steam festival", amount: 25, remaining: EVENT_DURATION };
  const announced: GameState = {
    ...state,
    rng,
    eventWindow: eventId,
    eventRemaining: EVENT_DURATION,
    eventPassesRemaining: passCount,
    eventNextPassIn: 0,
    boosts: [
      ...state.boosts.filter((candidate) => candidate.label !== "ICE-S record excitement" && candidate.label !== "Steam festival"),
      boost,
    ],
    toast: `${train.name}: five-minute event started · ${passCount} special run-through${passCount === 1 ? "" : "s"}!`,
  };
  return dispatchEventPass(announced);
}

function rollSeasonWeather(state: GameState): GameState {
  const [weatherRoll, seedAfterWeather] = nextRandom(state.rng);
  const [duration, seedAfterDuration] = randomInteger(seedAfterWeather, 120, 300);
  const weather = weatherFromRoll(weatherRoll);
  const [lightningDelay, seedAfterLightning] = weather === "thunderstorm"
    ? randomInteger(seedAfterDuration, 18, 45)
    : [0, seedAfterDuration];
  const seasonName = SEASONS[(state.seasonIndex + 1) % SEASONS.length];
  return {
    ...state,
    rng: seedAfterLightning,
    seasonIndex: (state.seasonIndex + 1) % SEASONS.length,
    nextSeasonAt: state.nextSeasonAt + 1_800,
    weather,
    weatherRemaining: weather === "clear" ? 0 : duration,
    nextLightningIn: lightningDelay,
    thunderDelaySeconds: 0,
    toast: weather === "thunderstorm"
      ? `${seasonName} has arrived with thunderstorms — rating and cleanliness are under pressure.`
      : weather === "rain"
        ? `${seasonName} has arrived with rain — dwell and dirt are increasing.`
        : `${seasonName} has arrived.`,
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
    eventRemaining: state.eventWindow ? Math.max(0, state.eventRemaining - delta) : 0,
    eventNextPassIn: state.eventWindow && state.eventPassesRemaining > 0 ? Math.max(0, state.eventNextPassIn - delta) : 0,
  };

  if (next.eventWindow && next.eventRemaining <= 0) {
    next = { ...next, eventWindow: null, eventPassesRemaining: 0, eventNextPassIn: 0 };
  }

  if (isWetWeather(next)) {
    next = {
      ...next,
      weatherRemaining: Math.max(0, next.weatherRemaining - delta),
      cleanliness: clamp(next.cleanliness - (weatherDirtPerMinute(next.weather) / 60) * delta, 0, 100),
    };
    if (next.weatherRemaining <= 0) {
      next = {
        ...next,
        weather: "clear",
        weatherRemaining: 0,
        nextLightningIn: 0,
        thunderDelaySeconds: 0,
        toast: "The weather has cleared.",
      };
    }
  }

  if (next.weather === "thunderstorm") {
    const timeToStrike = next.nextLightningIn - delta;
    if (timeToStrike <= 0) {
      const [nextInterval, intervalSeed] = randomInteger(next.rng, 18, 45);
      const [delayRoll, delaySeed] = nextRandom(intervalSeed);
      next = {
        ...next,
        rng: delaySeed,
        nextLightningIn: nextInterval,
        lightningStrikeId: next.lightningStrikeId + 1,
        thunderDelaySeconds: 0.8 + delayRoll * 1.6,
      };
    } else {
      next = { ...next, nextLightningIn: timeToStrike };
    }
  }

  if (next.simSeconds >= next.nextSeasonAt) next = rollSeasonWeather(next);

  next = dispatchEventPass(next);

  for (let platformIndex = 0; platformIndex < next.platforms; platformIndex += 1) {
    const lane = next.platformLanes.find((candidate) => candidate.platformIndex === platformIndex);
    if (!lane) continue;
    if (lane.activeTrain) {
      next = advanceActiveTrain(next, platformIndex, delta);
    } else {
      const spawnCountdown = lane.spawnCountdown - delta;
      next = updatePlatformLane(next, platformIndex, { spawnCountdown });
      if (spawnCountdown <= 0) next = startTrain(next, platformIndex);
    }
  }

  const crossedHour = Math.floor(state.wallSeconds / 3_600) < Math.floor(next.wallSeconds / 3_600);
  if (crossedHour && !next.eventWindow) {
    const candidates = TRAINS.filter((train) => train.kind === "event" && trainMeetsRequirements(next, train));
    if (candidates.length > 0) {
      const [roll, rng] = nextRandom(next.rng);
      next = { ...next, rng };
      if (roll < 0.35) {
        const chosen = candidates[Math.floor(roll * candidates.length) % candidates.length];
        next = beginEvent(next, chosen.id as "ice-s" | "br01");
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
  return {
    ...state,
    platformPlaced: true,
    platformLanes: [{ platformIndex: 0, spawnCountdown: 2, activeTrain: null }],
    toast: "Platform ready. A local DMU is on its way.",
  };
}

export function purchaseCost(state: GameState, action: UpgradeAction): number | null {
  if (action.kind === "platform") return PLATFORM_COSTS[state.platforms - 1] ?? null;
  if (action.kind === "length") return LENGTH_COSTS[state.lengthLevel - 1] ?? null;
  return state.systems[action.system] ? null : SYSTEMS[action.system].cost;
}

export function canPurchase(state: GameState, action: UpgradeAction): { allowed: boolean; reason?: string; cost?: number } {
  if (!state.platformPlaced) return { allowed: false, reason: "Place the free platform first." };
  if (state.tier < 5 && state.upgradesUsed >= DEVELOPMENT_CAP) return { allowed: false, reason: "Development cap reached — tier up next." };
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
      platformLanes: [
        ...state.platformLanes,
        { platformIndex: state.platforms, spawnCountdown: 6 + state.platforms * 4, activeTrain: null },
      ],
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
  if (receipt.kind === "platform") {
    const platforms = receipt.previous as number;
    next = { ...next, platforms, platformLanes: next.platformLanes.filter((lane) => lane.platformIndex < platforms) };
  }
  if (receipt.kind === "length") next = { ...next, lengthLevel: receipt.previous as number };
  if (receipt.kind === "system") next = { ...next, systems: { ...next.systems, [receipt.key]: false } };
  return next;
}

export function tierUp(state: GameState): GameState {
  if (state.tier >= 5) return { ...state, toast: "Tier 5 is the international terminus." };
  if (state.upgradesUsed < DEVELOPMENT_CAP) {
    const remaining = DEVELOPMENT_CAP - state.upgradesUsed;
    return { ...state, toast: `Use ${remaining} more development slot${remaining === 1 ? "" : "s"} first.` };
  }
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
    {
      ...state,
      coins: state.coins - cost,
      cleanliness: 100,
      cleanedFromCritical: state.cleanedFromCritical || state.cleanliness <= 20,
      toast: `Station cleaned · −${cost.toLocaleString()} coins`,
    },
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
  if (state.eventWindow) return { ...state, toast: "A special event is already underway." };
  if (!trainMeetsRequirements(state, train)) {
    return { ...state, toast: `${train.name} is locked — check its requirements.` };
  }
  return beginEvent(state, eventId);
}

export function prestigeStation(state: GameState): GameState {
  if (state.tier < 5) return { ...state, toast: "Reach Tier 5 before prestiging." };
  const next = createInitialState(state.prestige + 1);
  return {
    ...next,
    region: "germany",
    unlockedBadges: state.unlockedBadges,
    toast: `Prestige ${next.prestige}: permanent +${next.prestige * 5} rating.`,
  };
}

export function debugState(
  state: GameState,
  mode: "tier5" | "rain" | "thunderstorm" | "night" | "dirty" | "railjet-classic" | "railjet-classic-cab-car" | "railjet-nextgen" | "railjet-nextgen-cab-car" | "nightjet-taurus" | "nightjet-cab-car" | "ice3-unified",
): GameState {
  if (mode === "ice3-unified") {
    const ready = debugState(state, "tier5");
    return {
      ...ready,
      platformLanes: ready.platformLanes.map((lane) => lane.platformIndex === 0 ? {
        ...lane,
        spawnCountdown: 0,
        activeTrain: {
          trainId: "ice3",
          visualVariantId: "ice3-br403-unified",
          phase: "approach",
          phaseElapsed: 0,
          phaseDuration: 5,
          payout: 3_200,
          firstService: false,
        },
      } : lane),
      toast: "Debug: approved ICE 3 Class 403 approaching.",
    };
  }
  if (mode === "nightjet-taurus" || mode === "nightjet-cab-car") {
    const ready = debugState(state, "tier5");
    return {
      ...ready,
      simSeconds: Math.floor(ready.simSeconds / 900) * 900 + 610,
      platformLanes: ready.platformLanes.map((lane) => lane.platformIndex === 0 ? {
        ...lane,
        spawnCountdown: 0,
        activeTrain: {
          trainId: "nightjet",
          visualVariantId: "nightjet-new-generation",
          formationOrientation: mode === "nightjet-taurus" ? 1 : -1,
          phase: "approach",
          phaseElapsed: 0,
          phaseDuration: 5,
          payout: 20_000,
          firstService: false,
        },
      } : lane),
      toast: `Debug: Nightjet approaching with ${mode === "nightjet-taurus" ? "Taurus" : "cab car"} leading.`,
    };
  }
  if (mode === "railjet-classic" || mode === "railjet-classic-cab-car" || mode === "railjet-nextgen" || mode === "railjet-nextgen-cab-car") {
    const ready = debugState(state, "tier5");
    const isClassic = mode.startsWith("railjet-classic");
    const cabCarLeading = mode.endsWith("cab-car");
    return {
      ...ready,
      platformLanes: ready.platformLanes.map((lane) => lane.platformIndex === 0 ? {
        ...lane,
        spawnCountdown: 0,
        activeTrain: {
          trainId: "railjet",
          visualVariantId: isClassic ? "railjet-classic" : "railjet-nextgen",
          formationOrientation: cabCarLeading ? -1 : 1,
          phase: "approach",
          phaseElapsed: 0,
          phaseDuration: 5,
          payout: 7_500,
          firstService: false,
        },
      } : lane),
      toast: `Debug: ${isClassic ? "classic" : "new-generation"} Railjet approaching with ${cabCarLeading ? "cab car" : "Taurus"} leading.`,
    };
  }
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
      platformLanes: Array.from({ length: 5 }, (_, platformIndex) => ({
        platformIndex,
        spawnCountdown: 2 + platformIndex * 3,
        activeTrain: null,
      })),
      toast: "Debug: Tier 5 station ready.",
    };
  }
  if (mode === "rain") return { ...state, weather: "rain", weatherRemaining: 180, nextLightningIn: 0, thunderDelaySeconds: 0, toast: "Debug: rain started." };
  if (mode === "thunderstorm") return {
    ...state,
    weather: "thunderstorm",
    weatherRemaining: 180,
    nextLightningIn: 0.1,
    thunderDelaySeconds: 1.2,
    toast: "Debug: thunderstorm started.",
  };
  if (mode === "night") return { ...state, simSeconds: Math.floor(state.simSeconds / 900) * 900 + 610, toast: "Debug: night lighting active." };
  return { ...state, cleanliness: 22, toast: "Debug: heavy station dirt applied." };
}
