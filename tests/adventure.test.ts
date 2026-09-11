import {expect,it} from 'vitest';
import {createAdventure,parseAdventure,connectMaps,travel,saveAdventure,readAdventure} from '../src/lib/demo/adventure';
import type {WorldScene} from '../packages/world/src/types';
const map=(id:string):WorldScene=>({schemaVersion:1,id,name:id,theme:'outdoors',width:8,height:8,spawn:{x:1,y:1},entities:[]});
it('connects maps in both directions and preserves original spawn positions',()=>{
 const original=createAdventure([map('a'),map('b')]);
 const linked=connectMaps(connectMaps(original,'a','b','out',{x:4,y:4}),'b','a','back',{x:2,y:2});
 expect(travel(linked,'a','out').scene.spawn).toEqual({x:0,y:7});
 expect(travel(linked,'b','back').scene.spawn).toEqual({x:0,y:7});
 expect(linked.maps[1].spawn).toEqual({x:1,y:1});expect(original.exits).toEqual([]);
 expect(()=>travel(linked,'b','out')).toThrow();
});
it('rejects missing maps, blocked arrivals, fractional coordinates and duplicate identifiers',()=>{
 const a=connectMaps(createAdventure([map('a'),map('b')]),'a','b','out');
 expect(()=>parseAdventure({...a,startMap:'missing'})).toThrow('inicial');
 expect(()=>parseAdventure({...a,maps:[a.maps[0],a.maps[0]]})).toThrow('repetidos');
 expect(()=>parseAdventure({...a,exits:[a.exits[0],a.exits[0]]})).toThrow('únicos');
 for(const arrival of [{x:-1,y:0},{x:.5,y:1},{x:8,y:0}])expect(()=>parseAdventure({...a,exits:[{...a.exits[0],arrival}]})).toThrow('llegada');
 expect(()=>parseAdventure({...a,exits:[{...a.exits[0],toMap:'missing'}]})).toThrow('inexistente');
 const blocked={...a,maps:a.maps.map(m=>m.id==='b'?{...m,blocked:[{x:4,y:4}]}:m),exits:[{...a.exits[0],arrival:{x:4,y:4}}]};
 expect(()=>parseAdventure(blocked)).toThrow('bloqueada');
});
it('rejects isolated arrival tiles and orphan exit interactions',()=>{
 const a=connectMaps(createAdventure([map('a'),map('b')]),'a','b','out',{x:5,y:5});
 expect(()=>parseAdventure({...a,maps:a.maps.map(m=>m.id==='b'?{...m,blocked:[{x:4,y:5},{x:6,y:5},{x:5,y:4},{x:5,y:6}]}:m)})).toThrow('aislada');
 expect(()=>parseAdventure({...a,exits:[]})).toThrow('Falta el destino');
});
it('round trips complete adventures and does not overwrite saved data on invalid edits',()=>{
 let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>raw=value};
 const a=connectMaps(createAdventure([map('a'),map('b')]),'a','b','out');
 saveAdventure(storage,a);expect(readAdventure(storage)).toEqual(a);
 expect(()=>saveAdventure(storage,{...a,maps:[]})).toThrow();expect(readAdventure(storage)).toEqual(a);
});

it('arrives on the paired exit facing inward, including legacy solid exits',()=>{
 const linked=connectMaps(connectMaps(createAdventure([map('a'),map('b')]),'a','b','out'),'b','a','back');
 linked.maps[1].entities[0].position={x:4,y:7};
 linked.maps[1].entities[0].solid=true;
 for(const facing of ['se','nw','sw','ne'] as const){
  const result=travel(linked,'a','out',facing);
  expect(result.scene.spawn).toEqual({x:4,y:7});expect(result.facing).toBe('ne');
  expect(result.scene.entities[0].solid).toBe(false);
 }
 const legacy={...linked,exits:linked.exits.map(({destinationEntityId,...e})=>e)};
 expect(travel(legacy,'a','out','ne').scene.spawn).toEqual({x:4,y:7});
});
it('keeps distinct paired doors between the same maps and uses configured arrivals for one-way exits',()=>{
 let a=createAdventure([map('a'),map('b')]);
 a=connectMaps(a,'a','b','out');
 expect(travel(a,'a','out','nw').scene.spawn).toEqual({x:1,y:1});
 a=connectMaps(a,'b','a','back');a=connectMaps(a,'a','b','out2');a=connectMaps(a,'b','a','back2');
 a.maps[1].entities.find(e=>e.id==='back')!.position={x:3,y:3};
 a.maps[1].entities.find(e=>e.id==='back2')!.position={x:5,y:5};
 expect(travel(a,'a','out','se').scene.spawn).toEqual({x:3,y:3});
 expect(travel(a,'a','out2','se').scene.spawn).toEqual({x:5,y:5});
});
