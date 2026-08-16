"use client";

/* eslint-disable react-hooks/immutability, react/no-unknown-property */

import { Clone, useGLTF, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Points, Texture } from "three";
import { RepeatWrapping, SRGBColorSpace } from "three";
import {
  RAILJET_METHODS,
  RAILJET_PROTOTYPES,
  generatedVehicleAsset,
  railjetFormationPitch,
  railjetLabMotionPosition,
  type RailjetAtmosphere,
  type RailjetGeneration,
  type RailjetMotionMode,
  type RailjetPrototypeDefinition,
  type RailjetRenderMethod,
} from "./railjetLabData";

type LabMethod = RailjetRenderMethod;
type InspectionScale = "normal" | "inspect";
type LoadCount = 1 | 3;
type ScoreKey = "recognizability" | "proportions" | "integration" | "performance" | "style";
type Scores = Record<ScoreKey, number>;

export type RailjetLabInitialState = {
  generation: RailjetGeneration;
  method: LabMethod;
  motion: RailjetMotionMode;
  atmosphere: RailjetAtmosphere;
  scale: InspectionScale;
  loadCount: LoadCount;
  captureMode: boolean;
  capturePhaseSeconds: number;
  freezeMotion: boolean;
};

const SCORE_WEIGHTS: Record<ScoreKey, number> = {
  recognizability: 50,
  proportions: 20,
  integration: 15,
  performance: 10,
  style: 5,
};

const SCORE_LABELS: Record<ScoreKey, string> = {
  recognizability: "Recognizability",
  proportions: "Proportions",
  integration: "Station integration",
  performance: "Performance",
  style: "Game-art fit",
};

const DEFAULT_SCORES: Scores = {
  recognizability: 3,
  proportions: 3,
  integration: 3,
  performance: 3,
  style: 3,
};

function LabCamera({ scale }: { scale: InspectionScale }) {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(15, 13, 15);
    camera.lookAt(0, 0.55, 0.6);
    if ("zoom" in camera) {
      const base = size.width < 620 ? 32 : size.width < 980 ? 39 : 47;
      camera.zoom = base * (scale === "inspect" ? 1.22 : 1);
      camera.updateProjectionMatrix();
    }
  }, [camera, scale, size.width]);
  return null;
}

function LabTrack({ z = 0 }: { z?: number }) {
  const sleeperPositions = useMemo(() => Array.from({ length: 98 }, (_, index) => -29 + index * 0.6), []);
  return (
    <group>
      <mesh position={[0, 0.02, z]} receiveShadow>
        <boxGeometry args={[60, 0.24, 1.14]} />
        <meshStandardMaterial color="#59615e" roughness={0.96} />
      </mesh>
      {sleeperPositions.map((x) => (
        <mesh key={x} position={[x, 0.16, z]} receiveShadow>
          <boxGeometry args={[0.12, 0.09, 1.28]} />
          <meshStandardMaterial color="#6f513b" roughness={0.9} />
        </mesh>
      ))}
      {[-0.31, 0.31].map((offset) => (
        <mesh key={offset} position={[0, 0.25, z + offset]} castShadow receiveShadow>
          <boxGeometry args={[60, 0.09, 0.09]} />
          <meshStandardMaterial color="#c4cac9" metalness={0.76} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function LabPlatform() {
  return (
    <group position={[0, 0, 1.24]}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[18, 0.58, 0.78]} />
        <meshStandardMaterial color="#aaa493" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[17.8, 0.11, 0.74]} />
        <meshStandardMaterial color="#ded7c4" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.63, -0.31]}>
        <boxGeometry args={[17.6, 0.035, 0.08]} />
        <meshStandardMaterial color="#f7e5a5" roughness={0.75} />
      </mesh>
      {[-6.6, -2.2, 2.2, 6.6].map((x) => (
        <group key={x} position={[x, 0, 0.08]}>
          <mesh position={[0, 1.24, 0]} castShadow>
            <boxGeometry args={[0.09, 1.42, 0.09]} />
            <meshStandardMaterial color="#40504f" />
          </mesh>
          <mesh position={[0, 1.98, 0]} castShadow>
            <boxGeometry args={[1.45, 0.09, 0.46]} />
            <meshStandardMaterial color="#315a5b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LabCatenary({ laneCount }: { laneCount: LoadCount }) {
  const laneZs = laneCount === 3 ? [-1.35, 0, 1.35] : [0];
  return (
    <group>
      {laneZs.map((z) => (
        <group key={z}>
          {[-23, -15, -7, 1, 9, 17, 25].map((x) => (
            <group key={x}>
              <mesh position={[x, 2.15, z + 0.55]} castShadow>
                <boxGeometry args={[0.1, 3.55, 0.1]} />
                <meshStandardMaterial color="#5d6867" metalness={0.35} roughness={0.54} />
              </mesh>
              <mesh position={[x, 3.78, z]} castShadow>
                <boxGeometry args={[0.1, 0.09, 1.18]} />
                <meshStandardMaterial color="#5d6867" metalness={0.35} roughness={0.54} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 3.65, z]}>
            <boxGeometry args={[58, 0.025, 0.025]} />
            <meshStandardMaterial color="#242d2c" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ContactShadow({ length, z }: { length: number; z: number }) {
  return (
    <mesh position={[0, 0.295, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[length, 0.58, 1]}>
      <circleGeometry args={[0.5, 48]} />
      <meshBasicMaterial color="#111716" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

function configureTextures(textures: Texture[]) {
  for (const texture of textures) {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.needsUpdate = true;
  }
  return textures;
}

function SpriteFormation({ definition, method }: { definition: RailjetPrototypeDefinition; method: "generated-2d" | "vector-2d" }) {
  const urls = useMemo(
    () => definition.consist.map((vehicle) => method === "generated-2d" ? generatedVehicleAsset(definition, vehicle.generatedFrame) : vehicle.vectorAsset),
    [definition, method],
  );
  const loadedTextures = useTexture(urls);
  const textures = useMemo(() => configureTextures(loadedTextures), [loadedTextures]);
  const layout = useMemo(() => {
    const pitches = definition.consist.map((vehicle) => railjetFormationPitch(definition, vehicle));
    const total = pitches.reduce((sum, pitch) => sum + pitch, 0);
    let cursor = total / 2;
    return definition.consist.map((vehicle, index) => {
      const pitch = pitches[index];
      const x = cursor - pitch / 2;
      cursor -= pitch;
      return { vehicle, pitch, x };
    });
  }, [definition]);
  const totalLength = definition.id === "classic" ? 14.2 : 15.7;
  return (
    <group>
      <ContactShadow length={totalLength} z={0} />
      {layout.map(({ vehicle, pitch, x }, index) => {
        const vector = method === "vector-2d";
        // The SVG modules have deliberately generous editable margins. Their
        // cards overlap slightly so the visible gangways meet at world scale.
        const scaleX = pitch * (vector ? 1.82 : 1.08);
        const scaleY = pitch * (vector ? 0.76 : 1.08);
        return (
          <sprite key={vehicle.id} position={[x, 0.31 + scaleY / 2, 0]} scale={[scaleX, scaleY, 1]} renderOrder={20 + index}>
            <spriteMaterial map={textures[index]} transparent alphaTest={0.04} depthTest depthWrite toneMapped={!vector} />
          </sprite>
        );
      })}
    </group>
  );
}

function GlbFormation({ definition, method }: { definition: RailjetPrototypeDefinition; method: "hybrid-3d" | "blender-3d" }) {
  const asset = method === "blender-3d" ? definition.blenderAsset : definition.hybridAsset;
  const gltf = useGLTF(asset);
  const formation = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const groundOffset = method === "blender-3d" ? definition.blenderGroundOffset : definition.groundOffset;
  return (
    <group position={[definition.pivot[0], groundOffset, definition.pivot[2]]} scale={definition.worldScale}>
      <Clone object={formation} castShadow receiveShadow />
    </group>
  );
}

function TrainFormation({ definition, method }: { definition: RailjetPrototypeDefinition; method: LabMethod }) {
  if (method === "hybrid-3d" || method === "blender-3d") return <GlbFormation definition={definition} method={method} />;
  return <SpriteFormation definition={definition} method={method} />;
}

function TrainMotion({
  definition,
  method,
  motion,
  lane,
  inspect,
  capturePhaseSeconds,
  freezeMotion,
}: {
  definition: RailjetPrototypeDefinition;
  method: LabMethod;
  motion: RailjetMotionMode;
  lane: number;
  inspect: boolean;
  capturePhaseSeconds: number;
  freezeMotion: boolean;
}) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const elapsed = freezeMotion ? capturePhaseSeconds : clock.elapsedTime + capturePhaseSeconds;
    group.current.position.x = railjetLabMotionPosition(motion, elapsed + lane * 2.1);
  });
  return (
    <group ref={group} position={[0, 0, lane * 1.35]} scale={inspect ? 1.18 : 1}>
      <TrainFormation definition={definition} method={method} />
    </group>
  );
}

function LabRain() {
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
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#c1e5ed" transparent opacity={0.78} />
    </points>
  );
}

function FpsProbe({ onSample }: { onSample: (fps: number) => void }) {
  const sample = useRef({ elapsed: 0, frames: 0 });
  useFrame((_, delta) => {
    sample.current.elapsed += delta;
    sample.current.frames += 1;
    if (sample.current.elapsed >= 0.75) {
      onSample(Math.round(sample.current.frames / sample.current.elapsed));
      sample.current.elapsed = 0;
      sample.current.frames = 0;
    }
  });
  return null;
}

function LabScene({
  definition,
  method,
  motion,
  atmosphere,
  scale,
  loadCount,
  capturePhaseSeconds,
  freezeMotion,
  onFps,
}: {
  definition: RailjetPrototypeDefinition;
  method: LabMethod;
  motion: RailjetMotionMode;
  atmosphere: RailjetAtmosphere;
  scale: InspectionScale;
  loadCount: LoadCount;
  capturePhaseSeconds: number;
  freezeMotion: boolean;
  onFps: (fps: number) => void;
}) {
  const night = atmosphere === "night";
  const raining = atmosphere === "rain";
  const laneIndexes = loadCount === 3 ? [-1, 0, 1] : [0];
  const sky = night ? "#101b2d" : raining ? "#637c82" : "#a8d2df";
  return (
    <>
      <LabCamera scale={scale} />
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 35, 72]} />
      <ambientLight intensity={night ? 0.5 : 1.35} color={night ? "#839bc9" : "#fff0d2"} />
      <directionalLight position={[-7, 13, -5]} intensity={night ? 0.75 : 2.25} color={night ? "#9db2dd" : "#fff0bd"} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <hemisphereLight args={[night ? "#2f4167" : "#dcf1fb", raining ? "#536456" : "#718d55", night ? 0.55 : 1.05]} />

      <mesh position={[0, -0.16, 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 50]} />
        <meshStandardMaterial color={night ? "#354238" : "#718c55"} roughness={raining ? 0.32 : 0.95} metalness={raining ? 0.12 : 0} />
      </mesh>
      {laneIndexes.map((lane) => <LabTrack key={lane} z={lane * 1.35} />)}
      <LabPlatform />
      <LabCatenary laneCount={loadCount} />
      {laneIndexes.map((lane) => (
        <Suspense key={`${method}-${definition.id}-${lane}`} fallback={null}>
          <TrainMotion definition={definition} method={method} motion={motion} lane={lane} inspect={scale === "inspect"} capturePhaseSeconds={capturePhaseSeconds} freezeMotion={freezeMotion} />
        </Suspense>
      ))}
      {night && [-7, -2.4, 2.4, 7].map((x) => <pointLight key={x} position={[x, 2.7, 1.25]} intensity={1.6} distance={5} color="#ffd77f" />)}
      {raining && <LabRain />}
      <FpsProbe onSample={onFps} />
    </>
  );
}

function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <fieldset className="railjet-lab-segment">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button key={option.value} type="button" className={value === option.value ? "active" : ""} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function RailjetLab({ initialState }: { initialState: RailjetLabInitialState }) {
  const [generation, setGeneration] = useState<RailjetGeneration>(initialState.generation);
  const [method, setMethod] = useState<LabMethod>(initialState.method);
  const [motion, setMotion] = useState<RailjetMotionMode>(initialState.motion);
  const [atmosphere, setAtmosphere] = useState<RailjetAtmosphere>(initialState.atmosphere);
  const [scale, setScale] = useState<InspectionScale>(initialState.scale);
  const [loadCount, setLoadCount] = useState<LoadCount>(initialState.loadCount);
  const [fps, setFps] = useState(60);
  const [showScoring, setShowScoring] = useState(false);
  const [scores, setScores] = useState<Record<string, Scores>>({});
  const captureMode = initialState.captureMode;
  const definition = RAILJET_PROTOTYPES[generation];
  const methodDefinition = RAILJET_METHODS.find((candidate) => candidate.id === method) ?? RAILJET_METHODS[0];
  const scoreId = `${generation}:${method}`;
  const currentScores = scores[scoreId] ?? DEFAULT_SCORES;
  const weightedScore = Object.entries(SCORE_WEIGHTS).reduce((total, [key, weight]) => total + currentScores[key as ScoreKey] * weight, 0) / 100;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("railjetLab", "1");
    params.set("generation", generation);
    params.set("method", method);
    params.set("motion", motion);
    params.set("atmosphere", atmosphere);
    params.set("scale", scale);
    params.set("load", String(loadCount));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [atmosphere, generation, loadCount, method, motion, scale]);

  const updateScore = (key: ScoreKey, value: number) => {
    setScores((current) => ({ ...current, [scoreId]: { ...(current[scoreId] ?? DEFAULT_SCORES), [key]: value } }));
  };

  return (
    <main className={`railjet-lab-shell ${captureMode ? "capture-mode" : ""}`}>
      <div className="railjet-lab-world" aria-label="Interactive Railjet rendering comparison">
        <Canvas orthographic shadows="basic" dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <Suspense fallback={null}>
            <LabScene definition={definition} method={method} motion={motion} atmosphere={atmosphere} scale={scale} loadCount={loadCount} capturePhaseSeconds={initialState.capturePhaseSeconds} freezeMotion={initialState.freezeMotion} onFps={setFps} />
          </Suspense>
        </Canvas>
      </div>

      <header className="railjet-lab-title">
        <span className="railjet-lab-blind">{methodDefinition.blindLabel}</span>
        <div>
          <small>Corner Rails · Visual bake-off</small>
          <h1>{definition.label}</h1>
          <p>{definition.vehicleCount} vehicles · {definition.lengthMeters} m · {definition.serviceYear}</p>
        </div>
      </header>

      {!captureMode && (
        <aside className="railjet-lab-controls" aria-label="Railjet lab controls">
          <div className="railjet-lab-control-head">
            <div><small>Candidate {methodDefinition.blindLabel}</small><strong>{methodDefinition.label}</strong></div>
            <button type="button" onClick={() => window.location.assign("/")} aria-label="Exit Railjet lab">Exit</button>
          </div>
          <p>{methodDefinition.description}</p>
          <SegmentedControl label="Formation" value={generation} options={[{ value: "classic", label: "Classic" }, { value: "nextgen", label: "New gen" }]} onChange={setGeneration} />
          <SegmentedControl label="Method" value={method} options={RAILJET_METHODS.map((item) => ({ value: item.id, label: item.blindLabel }))} onChange={setMethod} />
          <SegmentedControl label="Motion" value={motion} options={[{ value: "stationary", label: "Parked" }, { value: "stopping", label: "Stop" }, { value: "pass", label: "Pass" }]} onChange={setMotion} />
          <SegmentedControl label="Weather" value={atmosphere} options={[{ value: "day", label: "Day" }, { value: "night", label: "Night" }, { value: "rain", label: "Rain" }]} onChange={setAtmosphere} />
          <div className="railjet-lab-inline-controls">
            <button type="button" className={scale === "inspect" ? "active" : ""} onClick={() => setScale((current) => current === "normal" ? "inspect" : "normal")}>Inspection scale</button>
            <button type="button" className={loadCount === 3 ? "active" : ""} onClick={() => setLoadCount((current) => current === 1 ? 3 : 1)}>{loadCount}× train load</button>
          </div>
        </aside>
      )}

      <div className="railjet-lab-metrics" aria-live="polite">
        <span><small>LIVE</small><strong>{fps} FPS</strong></span>
        <span><small>VIEW</small><strong>Locked 47°</strong></span>
        <span><small>METHOD</small><strong>{methodDefinition.blindLabel}</strong></span>
      </div>

      {!captureMode && (
        <aside className={`railjet-lab-score ${showScoring ? "open" : ""}`}>
          <button type="button" className="railjet-score-toggle" onClick={() => setShowScoring((current) => !current)} aria-expanded={showScoring}>
            Score candidate <b>{weightedScore.toFixed(1)}/5</b>
          </button>
          {showScoring && (
            <div className="railjet-score-body">
              {(Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((key) => (
                <label key={key}>
                  <span>{SCORE_LABELS[key]} <small>{SCORE_WEIGHTS[key]}%</small></span>
                  <input type="range" min="1" max="5" step="1" value={currentScores[key]} onChange={(event) => updateScore(key, Number(event.target.value))} />
                  <b>{currentScores[key]}</b>
                </label>
              ))}
              <p>Scores stay only in this open lab session. The production Railjet remains unchanged.</p>
            </div>
          )}
        </aside>
      )}

      <footer className="railjet-lab-caption">
        <strong>{methodDefinition.blindLabel} · {definition.shortLabel}</strong>
        <span>{methodDefinition.label}</span>
        <a href={definition.source} target="_blank" rel="noreferrer">Reference ↗</a>
      </footer>
    </main>
  );
}

useGLTF.preload(RAILJET_PROTOTYPES.classic.hybridAsset);
useGLTF.preload(RAILJET_PROTOTYPES.nextgen.hybridAsset);
useGLTF.preload(RAILJET_PROTOTYPES.classic.blenderAsset);
useGLTF.preload(RAILJET_PROTOTYPES.nextgen.blenderAsset);
