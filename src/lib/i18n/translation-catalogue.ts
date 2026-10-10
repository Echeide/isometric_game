import type {Adventure} from '../demo/adventure';
import type {ContentModule} from '../modules/types';
import {objectContentModules} from '../modules/adventure-modules';
import {adventureLanguages,textKey,validateLocalization} from './adventure';
import {isMediaUrl,type LocalizedText} from '../modules/routing';
export type TranslationCategory='adventure'|'maps'|'objects'|'items'|'events'|'modules'|'chats';
export interface TranslationField{key:string;path:string[];source:string;label:string;context:string;category:TranslationCategory;kind:'text'|'rich'|'media';native?:Record<string,string>}
export type TranslationStatus='missing'|'translated'|'outdated';
export function translationFields(a:Adventure):TranslationField[]{
 const fields:TranslationField[]=[],base=a.localization?.defaultLocale??'es';
 function add(path:string[],value:LocalizedText|undefined,label:string,context:string,category:TranslationCategory,kind:TranslationField['kind']='text'){
  const source=typeof value==='string'?value:value?.[base]??'';if(!source.trim()||kind==='media'&&source.length>200000)return;
  fields.push({key:textKey(...path),path,source,label,context,category,kind,...(typeof value==='object'?{native:value}:{})});
 }
 const moduleFields=(modules:ContentModule[],association:string[],context:string)=>{for(const m of modules){const path=['module',...association,m.id],where=context+' · '+('title'in m?m.title:m.type);if('title'in m)add([...path,'title'],m.title,'Nombre del módulo',where,'modules');if(m.type==='context')add([...path,'text'],m.text,'Texto del contexto',where,'modules');else if(m.type!=='chat'){
  for(const [field,label,kind]of [['title','Título','text'],['body','Contenido','rich'],['answer','Respuestas correctas','text'],['correct_answer','Respuestas correctas','text'],['audio','Audio','media'],['videoUrl','Vídeo','media'],['mediaUrl','Multimedia de apoyo','media'],['image','Imagen','media'],['xrayImage','Segunda imagen','media']]as const){if(field==='correct_answer'&&m.content.answer!==undefined)continue;add([...path,'content',field],m.content[field] as LocalizedText|undefined,label,where,'modules',kind);}
  for(const hint of m.content.hints??[])add([...path,'hint',hint.id],hint.text,'Pista',where,'modules');
  for(const block of m.content.blocks??[]){add([...path,'block',block.id,'value'],block.value,block.type==='text'?'Contenido':'Imagen',where,'modules',block.type==='text'?'rich':'media');add([...path,'block',block.id,'caption'],block.caption,'Pie de imagen',where,'modules');}
  for(const outcome of ['win','fail']as const)add([...path,'feedback',outcome],m.points.context?.[outcome],outcome==='win'?'Mensaje al completar':'Mensaje al fallar',where,'modules');
 }}};
 add(['adventure','name'],a.name,'Nombre de la aventura',a.name,'adventure');
 add(['adventure','description'],(a as Adventure&{description?:string}).description,'Descripción',a.name,'adventure');
 for(const map of a.maps){add(['map',map.id,'name'],map.name,'Nombre del mapa',map.name,'maps');for(const e of map.entities){const context=map.name+' · '+e.label,path=['entity',map.id,e.id];add([...path,'label'],e.label,'Nombre del objeto',context,'objects');add([...path,'description'],e.description,'Descripción',context,'objects');add([...path,'interaction'],e.interaction?.label,'Acción',context,'objects');const behavior=a.story?.entities.find(b=>b.mapId===map.id&&b.entityId===e.id);add([...path,'blockedMessage'],behavior?.blockedMessage,'Mensaje de bloqueo',context,'objects');for(const state of behavior?.states??[]){add([...path,'state',state.id,'description'],state.description,'Descripción del estado',context+' · '+state.name,'objects');}moduleFields(objectContentModules(a,{mapId:map.id,entityId:e.id}),['object',map.id,e.id],context);}}
 for(const item of a.items??[]){add(['item',item.id,'name'],item.name,'Nombre del artículo',item.name,'items');add(['item',item.id,'description'],item.description,'Descripción',item.name,'items');}
 for(const event of a.story?.events??[]){add(['event',event.id,'name'],event.name,'Nombre del evento',event.name,'events');moduleFields(event.modules,['event',event.id],event.name);}
 for(const chat of a.chats??[]){const resource='chat:'+chat.id;add(['chat',resource,'name'],chat.name,'Nombre de la conversación',chat.name,'chats');for(const node of chat.config.chatNodes){for(const [group,message]of(node.messages??[]).entries()){if(Array.isArray(message))message.forEach((line,index)=>add(['chat',resource,node.id,'message',String(group),String(index)],line,'Mensaje',chat.name+' · '+node.id,'chats'));else add(['chat',resource,node.id,'message',String(group)],message,'Mensaje',chat.name+' · '+node.id,'chats');}node.options?.forEach((option,index)=>add(['chat',resource,node.id,'option',String(index),option.target??(option.home?'home':'none')],option.text,'Opción de respuesta',chat.name+' · '+node.id,'chats'));}}
 return fields;
}
export function translationValue(a:Adventure,locale:string,field:TranslationField){const entry=a.localization?.translations?.[locale]?.[field.key];return entry?entry.value:field.native?.[locale]??'';}
export function translationStatus(a:Adventure,locale:string,field:TranslationField):TranslationStatus{const entry=a.localization?.translations?.[locale]?.[field.key];if(entry&&entry.source!==field.source)return 'outdated';return translationValue(a,locale,field).trim()?'translated':'missing';}
export function translationCoverage(a:Adventure,locale:string,fields=translationFields(a)){const count={total:fields.length,translated:0,missing:0,outdated:0};for(const field of fields)count[translationStatus(a,locale,field)]++;return count;}
/** Only translation metadata changes. Gameplay, base content and progress remain untouched. */
export function writeTranslation(a:Adventure,locale:string,key:string,value:string):Adventure{
 if(!adventureLanguages(a).includes(locale)||locale===(a.localization?.defaultLocale??'es'))throw Error('Selecciona un idioma de traducción distinto del original.');
 const field=translationFields(a).find(f=>f.key===key);if(!field)throw Error('El texto original ya no existe. Actualiza el formulario.');
 if(field.kind==='media'&&value.trim()&&!isMediaUrl(value))throw Error('URL multimedia no válida.');
 const localization=a.localization??{defaultLocale:'es',locales:['es']},catalogue={...localization.translations?.[locale]};
 // A blank overlay explicitly suppresses an old native translation; do not restore it silently.
 catalogue[key]={source:field.source,value};
 const next={...a,localization:{...localization,translations:{...localization.translations,[locale]:catalogue}}};validateLocalization(next.localization);return next;
}
