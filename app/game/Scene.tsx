"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { AmbientLight, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Points } from "three";
import { CatmullRomCurve3, Color, MathUtils, Object3D, Vector3 } from "three";
import { daylightFactor, isNight } from "./simulation";
import { TRAINS } from "./data";
import { TRAFFIC_CAR_KINDS, catenaryPolePositions, trainMotionPosition } from "./visual";
import type { ActiveTrain, GameState, TrainDefinition } from "./types";

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
  const bodyBottom = 0.34;
  const bodyTop = bodyBottom + height;
  const windowColor = new Color("#ffd878").lerp(new Color("#547482"), daylight).getStyle();
  return (
    <group position={[-1.45, 0, -3.45]}>
      {/* The masonry plinth meets the terrain at y=-0.2 and makes the station
          read as a built structure instead of a box hovering above the lawn. */}
      <Box position={[0, 0.07, 0]} scale={[width + 0.34, 0.54, 1.62]} color="#8e8779" />
      <Box position={[0, bodyBottom + height / 2, 0]} scale={[width, height, 1.35]} color={tier >= 5 ? "#ede3c9" : "#d1b98e"} />
      <Box position={[0, bodyTop + 0.19, -0.34]} scale={[width + 0.34, 0.14, 0.96]} color="#32494c" rotation={[0.33, 0, 0]} />
      <Box position={[0, bodyTop + 0.19, 0.34]} scale={[width + 0.34, 0.14, 0.96]} color="#32494c" rotation={[-0.33, 0, 0]} />

      {/* The facade now faces the locked camera and the tracks. */}
      <Box position={[0.55, bodyBottom + 0.45, 0.69]} scale={[0.58, 0.9, 0.06]} color="#2b4a55" />
      <Box position={[-0.62, bodyBottom + 0.52, 0.69]} scale={[0.52, 0.46, 0.06]} color={windowColor} />
      <Box position={[0, bodyTop + 0.51, 0.79]} scale={[1.18, 0.35, 0.08]} color="#f0e9d7" />
      <Box position={[0, bodyTop + 0.51, 0.84]} scale={[0.74, 0.06, 0.02]} color="#b51f2e" />

      {/* Entrance steps and a forecourt visually connect the building to the station. */}
      <Box position={[0.55, 0.25, 0.98]} scale={[0.8, 0.12, 0.48]} color="#bbb3a1" />
      <Box position={[0.55, 0.08, 1.28]} scale={[1.05, 0.12, 0.48]} color="#a9a290" />
      <Box position={[0, -0.13, 1.9]} scale={[width + 1.15, 0.12, 1.28]} color="#b8b09d" castShadow={false} />
      {tier >= 4 && <Box position={[-width / 2 + 0.5, bodyTop + 0.79, -0.18]} scale={[0.16, 1.1, 0.16]} color="#2f3e3f" />}
      {tier >= 5 && <Box position={[-width / 2 + 0.5, bodyTop + 1.37, -0.18]} scale={[0.74, 0.12, 0.12]} color="#bf1d2e" />}
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

type TrafficCarKind = (typeof TRAFFIC_CAR_KINDS)[number];

interface TrafficCarSpec {
  kind: TrafficCarKind;
  color: string;
  accent: string;
  x: number;
  direction: 1 | -1;
  speed: number;
}

const TRAFFIC_CARS: TrafficCarSpec[] = [
  { kind: "sedan", color: "#305e8c", accent: "#dbe9ee", x: -43, direction: 1, speed: 4.1 },
  { kind: "hatch", color: "#d34e3f", accent: "#f1d5b5", x: -29, direction: 1, speed: 3.5 },
  { kind: "suv", color: "#475851", accent: "#d9e1d8", x: -15, direction: 1, speed: 3.2 },
  { kind: "pickup", color: "#b98237", accent: "#e7d3a7", x: -1, direction: 1, speed: 3.7 },
  { kind: "coupe", color: "#8c3153", accent: "#e9d5d7", x: 13, direction: 1, speed: 4.6 },
  { kind: "taxi", color: "#e3b832", accent: "#252a2a", x: 28, direction: 1, speed: 3.8 },
  { kind: "estate", color: "#547e72", accent: "#d8e8e4", x: 42, direction: -1, speed: 3.8 },
  { kind: "micro", color: "#e8e2d1", accent: "#3d6d82", x: 28, direction: -1, speed: 3.1 },
  { kind: "van", color: "#c5cbd0", accent: "#245b83", x: 14, direction: -1, speed: 3.4 },
  { kind: "delivery", color: "#f0eee5", accent: "#c33a31", x: 0, direction: -1, speed: 3 },
  { kind: "fastback", color: "#273f62", accent: "#80c7cf", x: -14, direction: -1, speed: 4.4 },
  { kind: "compact", color: "#6e4f91", accent: "#e2d5ec", x: -29, direction: -1, speed: 3.6 },
];

function TrafficCar({ spec }: { spec: TrafficCarSpec }) {
  const long = spec.kind === "estate" || spec.kind === "delivery" ? 1.18 : spec.kind === "micro" ? 0.72 : spec.kind === "hatch" ? 0.84 : spec.kind === "compact" ? 0.78 : spec.kind === "van" || spec.kind === "pickup" ? 1.08 : 0.94;
  const wide = spec.kind === "suv" || spec.kind === "van" || spec.kind === "delivery" ? 0.62 : 0.54;
  const tall = spec.kind === "van" || spec.kind === "delivery" ? 0.58 : spec.kind === "suv" || spec.kind === "micro" ? 0.48 : 0.33;
  const cabinX = spec.kind === "pickup" ? 0.27 : spec.kind === "hatch" ? -0.12 : spec.kind === "compact" ? 0.08 : spec.kind === "coupe" || spec.kind === "fastback" ? -0.08 : 0;
  const cabinLength = long * (spec.kind === "micro" ? 0.65 : spec.kind === "estate" ? 0.75 : spec.kind === "hatch" ? 0.68 : 0.58);
  return (
    <group rotation={[0, spec.direction < 0 ? Math.PI : 0, 0]}>
      <Box position={[0, 0.28, 0]} scale={[long, 0.28, wide]} color={spec.color} />
      {spec.kind === "delivery" ? (
        <>
          <Box position={[-0.13, 0.65, 0]} scale={[0.76, 0.68, wide]} color={spec.color} />
          <Box position={[0.43, 0.52, 0]} scale={[0.3, 0.42, wide - 0.04]} color={spec.accent} />
        </>
      ) : spec.kind === "van" ? (
        <Box position={[-0.06, 0.59, 0]} scale={[0.87, 0.58, wide - 0.03]} color={spec.color} />
      ) : spec.kind === "pickup" ? (
        <>
          <Box position={[0.28, 0.53, 0]} scale={[0.43, 0.46, wide - 0.04]} color={spec.color} />
          <Box position={[-0.28, 0.46, -wide / 2 + 0.04]} scale={[0.48, 0.25, 0.07]} color={spec.color} />
          <Box position={[-0.28, 0.46, wide / 2 - 0.04]} scale={[0.48, 0.25, 0.07]} color={spec.color} />
        </>
      ) : (
        <Box position={[cabinX, 0.49 + tall * 0.18, 0]} scale={[cabinLength, tall, wide - 0.05]} color={spec.accent} rotation={[0, 0, spec.kind === "coupe" ? -0.1 : spec.kind === "fastback" ? 0.08 : 0]} />
      )}
      {spec.kind !== "delivery" && [-1, 1].map((side) => (
        <Box key={side} position={[cabinX + 0.05, 0.57 + tall * 0.16, side * (wide / 2 + 0.012)]} scale={[Math.max(0.28, cabinLength * 0.68), 0.16, 0.025]} color="#213b45" castShadow={false} />
      ))}
      <Box position={[long / 2 + 0.012, 0.31, 0]} scale={[0.025, 0.12, wide * 0.72]} color="#f4e6ac" />
      <Box position={[-long / 2 - 0.012, 0.31, 0]} scale={[0.025, 0.1, wide * 0.72]} color="#d74942" />
      {spec.kind === "taxi" && <Box position={[0, 0.79, 0]} scale={[0.24, 0.12, 0.18]} color="#f3d64d" />}
      {spec.kind === "coupe" && <Box position={[-long / 2 + 0.08, 0.47, 0]} scale={[0.18, 0.035, wide + 0.08]} color="#272d2f" />}
      {spec.kind === "fastback" && <Box position={[long / 2 + 0.02, 0.42, 0]} scale={[0.03, 0.045, wide * 0.9]} color="#68e1e6" />}
      {spec.kind === "suv" && (
        <>
          <Box position={[-0.2, 0.83, -0.2]} scale={[0.72, 0.035, 0.035]} color="#293332" />
          <Box position={[-0.2, 0.83, 0.2]} scale={[0.72, 0.035, 0.035]} color="#293332" />
        </>
      )}
      {[-long * 0.3, long * 0.3].map((x) => [-wide / 2 - 0.025, wide / 2 + 0.025].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.14, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 10]} />
          <meshStandardMaterial color="#151b1c" roughness={0.62} />
        </mesh>
      )))}
    </group>
  );
}

function RoadAccess({ speed }: { speed: 1 | 2 | 3 }) {
  const cars = useRef<Array<Group | null>>([]);
  useFrame((_, delta) => {
    TRAFFIC_CARS.forEach((spec, index) => {
      const car = cars.current[index];
      if (!car) return;
      car.position.x += spec.direction * spec.speed * delta * speed;
      if (spec.direction > 0 && car.position.x > 48) car.position.x = -50 - (index % 3) * 2.5;
      if (spec.direction < 0 && car.position.x < -48) car.position.x = 50 + (index % 3) * 2.5;
    });
  });
  return (
    <group position={[0, 0, -6.35]}>
      <Box position={[0, -0.11, 0]} scale={[92, 0.18, 1.72]} color="#4d5555" castShadow={false} />
      <Box position={[0, -0.005, -0.79]} scale={[92, 0.025, 0.06]} color="#d7d4c5" castShadow={false} />
      <Box position={[0, -0.005, 0.79]} scale={[92, 0.025, 0.06]} color="#d7d4c5" castShadow={false} />
      {Array.from({ length: 38 }, (_, index) => (
        <Box key={index} position={[-44 + index * 2.4, 0.005, 0]} scale={[1.18, 0.025, 0.055]} color="#e7dd9e" castShadow={false} />
      ))}
      <Box position={[0, -0.05, 1.12]} scale={[92, 0.16, 0.46]} color="#a9a496" castShadow={false} />
      {TRAFFIC_CARS.map((spec, index) => (
        <group
          key={spec.kind}
          ref={(node) => { cars.current[index] = node; }}
          position={[spec.x, 0.04, spec.direction > 0 ? 0.4 : -0.4]}
        >
          <TrafficCar spec={spec} />
        </group>
      ))}
    </group>
  );
}

function MaintenanceYard() {
  const siding = useMemo(() => new CatmullRomCurve3([
    new Vector3(-11, 0.13, -0.72),
    new Vector3(-8, 0.13, -1.6),
    new Vector3(1.5, 0.13, -1.6),
    new Vector3(3.2, 0.13, -3.42),
    new Vector3(5.9, 0.13, -3.45),
  ], false, "catmullrom", 0.25), []);
  const leftRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0.03, -0.27))), false, "catmullrom", 0.25), [siding]);
  const rightRail = useMemo(() => new CatmullRomCurve3(siding.points.map((point) => point.clone().add(new Vector3(0, 0.03, 0.27))), false, "catmullrom", 0.25), [siding]);
  const sleepers = useMemo(() => Array.from({ length: 34 }, (_, index) => {
    const t = index / 33;
    const point = siding.getPoint(t);
    const tangent = siding.getTangent(t);
    return { point, rotation: -Math.atan2(tangent.z, tangent.x) };
  }), [siding]);
  return (
    <group>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[leftRail, 52, 0.045, 7, false]} />
        <meshStandardMaterial color="#c5cbc9" metalness={0.72} roughness={0.38} />
      </mesh>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[rightRail, 52, 0.045, 7, false]} />
        <meshStandardMaterial color="#c5cbc9" metalness={0.72} roughness={0.38} />
      </mesh>
      {sleepers.map(({ point, rotation }, index) => (
        <Box key={index} position={[point.x, 0.075, point.z]} scale={[0.11, 0.07, 0.82]} color="#6f513a" rotation={[0, rotation, 0]} castShadow={false} />
      ))}
      <group position={[5.05, 0, -3.45]}>
        <Box position={[0, 0.07, 0]} scale={[3.25, 0.54, 2.02]} color="#817f76" />
        <Box position={[0, 0.95, 0]} scale={[3.1, 1.22, 1.9]} color="#6f827e" />
        <Box position={[0, 1.67, -0.45]} scale={[3.4, 0.14, 1.18]} color="#2f4548" rotation={[0.32, 0, 0]} />
        <Box position={[0, 1.67, 0.45]} scale={[3.4, 0.14, 1.18]} color="#2f4548" rotation={[-0.32, 0, 0]} />
        <Box position={[-1.58, 0.86, -0.45]} scale={[0.08, 1.08, 0.7]} color="#26383a" />
        <Box position={[-1.58, 0.86, 0.45]} scale={[0.08, 1.08, 0.7]} color="#26383a" />
        <Box position={[-1.63, 1.48, 0]} scale={[0.04, 0.16, 1.66]} color="#d7c75d" />
        <Box position={[0.35, 1.12, 0.96]} scale={[0.72, 0.45, 0.06]} color="#b9d9d7" />
        <pointLight position={[-1.9, 1.65, 0]} intensity={1.2} distance={4} color="#ffd884" />
      </group>
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
        const z = farSide ? 7.1 + ((index * 2.3) % 5.4) : -8.7 - ((index * 1.7) % 3.5);
        return { position: [x, -0.2, z] as [number, number, number], scale: 0.72 + (index % 5) * 0.12 };
      }),
    [],
  );
  const shrubs = useMemo(
    () => Array.from({ length: 24 }, (_, index) => ({ x: -19 + ((index * 5.3) % 38), z: index % 2 ? 6.4 : -8.55, scale: 0.32 + (index % 4) * 0.08 })),
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
      <Box position={[0, 0.18, -8.05]} scale={[58, 0.07, 0.06]} color="#a9a18b" castShadow={false} />
      {Array.from({ length: 20 }, (_, index) => (
        <Box key={index} position={[-27 + index * 2.8, 0.43, -8.05]} scale={[0.055, 0.55, 0.055]} color="#756c5a" castShadow={false} />
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

function TrainConsist({ active, platformIndex, speed }: { active: ActiveTrain; platformIndex: number; speed: 1 | 2 | 3 }) {
  const group = useRef<Group>(null);
  const motion = useRef({ trainId: "", phase: "", elapsed: 0 });
  const train = TRAINS.find((candidate) => candidate.id === active.trainId);
  const gltf = useGLTF(train ? `/models/trains/${train.modelKey}.glb?v=${TRAIN_ASSET_VERSION}` : `/models/trains/br650.glb?v=${TRAIN_ASSET_VERSION}`);
  const head = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const entryX = train ? -34 - train.cars * 1.6 : -34;
  const exitX = train ? 36 + train.cars * 1.6 : 36;
  useFrame((_, delta) => {
    if (!group.current) return;
    const visual = motion.current;
    if (visual.trainId !== active.trainId || visual.phase !== active.phase) {
      visual.trainId = active.trainId;
      visual.phase = active.phase;
      visual.elapsed = active.phaseElapsed;
    } else {
      // Extrapolate between deterministic 10 Hz simulation snapshots, then
      // correct only forward so a late snapshot can never make a train jump back.
      visual.elapsed = Math.min(active.phaseDuration, Math.max(visual.elapsed, active.phaseElapsed) + delta * speed);
    }
    group.current.position.x = trainMotionPosition(active.phase, visual.elapsed, active.phaseDuration, entryX, 4.4, exitX);
  });
  if (!train) return null;
  const tailIndex = train.cars - 2;
  const hasMirroredTail = DOUBLE_ENDED_TRAINS.has(train.id) && train.cars > 1;
  return (
    <group ref={group} position={[entryX, 0.25, -0.72 + platformIndex * 1.25]} scale={[1.5, 0.82, 0.82]}>
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

function EventCelebration({ eventId, platformCount }: { eventId: "ice-s" | "br01" | null; platformCount: number }) {
  const movingLights = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!movingLights.current || !eventId) return;
    movingLights.current.position.x = Math.sin(clock.elapsedTime * 1.75) * 3.2;
    movingLights.current.position.z = Math.cos(clock.elapsedTime * 1.2) * 0.35;
  });
  if (!eventId) return null;
  const iceEvent = eventId === "ice-s";
  const eventColors = iceEvent ? ["#62dcff", "#ffffff", "#e21e37"] : ["#ffd04d", "#e13a39", "#fff1bc"];
  const rearZ = -1.62;
  const frontZ = Math.max(1.25, platformCount * 1.25);
  return (
    <group>
      {[rearZ, frontZ].map((z) => (
        <group key={z}>
          <Box position={[-5.2, 1.45, z]} scale={[0.08, 2.9, 0.08]} color="#3c4b49" />
          <Box position={[5.2, 1.45, z]} scale={[0.08, 2.9, 0.08]} color="#3c4b49" />
          <Box position={[0, 2.83, z]} scale={[10.4, 0.025, 0.025]} color="#e7d9b2" castShadow={false} />
          {Array.from({ length: 13 }, (_, index) => {
            const color = eventColors[index % eventColors.length];
            return (
              <mesh key={index} position={[-4.8 + index * 0.8, 2.75 - Math.sin((index / 12) * Math.PI) * 0.3, z]}>
                <sphereGeometry args={[0.095, 10, 10]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} />
              </mesh>
            );
          })}
        </group>
      ))}

      {[-4.1, -2.45, -0.8, 0.85, 2.5, 4.15].map((x, index) => (
        <Box
          key={x}
          position={[x, 1.25, frontZ - 0.04]}
          scale={[0.22, 0.32, 0.045]}
          color={eventColors[index % eventColors.length]}
          rotation={[0, 0, index % 2 ? 0.18 : -0.18]}
        />
      ))}
      <Box position={[0, 1.6, frontZ]} scale={[9.4, 0.025, 0.025]} color="#f3ddb0" castShadow={false} />

      <group ref={movingLights} position={[0, 2.1, (rearZ + frontZ) / 2]}>
        <pointLight intensity={2.4} distance={8} color={eventColors[0]} />
        <pointLight position={[1.9, 0.35, 0]} intensity={2} distance={7} color={eventColors[1]} />
        <pointLight position={[-1.9, -0.15, 0]} intensity={2} distance={7} color={eventColors[2]} />
      </group>

      <group position={[0, 1.16, frontZ + 0.12]}>
        <Box position={[-2.9, 0, 0]} scale={[0.09, 1.8, 0.09]} color="#394745" />
        <Box position={[2.9, 0, 0]} scale={[0.09, 1.8, 0.09]} color="#394745" />
        <Box position={[0, 0.55, 0]} scale={[5.65, 0.72, 0.08]} color={iceEvent ? "#e8f6f8" : "#8c2428"} />
        <Box position={[0, 0.55, 0.05]} scale={[3.7, 0.08, 0.025]} color={iceEvent ? "#d71935" : "#f2c95b"} />
      </group>
    </group>
  );
}

function Diorama({ state, onPlacePlatform }: SceneProps) {
  const platformLength = 6 + state.lengthLevel * 2.25;
  const trackCount = Math.max(1, state.platforms);
  const activeEventId = state.eventWindow ?? state.platformLanes.find((lane) => lane.activeTrain?.trainId === "ice-s" || lane.activeTrain?.trainId === "br01")?.activeTrain?.trainId;
  const boostedEventId = state.boosts.some((boost) => boost.label === "ICE-S record excitement")
    ? "ice-s"
    : state.boosts.some((boost) => boost.label === "Steam festival") ? "br01" : null;
  const eventId = activeEventId === "ice-s" || activeEventId === "br01" ? activeEventId : boostedEventId;
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
          {state.platformLanes.map((lane) => lane.activeTrain && (
            <Suspense key={`${lane.platformIndex}-${lane.activeTrain.trainId}`} fallback={null}>
              <TrainConsist active={lane.activeTrain} platformIndex={lane.platformIndex} speed={state.speed} />
            </Suspense>
          ))}
        </>
      ) : null}

      <StationBuilding tier={state.tier} daylight={daylightFactor(state.simSeconds)} />
      {state.systems.electrification && <Catenary trackCount={trackCount} length={58} />}
      {state.systems.signaling && <Signal advanced={state.systems.advancedSignaling} />}
      {state.systems.roadAccess && <RoadAccess speed={state.speed} />}
      {state.systems.maintenance && <MaintenanceYard />}
      <EventCelebration eventId={eventId} platformCount={trackCount} />
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
