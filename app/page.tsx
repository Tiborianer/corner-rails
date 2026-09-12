import CornerRails from "./CornerRails";
import RailjetLab, { type RailjetLabInitialState } from "./game/RailjetLab";
import TrainReviewLab, { type TrainReviewLabInitialState } from "./game/TrainReviewLab";

function queryValue<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && allowed.includes(candidate as T) ? candidate as T : fallback;
}

function numericQueryValue(value: string | string[] | undefined, fallback: number) {
  const candidate = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(candidate) ? Math.max(0, Math.min(candidate, 60)) : fallback;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const parameters = await searchParams;
  const trainLab = Array.isArray(parameters.trainLab) ? parameters.trainLab[0] : parameters.trainLab;
  if (trainLab === "metronom-br146-flat" || trainLab === "db-regional-express-r3" || trainLab === "metronom-br146" || trainLab === "railjet-classic-livery-v2" || trainLab === "railjet-nextgen-livery-v2" || trainLab === "db-regional-express" || trainLab === "nightjet-new-generation" || trainLab === "ice3-br403-v2-unified") {
    const captureMode = queryValue(parameters.capture, ["0", "1"], "0") === "1";
    const initialState: TrainReviewLabInitialState = {
      candidateId: trainLab,
      motion: queryValue(parameters.motion, ["stationary", "stopping", "pass"], "stationary"),
      atmosphere: queryValue(parameters.atmosphere, ["day", "night", "rain"], "day"),
      scale: queryValue(parameters.scale, ["normal", "inspect"], "normal"),
      loadCount: queryValue(parameters.load, ["1", "3"], "1") === "3" ? 3 : 1,
      leadingEnd: queryValue(parameters.leading, ["taurus", "cab-car"], "taurus"),
      captureMode,
      capturePhaseSeconds: numericQueryValue(parameters.phase, 0),
      freezeMotion: captureMode && queryValue(parameters.freeze, ["0", "1"], "0") === "1",
    };
    const stateKey = [initialState.candidateId, initialState.motion, initialState.atmosphere, initialState.scale, initialState.loadCount, initialState.leadingEnd, Number(initialState.captureMode), initialState.capturePhaseSeconds, Number(initialState.freezeMotion)].join(":");
    return <TrainReviewLab key={stateKey} initialState={initialState} />;
  }
  const reviewMode = trainLab === "railjet";
  if (parameters.railjetLab !== "1" && !reviewMode) {
    const legacyVisuals = parameters.debug === "1" && parameters.visuals === "legacy";
    return <CornerRails legacyVisuals={legacyVisuals} />;
  }
  const requestedVariant = Array.isArray(parameters.variant) ? parameters.variant[0] : parameters.variant;
  const captureMode = queryValue(parameters.capture, ["0", "1"], "0") === "1";
  const initialState: RailjetLabInitialState = {
    generation: reviewMode
      ? requestedVariant === "railjet-nextgen" ? "nextgen" : "classic"
      : queryValue(parameters.generation, ["classic", "nextgen"], "classic"),
    method: reviewMode
      ? "blender-3d"
      : queryValue(parameters.method, ["generated-2d", "vector-2d", "hybrid-3d", "blender-3d"], "generated-2d"),
    motion: queryValue(parameters.motion, ["stationary", "stopping", "pass"], "stationary"),
    atmosphere: queryValue(parameters.atmosphere, ["day", "night", "rain"], "day"),
    scale: queryValue(parameters.scale, ["normal", "inspect"], "normal"),
    loadCount: queryValue(parameters.load, ["1", "3"], "1") === "3" ? 3 : 1,
    captureMode,
    capturePhaseSeconds: numericQueryValue(parameters.phase, 0),
    freezeMotion: captureMode && queryValue(parameters.freeze, ["0", "1"], "0") === "1",
  };
  const labStateKey = [initialState.generation, initialState.method, initialState.motion, initialState.atmosphere, initialState.scale, initialState.loadCount, Number(initialState.captureMode), initialState.capturePhaseSeconds, Number(initialState.freezeMotion)].join(":");
  return <RailjetLab key={labStateKey} initialState={initialState} reviewMode={reviewMode} />;
}
