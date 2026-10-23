import {expect,it} from 'vitest';
import {stairTread} from '../packages/world/src/stair-texture';
import {STAIR_STEPS,stairDirections,topContains,terrainCellAt} from '../packages/world/src/elevation';
import type {Facing,WorldScene} from '../packages/world/src/types';

it.each(Object.keys(stairDirections) as Facing[])('keeps the material and curb coordinates continuous across %s treads',facing=>{
 const d=stairDirections[facing];
 for(const level of [-2,0,1,2]){
  let totalArea=0;
  const scene:WorldScene={schemaVersion:1,id:'stairs',name:'Escaleras',theme:'outdoors',width:5,height:5,spawn:{x:0,y:0},entities:[],stairs:{'2,2':facing},elevations:Object.fromEntries(Array.from({length:25},(_,i)=>[`${i%5},${Math.floor(i/5)}`,level]))};
  for(let step=0;step<STAIR_STEPS;step++){
   const t=stairTread({x:2,y:2},facing,level,step),uv=[];
   for(let i=0;i<8;i+=2){const x=t.top[i]-t.textureX,y=t.top[i+1]-t.textureY;uv.push({u:(x-32)/64+y/32,v:y/32-(x-32)/64});}
   const across=uv.map(p=>d.x?p.u:p.v),along=uv.map(p=>d.x?p.v:p.u);
   expect(Math.min(...across)).toBeCloseTo(step/STAIR_STEPS);expect(Math.max(...across)).toBeCloseTo((step+1)/STAIR_STEPS);
   expect(Math.min(...along)).toBeCloseTo(0);expect(Math.max(...along)).toBeCloseTo(1);
   let area=0;for(let i=0;i<8;i+=2){const next=(i+2)%8;area+=t.top[i]*t.top[next+1]-t.top[next]*t.top[i+1];}totalArea+=Math.abs(area)/2;
   const center={x:(t.top[0]+t.top[4])/2,y:(t.top[1]+t.top[5])/2};
   expect(topContains(scene,{x:2,y:2},center)).toBe(true);expect(terrainCellAt(scene,center)).toEqual({x:2,y:2});
  }
  expect(totalArea).toBeCloseTo(64*32/2);
 }
});
