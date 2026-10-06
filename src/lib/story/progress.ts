import type {Adventure} from '../demo/adventure';
import type {InventoryProgress} from '../demo/inventory';
import {readInventory,saveInventory} from '../demo/inventory';
import {chatProgressKey} from '../chat/routingtales';
import {restoreStory,entityModules} from './engine';
import {moduleKey,type StoryProgress} from './types';
const key=(id:string)=>'isometrico.story.v1:'+id;
export function readStory(storage:Pick<Storage,'getItem'>,a:Adventure):StoryProgress{let raw:unknown;try{raw=JSON.parse(storage.getItem(key(a.id))??'null');}catch{}const p=restoreStory(a,raw);
 // Existing chat progress migrates without replaying any rewards or reactions.
 for(const m of a.maps)for(const e of m.entities){const ref={mapId:m.id,entityId:e.id};for(const module of entityModules(a,ref)){const k=moduleKey(ref,module.id);if(k in p.modules)continue;try{const node=storage.getItem(chatProgressKey(a.id,m.id,e.id,module.resourceId));if(node)p.modules[k]=node==='success'?'completed':node==='fail'?'failed':'started';}catch{}}}return p;}
/** Roll back both records when storage rejects a write; callers update their UI only after success. */
export function saveStory(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,id:string,p:StoryProgress,inventory:InventoryProgress){const keys=[key(id),'isometrico.inventory.v1:'+id],before=keys.map(k=>storage.getItem(k));try{storage.setItem(keys[0],JSON.stringify(p));saveInventory(storage,id,inventory);}catch(error){keys.forEach((k,i)=>{try{if(before[i]===null)storage.removeItem(k);else storage.setItem(k,before[i]!);}catch{}});throw error;}}
export function resetStory(storage:Pick<Storage,'setItem'>,id:string){storage.setItem(key(id),JSON.stringify({states:{},modules:{},fired:[]}));}
export {readInventory};
