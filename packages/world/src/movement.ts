import type {Cell,Facing} from './types';
import {facingFor} from './actor';
/** Consume the whole frame's distance, including across tile boundaries. */
export function advanceRoute(position:Cell,route:Cell[],distance:number,facing:Facing){
 let x=position.x,y=position.y,reached:Cell|undefined;
 while(route.length&&distance>0){
  const next=route[0],dx=next.x-x,dy=next.y-y,length=Math.hypot(dx,dy);
  facing=facingFor(dx,dy,facing);
  if(length>distance){x+=dx/length*distance;y+=dy/length*distance;break;}
  x=next.x;y=next.y;distance-=length;reached=route.shift();
 }
 return {x,y,facing,reached};
}
