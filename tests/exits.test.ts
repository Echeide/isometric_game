import {expect,it} from 'vitest';
import {exitFacing,entranceFacing} from '../packages/world/src/exits';
import {interactionCells,findPath} from '../packages/world/src/navigation';
import {parseScene} from '../packages/world/src/scene';
import type {WorldEntity,WorldScene} from '../packages/world/src/types';
const exit:WorldEntity={id:'exit',label:'Salida',kind:'goal',position:{x:0,y:2},interaction:{action:'adventure.exit',label:'Salir',resourceId:'exit'}};
const base:WorldScene={schemaVersion:1,id:'map',name:'Map',theme:'outdoors',width:5,height:5,spawn:{x:2,y:2},entities:[exit]};
it('finishes the path on the exit tile even for old solid markers',()=>{
 const scene=parseScene({...base,entities:[{...exit,solid:true}]});
 const targets=interactionCells(scene,scene.entities[0]);
 expect(targets).toEqual([exit.position]);
 expect(findPath(scene,scene.spawn,targets)?.at(-1)).toEqual(exit.position);
});
it('faces out at departure and inward at arrival on each map edge',()=>{
 for(const [position,outward,inward] of [[{x:0,y:2},'nw','se'],[{x:4,y:2},'se','nw'],[{x:2,y:0},'ne','sw'],[{x:2,y:4},'sw','ne']] as const){
  expect(exitFacing(base,{...exit,position})).toBe(outward);
  expect(entranceFacing(base,{...exit,position})).toBe(inward);
 }
});
it('uses the actual door edge and approach side instead of the nearest map boundary',()=>{
 const scene:WorldScene={...base,walls:[{x:2,y:2,axis:'x',kind:'door',exitId:'exit'}]};
 expect(exitFacing(scene,{...exit,position:{x:2,y:2}})).toBe('ne');
 expect(entranceFacing(scene,{...exit,position:{x:2,y:2}})).toBe('sw');
 expect(exitFacing(scene,{...exit,position:{x:2,y:1}})).toBe('sw');
});
