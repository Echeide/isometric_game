import { pixelActor, type LoadedPixelArt } from './pixelart';
import type { Facing } from './types';
export function facingFor(dx:number,dy:number,previous:Facing='se'):Facing {
 if(dx===0&&dy===0)return previous;
 return Math.abs(dx)>=Math.abs(dy)?(dx>0?'se':'nw'):(dy>0?'sw':'ne');
}
/** Characters always use the supplied pixel animation pack. */
export function createActor(color:number,me:boolean,art:LoadedPixelArt){
 return pixelActor(art,color,me);
}
