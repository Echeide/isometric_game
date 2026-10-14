import {expect,it} from 'vitest';
import {contextSlides,editableContextSlides,advanceContextSlide,validateContext} from '../src/lib/modules/context-slides';
import {contentModuleReady,validateContentModules,reorderContentModule} from '../src/lib/modules/content';
import type {ContextModule} from '../src/lib/modules/types';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {publicAdventure} from '../src/lib/server/platform/publication-state';
import {translationFields} from '../src/lib/i18n/translation-catalogue';
import {localizeModule,textKey} from '../src/lib/i18n/adventure';
const legacy:ContextModule={id:'intro',type:'context',title:'Llegada',text:'Llegas a la plaza.'};
const presentation:ContextModule={...legacy,slides:[{id:'arrival',image:'/covers/adventure-default.svg',text:'La plaza está vacía.'},{id:'clue',title:'Una pista',text:'Busca al encargado.'}]};
it('reopens previously applied slides from reactive proxies without losing content or mutating the saved draft',()=>{
 const original=structuredClone(presentation),slides=new Proxy(original.slides!.map(slide=>new Proxy(slide,{})),{}),reactive=new Proxy({...original,slides},{});
 expect(()=>structuredClone(slides)).toThrow();
 const draft=editableContextSlides(reactive);expect(draft).toEqual(presentation.slides);
 draft[0].text='Texto editado';draft.reverse();expect(original.slides).toEqual(presentation.slides);
 const applied={...legacy,slides:draft},reopened=editableContextSlides(new Proxy(applied,{}));expect(reopened).toEqual(draft);expect(reopened[0]).not.toBe(draft[0]);
});
it('keeps old contexts playable as a single slide without changing saved data',()=>{
 const before=structuredClone(legacy);expect(contextSlides(legacy)).toEqual([{id:'legacy',title:'Llegada',text:'Llegas a la plaza.'}]);expect(contentModuleReady(legacy)).toBe(true);validateContentModules([legacy]);expect(legacy).toEqual(before);
});
it('allows optional slide images and titles but requires text on every slide before playback',()=>{
 validateContentModules([presentation]);expect(contentModuleReady(presentation)).toBe(true);
 const draft={...presentation,slides:[{id:'empty',text:''}]};validateContentModules([draft]);expect(contentModuleReady(draft)).toBe(false);
});
it('rejects invalid slide counts, duplicate IDs, unsafe images and oversized texts',()=>{
 for(const slides of [[],Array.from({length:33},(_,i)=>({id:String(i),text:'x'})),[{id:'same',text:'x'},{id:'same',text:'y'}],[{id:'one',text:'x',image:'javascript:alert(1)'}],[{id:'one',text:'x',image:'data:audio/wav;base64,AAAA'}],[{id:'one',text:'x'.repeat(12001)}],[{id:'one',text:'x',title:'x'.repeat(121)}]])expect(()=>validateContext({...legacy,slides})).toThrow();
});
it('does not complete a presentation before advancing from the last slide',()=>{
 expect(advanceContextSlide(0,3)).toEqual({index:1,completed:false});expect(advanceContextSlide(1,3)).toEqual({index:2,completed:false});expect(advanceContextSlide(2,3)).toEqual({index:2,completed:true});expect(advanceContextSlide(0,1).completed).toBe(true);
});
it('round-trips slides in adventures/public snapshots and keeps translations linked to slide IDs',()=>{
 const a=createAdventure([parseScene({schemaVersion:1,id:'plaza',name:'Plaza',theme:'outdoors',width:4,height:4,spawn:{x:0,y:0},entities:[]})]);
 a.story={version:1,entities:[],events:[{id:'opening',name:'Inicio',trigger:'adventure.start',enabled:true,once:true,modules:[presentation],effects:[]}]};
 expect(parseAdventure(JSON.parse(JSON.stringify(a))).story?.events?.[0].modules[0]).toEqual(presentation);expect(publicAdventure(a).story?.events?.[0].modules[0]).toEqual(presentation);
 const key=textKey('module','event','opening','intro','slide','clue','text');
 expect(translationFields(a).find(field=>field.key===key)?.source).toBe('Busca al encargado.');
 a.localization={defaultLocale:'es',locales:['es','en'],translations:{en:{[key]:{source:'Busca al encargado.',value:'Find the caretaker.'}}}};
 const translated=localizeModule(a,presentation,'en',['event','opening']) as ContextModule;expect(translated.slides?.[1].text).toBe('Find the caretaker.');
 const reordered={...presentation,slides:[...presentation.slides!].reverse()};expect((localizeModule(a,reordered,'en',['event','opening']) as ContextModule).slides?.[0].text).toBe('Find the caretaker.');
 expect(reorderContentModule([presentation,legacy],0,1)[1]).toEqual(presentation);
});
