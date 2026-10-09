import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {appendObjectAspect,detachObject,objectFamilyId,validateObjectFamilies} from '../packages/world/src/object-families';
import {parseScene} from '../packages/world/src/scene';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {prepareOpenClosed} from '../src/lib/story/open-closed';
import {behavior,replaceBehavior,react,resolveStoryScene} from '../src/lib/story/engine';
import {emptyStory} from '../src/lib/story/types';
import {emptyInventory} from '../src/lib/demo/inventory';
import {imageUrls,mapImages} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,pngSize,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {groupWorkshopObjects,workshopEntries,resourceUsages} from '../src/lib/workshop/resources';
import {publicGraphics,graphicsChanged} from '../src/lib/server/platform/publication-state';
const ref={mapId:'room',entityId:'sofa'};
function fixture(){
 let a=createAdventure([parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[{id:'sofa',label:'Sofá',kind:'sofa',visualId:'pixel.sofa',position:{x:2,y:2},size:{x:1,y:3},solid:true}]})]);
 a.catalog=[{id:'custom.open',kind:'object',label:'Sofá abierto',category:'office',size:{x:1,y:3}}];a=prepareOpenClosed(a,ref);const b=behavior(a,ref)!;a=parseAdventure(replaceBehavior(a,{...b,states:b.states.map((s,i)=>i?{...s,visualId:'custom.open'}:s)}));
 const p=structuredClone(graphics);p.objects['custom.open']=structuredClone(p.objects['pixel.sofa']);p.objectFamilies={'family.sofa':{name:'Sofá',aspects:{'pixel.sofa':'Cerrado','custom.open':'Abierto'}}};return {a,p};
}
describe('object graphic families and state aspects',()=>{
 it('adds independent aspects to the same family, detaches without deleting graphics and cleans empty groups',()=>{
  const {p}=fixture(),before=JSON.stringify(p),next=appendObjectAspect(p.objectFamilies!,'pixel.sofa','custom.broken','Sofá');expect(objectFamilyId(next,'custom.broken')).toBe('family.sofa');expect(next['family.sofa'].aspects['custom.broken']).toBe('Nuevo aspecto');
  expect(detachObject(next,'custom.broken')).toEqual(p.objectFamilies);expect(detachObject(detachObject(p.objectFamilies!,'pixel.sofa'),'custom.open')).toEqual({});expect(JSON.stringify(p)).toBe(before);
  expect(appendObjectAspect({},'pixel.bin','custom.copy','Papelera',()=> 'family.bin')).toEqual({'family.bin':{name:'Papelera',aspects:{'pixel.bin':'Original','custom.copy':'Nuevo aspecto'}}});
 });
 it('validates names, membership and missing graphics, accepting legacy packs',()=>{
  const {p}=fixture();expect(()=>validateObjectFamilies(undefined,p.objects)).not.toThrow();expect(()=>validateObjectFamilies(p.objectFamilies,p.objects)).not.toThrow();
  for(const bad of [null,[],{'family.a':{name:'A',aspects:{}}},{'family.a':{name:'',aspects:{'pixel.sofa':'Cerrado'}}},{'family.a':{name:'A',aspects:{'missing':'Abierto'}}},{'family.a':{name:'A',aspects:{'pixel.sofa':''}}},{'family.a':{name:'A',aspects:{'pixel.sofa':'Uno'}},'family.b':{name:'B',aspects:{'pixel.sofa':'Dos'}}}])expect(()=>validateObjectFamilies(bad,p.objects)).toThrow('Familias');
  const sizes=new Map(imageUrls(p).map(url=>[url,pngSize(readFileSync('static'+url))]));expect(()=>validateGraphics(p,sizes)).not.toThrow();
 });
 it('searches family and aspect labels, showing each object once without grouping NPCs',()=>{
  const {a,p}=fixture(),entries=workshopEntries(p,a.catalog),before=JSON.stringify(entries),groups=groupWorkshopObjects(entries,p.objectFamilies!);const ids=[...groups.groups.flatMap(g=>g.entries),...groups.ungrouped].map(e=>e.id);expect(ids.length).toBe(entries.filter(e=>e.kind==='object').length);expect(new Set(ids).size).toBe(ids.length);
  expect(groupWorkshopObjects(entries,p.objectFamilies!,' CERRADO ').groups[0].entries.map(e=>e.id)).toEqual(['pixel.sofa']);expect(groupWorkshopObjects(entries,p.objectFamilies!,'sofá').groups[0].entries).toHaveLength(2);expect(JSON.stringify(entries)).toBe(before);
 });
 it('lets a builtin object use a custom aspect, retaining gameplay type and accepting the resolved scene',()=>{
  const {a}=fixture(),r=react(a,emptyStory(),emptyInventory(),ref,'interact'),scene=resolveStoryScene(a,a.maps[0],r.progress,r.inventory);expect(scene.entities[0]).toEqual({...a.maps[0].entities[0],visualId:'custom.open'});expect(()=>parseScene(scene)).not.toThrow();expect(()=>parseAdventure({...a,maps:[scene]})).not.toThrow();
  const closed=react(a,r.progress,r.inventory,ref,'interact');expect(resolveStoryScene(a,a.maps[0],closed.progress,closed.inventory).entities[0].visualId).toBe('pixel.sofa');
  const inverse=parseScene({...scene,entities:[{...scene.entities[0],kind:'object',visualId:'pixel.sofa'}]});expect(inverse.entities[0].kind).toBe('object');
 });
 it('keeps NPC visuals separate and prevents missing state graphics and NPCs in object families',()=>{
  const {a,p}=fixture(),bad=structuredClone(a);bad.story!.entities[0].states[1].visualId='pixel.person';expect(()=>parseAdventure(bad)).toThrow('compatible');const entry=workshopEntries(p,a.catalog).find(e=>e.id==='custom.open')!;expect(resourceUsages(a.maps,entry,a.story)).toEqual(['Sala']);delete p.objects['custom.open'];expect(()=>validateCatalogGraphics(a,p)).toThrow();
  p.objectFamilies={'family.person':{name:'PNJ',aspects:{'pixel.person':'Persona'}}};expect(()=>validateCatalogGraphics(a,p)).toThrow('familia');
 });
 it('keeps grouping out of publication change detection and preserves it with states in adventure ZIPs',async()=>{
  const {a,p}=fixture(),changed=structuredClone(p);changed.objectFamilies!['family.sofa'].name='Otra';expect(graphicsChanged(changed,p)).toBe(false);expect(publicGraphics(p).objectFamilies).toBeUndefined();
  const source=mapImages(p,url=>'asset:'+url),blob=await exportAdventure(a,{pack:async()=>source,blob:async id=>new Blob([readFileSync('static'+id)])}),restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));expect(restored.pack.objectFamilies).toEqual(p.objectFamilies);expect(restored.adventure.story).toEqual(a.story);expect(restored.pack.objects['custom.open'].origin).toEqual(p.objects['pixel.sofa'].origin);expect(restored.pack.objects['custom.open'].width).toBe(p.objects['pixel.sofa'].width);
 });
});
