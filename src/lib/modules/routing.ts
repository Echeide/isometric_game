import {getHintsPenaltyPercent,DEFAULT_HINT_PENALTY_STEP_PERCENT} from './routingtales/shared/moduleHints.js';
import type {ModuleStatus} from '../story/types';
export type LocalizedText=string|Record<string,string>;
export const answerModes=['TEXT','LETTER_SLOTS','NUMERIC_DIAL','LETTER_DIAL','LETTER_ORDER'] as const;
export const imageModes=['NONE','TORCH','MAGNIFIER','XRAY','SCRATCH','SLIDER'] as const;
export type RoutingType='info'|'video'|'question';
export interface ModulePoints {win:number;fail:number;failurePenaltyPercent?:number;context?:{win?:string;fail?:string}}
export interface ModuleHint {id:string;text:LocalizedText;penaltyPercent:number}
export interface InfoBlock {id:string;type:'text'|'image';value:string;caption?:string}
export interface RoutingContent extends Record<string,unknown>{body:LocalizedText;title?:LocalizedText;image?:string;audio?:LocalizedText;mediaUrl?:LocalizedText;videoUrl?:LocalizedText;answer?:LocalizedText;answerMode?:typeof answerModes[number];slotLength?:number|null;answerAlphabet?:string[];answerLetters?:string[];hints?:ModuleHint[];maxAttempts?:number;imageInteractionMode?:typeof imageModes[number];xrayImage?:string;imageAspectRatio?:string;torchRadius?:number;magnifierZoom?:number;magnifierRadius?:number;xrayRadius?:number;scratchRadius?:number;requiredWatchPercent?:number;blocks?:InfoBlock[]}
export interface RoutingContentModule {id:string;type:RoutingType;title:string;content:RoutingContent;points:ModulePoints}
export interface ModuleAttempt {version:1;failures:number;hintsUsed:string[];status:ModuleStatus;answer?:string;watchPercent?:number;mediaTime?:number}
export interface ModuleResult {status:'completed'|'failed';points:number;failures:number;hintsUsed:string[];answer?:string}
export function localized(value:LocalizedText|undefined,lang='es'){if(typeof value==='string')return value;return value?.[lang]||value?.es||Object.values(value??{}).find(v=>v.trim())||'';}
export function localizedValues(value:LocalizedText|undefined){return typeof value==='string'?[value]:Object.values(value??{});}
export function isMediaUrl(value:string){if(!value)return true;if(/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value))return true;if(/^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|mp3|wav|ogg|mp4|aac|webm)|video\/(mp4|webm));base64,[A-Za-z0-9+/=]+$/.test(value))return value.length<=6_000_000;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export function routingModuleReady(m:RoutingContentModule){const c=m.content;return m.type==='video'?!!localized(c.videoUrl||c.mediaUrl):m.type==='question'?!!localized(c.body).replace(/<[^>]*>/g,'').trim()&&localizedValues(c.answer).some(v=>v.split('|').some(a=>a.trim())):!!(localized(c.body).replace(/<[^>]*>/g,'').trim()||c.image||localized(c.audio)||localized(c.mediaUrl)||c.blocks?.some(b=>b.value.trim()));}
function catchBadKeys(value:unknown,depth=0):boolean{if(depth>20)return true;if(!value||typeof value!=='object')return false;return Object.entries(value).some(([key,v])=>['__proto__','constructor','prototype'].includes(key)||catchBadKeys(v,depth+1));}
export function validateRoutingModule(m:RoutingContentModule){
 const fail=(message:string):never=>{throw Error(message);};
 const text=(value:unknown,label:string,max=24000)=>{if(typeof value!=='string'||value.length>max)fail(label+' no válido.');};
 const loc=(value:unknown,label:string,media=false)=>{if(value===undefined)return;const values=typeof value==='string'?[value]:value&&typeof value==='object'&&!Array.isArray(value)?Object.entries(value).map(([lang,v])=>{if(!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang))fail('Idioma no válido.');return v;}):fail(label+' no válido.');if(values.length>16)fail('Demasiados idiomas.');for(const v of values){text(v,label,media?6_000_000:24000);if(media&&!isMediaUrl(v as string))fail('URL multimedia no válida.');}};
 if(catchBadKeys(m))fail('El módulo contiene una propiedad no admitida.');
 text(m.title,'Título',120);if(!m.title.trim())fail('Escribe un título para el módulo.');const c=m.content;if(!c||typeof c!=='object'||Array.isArray(c))fail('Contenido de módulo no válido.');
 for(const key of ['body','title','answer','correct_answer'] as const)loc(c[key],key);
 for(const key of ['mediaUrl','audio','audioUrl','videoUrl'] as const)loc(c[key],key,true);
 for(const key of ['image','xrayImage'] as const)if(c[key]!==undefined){text(c[key],key,6_000_000);if(!isMediaUrl(c[key]!))fail('URL de imagen no válida.');}
 if(c.answerMode!==undefined&&!answerModes.includes(c.answerMode))fail('Modo de respuesta no válido.');if(c.imageInteractionMode!==undefined&&!imageModes.includes(c.imageInteractionMode))fail('Efecto de imagen no válido.');
 if(c.imageAspectRatio!==undefined&&!/^\d+(?:\.\d+)?\s*[:/]\s*\d+(?:\.\d+)?$/.test(c.imageAspectRatio))fail('Proporción de imagen no válida.');
 for(const [key,min,max] of [['slotLength',1,40],['maxAttempts',0,100],['requiredWatchPercent',1,100],['torchRadius',40,320],['magnifierZoom',1.2,4],['magnifierRadius',60,240],['xrayRadius',60,260],['scratchRadius',20,120]] as const){const v=c[key];if(v!==undefined&&v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max))fail('Ajuste '+key+' fuera de rango.');}
 for(const key of ['answerAlphabet','answerLetters'] as const)if(c[key]!==undefined&&(!Array.isArray(c[key])||c[key]!.length>80||c[key]!.some(v=>typeof v!=='string'||!v||v.length>8)))fail('Letras de respuesta no válidas.');
 const seen=new Set<string>();if(c.hints!==undefined){if(!Array.isArray(c.hints)||c.hints.length>16)fail('Lista de pistas no válida.');for(const h of c.hints){if(!h||typeof h.id!=='string'||!/^[-\w]{1,80}$/.test(h.id)||seen.has(h.id))fail('Identificador de pista no válido.');seen.add(h.id);loc(h.text,'Pista');if(!Number.isFinite(h.penaltyPercent)||h.penaltyPercent<0||h.penaltyPercent>40)fail('Penalización de pista no válida.');}}
 if(c.blocks!==undefined){if(!Array.isArray(c.blocks)||c.blocks.length>64)fail('Bloques de información no válidos.');const ids=new Set<string>();for(const b of c.blocks){if(!b||!['text','image'].includes(b.type)||typeof b.id!=='string'||ids.has(b.id))fail('Bloque repetido o no válido.');ids.add(b.id);text(b.value,'Bloque',b.type==='image'?6_000_000:24000);if(b.type==='image'&&!isMediaUrl(b.value))fail('Imagen del bloque no válida.');if(b.caption!==undefined)text(b.caption,'Pie de imagen',500);}}
 if(c.maxAttempts!==undefined&&!Number.isSafeInteger(c.maxAttempts))fail('Número de intentos no válido.');if(c.slotLength!==undefined&&c.slotLength!==null&&!Number.isSafeInteger(c.slotLength))fail('Número de posiciones no válido.');if(c.backgroundAudio!==undefined&&typeof c.backgroundAudio!=='boolean')fail('Ajuste de audio no válido.');
 const p=m.points;if(!p||!['win','fail'].every(k=>Number.isSafeInteger(p[k as 'win'|'fail'])&&p[k as 'win'|'fail']>=0&&p[k as 'win'|'fail']<=999999))fail('Puntuación no válida.');if(p.failurePenaltyPercent!==undefined&&(!Number.isFinite(p.failurePenaltyPercent)||p.failurePenaltyPercent<0||p.failurePenaltyPercent>40))fail('Penalización no válida.');for(const v of Object.values(p.context??{}))text(v,'Mensaje de resultado',2000);
 if(JSON.stringify(m).length>9_000_000)fail('El contenido del módulo supera el límite de 9 MB.');
}
/** Answer validation adapted from RoutingTales server/moduleValidator.ts. */
export function validateQuestionAnswer(m:RoutingContentModule,raw:string){const mode=m.content.answerMode??'TEXT',normalize=(v:string)=>{let s=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();if(['LETTER_SLOTS','LETTER_DIAL','LETTER_ORDER'].includes(mode))s=s.replace(/[^a-z0-9]/g,'');if(mode==='NUMERIC_DIAL')s=s.replace(/\D/g,'');return s;};let value=raw;try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object')value=String(parsed.answer??parsed.value??raw);}catch{}const answer=normalize(value);return !!answer&&localizedValues((m.content.correct_answer as LocalizedText|undefined)||m.content.answer).flatMap(v=>v.split('|')).map(normalize).filter(Boolean).includes(answer);}
export function resultPoints(m:RoutingContentModule,result:Pick<ModuleResult,'status'|'failures'|'hintsUsed'>){if(result.status==='failed')return m.points.fail;const hintPenalty=getHintsPenaltyPercent(m.content,result.hintsUsed),penalty=Math.min(40,hintPenalty+result.failures*(m.points.failurePenaltyPercent??DEFAULT_HINT_PENALTY_STEP_PERCENT*2));return Math.round(m.points.win*(1-penalty/100));}
export function emptyAttempt():ModuleAttempt{return {version:1,failures:0,hintsUsed:[],status:'not-started'};}
export function readAttempt(storage:Pick<Storage,'getItem'>,key:string,m:RoutingContentModule){try{const raw=JSON.parse(storage.getItem(key)??'null');if(raw?.version!==1||!['not-started','started','completed','failed'].includes(raw.status)||!Number.isSafeInteger(raw.failures)||raw.failures<0||raw.failures>100000)return emptyAttempt();return {...emptyAttempt(),...raw,hintsUsed:Array.isArray(raw.hintsUsed)?raw.hintsUsed.filter((id:unknown)=>typeof id==='string'&&m.content.hints?.some(h=>h.id===id)):[]};}catch{return emptyAttempt();}}

/** Restart pending content without erasing attempts, hint penalties or finished results. */
export function openingAttempt(storage:Pick<Storage,'getItem'>,key:string,m:RoutingContentModule){
 const saved=readAttempt(storage,key,m);
 return saved.status==='completed'||saved.status==='failed'?saved:{...emptyAttempt(),failures:saved.failures,hintsUsed:saved.hintsUsed};
}
