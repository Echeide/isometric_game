import type {Adventure} from './adventure';
import {initialTasks,type Task} from './scenes';
import {objectiveKey} from './playable-adventure';
import {emptyInventory,saveInventory} from './inventory';
export interface Activity {at:string;message:string}
export interface TestProgress {tasks:Task[];completed:string[];log:Activity[]}
const key=(id:string)=>'isometrico.progress.v1:'+id;
export function milestones(a:Adventure){return a.maps.flatMap(map=>map.entities.filter(e=>e.kind==='goal'&&!e.pickup&&e.interaction?.action!=='adventure.exit').map(e=>({key:objectiveKey(map.id,e.id),label:e.label,map:map.name})));}
export function freshProgress():TestProgress{return {tasks:initialTasks.map(t=>({...t,status:'todo'})),completed:[],log:[]};}
export function readProgress(storage:Pick<Storage,'getItem'>,a:Adventure):TestProgress{
 const fresh=freshProgress();
 try{const raw=storage.getItem(key(a.id));if(!raw){fresh.completed=a.maps.flatMap(m=>m.entities.filter(e=>e.completed).map(e=>objectiveKey(m.id,e.id)));return fresh;}
 const p=JSON.parse(raw);if(!Array.isArray(p.tasks)||!Array.isArray(p.completed)||!Array.isArray(p.log))return fresh;
 fresh.tasks=fresh.tasks.map(t=>{const saved=p.tasks.find((v:Task)=>v?.id===t.id);return saved&&['todo','active','done'].includes(saved.status)?{...t,status:saved.status}:t;});
 fresh.completed=milestones(a).map(m=>m.key).filter(k=>p.completed.includes(k));
 fresh.log=p.log.filter((v:Activity)=>v&&typeof v.message==='string'&&typeof v.at==='string'&&Number.isFinite(Date.parse(v.at))).slice(-100);return fresh;
 }catch{return fresh;}
}
export function writeProgress(storage:Pick<Storage,'setItem'>,id:string,p:TestProgress){storage.setItem(key(id),JSON.stringify(p));}
export function appendActivity(log:Activity[],message:string):Activity[]{return [...log.slice(-99),{at:new Date().toISOString(),message}];}
/** Only gameplay keys belonging to this adventure; maps and resources are untouched. */
export function resetProgress(storage:Storage,id:string):TestProgress{
 const progress=freshProgress(),chatKeys:string[]=[];
 for(let i=0;i<storage.length;i++){const k=storage.key(i);if(!k?.startsWith('isometrico.chat.v1:'))continue;try{const scope=JSON.parse(k.slice('isometrico.chat.v1:'.length));if(Array.isArray(scope)&&scope[0]===id)chatKeys.push(k);}catch{}}
 const keys=[key(id),`isometrico.inventory.v1:${id}`,...chatKeys],previous=keys.map(k=>[k,storage.getItem(k)] as const);
 progress.log=appendActivity([],'Aventura reiniciada desde el panel de pruebas.');
 try{writeProgress(storage,id,progress);saveInventory(storage,id,emptyInventory());chatKeys.forEach(k=>storage.removeItem(k));}
 catch(error){for(const [k,value] of previous)try{if(value===null)storage.removeItem(k);else storage.setItem(k,value);}catch{}throw error;}
 return progress;
}
