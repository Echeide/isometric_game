import type {Adventure} from '../demo/adventure';
import type {InventoryProgress} from '../demo/inventory';
import {allows,applyStoryEffects} from './engine';
import {chatResource,type AdventureChat} from '../chat/editor';
import {moduleStatuses,type NarrativeEvent,type NarrativeModule,type NarrativeRun,type StoryProgress,type ModuleStatus} from './types';
export const narrativeTriggerLabels={'adventure.start':'Al iniciar la aventura','map.enter':'Al entrar en un mapa'};
export const narrativeModuleLabels={context:'Contexto',chat:'Conversación'};
export function narrativeEvent(a:Adventure,id:string){return a.story?.events?.find(event=>event.id===id);}
export function narrativeStatus(p:StoryProgress,id:string):ModuleStatus{return p.narrative?.[id]?.status??'not-started';}
export function narrativeReady(a:Adventure,event:NarrativeEvent){return (event.modules.length>0||event.effects.length>0)&&event.modules.every(module=>module.type==='context'?!!module.text.trim():!!a.chats?.some(chat=>chatResource(chat.id)===module.resourceId));}
export function createNarrativeEvent(mapId:string,makeId:()=>string=()=>crypto.randomUUID()):NarrativeEvent{return {id:makeId(),name:'Nuevo evento',trigger:'map.enter',mapId,enabled:false,once:true,modules:[],effects:[]};}
/** Only actual entry boundaries schedule events; object redraws never do. */
export function scheduleNarratives(a:Adventure,p:StoryProgress,mapId:string){
 const events=a.story?.events??[],pending=p.narrativeStarted?(p.narrativePending??[]):events.filter(e=>e.trigger==='adventure.start').map(e=>e.id);
 const ids=[...pending,...events.filter(e=>e.trigger==='map.enter'&&e.mapId===mapId).map(e=>e.id)];
 return {ids,progress:events.length&&!p.narrativeStarted?{...p,narrativeStarted:true,narrativePending:pending}:p};
}
export function canBeginNarrative(a:Adventure,p:StoryProgress,i:InventoryProgress,event:NarrativeEvent){const status=narrativeStatus(p,event.id);if(event.trigger==='adventure.start'&&p.narrativeStarted&&!p.narrativePending?.includes(event.id)&&status!=='started')return false;return event.enabled&&narrativeReady(a,event)&&!(event.once&&(status==='completed'||status==='failed'))&&allows(a,p,i,event.when);}
export function beginNarrative(a:Adventure,p:StoryProgress,i:InventoryProgress,id:string){
 const event=narrativeEvent(a,id);if(!event||!canBeginNarrative(a,p,i,event))throw Error('El evento está desactivado, incompleto o no cumple sus requisitos.');
 const old=p.narrative?.[id];if(old?.status==='started')return p;
 const run=(old?.run??0)+1;if(!Number.isSafeInteger(run))throw Error('Progreso del evento fuera de rango.');
 return {...p,narrative:{...p.narrative,[id]:{status:'started' as const,module:0,run,moduleId:event.modules[0]?.id}}};
}
/** A terminal module completes the event; effects apply atomically, once per run. */
export function advanceNarrative(a:Adventure,p:StoryProgress,i:InventoryProgress,id:string,outcome:'completed'|'failed'='completed'){
 const event=narrativeEvent(a,id),current=p.narrative?.[id];if(!event||!current||current.status!=='started')return {progress:p,inventory:i,messages:[] as string[]};
 if(outcome==='completed'&&current.module<event.modules.length-1)return {progress:{...p,narrative:{...p.narrative,[id]:{...current,module:current.module+1,moduleId:event.modules[current.module+1]?.id}}},inventory:i,messages:[] as string[]};
 const applied=outcome==='completed'?applyStoryEffects(a,p,i,event.effects):{progress:p,inventory:i};
 return {progress:{...applied.progress,narrativePending:(applied.progress.narrativePending??[]).filter(value=>value!==id),narrative:{...applied.progress.narrative,[id]:{...current,status:outcome}}},inventory:applied.inventory,messages:[`Evento ${event.name} · ${outcome==='completed'?'completado':'fallado'}`]};
}
export function setNarrativeStatus(a:Adventure,p:StoryProgress,id:string,status:ModuleStatus){if(!narrativeEvent(a,id)||!moduleStatuses.includes(status))throw Error('Evento o progreso no válido.');const prior=p.narrative?.[id],event=narrativeEvent(a,id)!;return {...p,...(status==='completed'||status==='failed'?{narrativePending:(p.narrativePending??[]).filter(value=>value!==id)}:{}),narrative:{...p.narrative,[id]:{status,module:0,run:prior?.run??0,moduleId:event.modules[0]?.id}}};}
export function restoreNarratives(a:Adventure,raw:Partial<StoryProgress>,p:StoryProgress){
 if(raw.narrativeStarted===true)p.narrativeStarted=true;
 if(Array.isArray(raw.narrativePending))p.narrativePending=[...new Set(raw.narrativePending)].filter(id=>a.story?.events?.some(e=>e.id===id&&e.trigger==='adventure.start'));
 if(!raw.narrative||typeof raw.narrative!=='object'||Array.isArray(raw.narrative))return p;
 for(const event of a.story?.events??[]){const value=raw.narrative[event.id] as NarrativeRun|undefined;if(value&&moduleStatuses.includes(value.status)&&Number.isSafeInteger(value.run)&&value.run>=0&&Number.isInteger(value.module)&&value.module>=0){const index=typeof value.moduleId==='string'?event.modules.findIndex(module=>module.id===value.moduleId):-1,module=index>=0?index:Math.min(value.module,Math.max(0,event.modules.length-1));p.narrative={...p.narrative,[event.id]:{status:value.status,module,run:value.run,moduleId:event.modules[module]?.id}};}}
 return p;
}
export function attachNarrativeChat(a:Adventure,eventId:string,moduleId:string,chat:AdventureChat):Adventure{
 const event=narrativeEvent(a,eventId);if(!event?.modules.some(m=>m.id===moduleId&&m.type==='chat'))throw Error('El módulo del evento ya no existe.');
 return {...a,chats:[...(a.chats??[]).filter(c=>c.id!==chat.id),chat],story:{...a.story!,events:a.story!.events!.map(e=>e.id!==eventId?e:{...e,modules:e.modules.map(m=>m.id===moduleId?{...m,resourceId:chatResource(chat.id)}:m)})}};
}
export function replaceNarrativeEvent(a:Adventure,event:NarrativeEvent):Adventure{return {...a,story:{version:1,...a.story,entities:a.story?.entities??[],events:a.story?.events?.some(e=>e.id===event.id)?a.story.events.map(e=>e.id===event.id?event:e):[...(a.story?.events??[]),event]}};}
export function narrativeChatKey(adventureId:string,event:NarrativeEvent,module:NarrativeModule,run:number){return 'isometrico.chat.v1:'+JSON.stringify([adventureId,'narrative',event.id,module.id,run]);}
