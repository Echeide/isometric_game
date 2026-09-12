import type {Adventure} from './adventure';
import type {WorldScene} from '@isometrico/world';
export interface InventoryItem {id:string;name:string;description:string;stackable:boolean}
export interface InventoryProgress {counts:Record<string,number>;collected:string[];unlocked:string[]}
export const emptyInventory=():InventoryProgress=>({counts:{},collected:[],unlocked:[]});
const key=(map:string,entity:string)=>JSON.stringify([map,entity]);
export function collectItem(a:Adventure,p:InventoryProgress,mapId:string,entityId:string):InventoryProgress{
 const e=a.maps.find(m=>m.id===mapId)?.entities.find(e=>e.id===entityId),pickup=e?.pickup;
 if(!pickup)throw new Error('Este objeto no se puede recoger.');
 const item=a.items?.find(i=>i.id===pickup.itemId);if(!item)throw new Error('Artículo inexistente.');
 const id=key(mapId,entityId);if(p.collected.includes(id))return p;
 const next=structuredClone(p);next.counts[item.id]=item.stackable?(next.counts[item.id]??0)+pickup.quantity:1;next.collected.push(id);return next;
}
export function useExit(a:Adventure,p:InventoryProgress,exitId:string):InventoryProgress{
 const exit=a.exits.find(e=>e.id===exitId);if(!exit)throw new Error('Salida inexistente.');
 const r=exit.requirement;if(!r||p.unlocked.includes(exit.id))return p;
 const item=a.items?.find(i=>i.id===r.itemId);
 if((p.counts[r.itemId]??0)<r.quantity)throw new Error(`Necesitas ${r.quantity} × ${item?.name??r.itemId} para salir.`);
 const next=structuredClone(p);if(r.consume)next.counts[r.itemId]-=r.quantity;next.unlocked.push(exit.id);return next;
}
export function collectedIds(p:InventoryProgress,map:WorldScene){return map.entities.filter(e=>p.collected.includes(key(map.id,e.id))).map(e=>e.id);}
const storageKey=(id:string)=>`isometrico.inventory.v1:${id}`;
export function readInventory(storage:Pick<Storage,'getItem'>,id:string):InventoryProgress{
 try{const p=JSON.parse(storage.getItem(storageKey(id))??'null');if(p&&p.counts&&typeof p.counts==='object'&&!Array.isArray(p.counts)&&Object.values(p.counts).every(n=>Number.isSafeInteger(n)&&Number(n)>=0)&&['collected','unlocked'].every(k=>Array.isArray(p[k])&&p[k].every((v:unknown)=>typeof v==='string')))return p;}catch{}
 return emptyInventory();
}
export function saveInventory(storage:Pick<Storage,'setItem'>,id:string,p:InventoryProgress){storage.setItem(storageKey(id),JSON.stringify(p));}
