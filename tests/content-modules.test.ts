import {describe,it,expect} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {createChat,chatResource} from '../src/lib/chat/editor';
import {attachChat} from '../src/lib/chat/adventure-chats';
import {objectContentModules,replaceHostModules,attachModuleChat,chatUseCount} from '../src/lib/modules/adventure-modules';
import {contentProgressKey,reorderContentModule,validateContentModules,contentModuleReady} from '../src/lib/modules/content';
import {beginObjectModules,reportObjectModule} from '../src/lib/modules/runtime';
import {emptyStory,moduleKey,type StoryProgress} from '../src/lib/story/types';
import {setModuleStatus,restoreStory,moduleStatus} from '../src/lib/story/engine';
import {collectItem,emptyInventory} from '../src/lib/demo/inventory';
import {readStory} from '../src/lib/story/progress';
import {chatProgressKey} from '../src/lib/chat/routingtales';
import {storyBoard,itemNode,objectNode} from '../src/lib/story/board';
import {storyUsesItem} from '../src/lib/story/validation';
import {narrativeChatKey,beginNarrative,advanceNarrative} from '../src/lib/story/narrative';
import {adventureChanged} from '../src/lib/server/platform/publication-state';
import type {ContentModule} from '../src/lib/modules/types';
const ref={mapId:'room',entityId:'person'},host={kind:'object' as const,...ref};
const context:ContentModule={id:'intro',type:'context',title:'Una pista',text:'Busca la llave.'};
function fixture(){const a=createAdventure([parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:6,height:6,spawn:{x:0,y:0},entities:[{id:'person',label:'Guía',kind:'person',position:{x:2,y:2},interaction:{label:'Hablar',action:'chat.open',resourceId:'lucia'}}]})]);a.chats=[{id:'shared',name:'Guía compartida',config:createChat()}];a.items=[{id:'key',name:'Llave',description:'',stackable:true}];return a;}
function memory(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)};}
describe('shared content modules for objects and events',()=>{
 it('adapts legacy chat without changing its identity, resource, story rules or storage key',()=>{const a=fixture(),legacy=objectContentModules(a,ref)[0];expect(legacy).toEqual({id:'chat',type:'chat',resourceId:'lucia'});expect(contentProgressKey(a.id,host,legacy)).toBe(chatProgressKey(a.id,'room','person','lucia'));const storage=memory();storage.setItem(contentProgressKey(a.id,host,legacy),'success');expect(moduleStatus(readStory(storage,a),ref,'chat')).toBe('completed');const next=parseAdventure(replaceHostModules(a,host,[legacy,context]));expect(moduleStatus(readStory(storage,next),ref,'chat')).toBe('completed');});
 it('keeps the identical payload on either host and preserves authored conditions and module IDs on reorder',()=>{let a=fixture();a.story={version:1,entities:[],events:[{id:'event',name:'Entrada',trigger:'adventure.start',enabled:false,once:true,modules:[],effects:[]}]};a=replaceHostModules(a,host,[context,{id:'chat',type:'chat',resourceId:chatResource('shared')}]);a=replaceHostModules(a,{kind:'event',eventId:'event'},objectContentModules(a,ref));expect(a.story!.events![0].modules).toEqual(objectContentModules(a,ref));expect(()=>parseAdventure(a)).not.toThrow();const p=setModuleStatus(a,emptyStory(),ref,'intro','completed'),next=replaceHostModules(a,host,reorderContentModule(objectContentModules(a,ref),0,1));expect(restoreStory(next,p).modules[moduleKey(ref,'intro')]).toBe('completed');expect(a.maps[0].entities[0].interaction?.action).toBe('modules.open');});
 it('counts shared conversations once per association and isolates each association progress',()=>{let a=fixture();a.story={version:1,entities:[],events:[{id:'event',name:'Inicio',trigger:'adventure.start',enabled:true,once:true,modules:[{id:'chat',type:'chat',resourceId:chatResource('shared')}],effects:[]}]};a=replaceHostModules(a,host,[{id:'chat',type:'chat',resourceId:chatResource('shared')},{id:'other',type:'chat',resourceId:chatResource('shared')}]);expect(chatUseCount(a,chatResource('shared'))).toBe(3);const first=objectContentModules(a,ref)[0],other=objectContentModules(a,ref)[1],event=a.story!.events![0];expect(contentProgressKey(a.id,host,first)).not.toBe(contentProgressKey(a.id,host,other));expect(contentProgressKey(a.id,host,first)).not.toBe(narrativeChatKey(a.id,event,event.modules[0],1));expect(narrativeChatKey(a.id,event,event.modules[0],1)).not.toBe(narrativeChatKey(a.id,event,event.modules[0],2));});
 it('attaches and edits a conversation through the same API on either host, preserving ID and siblings',()=>{let a=fixture();a=replaceHostModules(a,host,[{id:'chat',type:'chat'},context]);const edited={id:'new',name:'Nueva',config:createChat()};a=attachModuleChat(a,host,'chat',edited);expect(objectContentModules(a,ref)).toEqual([{id:'chat',type:'chat',resourceId:'chat:new'},context]);expect(attachChat(a,'room','person',{...edited,name:'Actualizada'}).chats?.find(c=>c.id==='new')?.name).toBe('Actualizada');expect(()=>parseAdventure(a)).not.toThrow();});
 it('rejects duplicate IDs, unsupported modules, missing chats, invalid ordering, exits and pickups',()=>{const a=fixture();for(const value of [[context,context],[{...context,type:'video'}],[{id:'c',type:'chat',resourceId:'chat:missing'}],[{...context,title:''}]])expect(()=>validateContentModules(value,a.chats)).toThrow();expect(()=>reorderContentModule([context],0,1)).toThrow();expect(()=>validateContentModules([{id:'c',type:'chat',resourceId:'lucia'}],a.chats)).toThrow();expect(()=>validateContentModules([{id:'c',type:'chat',resourceId:'lucia'}],a.chats,true)).not.toThrow();a.maps[0].entities[0].pickup={itemId:'key',quantity:1};expect(()=>replaceHostModules(a,host,[context])).toThrow('recogible');});
 it('allows incomplete drafts but blocks playing them; removing a referenced module remains protected',()=>{let a=replaceHostModules(fixture(),host,[{...context,text:''}]);expect(()=>parseAdventure(a)).not.toThrow();expect(contentModuleReady(objectContentModules(a,ref)[0])).toBe(false);expect(()=>beginObjectModules(a,emptyStory(),emptyInventory(),ref)).toThrow('Completa');a=replaceHostModules(a,host,[context]);a.story!.entities[0].interaction={mode:'all',conditions:[{kind:'module',...ref,moduleId:'intro',status:'completed'}]};expect(()=>parseAdventure(replaceHostModules(a,host,[]))).toThrow('módulo');});
 it('runs ordered modules, resumes unfinished work and applies reactions exactly once for duplicate callbacks',()=>{let a=replaceHostModules(fixture(),host,[context,{id:'chat',type:'chat',resourceId:'chat:shared'}]);a.story!.entities[0].reactions=[{id:'reward',event:'module.completed',moduleId:'intro',once:true,effects:[{kind:'give',itemId:'key',quantity:1}]}];let started=beginObjectModules(a,emptyStory(),emptyInventory(),ref);expect(started.moduleId).toBe('intro');const done=reportObjectModule(a,started.progress,started.inventory,ref,'intro','completed');expect(done.moduleId).toBe('chat');expect(done.inventory.counts.key).toBe(1);expect(moduleStatus(done.progress,ref,'chat')).toBe('started');expect(beginObjectModules(a,restoreStory(a,done.progress),done.inventory,ref).moduleId).toBe('chat');const duplicate=reportObjectModule(a,done.progress,done.inventory,ref,'intro','completed');expect(duplicate.inventory.counts.key).toBe(1);const final=reportObjectModule(a,done.progress,done.inventory,ref,'chat','completed');expect(final.finished).toBe(true);});
 it('rolls back the whole step if the consequence of the next module fails',()=>{let a=replaceHostModules(fixture(),host,[context,{id:'chat',type:'chat',resourceId:'chat:shared'}]);a.story!.entities[0].reactions=[{id:'reward',event:'module.completed',moduleId:'intro',once:true,effects:[{kind:'give',itemId:'key',quantity:1}]},{id:'need',event:'module.started',moduleId:'chat',once:true,effects:[{kind:'consume',itemId:'key',quantity:2}]}];const started=beginObjectModules(a,emptyStory(),emptyInventory(),ref),before=structuredClone(started);expect(()=>reportObjectModule(a,started.progress,started.inventory,ref,'intro','completed')).toThrow('Necesitas');expect(started).toEqual(before);});
 it('does not replay legacy completed chat rewards when reopening it',()=>{let a=fixture();a=replaceHostModules(a,host,objectContentModules(a,ref));a.story!.entities[0].reactions=[{id:'again',event:'module.completed',moduleId:'chat',once:false,effects:[{kind:'give',itemId:'key',quantity:1}]}];const p=setModuleStatus(a,emptyStory(),ref,'chat','completed'),begun=beginObjectModules(a,p,emptyInventory(),ref),reported=reportObjectModule(a,begun.progress,begun.inventory,ref,'chat','completed');expect(reported.inventory.counts.key??0).toBe(0);});
 it('keeps event effects separate from object reactions and marks module changes as unpublished',()=>{let a=replaceHostModules(fixture(),host,[context]);a.story!.events=[{id:'event',name:'Inicio',trigger:'adventure.start',enabled:true,once:true,modules:[context],effects:[{kind:'give',itemId:'key',quantity:1}]}];const p=beginNarrative(a,emptyStory(),emptyInventory(),'event'),eventDone=advanceNarrative(a,p,emptyInventory(),'event');expect(moduleStatus(eventDone.progress,ref,'intro')).toBe('not-started');expect(eventDone.inventory.counts.key).toBe(1);const snapshot={...a};expect(adventureChanged(replaceHostModules(a,host,[{...context,text:'Cambio'}]),snapshot)).toBe(true);});
});

describe('module conditions compatibility',()=>{
 function gated(){const a=replaceHostModules(fixture(),host,[
  {id:'request',type:'chat',resourceId:'chat:shared',repeat:true,when:{mode:'all',conditions:[{kind:'item',itemId:'key',quantity:1,not:true}]}},
  {id:'secret',type:'chat',resourceId:'chat:shared',when:{mode:'all',conditions:[{kind:'item',itemId:'key',quantity:1}]}}
 ]);a.story!.entities[0].moduleMode='conditional';a.maps[0].entities.push({id:'key-pickup',label:'Llave',kind:'object',visualId:'pixel.bin',position:{x:4,y:4},solid:false,interaction:{label:'Recoger',action:'inventory.collect',resourceId:'key'},pickup:{itemId:'key',quantity:1}});return parseAdventure(a);}
 it('retains completed results and switches away from an unfinished refusal when the key is collected',()=>{
  const a=gated(),inventory=emptyInventory(),first=beginObjectModules(a,emptyStory(),inventory,ref);
  expect(first.moduleId).toBe('request');
  const done=reportObjectModule(a,first.progress,inventory,ref,'request','completed');
  expect(done.finished).toBe(true);expect(moduleStatus(done.progress,ref,'secret')).toBe('not-started');
  const repeated=beginObjectModules(a,done.progress,inventory,ref);expect(repeated.moduleId).toBe('request');expect(moduleStatus(repeated.progress,ref,'request')).toBe('completed');
  const collected=collectItem(a,inventory,'room','key-pickup');
  expect(beginObjectModules(a,repeated.progress,collected,ref).moduleId).toBe('secret');
  expect(beginObjectModules(a,restoreStory(a,repeated.progress),collected,ref).moduleId).toBe('secret');
 });
 it('starts eligible modules in order and reports when none are eligible',()=>{
  const a=gated();a.story!.entities[0].modules![0].when=undefined;
  expect(beginObjectModules(a,emptyStory(),{...emptyInventory(),counts:{key:1}},ref).moduleId).toBe('request');
  a.story!.entities[0].modules!.shift();expect(()=>beginObjectModules(a,emptyStory(),emptyInventory(),ref)).toThrow('No hay ningún módulo');
 });
 it('skips unavailable sequence steps and evaluates the next step after rewards',()=>{
  const a=gated(),b=a.story!.entities[0];b.moduleMode='sequence';b.modules!.unshift({...context});
  const first=beginObjectModules(a,emptyStory(),emptyInventory(),ref),next=reportObjectModule(a,first.progress,first.inventory,ref,'intro','completed');
  expect(next.moduleId).toBe('request');
  const done=reportObjectModule(a,next.progress,next.inventory,ref,'request','completed');expect(done.finished).toBe(true);
  b.reactions=[{id:'reward',event:'module.completed',moduleId:'intro',once:true,effects:[{kind:'give',itemId:'key',quantity:1}]}];
  expect(reportObjectModule(a,first.progress,first.inventory,ref,'intro','completed').moduleId).toBe('secret');
 });
 it('does not duplicate once-only rewards when a repeatable chat is completed again',()=>{
  const a=gated();a.story!.entities[0].reactions=[{id:'reward',event:'module.completed',moduleId:'request',once:true,effects:[{kind:'give',itemId:'key',quantity:1}]}];
  const first=beginObjectModules(a,emptyStory(),emptyInventory(),ref),done=reportObjectModule(a,first.progress,first.inventory,ref,'request','completed');
  const again=beginObjectModules(a,done.progress,{...done.inventory,counts:{}},ref),second=reportObjectModule(a,again.progress,again.inventory,ref,'request','completed');
  expect(second.inventory.counts.key??0).toBe(0);
 });
 it('preserves rules through chat editing and protects condition references',()=>{
  const a=gated(),before=objectContentModules(a,ref)[0],edited=attachModuleChat(a,host,'request',{id:'replacement',name:'Petición',config:createChat()});
  expect(objectContentModules(edited,ref)[0]).toMatchObject({when:before.when,repeat:true,resourceId:'chat:replacement'});
  expect(storyUsesItem(a,'key')).toBe(true);
  expect(storyBoard(a).edges).toEqual(expect.arrayContaining([expect.objectContaining({source:itemNode('key'),target:objectNode(ref),kind:'requirement'})]));
  a.items=[];expect(()=>parseAdventure(a)).toThrow();
 });
 it('rejects malformed rules and invalid playback settings',()=>{
  const a=gated();a.story!.entities[0].modules![0].when={mode:'all',conditions:[{kind:'item',itemId:'missing',quantity:1}]};expect(()=>parseAdventure(a)).toThrow('Artículo');
  const b=gated();(b.story!.entities[0] as any).moduleMode='random';expect(()=>parseAdventure(b)).toThrow('Funcionamiento');
  expect(()=>validateContentModules([{...context,repeat:true}])).toThrow('repetición');
 });
});
