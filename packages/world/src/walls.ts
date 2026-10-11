import {resolveEnvironment} from './environments';
import {canChangeLevel} from './elevation';
import type {Cell,Wall,WorldScene} from './types';
export const wallBodyHeight=(wall:Wall)=>wall.kind==='railing'?31:62;
export const wallKey=(w:Pick<Wall,'x'|'y'|'axis'>)=>`${w.axis}:${w.x},${w.y}`;
export function wallCells(w:Pick<Wall,'x'|'y'|'axis'>):Cell[]{return w.axis==='x'?[{x:w.x,y:w.y-1},{x:w.x,y:w.y}]:[{x:w.x-1,y:w.y},{x:w.x,y:w.y}];}
export function hasTile(scene:WorldScene,p:Cell){return p.x>=0&&p.y>=0&&p.x<scene.width&&p.y<scene.height&&scene.tiles?.[`${p.x},${p.y}`]!=='void';}
export function defaultWalls(scene:WorldScene):Wall[]{const material=resolveEnvironment(scene).wall;return [
 ...Array.from({length:scene.width},(_,x)=>({x,y:0,axis:'x' as const,kind:'wall' as const,material})),
 ...Array.from({length:scene.height},(_,y)=>({x:0,y,axis:'y' as const,kind:'wall' as const,material}))
 ].filter(w=>wallCells(w).some(p=>hasTile(scene,p)));}
export function sceneWalls(scene:WorldScene):Wall[]{return scene.walls??(!resolveEnvironment(scene).outdoor?defaultWalls(scene):[]);}
export function automaticWallKeys(scene:WorldScene):string[]{return scene.automaticWalls??(scene.walls===undefined&&!resolveEnvironment(scene).outdoor?defaultWalls(scene).map(wallKey):[]);}
export function canCross(scene:WorldScene,a:Cell,b:Cell){
 const key=wallKey(a.x===b.x?{axis:'x',x:a.x,y:Math.max(a.y,b.y)}:{axis:'y',x:Math.max(a.x,b.x),y:a.y});
 return canChangeLevel(scene,a,b)&&!sceneWalls(scene).some(w=>wallKey(w)===key&&w.kind!=='door');
}
/** Expose taller wall ends beside low railings, and opaque ends beside glass. */
export function wallEndExposed(w:Wall,end:0|1,walls:Wall[]):boolean{
 const step=end===1?1:-1;
 const neighbor=walls.find(n=>n.axis===w.axis&&n.x===w.x+(w.axis==='x'?step:0)&&n.y===w.y+(w.axis==='y'?step:0));
 return !neighbor||wallBodyHeight(neighbor)<wallBodyHeight(w)||(neighbor.kind==='wall'&&neighbor.material==='glass'&&!(w.kind==='wall'&&w.material==='glass'));
}
