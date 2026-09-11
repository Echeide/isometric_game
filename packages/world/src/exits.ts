import type {Facing,WorldEntity,WorldScene} from './types';
export function exitFacing(scene:WorldScene,e:WorldEntity):Facing{
 const door=scene.walls?.find(w=>w.exitId===e.id);
 if(door)return door.axis==='x'?(e.position.y>=door.y?'ne':'sw'):(e.position.x>=door.x?'nw':'se');
 const edges=[{d:e.position.x,f:'nw'},{d:scene.width-e.position.x-(e.size?.x??1),f:'se'},{d:e.position.y,f:'ne'},{d:scene.height-e.position.y-(e.size?.y??1),f:'sw'}] as const;
 return [...edges].sort((a,b)=>a.d-b.d)[0].f;
}
export function entranceFacing(scene:WorldScene,e:WorldEntity):Facing{
 return {ne:'sw',sw:'ne',se:'nw',nw:'se'}[exitFacing(scene,e)] as Facing;
}
