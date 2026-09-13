import type {Cell,Wall,WorldScene} from './types';
import {wallHeight} from './elevation';
import {project} from './navigation';
export function prepareWallOcclusion(scene:WorldScene,wall:Wall){
 const a=project(wall),b=project({x:wall.x+(wall.axis==='x'?1:0),y:wall.y+(wall.axis==='y'?1:0)});
 return {axis:wall.axis,edge:wall.axis==='x'?wall.y:wall.x,x:a.x,y:a.y-wallHeight(scene,wall),dx:b.x-a.x,dy:b.y-a.y};
}
/** Check the body's overlap, not just its feet: raised walls can hide a lower-level actor. */
export function wallOccludesActor(w:ReturnType<typeof prepareWallOcclusion>,cell:Cell,feet:Cell){
 if((w.axis==='x'?cell.y:cell.x)>=w.edge)return false;
 const t=(feet.x-w.x)/w.dx,margin=10/Math.abs(w.dx);
 if(t< -margin||t>1+margin)return false;
 const base=w.y+w.dy*Math.max(0,Math.min(1,t));
 return feet.y>base-62&&feet.y-60<base;
}
