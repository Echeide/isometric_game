import {expect,it} from 'vitest';
import {changeMapSpawn,connectMaps,createAdventure,exitArrival,parseAdventure,travel} from '../src/lib/demo/adventure';
import type {WorldScene} from '../packages/world/src/types';
const map=(id:string):WorldScene=>({schemaVersion:1,id,name:id,theme:'outdoors',width:8,height:8,spawn:{x:1,y:1},entities:[]});
const oneWay=()=>connectMaps(createAdventure([map('a'),map('b')]),'a','b','out');
const paired=()=>connectMaps(oneWay(),'b','a','back');
it('follows the current map entry instead of the copied coordinates after the entry moves',()=>{
 const a=oneWay();a.maps[1].spawn={x:4,y:4};a.maps[1].blocked=[{x:1,y:1}];
 expect(exitArrival(a,a.exits[0]).cell).toEqual({x:4,y:4});
 expect(()=>parseAdventure(a)).not.toThrow();expect(travel(a,'a','out').scene.spawn).toEqual({x:4,y:4});
});
it('updates legacy entry copies when editing a map but preserves explicitly fixed arrivals',()=>{
 const a=oneWay();delete a.exits[0].arrivalMode;
 const moved=changeMapSpawn(a,'b',{x:3,y:2});expect(moved.exits[0]).toMatchObject({arrivalMode:'spawn',arrival:{x:3,y:2}});
 const fixed=oneWay();fixed.exits[0].arrivalMode='position';
 const retained=changeMapSpawn(fixed,'b',{x:3,y:2});expect(retained.exits[0].arrival).toEqual({x:1,y:1});
 expect(travel(retained,'a','out').scene.spawn).toEqual({x:1,y:1});expect(a.maps[1].spawn).toEqual({x:1,y:1});
});
it('preserves legacy custom coordinates that differ from the old map entry',()=>{
 const a=oneWay();delete a.exits[0].arrivalMode;a.exits[0].arrival={x:5,y:5};
 expect(changeMapSpawn(a,'b',{x:3,y:2}).exits[0].arrival).toEqual({x:5,y:5});
});
it('validates and travels to the moved linked entity even if its unused old coordinates are blocked',()=>{
 const a=paired();a.maps[1].spawn={x:3,y:3};a.maps[1].blocked=[{x:1,y:1}];a.maps[1].entities[0].position={x:4,y:7};
 expect(()=>parseAdventure(a)).not.toThrow();const result=travel(a,'a','out');expect(result.scene.spawn).toEqual({x:4,y:7});expect(result.facing).toBe('ne');
});
it('ignores obsolete linked fallback coordinates outside a resized destination',()=>{
 const a=paired();a.exits[0].arrival={x:7,y:7};a.maps[1]={...a.maps[1],width:6,height:6,entities:[{...a.maps[1].entities[0],position:{x:4,y:5}}]};
 expect(()=>parseAdventure(a)).not.toThrow();expect(travel(a,'a','out').scene.spawn).toEqual({x:4,y:5});
});
it('honors an explicit fixed tile despite a return exit in the destination',()=>{
 const a=paired();a.exits[0]={...a.exits[0],destinationEntityId:undefined,arrivalMode:'position',arrival:{x:5,y:5}};
 expect(travel(a,'a','out').scene.spawn).toEqual({x:5,y:5});
});
it('keeps legacy unambiguous pairing while refusing dangling explicit references',()=>{
 const a=paired();for(const exit of a.exits){delete exit.arrivalMode;delete exit.destinationEntityId;}
 expect(travel(a,'a','out').scene.spawn).toEqual(a.maps[1].entities[0].position);
 a.exits[0].destinationEntityId='deleted';expect(()=>parseAdventure(a)).toThrow('entrada de destino no existe');
});
it('still rejects blocked effective arrivals and invalid arrival modes',()=>{
 const a=oneWay();a.maps[1].entities.push({id:'wall',label:'Wall',kind:'tree',position:{x:2,y:2}});a.maps[1].spawn={x:3,y:3};a.exits[0]={...a.exits[0],arrivalMode:'position',arrival:{x:2,y:2}};
 expect(()=>parseAdventure(a)).toThrow('bloqueada (2, 2)');
 expect(()=>parseAdventure({...oneWay(),exits:[{...oneWay().exits[0],arrivalMode:'typo'}]})).toThrow('Tipo de llegada');
});
