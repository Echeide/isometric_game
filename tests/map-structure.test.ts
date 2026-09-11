import {expect,it} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {findPath,interactionCells} from '../packages/world/src/navigation';
import {paintTiles} from '../src/lib/demo/editor';
import {sceneWalls} from '../packages/world/src/walls';
import type {WorldScene,Wall} from '../packages/world/src/types';
import {createAdventure,parseAdventure,connectMaps} from '../src/lib/demo/adventure';
const base:WorldScene={schemaVersion:1,id:'a',name:'A',theme:'outdoors',width:4,height:4,spawn:{x:0,y:0},entities:[]};
it('removes and restores tiles without changing the source',()=>{
 const cut=paintTiles(base,[{x:1,y:0}],'void');
 expect(findPath(cut,base.spawn,[{x:1,y:0}])).toBeNull();
 expect(findPath(cut,base.spawn,[{x:2,y:0}])?.length).toBe(4);
 expect(findPath(paintTiles(cut,[{x:1,y:0}],'grass'),base.spawn,[{x:2,y:0}])?.length).toBe(2);
 expect(base.tiles).toBeUndefined();
 expect(()=>paintTiles(base,[base.spawn],'void')).toThrow('entrada');
});
it('protects objects, seats and interaction tiles from deletion',()=>{
 const scene=parseScene({...base,entities:[{id:'desk',label:'Desk',kind:'desk',position:{x:2,y:2},seat:{cell:{x:2,y:3},facing:'ne'},interactionPoints:[{x:3,y:2}]}]});
 for(const p of [{x:2,y:2},{x:2,y:3},{x:3,y:2}])expect(()=>paintTiles(scene,[p],'void')).toThrow('Mueve');
});
it('routes through doors but never across wall segments',()=>{
 const walls:Wall[]=Array.from({length:4},(_,y)=>({x:2,y,axis:'y',kind:'wall'}));
 const divided=parseScene({...base,walls});
 expect(findPath(divided,base.spawn,[{x:3,y:0}])).toBeNull();
 const door=parseScene({...base,walls:walls.map(w=>w.y===2?{...w,kind:'door'}:w)});
 expect(findPath(door,base.spawn,[{x:3,y:0}])).toContainEqual({x:2,y:2});
 expect(parseScene(JSON.parse(JSON.stringify(door)))).toEqual(door);
});
it('validates wall geometry and keeps legacy boundary walls',()=>{
 expect(sceneWalls({...base,theme:'office'})).toHaveLength(8);
 expect(sceneWalls({...base,theme:'office',walls:[]})).toEqual([]);
 for(const walls of [[{x:4,y:0,axis:'x',kind:'wall'}],[{x:1,y:1,axis:'z',kind:'wall'}],[{x:1,y:1,axis:'x',kind:'wall'},{x:1,y:1,axis:'x',kind:'door'}]])expect(()=>parseScene({...base,walls})).toThrow();
 expect(()=>parseScene({...base,tiles:{'1,0':'void','1,1':'void'},walls:[{x:1,y:1,axis:'x',kind:'wall'}]})).toThrow('apoyo');
});
it('protects incoming adventure destinations when cutting terrain',()=>{
 const a=connectMaps(createAdventure([base,{...base,id:'b'}]),'a','b','exit',{x:1,y:1});
 expect(()=>parseAdventure({...a,maps:a.maps.map(m=>m.id==='b'?paintTiles(m,[{x:1,y:1}],'void'):m)})).toThrow('llegada');
});
it('cannot interact through a wall next to an object',()=>{
 const entity={id:'object',label:'Object',kind:'plant' as const,position:{x:1,y:1}};
 const scene=parseScene({...base,entities:[entity],walls:[{axis:'y',x:1,y:1,kind:'wall'}]});
 expect(interactionCells(scene,entity)).not.toContainEqual({x:0,y:1});
});
it('round-trips a connected door and rejects moving its exit away',()=>{
 let a=connectMaps(createAdventure([base,{...base,id:'b'}]),'a','b','door-exit',undefined,{x:2,y:2});
 a={...a,maps:a.maps.map(m=>m.id!=='a'?m:{...m,entities:m.entities.map(e=>({...e,solid:false,interactionPoints:[{x:2,y:2}]})),walls:[{x:2,y:2,axis:'x',kind:'door',exitId:'door-exit'}]})};
 expect(parseAdventure(JSON.parse(JSON.stringify(a))).maps[0].walls?.[0].exitId).toBe('door-exit');
 const invalid={...a,maps:a.maps.map(m=>m.id!=='a'?m:{...m,entities:m.entities.map(e=>({...e,position:{x:3,y:3}}))})};
 expect(()=>parseAdventure(invalid)).toThrow('junto a su puerta');
});
it('preserves wall materials without changing routes and rejects unknown finishes',()=>{
 for(const material of ['white','glass','stone','cobble'] as const){
  const scene=parseScene({...base,walls:[{x:2,y:1,axis:'y',kind:'wall',material}]});
  expect(parseScene(JSON.parse(JSON.stringify(scene))).walls?.[0].material).toBe(material);
  expect(findPath(scene,base.spawn,[{x:3,y:1}])).toEqual(findPath({...scene,walls:scene.walls!.map(({material,...w})=>w)},base.spawn,[{x:3,y:1}]));
 }
 expect(()=>parseScene({...base,walls:[{x:2,y:1,axis:'y',kind:'wall',material:'plastic'}]})).toThrow('Acabado');
});
