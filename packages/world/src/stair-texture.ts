import {project} from './navigation';
import {stairDirections,STAIR_STEPS,LEVEL_HEIGHT} from './elevation';
import type {Cell,Facing} from './types';

/** Clip one part of the original tile onto each horizontal stair tread. */
export function stairTread(cell:Cell,facing:Facing,level:number,step:number){
 const d=stairDirections[facing],along=d.x+d.y>0?step:STAIR_STEPS-1-step;
 const x=cell.x+(d.x?step/STAIR_STEPS:0),y=cell.y+(d.y?step/STAIR_STEPS:0),width=d.x?1/STAIR_STEPS:1,depth=d.y?1/STAIR_STEPS:1;
 const height=(level+(along+1)/STAIR_STEPS)*LEVEL_HEIGHT,p=project({x,y}),base=project(cell),a=width*32,b=depth*32;
 return {x,y,width,depth,height,textureX:base.x-32,textureY:base.y-height,top:[p.x,p.y-height,p.x+a,p.y+a/2-height,p.x+a-b,p.y+(a+b)/2-height,p.x-b,p.y+b/2-height]};
}
