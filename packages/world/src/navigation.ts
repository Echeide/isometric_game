import {canChangeLevel,levelAt,stairAt} from './elevation';
import {hasTile,canCross,sceneWalls,wallKey} from './walls';
import type { Cell, WorldEntity, WorldScene } from './types';
export const cellKey = (p: Cell) => `${p.x},${p.y}`;
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
export function footprint(entity: WorldEntity): Cell[] {
  const cells: Cell[] = [];
  for (let x = 0; x < (entity.size?.x ?? 1); x++)
    for (let y = 0; y < (entity.size?.y ?? 1); y++)
      cells.push({ x: entity.position.x + x, y: entity.position.y + y });
  return cells;
}
export function walkable(scene: WorldScene, p: Cell): boolean {
  return hasTile(scene,p) && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < scene.width && p.y < scene.height &&
    !(scene.blocked ?? []).some(b => sameCell(b, p)) && !scene.entities.some(e => e.solid !== false && footprint(e).some(b => sameCell(b, p)));
}
export function neighbors(p: Cell): Cell[] {
  return [{x:p.x+1,y:p.y},{x:p.x,y:p.y+1},{x:p.x-1,y:p.y},{x:p.x,y:p.y-1}];
}
/** Build collision indexes once for a fixed scene; no cache shared with mutable editor drafts. */
export function createNavigator(scene:WorldScene){
 const blocked=new Set((scene.blocked??[]).map(cellKey));
 for(const entity of scene.entities)if(entity.solid!==false)for(const cell of footprint(entity))blocked.add(cellKey(cell));
 const walls=new Set(sceneWalls(scene).filter(w=>w.kind==='wall').map(wallKey));
 const free=(p:Cell)=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&hasTile(scene,p)&&!blocked.has(cellKey(p));
 const cross=(a:Cell,b:Cell)=>canChangeLevel(scene,a,b)&&!walls.has(wallKey(a.x===b.x?{axis:'x',x:a.x,y:Math.max(a.y,b.y)}:{axis:'y',x:Math.max(a.x,b.x),y:a.y}));
 function search(start:Cell,goals?:Set<string>){
  const parents=new Map<string,Cell|null>();if(!free(start))return {parents,found:null as Cell|null};
  const queue=[start];parents.set(cellKey(start),null);
  for(let i=0;i<queue.length;i++){
   const current=queue[i];if(goals?.has(cellKey(current)))return {parents,found:current};
   for(const next of neighbors(current)){const key=cellKey(next);if(!parents.has(key)&&free(next)&&cross(current,next)){parents.set(key,current);queue.push(next);}}
  }
  return {parents,found:null as Cell|null};
 }
 return {
  reachableFrom(start:Cell){return new Set(search(start).parents.keys());},
  findPath(start:Cell,targets:Cell[]):Cell[]|null{
   const goals=new Set(targets.filter(free).map(cellKey));if(!goals.size)return null;
   const {parents,found}=search(start,goals);if(!found)return null;
   const path:Cell[]=[];let cursor:Cell|null=found;
   while(cursor&&!sameCell(cursor,start)){path.push(cursor);cursor=parents.get(cellKey(cursor))??null;}
   return path.reverse();
  }
 };
}
export function findPath(scene:WorldScene,start:Cell,targets:Cell[]):Cell[]|null{return createNavigator(scene).findPath(start,targets);}
export function interactionCells(scene: WorldScene, entity: WorldEntity): Cell[] {
  if(entity.interaction?.action==='adventure.exit')return walkable(scene,entity.position)?[{...entity.position}]:[];
  if(entity.interactionPoints?.length) return entity.interactionPoints.filter(p => walkable(scene,p)&&levelAt(scene,p)===levelAt(scene,entity.position)&&!stairAt(scene,p));
  return footprint(entity).flatMap(p=>neighbors(p).filter(n=>canCross(scene,p,n))).filter(p => walkable(scene, p));
}
export function project(p: Cell) { return { x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 }; }
