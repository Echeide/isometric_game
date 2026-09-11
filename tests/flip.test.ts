import {expect,it} from 'vitest';
import {flipEntity} from '../src/lib/demo/editor';
import {office} from '../src/lib/demo/scenes';
import {parseScene} from '../packages/world/src/scene';
import {saveMap,readMaps} from '../src/lib/demo/saved-maps';
it('reflects footprint, seat and access points, and reverses the operation',()=>{
 const flipped=flipEntity(office,'my-desk');const desk=flipped.entities.find(e=>e.id==='my-desk')!;
 expect(desk.flipX).toBe(true);expect(desk.size).toEqual({x:1,y:2});
 expect(desk.seat).toEqual({cell:{x:4,y:5},facing:'nw'});
 expect(desk.interactionPoints).toEqual([{x:4,y:5}]);
 expect(flipEntity(flipped,'my-desk').entities.find(e=>e.id==='my-desk')).toEqual({...office.entities.find(e=>e.id==='my-desk'),flipX:false});
});
it('rejects reflected furniture that would leave the map',()=>{
 const scene=parseScene({schemaVersion:1,id:'edge',name:'Edge',theme:'office',width:3,height:2,spawn:{x:2,y:0},entities:[{id:'desk',kind:'desk',label:'Desk',position:{x:0,y:1},size:{x:2,y:1}}]});
 expect(()=>flipEntity(scene,'desk')).toThrow();expect(scene.entities[0].flipX).toBeUndefined();
});
it('validates and persists flip state with the playable map',()=>{
 let value:string|null=null;const storage={getItem:()=>value,setItem:(_k:string,v:string)=>{value=v;}};
 saveMap(storage,flipEntity(office,'my-desk'));expect(readMaps(storage).maps.checkpoint?.entities[0].flipX).toBe(true);
 expect(()=>parseScene({...office,entities:office.entities.map(e=>({...e,flipX:'yes'}))})).toThrow('flipX');
});
