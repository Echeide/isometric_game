import { expect,it } from 'vitest';
import { insertEntity } from '../src/lib/demo/editor';
import { parseScene } from '../packages/world/src/scene';
import office from '../src/lib/demo/maps/checkpoint.json';
it('adds consecutive trees at distinct valid locations without changing the original',()=>{
 const original=parseScene(office);
 const first=insertEntity(original,'tree','added-1');
 const second=insertEntity(first,'tree','added-2');
 expect(first.entities.at(-1)?.visualId).toBe('pixel.tree');
 expect(second.entities.length).toBe(original.entities.length+2);
 expect(second.entities.at(-1)?.position).not.toEqual(first.entities.at(-1)?.position);
 expect(()=>parseScene(second)).not.toThrow();
 expect(original.entities.some(e=>e.id==='added-1')).toBe(false);
});
it('reports a full map without overwriting its entrance',()=>{
 const scene=parseScene({schemaVersion:1,id:'full',name:'Full',theme:'office',width:1,height:1,spawn:{x:0,y:0},entities:[]});
 expect(()=>insertEntity(scene,'tree','tree')).toThrow('No queda espacio');
});

import { moveEntity } from '../src/lib/demo/editor';
it('moves a desk together with its seat and interaction points',()=>{
 const original=parseScene(office);
 const moved=moveEntity(original,'my-desk',{x:4,y:5});
 const desk=moved.entities.find(e=>e.id==='my-desk')!;
 expect(desk.position).toEqual({x:4,y:5});
 expect(desk.seat?.cell).toEqual({x:4,y:6});
 expect(desk.interactionPoints).toEqual([{x:4,y:6}]);
 expect(original.entities[0].position).toEqual({x:3,y:5});
});
it('rejects movement through another object or outside the map',()=>{
 const original=parseScene(office);
 expect(()=>moveEntity(original,'plant1',{x:7,y:3})).toThrow('solapa');
 expect(()=>moveEntity(original,'plant1',{x:-1,y:0})).toThrow('Posición');
});

it('places the workstation on the keyboard side, facing the monitor',()=>{
 const desk=parseScene(office).entities.find(e=>e.id==='my-desk')!;
 expect(desk.seat?.cell).toEqual({x:desk.position.x,y:desk.position.y+desk.size!.y});
 expect(desk.seat?.facing).toBe('ne');
 expect(desk.interactionPoints).toEqual([desk.seat!.cell]);
});

it('places a chosen sprite on the clicked tile and rejects occupied tiles without relocating it',()=>{
 const original=parseScene(office);
 const added=insertEntity(original,'tree','placed','pixel.tree',{x:1,y:9});
 expect(added.entities.at(-1)?.position).toEqual({x:1,y:9});
 expect(()=>insertEntity(original,'tree','invalid','pixel.tree',original.spawn)).toThrow('entrada');
 expect(()=>insertEntity(original,'tree','invalid','pixel.tree',original.entities[0].position)).toThrow('solapa');
 expect(original.entities.some(e=>e.id==='placed')).toBe(false);
});
