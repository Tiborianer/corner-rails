export function catenaryPolePositions(length: number): number[] {
  const count = Math.max(2, Math.ceil(length / 6));
  return Array.from(
    { length: count },
    (_, index) => -length / 2 + 2.2 + (index / (count - 1)) * (length - 4.4),
  );
}

export const TRAFFIC_CAR_KINDS = [
  "sedan",
  "hatch",
  "suv",
  "van",
  "pickup",
  "coupe",
  "taxi",
  "estate",
  "micro",
  "delivery",
  "fastback",
  "compact",
] as const;

export type TrafficVehicleKind =
  | "hatchback"
  | "sedan"
  | "estate"
  | "coupe"
  | "suv"
  | "taxi"
  | "minivan"
  | "delivery-van"
  | "service-van"
  | "pickup"
  | "box-truck"
  | "city-bus";

export interface TrafficVehicleDefinition {
  id: TrafficVehicleKind;
  length: number;
  width: number;
  height: number;
  stopEligible: boolean;
  color: string;
  accent: string;
}

export interface TrafficVehicleState {
  definitionIndex: number;
  lane: 0 | 1;
  direction: 1 | -1;
  x: number;
  lateralOffset: number;
  phase: "through" | "entering" | "dwelling" | "waiting-to-merge" | "merging";
  dwellRemaining: number;
  lap: number;
}

export const TRAFFIC_VEHICLE_DEFINITIONS: readonly TrafficVehicleDefinition[] = [
  { id: "hatchback", length: 0.34, width: 0.15, height: 0.13, stopEligible: true, color: "#305e8c", accent: "#b9d4df" },
  { id: "sedan", length: 0.42, width: 0.155, height: 0.135, stopEligible: true, color: "#d34e3f", accent: "#c7dce4" },
  { id: "estate", length: 0.46, width: 0.16, height: 0.145, stopEligible: true, color: "#475851", accent: "#b8d0d7" },
  { id: "coupe", length: 0.4, width: 0.155, height: 0.115, stopEligible: true, color: "#b98237", accent: "#c6dbe2" },
  { id: "suv", length: 0.44, width: 0.17, height: 0.18, stopEligible: true, color: "#8c3153", accent: "#b8d1da" },
  { id: "taxi", length: 0.41, width: 0.155, height: 0.145, stopEligible: true, color: "#e3b832", accent: "#182225" },
  { id: "minivan", length: 0.48, width: 0.17, height: 0.2, stopEligible: true, color: "#547e72", accent: "#b5d1da" },
  { id: "delivery-van", length: 0.53, width: 0.18, height: 0.23, stopEligible: true, color: "#e8e2d1", accent: "#315c83" },
  { id: "service-van", length: 0.5, width: 0.18, height: 0.22, stopEligible: true, color: "#c5cbd0", accent: "#e2852e" },
  { id: "pickup", length: 0.48, width: 0.17, height: 0.16, stopEligible: false, color: "#273f62", accent: "#b9d4df" },
  { id: "box-truck", length: 0.72, width: 0.2, height: 0.3, stopEligible: false, color: "#f0eee5", accent: "#2c6387" },
  { id: "city-bus", length: 0.9, width: 0.21, height: 0.28, stopEligible: true, color: "#b52835", accent: "#e9d7b3" },
] as const;

export const TRAFFIC_ROAD_MIN_X = -32;
export const TRAFFIC_ROAD_MAX_X = 32;
export const TRAFFIC_MINIMUM_GAP = 0.28;
export const TRAFFIC_BAY_OFFSET = 0.44;

export function createTrafficFleet(): TrafficVehicleState[] {
  const perLane = TRAFFIC_VEHICLE_DEFINITIONS.length / 2;
  return TRAFFIC_VEHICLE_DEFINITIONS.map((_, definitionIndex) => {
    const lane = (definitionIndex % 2) as 0 | 1;
    const slot = Math.floor(definitionIndex / 2);
    const direction = lane === 0 ? 1 : -1;
    const progress = (slot + 0.35 * lane) / perLane;
    return {
      definitionIndex,
      lane,
      direction,
      x: direction === 1
        ? TRAFFIC_ROAD_MIN_X + progress * (TRAFFIC_ROAD_MAX_X - TRAFFIC_ROAD_MIN_X)
        : TRAFFIC_ROAD_MAX_X - progress * (TRAFFIC_ROAD_MAX_X - TRAFFIC_ROAD_MIN_X),
      lateralOffset: 0,
      phase: "through",
      dwellRemaining: 0,
      lap: 0,
    };
  });
}

/** Procedural road vehicles are authored with their recognizable front facing -X. */
export function trafficVehicleYaw(direction: 1 | -1) {
  return direction > 0 ? Math.PI : 0;
}

function crossesPoint(previous: number, next: number, point: number, direction: 1 | -1) {
  return direction === 1 ? previous < point && next >= point : previous > point && next <= point;
}

function mergeIsClear(fleet: TrafficVehicleState[], vehicle: TrafficVehicleState, stopX: number) {
  const own = TRAFFIC_VEHICLE_DEFINITIONS[vehicle.definitionIndex];
  return fleet.every((candidate) => {
    if (candidate === vehicle || candidate.lane !== vehicle.lane || candidate.phase === "dwelling" || candidate.phase === "waiting-to-merge") return true;
    const other = TRAFFIC_VEHICLE_DEFINITIONS[candidate.definitionIndex];
    const required = (own.length + other.length) / 2 + TRAFFIC_MINIMUM_GAP;
    return Math.abs(candidate.x - stopX) >= required;
  });
}

export function trafficLaneClearances(fleet: readonly TrafficVehicleState[]): number[] {
  return ([0, 1] as const).flatMap((lane) => {
    const direction = lane === 0 ? 1 : -1;
    const active = fleet
      .filter((vehicle) => vehicle.lane === lane && vehicle.phase !== "dwelling" && vehicle.phase !== "waiting-to-merge")
      .sort((a, b) => direction * (a.x - b.x));
    return active.slice(1).map((vehicle, index) => {
      const previous = active[index];
      const previousLength = TRAFFIC_VEHICLE_DEFINITIONS[previous.definitionIndex].length;
      const vehicleLength = TRAFFIC_VEHICLE_DEFINITIONS[vehicle.definitionIndex].length;
      return direction * (vehicle.x - previous.x) - (previousLength + vehicleLength) / 2;
    });
  });
}

export function stepTrafficFleet(
  current: readonly TrafficVehicleState[],
  wallDelta: number,
  simulationSpeed: 1 | 2 | 3,
  stopX = -4.2,
): TrafficVehicleState[] {
  const delta = Math.max(0, wallDelta) * simulationSpeed;
  const bayOccupied = current.some((vehicle) => vehicle.phase !== "through");
  let bayClaimed = bayOccupied;
  const next = current.map((vehicle) => ({ ...vehicle }));

  next.forEach((vehicle) => {
    const definition = TRAFFIC_VEHICLE_DEFINITIONS[vehicle.definitionIndex];
    const laneSpeed = vehicle.lane === 0 ? 1.85 : 1.7;
    const previousX = vehicle.x;

    if (vehicle.phase === "dwelling") {
      vehicle.dwellRemaining = Math.max(0, vehicle.dwellRemaining - delta);
      if (vehicle.dwellRemaining <= 0) vehicle.phase = "waiting-to-merge";
      return;
    }
    if (vehicle.phase === "waiting-to-merge") {
      if (mergeIsClear(next, vehicle, vehicle.x)) vehicle.phase = "merging";
      return;
    }
    if (vehicle.phase === "entering") {
      vehicle.x += vehicle.direction * laneSpeed * delta;
      vehicle.lateralOffset = Math.min(TRAFFIC_BAY_OFFSET, vehicle.lateralOffset + delta * 0.7);
      if (vehicle.lateralOffset >= TRAFFIC_BAY_OFFSET) {
        vehicle.phase = "dwelling";
        vehicle.dwellRemaining = 3 + ((vehicle.definitionIndex + vehicle.lap * 3) % 5);
      }
      return;
    }
    if (vehicle.phase === "merging") {
      vehicle.x += vehicle.direction * laneSpeed * delta;
      vehicle.lateralOffset = Math.max(0, vehicle.lateralOffset - delta * 0.7);
      if (vehicle.lateralOffset <= 0) vehicle.phase = "through";
      return;
    }

    vehicle.x += vehicle.direction * laneSpeed * delta;
    const crossedExit = vehicle.direction === 1 ? vehicle.x > TRAFFIC_ROAD_MAX_X : vehicle.x < TRAFFIC_ROAD_MIN_X;
    if (crossedExit) {
      vehicle.x = vehicle.direction === 1 ? TRAFFIC_ROAD_MIN_X : TRAFFIC_ROAD_MAX_X;
      vehicle.lap += 1;
    }
    const shouldStop =
      vehicle.lane === 0 &&
      definition.stopEligible &&
      !bayClaimed &&
      (vehicle.definitionIndex + vehicle.lap) % 2 === 0 &&
      crossesPoint(previousX, vehicle.x, stopX, vehicle.direction);
    if (shouldStop) {
      vehicle.phase = "entering";
      bayClaimed = true;
    }
  });
  return next;
}

export type LitterKind = "paper" | "cup" | "can" | "bottle" | "carton" | "leaf" | "bag";

export interface LitterPiece {
  kind: LitterKind;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  colorIndex: number;
}

function seededUnit(seed: number) {
  const mixed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4_294_967_296;
}

export function seededLitterLayout(
  cleanliness: number,
  platformZs: readonly number[],
  length: number,
  platformWidth: number,
): LitterPiece[] {
  if (cleanliness >= 99.5 || platformZs.length === 0) return [];
  const perPlatform = Math.min(12, Math.ceil((100 - Math.max(0, cleanliness)) / 8.34));
  const kinds: readonly LitterKind[] = ["paper", "cup", "can", "bottle", "carton", "leaf", "bag"];
  return platformZs.flatMap((platformZ, platformIndex) => Array.from({ length: perPlatform }, (_, itemIndex) => {
    const seed = 0x43a51 + platformIndex * 2_003 + itemIndex * 7_919;
    const xRange = Math.max(0.2, length - 0.8);
    const zRange = Math.max(0.04, platformWidth - 0.16);
    return {
      kind: cleanliness < 35 && itemIndex >= perPlatform - 2 ? "bag" : kinds[Math.floor(seededUnit(seed + 3) * kinds.length)],
      x: -xRange / 2 + seededUnit(seed + 11) * xRange,
      z: platformZ - zRange / 2 + seededUnit(seed + 29) * zRange,
      rotation: seededUnit(seed + 47) * Math.PI * 2,
      scale: 0.78 + seededUnit(seed + 61) * 0.44,
      colorIndex: Math.floor(seededUnit(seed + 79) * 5),
    };
  }));
}

export const PLATFORM_FIXTURE_RATIOS = [-0.36, -0.12, 0.12, 0.36] as const;
export const PLATFORM_POINT_LIGHT_RATIOS = [-0.24, 0.24] as const;

export function platformFixturePositions(platformZs: readonly number[], platformLength: number) {
  return platformZs.flatMap((z) => PLATFORM_FIXTURE_RATIOS.map((ratio) => ({ x: ratio * platformLength, z })));
}

export function platformPointLightPositions(
  platformZs: readonly number[],
  platformLength: number,
  mobile = false,
  platformWidth = 0,
) {
  const ratios: readonly number[] = mobile ? [PLATFORM_FIXTURE_RATIOS[2]] : [PLATFORM_FIXTURE_RATIOS[1], PLATFORM_FIXTURE_RATIOS[2]];
  return platformZs.flatMap((z) => ratios.map((ratio, index) => ({
    x: ratio * platformLength,
    z: z + (mobile ? 1 : index === 0 ? -1 : 1) * platformWidth * 0.25,
  })));
}

export function platformSignalPositions(
  trackCenters: readonly number[],
  platformLength: number,
  lateralClearance: number,
) {
  const x = platformLength / 2 + 0.28;
  return trackCenters.map((trackCenter) => ({ x, z: trackCenter - lateralClearance }));
}

export function maintenanceSidingControlPoints({
  trackLength,
  platformLength,
  rearTrackZ,
  depotZ,
  depotCenterX,
}: {
  trackLength: number;
  platformLength: number;
  rearTrackZ: number;
  depotZ: number;
  depotCenterX: number;
}) {
  const turnoutX = platformLength / 2 + 1.5;
  return [
    { x: trackLength / 2, z: rearTrackZ },
    { x: turnoutX + 4, z: rearTrackZ },
    { x: turnoutX, z: rearTrackZ },
    { x: turnoutX - 1.8, z: rearTrackZ - 0.22 },
    { x: depotCenterX + 3.2, z: depotZ },
    { x: depotCenterX - 0.45, z: depotZ },
  ] as const;
}

export function trainMotionPosition(
  phase: "approach" | "dwell" | "depart" | "pass",
  elapsed: number,
  duration: number,
  entryX: number,
  stationX: number,
  exitX: number,
): number {
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(0.001, duration)));
  if (phase === "pass") {
    const eased = progress * progress * (3 - 2 * progress);
    return entryX + (exitX - entryX) * eased;
  }
  if (phase === "approach") return entryX + (stationX - entryX) * (1 - Math.pow(1 - progress, 3));
  if (phase === "depart") return stationX + (exitX - stationX) * progress * progress;
  return stationX;
}
