import {normalizeModuleHints} from './routingtales/shared/moduleHints.js';
import {localized,validateRoutingModule,type RoutingContentModule,type RoutingContent,type LocalizedText} from './routing';
function localizedText(v:unknown):LocalizedText{return typeof v==='string'?v:v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,string>:'';}
/** Adapt both the current RoutingTales module JSON and its older activity DTOs. */
export function importRoutingModule(value:unknown,id:string):RoutingContentModule{
 const raw=value as Record<string,unknown>;if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('JSON de módulo no válido.');
 const name=String(raw.type??'').toLowerCase(),type=name==='simple-response'?'question':name;
 if(!['info','video','question'].includes(type))throw Error('Selecciona un módulo INFO, VIDEO o QUESTION.');
 if(raw.content&&typeof raw.content==='object'&&typeof raw.title==='string'&&['info','video','question'].includes(String(raw.type))&&'body' in (raw.content as object)){const own={...raw,id} as unknown as RoutingContentModule;validateRoutingModule(own);return own;}
 const c=raw.content&&typeof raw.content==='object'&&!Array.isArray(raw.content)?raw.content as Record<string,unknown>:{...raw};
 const body=c.body??c.content??(typeof raw.content==='string'?raw.content:raw.statement??'');
 const content:RoutingContent={...c,body:localizedText(body)};
 if(type==='info'&&Array.isArray(raw.content))content.blocks=raw.content.map((block,index)=>{const b=block as Record<string,string>;return {id:'block-'+index,type:b.image?'image':'text',value:b.image||b.text||''};});
 if(type==='question'){content.answer=localizedText(c.answer??c.correct_answer??raw.answer??(Array.isArray(raw.evaluation)?raw.evaluation.map((e:Record<string,unknown>)=>e.value??'').join('|'):''));content.answerMode=(c.answerMode??'TEXT') as RoutingContent['answerMode'];content.hints=normalizeModuleHints(c);}
 if(type==='video')content.videoUrl=localizedText(c.videoUrl??c.mediaUrl??raw.src??'');
 const basePoints=(typeof raw.points==='number'||typeof raw.points==='string')&&Number.isFinite(Number(raw.points))?Number(raw.points):0,old=raw.points&&typeof raw.points==='object'?raw.points as Record<string,unknown>:{};
 const title=localized(localizedText(c.title??raw.title))||String(raw.name??(type==='question'?'Pregunta':type==='video'?'Vídeo':'Información'));
 const module:RoutingContentModule={id,type:type as RoutingContentModule['type'],title,content,points:{win:Number(old.win??raw.successPoints??basePoints),fail:Number(old.fail??raw.failPoints??0),failurePenaltyPercent:Number(old.failurePenaltyPercent??c.failurePenaltyPercent??10),context:old.context as RoutingContentModule['points']['context']}};
 validateRoutingModule(module);return module;
}
export function exportRoutingModule(module:RoutingContentModule){const {body,...fields}=module.content;return {id:module.id,type:module.type.toUpperCase(),title:module.title,points:module.points,content:{...fields,title:fields.title??{es:module.title},content:body}};}
