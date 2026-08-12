"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { AmbientLight, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Points } from "three";
import { Color, MathUtils, Object3D } from "three";
import { daylightFactor, isNight } from "./simulation";
import { TRAINS } from "./data";
import { catenaryPolePositions, trainMotionPosition } from "./visual";
import type { GameState, TrainDefinition } from "./types";

interface SceneProps {
  state: GameState;
  onPlacePlatform: () => void;
}

const seasonGround = ["#78945c", "#6f9958", "#9b8050", "#b8c3bf"];

function LockedCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0, 0.35, 1.1);
    if ("zoom" in camera) {
      camera.zoom = size.width < 620 ? 31 : size.width < 980 ? 39 : 47;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width]);
  return null;
}

function Box({
  position,
  scale,
  color,
  rotation,
  castShadow = true,
}: {
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

function Track({ z, length }: { z: number; length: number }) {
  const count = Math.ceil(length / 0.52);
  const sleepers = useRef<InstancedMesh>(null);
  useEffect(() => {
    if (!sleepers.current) return;
    const dummy = new Object3D();
    for (let index = 0; index < count; index += 1) {
      dummy.position.set(-length / 2 + (index / (count - 1)) * length, 0.08, z);
      dummy.scale.set(0.1, 0.07, 0.94);
      dummy.updateMatrix();
      sleepers.current.setMatrixAt(index, dummy.matrix);
    }
    sleepers.current.instanceMatrix.needsUpdate = true;
  }, [count, length, z]);
  return (
    <group>
      <Box position={[0, -0.055, z]} scale={[length, 0.22, 0.92]} color="#59605c" castShadow={false} />
      <instancedMesh ref={sleepers} args={[undefined, undefined, count]} castShadow={false} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color="#71533d" roughness={0.94} />
      </instancedMesh>
      <Box position={[0, 0.16, z - 0.27]} scale={[length, 0.065, 0.065]} color="#c7ccca" />
      <Box position={[0, 0.16, z + 0.27]} scale={[length, 0.065, 0.065]} color="#c7ccca" />
    </group>
  );
}

function Platform({ index, length, amenities }: { index: number; length: number; amenities: boolean }) {
  const z = -0.05 + index * 1.25;
  return (
    <group>
      <Box position={[0, 0.07, z]} scale={[length + 0.18, 0.54, 0.58]} color="#8f8a7d" />
      <Box position={[0, 0.39, z]} scale={[length, 0.14, 0.54]} color={index === 0 ? "#d7d0bd" : "#c9c4b5"} />
      <Box position={[0, 0.475, z - 0.22]} scale={[length, 0.035, 0.07]} color="#f6e9b2" />
      <Box position={[0, 0.475, z + 0.22]} scale={[length, 0.035, 0.07]} color="#f6e9b2" />
      {Array.from({ length: Math.max(3, Math.floor(length / 1.4)) }, (_, marker) => (
        <Box key={marker} position={[-length / 2 + 0.6 + marker * 1.4, 0.49, z - 0.22]} scale={[0.06, 0.018, 0.065]} color="#3c4542" castShadow={false} />
      ))}
      {amenities && (
        <>
          <Box position={[-1.5, 0.73, z]} scale={[0.78, 0.08, 0.23]} color="#235a5a" />
          <Box position={[-1.76, 0.58, z]} scale={[0.08, 0.3, 0.08]} color="#394443" />
          <Box position={[-1.24, 0.58, z]} scale={[0.08, 0.3, 0.08]} color="#394443" />
          <Box position={[1.6, 0.8, z]} scale={[0.12, 0.68, 0.12]} color="#3b4747" />
          <pointLight position={[1.6, 1.35, z]} intensity={0.8} distance={3} color="#ffd994" />
        </>
      )}
    </group>
  );
}

function Catenary({ trackCount, length }: { trackCount: number; length: number }) {
  const poles = useMemo(() => catenaryPolePositions(length), [length]);
  return (
    <group>
      {Array.from({ length: trackCount }, (_, track) => {
        const z = -0.72 + track * 1.25;
        return (
          <group key={z}>
            {poles.map((x) => (
              <group key={x}>
                <Box position={[x, 1.28, z + 0.45]} scale={[0.09, 2.2, 0.09]} color="#66706e" />
                <Box position={[x, 2.28, z]} scale={[0.09, 0.08, 0.95]} color="#66706e" />
              </group>
            ))}
            <Box position={[0, 2.18, z]} scale={[length, 0.025, 0.025]} color="#303837" castShadow={false} />
          </group>
        );
      })}
    </group>
  );
}

function StationBuilding({ tier, daylight }: { tier: number; daylight: number }) {
  if (tier < 2) return null;
  const width = 2.2 + tier * 0.42;
  const height = 0.72 + tier * 0.26;
  const windowColor = new Color("#ffd878").lerp(new Color("#547482"), daylight).getStyle();
  return (
    <group position={[-1.2, 0, 3.8]}>
      <Box position={[0, height / 2 + 0.2, 0]} scale={[width, height, 1.35]} color={tier >= 5 ? "#ede3c9" : "#d1b98e"} />
      <Box position={[0, height + 0.35, 0]} scale={[width + 0.28, 0.16, 1.58]} color="#32494c" />
      <Box position={[0.55, 0.72, -0.69]} scale={[0.58, 0.9, 0.06]} color="#2b4a55" />
      <Box position={[-0.62, 0.86, -0.69]} scale={[0.52, 0.46, 0.06]} color={windowColor} />
      <Box position={[0, height + 0.62, -0.78]} scale={[1.18, 0.35, 0.08]} color="#f0e9d7" />
      <Box position={[0, height + 0.62, -0.83]} scale={[0.74, 0.06, 0.02]} color="#b51f2e" />
      {tier >= 4 && <Box position={[-width / 2 + 0.5, height + 0.92, 0]} scale={[0.16, 1.1, 0.16]} color="#2f3e3f" />}
      {tier >= 5 && <Box position={[-width / 2 + 0.5, height + 1.5, 0]} scale={[0.74, 0.12, 0.12]} color="#bf1d2e" />}
    </group>
  );
}

function Signal({ advanced }: { advanced: boolean }) {
  return (
    <group position={[4.5, 0, -0.82]}>
      <Box position={[0, 0.72, 0]} scale={[0.1, 1.28, 0.1]} color="#313a39" />
      <Box position={[0, 1.38, 0]} scale={[0.32, 0.62, 0.3]} color="#202827" />
      <mesh position={[0, 1.53, -0.17]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial emissive="#71ed9b" emissiveIntensity={3} color="#71ed9b" />
      </mesh>
      {advanced && <Box position={[0, 1.9, 0]} scale={[0.5, 0.08, 0.08]} color="#77c8dd" />}
    </group>
  );
}

function RoadAccess() {
  const car = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (car.current) car.current.position.x = Math.sin(clock.elapsedTime * 0.55) * 2.4;
  });
  return (
    <group position={[1.6, 0, 5.1]}>
      <Box position={[0, 0.09, 0]} scale={[6.4, 0.1, 1.05]} color="#5b6261" castShadow={false} />
      <Box position={[0, 0.16, 0]} scale={[6.2, 0.025, 0.05]} color="#e8d87d" castShadow={false} />
      <group ref={car} position={[0, 0.28, 0]}>
        <Box position={[0, 0.18, 0]} scale={[0.72, 0.28, 0.4]} color="#d84e3f" />
        <Box position={[-0.1, 0.38, 0]} scale={[0.38, 0.2, 0.34]} color="#d84e3f" />
      </group>
    </group>
  );
}

function MaintenanceYard() {
  return (
    <group position={[4.2, 0, 3.3]}>
      <Box position={[0, 0.62, 0]} scale={[2.1, 1.2, 1.55]} color="#74837f" />
      <Box position={[0, 1.28, 0]} scale={[2.35, 0.15, 1.78]} color="#30464a" />
      <Box position={[-0.48, 0.55, -0.8]} scale={[0.68, 0.9, 0.08]} color="#26383a" />
      <Box position={[0.48, 0.55, -0.8]} scale={[0.68, 0.9, 0.08]} color="#26383a" />
    </group>
  );
}

function Dirt({ cleanliness }: { cleanliness: number }) {
  const count = Math.min(14, Math.floor((100 - cleanliness) / 6));
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        x: ((index * 37) % 90) / 10 - 4.5,
        z: ((index * 53) % 36) / 10 - 0.1,
        rotation: ((index * 17) % 12) / 10,
      })),
    [count],
  );
  return (
    <group>
      {pieces.map((piece, index) => (
        <Box
          key={`${piece.x}-${piece.z}`}
          position={[piece.x, 0.58, piece.z]}
          scale={[0.16 + (index % 3) * 0.04, 0.025, 0.1]}
          color={index % 2 ? "#6d5942" : "#626967"}
          rotation={[0, piece.rotation, 0]}
          castShadow={false}
        />
      ))}
    </group>
  );
}

function LowPolyTree({ position, scale, autumn, winter }: { position: [number, number, number]; scale: number; autumn: boolean; winter: boolean }) {
  const foliage = winter ? "#63736d" : autumn ? "#a56c36" : "#3f704a";
  const highlight = winter ? "#8c9993" : autumn ? "#cf9246" : "#63935d";
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.16, 1.24, 7]} />
        <meshStandardMaterial color="#76553b" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.33, 0]} castShadow>
        <dodecahedronGeometry args={[0.56, 0]} />
        <meshStandardMaterial color={foliage} roughness={0.96} />
      </mesh>
      <mesh position={[-0.2, 1.63, 0.08]} scale={[0.66, 0.62, 0.66]} castShadow>
        <dodecahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial color={highlight} roughness={0.96} />
      </mesh>
      {winter && (
        <mesh position={[-0.2, 1.82, 0.08]} rotation={[0, 0, 0.12]}>
          <coneGeometry args={[0.32, 0.08, 7]} />
          <meshStandardMaterial color="#d9e1df" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

function LandscapeScenery({ seasonIndex }: { seasonIndex: number }) {
  const trees = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const farSide = index % 3 !== 0;
        const x = -25 + ((index * 7.7) % 50);
        const z = farSide ? 7.1 + ((index * 2.3) % 5.4) : -5.8 - ((index * 1.7) % 3.5);
        return { position: [x, -0.2, z] as [number, number, number], scale: 0.72 + (index % 5) * 0.12 };
      }),
    [],
  );
  const shrubs = useMemo(
    () => Array.from({ length: 24 }, (_, index) => ({ x: -19 + ((index * 5.3) % 38), z: index % 2 ? 6.4 : -4.7, scale: 0.32 + (index % 4) * 0.08 })),
    [],
  );
  return (
    <group>
      <mesh position={[-15, -0.175, 8.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 7]} />
        <meshStandardMaterial color={seasonIndex === 2 ? "#9c7e43" : "#718e4e"} roughness={1} />
      </mesh>
      <mesh position={[16, -0.17, 8.3]} rotation={[-Math.PI / 2, 0.05, 0]} receiveShadow>
        <planeGeometry args={[20, 7]} />
        <meshStandardMaterial color={seasonIndex === 3 ? "#aab8ae" : "#82964e"} roughness={1} />
      </mesh>
      {[-13, -6, 1, 8, 15].map((x) => (
        <Box key={x} position={[x, -0.05, 7]} scale={[0.055, 0.42, 8.8]} color="#8b7457" castShadow={false} />
      ))}
      {trees.map((tree, index) => <LowPolyTree key={index} position={tree.position} scale={tree.scale} autumn={seasonIndex === 2} winter={seasonIndex === 3} />)}
      {shrubs.map((shrub, index) => (
        <mesh key={index} position={[shrub.x, 0.02, shrub.z]} scale={shrub.scale} castShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={seasonIndex === 2 ? "#806b3f" : "#456e45"} roughness={1} />
        </mesh>
      ))}
      <group position={[-8.2, 0, 5.9]}>
        <Box position={[0, 0.36, 0]} scale={[1.4, 0.72, 0.95]} color="#c8af83" />
        <Box position={[0, 0.8, 0]} scale={[1.65, 0.14, 1.15]} color="#6d4537" rotation={[0, 0, 0.08]} />
        <Box position={[0.3, 0.34, -0.49]} scale={[0.32, 0.46, 0.04]} color="#526d70" />
      </group>
      <Box position={[0, 0.18, -4.25]} scale={[58, 0.07, 0.06]} color="#a9a18b" castShadow={false} />
      {Array.from({ length: 20 }, (_, index) => (
        <Box key={index} position={[-27 + index * 2.8, 0.43, -4.25]} scale={[0.055, 0.55, 0.055]} color="#756c5a" castShadow={false} />
      ))}
    </group>
  );
}

function Rain() {
  const points = useRef<Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(210 * 3);
    for (let index = 0; index < 210; index += 1) {
      values[index * 3] = ((index * 43) % 240) / 12 - 10;
      values[index * 3 + 1] = ((index * 67) % 100) / 10 + 1;
      values[index * 3 + 2] = ((index * 31) % 160) / 10 - 6;
    }
    return values;
  }, []);
  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.position.y -= delta * 4.5;
    if (points.current.position.y < -4) points.current.position.y = 4;
  });
  return (
    <points ref={points} position={[0, 2, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#b7dcea" transparent opacity={0.78} />
    </points>
  );
}

function SteamPuffs({ active }: { active: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      const phase = (clock.elapsedTime * 0.5 + index * 0.33) % 1;
      child.position.y = 1.2 + phase * 1.8;
      child.position.x = 0.7 - phase * 0.5;
      child.scale.setScalar(0.22 + phase * 0.5);
    });
  });
  if (!active) return null;
  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} position={[0.7, 1.2, 0]}>
          <sphereGeometry args={[0.4, 10, 10]} />
          <meshStandardMaterial color="#d9d7ce" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

const DOUBLE_DECK_TRAINS = new Set(["desiro-hc", "metronom", "ic2", "tgv-duplex"]);
const DOUBLE_ENDED_TRAINS = new Set(["br642", "br648", "desiro-hc", "talent2", "ice2", "ice3", "ice4", "tgv-duplex", "giruno", "ice-s"]);
const TIER_ONE_CAR_PITCH: Record<string, number> = { br642: 1.65, br648: 1.7 };
const TRAIN_ASSET_VERSION = "4";

function carPitch(train: TrainDefinition): number {
  return TIER_ONE_CAR_PITCH[train.id] ?? 1.12;
}

function CoachWheels() {
  return (
    <>
      {[-0.29, 0.29].map((x) => [-0.33, 0.33].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.1, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 12]} />
          <meshStandardMaterial color="#1a2223" metalness={0.7} roughness={0.42} />
        </mesh>
      )))}
    </>
  );
}

function CoachWindows({ y, color, count = 4 }: { y: number; color: string; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, pane) => [-0.351, 0.351].map((z) => (
        <Box key={`${pane}-${z}`} position={[-0.32 + pane * (0.64 / Math.max(1, count - 1)), y, z]} scale={[0.12, 0.15, 0.025]} color={color} />
      )))}
    </>
  );
}

function ProceduralCoach({ train, index }: { train: TrainDefinition; index: number }) {
  const x = -carPitch(train) * (index + 1);
  const isSteam = train.id === "br01";
  const isTender = isSteam && index === 0;
  const isHeritage = isSteam && !isTender;
  const isMeasurement = train.id === "ice-s" && index === 0;
  const doubleDeck = DOUBLE_DECK_TRAINS.has(train.id) && !(train.id === "desiro-hc" && index > 1);
  const isSleeper = train.id === "nightjet";
  const body = isHeritage ? "#6d3427" : isTender ? "#17191a" : train.colors.body;
  const accent = isHeritage ? "#d4b26e" : train.colors.accent;
  const height = doubleDeck ? 0.88 : isTender ? 0.62 : 0.68;
  const centerY = doubleDeck ? 0.6 : 0.5;
  const controlCab = (train.id === "metronom" || train.id === "ic2" || train.id === "railjet" || train.id === "comfortjet") && index === train.cars - 2;
  const pantograph = isMeasurement || (["desiro-hc", "talent2", "ice3", "ice4", "giruno"].includes(train.id) && index % 3 === 0);

  if (isTender) {
    return (
      <group position={[x, 0, 0]}>
        <Box position={[0, 0.48, 0]} scale={[0.86, 0.64, 0.65]} color={body} />
        <Box position={[0, 0.83, 0]} scale={[0.7, 0.09, 0.54]} color="#2c2b28" />
        <Box position={[0, 0.88, 0]} scale={[0.58, 0.08, 0.46]} color="#0e1111" />
        <Box position={[0, 0.24, 0]} scale={[0.88, 0.11, 0.66]} color={train.colors.accent} />
        <CoachWheels />
      </group>
    );
  }

  return (
    <group position={[x, 0, 0]}>
      <Box position={[0, centerY, 0]} scale={[0.98, height, 0.69]} color={body} />
      <Box position={[0, centerY + height / 2 + 0.055, 0]} scale={[0.92, 0.09, 0.61]} color={isHeritage ? "#3b2d29" : train.colors.roof} />
      <Box position={[0, 0.28, 0]} scale={[0.98, 0.065, 0.71]} color={accent} />
      <Box position={[0, 0.18, 0]} scale={[0.82, 0.12, 0.52]} color="#222a2b" />
      {doubleDeck ? (
        <>
          <CoachWindows y={0.48} color={train.colors.windows} />
          <CoachWindows y={0.78} color={train.colors.windows} />
        </>
      ) : isSleeper ? (
        <>
          <CoachWindows y={0.64} color={train.colors.windows} count={3} />
          {[-0.351, 0.351].map((z) => <Box key={z} position={[0.32, 0.52, z]} scale={[0.13, 0.45, 0.026]} color="#274d7d" />)}
        </>
      ) : (
        <CoachWindows y={isHeritage ? 0.6 : 0.62} color={isHeritage ? "#d9bd82" : train.colors.windows} />
      )}
      {[-0.351, 0.351].map((z) => <Box key={z} position={[0.35, centerY, z]} scale={[0.13, height * 0.68, 0.026]} color={isHeritage ? "#4b271f" : accent} />)}
      {controlCab && (
        <>
          <Box position={[-0.455, centerY + 0.14, 0]} scale={[0.035, 0.28, 0.54]} color={train.colors.windows} />
          <Box position={[-0.465, centerY - 0.15, 0]} scale={[0.04, 0.08, 0.58]} color={accent} />
        </>
      )}
      {isMeasurement && (
        <>
          <Box position={[0, 0.52, 0]} scale={[0.86, 0.08, 0.71]} color="#7d8589" />
          <Box position={[0, 1.02, 0]} scale={[0.4, 0.05, 0.22]} color="#2d3538" rotation={[0, 0, 0.35]} />
        </>
      )}
      {pantograph && (
        <group position={[0, centerY + height / 2 + 0.2, 0]}>
          <Box position={[-0.09, 0, 0]} scale={[0.38, 0.035, 0.035]} color="#303839" rotation={[0, 0, 0.68]} />
          <Box position={[0.09, 0, 0]} scale={[0.38, 0.035, 0.035]} color="#303839" rotation={[0, 0, -0.68]} />
          <Box position={[0, 0.13, 0]} scale={[0.38, 0.025, 0.16]} color="#303839" />
        </group>
      )}
      <CoachWheels />
    </group>
  );
}

function TrainConsist({ state }: { state: GameState }) {
  const active = state.activeTrain;
  const group = useRef<Group>(null);
  const motion = useRef({ trainId: "", phase: "", elapsed: 0 });
  const train = active ? TRAINS.find((candidate) => candidate.id === active.trainId) : null;
  const gltf = useGLTF(train ? `/models/trains/${train.modelKey}.glb?v=${TRAIN_ASSET_VERSION}` : `/models/trains/br650.glb?v=${TRAIN_ASSET_VERSION}`);
  const head = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const entryX = train ? -34 - train.cars * 1.6 : -34;
  const exitX = train ? 36 + train.cars * 1.6 : 36;
  useFrame((_, delta) => {
    if (!group.current || !active) return;
    const visual = motion.current;
    if (visual.trainId !== active.trainId || visual.phase !== active.phase) {
      visual.trainId = active.trainId;
      visual.phase = active.phase;
      visual.elapsed = active.phaseElapsed;
    } else {
      // Extrapolate between deterministic 10 Hz simulation snapshots, then
      // correct only forward so a late snapshot can never make a train jump back.
      visual.elapsed = Math.min(active.phaseDuration, Math.max(visual.elapsed, active.phaseElapsed) + delta * state.speed);
    }
    group.current.position.x = trainMotionPosition(active.phase, visual.elapsed, active.phaseDuration, entryX, 4.4, exitX);
  });
  if (!active || !train) return null;
  const tailIndex = train.cars - 2;
  const hasMirroredTail = DOUBLE_ENDED_TRAINS.has(train.id) && train.cars > 1;
  return (
    <group ref={group} position={[entryX, 0.25, -0.72]} scale={[1.5, 0.82, 0.82]}>
      <Clone object={head} castShadow />
      {Array.from({ length: Math.max(0, train.cars - 1) }, (_, index) => hasMirroredTail && index === tailIndex ? (
        <group key={index} position={[-carPitch(train) * (index + 1), 0, 0]} rotation={[0, Math.PI, 0]}>
          <Clone object={head} castShadow />
        </group>
      ) : <ProceduralCoach key={index} train={train} index={index} />)}
      <SteamPuffs active={train.style === "steam"} />
    </group>
  );
}

function Atmosphere({ state }: { state: GameState }) {
  const ambient = useRef<AmbientLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const fog = useRef<Fog>(null);
  const visualDaylight = useRef(daylightFactor(state.simSeconds));
  const daySky = useMemo(() => new Color("#a7cfdd"), []);
  const rainSky = useMemo(() => new Color("#60777b"), []);
  const nightSky = useMemo(() => new Color("#101c2c"), []);
  const duskSky = useMemo(() => new Color("#be7968"), []);
  const sky = useMemo(() => new Color(), []);
  const daySun = useMemo(() => new Color("#fff1c4"), []);
  const nightSun = useMemo(() => new Color("#94aee0"), []);
  const dayHemi = useMemo(() => new Color("#d9f1ff"), []);
  const nightHemi = useMemo(() => new Color("#28395e"), []);

  useFrame(({ gl, scene }, delta) => {
    const target = daylightFactor(state.simSeconds);
    visualDaylight.current = MathUtils.damp(visualDaylight.current, target, 2.4, delta);
    const daylight = visualDaylight.current;
    const transitionGlow = 1 - Math.abs(daylight * 2 - 1);
    const daytimeSky = state.raining ? rainSky : daySky;
    sky.copy(nightSky).lerp(daytimeSky, daylight).lerp(duskSky, transitionGlow * (state.raining ? 0.12 : 0.34));
    gl.setClearColor(sky);
    scene.background = sky;
    if (fog.current) fog.current.color.copy(sky);
    if (ambient.current) {
      ambient.current.intensity = MathUtils.lerp(0.42, 1.35, daylight);
      ambient.current.color.copy(nightSun).lerp(daySun, daylight);
    }
    if (sun.current) {
      sun.current.intensity = MathUtils.lerp(0.58, 2.2, daylight);
      sun.current.color.copy(nightSun).lerp(daySun, daylight);
      sun.current.position.y = MathUtils.lerp(4, 12, daylight);
    }
    if (hemisphere.current) {
      hemisphere.current.intensity = MathUtils.lerp(0.48, 1.1, daylight);
      hemisphere.current.color.copy(nightHemi).lerp(dayHemi, daylight);
    }
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={["#a7cfdd", 34, 72]} />
      <ambientLight ref={ambient} intensity={1.35} color="#fff0d2" />
      <directionalLight ref={sun} position={[-7, 12, -5]} intensity={2.2} color="#fff1c4" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight ref={hemisphere} args={["#d9f1ff", seasonGround[state.seasonIndex], 1.1]} />
    </>
  );
}

function FestivalDecor({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <group>
      {[-3, -1.5, 0, 1.5, 3].map((x, index) => (
        <Box key={x} position={[x, 1.35, 0.55]} scale={[0.18, 0.22, 0.04]} color={index % 2 ? "#e6b64b" : "#b8202e"} rotation={[0, 0, index % 2 ? 0.2 : -0.2]} />
      ))}
      <Box position={[0, 1.62, 0.56]} scale={[7, 0.025, 0.025]} color="#f2d6a1" />
    </group>
  );
}

function Diorama({ state, onPlacePlatform }: SceneProps) {
  const platformLength = 6 + state.lengthLevel * 2.25;
  const trackCount = Math.max(1, state.platforms);
  const activeEvent = state.activeTrain?.trainId === "br01" || state.boosts.some((boost) => boost.label === "Steam festival");
  return (
    <>
      <LockedCamera />
      <Atmosphere state={state} />

      <mesh position={[0, -0.2, 2.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 56]} />
        <meshStandardMaterial color={seasonGround[state.seasonIndex]} roughness={state.raining ? 0.32 : 0.95} metalness={state.raining ? 0.12 : 0} />
      </mesh>
      <LandscapeScenery seasonIndex={state.seasonIndex} />

      {state.region && Array.from({ length: trackCount }, (_, index) => (
        <Track key={index} z={-0.72 + index * 1.25} length={66} />
      ))}

      {state.region && !state.platformPlaced ? (
        <group onClick={onPlacePlatform} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "default") }>
          <Box position={[0, 0.07, 0]} scale={[7.7, 0.54, 0.58]} color="#8f7e4a" />
          <Box position={[0, 0.39, 0]} scale={[7.5, 0.14, 0.54]} color="#e9c858" />
          <Box position={[0, 0.49, -0.22]} scale={[7.5, 0.03, 0.07]} color="#fff0a6" />
        </group>
      ) : state.region ? (
        <>
          {Array.from({ length: state.platforms }, (_, index) => (
            <Platform key={index} index={index} length={platformLength} amenities={state.systems.amenities} />
          ))}
          <Dirt cleanliness={state.cleanliness} />
          <Suspense fallback={null}><TrainConsist state={state} /></Suspense>
        </>
      ) : null}

      <StationBuilding tier={state.tier} daylight={daylightFactor(state.simSeconds)} />
      {state.systems.electrification && <Catenary trackCount={trackCount} length={58} />}
      {state.systems.signaling && <Signal advanced={state.systems.advancedSignaling} />}
      {state.systems.roadAccess && <RoadAccess />}
      {state.systems.maintenance && <MaintenanceYard />}
      <FestivalDecor active={activeEvent} />
      {state.raining && <Rain />}
    </>
  );
}

export default function StationScene(props: SceneProps) {
  const night = isNight(props.state);
  return (
    <Canvas
      className="station-canvas"
      orthographic
      shadows="basic"
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(new Color(night ? "#101c2c" : "#a7cfdd"));
      }}
    >
      <Suspense fallback={null}>
        <Diorama {...props} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(`/models/trains/br650.glb?v=${TRAIN_ASSET_VERSION}`);
useGLTF.preload(`/models/trains/br642.glb?v=${TRAIN_ASSET_VERSION}`);
useGLTF.preload(`/models/trains/br648.glb?v=${TRAIN_ASSET_VERSION}`);
