import {Graphics} from 'pixi.js';
import {project} from './navigation';
import {wallHeight} from './elevation';
import {wallBodyHeight} from './walls';
import type {Wall,WorldScene} from './types';
import {railingNeighbor} from './railing-families';
const style=(w:Wall)=>w.railingFamily??w.railingStyle??'stone';
const neighbor=railingNeighbor;
/** Keep contiguous railings of the same style and support level in one fading group. */
export function railingGroup(scene:WorldScene,w:Wall,walls:Wall[]){let first=w,previous:Wall|undefined;while((previous=neighbor(scene,first,walls,-1)))first=previous;return `railing:${style(w)}:${w.axis}:${first.x},${first.y}:${wallHeight(scene,w)}`;}
/** Code-native isometric geometry: the holes are transparent, with no opaque backing plane. */
export function railingPolygons(scene:WorldScene,w:Wall,walls:Wall[]){
 const faces:{points:number[][];color:number}[]=[],metal=style(w)==='metal',base=wallHeight(scene,w),height=wallBodyHeight(w);
 const colors=metal?{front:w.axis==='x'?0x728687:0x596f72,top:0xa7b6b3,side:0x405a60}:{front:w.axis==='x'?0xd5dbcc:0xb7c3b4,top:0xf0f0df,side:0x8d9d8d};
 function point(t:number,offset:number,z:number){const p=project({x:w.x+(w.axis==='x'?t:offset),y:w.y+(w.axis==='x'?offset:t)});return [p.x,p.y-base-z];}
 function face(points:number[][],color:number){faces.push({points,color});}
 function slab(start:number,end:number,low:number,high:number,thickness:number,capStart=true,capEnd=true){const back=-thickness/2,front=thickness/2;
  face([point(start,back,high),point(end,back,high),point(end,front,high),point(start,front,high)],colors.top);
  if(capStart)face([point(start,back,low),point(start,front,low),point(start,front,high),point(start,back,high)],colors.side);
  if(capEnd)face([point(end,back,low),point(end,front,low),point(end,front,high),point(end,back,high)],colors.side);
  face([point(start,front,low),point(end,front,low),point(end,front,high),point(start,front,high)],colors.front);
 }
 const previous=!!neighbor(scene,w,walls,-1),next=!!neighbor(scene,w,walls,1);
 if(metal){
  slab(0,1,0,2,.10,!previous,!next);slab(0,1,12,14,.065,!previous,!next);slab(0,1,height-4,height-1,.15,!previous,!next);
  for(let i=1;i<6;i++)slab(i/6-.014,i/6+.014,2,height-4,.045);
  if(!previous)slab(-.045,.045,0,height,.12);slab(.955,1.045,0,height,.12);
 }else{
  slab(0,1,0,3,.22,!previous,!next);slab(0,1,height-5,height,.24,!previous,!next);
  if(!previous)slab(-.055,.055,3,height-5,.19);slab(.945,1.055,3,height-5,.19);
  const profile=[[3,.075],[5,.075],[7,.04],[11,.06],[15,.07],[19,.045],[23,.035],[24,.06],[26,.06]];
  for(const t of [.30,.70]){
   for(let i=1;i<profile.length;i++){const [low,r0]=profile[i-1],[high,r1]=profile[i];
    face([point(t-r0,-r0,low),point(t-r0,r0,low),point(t-r1,r1,high),point(t-r1,-r1,high)],colors.side);
    face([point(t-r0,r0,low),point(t+r0,r0,low),point(t+r1,r1,high),point(t-r1,r1,high)],colors.front);
    if(r1>r0||i===profile.length-1)face([point(t-r1,-r1,high),point(t+r1,-r1,high),point(t+r1,r1,high),point(t-r1,r1,high)],colors.top);
   }
  }
 }
 return faces;
}

export function railingArt(scene:WorldScene,w:Wall,walls:Wall[]){const g=new Graphics();for(const f of railingPolygons(scene,w,walls))g.poly(f.points.flat()).fill({color:f.color});return g;}
