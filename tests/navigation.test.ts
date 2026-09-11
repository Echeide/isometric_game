import { describe, expect, it } from 'vitest';
import { findPath, interactionCells, walkable, project } from '../packages/world/src/navigation';
import type { WorldScene } from '../packages/world/src/types';
const scene:WorldScene={id:'test',name:'Test',theme:'office',width:5,height:5,spawn:{x:0,y:0},entities:[{id:'desk',label:'Desk',kind:'desk',position:{x:1,y:1},size:{x:2,y:2}}]};
describe('world navigation',()=>{
 it('finds a shortest route around the whole furniture footprint',()=>{
  const start={x:0,y:1};const route=findPath(scene,start,[{x:3,y:1}]);
  expect(route).toHaveLength(5);
  let previous=start;
  for(const cell of route!){expect(walkable(scene,cell)).toBe(true);expect(Math.abs(cell.x-previous.x)+Math.abs(cell.y-previous.y)).toBe(1);previous=cell;}
  expect(previous).toEqual({x:3,y:1});
 });
 it('returns null for a disconnected destination',()=>{
  const divided={...scene,entities:[],blocked:Array.from({length:5},(_,y)=>({x:2,y}))};
  expect(findPath(divided,{x:0,y:0},[{x:4,y:4}])).toBeNull();
 });
 it('stops at a reachable adjacent tile rather than inside the desk',()=>{
  const targets=interactionCells(scene,scene.entities[0]);
  const path=findPath(scene,scene.spawn,targets)!;
  expect(path).toHaveLength(1);expect(targets).toContainEqual(path.at(-1));
  expect(targets.every(c=>walkable(scene,c))).toBe(true);
 });
 it('handles already-arrived, out-of-bounds and blocked positions',()=>{
  expect(findPath(scene,scene.spawn,[scene.spawn])).toEqual([]);
  expect(findPath(scene,scene.spawn,[{x:-1,y:0}])).toBeNull();
  expect(findPath(scene,{x:1,y:1},[{x:4,y:4}])).toBeNull();
  expect(walkable(scene,{x:.5,y:0})).toBe(false);
 });
 it('projects orthogonal world coordinates into isometric coordinates',()=>{
  expect(project({x:1,y:0})).toEqual({x:32,y:16});
  expect(project({x:0,y:1})).toEqual({x:-32,y:16});
 });
});
