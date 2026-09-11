import { describe,it,expect } from 'vitest';
import { parseScene } from '../packages/world/src/scene';
import { walkable, interactionCells } from '../packages/world/src/navigation';
import office from '../src/lib/demo/maps/checkpoint.json';
import outdoors from '../src/lib/demo/maps/routingtales.json';
import { facingFor } from '../packages/world/src/actor';
describe('scene files',()=>{
 it('accepts both complete maps, including reachable desk seating',()=>{
  for(const data of [office,outdoors])expect(parseScene(data).id).toBe(data.id);
  const map=parseScene(office),desk=map.entities.find(e=>e.id==='my-desk')!;
  expect(interactionCells(map,desk)).toEqual([desk.seat!.cell]);
 });
 it('rejects unsupported versions and invalid or overlapping objects',()=>{
  expect(()=>parseScene({...office,schemaVersion:2})).toThrow('Versión');
  expect(()=>parseScene({...office,spawn:{x:3,y:5}})).toThrow('entrada está bloqueada');
  expect(()=>parseScene({...office,entities:[...office.entities,office.entities[0]]})).toThrow('únicos');
  const data=structuredClone(office);data.entities[1].position={x:3,y:5};expect(()=>parseScene(data)).toThrow('solapa');
 });
 it('rejects an unreachable seat instead of loading a broken workstation',()=>{
  const data=structuredClone(office);data.entities[0].seat!.cell={x:3,y:5};expect(()=>parseScene(data)).toThrow('asiento');
 });
 it('allows walkable decoration without ignoring other obstacles',()=>{
  const data=structuredClone(office);const map=parseScene(data);map.entities[0].solid=false;
  expect(walkable(map,{x:3,y:5})).toBe(true);expect(walkable(map,{x:7,y:3})).toBe(false);
 });
});
describe('isometric facing',()=>{
 it('faces in the four projected travel directions and preserves idle orientation',()=>{
  expect(facingFor(1,0)).toBe('se');expect(facingFor(-1,0)).toBe('nw');expect(facingFor(0,1)).toBe('sw');expect(facingFor(0,-1)).toBe('ne');expect(facingFor(0,0,'nw')).toBe('nw');
 });
});
