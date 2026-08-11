"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { Group, Points } from "three";
import { Color, MathUtils } from "three";
import { isNight } from "./simulation";
import { TRAINS } from "./data";
import type { GameState, TrainDefinition } from "./types";

interface SceneProps {
  state: GameState;
  onPlacePlatform: () => void;
}

const seasonGround = ["#78945c", "#6f9958", "#9b8050", "#b8c3bf"];

function LockedCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(13, 12, 13);
    camera.lookAt(0, 0.4, 0);
    if ("zoom" in camera) {
      camera.zoom = size.width < 620 ? 34 : size.width < 980 ? 42 : 50;
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
  const sleepers = useMemo(() => Array.from({ length: 25 }, (_, index) => -length / 2 + (index / 24) * length), [length]);
  return (
    <group>
      <Box position={[0, 0.07, z]} scale={[length, 0.09, 0.68]} color="#48504f" castShadow={false} />
      {sleepers.map((x) => (
        <Box key={x} position={[x, 0.13, z]} scale={[0.12, 0.08, 0.92]} color="#795c42" castShadow={false} />
      ))}
      <Box position={[0, 0.19, z - 0.27]} scale={[length, 0.06, 0.06]} color="#c1c6c4" />
      <Box position={[0, 0.19, z + 0.27]} scale={[length, 0.06, 0.06]} color="#c1c6c4" />
    </group>
  );
}

function Platform({ index, length, amenities }: { index: number; length: number; amenities: boolean }) {
  const z = -0.05 + index * 1.25;
  return (
    <group>
      <Box position={[0, 0.34, z]} scale={[length, 0.34, 0.54]} color={index === 0 ? "#d7d0bd" : "#c9c4b5"} />
      <Box position={[0, 0.53, z - 0.2]} scale={[length, 0.05, 0.08]} color="#f6e9b2" />
      <Box position={[0, 0.53, z + 0.2]} scale={[length, 0.05, 0.08]} color="#f6e9b2" />
      {amenities && (
        <>
          <Box position={[-1.5, 0.78, z]} scale={[0.78, 0.08, 0.23]} color="#235a5a" />
          <Box position={[-1.76, 0.62, z]} scale={[0.08, 0.35, 0.08]} color="#394443" />
          <Box position={[-1.24, 0.62, z]} scale={[0.08, 0.35, 0.08]} color="#394443" />
          <Box position={[1.6, 0.85, z]} scale={[0.12, 0.78, 0.12]} color="#3b4747" />
          <pointLight position={[1.6, 1.35, z]} intensity={0.8} distance={3} color="#ffd994" />
        </>
      )}
    </group>
  );
}

function Catenary({ trackCount, length }: { trackCount: number; length: number }) {
  const poles = [-length / 2 + 0.8, 0, length / 2 - 0.8];
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

function StationBuilding({ tier, night }: { tier: number; night: boolean }) {
  if (tier < 2) return null;
  const width = 2.2 + tier * 0.42;
  const height = 0.72 + tier * 0.26;
  return (
    <group position={[-1.2, 0, 3.8]}>
      <Box position={[0, height / 2 + 0.2, 0]} scale={[width, height, 1.35]} color={tier >= 5 ? "#ede3c9" : "#d1b98e"} />
      <Box position={[0, height + 0.35, 0]} scale={[width + 0.28, 0.16, 1.58]} color="#32494c" />
      <Box position={[0.55, 0.72, -0.69]} scale={[0.58, 0.9, 0.06]} color="#2b4a55" />
      <Box position={[-0.62, 0.86, -0.69]} scale={[0.52, 0.46, 0.06]} color={night ? "#ffd878" : "#547482"} />
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

function ProceduralCoach({ train, index }: { train: TrainDefinition; index: number }) {
  const height = train.style === "double" || train.id === "tgv-duplex" ? 0.82 : 0.62;
  const body = train.style === "steam" ? "#5a3028" : train.colors.body;
  const accent = train.style === "steam" ? "#d2ad69" : train.colors.accent;
  return (
    <group position={[-1.08 - index * 0.92, 0, 0]}>
      <Box position={[0, 0.5, 0]} scale={[0.82, height, 0.49]} color={body} />
      <Box position={[0, 0.62, -0.255]} scale={[0.62, 0.16, 0.02]} color={train.colors.windows} />
      <Box position={[0, 0.3, -0.262]} scale={[0.76, 0.04, 0.02]} color={accent} />
      <Box position={[0, 0.1, 0]} scale={[0.62, 0.1, 0.38]} color="#222929" />
    </group>
  );
}

function TrainConsist({ state }: { state: GameState }) {
  const active = state.activeTrain;
  const group = useRef<Group>(null);
  const train = active ? TRAINS.find((candidate) => candidate.id === active.trainId) : null;
  const gltf = useGLTF(train ? `/models/trains/${train.modelKey}.glb` : "/models/trains/br650.glb");
  const head = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const targetX = useMemo(() => {
    if (!active) return -18;
    const progress = MathUtils.clamp(active.phaseElapsed / active.phaseDuration, 0, 1);
    if (active.phase === "approach") return MathUtils.lerp(-18, 3.8, 1 - Math.pow(1 - progress, 3));
    if (active.phase === "depart") return MathUtils.lerp(3.8, 18, progress * progress);
    return 3.8;
  }, [active]);
  useFrame((_, delta) => {
    if (group.current) group.current.position.x = MathUtils.damp(group.current.position.x, targetX, 8, delta);
  });
  if (!active || !train) return null;
  return (
    <group ref={group} position={[-18, 0.25, -0.72]} rotation={[0, Math.PI, 0]} scale={0.72}>
      <Clone object={head} castShadow />
      {Array.from({ length: Math.max(0, train.cars - 1) }, (_, index) => (
        <ProceduralCoach key={index} train={train} index={index} />
      ))}
      <SteamPuffs active={train.style === "steam"} />
    </group>
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
  const night = isNight(state);
  const platformLength = 6 + state.lengthLevel * 2.25;
  const trackCount = Math.max(1, state.platforms);
  const activeEvent = state.activeTrain?.trainId === "br01" || state.boosts.some((boost) => boost.label === "Steam festival");
  return (
    <>
      <LockedCamera />
      <color attach="background" args={[night ? "#101c2c" : state.raining ? "#60777b" : "#a7cfdd"]} />
      <fog attach="fog" args={[night ? "#101c2c" : "#a7cfdd", 16, 34]} />
      <ambientLight intensity={night ? 0.48 : 1.35} color={night ? "#7893bd" : "#fff0d2"} />
      <directionalLight position={[-7, 12, -5]} intensity={night ? 0.8 : 2.2} color={night ? "#94aee0" : "#fff1c4"} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={[night ? "#28395e" : "#d9f1ff", seasonGround[state.seasonIndex], night ? 0.55 : 1.1]} />

      <mesh position={[0, -0.12, 1.8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 18]} />
        <meshStandardMaterial color={seasonGround[state.seasonIndex]} roughness={state.raining ? 0.32 : 0.95} metalness={state.raining ? 0.12 : 0} />
      </mesh>
      <Box position={[0, -0.26, 1.8]} scale={[26.3, 0.3, 18.3]} color="#4b5748" />

      {state.region && !state.platformPlaced ? (
        <group onClick={onPlacePlatform} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "default")}>
          <Box position={[0, 0.33, 0]} scale={[7.5, 0.32, 0.56]} color="#e9c858" />
        </group>
      ) : state.region ? (
        <>
          {Array.from({ length: state.platforms }, (_, index) => (
            <Platform key={index} index={index} length={platformLength} amenities={state.systems.amenities} />
          ))}
          {Array.from({ length: trackCount }, (_, index) => (
            <Track key={index} z={-0.72 + index * 1.25} length={22} />
          ))}
          <Dirt cleanliness={state.cleanliness} />
          <TrainConsist state={state} />
        </>
      ) : null}

      <StationBuilding tier={state.tier} night={night} />
      {state.systems.electrification && <Catenary trackCount={trackCount} length={platformLength + 1} />}
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

useGLTF.preload("/models/trains/br650.glb");
