import {createAdventure,parseAdventure,readAdventure,type Adventure} from './adventure';
import {readMaps} from './saved-maps';
import {office,outdoors} from './scenes';
export const LIBRARY_KEY='isometrico.adventures.v1';
export interface AdventureLibrary {version:1;activeId:string;adventures:Adventure[]}
export function parseLibrary(value:unknown):AdventureLibrary{
 const v=value as AdventureLibrary;
 if(!v||v.version!==1||!Array.isArray(v.adventures)||!v.adventures.length)throw new Error('Biblioteca de aventuras no válida.');
 const adventures=v.adventures.map(a=>parseAdventure(a));
 if(new Set(adventures.map(a=>a.id)).size!==adventures.length||!adventures.some(a=>a.id===v.activeId))throw new Error('Selección o identificadores de aventuras no válidos.');
 return {version:1,activeId:v.activeId,adventures};
}
export function loadAdventureLibrary(storage:Pick<Storage,'getItem'>):AdventureLibrary{
 const raw=storage.getItem(LIBRARY_KEY);if(raw!==null)return parseLibrary(JSON.parse(raw));
 let adventure=readAdventure(storage);
 if(!adventure){
  const legacy=readMaps(storage),maps=[structuredClone(legacy.maps.checkpoint??office),structuredClone(legacy.maps.routingtales??outdoors)];
  if(maps[0].id===maps[1].id)maps[1].id+='-outdoors';
  adventure=createAdventure(maps);adventure.startMap=maps[legacy.active==='routingtales'?1:0].id;
 }
 return {version:1,activeId:adventure.id,adventures:[adventure]};
}
export function storeAdventure(storage:Pick<Storage,'getItem'|'setItem'>,value:unknown):AdventureLibrary{
 const adventure=parseAdventure(value),library=loadAdventureLibrary(storage);
 const exists=library.adventures.some(a=>a.id===adventure.id);
 const next=parseLibrary({...library,activeId:adventure.id,adventures:exists?library.adventures.map(a=>a.id===adventure.id?adventure:a):[...library.adventures,adventure]});
 storage.setItem(LIBRARY_KEY,JSON.stringify(next));return next;
}
export function selectAdventure(storage:Pick<Storage,'getItem'|'setItem'>,id:string):Adventure{
 const library=loadAdventureLibrary(storage),next=parseLibrary({...library,activeId:id});
 storage.setItem(LIBRARY_KEY,JSON.stringify(next));return next.adventures.find(a=>a.id===id)!;
}
