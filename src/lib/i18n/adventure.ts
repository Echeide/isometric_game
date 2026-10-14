import {isMediaUrl,type LocalizedText} from '../modules/routing';
import type {Adventure} from '../demo/adventure';
import type {ContentModule} from '../modules/types';
import type {WorldScene} from '@isometrico/world';
/** Translation keys use immutable IDs. The source guards against outdated translations. */
export interface AdventureLocalization{defaultLocale:string;locales:string[];translations?:Record<string,Record<string,{source:string;value:string}>>}
export const textKey=(...parts:string[])=>JSON.stringify(parts);
const localePattern=/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
export function validateLocalization(value:unknown):asserts value is AdventureLocalization|undefined{
 if(value===undefined)return;const l=value as AdventureLocalization;
 if(!l||typeof l!=='object'||Array.isArray(l)||typeof l.defaultLocale!=='string'||!localePattern.test(l.defaultLocale)||!Array.isArray(l.locales)||l.locales.length<1||l.locales.length>20||l.locales.some(v=>typeof v!=='string'||!localePattern.test(v))||new Set(l.locales).size!==l.locales.length||!l.locales.includes(l.defaultLocale))throw new Error('Configuración de idiomas de aventura no válida.');
 if(new TextEncoder().encode(JSON.stringify(l)).length>4_000_000)throw new Error('Las traducciones no pueden superar 4 MB.');
 if(l.translations===undefined)return;
 if(!l.translations||typeof l.translations!=='object'||Array.isArray(l.translations)||Object.keys(l.translations).some(lang=>!l.locales.includes(lang)))throw new Error('Idioma de traducción no configurado.');
 for(const texts of Object.values(l.translations)){
  if(!texts||typeof texts!=='object'||Array.isArray(texts)||Object.keys(texts).length>20000)throw new Error('Catálogo de traducciones no válido.');
  for(const [key,text]of Object.entries(texts)){let path:unknown;try{path=JSON.parse(key);}catch{throw new Error('Identificador de traducción no válido.');}if(!Array.isArray(path)||path.length<2||path.length>10||path.some(id=>typeof id!=='string'||!id||id.length>256)||!['adventure','map','entity','item','event','module','chat'].includes(path[0])||!text||typeof text.source!=='string'||typeof text.value!=='string'||text.source.length>200000||text.value.length>200000)throw new Error('Texto de traducción no válido.');if(path[0]==='module'&&['audio','videoUrl','mediaUrl','image','xrayImage'].includes(path[path.length-1])&&text.value.trim()&&!isMediaUrl(text.value))throw new Error('URL multimedia no válida.');}
 }
}
export function adventureLanguages(a:Pick<Adventure,'localization'>){return a.localization?.locales??['es'];}
export function adventureLocale(a:Pick<Adventure,'localization'>,requested?:string|null){const languages=adventureLanguages(a);return requested&&languages.includes(requested)?requested:a.localization?.defaultLocale??'es';}
export function adventureText(a:Pick<Adventure,'localization'>|null,locale:string,ids:string[],source:string):string{
 const entry=a?.localization?.translations?.[locale]?.[textKey(...ids)];return entry&&entry.source===source&&entry.value.trim()?entry.value:source;
}
export function localizeScene(a:Adventure,scene:WorldScene,locale:string,progress?:import('../story/types').StoryProgress):WorldScene{
 const text=(ids:string[],source:string)=>adventureText(a,locale,ids,source);
 return {...scene,name:text(['map',scene.id,'name'],scene.name),entities:scene.entities.map(e=>{const behavior=a.story?.entities.find(b=>b.mapId===scene.id&&b.entityId===e.id),state=behavior?.states.find(s=>s.id===(progress?.states[JSON.stringify([scene.id,e.id])]??behavior.initialState));return {...e,label:text(['entity',scene.id,e.id,'label'],e.label),...(e.description!==undefined?{description:text(state?.description!==undefined?['entity',scene.id,e.id,'state',state.id,'description']:['entity',scene.id,e.id,'description'],e.description)}:{}),...(e.interaction?{interaction:{...e.interaction,label:text(['entity',scene.id,e.id,'interaction'],e.interaction.label)}}:{})};})};
}
export function localizeModule(a:Adventure,module:ContentModule,locale:string,association:string[]):ContentModule{
 const path=['module',...association,module.id],text=(ids:string[],source:string)=>adventureText(a,locale,[...path,...ids],source),base=a.localization?.defaultLocale??'es';
 const title='title'in module?{title:text(['title'],module.title)}:{};
 if(module.type==='context')return {...module,...title,text:text(['text'],module.text),...(module.slides?{slides:module.slides.map(slide=>({...slide,text:text(['slide',slide.id,'text'],slide.text),...(slide.title!==undefined?{title:text(['slide',slide.id,'title'],slide.title)}:{}),...(slide.image!==undefined?{image:text(['slide',slide.id,'image'],slide.image)}:{})}))}:{})};
 if(module.type==='chat')return {...module,...title};
 const localizedField=(ids:string[],field:LocalizedText|undefined):LocalizedText|undefined=>{if(field===undefined)return field;const source=typeof field==='string'?field:field[base]??'',entry=a.localization?.translations?.[locale]?.[textKey(...path,...ids)];if(!entry)return field;return {...(typeof field==='string'?{[base]:field}:field),[locale]:text(ids,source)};};
 const content={...module.content};for(const key of ['title','body','answer','correct_answer','audio','videoUrl','mediaUrl']as const){const value=localizedField(['content',key],content[key] as LocalizedText|undefined);if(value!==undefined)content[key]=value;}
 const answerEntry=a.localization?.translations?.[locale]?.[textKey(...path,'content','answer')];if(answerEntry&&content.correct_answer!==undefined&&!a.localization?.translations?.[locale]?.[textKey(...path,'content','correct_answer')]){const value=content.correct_answer as LocalizedText;content.correct_answer={...(typeof value==='string'?{[base]:value}:value),[locale]:typeof content.answer==='string'?content.answer:content.answer?.[locale]??''};}
 for(const key of ['image','xrayImage']as const)if(content[key]!==undefined)content[key]=text(['content',key],content[key]!);
 if(content.hints)content.hints=content.hints.map(h=>({...h,text:localizedField(['hint',h.id],h.text)!}));
 if(content.blocks)content.blocks=content.blocks.map(b=>({...b,value:text(['block',b.id,'value'],b.value),...(b.caption!==undefined?{caption:text(['block',b.id,'caption'],b.caption)}:{})}));
 const context={...module.points.context};for(const outcome of ['win','fail']as const)if(context[outcome]!==undefined)context[outcome]=text(['feedback',outcome],context[outcome]!);
 return {...module,...title,content,points:{...module.points,...(module.points.context?{context}:{})}};
}
export function localizeChat(a:Adventure|undefined,chat:import('../chat/routingtales').ChatConfig,resource:string,locale:string):import('../chat/routingtales').ChatConfig{
 if(!a)return chat;
 const text=(ids:string[],source:string)=>adventureText(a,locale,['chat',resource,...ids],source);
 return {...chat,chatNodes:chat.chatNodes.map(node=>({...node,messages:node.messages?.map((message,index)=>Array.isArray(message)?message.map((source,line)=>text([node.id,'message',String(index),String(line)],source)):text([node.id,'message',String(index)],message)) as typeof node.messages,options:node.options?.map((option,index)=>({...option,text:text([node.id,'option',String(index),option.target??(option.home?'home':'none')],option.text)}))}))};
}
