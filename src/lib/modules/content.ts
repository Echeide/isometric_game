import {localized,routingModuleReady,validateRoutingModule} from './routing';
import type {AdventureChat} from '../chat/editor';
import {chatResource,embeddedChat} from '../chat/editor';
import {chatProgressKey} from '../chat/routingtales';
import {contentModuleTypes,type ContentModule,type ContentModuleType,type ModuleHost} from './types';
export const MAX_CONTENT_MODULES=16;
export function createContentModule(type:ContentModuleType,id:string=crypto.randomUUID()):ContentModule{if(type==='context')return {id,type,title:'Contexto',text:''};if(type==='chat')return {id,type};return {id,type,title:contentModuleTypes.find(t=>t.id===type)!.label,content:{body:{es:''},...(type==='question'?{answer:{es:''},answerMode:'TEXT',hints:[],maxAttempts:0}:{}),...(type==='video'?{videoUrl:{es:''},requiredWatchPercent:80}:{})},points:{win:0,fail:0}};}
export function contentModuleName(module:ContentModule,chats:AdventureChat[]=[],fallback='Conversación'){return module.type==='chat'?chats.find(c=>chatResource(c.id)===module.resourceId)?.name??fallback:module.title;}
export function contentModuleReady(module:ContentModule,chats:AdventureChat[]=[],fallback='Conversación'){if(module.type==='context')return !!module.title.trim()&&!!module.text.trim();if(module.type!=='chat')return routingModuleReady(module);return !!module.resourceId&&(module.resourceId.startsWith('chat:')?chats.some(c=>chatResource(c.id)===module.resourceId):true);}
export function validateContentModules(value:unknown,chats:AdventureChat[]=[],allowExternal=false):asserts value is ContentModule[]{
 if(!Array.isArray(value)||value.length>MAX_CONTENT_MODULES)throw Error('La lista admite hasta 16 módulos.');
 const ids=new Set<string>();
 for(const m of value){
  if(!m||typeof m.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(m.id)||ids.has(m.id))throw Error('Los módulos necesitan identificadores únicos y válidos.');ids.add(m.id);
  if(!contentModuleTypes.some(t=>t.id===m.type))throw Error('Tipo de módulo no válido.');
  if(m.type==='context'){if(typeof m.title!=='string'||!m.title.trim()||m.title.length>120||typeof m.text!=='string'||m.text.length>12000)throw Error('Título o texto de contexto no válido.');}
  else if(m.type!=='chat')validateRoutingModule(m);
  else if(m.resourceId!==undefined){if(typeof m.resourceId!=='string'||!m.resourceId.trim()||m.resourceId.length>2000)throw Error('Conversación no válida.');if(m.resourceId.startsWith('chat:'))embeddedChat(chats,m.resourceId);else if(!allowExternal)throw Error('Selecciona una conversación de la aventura.');}
 }
}
export function reorderContentModule(modules:ContentModule[],from:number,to:number){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=modules.length||to>=modules.length)throw Error('La posición del módulo no es válida.');const next=[...modules],module=next.splice(from,1)[0];next.splice(to,0,module);return next;}
/** Keep the historical chat key; additional object modules get their own association key. */
export function contentProgressKey(adventureId:string,host:ModuleHost,module:ContentModule,run=0){
 if(host.kind==='object'&&module.id==='chat'&&module.type==='chat')return chatProgressKey(adventureId,host.mapId,host.entityId,module.resourceId??'');
 return 'isometrico.chat.v1:'+JSON.stringify(host.kind==='object'?[adventureId,'object-module',host.mapId,host.entityId,module.id]:[adventureId,'narrative',host.eventId,module.id,run]);
}
