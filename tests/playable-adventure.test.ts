import {expect,it} from 'vitest';
import {loadPlayableAdventure,objectiveKey} from '../src/lib/demo/playable-adventure';
import {createAdventure,saveAdventure,ADVENTURE_KEY} from '../src/lib/demo/adventure';
import {saveMap,MAP_STORAGE_KEY} from '../src/lib/demo/saved-maps';
import {office,outdoors,makeAdapter} from '../src/lib/demo/scenes';
function storage(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
it('uses the saved adventure in preference to legacy demo maps',()=>{
 const s=storage();saveMap(s,{...office,name:'Old demo'});
 const adventure=createAdventure([{...office,name:'Editor map'},outdoors]);adventure.startMap=outdoors.id;
 saveAdventure(s,adventure);
 expect(loadPlayableAdventure(s)).toEqual(adventure);
 expect(JSON.parse(s.getItem(MAP_STORAGE_KEY)!).maps.checkpoint.name).toBe('Old demo');
});
it('loads the legacy worlds without overwriting them and respects the active world',()=>{
 const s=storage();saveMap(s,{...outdoors,name:'Saved outdoors'},'routingtales');
 const result=loadPlayableAdventure(s);
 expect(result.maps).toHaveLength(2);expect(result.startMap).toBe(outdoors.id);
 expect(result.maps[1].name).toBe('Saved outdoors');expect(s.getItem(ADVENTURE_KEY)).toBeNull();
});
it('does not silently replace a corrupt adventure with demo data',()=>{
 const s=storage();s.setItem(ADVENTURE_KEY,'broken');expect(()=>loadPlayableAdventure(s)).toThrow();expect(s.getItem(ADVENTURE_KEY)).toBe('broken');
});
it('isolates objective progress by map and entity even for duplicated resource ids',()=>{
 expect(objectiveKey('a','goal')).not.toBe(objectiveKey('b','goal'));
 expect(objectiveKey('a,b','c')).not.toBe(objectiveKey('a','b,c'));
});
it('routes original tasks, project, chat and goals through the same validated adapter',()=>{
 const events:string[]=[];
 for(const scene of [office,outdoors]){
  const adapter=makeAdapter(scene,e=>events.push(e.action));
  for(const e of scene.entities)if(e.interaction)adapter.interact({sceneId:scene.id,entityId:e.id,...e.interaction});
  expect(()=>adapter.interact({sceneId:scene.id,entityId:'missing',action:'tasks.open',resourceId:'fake'})).toThrow();
 }
 expect(events).toEqual(expect.arrayContaining(['tasks.open','project.open','chat.open','goal.open']));
});
