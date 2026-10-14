import {describe,it,expect} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {replaceHostModules,objectContentModules,attachModuleChat} from '../src/lib/modules/adventure-modules';
import {moduleSequence,eligibleSequence,nextSequenceModule,validateModuleSequence} from '../src/lib/modules/sequence';
import {beginObjectModules,reportObjectModule} from '../src/lib/modules/runtime';
import {emptyStory} from '../src/lib/story/types';
import {emptyInventory,collectItem} from '../src/lib/demo/inventory';
import {createChat} from '../src/lib/chat/editor';
import {storyUsesItem} from '../src/lib/story/validation';
import {storyBoard,itemNode,objectNode} from '../src/lib/story/board';
import type {ContentModule} from '../src/lib/modules/types';
const ref={mapId:'room',entityId:'npc'},host={kind:'object' as const,...ref};
const context=(id:string):ContentModule=>({id,type:'context',title:id,text:'Texto de '+id});
function fixture(){let a=createAdventure([parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:6,height:6,spawn:{x:0,y:0},entities:[{id:'npc',label:'Guía',kind:'person',position:{x:2,y:2}}]})]);a.items=[{id:'key',name:'Llave',description:'',stackable:false}];
 a=replaceHostModules(a,host,[context('intro'),{id:'video',type:'video',title:'Vídeo',content:{body:{es:'Historia'},videoUrl:{es:'https://example.com/video.mp4'},requiredWatchPercent:80},points:{win:0,fail:0}},context('secret'),context('refusal'),context('end')]);
 a.story!.entities[0].moduleSequence=[{kind:'module',moduleId:'intro'},{kind:'condition',id:'key-block',when:{mode:'all',conditions:[{kind:'item',itemId:'key',quantity:1}]},moduleIds:['video','secret'],elseModuleIds:['refusal']},{kind:'module',moduleId:'end'}];
 a.maps[0].entities.push({id:'key-pickup',label:'Llave',kind:'object',visualId:'pixel.bin',position:{x:4,y:4},solid:false,interaction:{label:'Recoger',action:'inventory.collect',resourceId:'key'},pickup:{itemId:'key',quantity:1}});
 return parseAdventure(a);
}
describe('ordered conditional module blocks',()=>{
 it('runs ordinary modules and the matching branch with any content type',()=>{
  const a=fixture(),p=emptyStory(),i=emptyInventory();expect(eligibleSequence(a,p,i,ref).map(m=>m.id)).toEqual(['intro','refusal','end']);
  const key=collectItem(a,i,'room','key-pickup');expect(eligibleSequence(a,p,key,ref).map(m=>m.id)).toEqual(['intro','video','secret','end']);
  const begun=beginObjectModules(a,p,key,ref),video=reportObjectModule(a,begun.progress,key,ref,'intro','completed');expect(video.moduleId).toBe('video');
  const secret=reportObjectModule(a,video.progress,video.inventory,ref,'video','completed');expect(secret.moduleId).toBe('secret');
  const end=reportObjectModule(a,secret.progress,secret.inventory,ref,'secret','completed');expect(end.moduleId).toBe('end');
  expect(reportObjectModule(a,end.progress,end.inventory,ref,'end','completed').finished).toBe(true);
 });
 it('finishes the chosen branch if its first module consumes the key',()=>{
  const a=fixture();a.story!.entities[0].reactions=[{id:'consume',event:'module.completed',moduleId:'video',once:true,effects:[{kind:'consume',itemId:'key',quantity:1}]}];
  const key=collectItem(a,emptyInventory(),'room','key-pickup'),p=beginObjectModules(a,emptyStory(),key,ref),video=reportObjectModule(a,p.progress,key,ref,'intro','completed');
  const secret=reportObjectModule(a,video.progress,key,ref,'video','completed');expect(secret.inventory.counts.key).toBe(0);expect(secret.moduleId).toBe('secret');
  expect(nextSequenceModule(a,secret.progress,secret.inventory,ref,'secret')?.id).toBe('end');
  expect(beginObjectModules(a,secret.progress,secret.inventory,ref).moduleId).toBe('refusal');
 });
 it('reevaluates conditions on return instead of resuming an ineligible branch',()=>{
  const a=fixture(),p=beginObjectModules(a,emptyStory(),emptyInventory(),ref),refusal=reportObjectModule(a,p.progress,p.inventory,ref,'intro','completed');expect(refusal.moduleId).toBe('refusal');
  const key=collectItem(a,emptyInventory(),'room','key-pickup');expect(beginObjectModules(a,refusal.progress,key,ref).moduleId).toBe('video');
 });
 it('runs all matching groups in order and treats groups without conditions as unconditional',()=>{
  const a=fixture(),b=a.story!.entities[0];b.moduleSequence!.splice(2,0,{kind:'condition',id:'another',when:{mode:'all',conditions:[{kind:'item',itemId:'key',quantity:1}]},moduleIds:['end']});b.moduleSequence!.pop();
  const key=collectItem(a,emptyInventory(),'room','key-pickup');expect(nextSequenceModule(a,emptyStory(),key,ref,'secret')?.id).toBe('end');
  b.moduleSequence![2]={kind:'condition',id:'unfinished',moduleIds:['end']};expect(nextSequenceModule(a,emptyStory(),key,ref,'secret')?.id).toBe('end');
 });
 it('retains module identity, branches and item dependencies when editing or removing content',()=>{
  const a=fixture();expect(storyUsesItem(a,'key')).toBe(true);expect(storyBoard(a).edges).toEqual(expect.arrayContaining([expect.objectContaining({source:itemNode('key'),target:objectNode(ref),kind:'requirement'})]));
  const edited=replaceHostModules(a,host,objectContentModules(a,ref).map(m=>m.id==='secret'?{...m,title:'Cambio'}:m));expect(edited.story!.entities[0].moduleSequence).toEqual(a.story!.entities[0].moduleSequence);
  const removed=parseAdventure(replaceHostModules(a,host,objectContentModules(a,ref).filter(m=>m.id!=='video')));expect(removed.story!.entities[0].moduleSequence![1]).toMatchObject({moduleIds:['secret'],elseModuleIds:['refusal']});
  const chat=replaceHostModules(a,host,[...objectContentModules(a,ref),{id:'chat',type:'chat'}]);const attached=attachModuleChat(chat,host,'chat',{id:'new',name:'Chat',config:createChat()});expect(attached.story!.entities[0].moduleSequence!.at(-1)).toEqual({kind:'module',moduleId:'chat'});
 });
 it('groups consecutive ordinary modules without merging authored groups',()=>{
  const modules=[context('one'),context('two'),context('three')];expect(moduleSequence(modules)).toMatchObject([{moduleIds:['one','two','three']}]);
  const saved=[{kind:'condition' as const,id:'first',moduleIds:['one','two']},{kind:'condition' as const,id:'second',moduleIds:['three']}];expect(moduleSequence(modules,saved)).toEqual(saved);
  const collision=moduleSequence(modules,[{kind:'module',moduleId:'one'},{kind:'condition',id:'group-one',moduleIds:['two','three']}]);expect(new Set(collision.map(g=>g.id)).size).toBe(2);expect(()=>validateModuleSequence(collision,modules)).not.toThrow();
 });
 it('rejects duplicate, missing and dangling modules and invalid requirements',()=>{
  const a=fixture(),modules=objectContentModules(a,ref);expect(()=>validateModuleSequence([{kind:'module',moduleId:'missing'}],modules)).toThrow();
  expect(()=>validateModuleSequence([{kind:'module',moduleId:'intro'},{kind:'module',moduleId:'intro'}],modules)).toThrow();
  expect(()=>validateModuleSequence([],modules)).toThrow();
  const step=a.story!.entities[0].moduleSequence![1];if(step.kind==='condition')step.when={mode:'all',conditions:[{kind:'item',itemId:'missing',quantity:1}]};expect(()=>parseAdventure(a)).toThrow('Artículo');
 });
 it('exposes legacy per-module requirements as blocks without altering the original payload',()=>{
  const modules:ContentModule[]=[context('intro'),{...context('secret'),when:{mode:'all',conditions:[{kind:'item',itemId:'key',quantity:1}]}}],before=JSON.stringify(modules);
  expect(moduleSequence(modules)).toMatchObject([{kind:'condition',moduleIds:['intro']},{kind:'condition',moduleIds:['secret'],when:modules[1].when}]);expect(JSON.stringify(modules)).toBe(before);
 });
});
