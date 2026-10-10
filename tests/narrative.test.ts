import {readFileSync} from 'node:fs';
import {graphics} from '../src/lib/demo/pixelart';
import {exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {mapImages} from '../src/lib/storage/local-adventures';
import {describe,it,expect} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {emptyInventory} from '../src/lib/demo/inventory';
import {emptyStory,type NarrativeEvent,type StoryProgress} from '../src/lib/story/types';
import {beginNarrative,advanceNarrative,scheduleNarratives,canBeginNarrative,narrativeStatus,restoreNarratives,setNarrativeStatus,attachNarrativeChat,replaceNarrativeEvent,narrativeChatKey} from '../src/lib/story/narrative';
import {restoreStory,allows,replaceBehavior} from '../src/lib/story/engine';
import {storyUsesItem} from '../src/lib/story/validation';
import {createChat} from '../src/lib/chat/editor';
import {readStory,saveStory} from '../src/lib/story/progress';
import {resetProgress} from '../src/lib/demo/test-progress';
function fixture(){
 const scene=parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[{id:'door',label:'Puerta',kind:'object',visualId:'pixel.bin',position:{x:3,y:3},size:{x:1,y:1},solid:false}]}),a=createAdventure([scene,{...scene,id:'garden',name:'Jardín',entities:[]}]);a.items=[{id:'key',name:'Llave',description:'',stackable:true}];
 a.story={version:1,entities:[{mapId:'room',entityId:'door',states:[{id:'closed',name:'Cerrada',interactive:false},{id:'open',name:'Abierta',interactive:true}],initialState:'closed',reactions:[]}],events:[]};return a;
}
function intro(id='intro',values:Partial<NarrativeEvent>={}):NarrativeEvent{return {id,name:id,trigger:'adventure.start',enabled:true,once:true,modules:[{id:'text',type:'context',title:'Bienvenida',text:'Tu historia comienza aquí.'}],effects:[{kind:'give',itemId:'key',quantity:1}],...values};}
class MemoryStorage{values=new Map<string,string>();get length(){return this.values.size;}key(i:number){return [...this.values.keys()][i]??null;}getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);}removeItem(k:string){this.values.delete(k);}clear(){this.values.clear();}}
describe('narrative event lifecycle',()=>{
 it('keeps narrative content and board positions in the adventure ZIP',async()=>{const a=fixture();a.story!.events=[intro('intro',{effects:[]})];a.story!.layout={node:{x:32,y:64}};const pack=mapImages(graphics,url=>'asset:'+url),blob=await exportAdventure(a,{pack:async()=>pack,blob:async id=>new Blob([readFileSync('static'+id)])});const restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));expect(restored.adventure.story).toEqual(a.story);});
 it('accepts legacy adventures and validated disabled drafts, rejecting malformed triggers, references and content',()=>{
  const a=fixture();expect(()=>parseAdventure(a)).not.toThrow();a.story!.events=[intro()];expect(()=>parseAdventure(a)).not.toThrow();
  for(const value of [intro('bad',{trigger:'map.enter',mapId:'missing'}),intro('bad',{mapId:'room'}),intro('bad',{modules:[] ,effects:[]}),intro('bad',{modules:[{id:'c',type:'chat',resourceId:'chat:missing'}]}),intro('bad',{modules:[{id:'t',type:'context',title:'T',text:''}]}),intro('bad',{effects:[{kind:'state',mapId:'room',entityId:'missing',stateId:'open'}]})])expect(()=>parseAdventure({...a,story:{...a.story!,events:[value]}})).toThrow();
  expect(()=>parseAdventure({...a,story:{...a.story!,events:[intro('draft',{enabled:false,modules:[],effects:[]})]}})).not.toThrow();expect(()=>parseAdventure({...a,story:{...a.story!,events:[intro(),intro()]}})).toThrow('repetido');
 });
 it('schedules startup before entry events and preserves pending intros over a reload',()=>{
  const a=fixture();a.story!.events=[intro('arrival',{trigger:'map.enter',mapId:'room'}),intro('intro'),intro('second')];const first=scheduleNarratives(a,emptyStory(),'room');expect(first.ids).toEqual(['intro','second','arrival']);
  const p=beginNarrative(a,first.progress,emptyInventory(),'intro'),restored=restoreStory(a,JSON.parse(JSON.stringify(p)));expect(scheduleNarratives(a,restored,'room').ids).toEqual(first.ids);expect(beginNarrative(a,restored,emptyInventory(),'intro')).toEqual(restored);
  const done=advanceNarrative(a,p,emptyInventory(),'intro');expect(scheduleNarratives(a,done.progress,'garden').ids).toEqual(['second']);
 });
 it('applies rewards once, preserves incoming state and checks event status requirements',()=>{
  const a=fixture();a.story!.events=[intro()];const p=beginNarrative(a,emptyStory(),emptyInventory(),'intro'),before=JSON.stringify(p),done=advanceNarrative(a,p,emptyInventory(),'intro');expect(done.inventory.counts.key).toBe(1);expect(narrativeStatus(done.progress,'intro')).toBe('completed');expect(JSON.stringify(p)).toBe(before);
  expect(advanceNarrative(a,done.progress,done.inventory,'intro').inventory.counts.key).toBe(1);expect(canBeginNarrative(a,done.progress,done.inventory,a.story!.events[0])).toBe(false);
  expect(allows(a,done.progress,done.inventory,{mode:'all',conditions:[{kind:'event',eventId:'intro',status:'completed'}]})).toBe(true);
  expect(()=>parseAdventure({...a,story:{...a.story!,events:[intro('bad',{when:{mode:'all',conditions:[{kind:'event',eventId:'missing',status:'completed'}]}})]}})).toThrow('Evento narrativo');
 });
 it('runs modules in order, resumes the cursor and commits consequences only after the last module',()=>{
  const a=fixture();a.story!.events=[intro('intro',{modules:[{id:'one',type:'context',title:'Uno',text:'Uno'},{id:'two',type:'context',title:'Dos',text:'Dos'}]})];const started=beginNarrative(a,emptyStory(),emptyInventory(),'intro'),one=advanceNarrative(a,started,emptyInventory(),'intro');expect(one.progress.narrative!.intro.module).toBe(1);expect(one.inventory.counts.key).toBeUndefined();
  const reloaded=restoreStory(a,one.progress);expect(beginNarrative(a,reloaded,one.inventory,'intro').narrative!.intro).toEqual(one.progress.narrative!.intro);expect(advanceNarrative(a,reloaded,one.inventory,'intro').inventory.counts.key).toBe(1);
 });
 it('allows repeatable entry events with a fresh conversation run and keeps once events complete',()=>{
  const a=fixture();a.story!.events=[intro('entry',{trigger:'map.enter',mapId:'room',once:false})];let p=emptyStory(),i=emptyInventory();for(let run=1;run<=3;run++){p=beginNarrative(a,p,i,'entry');expect(p.narrative!.entry.run).toBe(run);const done=advanceNarrative(a,p,i,'entry');p=done.progress;i=done.inventory;}expect(i.counts.key).toBe(3);
  expect(narrativeChatKey(a.id,a.story!.events[0],a.story!.events[0].modules[0],1)).not.toBe(narrativeChatKey(a.id,a.story!.events[0],a.story!.events[0].modules[0],2));
 });
 it('fails without giving rewards and rolls back every consequence when a later consequence fails',()=>{
  const a=fixture();a.story!.events=[intro('atomic',{effects:[{kind:'state',mapId:'room',entityId:'door',stateId:'open'},{kind:'consume',itemId:'key',quantity:1}]})];const p=beginNarrative(a,emptyStory(),emptyInventory(),'atomic'),before=JSON.stringify(p);expect(()=>advanceNarrative(a,p,emptyInventory(),'atomic')).toThrow('Necesitas');expect(JSON.stringify(p)).toBe(before);
  const failed=advanceNarrative(a,p,emptyInventory(),'atomic','failed');expect(failed.progress.narrative!.atomic.status).toBe('failed');expect(failed.progress.states).toEqual({});expect(canBeginNarrative(a,failed.progress,failed.inventory,a.story!.events[0])).toBe(false);
 });
 it('keeps other event order, chat content and narrative data while changing object behavior',()=>{
  const a=fixture();a.story!.events=[intro('first'),intro('second',{modules:[{id:'chat',type:'chat'}],enabled:false})];const changed=replaceNarrativeEvent(a,{...a.story!.events[0],name:'Cambio'});expect(changed.story!.events!.map(e=>e.id)).toEqual(['first','second']);
  const attached=attachNarrativeChat(a,'second','chat',{id:'chat',name:'Prólogo',config:createChat()});expect(attached.story!.events![1].modules[0]).toMatchObject({resourceId:'chat:chat'});expect(()=>parseAdventure(attached)).not.toThrow();
  expect(replaceBehavior(attached,{...attached.story!.entities[0],blockedMessage:'Cerrada'}).story!.events).toEqual(attached.story!.events);
 });
 it('restores only valid event references and keeps test status changes separate from consequences',()=>{
  const a=fixture();a.story!.events=[intro()];const simulated=setNarrativeStatus(a,emptyStory(),'intro','completed');expect(simulated.states).toEqual({});expect(simulated.narrative!.intro.run).toBe(0);
  const raw={...simulated,narrative:{intro:{status:'completed',module:999,run:-2},missing:{status:'started',module:0,run:1}},narrativePending:['missing','intro','intro']} as unknown as StoryProgress;
  expect(restoreStory(a,raw).narrative).toBeUndefined();expect(restoreStory(a,raw).narrativePending).toEqual(['intro']);expect(storyUsesItem(a,'key')).toBe(true);
 });
 it('does not repeat a completed event when modules are shortened or reordered',()=>{
  const a=fixture();a.story!.events=[intro()];const completed={...emptyStory(),narrative:{intro:{status:'completed' as const,module:8,run:1,moduleId:'removed'}}};const restored=restoreStory(a,completed);expect(restored.narrative!.intro.status).toBe('completed');expect(canBeginNarrative(a,restored,emptyInventory(),a.story!.events[0])).toBe(false);
  a.story!.events[0].modules=[{id:'two',type:'context',title:'Dos',text:'Dos'},{id:'one',type:'context',title:'Uno',text:'Uno'}];const started={...emptyStory(),narrative:{intro:{status:'started' as const,module:0,run:2,moduleId:'one'}}};expect(restoreStory(a,started).narrative!.intro.module).toBe(1);
 });
 it('round-trips event progress and resets only this adventure’s runtime records',()=>{
  const a=fixture();a.story!.events=[intro()];const storage=new MemoryStorage(),p=beginNarrative(a,scheduleNarratives(a,emptyStory(),'room').progress,emptyInventory(),'intro');saveStory(storage,a.id,p,emptyInventory());storage.setItem(narrativeChatKey(a.id,a.story!.events[0],a.story!.events[0].modules[0],1),'success');storage.setItem('unrelated','keep');
  expect(readStory(storage,a).narrative).toEqual(p.narrative);resetProgress(storage as Storage,a.id);expect(readStory(storage,a).narrative).toBeUndefined();expect(storage.getItem(narrativeChatKey(a.id,a.story!.events[0],a.story!.events[0].modules[0],1))).toBeNull();expect(storage.getItem('unrelated')).toBe('keep');
 });
});
