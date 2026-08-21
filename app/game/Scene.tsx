"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { AmbientLight, DirectionalLight, Fog, Group, HemisphereLight, PointLight, Points } from "three";
import { ACESFilmicToneMapping, Box3, CatmullRomCurve3, Color, MathUtils, Vector3 } from "three";
import { TRAINS } from "./data";
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
import { daylightFactor, isNight } from "./simulation";
import { resolveTrainVisualVariant, trainVisualAssetUrl } from "./trainVisuals";
import type { ActiveTrain, GameState } from "./types";
import { TRAFFIC_CAR_KINDS, trainMotionPosition } from "./visual";

interface SceneProps {
  state: GameState;
  onPlacePlatform: () => void;
}

const seasonGround = ["#78945c", "#6f9958", "#9b8050", "#b8c3bf"];
const trackLength = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.trackLengthMeters);
const platformSurfaceY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformHeightMeters);

function LockedMetricCamera({ trackCount }: { trackCount: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0, 0.43, 0.1);
    if (!("zoom" in camera)) return;
    camera.updateMatrixWorld(true);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const stationWidth = railwayMetersToWorld(
      Math.max(1, trackCount - 1) * PRODUCTION_TRACK_CENTER_SPACING_METERS +
      RAILWAY_METRIC_PROFILE.vehicleWidthMeters +
      RAILWAY_METRIC_PROFILE.platformWidthMeters * 1.8,
    );
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
  }, [camera, size.height, size.width, trackCount]);
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
  const nightSky = useMemo(() => new Color("#101b2d"), []);
  const duskSky = useMemo(() => new Color("#be7968"), []);
  const sky = useMemo(() => new Color(), []);
  const daySun = useMemo(() => new Color("#fff0bd"), []);
  const nightSun = useMemo(() => new Color("#9db2dd"), []);
  const dayHemi = useMemo(() => new Color("#dcf1fb"), []);
  const nightHemi = useMemo(() => new Color("#2f4167"), []);

  useFrame(({ gl, scene }, delta) => {
    const target = daylightFactor(state.simSeconds);
    visualDaylight.current = MathUtils.damp(visualDaylight.current, target, 2.4, delta);
    const daylight = visualDaylight.current;
    const transitionGlow = 1 - Math.abs(daylight * 2 - 1);
    sky.copy(nightSky).lerp(state.raining ? rainSky : daySky, daylight).lerp(duskSky, transitionGlow * (state.raining ? 0.12 : 0.34));
    gl.setClearColor(sky);
    scene.background = sky;
    if (fog.current) fog.current.color.copy(sky);
    if (ambient.current) {
      ambient.current.intensity = MathUtils.lerp(0.42, 1.35, daylight);
      ambient.current.color.copy(nightSun).lerp(daySun, daylight);
    }
    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(0.72, 2.25, daylight);
      sun.current.color.copy(nightSun).lerp(daySun, daylight);
      sun.current.position.y = MathUtils.lerp(5, 13, daylight);
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = MathUtils.lerp(0.5, 1.05, daylight);
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

function PlatformLightPool({ state, frontPlatformZ, platformLength }: { state: GameState; frontPlatformZ: number; platformLength: number }) {
  const lights = useRef<Array<PointLight | null>>([]);
  const fixtureXs = [-0.36, -0.12, 0.12, 0.36].map((ratio) => ratio * platformLength);
  const visualIntensity = useRef(0);
  useFrame((_, delta) => {
    const target = (1 - daylightFactor(state.simSeconds)) * 1.8 + (state.raining ? 0.28 : 0);
    visualIntensity.current = MathUtils.damp(visualIntensity.current, target, 2.6, delta);
    lights.current.forEach((light) => { if (light) light.intensity = visualIntensity.current; });
  });
  return (
    <group>
      {fixtureXs.map((x, index) => (
        <pointLight key={x} ref={(node) => { lights.current[index] = node; }} position={[x, platformSurfaceY + 0.38, frontPlatformZ]} intensity={0} distance={4.8} decay={1.7} color="#ffd77f" />
      ))}
    </group>
  );
}

function StationBuilding({ tier, daylight, z }: { tier: number; daylight: number; z: number }) {
  if (tier < 2) return null;
  const width = 1.45 + tier * 0.2;
  const height = 0.44 + tier * 0.1;
  const baseY = RAILWAY_GROUND_Y;
  const bodyBottom = baseY + 0.12;
  const bodyTop = bodyBottom + height;
  const windowColor = new Color("#ffd878").lerp(new Color("#547482"), daylight).getStyle();
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

function Signal({ advanced, z }: { advanced: boolean; z: number }) {
  return (
    <group position={[5.8, RAILWAY_GROUND_Y, z]}>
      <Box position={[0, 0.24, 0]} scale={[0.035, 0.48, 0.035]} color="#313a39" />
      <Box position={[0, 0.5, 0]} scale={[0.13, 0.22, 0.11]} color="#202827" />
      <mesh position={[0, 0.55, -0.065]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial emissive="#71ed9b" emissiveIntensity={3} color="#71ed9b" /></mesh>
      {advanced && <Box position={[0, 0.7, 0]} scale={[0.2, 0.03, 0.03]} color="#77c8dd" />}
    </group>
  );
}

type TrafficCarKind = (typeof TRAFFIC_CAR_KINDS)[number];
const trafficColors = ["#305e8c", "#d34e3f", "#475851", "#b98237", "#8c3153", "#e3b832", "#547e72", "#e8e2d1", "#c5cbd0", "#f0eee5", "#273f62", "#6e4f91"];

function TrafficCar({ kind, color }: { kind: TrafficCarKind; color: string }) {
  const long = kind === "estate" || kind === "delivery" ? 0.34 : kind === "micro" ? 0.2 : kind === "van" || kind === "pickup" ? 0.31 : 0.27;
  const tall = kind === "van" || kind === "delivery" ? 0.15 : kind === "suv" ? 0.13 : 0.1;
  return (
    <group>
      <Box position={[0, 0.07, 0]} scale={[long, 0.08, 0.13]} color={color} />
      <Box position={[kind === "pickup" ? 0.06 : 0, 0.14, 0]} scale={[long * 0.58, tall, 0.115]} color="#b9d4df" />
      {[-long * 0.3, long * 0.3].map((x) => [-0.065, 0.065].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.025, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.035, 0.035, 0.025, 10]} /><meshStandardMaterial color="#151b1c" /></mesh>
      )))}
    </group>
  );
}

function RoadAccess({ speed, z }: { speed: 1 | 2 | 3; z: number }) {
  const cars = useRef<Array<Group | null>>([]);
  const specs = useMemo(() => TRAFFIC_CAR_KINDS.map((kind, index) => ({ kind, x: -29 + index * 5.2, direction: (index % 2 ? -1 : 1) as 1 | -1, speed: 1.8 + (index % 5) * 0.22, color: trafficColors[index % trafficColors.length] })), []);
  useFrame((_, delta) => {
    specs.forEach((spec, index) => {
      const car = cars.current[index];
      if (!car) return;
      car.position.x += spec.direction * spec.speed * delta * speed;
      if (spec.direction > 0 && car.position.x > 32) car.position.x = -32;
      if (spec.direction < 0 && car.position.x < -32) car.position.x = 32;
    });
  });
  return (
    <group position={[0, RAILWAY_GROUND_Y, z]}>
      <Box position={[0, 0.015, 0]} scale={[trackLength, 0.03, 0.56]} color="#4d5555" castShadow={false} />
      <Box position={[0, 0.035, -0.26]} scale={[trackLength, 0.012, 0.025]} color="#d7d4c5" castShadow={false} />
      <Box position={[0, 0.035, 0.26]} scale={[trackLength, 0.012, 0.025]} color="#d7d4c5" castShadow={false} />
      {Array.from({ length: 30 }, (_, index) => <Box key={index} position={[-28 + index * 1.9, 0.04, 0]} scale={[0.5, 0.01, 0.02]} color="#e7dd9e" castShadow={false} />)}
      {specs.map((spec, index) => <group key={spec.kind} ref={(node) => { cars.current[index] = node; }} position={[spec.x, 0.05, spec.direction > 0 ? 0.13 : -0.13]} rotation={[0, spec.direction < 0 ? Math.PI : 0, 0]}><TrafficCar kind={spec.kind} color={spec.color} /></group>)}
    </group>
  );
}

function MaintenanceYard({ rearTrackZ, buildingZ }: { rearTrackZ: number; buildingZ: number }) {
  const depotX = 4.6;
  const depotZ = buildingZ;
  const siding = useMemo(() => new CatmullRomCurve3([
    new Vector3(-8, RAILWAY_METRIC_PROFILE.railTopY - 0.012, rearTrackZ),
    new Vector3(-5.8, RAILWAY_METRIC_PROFILE.railTopY - 0.012, rearTrackZ - 0.35),
    new Vector3(1.8, RAILWAY_METRIC_PROFILE.railTopY - 0.012, buildingZ + 0.1),
    new Vector3(depotX, RAILWAY_METRIC_PROFILE.railTopY - 0.012, depotZ),
  ], false, "catmullrom", 0.25), [buildingZ, depotZ, rearTrackZ]);
  const railOffset = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.standardGaugeMeters / 2);
  const leftRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0, -railOffset))), false, "catmullrom", 0.25), [railOffset, siding]);
  const rightRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0, railOffset))), false, "catmullrom", 0.25), [railOffset, siding]);
  return (
    <group>
      {[leftRail, rightRail].map((curve, index) => <mesh key={index} castShadow receiveShadow><tubeGeometry args={[curve, 48, 0.008, 7, false]} /><meshStandardMaterial color="#c5cbc9" metalness={0.72} roughness={0.38} /></mesh>)}
      <group position={[depotX + 0.55, 0, depotZ]}>
        <Box position={[0, RAILWAY_GROUND_Y + 0.06, 0]} scale={[1.7, 0.12, 1.05]} color="#817f76" />
        <Box position={[0, RAILWAY_GROUND_Y + 0.42, 0]} scale={[1.62, 0.64, 0.98]} color="#6f827e" />
        <Box position={[0, RAILWAY_GROUND_Y + 0.78, -0.23]} scale={[1.78, 0.08, 0.62]} color="#2f4548" rotation={[0.32, 0, 0]} />
        <Box position={[0, RAILWAY_GROUND_Y + 0.78, 0.23]} scale={[1.78, 0.08, 0.62]} color="#2f4548" rotation={[-0.32, 0, 0]} />
        <Box position={[-0.84, RAILWAY_GROUND_Y + 0.38, 0]} scale={[0.05, 0.55, 0.72]} color="#26383a" />
        <pointLight position={[-1.02, RAILWAY_GROUND_Y + 0.78, 0]} intensity={1.1} distance={2.4} color="#ffd884" />
      </group>
    </group>
  );
}

function LowPolyTree({ position, scale, autumn, winter }: { position: [number, number, number]; scale: number; autumn: boolean; winter: boolean }) {
  const foliage = winter ? "#63736d" : autumn ? "#a56c36" : "#3f704a";
  const highlight = winter ? "#8c9993" : autumn ? "#cf9246" : "#63935d";
  return <group position={position} scale={scale}><mesh position={[0, 0.18, 0]} castShadow><cylinderGeometry args={[0.035, 0.05, 0.36, 7]} /><meshStandardMaterial color="#76553b" roughness={0.95} /></mesh><mesh position={[0, 0.43, 0]} castShadow><dodecahedronGeometry args={[0.18, 0]} /><meshStandardMaterial color={foliage} roughness={0.96} /></mesh><mesh position={[-0.07, 0.54, 0.03]} scale={[0.7, 0.64, 0.7]} castShadow><dodecahedronGeometry args={[0.17, 0]} /><meshStandardMaterial color={highlight} roughness={0.96} /></mesh></group>;
}

function LandscapeScenery({ seasonIndex, stationHalfWidth }: { seasonIndex: number; stationHalfWidth: number }) {
  const trees = useMemo(() => Array.from({ length: 34 }, (_, index) => ({ position: [-28 + ((index * 7.7) % 56), RAILWAY_GROUND_Y, index % 3 !== 0 ? stationHalfWidth + 3 + ((index * 1.7) % 2.6) : -stationHalfWidth - 5 - ((index * 1.3) % 2.2)] as [number, number, number], scale: 0.75 + (index % 5) * 0.13 })), [stationHalfWidth]);
  return <group>{trees.map((tree, index) => <LowPolyTree key={index} position={tree.position} scale={tree.scale} autumn={seasonIndex === 2} winter={seasonIndex === 3} />)}</group>;
}

function Dirt({ cleanliness, platformZs, length }: { cleanliness: number; platformZs: number[]; length: number }) {
  const count = Math.min(22, Math.floor((100 - cleanliness) / 4));
  const pieces = useMemo(() => Array.from({ length: count }, (_, index) => ({ x: -length / 2 + 0.5 + ((index * 37) % Math.max(1, Math.floor((length - 1) * 10))) / 10, z: platformZs[index % platformZs.length], rotation: ((index * 17) % 12) / 10 })), [count, length, platformZs]);
  return <group>{pieces.map((piece, index) => <Box key={`${piece.x}-${piece.z}-${index}`} position={[piece.x, platformSurfaceY + 0.025, piece.z]} scale={[0.07, 0.012, 0.045]} color={index % 2 ? "#6d5942" : "#626967"} rotation={[0, piece.rotation, 0]} castShadow={false} />)}</group>;
}

function Rain() {
  const points = useRef<Points>(null);
  const positions = useMemo(() => { const values = new Float32Array(260 * 3); for (let index = 0; index < 260; index += 1) { values[index * 3] = ((index * 43) % 520) / 10 - 26; values[index * 3 + 1] = ((index * 67) % 80) / 10 + 0.6; values[index * 3 + 2] = ((index * 31) % 150) / 10 - 7.5; } return values; }, []);
  useFrame((_, delta) => { if (!points.current) return; points.current.position.y -= delta * 4.8; if (points.current.position.y < -4) points.current.position.y = 4; });
  return <points ref={points} position={[0, 2, 0]}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={0.04} color="#c1e5ed" transparent opacity={0.78} /></points>;
}

function SteamPuffs({ active }: { active: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => { if (!group.current) return; group.current.children.forEach((child, index) => { const phase = (clock.elapsedTime * 0.5 + index * 0.33) % 1; child.position.y = 0.34 + phase * 0.5; child.position.x = 0.22 - phase * 0.18; child.scale.setScalar(0.08 + phase * 0.12); }); });
  if (!active) return null;
  return <group ref={group}>{[0, 1, 2, 3].map((index) => <mesh key={index} position={[0.22, 0.34, 0]}><sphereGeometry args={[0.2, 10, 10]} /><meshStandardMaterial color="#d9d7ce" transparent opacity={0.65} /></mesh>)}</group>;
}

function TrainConsist({ active, trackCenter, speed }: { active: ActiveTrain; trackCenter: number; speed: 1 | 2 | 3 }) {
  const group = useRef<Group>(null);
  const motion = useRef({ trainId: "", variantId: "", direction: 1, phase: "", elapsed: 0 });
  const train = TRAINS.find((candidate) => candidate.id === active.trainId);
  const visual = train ? resolveTrainVisualVariant(train, active.visualVariantId) : resolveTrainVisualVariant({ id: "br650", modelKey: "br650" });
  const gltf = useGLTF(trainVisualAssetUrl(visual));
  const consist = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bounds = useMemo(() => new Box3().setFromObject(consist), [consist]);
  const size = useMemo(() => bounds.getSize(new Vector3()), [bounds]);
  const displayLength = size.x * visual.scale[0];
  const displayWidth = size.z * visual.scale[2];
  const direction = active.travelDirection ?? 1;
  const leftEdge = -32 - displayLength / 2;
  const rightEdge = 32 + displayLength / 2;
  const entryX = direction === 1 ? leftEdge : rightEdge;
  const exitX = direction === 1 ? rightEdge : leftEdge;
  useFrame((_, delta) => {
    if (!group.current || !train) return;
    const rendered = motion.current;
    if (rendered.trainId !== active.trainId || rendered.variantId !== visual.id || rendered.direction !== direction || rendered.phase !== active.phase) {
      rendered.trainId = active.trainId;
      rendered.variantId = visual.id;
      rendered.direction = direction;
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
      <group position={[0, visual.contactOffsetY, 0]} rotation={[...visual.rotation]} scale={[...visual.scale]}><Clone object={consist} castShadow receiveShadow /></group>
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

function Diorama({ state, onPlacePlatform }: SceneProps) {
  const trackCount = Math.max(1, state.platforms);
  const laneZs = useMemo(() => Array.from({ length: trackCount }, (_, index) => productionTrackCenter(index, trackCount)), [trackCount]);
  const lengthMeters = platformLengthMeters(state.lengthLevel);
  const platformLength = railwayMetersToWorld(lengthMeters);
  const platformZs = useMemo(() => laneZs.map((z) => metricPlatformCenter(z)), [laneZs]);
  const rearTrackZ = Math.min(...laneZs);
  const frontPlatformZ = Math.max(...platformZs);
  const stationHalfWidth = Math.max(Math.abs(rearTrackZ), Math.abs(frontPlatformZ));
  const buildingZ = rearTrackZ - 1.25;
  const roadZ = buildingZ - 1.65;
  const activeEventId = state.eventWindow ?? state.platformLanes.find((lane) => lane.activeTrain?.trainId === "ice-s" || lane.activeTrain?.trainId === "br01")?.activeTrain?.trainId;
  const boostedEventId = state.boosts.some((boost) => boost.label === "ICE-S record excitement") ? "ice-s" : state.boosts.some((boost) => boost.label === "Steam festival") ? "br01" : null;
  const eventId = activeEventId === "ice-s" || activeEventId === "br01" ? activeEventId : boostedEventId;
  return (
    <>
      <LockedMetricCamera trackCount={trackCount} />
      <Atmosphere state={state} />
      <mesh position={[0, RAILWAY_GROUND_Y - 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[90, 56]} /><meshStandardMaterial color={seasonGround[state.seasonIndex]} roughness={state.raining ? 0.32 : 0.95} metalness={state.raining ? 0.12 : 0} /></mesh>
      <LandscapeScenery seasonIndex={state.seasonIndex} stationHalfWidth={stationHalfWidth} />
      {state.region && laneZs.map((z) => <MetricTrack key={z} z={z} length={trackLength} />)}
      {state.region && !state.platformPlaced ? (
        <group onClick={onPlacePlatform} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = "default"; }}>
          <MetricPlatform trackCenter={laneZs[0]} lengthMeters={90} amenities={false} />
          <mesh position={[0, platformSurfaceY + 0.025, platformZs[0]]}><boxGeometry args={[railwayMetersToWorld(86), 0.02, railwayMetersToWorld(4.5)]} /><meshStandardMaterial color="#e9c858" emissive="#9d7416" emissiveIntensity={0.45} transparent opacity={0.75} /></mesh>
        </group>
      ) : state.region ? (
        <>
          {laneZs.map((z) => <MetricPlatform key={z} trackCenter={z} lengthMeters={lengthMeters} amenities={state.systems.amenities} />)}
          <Dirt cleanliness={state.cleanliness} platformZs={platformZs} length={platformLength} />
          {state.platformLanes.map((lane) => lane.activeTrain && <Suspense key={`${lane.platformIndex}-${lane.activeTrain.trainId}-${lane.activeTrain.visualVariantId ?? "default"}`} fallback={null}><TrainConsist active={lane.activeTrain} trackCenter={laneZs[lane.platformIndex] ?? laneZs[0]} speed={state.speed} /></Suspense>)}
        </>
      ) : null}
      <StationBuilding tier={state.tier} daylight={daylightFactor(state.simSeconds)} z={buildingZ} />
      {state.systems.electrification && <MetricCatenary laneZs={laneZs} length={trackLength} />}
      {state.systems.signaling && <Signal advanced={state.systems.advancedSignaling} z={rearTrackZ} />}
      {state.systems.roadAccess && <RoadAccess speed={state.speed} z={roadZ} />}
      {state.systems.maintenance && <MaintenanceYard rearTrackZ={rearTrackZ} buildingZ={buildingZ} />}
      <PlatformLightPool state={state} frontPlatformZ={frontPlatformZ} platformLength={platformLength} />
      <EventCelebration eventId={eventId} frontPlatformZ={frontPlatformZ} platformLength={platformLength} />
      {state.raining && <Rain />}
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
