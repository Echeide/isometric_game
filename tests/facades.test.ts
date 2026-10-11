import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {facadeCell,facadeWidth,facadeProjection,facadeBaseLevel,facadeDoorOpening} from '../packages/world/src/facades';
import {parseScene} from '../packages/world/src/scene';
import type {WorldScene} from '../packages/world/src/types';
import {connectFacadeDoor} from '../src/lib/demo/facades';
import {createAdventure,travel} from '../src/lib/demo/adventure';
import {graphics} from '../src/lib/demo/pixelart';
import {mapImages,imageUrls,type AdventureRepository} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {storeFacadeResource} from '../src/lib/storage/facade-resource';
const scene:WorldScene={schemaVersion:1,id:'front',name:'Front',theme:'outdoors',width:10,height:8,spawn:{x:2,y:2},entities:[],facades:[{edge:'ne',imageId:'custom.front',height:4,baseLevel:0},{edge:'nw',imageId:'custom.front',height:4,baseLevel:0}]};
const adventure=()=>createAdventure([scene,{...scene,id:'inside',facades:undefined}]);
it('projects both rear edges of rectangular maps without mirroring the frontal image',()=>{
 expect(facadeWidth(scene,'ne')).toBe(10);expect(facadeWidth(scene,'nw')).toBe(8);
 expect(facadeCell(scene,'nw',0)).toEqual({x:0,y:7});expect(facadeCell(scene,'nw',7)).toEqual({x:0,y:0});
 const [ne,nw]=scene.facades!.map(f=>facadeProjection(scene,f));
 expect([ne.tx,ne.ty+ne.height,ne.tx+ne.width,ne.ty+ne.height+ne.b*ne.width]).toEqual([0,0,320,160]);
 expect([nw.tx,nw.ty+nw.height,nw.tx+nw.width,nw.ty+nw.height+nw.b*nw.width]).toEqual([-256,128,0,0]);
});
it('validates optional facades and refuses invalid dimensions or duplicate edges',()=>{
 expect(parseScene(scene).facades).toEqual(scene.facades);
 for(const facades of [null,{},[scene.facades![0],scene.facades![0]],[{...scene.facades![0],height:0}],[{...scene.facades![0],height:33}],[{...scene.facades![0],edge:'se'}],[{...scene.facades![0],imageId:'https://bad'}]])expect(()=>parseScene({...scene,facades})).toThrow();
 expect(parseScene({...scene,facades:undefined}).facades).toBeUndefined();
});
it.each(['ne','nw'] as const)('connects a %s door to the existing travel system and preserves its arrival facing',edge=>{
 const a=connectFacadeDoor(adventure(),'front',edge,3,'inside','door');
 const map=a.maps[0],cell=facadeCell(scene,edge,3);
 expect(map.entities[0].position).toEqual(cell);expect(map.entities[0].interactionPoints).toEqual([cell]);expect(map.walls?.find(w=>w.exitId==='door')).toMatchObject({...cell,axis:edge==='ne'?'x':'y',kind:'door'});
 expect(travel(a,'front','door').scene.id).toBe('inside');
 expect(()=>connectFacadeDoor(a,'front',edge,3,'inside','other')).toThrow();
});
it('rejects doors over voids, blocked cells or below a fixed base',()=>{
 for(const change of [{tiles:{'3,0':'void' as const}},{blocked:[{x:3,y:0}]},{elevations:{'3,0':1}}]){
  const a=adventure();a.maps[0]={...a.maps[0],...change};expect(()=>connectFacadeDoor(a,'front','ne',3,'inside','door')).toThrow();
 }
 const a=connectFacadeDoor(adventure(),'front','ne',3,'inside','door');
 expect(()=>parseScene({...a.maps[0],facades:[{...scene.facades![0],baseLevel:1}]})).toThrow('suelo plano');
});
it.each(['ne','nw'] as const)('keeps a single %s plane on the lowest supported edge, ignoring interior and void cells',edge=>{
 const f={...scene.facades![0],edge},map={...scene,elevations:Object.fromEntries(Array.from({length:facadeWidth(scene,edge)},(_,i)=>{const p=facadeCell(scene,edge,i);return [`${p.x},${p.y}`,2];}))};
 expect(facadeBaseLevel(map,f)).toBe(2);
 expect(facadeProjection(map,f).ty).toBe(facadeProjection(scene,f).ty-48);
 const low=facadeCell(scene,edge,3),key=`${low.x},${low.y}`;
 map.elevations[key]=-1;map.elevations['2,2']=-2;
 expect(facadeBaseLevel(map,f)).toBe(-1);
 expect(facadeBaseLevel({...map,tiles:{[key]:'void'}},f)).toBe(2);
 expect(facadeBaseLevel(map,{...f,baseMode:'fixed',baseLevel:0})).toBe(0);
 expect(facadeBaseLevel(map,{...f,baseLevel:1})).toBe(1);
});
it('aligns door hit areas to raised ground without moving or splitting the image',()=>{
 const map={...scene,elevations:{'3,0':1}},f=scene.facades![0],opening=facadeDoorOpening(map,f,3)!;
 expect(facadeProjection(map,f)).toEqual(facadeProjection(scene,f));
 expect(opening.bottom).toBe(128-24);expect(opening.y+opening.height).toBe(opening.bottom);
 const p=facadeProjection(map,f);expect(p.ty+p.b*opening.x+opening.bottom).toBe(3*16-24);
 expect(facadeDoorOpening(map,{...f,height:1,baseMode:'fixed',baseLevel:-2},3)).toBeNull();
 expect(facadeDoorOpening({...map,stairs:{'3,0':'ne'}},f,3)).toBeNull();
});
it('keeps existing elevated doors valid when the common terrain base changes',()=>{
 const a=connectFacadeDoor(adventure(),'front','ne',3,'inside','door'),map=a.maps[0];
 const raised={...map,elevations:{'3,0':1}};
 expect(parseScene(raised,{allowUnreachable:true}).facades).toEqual(map.facades);
 expect(facadeDoorOpening(raised,raised.facades![0],3)?.bottom).toBe(104);
 const lowered={...raised,elevations:{...raised.elevations,'4,0':-1}};
 expect(parseScene(lowered,{allowUnreachable:true}).facades).toEqual(map.facades);
 expect(facadeDoorOpening(lowered,lowered.facades![0],3)?.bottom).toBe(80);
});
it('connects a raised entrance reached by stairs and preserves support mode in an export',async()=>{
 const a=adventure();a.maps[0]={...a.maps[0],elevations:{'3,0':1},stairs:{'3,1':'ne'},facades:scene.facades!.map(f=>({...f,baseMode:'terrain'}))};
 const linked=connectFacadeDoor(a,'front','ne',3,'inside','raised-door');
 expect(travel(linked,'front','raised-door').scene.id).toBe('inside');
 expect(facadeDoorOpening(linked.maps[0],linked.maps[0].facades![0],3)?.bottom).toBe(104);
 const pack=mapImages({...graphics,facades:{'custom.front':{name:'Front',image:graphics.tiles.grass}}},url=>'asset:'+url);
 const blob=await exportAdventure(linked,{pack:async()=>pack,blob:async id=>new Blob([readFileSync('static'+id)])});
 expect(unpackAdventure(new Uint8Array(await blob.arrayBuffer())).adventure.maps[0]).toEqual(linked.maps[0]);
});
it('exports and imports facade images and working doors with the adventure',async()=>{
 const a=connectFacadeDoor(adventure(),'front','nw',3,'inside','door');
 const pack=mapImages({...graphics,facades:{'custom.front':{name:'Front',image:graphics.tiles.grass}}},url=>'asset:'+url);
 const blob=await exportAdventure(a,{pack:async()=>pack,blob:async id=>new Blob([readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));
 expect(restored.adventure).toEqual(a);expect(restored.pack.facades?.['custom.front'].image).toMatch(/^asset:/);expect(imageUrls(restored.pack)).toContain(restored.pack.facades!['custom.front'].image);
 expect(travel(restored.adventure,'front','door').scene.id).toBe('inside');
 expect(()=>validateCatalogGraphics(a,graphics)).toThrow('Falta una imagen de fachada');
});
it('stores new PNG assets without persisting the map draft and detects revision conflicts',async()=>{
 const a=Object.assign(adventure(),{_revision:3}),save=vi.fn<AdventureRepository['save']>(async()=>({version:1 as const,activeId:a.id,adventures:[{...a,_revision:4}]}));
 const repository={load:async()=>({version:1 as const,activeId:a.id,adventures:[a]}),pack:async()=>graphics,save,blob:async()=>new Blob(),select:async()=>a};
 const file=new Blob([readFileSync('static'+graphics.tiles.grass)],{type:'image/png'});
 const result=await storeFacadeResource(a.id,file,'Test',3,repository);
 expect(result.revision).toBe(4);expect(save.mock.calls[0][0]).toEqual(a);expect(save.mock.calls[0][1]!.pack.facades![result.id].image).toMatch(/^asset:/);
 await expect(storeFacadeResource(a.id,file,'Test',2,repository)).rejects.toThrow('otra sesión');expect(save).toHaveBeenCalledTimes(1);
 await expect(storeFacadeResource(a.id,new Blob(['bad']),'Bad',3,repository)).rejects.toThrow('PNG');
});
