import type {Cell,WorldScene,Facing,Wall} from './types';
export const LEVEL_HEIGHT=24;
export const STAIR_STEPS=3;
export const stairDirections:Record<Facing,Cell>={se:{x:1,y:0},nw:{x:-1,y:0},sw:{x:0,y:1},ne:{x:0,y:-1}};
export const levelAt=(scene:WorldScene,p:Cell)=>scene.elevations?.[`${Math.floor(p.x)},${Math.floor(p.y)}`]??0;
export const stairAt=(scene:WorldScene,p:Cell)=>scene.stairs?.[`${Math.floor(p.x)},${Math.floor(p.y)}`];
export function canChangeLevel(scene:WorldScene,a:Cell,b:Cell){
 if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
 const edgeHeight=(p:Cell,toward:Cell)=>{
  const level=levelAt(scene,p),stair=stairAt(scene,p);if(!stair)return level;
  const d=stairDirections[stair],dx=toward.x-p.x,dy=toward.y-p.y;
  if(dx*d.x+dy*d.y===0)return NaN;
  return level+(dx===d.x&&dy===d.y?1:0);
 };
 return edgeHeight(a,b)===edgeHeight(b,a);
}
/** Continuous support height, including the incline within a stair tile. */
export function surfaceHeight(scene:WorldScene,p:Cell){
 const stair=stairAt(scene,p);let height=levelAt(scene,p);
 if(stair){const d=stairDirections[stair],f=d.x?p.x-Math.floor(p.x):p.y-Math.floor(p.y);height+=(d.x+d.y)>0?f:1-f;}
 return height*LEVEL_HEIGHT;
}
export function projectSurface(scene:WorldScene,p:Cell){return {x:(p.x-p.y)*32,y:(p.x+p.y)*16-surfaceHeight(scene,p)};}
export function wallHeight(scene:WorldScene,w:Wall){const cells=w.axis==='x'?[{x:w.x,y:w.y-1},w]:[{x:w.x-1,y:w.y},w];return Math.max(...cells.map(p=>levelAt(scene,p)))*LEVEL_HEIGHT;}
/** Hit-test the visible horizontal tops (including individual stair treads). */
export function topContains(scene:WorldScene,cell:Cell,point:Cell){
 const stair=stairAt(scene,cell),d=stair?stairDirections[stair]:null;
 for(let step=0;step<(d?STAIR_STEPS:1);step++){
  const z=(levelAt(scene,cell)+(d?((d.x+d.y>0?step:STAIR_STEPS-1-step)+1)/STAIR_STEPS:0))*LEVEL_HEIGHT;
  const x=point.x/64+(point.y+z)/32-cell.x,y=(point.y+z)/32-point.x/64-cell.y;
  if(x>=0&&x<1&&y>=0&&y<1&&(!d||(d.x?x:y)>=step/STAIR_STEPS&&(d.x?x:y)<(step+1)/STAIR_STEPS))return true;
 }
 return false;
}
