import {levelAt,stairAt} from './elevation';
import {hasTile,canCross} from './walls';
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
/** Breadth-first search: shortest four-direction route, never crosses furniture. */
export function findPath(scene: WorldScene, start: Cell, targets: Cell[]): Cell[] | null {
  if (!walkable(scene, start)) return null;
  const goal = new Set(targets.filter(p => walkable(scene, p)).map(cellKey));
  const queue: Cell[] = [start];
  const parents = new Map<string, Cell | null>([[cellKey(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (goal.has(cellKey(current))) {
      const path: Cell[] = [];
      let cursor: Cell | null = current;
      while (cursor && !sameCell(cursor, start)) {
        path.unshift(cursor);
        cursor = parents.get(cellKey(cursor)) ?? null;
      }
      return path;
    }
    for (const next of neighbors(current)) {
      if (canCross(scene,current,next) && walkable(scene, next) && !parents.has(cellKey(next))) {
        parents.set(cellKey(next), current);
        queue.push(next);
      }
    }
  }
  return null;
}
export function interactionCells(scene: WorldScene, entity: WorldEntity): Cell[] {
  if(entity.interaction?.action==='adventure.exit')return walkable(scene,entity.position)?[{...entity.position}]:[];
  if(entity.interactionPoints?.length) return entity.interactionPoints.filter(p => walkable(scene,p)&&levelAt(scene,p)===levelAt(scene,entity.position)&&!stairAt(scene,p));
  return footprint(entity).flatMap(p=>neighbors(p).filter(n=>canCross(scene,p,n))).filter(p => walkable(scene, p));
}
export function project(p: Cell) { return { x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 }; }
