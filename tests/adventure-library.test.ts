import {expect,it} from 'vitest';
import {loadAdventureLibrary,storeAdventure,selectAdventure,LIBRARY_KEY,parseLibrary} from '../src/lib/demo/adventure-library';
import {createAdventure,saveAdventure,ADVENTURE_KEY} from '../src/lib/demo/adventure';
import {office,outdoors} from '../src/lib/demo/scenes';
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
const first=()=>({...createAdventure([office,outdoors]),id:'first',name:'Primera'});
const second=()=>({...createAdventure([office]),id:'second',name:'Segunda'});
it('migrates the saved adventure with all maps without modifying legacy storage',()=>{
 const s=storage(),a=first();saveAdventure(s,a);const legacy=s.getItem(ADVENTURE_KEY);
 expect(loadAdventureLibrary(s).adventures).toEqual([a]);expect(s.getItem(LIBRARY_KEY)).toBeNull();
 storeAdventure(s,second());expect(loadAdventureLibrary(s).adventures).toEqual([a,second()]);expect(s.getItem(ADVENTURE_KEY)).toBe(legacy);
});
it('updates and selects adventures independently even with shared map ids',()=>{
 const s=storage();saveAdventure(s,first());storeAdventure(s,second());
 storeAdventure(s,{...first(),maps:[{...office,name:'Updated'},outdoors]});
 const library=loadAdventureLibrary(s);expect(library.adventures.map(a=>a.id)).toEqual(['first','second']);
 expect(library.adventures[1].maps[0].name).toBe(office.name);
 expect(selectAdventure(s,'second')).toEqual(second());expect(loadAdventureLibrary(s).activeId).toBe('second');
 const before=s.getItem(LIBRARY_KEY);expect(()=>selectAdventure(s,'missing')).toThrow();expect(s.getItem(LIBRARY_KEY)).toBe(before);
});
it('rejects duplicate identities and preserves corrupt libraries',()=>{
 expect(()=>parseLibrary({version:1,activeId:'first',adventures:[first(),first()]})).toThrow();
 const s=storage();s.setItem(LIBRARY_KEY,'');expect(()=>storeAdventure(s,second())).toThrow();expect(s.getItem(LIBRARY_KEY)).toBe('');
});
it('reports failed writes without modifying the previous save',()=>{
 const s=storage();saveAdventure(s,first());storeAdventure(s,second());const before=s.getItem(LIBRARY_KEY);
 expect(()=>storeAdventure({...s,setItem:()=>{throw new Error('Quota');}},first())).toThrow('Quota');
 expect(s.getItem(LIBRARY_KEY)).toBe(before);
});
