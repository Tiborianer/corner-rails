"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { DirectionalLight as ThreeDirectionalLight, Group, Object3D, Points, SpotLight as ThreeSpotLight } from "three";
import { ACESFilmicToneMapping, Box3, Vector3 } from "three";
import {
  MetricCatenary,
  MetricContactShadow,
  MetricPlatform,
  MetricTrack,
  RAILWAY_GROUND_Y,
  RAILWAY_METRIC_PROFILE,
  metricPlatformCenter,
  railwayMetersToWorld,
} from "./metricRailway";
import { PLATFORM_FIXTURE_RATIOS } from "./visual";
import {
  TRAIN_REVIEW_CANDIDATES,
  TRAIN_REVIEW_METRIC_SCALE,
  trainReviewAssetUrl,
  trainReviewFormationRotation,
  trainReviewMotionPosition,
  type TrainReviewAtmosphere,
  type TrainReviewCandidate,
  type TrainReviewCandidateId,
  type TrainReviewLoad,
  type TrainReviewLeadingEnd,
  type TrainReviewMotion,
  type TrainReviewScale,
} from "./trainReviewData";

export interface TrainReviewLabInitialState {
  candidateId: TrainReviewCandidateId;
  motion: TrainReviewMotion;
  atmosphere: TrainReviewAtmosphere;
  scale: TrainReviewScale;
  loadCount: TrainReviewLoad;
  leadingEnd: TrainReviewLeadingEnd;
  captureMode: boolean;
  capturePhaseSeconds: number;
  freezeMotion: boolean;
}

function ReviewCamera({ candidate, scale }: { candidate: TrainReviewCandidate; scale: TrainReviewScale }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0.35, 0.48, 0.18);
    if (!("zoom" in camera)) return;
    camera.updateMatrixWorld(true);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const framedLength = railwayMetersToWorld(Math.max(candidate.nominalLengthMeters, candidate.reviewPlatformLengthMeters));
    const halfExtents = new Vector3(
      framedLength / 2,
      railwayMetersToWorld(RAILWAY_METRIC_PROFILE.catenaryContactHeightMeters) / 2,
      railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters + RAILWAY_METRIC_PROFILE.vehicleWidthMeters) / 2,
    );
    const projectedHalfWidth = Math.abs(right.x) * halfExtents.x + Math.abs(right.y) * halfExtents.y + Math.abs(right.z) * halfExtents.z;
    const projectedHalfHeight = Math.abs(up.x) * halfExtents.x + Math.abs(up.y) * halfExtents.y + Math.abs(up.z) * halfExtents.z;
    const margin = scale === "inspect" ? 0.78 : 1.12;
    camera.zoom = Math.min(
      size.width / (2 * projectedHalfWidth * margin),
      size.height / (2 * projectedHalfHeight * margin),
    );
    camera.updateProjectionMatrix();
  }, [camera, candidate, scale, size.height, size.width]);
  return null;
}

function ReviewRain() {
  const points = useRef<Points>(null);
  const positions = useMemo(() => {
    const result = new Float32Array(260 * 3);
    for (let index = 0; index < 260; index += 1) {
      result[index * 3] = -18 + ((index * 47) % 360) / 10;
      result[index * 3 + 1] = 1 + ((index * 71) % 90) / 10;
      result[index * 3 + 2] = -6 + ((index * 31) % 120) / 10;
    }
    return result;
  }, []);
  useFrame((_, delta) => {
    if (!points.current) return;
    points.current.position.y -= delta * 5.4;
    if (points.current.position.y < -5) points.current.position.y = 4;
  });
  return (
    <points ref={points} position={[0, 2, 0]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.055} color="#c1e5ed" transparent opacity={0.78} />
    </points>
  );
}

function FpsProbe({ onSample }: { onSample: (fps: number) => void }) {
  const sample = useRef({ elapsed: 0, frames: 0 });
  useFrame((_, delta) => {
    sample.current.elapsed += delta;
    sample.current.frames += 1;
    if (sample.current.elapsed < 0.75) return;
    onSample(Math.round(sample.current.frames / sample.current.elapsed));
    sample.current = { elapsed: 0, frames: 0 };
  });
  return null;
}

function CandidateFormation({ candidate }: { candidate: TrainReviewCandidate }) {
  const gltf = useGLTF(trainReviewAssetUrl(candidate));
  const formation = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bounds = useMemo(() => new Box3().setFromObject(formation), [formation]);
  const size = useMemo(() => bounds.getSize(new Vector3()), [bounds]);
  return (
    <>
      <MetricContactShadow
        length={size.x * TRAIN_REVIEW_METRIC_SCALE}
        width={Math.max(0.12, size.z * TRAIN_REVIEW_METRIC_SCALE * 0.86)}
      />
      <group position={[0, RAILWAY_METRIC_PROFILE.railTopY, 0]} scale={TRAIN_REVIEW_METRIC_SCALE}>
        <Clone object={formation} castShadow receiveShadow />
      </group>
    </>
  );
}

function CandidateHeadlights({ candidate, atmosphere }: { candidate: TrainReviewCandidate; atmosphere: TrainReviewAtmosphere }) {
  const beam = useRef<ThreeSpotLight>(null);
  const beamTarget = useRef<Object3D>(null);
  const profile = candidate.headlights;
  useEffect(() => {
    if (beam.current && beamTarget.current) beam.current.target = beamTarget.current;
  }, []);
  if (!profile) return null;
  const frontX = railwayMetersToWorld(candidate.nominalLengthMeters / 2 - profile.frontInsetMeters);
  const lightY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(profile.heightMeters);
  const targetX = frontX + railwayMetersToWorld(profile.beamLengthMeters);
  const targetY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(0.28);
  const intensity = atmosphere === "night" ? 92 : atmosphere === "rain" ? 68 : 34;
  const distance = railwayMetersToWorld(profile.beamLengthMeters * 1.25);
  return (
    <>
      <object3D ref={beamTarget} position={[targetX, targetY, 0]} />
      <spotLight ref={beam} position={[frontX, lightY, 0]} color={profile.color} intensity={intensity} distance={distance} angle={0.245} penumbra={0.72} decay={1.45} />
    </>
  );
}

function ReviewPlatformLightPool({ trackCenter, lengthMeters }: { trackCenter: number; lengthMeters: number }) {
  const fill = useRef<ThreeDirectionalLight>(null);
  const fillTarget = useRef<Object3D>(null);
  const platformLength = railwayMetersToWorld(lengthMeters);
  const platformWidth = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformWidthMeters);
  const surfaceY = RAILWAY_METRIC_PROFILE.railTopY + railwayMetersToWorld(RAILWAY_METRIC_PROFILE.platformHeightMeters);
  const platformCenter = metricPlatformCenter(trackCenter);
  const trainSideLampZ = platformCenter - platformWidth * 0.25;
  useEffect(() => {
    if (fill.current && fillTarget.current) fill.current.target = fillTarget.current;
  }, []);
  return (
    <group>
      <object3D ref={fillTarget} position={[0, RAILWAY_METRIC_PROFILE.railTopY + 0.19, trackCenter]} />
      <directionalLight
        ref={fill}
        position={[0, surfaceY + 0.48, trainSideLampZ]}
        intensity={0.58}
        color="#ffd99a"
      />
      {PLATFORM_FIXTURE_RATIOS.map((ratio) => (
        <pointLight
          key={ratio}
          position={[ratio * platformLength, surfaceY + 0.215, trainSideLampZ]}
          intensity={0.18}
          distance={1.25}
          decay={2}
          color="#ffd99a"
        />
      ))}
    </group>
  );
}

function MovingCandidate({
  candidate,
  motion,
  laneIndex,
  laneZ,
  capturePhaseSeconds,
  freezeMotion,
  leadingEnd,
  atmosphere,
}: {
  candidate: TrainReviewCandidate;
  motion: TrainReviewMotion;
  laneIndex: number;
  laneZ: number;
  capturePhaseSeconds: number;
  freezeMotion: boolean;
  leadingEnd: TrainReviewLeadingEnd;
  atmosphere: TrainReviewAtmosphere;
}) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const elapsed = freezeMotion ? capturePhaseSeconds : clock.elapsedTime + capturePhaseSeconds;
    group.current.position.x = trainReviewMotionPosition(motion, elapsed + laneIndex * 2.1);
  });
  return (
    <group ref={group} position={[0, 0, laneZ]} rotation={[0, trainReviewFormationRotation(leadingEnd), 0]}>
      <CandidateFormation candidate={candidate} />
      <CandidateHeadlights candidate={candidate} atmosphere={atmosphere} />
    </group>
  );
}

function ReviewScene({
  candidate,
  motion,
  atmosphere,
  scale,
  loadCount,
  leadingEnd,
  capturePhaseSeconds,
  freezeMotion,
  onFps,
}: Omit<TrainReviewLabInitialState, "candidateId" | "captureMode"> & {
  candidate: TrainReviewCandidate;
  onFps: (fps: number) => void;
}) {
  const night = atmosphere === "night";
  const raining = atmosphere === "rain";
  const laneIndexes = loadCount === 3 ? [-1, 0, 1] : [0];
  const laneSpacing = railwayMetersToWorld(RAILWAY_METRIC_PROFILE.reviewTrackCenterSpacingMeters);
  const laneZs = laneIndexes.map((lane) => lane * laneSpacing);
  const sky = night ? "#101b2d" : raining ? "#637c82" : "#a8d2df";
  return (
    <>
      <ReviewCamera candidate={candidate} scale={scale} />
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 35, 72]} />
      <ambientLight intensity={night ? 0.5 : 1.35} color={night ? "#839bc9" : "#fff0d2"} />
      <directionalLight position={[-7, 13, -5]} intensity={night ? 0.75 : 2.25} color={night ? "#9db2dd" : "#fff0bd"} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={[night ? "#2f4167" : "#dcf1fb", raining ? "#536456" : "#718d55", night ? 0.55 : 1.05]} />
      <mesh position={[0, RAILWAY_GROUND_Y, 0.25]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 50]} />
        <meshStandardMaterial color={night ? "#354238" : "#718c55"} roughness={raining ? 0.32 : 0.95} metalness={raining ? 0.12 : 0} />
      </mesh>
      {laneZs.map((laneZ) => <MetricTrack key={laneZ} z={laneZ} length={60} />)}
      <MetricPlatform trackCenter={Math.max(...laneZs)} lengthMeters={candidate.reviewPlatformLengthMeters} amenities />
      <MetricCatenary laneZs={laneZs} length={60} />
      {laneIndexes.map((laneIndex, index) => (
        <Suspense key={`${candidate.id}-${laneIndex}`} fallback={null}>
          <MovingCandidate candidate={candidate} motion={motion} laneIndex={laneIndex} laneZ={laneZs[index]} capturePhaseSeconds={capturePhaseSeconds} freezeMotion={freezeMotion} leadingEnd={leadingEnd} atmosphere={atmosphere} />
        </Suspense>
      ))}
      {night && <ReviewPlatformLightPool trackCenter={Math.max(...laneZs)} lengthMeters={candidate.reviewPlatformLengthMeters} />}
      {raining && <ReviewRain />}
      <FpsProbe onSample={onFps} />
    </>
  );
}

function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <fieldset className="railjet-lab-segment">
      <legend>{label}</legend>
      <div>{options.map((option) => <button key={option.value} type="button" className={value === option.value ? "active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
    </fieldset>
  );
}

export default function TrainReviewLab({ initialState }: { initialState: TrainReviewLabInitialState }) {
  const candidate = TRAIN_REVIEW_CANDIDATES[initialState.candidateId];
  const [motion, setMotion] = useState(initialState.motion);
  const [atmosphere, setAtmosphere] = useState(initialState.atmosphere);
  const [scale, setScale] = useState(initialState.scale);
  const [loadCount, setLoadCount] = useState(initialState.loadCount);
  const [leadingEnd, setLeadingEnd] = useState(initialState.leadingEnd);
  const [fps, setFps] = useState(60);
  const comparisonCandidate = candidate.comparisonCandidateId && candidate.comparisonCandidateId in TRAIN_REVIEW_CANDIDATES
    ? candidate.comparisonCandidateId as TrainReviewCandidateId
    : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("trainLab", candidate.id);
    params.set("motion", motion);
    params.set("atmosphere", atmosphere);
    params.set("scale", scale);
    params.set("load", String(loadCount));
    params.set("leading", leadingEnd);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [atmosphere, candidate.id, leadingEnd, loadCount, motion, scale]);

  return (
    <main className={`railjet-lab-shell ${initialState.captureMode ? "capture-mode" : ""}`}>
      <div className="railjet-lab-world" aria-label={`Private ${candidate.label} train approval laboratory`}>
        <Canvas orthographic shadows="basic" dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; }}>
          <Suspense fallback={null}>
            <ReviewScene candidate={candidate} motion={motion} atmosphere={atmosphere} scale={scale} loadCount={loadCount} leadingEnd={leadingEnd} capturePhaseSeconds={initialState.capturePhaseSeconds} freezeMotion={initialState.freezeMotion} onFps={setFps} />
          </Suspense>
        </Canvas>
      </div>
      <header className="railjet-lab-title">
        <span className="railjet-lab-blind">{candidate.badge}</span>
        <div><small>Corner Rails · Private train approval laboratory</small><h1>{candidate.label}</h1><p>{candidate.vehicleCount} {candidate.vehicleCount === 1 ? "vehicle" : "vehicles"} · {candidate.nominalLengthMeters} m · {candidate.reviewStage === "cab" ? "cab approval checkpoint" : candidate.reviewStage === "continuity" ? "two-car continuity checkpoint" : candidate.approvalStatus === "approved-production" ? "approved production asset" : "review candidate"}</p></div>
      </header>
      {!initialState.captureMode && (
        <aside className="railjet-lab-controls" aria-label="Train review controls">
          <div className="railjet-lab-control-head"><div><small>{candidate.reviewStage === "cab" ? "Awaiting cab approval" : candidate.reviewStage === "continuity" ? "Awaiting continuity approval" : candidate.approvalStatus === "approved-production" ? "Approved in production" : "Not in production"}</small><strong>{candidate.revision.replaceAll("-", " ")}</strong></div><div className="railjet-lab-control-actions">{comparisonCandidate && <button type="button" onClick={() => window.location.assign(`/?trainLab=${comparisonCandidate}&motion=stationary&atmosphere=day&scale=inspect&load=1`)}>{candidate.comparisonLabel ?? "Compare candidate"}</button>}<button type="button" onClick={() => window.location.assign("/")}>Exit</button></div></div>
          <p>{candidate.reviewSummary}</p>
          <SegmentedControl label="Motion" value={motion} options={[{ value: "stationary", label: "Parked" }, { value: "stopping", label: "Stop" }, { value: "pass", label: "Pass" }]} onChange={setMotion} />
          {candidate.id === "nightjet-new-generation" && <SegmentedControl label="Leading end" value={leadingEnd} options={[{ value: "taurus", label: "Taurus" }, { value: "cab-car", label: "Cab car" }]} onChange={setLeadingEnd} />}
          <SegmentedControl label="Weather" value={atmosphere} options={[{ value: "day", label: "Day" }, { value: "night", label: "Night" }, { value: "rain", label: "Rain" }]} onChange={setAtmosphere} />
          <div className="railjet-lab-inline-controls">
            <button type="button" className={scale === "inspect" ? "active" : ""} onClick={() => setScale((current) => current === "normal" ? "inspect" : "normal")}>Inspection scale</button>
            <button type="button" className={loadCount === 3 ? "active" : ""} onClick={() => setLoadCount((current) => current === 1 ? 3 : 1)}>{loadCount}× train load</button>
          </div>
        </aside>
      )}
      <div className="railjet-lab-metrics" aria-live="polite">
        <span><small>LIVE</small><strong>{fps} FPS</strong></span><span><small>GAUGE</small><strong>1.435 m</strong></span><span><small>STATUS</small><strong>{candidate.reviewStage === "cab" ? "Cab gate" : candidate.reviewStage === "continuity" ? "Continuity gate" : "Review"}</strong></span>
      </div>
      <footer className="railjet-lab-caption"><strong>{candidate.badge} · {candidate.shortLabel}</strong><span>{candidate.reviewStage === "cab" ? "Editable Blender cab checkpoint · formation deferred" : candidate.reviewStage === "continuity" ? "Editable Blender two-car continuity checkpoint · remaining formation deferred" : "Editable Blender master + modular GLBs"}</span><a href={candidate.primarySource} target="_blank" rel="noreferrer">Source ↗</a></footer>
    </main>
  );
}

Object.values(TRAIN_REVIEW_CANDIDATES).forEach((candidate) => useGLTF.preload(trainReviewAssetUrl(candidate)));
