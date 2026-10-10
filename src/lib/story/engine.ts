import {restoreNarratives,narrativeStatus} from './narrative';
import type {Adventure} from '../demo/adventure';
import type {WorldEntity,WorldScene,Cell} from '@isometrico/world';
import {walkable} from '../../../packages/world/src/navigation';
import type {InventoryProgress} from '../demo/inventory';
import {moduleStatuses,eventLabels,emptyStory,entityKey,moduleKey,reactionKey,type EntityRef,type EntityBehavior,type Condition,type ConditionGroup,type StoryProgress,type StoryEvent,type ModuleStatus} from './types';
/** Module identity is local to an object, independent of the editable content resource. */
export function entityModules(a:Adventure,ref:EntityRef){const e=a.maps.find(m=>m.id===ref.mapId)?.entities.find(e=>e.id===ref.entityId);return e?.interaction?.action==='chat.open'?[{id:'chat',name:a.chats?.find(c=>'chat:'+c.id===e.interaction?.resourceId)?.name??'Conversación',resourceId:e.interaction.resourceId}]:[];}
export function behavior(a:Adventure,ref:EntityRef){return a.story?.entities.find(e=>e.mapId===ref.mapId&&e.entityId===ref.entityId);}
export function objectState(a:Adventure,p:StoryProgress,ref:EntityRef){const b=behavior(a,ref),saved=p.states[entityKey(ref)];return b?.states.some(s=>s.id===saved)?saved:b?.initialState;}
export function moduleStatus(p:StoryProgress,ref:EntityRef,moduleId:string):ModuleStatus{return p.modules[moduleKey(ref,moduleId)]??'not-started';}
export function matches(a:Adventure,p:StoryProgress,inventory:InventoryProgress,c:Condition){let result=false;if(c.kind==='object')result=objectState(a,p,c)===c.stateId;else if(c.kind==='module')result=moduleStatus(p,c,c.moduleId)===c.status;else if(c.kind==='event')result=narrativeStatus(p,c.eventId)===c.status;else result=(inventory.counts[c.itemId]??0)>=c.quantity;return c.not?!result:result;}
export function allows(a:Adventure,p:StoryProgress,i:InventoryProgress,g?:ConditionGroup){return !g||!g.conditions.length||(g.mode==='all'?g.conditions.every(c=>matches(a,p,i,c)):g.conditions.some(c=>matches(a,p,i,c)));}
export function availability(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef){const b=behavior(a,ref),state=b?.states.find(s=>s.id===objectState(a,p,ref));return {visible:state?.visible!==false&&allows(a,p,i,b?.visibility),interactive:state?.interactive!==false&&allows(a,p,i,b?.interaction),state,message:b?.blockedMessage?.trim()||'Todavía no puedes usar este objeto.'};}
/** Hidden objects are absent from both drawing and navigation; interaction gates keep physical collisions. */
export function resolveStoryScene(a:Adventure,scene:WorldScene,p:StoryProgress,i:InventoryProgress):WorldScene{
 const entities:WorldEntity[]=scene.entities.flatMap(e=>{const v=availability(a,p,i,{mapId:scene.id,entityId:e.id});return v.visible?[{...e,...(v.state?.description!==undefined?{description:v.state.description}:{}),...(v.state?.visualId?{visualId:v.state.visualId}:{}),...(v.state?.solid!==undefined?{solid:v.state.solid}:{})}]:[];});
 const next={...scene,entities};
 // A newly visible solid object must not strand the player inside its footprint.
 if(!walkable(next,next.spawn)){const cells:Cell[]=[];for(let y=0;y<next.height;y++)for(let x=0;x<next.width;x++)if(walkable(next,{x,y}))cells.push({x,y});cells.sort((l,r)=>Math.abs(l.x-next.spawn.x)+Math.abs(l.y-next.spawn.y)-Math.abs(r.x-next.spawn.x)-Math.abs(r.y-next.spawn.y));if(!cells[0])throw Error("Este estado no deja ninguna casilla libre para el jugador.");next.spawn=cells[0];}
 return next;
}
export function setObjectState(a:Adventure,p:StoryProgress,ref:EntityRef,stateId:string):StoryProgress{if(!behavior(a,ref)?.states.some(s=>s.id===stateId))throw Error('El estado del objeto ya no existe.');return {...p,states:{...p.states,[entityKey(ref)]:stateId}};}
export function setModuleStatus(a:Adventure,p:StoryProgress,ref:EntityRef,moduleId:string,status:ModuleStatus):StoryProgress{if(!moduleStatuses.includes(status))throw Error('Progreso de módulo no válido.');if(!entityModules(a,ref).some(m=>m.id===moduleId))throw Error('El módulo ya no existe en este objeto.');return {...p,modules:{...p.modules,[moduleKey(ref,moduleId)]:status}};}
/** Shared ordered consequences for physical interactions and narrative events. */
export function applyStoryEffects(a:Adventure,p:StoryProgress,i:InventoryProgress,effects:import('./types').StoryEffect[]){
 let progress=structuredClone(p);const inventory=structuredClone(i);
 for(const effect of effects){if(effect.kind==='state')progress=setObjectState(a,progress,effect,effect.stateId);else{const item=a.items?.find(item=>item.id===effect.itemId);if(!item)throw Error('El artículo de la consecuencia ya no existe.');const count=inventory.counts[item.id]??0;if(effect.kind==='consume'&&count<effect.quantity)throw Error('Necesitas '+effect.quantity+' × '+item.name+' para esta acción.');const next=effect.kind==='consume'?count-effect.quantity:item.stackable?count+effect.quantity:1;if(!Number.isSafeInteger(next))throw Error('Cantidad de inventario fuera de rango.');inventory.counts[item.id]=next;}}
 return {progress,inventory};
}
/** Conditions use the event's incoming snapshot; effects remain ordered and atomic. */
export function react(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef,event:StoryEvent,moduleId?:string){
 let progress=structuredClone(p);const inventory=structuredClone(i),messages:string[]=[];
 for(const r of behavior(a,ref)?.reactions??[]){const key=reactionKey(ref,r.id);if(r.event!==event||(event!=='interact'&&r.moduleId!==moduleId)||(r.once&&progress.fired.includes(key))||!allows(a,p,i,r.when))continue;
  const applied=applyStoryEffects(a,progress,inventory,r.effects);progress=applied.progress;Object.assign(inventory,applied.inventory);
  if(r.once)progress.fired.push(key);messages.push('Reacción '+((behavior(a,ref)?.reactions.indexOf(r)??0)+1)+' de '+(a.maps.find(m=>m.id===ref.mapId)?.entities.find(e=>e.id===ref.entityId)?.label??ref.entityId)+' · '+eventLabels[event]);
 }
 return {progress,inventory,messages};
}
/** Restore only references still present in this adventure; malformed/obsolete progress cannot unlock rules. */
export function restoreStory(a:Adventure,raw:unknown):StoryProgress{const p=emptyStory(),value=raw as Partial<StoryProgress>|null;if(!value||typeof value!=='object')return p;for(const m of a.maps)for(const e of m.entities){const ref={mapId:m.id,entityId:e.id},key=entityKey(ref),s=value.states?.[key];if(behavior(a,ref)?.states.some(v=>v.id===s))p.states[key]=s!;for(const mod of entityModules(a,ref)){const k=moduleKey(ref,mod.id),v=value.modules?.[k];if(v&&['not-started','started','completed','failed'].includes(v))p.modules[k]=v;}for(const r of behavior(a,ref)?.reactions??[]){const k=reactionKey(ref,r.id);if(Array.isArray(value.fired)&&value.fired.includes(k))p.fired.push(k);}}return restoreNarratives(a,value,p);}
export function replaceBehavior(a:Adventure,b:EntityBehavior):Adventure{return {...a,story:{version:1,...a.story,entities:[...(a.story?.entities??[]).filter(e=>entityKey(e)!==entityKey(b)),b]}};}
