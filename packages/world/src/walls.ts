import type {Cell,Wall,WorldScene} from './types';
export const wallKey=(w:Pick<Wall,'x'|'y'|'axis'>)=>`${w.axis}:${w.x},${w.y}`;
export function wallCells(w:Pick<Wall,'x'|'y'|'axis'>):Cell[]{return w.axis==='x'?[{x:w.x,y:w.y-1},{x:w.x,y:w.y}]:[{x:w.x-1,y:w.y},{x:w.x,y:w.y}];}
export function hasTile(scene:WorldScene,p:Cell){return p.x>=0&&p.y>=0&&p.x<scene.width&&p.y<scene.height&&scene.tiles?.[`${p.x},${p.y}`]!=='void';}
export function sceneWalls(scene:WorldScene):Wall[]{
 return scene.walls??(scene.theme==='office'?[
 ...Array.from({length:scene.width},(_,x)=>({x,y:0,axis:'x' as const,kind:'wall' as const})),
 ...Array.from({length:scene.height},(_,y)=>({x:0,y,axis:'y' as const,kind:'wall' as const}))
 ].filter(w=>wallCells(w).some(p=>hasTile(scene,p))):[]);
}
export function canCross(scene:WorldScene,a:Cell,b:Cell){
 const key=wallKey(a.x===b.x?{axis:'x',x:a.x,y:Math.max(a.y,b.y)}:{axis:'y',x:Math.max(a.x,b.x),y:a.y});
 return !sceneWalls(scene).some(w=>wallKey(w)===key&&w.kind==='wall');
}
/** Opaque wall ends remain visible through an adjoining glass segment. */
export function wallEndExposed(w:Wall,end:0|1,walls:Wall[]):boolean{
 const step=end===1?1:-1;
 const neighbor=walls.find(n=>n.axis===w.axis&&n.x===w.x+(w.axis==='x'?step:0)&&n.y===w.y+(w.axis==='y'?step:0));
 return !neighbor||(neighbor.kind==='wall'&&neighbor.material==='glass'&&!(w.kind==='wall'&&w.material==='glass'));
}
