import type {Adventure} from '../demo/adventure';
import type {EntityRef} from '../story/types';
import type {ContentModule,ModuleHost} from './types';
import {behavior,replaceBehavior} from '../story/engine';
import {contentModuleName,contentModuleReady,validateContentModules} from './content';
import {reconcileSequence} from './sequence';
import {chatResource,type AdventureChat} from '../chat/editor';
/** Lazy compatibility: preserve the legacy association ID `chat`, conditions and storage. */
export function objectContentModules(a:Adventure,ref:EntityRef):ContentModule[]{
 const authored=behavior(a,ref)?.modules;if(authored!==undefined)return authored;
 const e=a.maps.find(m=>m.id===ref.mapId)?.entities.find(e=>e.id===ref.entityId);
 return e?.interaction?.action==='chat.open'?[{id:'chat',type:'chat',resourceId:e.interaction.resourceId}]:[];
}
export function modulesForHost(a:Adventure,host:ModuleHost){return host.kind==='event'?a.story?.events?.find(e=>e.id===host.eventId)?.modules??[]:objectContentModules(a,host);}
export function replaceHostModules(a:Adventure,host:ModuleHost,modules:ContentModule[]):Adventure{
 validateContentModules(modules,a.chats,host.kind==='object');
 if(host.kind==='event'){
  const event=a.story?.events?.find(e=>e.id===host.eventId);if(!event)throw Error('El evento ya no existe.');
  return {...a,story:{...a.story!,events:a.story!.events!.map(e=>e.id!==event.id?e:{...e,modules,enabled:e.enabled&&(modules.length>0||e.effects.length>0)&&modules.every(m=>contentModuleReady(m,a.chats))})}};
 }
 const e=a.maps.find(m=>m.id===host.mapId)?.entities.find(e=>e.id===host.entityId);if(!e)throw Error('El objeto ya no existe.');
 if(e.pickup||a.exits.some(x=>x.fromMap===host.mapId&&x.entityId===host.entityId))throw Error('Una salida o un recogible conserva su acción propia.');
 const next=replaceBehavior(a,{...(behavior(a,host)??{states:[],reactions:[]}),mapId:host.mapId,entityId:host.entityId,modules,...(behavior(a,host)?.moduleSequence?{moduleSequence:reconcileSequence(behavior(a,host)!.moduleSequence!,modules)}:{})});
 return {...next,maps:next.maps.map(m=>m.id!==host.mapId?m:{...m,entities:m.entities.map(e=>e.id!==host.entityId?e:{...e,interaction:modules.length?{label:e.interaction?.action==='chat.open'||e.interaction?.action==='modules.open'?e.interaction.label:'Abrir',action:'modules.open',resourceId:e.id}:e.interaction?.action==='modules.open'||e.interaction?.action==='chat.open'?undefined:e.interaction})})};
}
export function attachModuleChat(a:Adventure,host:ModuleHost,moduleId:string,chat:AdventureChat){const modules=modulesForHost(a,host);if(!modules.some(m=>m.id===moduleId&&m.type==='chat'))throw Error('El módulo ya no existe.');return replaceHostModules({...a,chats:[...(a.chats??[]).filter(c=>c.id!==chat.id),chat]},host,modules.map(m=>m.id===moduleId?{...m,type:'chat',resourceId:chatResource(chat.id)}:m));}
export function chatUseCount(a:Adventure,resourceId:string){return a.maps.reduce((sum,map)=>sum+map.entities.reduce((count,e)=>count+objectContentModules(a,{mapId:map.id,entityId:e.id}).filter(m=>m.type==='chat'&&m.resourceId===resourceId).length,0),0)+(a.story?.events??[]).reduce((sum,event)=>sum+event.modules.filter(m=>m.type==='chat'&&m.resourceId===resourceId).length,0);}
export function objectModuleCards(a:Adventure,ref:EntityRef){return objectContentModules(a,ref).map(m=>({...m,name:contentModuleName(m,a.chats)}));}
