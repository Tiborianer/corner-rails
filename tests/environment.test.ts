import { describe, expect, it } from "vitest";
import { birdEncounter, deerEncounter, roadsideTown, scatteredTrees, TREE_KINDS } from "../app/game/environment";
import { createInitialState } from "../app/game/data";
import { tickGame, purchaseUpgrade, undoLastUpgrade } from "../app/game/simulation";
import { decodeSave, encodeSave } from "../app/game/save";

describe("cosmetic countryside",()=>{
  it("scatters five tree silhouettes without blocking infrastructure or the wildlife corridor",()=>{
    const trees=scatteredTrees(1,-4);
    expect(trees).toHaveLength(88);
    expect(scatteredTrees(1,-4)).toEqual(trees);
    expect(new Set(trees.map(t=>t.kind)).size).toBe(TREE_KINDS.length);
    expect(new Set(trees.map(t=>t.z)).size).toBe(88);
    expect(trees.every(t=>t.z>=3.5 || t.z<=-7.8)).toBe(true);
  });
  it("builds houses gradually, then apartments on the far side only",()=>{
    expect(roadsideTown(0,5,-4)).toHaveLength(0);
    expect(roadsideTown(24,5,-4)).toHaveLength(1);
    expect(roadsideTown(400,5,-4)).toHaveLength(4);
    expect(roadsideTown(1000,3,-4)).toHaveLength(4);
    const plots=roadsideTown(1000,5,-4);
    expect(plots).toHaveLength(8);
    expect(plots.filter(p=>p.apartment)).toHaveLength(4);
    expect(plots.every(p=>p.z+1.4<-4-.28)).toBe(true);
  });
  it("keeps encounters occasional, continuous and away from rails",()=>{
    let birdFrames=0, deerFrames=0;
    for(let t=0;t<1600;t+=.1){
      if(birdEncounter(t).active) birdFrames++;
      const d=deerEncounter(t,1); if(d.active){deerFrames++; expect(d.z).toBeGreaterThan(2.2);}
      const next=deerEncounter(t+.01,1);
      if(d.active && next.active) expect(Math.abs(next.x-d.x)).toBeLessThan(.03);
    }
    expect(birdFrames).toBeGreaterThan(1000); expect(birdFrames).toBeLessThan(5000);
    expect(deerFrames).toBeGreaterThan(3000); expect(deerFrames).toBeLessThan(6500);
  });
  it("starts growth at purchase, scales with game speed, survives saves and resets on undo",()=>{
    const start={...createInitialState(),tier:3 as const,region:"germany" as const,platformPlaced:true,coins:10000,simSeconds:900};
    expect(tickGame(start,.1).roadAgeSeconds).toBe(0);
    const road=purchaseUpgrade(start,{kind:"system",system:"roadAccess"});
    expect(road.systems.roadAccess).toBe(true); expect(road.roadAgeSeconds).toBe(0);
    expect(tickGame({...road,speed:3},.2).roadAgeSeconds).toBeCloseTo(.6);
    expect(decodeSave(encodeSave({...road,roadAgeSeconds:511})).roadAgeSeconds).toBe(511);
    expect(undoLastUpgrade({...road,roadAgeSeconds:100}).roadAgeSeconds).toBe(0);
    const old={...road} as Partial<typeof road>; delete old.roadAgeSeconds;
    expect(decodeSave(encodeSave(old as typeof road)).roadAgeSeconds).toBe(0);
  });
});
