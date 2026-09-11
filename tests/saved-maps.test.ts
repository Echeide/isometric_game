import {expect,it} from 'vitest';
import {MAP_STORAGE_KEY,readMaps,saveMap} from '../src/lib/demo/saved-maps';
import {office,outdoors} from '../src/lib/demo/scenes';
function memory(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};}
it('persists edits independently and reopens the last applied world',()=>{
 const storage=memory();saveMap(storage,{...office,name:'Mi oficina'});saveMap(storage,{...outdoors,name:'Mi ruta'});
 expect(readMaps(storage).maps.checkpoint?.name).toBe('Mi oficina');
 expect(readMaps(storage).maps.routingtales?.name).toBe('Mi ruta');
 expect(readMaps(storage).active).toBe('routingtales');
});
it('rejects invalid edits without replacing the playable map',()=>{
 const storage=memory();saveMap(storage,office);
 expect(()=>saveMap(storage,{...office,width:0})).toThrow();
 expect(readMaps(storage).maps.checkpoint).toEqual(office);
});
it('ignores corrupt saved maps and surfaces write failures',()=>{
 const storage=memory();storage.setItem(MAP_STORAGE_KEY,'broken');expect(readMaps(storage).maps).toEqual({});
 storage.setItem(MAP_STORAGE_KEY,JSON.stringify({version:1,maps:{checkpoint:{},routingtales:outdoors}}));
 expect(readMaps(storage).maps.routingtales).toEqual(outdoors);expect(readMaps(storage).maps.checkpoint).toBeUndefined();
 expect(()=>saveMap({...storage,setItem:()=>{throw new Error('Storage full');}},office)).toThrow('Storage full');
});
