"use client";
/* eslint-disable react/no-unknown-property, react-hooks/immutability */
import { useEffect, useMemo, useRef, type ReactNode, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D, type Group, type InstancedMesh } from "three";
import { RAILWAY_GROUND_Y } from "./metricRailway";
import { daylightFactor } from "./simulation";
import { birdEncounter, deerEncounter, roadsideTown, scatteredTrees, type SceneryTree } from "./environment";
import type { GameState } from "./types";

type Part = { position: [number, number, number]; scale: [number, number, number]; color: string; yaw?: number };

function Instances({ parts, shape }: { parts: Part[]; shape: "trunk" | "crown" | "cone" }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const obj = new Object3D();
    parts.forEach((p, i) => {
      obj.position.set(...p.position); obj.scale.set(...p.scale); obj.rotation.set(0, p.yaw ?? 0, 0); obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix); ref.current!.setColorAt(i, new Color(p.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} castShadow receiveShadow>
    {shape === "trunk" ? <cylinderGeometry args={[.7, 1, 1, 7]} /> : shape === "cone" ? <coneGeometry args={[1, 1, 9]} /> : <icosahedronGeometry args={[1, 1]} />}
    <meshStandardMaterial roughness={.93} />
  </instancedMesh>;
}

export function Woodland({ frontPlatformZ, roadZ, season }: { frontPlatformZ: number; roadZ: number; season: number }) {
  const trees = useMemo(() => scatteredTrees(frontPlatformZ, roadZ), [frontPlatformZ, roadZ]);
  const batches = useMemo(() => {
    const trunks: Part[] = [], crowns: Part[] = [], cones: Part[] = [];
    const palettes = [["#416e3d", "#719551", "#527d45"], ["#315c39", "#557e40", "#779447"], ["#a36231", "#c08b3d", "#7b793e"], ["#80918c", "#a6b5ad", "#637d71"]];
    const palette = palettes[season % 4];
    const add = (parts: Part[], t: SceneryTree, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string) => {
      const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
      parts.push({position:[t.x + (x*c-z*s)*t.scale, RAILWAY_GROUND_Y+y*t.scale, t.z+(x*s+z*c)*t.scale], scale:[sx*t.scale,sy*t.scale,sz*t.scale], color, yaw:t.rotation});
    };
    trees.forEach((t, i) => {
      const pine = t.kind === "pine" || t.kind === "spruce";
      const color = pine ? (season === 3 ? "#557364" : "#345b45") : palette[i % 3];
      add(trunks,t,0,.3,0,.025,.6,.025,t.kind === "birch" ? "#d8d6bf" : "#6b4d35");
      if (t.kind === "spruce") {
        [0,1,2].forEach(j => add(cones,t,0,.43+j*.19,0,.26-j*.055,.42,.26-j*.055,color));
      } else if (t.kind === "poplar") {
        add(crowns,t,0,.7,0,.15,.47,.17,color);
        add(crowns,t,.04,.98,0,.10,.24,.12,palette[1]);
      } else if (t.kind === "pine") {
        add(crowns,t,0,.77,0,.35,.18,.28,color);
        add(crowns,t,.16,.7,.1,.22,.16,.22,"#527958");
      } else {
        const birch = t.kind === "birch";
        add(crowns,t,0,.68,0,birch?.2:.31,birch?.32:.27,.25,color);
        add(crowns,t,-.17,.58,.05,.22,.22,.2,palette[(i+1)%3]);
        add(crowns,t,.14,.83,-.06,.19,.2,.2,color);
      }
    });
    return {trunks,crowns,cones};
  }, [trees, season]);
  return <group name="scattered-seasonal-woodland"><Instances parts={batches.trunks} shape="trunk" /><Instances parts={batches.crowns} shape="crown" /><Instances parts={batches.cones} shape="cone" /></group>;
}

function Block({ p, s, color }: { p: [number,number,number]; s: [number,number,number]; color: string }) {
  return <mesh position={p} scale={s} castShadow receiveShadow><boxGeometry /><meshStandardMaterial color={color} roughness={.85} /></mesh>;
}

function Home({ apartment, floors, index, night }: { apartment: boolean; floors: number; index: number; night: number }) {
  const width = apartment ? 1.65 : 1.1;
  const height = floors * .34;
  const color = ["#e2cba6", "#c3d0c8", "#d0a184", "#e0d9c6"][index%4];
  return <group>
    <Block p={[0,.025,0]} s={[width+.14,.05,1.02]} color="#aca89a" />
    <Block p={[0,height/2+.05,0]} s={[width,height,.85]} color={color} />
    {apartment ? <>
      <Block p={[0,height+.08,0]} s={[width+.12,.1,1]} color="#566367" />
      <Block p={[.35,height+.17,-.16]} s={[.36,.12,.25]} color="#889396" />
    </> : <>
      <mesh position={[0,height+.25,0]} rotation={[0,Math.PI/4,0]} scale={[width*.79,.37,.63]} castShadow><coneGeometry args={[1,1,4]} /><meshStandardMaterial color={index%2 ? "#515e64" : "#8a493a"} roughness={.92} /></mesh>
      <Block p={[.3,height+.33,-.2]} s={[.12,.3,.13]} color="#8b6550" />
    </>}
    {[1,-1].map(side => Array.from({length:floors},(_,floor)=>Array.from({length:apartment?4:2},(_,col)=>{
      const x = apartment ? -.6+col*.4 : -.32+col*.64;
      return <group key={`${side}-${floor}-${col}`} position={[x,.22+floor*.34,side*.432]}>
        <Block p={[0,0,0]} s={[.23,.2,.02]} color="#e4e2d7" />
        <mesh position={[0,0,side*.015]}><boxGeometry args={[.17,.15,.012]} /><meshStandardMaterial color="#5e808a" emissive="#ffcf79" emissiveIntensity={((col+floor+index)%3 ? .65 : .14)*night} roughness={.35} /></mesh>
        {apartment && floor>0 && <Block p={[0,-.1,side*.065]} s={[.29,.035,.16]} color="#737f81" />}
      </group>;
    })))}
    <Block p={[0,.17,.444]} s={[.16,.28,.025]} color="#485e61" />
  </group>;
}

export function RoadsideNeighborhood({ state, roadZ, parkedCar }: { state: GameState; roadZ: number; parkedCar: (index: number) => ReactNode }) {
  const plots = roadsideTown(state.roadAgeSeconds ?? 0, state.tier, roadZ);
  const night = 1-daylightFactor(state.simSeconds);
  return <group name="far-side-neighborhood">
    {plots.map(plot => <group key={plot.id} position={[plot.x,RAILWAY_GROUND_Y,plot.z]} scale={[1,plot.reveal,1]}>
      <Block p={[0,.01,.6]} s={[2.2,.02,.45]} color="#809366" />
      <Block p={[.45,.025,.83]} s={[.6,.035,1.12]} color="#bbb6a6" />
      <Home apartment={plot.apartment} floors={plot.floors} index={plot.id} night={night} />
      <group position={[.45,.055,.98]} rotation={[0,Math.PI/2,0]}>{parkedCar(plot.id)}</group>
      {plot.apartment && <group position={[-.43,.055,.98]} rotation={[0,Math.PI/2,0]}>{parkedCar(plot.id+2)}</group>}
      <Block p={[-1.05,.14,.1]} s={[.07,.28,1.5]} color="#547348" />
    </group>)}
  </group>;
}

function Bird({ index, refs }: { index: number; refs: MutableRefObject<(Group | null)[]> }) {
  return <group ref={node=>{refs.current[index]=node;}}>
    <mesh scale={[.16,.045,.06]}><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color="#434c49" /></mesh>
    <mesh position={[.14,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.025,.09,4]} /><meshStandardMaterial color="#b1a787" /></mesh>
    {[-1,1].map(side => <group key={side} name={`wing-${side}`}>
      <mesh position={[-.015,0,side*.16]} rotation={[0,side*.16,0]} scale={[.17,.018,.2]}><sphereGeometry args={[1,6,4]} /><meshStandardMaterial color="#58625b" /></mesh>
    </group>)}
  </group>;
}

function Deer({ index, refs }: { index: number; refs: MutableRefObject<(Group | null)[]> }) {
  const coat = index ? "#b18a58" : "#927045";
  return <group ref={node=>{refs.current[index]=node;}} scale={index ? .78 : 1}>
    <mesh position={[0,.23,0]} scale={[.22,.1,.085]} castShadow><sphereGeometry args={[1,10,8]} /><meshStandardMaterial color={coat} /></mesh>
    <group name="head" position={[.16,.29,0]}>
      <mesh position={[.025,.055,0]} rotation={[0,0,-.4]} scale={[.055,.12,.055]} castShadow><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color={coat} /></mesh>
      <mesh position={[.08,.14,0]} scale={[.085,.05,.048]} castShadow><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color={coat} /></mesh>
      {[-1,1].map(s => <group key={s}>
        <mesh position={[.05,.19,s*.035]} rotation={[s*.5,0,0]} scale={[.021,.06,.016]}><sphereGeometry args={[1,6,4]} /><meshStandardMaterial color={coat} /></mesh>
        <mesh position={[.104,.15,s*.042]}><sphereGeometry args={[.009,6,4]} /><meshStandardMaterial color="#171b19" /></mesh>
      </group>)}
      <mesh position={[.16,.13,0]} scale={[.018,.023,.025]}><sphereGeometry args={[1,6,4]} /><meshStandardMaterial color="#262824" /></mesh>
    </group>
    {[-1,1].flatMap(x=>[-1,1].map(z=><group key={`${x}-${z}`} name={`leg-${x}-${z}`} position={[x*.14,.23,z*.05]}>
      <Block p={[0,-.1,0]} s={[.026,.22,.026]} color={coat} /><Block p={[.01,-.215,0]} s={[.048,.03,.03]} color="#4b4031" />
    </group>))}
    <mesh position={[-.215,.25,0]} rotation={[0,0,-.3]} scale={[.027,.05,.035]}><sphereGeometry args={[1,6,4]} /><meshStandardMaterial color="#ddd2af" /></mesh>
  </group>;
}

export function Wildlife({ state, frontPlatformZ, onBirdCall }: { state: GameState; frontPlatformZ: number; onBirdCall?: () => void }) {
  const birds = useRef<(Group|null)[]>([]), deer = useRef<(Group|null)[]>([]);
  const visualTime = useRef(state.simSeconds), previousTime = useRef(state.simSeconds);
  const lastCall = useRef(-1);
  const reduced = useMemo(()=>typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,[]);
  useFrame((_,delta)=>{
    if (state.simSeconds < previousTime.current) lastCall.current = -1;
    if (Math.abs(state.simSeconds-previousTime.current)>.6 || state.simSeconds<previousTime.current) visualTime.current=state.simSeconds;
    else if (state.simSeconds !== previousTime.current) visualTime.current=Math.max(visualTime.current,state.simSeconds);
    previousTime.current=state.simSeconds;
    if(state.region && state.platformPlaced) visualTime.current+=Math.min(delta,.1)*state.speed;
    const t=visualTime.current, encounter=birdEncounter(t);
    const calm=state.weather === "clear" && daylightFactor(t)>.25 && !!state.region && state.platformPlaced;
    birds.current.forEach((bird,i)=>{
      if(!bird) return;
      bird.visible=calm && encounter.active && i<encounter.count;
      bird.position.set(-32+encounter.progress*64-i*.42,2.3+Math.sin(t*.7+i)*.06,frontPlatformZ-1+Math.abs(i-2)*.3);
      for(const wing of bird.children.filter(c=>c.name.startsWith("wing"))) {
        const side=wing.name === "wing-1" ? 1 : -1;
        wing.rotation.x=reduced ? side*.13 : Math.sin(t*8+i)*.5*side;
      }
    });
    if(calm && encounter.active && encounter.progress>.42 && encounter.progress<.62 && lastCall.current!==encounter.cycle) {
      lastCall.current=encounter.cycle; onBirdCall?.();
    }
    const animal=deerEncounter(t,frontPlatformZ);
    deer.current.forEach((d,i)=>{
      if(!d) return;
      d.visible=calm && animal.active;
      d.position.set(animal.x-i*.58*animal.direction,RAILWAY_GROUND_Y,animal.z+i*.27);
      d.rotation.y=animal.direction===1 ? 0 : Math.PI;
      const head=d.getObjectByName("head"); if(head) head.rotation.z=animal.moving ? .05 : -.8;
      d.children.filter(c=>c.name.startsWith("leg")).forEach((leg,j)=>{leg.rotation.z=animal.moving && !reduced ? Math.sin(t*10+(j%2)*Math.PI+i)*.42 : 0;});
    });
  });
  return <group name="ambient-wildlife">{[0,1,2,3,4].map(i=><Bird key={`b${i}`} index={i} refs={birds} />)}{[0,1].map(i=><Deer key={`d${i}`} index={i} refs={deer} />)}</group>;
}
