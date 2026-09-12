"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { AmbientLight, DirectionalLight, Fog, Group, HemisphereLight, Object3D, PointLight, Points, SpotLight } from "three";
import { ACESFilmicToneMapping, Box3, CatmullRomCurve3, Color, MathUtils, Vector3 } from "three";
import { TRAINS } from "./data";
import { RoadsideNeighborhood, Wildlife, Woodland } from "./Scenery";
import {
  MetricCatenary,
  MetricContactShadow,
  MetricPlatform,
  MetricTrack,
  PRODUCTION_TRACK_CENTER_SPACING_METERS,
  RAILWAY_GROUND_Y,
  RAILWAY_METRIC_PROFILE,
  metricPlatformCenter,
  platformLengthMeters,
  productionTrackCenter,
  railwayMetersToWorld,
} from "./metricRailway";
import { daylightFactor, isNight, isWetWeather } from "./simulation";
import { resolveTrainVisualVariant, trainVisualAssetUrl } from "./trainVisuals";
import type { ActiveTrain, GameState } from "./types";
import {
  TRAFFIC_VEHICLE_DEFINITIONS,
  createTrafficFleet,
  maintenanceSidingControlPoints,
  platformPointLightPositions,
  platformSignalPositions,
  seededLitterLayout,
  stepTrafficFleet,
  trafficVehicleYaw,
  trainMotionPosition,
  type LitterKind,
  type TrafficVehicleDefinition,
  type TrafficVehicleState,
} from "./visual";

interface SceneProps {
  state: GameState;
  onPlacePlatform: () => void;
  onBirdCall?: () => void;
}

const seasonGround = ["#78945c", "#6f9958", "#9b8050", "#b8c3bf"];
const trackLength = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.trackLengthMeters);
const platformSurfaceY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformHeightMeters);

function LockedMetricCamera({ trackCount, focusZ, sceneDepth }: { trackCount: number; focusZ: number; sceneDepth: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0, 0.43, focusZ);
    if (!("zoom" in camera)) return;
    camera.updateMatrixWorld(true);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const trackWidth = railwayMetersToWorld(
      Math.max(1, trackCount - 1) * PRODUCTION_TRACK_CENTER_SPACING_METERS +
      RAILWAY_METRIC_PROFILE.vehicleWidthMeters +
      RAILWAY_METRIC_PROFILE.platformWidthMeters * 1.8,
    );
    const stationWidth = Math.max(trackWidth, sceneDepth);
    const halfExtents = new Vector3(
      railwayMetersToWorld(RAILWAY_METRIC_PROFILE.productionCameraLengthMeters) / 2,
      railwayMetersToWorld(RAILWAY_METRIC_PROFILE.catenaryContactHeightMeters + 1.4) / 2,
      stationWidth / 2,
    );
    const projectedHalfWidth = Math.abs(right.x) * halfExtents.x + Math.abs(right.y) * halfExtents.y + Math.abs(right.z) * halfExtents.z;
    const projectedHalfHeight = Math.abs(up.x) * halfExtents.x + Math.abs(up.y) * halfExtents.y + Math.abs(up.z) * halfExtents.z;
    const margin = size.width < 620 ? 1.22 : 1.12;
    camera.zoom = Math.min(
      size.width / (2 * projectedHalfWidth * margin),
      size.height / (2 * projectedHalfHeight * margin),
    );
    camera.updateProjectionMatrix();
  }, [camera, focusZ, sceneDepth, size.height, size.width, trackCount]);
  return null;
}

function Box({ position, scale, color, rotation, castShadow = true }: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  castShadow?: boolean;
}) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow={castShadow} receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.08} />
    </mesh>
  );
}

function Atmosphere({ state }: { state: GameState }) {
  const ambient = useRef<AmbientLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const fog = useRef<Fog>(null);
  const visualDaylight = useRef(daylightFactor(state.simSeconds));
  const daySky = useMemo(() => new Color("#a8d2df"), []);
  const rainSky = useMemo(() => new Color("#637c82"), []);
  const stormSky = useMemo(() => new Color("#263744"), []);
  const nightSky = useMemo(() => new Color("#101b2d"), []);
  const duskSky = useMemo(() => new Color("#be7968"), []);
  const sky = useMemo(() => new Color(), []);
  const daySun = useMemo(() => new Color("#fff0bd"), []);
  const nightSun = useMemo(() => new Color("#9db2dd"), []);
  const dayHemi = useMemo(() => new Color("#dcf1fb"), []);
  const nightHemi = useMemo(() => new Color("#2f4167"), []);
  const lightningColor = useMemo(() => new Color("#dfeeff"), []);
  const flash = useRef(0);
  const previousStrike = useRef(state.lightningStrikeId);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame(({ gl, scene }, delta) => {
    if (state.lightningStrikeId !== previousStrike.current) {
      previousStrike.current = state.lightningStrikeId;
      flash.current = reducedMotion ? 0.75 : 4;
    }
    flash.current = MathUtils.damp(flash.current, 0, reducedMotion ? 4.5 : 6, delta);
    const target = daylightFactor(state.simSeconds);
    visualDaylight.current = MathUtils.damp(visualDaylight.current, target, 2.4, delta);
    const daylight = visualDaylight.current;
    const transitionGlow = 1 - Math.abs(daylight * 2 - 1);
    const weatherSky = state.weather === "thunderstorm" ? stormSky : state.weather === "rain" ? rainSky : daySky;
    sky.copy(nightSky).lerp(weatherSky, daylight).lerp(duskSky, transitionGlow * (isWetWeather(state) ? 0.12 : 0.34));
    if (flash.current > 0.01) sky.lerp(lightningColor, Math.min(0.82, flash.current * 0.24));
    gl.setClearColor(sky);
    scene.background = sky;
    if (fog.current) fog.current.color.copy(sky);
    if (ambient.current) {
      ambient.current.intensity = MathUtils.lerp(0.42, 1.35, daylight) + flash.current * 0.46;
      ambient.current.color.copy(nightSun).lerp(daySun, daylight);
    }
    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(0.72, 2.25, daylight) + flash.current * 0.85;
      sun.current.color.copy(nightSun).lerp(daySun, daylight);
      sun.current.position.y = MathUtils.lerp(5, 13, daylight);
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = MathUtils.lerp(0.5, 1.05, daylight) + flash.current * 0.2;
      hemisphere.current.color.copy(nightHemi).lerp(dayHemi, daylight);
    }
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={["#a8d2df", 34, 72]} />
      <ambientLight ref={ambient} intensity={1.35} color="#fff0d2" />
      <directionalLight ref={sun} position={[-7, 13, -5]} intensity={2.25} color="#fff0bd" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight ref={hemisphere} args={["#dcf1fb", seasonGround[state.seasonIndex], 1.05]} />
    </>
  );
}

function PlatformLightPool({ state, platformZs, platformLength }: { state: GameState; platformZs: number[]; platformLength: number }) {
  const { size } = useThree();
  const lights = useRef<Array<PointLight | null>>([]);
  const fill = useRef<DirectionalLight>(null);
  const fillTarget = useRef<Object3D>(null);
  const platformWidth = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters);
  const positions = useMemo(
    () => platformPointLightPositions(platformZs, platformLength, size.width < 620, platformWidth),
    [platformLength, platformWidth, platformZs, size.width],
  );
  const visualIntensity = useRef(0);
  const fillIntensity = useRef(0);
  const averagePlatformZ = platformZs.reduce((sum, z) => sum + z, 0) / Math.max(1, platformZs.length);
  const averageTrackZ = averagePlatformZ - railwayMetersToWorld(
    RAILWAY_METRIC_PROFILE.vehicleWidthMeters / 2 +
    RAILWAY_METRIC_PROFILE.platformEdgeClearanceMeters +
    RAILWAY_METRIC_PROFILE.platformWidthMeters / 2,
  );
  useEffect(() => {
    if (fill.current && fillTarget.current) fill.current.target = fillTarget.current;
  }, []);
  useFrame((_, delta) => {
    const darkness = 1 - daylightFactor(state.simSeconds);
    const weatherBoost = state.weather === "thunderstorm" ? 0.12 : state.weather === "rain" ? 0.07 : 0;
    const target = darkness * 0.18 + weatherBoost;
    const fillTargetIntensity = darkness * 0.58 + weatherBoost * 1.6;
    visualIntensity.current = MathUtils.damp(visualIntensity.current, target, 2.6, delta);
    fillIntensity.current = MathUtils.damp(fillIntensity.current, fillTargetIntensity, 2.6, delta);
    lights.current.forEach((light) => { if (light) light.intensity = visualIntensity.current; });
    if (fill.current) fill.current.intensity = fillIntensity.current;
  });
  return (
    <group>
      <object3D ref={fillTarget} position={[0, RAILWAY_METRIC_PROFILE.railTopY + 0.19, averageTrackZ]} />
      <directionalLight
        ref={fill}
        position={[0, platformSurfaceY + 0.48, averagePlatformZ]}
        intensity={0}
        color="#ffd99a"
      />
      {positions.map((position, index) => (
        <pointLight key={`${position.x}-${position.z}`} ref={(node) => { lights.current[index] = node; }} position={[position.x, platformSurfaceY + 0.215, position.z]} intensity={0} distance={1.25} decay={2} color="#ffd99a" />
      ))}
    </group>
  );
}

function StationBuilding({ tier, daylight, z }: { tier: number; daylight: number; z: number }) {
  if (tier < 2) return null;
  const baseY = RAILWAY_GROUND_Y;
  const windowColor = new Color("#ffd878").lerp(new Color("#547482"), daylight).getStyle();
  if (tier >= 5) {
    const bodyBottom = baseY + 0.12;
    return (
      <group position={[-4.1, 0, z]}>
        <Box position={[0, baseY + 0.06, 0]} scale={[5.5, 0.12, 1.62]} color="#858a86" />
        <Box position={[0, baseY + 0.025, -1.25]} scale={[6.3, 0.05, 1.35]} color="#b8bab4" castShadow={false} />
        <Box position={[-0.35, bodyBottom + 0.46, 0]} scale={[4.75, 0.92, 1.35]} color="#d8d9d5" />
        <Box position={[0.75, bodyBottom + 1.02, -0.03]} scale={[3.1, 0.32, 1.15]} color="#b9c5c7" />
        <Box position={[-0.35, bodyBottom + 0.94, 0]} scale={[5.15, 0.1, 1.55]} color="#37494e" />
        <Box position={[0.75, bodyBottom + 1.24, -0.03]} scale={[3.45, 0.08, 1.35]} color="#304348" />
        <mesh position={[-0.25, bodyBottom + 0.51, 0.686]} castShadow>
          <boxGeometry args={[4.15, 0.58, 0.045]} />
          <meshStandardMaterial color="#426d79" emissive={windowColor} emissiveIntensity={1.1 + (1 - daylight) * 1.8} metalness={0.2} roughness={0.28} />
        </mesh>
        {[-1.7, -0.85, 0, 0.85, 1.7].map((x) => (
          <Box key={x} position={[x - 0.25, bodyBottom + 0.51, 0.72]} scale={[0.045, 0.62, 0.035]} color="#d9dedc" />
        ))}
        <Box position={[-0.35, bodyBottom + 0.3, 0.735]} scale={[0.72, 0.6, 0.06]} color="#21424d" />
        <Box position={[-0.35, bodyBottom + 0.68, 1.02]} scale={[4.9, 0.08, 0.66]} color="#53666a" />
        {[-2.2, 0, 2.2].map((x) => <Box key={x} position={[x - 0.35, bodyBottom + 0.34, 0.93]} scale={[0.06, 0.68, 0.06]} color="#47585b" />)}
        <Box position={[-0.35, bodyBottom + 1.15, 0.73]} scale={[2.3, 0.3, 0.05]} color="#f0eee8" />
        <Box position={[-0.35, bodyBottom + 1.15, 0.765]} scale={[1.65, 0.055, 0.025]} color="#b51f2e" />
        <mesh position={[-2.1, bodyBottom + 0.48, 0.74]}>
          <boxGeometry args={[0.38, 0.38, 0.03]} />
          <meshStandardMaterial color="#fff1bd" emissive="#ffd67a" emissiveIntensity={1.5 + (1 - daylight) * 2} toneMapped={false} />
        </mesh>
      </group>
    );
  }
  const width = 1.45 + tier * 0.2;
  const height = 0.44 + tier * 0.1;
  const bodyBottom = baseY + 0.12;
  const bodyTop = bodyBottom + height;
  return (
    <group position={[-4.8, 0, z]}>
      <Box position={[0, baseY + 0.06, 0]} scale={[width + 0.25, 0.12, 0.92]} color="#8e8779" />
      <Box position={[0, bodyBottom + height / 2, 0]} scale={[width, height, 0.78]} color={tier >= 5 ? "#ede3c9" : "#d1b98e"} />
      <Box position={[0, bodyTop + 0.09, -0.19]} scale={[width + 0.2, 0.08, 0.54]} color="#32494c" rotation={[0.32, 0, 0]} />
      <Box position={[0, bodyTop + 0.09, 0.19]} scale={[width + 0.2, 0.08, 0.54]} color="#32494c" rotation={[-0.32, 0, 0]} />
      <Box position={[0.36, bodyBottom + 0.24, 0.405]} scale={[0.3, 0.48, 0.04]} color="#2b4a55" />
      <Box position={[-0.4, bodyBottom + 0.27, 0.405]} scale={[0.3, 0.24, 0.04]} color={windowColor} />
      <Box position={[0, bodyTop + 0.28, 0.46]} scale={[0.8, 0.22, 0.04]} color="#f0e9d7" />
      <Box position={[0, bodyTop + 0.28, 0.49]} scale={[0.5, 0.04, 0.02]} color="#b51f2e" />
      <Box position={[0.36, baseY + 0.05, 0.62]} scale={[0.56, 0.1, 0.3]} color="#bbb3a1" />
      <Box position={[0, baseY + 0.025, 0.94]} scale={[width + 0.85, 0.05, 0.72]} color="#b8b09d" castShadow={false} />
    </group>
  );
}

function Signal({ advanced, x, z }: { advanced: boolean; x: number; z: number }) {
  return (
    <group position={[x, RAILWAY_GROUND_Y, z]}>
      <Box position={[0, 0.24, 0]} scale={[0.035, 0.48, 0.035]} color="#313a39" />
      <Box position={[0, 0.5, 0]} scale={[0.13, 0.22, 0.11]} color="#202827" />
      <mesh position={[0, 0.55, -0.065]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial emissive="#71ed9b" emissiveIntensity={3} color="#71ed9b" /></mesh>
      {advanced && <Box position={[0, 0.7, 0]} scale={[0.2, 0.03, 0.03]} color="#77c8dd" />}
    </group>
  );
}

function TrafficWheels({ definition }: { definition: TrafficVehicleDefinition }) {
  const axleOffset = definition.length * (definition.id === "city-bus" ? 0.34 : definition.id === "box-truck" ? 0.32 : 0.3);
  const radius = definition.id === "city-bus" || definition.id === "box-truck" ? 0.052 : 0.038;
  return <group>{[-axleOffset, axleOffset].map((x) => [-definition.width * 0.48, definition.width * 0.48].map((z) => (
    <mesh key={`${x}-${z}`} position={[x, radius, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[radius, radius, 0.028, 12]} /><meshStandardMaterial color="#151b1c" roughness={0.8} /></mesh>
  )))}</group>;
}

function TrafficVehicle({ definition }: { definition: TrafficVehicleDefinition }) {
  const { id, length, width, height, color, accent } = definition;
  const chassisY = 0.065;
  const glass = "#9ec4d2";
  const standardCar = ["hatchback", "sedan", "estate", "coupe", "suv", "taxi"].includes(id);
  return (
    <group>
      <Box position={[0, chassisY, 0]} scale={[length, 0.09, width]} color={color} />
      {standardCar && <>
        <Box position={[id === "hatchback" ? 0.02 : id === "coupe" ? -0.025 : 0, chassisY + height * 0.56, 0]} scale={[length * (id === "estate" ? 0.72 : id === "hatchback" ? 0.58 : id === "coupe" ? 0.52 : 0.62), height, width * 0.88]} color={glass} />
        {id === "estate" && <Box position={[length * 0.28, chassisY + height * 0.55, 0]} scale={[length * 0.22, height * 0.9, width * 0.9]} color={color} />}
        {id === "suv" && <Box position={[0, chassisY + height * 0.92, 0]} scale={[length * 0.5, 0.025, width * 0.86]} color="#29383b" />}
        {id === "taxi" && <Box position={[0, chassisY + height * 1.12, 0]} scale={[0.08, 0.035, 0.055]} color={accent} />}
      </>}
      {id === "minivan" && <><Box position={[0.035, chassisY + height * 0.55, 0]} scale={[length * 0.78, height, width * 0.92]} color={color} /><Box position={[-length * 0.19, chassisY + height * 0.62, 0]} scale={[length * 0.28, height * 0.62, width * 0.94]} color={glass} /></>}
      {(id === "delivery-van" || id === "service-van") && <><Box position={[length * 0.08, chassisY + height * 0.56, 0]} scale={[length * 0.75, height, width * 0.94]} color={color} /><Box position={[-length * 0.29, chassisY + height * 0.58, 0]} scale={[length * 0.2, height * 0.58, width * 0.96]} color={glass} /><Box position={[length * 0.14, chassisY + height * 0.55, width * 0.49]} scale={[length * 0.32, 0.035, 0.018]} color={accent} /></>}
      {id === "pickup" && <><Box position={[-length * 0.22, chassisY + height * 0.58, 0]} scale={[length * 0.38, height, width * 0.92]} color={glass} /><Box position={[length * 0.24, chassisY + height * 0.3, 0]} scale={[length * 0.42, height * 0.48, width * 0.88]} color="#263133" /></>}
      {id === "box-truck" && <><Box position={[-length * 0.31, chassisY + height * 0.42, 0]} scale={[length * 0.28, height * 0.74, width * 0.94]} color={accent} /><Box position={[-length * 0.38, chassisY + height * 0.58, 0]} scale={[length * 0.12, height * 0.35, width * 0.96]} color={glass} /><Box position={[length * 0.16, chassisY + height * 0.58, 0]} scale={[length * 0.62, height, width]} color={color} /></>}
      {id === "city-bus" && <><Box position={[0, chassisY + height * 0.52, 0]} scale={[length, height, width]} color={color} /><Box position={[-length * 0.04, chassisY + height * 0.68, 0]} scale={[length * 0.78, height * 0.43, width * 1.01]} color={glass} />{[-0.28, -0.08, 0.12, 0.32].map((ratio) => <Box key={ratio} position={[ratio * length, chassisY + height * 0.68, width * 0.52]} scale={[0.018, height * 0.48, 0.018]} color="#26383b" />)}<Box position={[length * 0.31, chassisY + height * 0.38, width * 0.52]} scale={[0.13, height * 0.58, 0.018]} color={accent} /></>}
      <TrafficWheels definition={definition} />
    </group>
  );
}

function RoadAccess({ speed, z, stationX }: { speed: 1 | 2 | 3; z: number; stationX: number }) {
  const vehicles = useRef<Array<Group | null>>([]);
  const initialFleet = useMemo(() => createTrafficFleet(), []);
  const fleet = useRef<TrafficVehicleState[]>(initialFleet);
  useFrame((_, delta) => {
    fleet.current = stepTrafficFleet(fleet.current, delta, speed, stationX);
    fleet.current.forEach((vehicle, index) => {
      const group = vehicles.current[index];
      if (!group) return;
      group.position.x = vehicle.x;
      group.position.z = (vehicle.lane === 0 ? 0.13 : -0.13) + vehicle.lateralOffset;
      group.rotation.y = trafficVehicleYaw(vehicle.direction);
    });
  });
  return (
    <group position={[0, RAILWAY_GROUND_Y, z]}>
      <Box position={[0, 0.015, 0]} scale={[trackLength, 0.03, 0.56]} color="#4d5555" castShadow={false} />
      <Box position={[stationX, 0.016, 0.42]} scale={[4.7, 0.032, 0.42]} color="#555d5d" castShadow={false} />
      <Box position={[stationX, 0.04, 0.64]} scale={[4.8, 0.018, 0.035]} color="#d7d4c5" castShadow={false} />
      <Box position={[0, 0.035, -0.26]} scale={[trackLength, 0.012, 0.025]} color="#d7d4c5" castShadow={false} />
      <Box position={[0, 0.035, 0.26]} scale={[trackLength, 0.012, 0.025]} color="#d7d4c5" castShadow={false} />
      {Array.from({ length: 30 }, (_, index) => <Box key={index} position={[-28 + index * 1.9, 0.04, 0]} scale={[0.5, 0.01, 0.02]} color="#e7dd9e" castShadow={false} />)}
      {TRAFFIC_VEHICLE_DEFINITIONS.map((definition, index) => <group key={definition.id} ref={(node) => { vehicles.current[index] = node; }} position={[initialFleet[index].x, 0.05, initialFleet[index].lane === 0 ? 0.13 : -0.13]} rotation={[0, trafficVehicleYaw(initialFleet[index].direction), 0]}><TrafficVehicle definition={definition} /></group>)}
    </group>
  );
}

function MaintenanceYard({ rearTrackZ, buildingZ, platformLength, tier }: { rearTrackZ: number; buildingZ: number; platformLength: number; tier: number }) {
  const depotCenterX = tier >= 5 ? 0.2 : -2.1;
  const depotZ = buildingZ;
  const controlPoints = useMemo(() => maintenanceSidingControlPoints({ trackLength, platformLength, rearTrackZ, depotZ, depotCenterX }), [depotCenterX, depotZ, platformLength, rearTrackZ]);
  const siding = useMemo(() => new CatmullRomCurve3(controlPoints.map((point) => new Vector3(point.x, RAILWAY_METRIC_PROFILE.railTopY - 0.012, point.z)), false, "catmullrom", 0.18), [controlPoints]);
  const railOffset = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.standardGaugeMeters / 2);
  const ballastCurve = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, -0.065, 0))), false, "catmullrom", 0.25), [siding]);
  const leftRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0, -railOffset))), false, "catmullrom", 0.25), [railOffset, siding]);
  const rightRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0, railOffset))), false, "catmullrom", 0.25), [railOffset, siding]);
  const sleepers = useMemo(() => siding.getSpacedPoints(72).filter((_, index) => index % 2 === 0).map((point, index, points) => {
    const tangent = siding.getTangent(Math.min(1, index / Math.max(1, points.length - 1)));
    return { point, angle: -Math.atan2(tangent.z, tangent.x) };
  }), [siding]);
  return (
    <group>
      <mesh receiveShadow><tubeGeometry args={[ballastCurve, 72, 0.055, 7, false]} /><meshStandardMaterial color="#59615e" roughness={0.96} /></mesh>
      {sleepers.map(({ point, angle }, index) => <Box key={index} position={[point.x, point.y - 0.018, point.z]} scale={[0.026, 0.016, railwayMetersToWorld(RAILWAY_METRIC_PROFILE.sleeperLengthMeters)]} color="#6f513b" rotation={[0, angle, 0]} />)}
      {[leftRail, rightRail].map((curve, index) => <mesh key={index} castShadow receiveShadow><tubeGeometry args={[curve, 48, 0.008, 7, false]} /><meshStandardMaterial color="#c5cbc9" metalness={0.72} roughness={0.38} /></mesh>)}
      <group position={[depotCenterX, 0, depotZ]}>
        <Box position={[0, RAILWAY_GROUND_Y + 0.055, 0]} scale={[2.35, 0.11, 1.08]} color="#817f76" />
        <Box position={[0, RAILWAY_GROUND_Y + 0.42, -0.46]} scale={[2.25, 0.66, 0.14]} color="#6f827e" />
        <Box position={[0, RAILWAY_GROUND_Y + 0.42, 0.46]} scale={[2.25, 0.66, 0.14]} color="#6f827e" />
        <Box position={[-1.08, RAILWAY_GROUND_Y + 0.42, 0]} scale={[0.14, 0.66, 0.92]} color="#637773" />
        <Box position={[0, RAILWAY_GROUND_Y + 0.79, -0.24]} scale={[2.42, 0.08, 0.65]} color="#2f4548" rotation={[0.3, 0, 0]} />
        <Box position={[0, RAILWAY_GROUND_Y + 0.79, 0.24]} scale={[2.42, 0.08, 0.65]} color="#2f4548" rotation={[-0.3, 0, 0]} />
        <Box position={[-0.72, RAILWAY_METRIC_PROFILE.railTopY + 0.16, -0.17]} scale={[0.08, 0.32, 0.06]} color="#262f2f" />
        <Box position={[-0.72, RAILWAY_METRIC_PROFILE.railTopY + 0.16, 0.17]} scale={[0.08, 0.32, 0.06]} color="#262f2f" />
        <Box position={[-0.72, RAILWAY_METRIC_PROFILE.railTopY + 0.28, 0]} scale={[0.08, 0.06, 0.42]} color="#262f2f" />
        <pointLight position={[0.96, RAILWAY_GROUND_Y + 0.76, 0]} intensity={1.1} distance={2.4} color="#ffd884" />
      </group>
    </group>
  );
}

function LitterShape({ kind, color, scale }: { kind: LitterKind; color: string; scale: number }) {
  if (kind === "paper") return <Box position={[0, 0, 0]} scale={[0.075 * scale, 0.008, 0.05 * scale]} color={color} castShadow={false} />;
  if (kind === "carton") return <Box position={[0, 0.018, 0]} scale={[0.05 * scale, 0.035 * scale, 0.035 * scale]} color={color} castShadow={false} />;
  if (kind === "cup") return <mesh position={[0, 0.025, 0]} castShadow><cylinderGeometry args={[0.022 * scale, 0.017 * scale, 0.05 * scale, 8]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
  if (kind === "can") return <mesh position={[0, 0.018, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.018 * scale, 0.018 * scale, 0.045 * scale, 10]} /><meshStandardMaterial color={color} metalness={0.45} roughness={0.38} /></mesh>;
  if (kind === "bottle") return <group><mesh position={[0, 0.026, 0]} castShadow><cylinderGeometry args={[0.014 * scale, 0.019 * scale, 0.052 * scale, 8]} /><meshStandardMaterial color={color} transparent opacity={0.82} /></mesh><Box position={[0, 0.057, 0]} scale={[0.012, 0.012, 0.012]} color="#d8d1b5" /></group>;
  if (kind === "leaf") return <mesh position={[0, 0.008, 0]} scale={[0.05 * scale, 0.01, 0.03 * scale]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>;
  return <mesh position={[0, 0.032, 0]} scale={[0.055 * scale, 0.052 * scale, 0.05 * scale]} castShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>;
}

function Dirt({ cleanliness, platformZs, length }: { cleanliness: number; platformZs: number[]; length: number }) {
  const platformWidth = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters);
  const pieces = useMemo(
    () => seededLitterLayout(cleanliness, platformZs, length, platformWidth),
    [cleanliness, length, platformWidth, platformZs],
  );
  const colors = ["#d9d1ba", "#6d5942", "#6c8580", "#b9483f", "#b98a3e"];
  return <group>{pieces.map((piece, index) => <group key={`${piece.x}-${piece.z}-${index}`} position={[piece.x, platformSurfaceY + 0.015, piece.z]} rotation={[0, piece.rotation, 0]}><LitterShape kind={piece.kind} color={colors[piece.colorIndex]} scale={piece.scale} /></group>)}</group>;
}

function Rain({ thunderstorm = false }: { thunderstorm?: boolean }) {
  const points = useRef<Points>(null);
  const count = thunderstorm ? 920 : 260;
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      values[index * 3] = ((index * 43) % 520) / 10 - 26;
      values[index * 3 + 1] = ((index * 67) % 100) / 10 + 0.6;
      values[index * 3 + 2] = ((index * 31) % 180) / 10 - 9;
    }
    return values;
  }, [count]);
  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.position.y -= delta * (thunderstorm ? 8.2 : 4.8);
    if (points.current.position.y < -5) points.current.position.y = 5;
  });
  return <points ref={points} position={[0, 2, 0]}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={thunderstorm ? 0.058 : 0.04} color={thunderstorm ? "#d4f0f6" : "#c1e5ed"} transparent opacity={thunderstorm ? 0.92 : 0.78} /></points>;
}

function SteamPuffs({ active }: { active: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => { if (!group.current) return; group.current.children.forEach((child, index) => { const phase = (clock.elapsedTime * 0.5 + index * 0.33) % 1; child.position.y = 0.34 + phase * 0.5; child.position.x = 0.22 - phase * 0.18; child.scale.setScalar(0.08 + phase * 0.12); }); });
  if (!active) return null;
  return <group ref={group}>{[0, 1, 2, 3].map((index) => <mesh key={index} position={[0.22, 0.34, 0]}><sphereGeometry args={[0.2, 10, 10]} /><meshStandardMaterial color="#d9d7ce" transparent opacity={0.65} /></mesh>)}</group>;
}

function ProductionTrainHeadlights({
  visual,
  orientation,
  intensity,
}: {
  visual: ReturnType<typeof resolveTrainVisualVariant>;
  orientation: 1 | -1;
  intensity: number;
}) {
  const beam = useRef<SpotLight>(null);
  const beamTarget = useRef<Object3D>(null);
  const profile = visual.headlights;
  useEffect(() => {
    if (beam.current && beamTarget.current) beam.current.target = beamTarget.current;
  }, []);
  if (!profile || !visual.lengthMeters) return null;
  const frontSign = orientation;
  const frontX = frontSign * railwayMetersToWorld(visual.lengthMeters / 2 - profile.frontInsetMeters);
  const targetX = frontX + frontSign * railwayMetersToWorld(profile.beamLengthMeters);
  const lightY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(profile.heightMeters);
  const targetY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(0.28);
  return (
    <>
      <object3D ref={beamTarget} position={[targetX, targetY, 0]} />
      <spotLight
        ref={beam}
        position={[frontX, lightY, 0]}
        color={profile.color}
        intensity={intensity}
        distance={railwayMetersToWorld(profile.beamLengthMeters * 1.25)}
        angle={0.245}
        penumbra={0.72}
        decay={1.45}
      />
    </>
  );
}

function TrainConsist({ active, trackCenter, speed, headlightIntensity }: { active: ActiveTrain; trackCenter: number; speed: 1 | 2 | 3; headlightIntensity: number }) {
  const group = useRef<Group>(null);
  const motion = useRef({ trainId: "", variantId: "", phase: "", elapsed: 0 });
  const train = TRAINS.find((candidate) => candidate.id === active.trainId);
  const visual = train ? resolveTrainVisualVariant(train, active.visualVariantId) : resolveTrainVisualVariant({ id: "br650", modelKey: "br650" });
  const gltf = useGLTF(trainVisualAssetUrl(visual));
  const consist = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bounds = useMemo(() => new Box3().setFromObject(consist), [consist]);
  const size = useMemo(() => bounds.getSize(new Vector3()), [bounds]);
  const displayLength = size.x * visual.scale[0];
  const displayWidth = size.z * visual.scale[2];
  const formationOrientation = active.formationOrientation ?? 1;
  const entryX = -32 - displayLength / 2;
  const exitX = 32 + displayLength / 2;
  useFrame((_, delta) => {
    if (!group.current || !train) return;
    const rendered = motion.current;
    if (rendered.trainId !== active.trainId || rendered.variantId !== visual.id || rendered.phase !== active.phase) {
      rendered.trainId = active.trainId;
      rendered.variantId = visual.id;
      rendered.phase = active.phase;
      rendered.elapsed = active.phaseElapsed;
    } else {
      rendered.elapsed = Math.min(active.phaseDuration, Math.max(rendered.elapsed, active.phaseElapsed) + delta * speed);
    }
    group.current.position.x = trainMotionPosition(active.phase, rendered.elapsed, active.phaseDuration, entryX, 0, exitX);
  });
  if (!train) return null;
  return (
    <group ref={group} position={[entryX, 0, trackCenter]}>
      <MetricContactShadow length={displayLength} width={Math.max(0.1, displayWidth * 0.88)} />
      <group position={[0, visual.contactOffsetY, 0]} rotation={[visual.rotation[0], visual.rotation[1] + (formationOrientation === -1 ? Math.PI : 0), visual.rotation[2]]} scale={[...visual.scale]}><Clone object={consist} castShadow receiveShadow /></group>
      <ProductionTrainHeadlights visual={visual} orientation={formationOrientation} intensity={headlightIntensity} />
      <SteamPuffs active={train.style === "steam"} />
    </group>
  );
}

function EventCelebration({ eventId, frontPlatformZ, platformLength }: { eventId: "ice-s" | "br01" | null; frontPlatformZ: number; platformLength: number }) {
  if (!eventId) return null;
  const colors = eventId === "ice-s" ? ["#62dcff", "#ffffff", "#e21e37"] : ["#ffd04d", "#e13a39", "#fff1bc"];
  const span = Math.min(platformLength * 0.8, 12);
  return <group position={[0, 0, frontPlatformZ + 0.24]}><Box position={[-span / 2, platformSurfaceY + 0.32, 0]} scale={[0.035, 0.64, 0.035]} color="#3c4b49" /><Box position={[span / 2, platformSurfaceY + 0.32, 0]} scale={[0.035, 0.64, 0.035]} color="#3c4b49" />{Array.from({ length: 13 }, (_, index) => { const x = -span / 2 + (index / 12) * span; const color = colors[index % colors.length]; return <mesh key={index} position={[x, platformSurfaceY + 0.58 - Math.sin((index / 12) * Math.PI) * 0.12, 0]}><sphereGeometry args={[0.035, 10, 10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} /></mesh>; })}<pointLight position={[0, platformSurfaceY + 0.45, 0]} intensity={2} distance={4} color={colors[0]} /></group>;
}

function parkedNeighborhoodCar(index: number) {
  return <TrafficVehicle definition={TRAFFIC_VEHICLE_DEFINITIONS[index % 5]} />;
}

function Diorama({ state, onPlacePlatform, onBirdCall }: SceneProps) {
  const trackCount = Math.max(1, state.platforms);
  const laneZs = useMemo(() => Array.from({ length: trackCount }, (_, index) => productionTrackCenter(index, trackCount)), [trackCount]);
  const lengthMeters = platformLengthMeters(state.lengthLevel);
  const platformLength = railwayMetersToWorld(lengthMeters);
  const platformZs = useMemo(() => laneZs.map((z) => metricPlatformCenter(z)), [laneZs]);
  const signalPositions = useMemo(() => platformSignalPositions(
    laneZs,
    platformLength,
    railwayMetersToWorld(RAILWAY_METRIC_PROFILE.vehicleWidthMeters / 2 + 0.55),
  ), [laneZs, platformLength]);
  const rearTrackZ = Math.min(...laneZs);
  const frontPlatformZ = Math.max(...platformZs);
  const buildingZ = rearTrackZ - (state.tier >= 5 ? 2.15 : 1.25);
  const buildingX = state.tier >= 5 ? -4.1 : -4.8;
  const roadZ = buildingZ - (state.tier >= 5 ? 2.2 : 1.65);
  const wetWeather = isWetWeather(state);
  const headlightIntensity = isNight(state) ? 92 : wetWeather ? 68 : 34;
  const lampIntensity = 0.15 + (1 - daylightFactor(state.simSeconds)) * 2.35 + (state.weather === "thunderstorm" ? 0.8 : state.weather === "rain" ? 0.45 : 0);
  const frontExtent = frontPlatformZ + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters / 2) + 0.45;
  const rearExtent = state.systems.roadAccess ? roadZ - 2.8 : buildingZ - (state.tier >= 5 ? 1.45 : 0.85);
  const focusZ = (frontExtent + rearExtent) / 2;
  const sceneDepth = frontExtent - rearExtent;
  const activeEventId = state.eventWindow ?? state.platformLanes.find((lane) => lane.activeTrain?.trainId === "ice-s" || lane.activeTrain?.trainId === "br01")?.activeTrain?.trainId;
  const boostedEventId = state.boosts.some((boost) => boost.label === "ICE-S record excitement") ? "ice-s" : state.boosts.some((boost) => boost.label === "Steam festival") ? "br01" : null;
  const eventId = activeEventId === "ice-s" || activeEventId === "br01" ? activeEventId : boostedEventId;
  return (
    <>
      <LockedMetricCamera trackCount={trackCount} focusZ={focusZ} sceneDepth={sceneDepth} />
      <Atmosphere state={state} />
      <mesh position={[0, RAILWAY_GROUND_Y - 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[90, 56]} /><meshStandardMaterial color={seasonGround[state.seasonIndex]} roughness={wetWeather ? 0.3 : 0.95} metalness={wetWeather ? 0.14 : 0} /></mesh>
      <Woodland season={state.seasonIndex} frontPlatformZ={frontPlatformZ} roadZ={roadZ} />
      <Wildlife state={state} frontPlatformZ={frontPlatformZ} onBirdCall={onBirdCall} />
      {state.region && laneZs.map((z) => <MetricTrack key={z} z={z} length={trackLength} />)}
      {state.region && !state.platformPlaced ? (
        <group onClick={onPlacePlatform} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = "default"; }}>
          <MetricPlatform trackCenter={laneZs[0]} lengthMeters={90} amenities={false} lampIntensity={lampIntensity} />
          <mesh position={[0, platformSurfaceY + 0.025, platformZs[0]]}><boxGeometry args={[railwayMetersToWorld(86), 0.02, railwayMetersToWorld(4.5)]} /><meshStandardMaterial color="#e9c858" emissive="#9d7416" emissiveIntensity={0.45} transparent opacity={0.75} /></mesh>
        </group>
      ) : state.region ? (
        <>
          {laneZs.map((z) => <MetricPlatform key={z} trackCenter={z} lengthMeters={lengthMeters} amenities={state.systems.amenities} lampIntensity={lampIntensity} tunnelEntrance={state.tier >= 4} />)}
          <Dirt cleanliness={state.cleanliness} platformZs={platformZs} length={platformLength} />
          {state.platformLanes.map((lane) => lane.activeTrain && <Suspense key={`${lane.platformIndex}-${lane.activeTrain.trainId}-${lane.activeTrain.visualVariantId ?? "default"}`} fallback={null}><TrainConsist active={lane.activeTrain} trackCenter={laneZs[lane.platformIndex] ?? laneZs[0]} speed={state.speed} headlightIntensity={headlightIntensity} /></Suspense>)}
        </>
      ) : null}
      <StationBuilding tier={state.tier} daylight={daylightFactor(state.simSeconds)} z={buildingZ} />
      {state.systems.electrification && <MetricCatenary laneZs={laneZs} length={trackLength} />}
      {state.systems.signaling && signalPositions.map((signal, index) => (
        <Signal key={`platform-signal-${index}`} advanced={state.systems.advancedSignaling} x={signal.x} z={signal.z} />
      ))}
      {state.systems.roadAccess && <RoadAccess speed={state.speed} z={roadZ} stationX={buildingX} />}
      {state.systems.roadAccess && <RoadsideNeighborhood state={state} roadZ={roadZ} parkedCar={parkedNeighborhoodCar} />}
      {state.systems.maintenance && <MaintenanceYard rearTrackZ={rearTrackZ} buildingZ={buildingZ} platformLength={platformLength} tier={state.tier} />}
      <PlatformLightPool state={state} platformZs={platformZs} platformLength={platformLength} />
      <EventCelebration eventId={eventId} frontPlatformZ={frontPlatformZ} platformLength={platformLength} />
      {wetWeather && <Rain thunderstorm={state.weather === "thunderstorm"} />}
    </>
  );
}

export default function StationScene(props: SceneProps) {
  const night = isNight(props.state);
  return (
    <Canvas className="station-canvas" orthographic shadows="basic" dpr={[1, 1.65]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.setClearColor(new Color(night ? "#101b2d" : "#a8d2df")); gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; }}>
      <Suspense fallback={null}><Diorama {...props} /></Suspense>
    </Canvas>
  );
}

useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "br650", modelKey: "br650" })));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "br642", modelKey: "br642" })));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "br648", modelKey: "br648" })));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "railjet", modelKey: "railjet" }, "railjet-classic")));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "railjet", modelKey: "railjet" }, "railjet-nextgen")));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "db-regional-express", modelKey: "desiro-hc" })));
useGLTF.preload(trainVisualAssetUrl(resolveTrainVisualVariant({ id: "ice3", modelKey: "ice3" }, "ice3-br403-unified")));
