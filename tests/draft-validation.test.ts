import {expect,it} from 'vitest';
import {parseAdventure,connectMaps,createTraveler} from '../src/lib/demo/adventure';
import {parseLibrary} from '../src/lib/demo/adventure-library';
import {insertEntity,moveEntity,flipEntity} from '../src/lib/demo/editor';
import {unreachableAdventure} from './fixtures/unreachable-adventure';
it('reopens structurally valid drafts with unreachable exits, while gameplay keeps rejecting them',()=>{
 const draft=unreachableAdventure(),library={version:1,activeId:draft.id,adventures:[draft]};
 expect(parseLibrary(library,{allowUnreachable:true}).adventures[0].maps[0].entities[0].position).toEqual({x:0,y:3});
 expect(()=>parseLibrary(library)).toThrow('No se puede llegar');
 expect(()=>createTraveler(draft)).toThrow('Calle');
 expect(()=>parseAdventure(draft)).toThrow('entrada (1, 0) hasta el objeto (0, 3)');
});
it('still rejects missing exits and blocked spawns in drafts',()=>{
 const draft=unreachableAdventure();
 expect(()=>parseAdventure({...draft,exits:[]},{allowUnreachable:true})).toThrow('Falta el destino');
 draft.maps[0].spawn={x:1,y:1};expect(()=>parseAdventure(draft,{allowUnreachable:true})).toThrow('entrada está bloqueada');
});
it('allows authoring furniture and return links before an existing route has been completed',()=>{
 const draft=unreachableAdventure(),options={allowUnreachable:true};
 expect(()=>insertEntity(draft.maps[0],'tree','tree','pixel.tree',{x:3,y:3},undefined,options)).not.toThrow();
 expect(moveEntity(draft.maps[0],'exit',{x:1,y:3},options).entities[0].position).toEqual({x:1,y:3});
 expect(()=>flipEntity(draft.maps[0],'exit',options)).not.toThrow();
 expect(connectMaps(draft,'plaza','calle','back',undefined,undefined,options).exits).toHaveLength(2);
});
