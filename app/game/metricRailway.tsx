"use client";

/* eslint-disable react/no-unknown-property */

import { useMemo } from "react";

export const RAILWAY_METRIC_PROFILE = {
  metersToWorld: 0.071,
  standardGaugeMeters: 1.435,
  railTopY: 0.295,
  groundDepthBelowRailMeters: 1.75,
  platformWidthMeters: 5,
  platformHeightMeters: 0.55,
  platformEdgeClearanceMeters: 0.2,
  vehicleWidthMeters: 2.825,
  catenaryContactHeightMeters: 5.5,
  reviewTrackCenterSpacingMeters: 5,
  sleeperLengthMeters: 2.58,
  maxFormationLengthMeters: 258,
  productionCameraLengthMeters: 280,
  trackLengthMeters: 845,
  platformLengthMetersByLevel: [90, 130, 170, 220, 280],
} as const;

export function railwayMetersToWorld(meters: number) {
  return meters * RAILWAY_METRIC_PROFILE.metersToWorld;
}

export const RAILWAY_GROUND_Y =
  RAILWAY_METRIC_PROFILE.railTopY -
  railwayMetersToWorld(RAILWAY_METRIC_PROFILE.groundDepthBelowRailMeters);

export const PRODUCTION_TRACK_CENTER_SPACING_METERS =
  RAILWAY_METRIC_PROFILE.vehicleWidthMeters +
  RAILWAY_METRIC_PROFILE.platformEdgeClearanceMeters * 2 +
  RAILWAY_METRIC_PROFILE.platformWidthMeters;

export function productionTrackCenter(platformIndex: number, platformCount: number) {
  const spacing = railwayMetersToWorld(PRODUCTION_TRACK_CENTER_SPACING_METERS);
  return (platformIndex - (platformCount - 1) / 2) * spacing;
}

export function metricPlatformCenter(trackCenter: number, side: 1 | -1 = 1) {
  const offset = railwayMetersToWorld(
    RAILWAY_METRIC_PROFILE.vehicleWidthMeters / 2 +
      RAILWAY_METRIC_PROFILE.platformEdgeClearanceMeters +
      RAILWAY_METRIC_PROFILE.platformWidthMeters / 2,
  );
  return trackCenter + side * offset;
}

export function platformLengthMeters(lengthLevel: number) {
  const index = Math.max(0, Math.min(4, Math.round(lengthLevel) - 1));
  return RAILWAY_METRIC_PROFILE.platformLengthMetersByLevel[index];
}

export function MetricTrack({
  z = 0,
  length = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.trackLengthMeters),
}: {
  z?: number;
  length?: number;
}) {
  const railWidth = 0.012;
  const railHeight = 0.014;
  const sleeperHeight = 0.016;
  const railTop = RAILWAY_METRIC_PROFILE.railTopY;
  const railOffset = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.standardGaugeMeters / 2);
  const sleeperLength = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.sleeperLengthMeters);
  const sleeperTop = railTop - railHeight;
  const ballastTop = sleeperTop - sleeperHeight + 0.002;
  const ballastHeight = ballastTop - RAILWAY_GROUND_Y;
  const sleeperSpacing = railwayMetersToWorld(4.2);
  const sleeperPositions = useMemo(() => {
    const count = Math.max(2, Math.floor(length / sleeperSpacing) + 1);
    return Array.from(
      { length: count },
      (_, index) => -length / 2 + (index / (count - 1)) * length,
    );
  }, [length, sleeperSpacing]);

  return (
    <group>
      <mesh position={[0, RAILWAY_GROUND_Y + ballastHeight / 2, z]} receiveShadow>
        <boxGeometry args={[length, ballastHeight, railwayMetersToWorld(3.6)]} />
        <meshStandardMaterial color="#59615e" roughness={0.96} />
      </mesh>
      {sleeperPositions.map((x) => (
        <mesh key={x} position={[x, sleeperTop - sleeperHeight / 2, z]} receiveShadow>
          <boxGeometry args={[0.025, sleeperHeight, sleeperLength]} />
          <meshStandardMaterial color="#6f513b" roughness={0.9} />
        </mesh>
      ))}
      {[-railOffset, railOffset].map((offset) => (
        <mesh key={offset} position={[0, railTop - railHeight / 2, z + offset]} castShadow receiveShadow>
          <boxGeometry args={[length, railHeight, railWidth]} />
          <meshStandardMaterial color="#c4cac9" metalness={0.76} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function MetricPlatform({
  trackCenter,
  lengthMeters = 280,
  side = 1,
  amenities = true,
}: {
  trackCenter: number;
  lengthMeters?: number;
  side?: 1 | -1;
  amenities?: boolean;
}) {
  const railTop = RAILWAY_METRIC_PROFILE.railTopY;
  const surfaceY = railTop + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformHeightMeters);
  const length = railwayMetersToWorld(lengthMeters);
  const width = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters);
  const innerEdge = trackCenter + side * railwayMetersToWorld(
    RAILWAY_METRIC_PROFILE.vehicleWidthMeters / 2 + RAILWAY_METRIC_PROFILE.platformEdgeClearanceMeters,
  );
  const centerZ = metricPlatformCenter(trackCenter, side);
  const slabHeight = surfaceY - RAILWAY_GROUND_Y;
  const fixtureXs = [-0.36, -0.12, 0.12, 0.36].map((ratio) => ratio * length);

  return (
    <group>
      <mesh position={[0, RAILWAY_GROUND_Y + slabHeight / 2, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[length, slabHeight, width]} />
        <meshStandardMaterial color="#aaa493" roughness={0.88} />
      </mesh>
      <mesh position={[0, surfaceY + 0.006, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[Math.max(0.2, length - 0.04), 0.012, Math.max(0.1, width - 0.02)]} />
        <meshStandardMaterial color="#ded7c4" roughness={0.82} />
      </mesh>
      <mesh position={[0, surfaceY + 0.014, innerEdge + side * 0.022]}>
        <boxGeometry args={[Math.max(0.2, length - 0.12), 0.008, 0.025]} />
        <meshStandardMaterial color="#f7e5a5" roughness={0.75} />
      </mesh>
      {fixtureXs.map((x) => (
        <group key={x} position={[x, 0, centerZ]}>
          <mesh position={[0, surfaceY + 0.13, 0]} castShadow>
            <boxGeometry args={[0.025, 0.26, 0.025]} />
            <meshStandardMaterial color="#40504f" />
          </mesh>
          <mesh position={[0, surfaceY + 0.27, 0]} castShadow>
            <boxGeometry args={[Math.min(0.55, length / 5), 0.025, width * 0.82]} />
            <meshStandardMaterial color="#315a5b" />
          </mesh>
          {amenities && (
            <mesh position={[0, surfaceY + 0.245, side * width * 0.31]}>
              <boxGeometry args={[0.16, 0.018, 0.035]} />
              <meshStandardMaterial color="#ffe3a1" emissive="#ffca62" emissiveIntensity={2.2} />
            </mesh>
          )}
        </group>
      ))}
      {amenities && (
        <group position={[Math.max(-length / 2 + 0.7, -length * 0.24), surfaceY, centerZ]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.52, 0.08, width * 0.36]} />
            <meshStandardMaterial color="#315a5b" roughness={0.62} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.04, 0]} castShadow>
              <boxGeometry args={[0.022, 0.08, 0.022]} />
              <meshStandardMaterial color="#40504f" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function MetricCatenary({
  laneZs,
  length = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.trackLengthMeters),
}: {
  laneZs: number[];
  length?: number;
}) {
  const wireY = RAILWAY_METRIC_PROFILE.railTopY +
    railwayMetersToWorld(RAILWAY_METRIC_PROFILE.catenaryContactHeightMeters);
  const poleTop = wireY + 0.085;
  const poleHeight = poleTop - RAILWAY_GROUND_Y;
  const poleSpacing = railwayMetersToWorld(84.5);
  const polePositions = useMemo(() => {
    const count = Math.max(3, Math.floor(length / poleSpacing) + 1);
    return Array.from({ length: count }, (_, index) => -length / 2 + (index / (count - 1)) * length);
  }, [length, poleSpacing]);

  return (
    <group>
      {laneZs.map((z) => (
        <group key={z}>
          {polePositions.map((x) => (
            <group key={x}>
              <mesh position={[x, RAILWAY_GROUND_Y + poleHeight / 2, z + 0.19]} castShadow>
                <boxGeometry args={[0.025, poleHeight, 0.025]} />
                <meshStandardMaterial color="#5d6867" metalness={0.35} roughness={0.54} />
              </mesh>
              <mesh position={[x, poleTop - 0.02, z]} castShadow>
                <boxGeometry args={[0.025, 0.02, 0.42]} />
                <meshStandardMaterial color="#5d6867" metalness={0.35} roughness={0.54} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, wireY, z]}>
            <boxGeometry args={[length, 0.01, 0.01]} />
            <meshStandardMaterial color="#242d2c" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function MetricContactShadow({
  length,
  width = 0.22,
  z = 0,
  y = RAILWAY_METRIC_PROFILE.railTopY - 0.018,
}: {
  length: number;
  width?: number;
  z?: number;
  y?: number;
}) {
  return (
    <mesh position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[length, width, 1]}>
      <circleGeometry args={[0.5, 48]} />
      <meshBasicMaterial color="#111716" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}
