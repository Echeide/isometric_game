import {environments} from '@isometrico/world';
import {parseScene,type WorldScene} from '@isometrico/world';
export type WorldSlot='checkpoint'|'routingtales';
export const MAP_STORAGE_KEY='isometrico.maps.v1';
type StorageAccess=Pick<Storage,'getItem'|'setItem'>;
export function readMaps(storage:Pick<Storage,'getItem'>):{active:WorldSlot;maps:Partial<Record<WorldSlot,WorldScene>>}{
 const result:{active:WorldSlot;maps:Partial<Record<WorldSlot,WorldScene>>}={active:'checkpoint',maps:{}};
 const raw=storage.getItem(MAP_STORAGE_KEY);if(!raw)return result;
 let data;try{data=JSON.parse(raw);}catch{return result;}
 if(data?.version!==1)return result;
 if(data.active==='routingtales')result.active=data.active;
 for(const slot of ['checkpoint','routingtales'] as const){
  try{result.maps[slot]=parseScene(data.maps?.[slot]);}catch{/* Ignore invalid stored maps individually. */}
 }
 return result;
}
export function saveMap(storage:StorageAccess,value:unknown,target?:WorldSlot):WorldSlot{
 const scene=parseScene(value),slot:WorldSlot=target??(environments[scene.theme].outdoor?'routingtales':'checkpoint');
 const saved=readMaps(storage);
 storage.setItem(MAP_STORAGE_KEY,JSON.stringify({version:1,active:slot,maps:{...saved.maps,[slot]:scene}}));
 return slot;
}
