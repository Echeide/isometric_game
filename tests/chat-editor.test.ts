import {describe,it,expect} from 'vitest';
import {createChat,importChat,validateChats,chatResource,embeddedChat,messageGroups,parseMessagesFromText,renameNode,removeNode,reorderNode} from '../src/lib/chat/editor';
import {attachChat} from '../src/lib/chat/adventure-chats';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {graphics} from '../src/lib/demo/pixelart';
import {mapImages} from '../src/lib/storage/local-adventures';
import {readFileSync} from 'node:fs';
const sample={id:'welcome',name:'Bienvenida',config:createChat()};
describe('local adaptation of RoutingTales chat editor',()=>{
 it('preserves native groups, flat messages, rich text and extra fields on import',()=>{
  const config={...createChat(),avatar:'/avatar.png',custom:{version:2}};config.chatNodes[0]={...config.chatNodes[0],messages:[['<b>Hola</b>','Segundo'],['Otra visita']],query:{id:'keep'}};
  expect(importChat(JSON.stringify(config))).toEqual(config);
  expect(messageGroups({id:'n',messages:['Uno','Dos']})).toEqual([['Uno','Dos']]);
  const groups=messageGroups(config.chatNodes[0]);groups[0][0]='Modificado';expect(config.chatNodes[0].messages![0][0]).toBe('<b>Hola</b>');
  expect(parseMessagesFromText('Hola\nSegundo\n---\nOtra visita')).toEqual([['Hola','Segundo'],['Otra visita']]);
 });
 it('renames all incoming targets without losing option or node metadata',()=>{
  const config=createChat();config.chatNodes[0].options![0].hint='Pista';config.chatNodes[1].rewards=[{type:'points',points:10}];
  const renamed=renameNode(config,1,'finish');expect(renamed.chatNodes[0].options![0]).toEqual({text:'Continuar',target:'finish',hint:'Pista'});expect(renamed.chatNodes[1].rewards).toEqual(config.chatNodes[1].rewards);expect(config.chatNodes[1].id).toBe('success');
  expect(()=>renameNode(config,1,'start')).toThrow();expect(()=>removeNode(config,1)).toThrow('Otra respuesta');
  expect(removeNode({...config,chatNodes:config.chatNodes.map(n=>({...n,options:[]}))},1).chatNodes).toHaveLength(1);
 });
 it('reorders the entry node while preserving branches, message groups and native metadata',()=>{
  const config=createChat();config.chatNodes.splice(1,0,{id:'hint',messages:[['Una pista'],['Otra visita']],options:[{text:'Volver',home:true,custom:'keep'}],rewards:[{type:'points',points:5}]});
  const before=JSON.stringify(config),moved=reorderNode(config,1,0);
  expect(moved.chatNodes.map(node=>node.id)).toEqual(['hint','start','success']);expect(moved.chatNodes[0]).toEqual(config.chatNodes[1]);expect(moved.chatNodes[1].options).toEqual(config.chatNodes[0].options);expect(importChat(JSON.stringify(moved))).toEqual(moved);expect(JSON.stringify(config)).toBe(before);
  expect(reorderNode(moved,0,2).chatNodes.map(node=>node.id)).toEqual(['start','success','hint']);expect(()=>reorderNode(config,-1,0)).toThrow();expect(()=>reorderNode(config,0,3)).toThrow();
 });
 it('validates limits, references and legacy adventures without requiring migration',()=>{
  expect(validateChats(undefined)).toEqual([]);expect(validateChats([sample])).toEqual([sample]);
  expect(()=>validateChats([sample,sample])).toThrow();expect(()=>validateChats([{...sample,id:'../chat'}])).toThrow();expect(()=>validateChats([{...sample,config:{chatNodes:[]}}])).toThrow();expect(()=>importChat(JSON.stringify({...createChat(),large:'x'.repeat(2_000_000)}))).toThrow('2 MB');
  expect(embeddedChat([sample],chatResource(sample.id))).toEqual(sample.config);expect(embeddedChat(undefined,'lucia')).toBeUndefined();expect(()=>embeddedChat([],chatResource('missing'))).toThrow();
  const adventure=createAdventure([office]);expect(parseAdventure(adventure).chats).toBeUndefined();
  const broken=structuredClone(adventure);broken.maps[0].entities[0].interaction={label:'Chat',action:'chat.open',resourceId:chatResource('missing')};expect(()=>parseAdventure(broken)).toThrow('no existe');
 });
 it('attaches, replaces and shares a chat without mutating maps or other conversations',()=>{
  const adventure=createAdventure([office]),entity=office.entities.find(e=>e.kind==='person')!;
  const attached=attachChat(adventure,office.id,entity.id,sample);
  expect(adventure.chats).toBeUndefined();expect(attached.chats).toEqual([sample]);expect(attached.maps[0].entities.find(e=>e.id===entity.id)!.interaction!.resourceId).toBe('chat:welcome');
  const second=office.entities.find(e=>e.kind==='person'&&e.id!==entity.id)!;const shared=attachChat(attached,office.id,second.id,sample);expect(shared.chats).toHaveLength(1);
  const changed=structuredClone(sample);changed.config.chatNodes[0].messages=['Editado'];const updated=attachChat(shared,office.id,entity.id,changed);expect(updated.chats).toEqual([changed]);expect(attached.chats![0].config).toEqual(sample.config);
  expect(()=>attachChat(adventure,office.id,'missing',sample)).toThrow();
 });
 it('round trips embedded chat payload and assignment in the adventure ZIP',async()=>{
  const adventure=createAdventure([office]),entity=office.entities.find(e=>e.kind==='person')!;const attached=attachChat(adventure,office.id,entity.id,sample);
  const zip=await exportAdventure(attached,{pack:async()=>mapImages(graphics,url=>'asset:'+url),blob:async(id:string)=>new Blob([readFileSync('static'+id)])});
  // Stock PNG references are read by the package exporter; no separate chat service is required.
  expect(unpackAdventure(new Uint8Array(await zip.arrayBuffer())).adventure).toEqual(attached);
 });
});
