import {walkable,type Cell,type Facing,type WorldScene} from '@isometrico/world';
import type {Adventure} from '../demo/adventure';
import {readProgress,freshProgress} from '../demo/test-progress';
import {readInventory} from '../demo/inventory';
import {readStory} from '../story/progress';
import {resolveStoryScene} from '../story/engine';

export interface PlayerPosition {mapId:string;cell:Cell;facing:Facing}
export interface GameSave {
 version:1;
 adventureId:string;
 savedAt?:string;
 position:PlayerPosition;
 narrativeQueue:string[];
 /** Existing progress, inventory, story and module records share one atomic write. */
 records:Record<string,string>;
}
export interface GameSaveRepository {read:()=>GameSave|null;write:(save:GameSave)=>void}
export const gameSaveKey=(id:string)=>'isometrico.save.v1:'+id;
const facings:Facing[]=['ne','se','sw','nw'];
export function ownsGameRecord(id:string,key:string){
 if(['progress','inventory','story'].some(kind=>key===`isometrico.${kind}.v1:${id}`))return true;
 if(!key.startsWith('isometrico.chat.v1:'))return false;
 try{const scope=JSON.parse(key.slice('isometrico.chat.v1:'.length));return Array.isArray(scope)&&scope[0]===id;}catch{return false;}
}
export function initialPosition(a:Adventure,mapId=a.startMap):PlayerPosition{
 const map=a.maps.find(m=>m.id===mapId)??a.maps.find(m=>m.id===a.startMap)!;
 return {mapId:map.id,cell:{...map.spawn},facing:'se'};
}
export function newGameSave(a:Adventure,mapId?:string):GameSave{return {version:1,adventureId:a.id,position:initialPosition(a,mapId),narrativeQueue:[],records:{['isometrico.progress.v1:'+a.id]:JSON.stringify(freshProgress())}};}

export function parseGameSave(raw:unknown,a:Adventure):GameSave|null{
 try{
  const value=raw as GameSave;
  if(!value||value.version!==1||value.adventureId!==a.id||!value.records||typeof value.records!=='object'||Array.isArray(value.records))return null;
  const records=Object.fromEntries(Object.entries(value.records).filter(([key,value])=>ownsGameRecord(a.id,key)&&typeof value==='string'));
  const p=value.position,cell=p?.cell;
  const position:PlayerPosition={mapId:typeof p?.mapId==='string'?p.mapId:a.startMap,cell:cell&&Number.isSafeInteger(cell.x)&&Number.isSafeInteger(cell.y)?{...cell}:{x:-1,y:-1},facing:facings.includes(p?.facing)?p.facing:'se'};
  return {version:1,adventureId:a.id,records,position,narrativeQueue:Array.isArray(value.narrativeQueue)?value.narrativeQueue.filter(id=>typeof id==='string'):[],...(typeof value.savedAt==='string'&&Number.isFinite(Date.parse(value.savedAt))?{savedAt:value.savedAt}:{})};
 }catch{return null;}
}

/** Local guest games and legacy progress; cloud games use the same save format. */
export function localGameSaves(storage:Storage,a:Adventure):GameSaveRepository{
 return {
  read(){
   const raw=storage.getItem(gameSaveKey(a.id));
   if(raw!==null){
    try{
     return parseGameSave(JSON.parse(raw),a);
    }catch{return null;}
   }
   // Import legacy progress in memory; opening the menu never writes or erases it.
   const records:Record<string,string>={};
   for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key&&ownsGameRecord(a.id,key)){const value=storage.getItem(key);if(value!==null)records[key]=value;}}
   return Object.keys(records).length?{...newGameSave(a),records}:null;
  },
  write(save){storage.setItem(gameSaveKey(a.id),JSON.stringify(save));}
 };
}

/** Storage facade for modules; transactions keep story and inventory inseparable. */
export function createGameSession(repository:GameSaveRepository,initial:GameSave,capture:()=>Pick<GameSave,'position'|'narrativeQueue'>,now=()=>new Date().toISOString()){
 let saved=structuredClone(initial),draft:Record<string,string>|null=null,closed=false;
 function commit(records:Record<string,string>){
  if(closed)throw Error('La partida ya no está activa.');
  const next={...saved,...capture(),records};
  if(saved.savedAt&&JSON.stringify({...next,savedAt:undefined})===JSON.stringify({...saved,savedAt:undefined}))return;
  next.savedAt=now();repository.write(next);saved=structuredClone(next);
 }
 const current=()=>draft??saved.records;
 function mutate(change:(records:Record<string,string>)=>void){if(draft){change(draft);return;}const records={...saved.records};change(records);commit(records);}
 const storage:Storage={
  get length(){return Object.keys(current()).length;},key:i=>Object.keys(current())[i]??null,
  getItem:key=>Object.hasOwn(current(),key)?current()[key]:null,
  setItem(key,value){if(!ownsGameRecord(saved.adventureId,key))throw Error('El registro no pertenece a esta aventura.');mutate(records=>records[key]=value);},
  removeItem:key=>mutate(records=>{delete records[key];}),
  clear:()=>mutate(records=>{for(const key of Object.keys(records))delete records[key];})
 };
 return {
  storage,
  close(){closed=true;},
  get saved(){return structuredClone(saved);},
  checkpoint(){commit(saved.records);},
  transaction<T>(action:()=>T):T{
   if(draft)return action();
   draft={...saved.records};
   try{const result=action();commit(draft);return result;}finally{draft=null;}
  }
 };
}
export type GameSession=ReturnType<typeof createGameSession>;

/** Restore domain state before testing collisions: narrative states can move walls. */
export function restoreGame(a:Adventure,save:GameSave){
 const storage={getItem:(key:string)=>save.records[key]??null};
 const progress=readProgress(storage,a),inventory=readInventory(storage,a.id),story=readStory(storage,a);
 let selected=a.maps.find(m=>m.id===save.position.mapId),adjusted=!selected;
 selected??=a.maps.find(m=>m.id===a.startMap)!;
 let resolved:WorldScene;
 try{resolved=resolveStoryScene(a,selected,story,inventory);}catch{
  selected=a.maps.find(m=>m.id===a.startMap)!;resolved=resolveStoryScene(a,selected,story,inventory);adjusted=true;
 }
 const cell=!adjusted&&walkable(resolved,save.position.cell)?save.position.cell:resolved.spawn;
 adjusted||=cell.x!==save.position.cell.x||cell.y!==save.position.cell.y;
 const position={mapId:selected.id,cell:{...cell},facing:save.position.facing};
 return {progress,inventory,story,scene:{...selected,spawn:{...cell}},position,adjusted};
}
