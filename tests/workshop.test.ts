import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {insertEntity} from '../src/lib/demo/editor';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,pngSize,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {parseScene,validateCustomCatalog,type VisualAsset} from '../packages/world/src/scene';
import {npcClip} from '../packages/world/src/pixelart';
import {standaloneCharacter,supportOrigin,workshopEntries,workshopNpc} from '../src/lib/workshop/resources';

const object:VisualAsset={id:'custom.locker',label:'Taquilla',kind:'object',category:'office',size:{x:2,y:1}};
const npc:VisualAsset={id:'custom.guide',label:'Guía',kind:'person',category:'people',size:{x:1,y:1}};
const empty=parseScene({schemaVersion:1,id:'empty',name:'Prueba',theme:'office',width:10,height:10,spawn:{x:0,y:0},entities:[]});
const dimensions=new Map(imageUrls(graphics).map(url=>[url,pngSize(readFileSync('static'+url))]));
function customPack(){
 const pack=structuredClone(graphics);
 pack.objects[object.id]={...pack.objects['pixel.desk']};
 pack.objects[npc.id]={image:pack.character.animations.idle.image!,width:64,height:96,origin:[32,80],frame:[0,96,64,96]};
 pack.players={'custom.player':{name:'Mi personaje',character:standaloneCharacter(pack.character,'728da5')}};
 pack.players['custom.player'].character.scale=1.5;
 pack.activePlayer='custom.player';
 pack.tileFrames={office:[0,0,64,32]};
 return pack;
}
describe('custom resource catalogue',()=>{
 it('places custom objects and PNJs with their own footprints and preserves them on save',()=>{
  let scene=insertEntity(empty,'object','o',object.id,{x:2,y:2},[object,npc]);
  scene=insertEntity(scene,'person','n',npc.id,{x:5,y:5},[object,npc]);
  const adventure=parseAdventure({...createAdventure([empty]),maps:[scene],catalog:[object,npc]});
  expect(adventure.maps[0].entities.map(e=>e.size)).toEqual([object.size,npc.size]);
  expect(parseAdventure(JSON.parse(JSON.stringify(adventure)))).toEqual(adventure);
  expect(()=>parseAdventure({...adventure,catalog:[object]})).toThrow('Falta custom.guide');
  expect(()=>parseAdventure({...adventure,catalog:[object,{...npc,kind:'object'}]})).toThrow('Falta custom.guide');
 });
 it('accepts reactive catalogue wrappers, but rejects duplicates and invalid footprints',()=>{
  expect(validateCustomCatalog(new Proxy([object],{}))).toEqual([object]);
  expect(()=>validateCustomCatalog([object,object])).toThrow();
  expect(()=>validateCustomCatalog([{...object,size:{x:0,y:1}}])).toThrow();
  expect(()=>validateCustomCatalog([{...object,id:'pixel.desk'}])).toThrow();
 });
 it('keeps engine-only chair pieces out of the workshop and exposes cropped thumbnails',()=>{
  const entries=workshopEntries(customPack(),[object,npc]);
  expect(entries.filter(e=>e.kind==='object').some(e=>e.name.startsWith('pixel.'))).toBe(false);
  expect(entries.find(e=>e.id===npc.id)).toMatchObject({kind:'npc',frame:[0,96,64,96]});
  expect(entries.find(e=>e.id==='custom.player')?.frame).toEqual([0,96,64,96]);
 });
 it('anchors a drawing over the centre of a nonsquare isometric footprint',()=>{
  expect(supportOrigin({width:100,height:120},{x:2,y:1})).toEqual([34,96]);
 });
});
describe('resource graphics validation',()=>{
 it('exposes existing PNJs with their original palette and optional animation rows',()=>{
  const pack=customPack(),lucia=workshopNpc(pack,'pixel.person-lucia');
  expect(lucia.image).toContain('/lucia/');
  expect(lucia.animations?.idle?.row).toBe(1);
  expect(workshopEntries(pack).filter(e=>e.kind==='npc')).toHaveLength(3);
  pack.objects['pixel.person-lucia']=lucia;
  expect(()=>validateGraphics(pack,dimensions)).not.toThrow();
 });
 it('accepts a static PNJ and independent optional idle / talk clips',()=>{
  const pack=customPack(),item=pack.objects[npc.id];
  expect(()=>validateGraphics(pack,dimensions)).not.toThrow();
  expect(npcClip(item,'idle')).toBeUndefined();expect(npcClip(item,'talk')).toBeUndefined();
  const talk={image:item.image,frameWidth:64,frameHeight:96,row:1,frames:4,fps:6};
  item.animations={talk};expect(npcClip(item,'idle')).toBeUndefined();expect(npcClip(item,'talk')).toBe(talk);
  item.animations={idle:talk};expect(npcClip(item,'talk')).toBe(talk);
  const idle={...talk,fps:4};item.animations={idle,talk};
  expect(npcClip(item,'talk')).toBe(talk);expect(npcClip(item,'idle')).toBe(idle);
  expect(()=>validateGraphics(pack,dimensions)).not.toThrow();
 });
 it('rejects overflowing PNJ frames, floor crops and missing player directions',()=>{
  const pack=customPack(),item=pack.objects[npc.id];
  item.animations={talk:{image:item.image,frameWidth:64,frameHeight:96,row:0,frames:64,fps:6}};
  expect(()=>validateGraphics(pack,dimensions)).toThrow('PNJ sale de su hoja');
  delete item.animations;pack.tileFrames!.office=[60,0,64,32];
  expect(()=>validateGraphics(pack,dimensions)).toThrow('recorte');
  delete pack.tileFrames;pack.players!['custom.player'].character.animations.walk.row=4;
  expect(()=>validateGraphics(pack,dimensions)).toThrow('cuatro filas');
 });
 it('requires all six global player actions and a valid active player',()=>{
  const pack=customPack();pack.activePlayer='custom.missing';
  expect(()=>validateGraphics(pack,dimensions)).toThrow('jugador activo');
  pack.activePlayer='custom.player';delete (pack.players!['custom.player'].character.animations as Partial<typeof pack.character.animations>).talk;
  expect(()=>validateGraphics(pack,dimensions)).toThrow('talk');
 });
 it('requires graphics for each custom catalogue entry even before placement',()=>{
  const adventure=parseAdventure({...createAdventure([empty]),catalog:[object]});
  expect(()=>validateCatalogGraphics(adventure,graphics)).toThrow('Taquilla');
 });
});
it('round-trips originals, custom catalogue, NPC clips, player selection, scale and floor crops in a ZIP',async()=>{
 const base=customPack(),guide=base.objects[npc.id];
 guide.animations={talk:{image:base.character.animations.talk.image!,frameWidth:64,frameHeight:96,row:0,frames:4,fps:8}};
 const source=mapImages(base,url=>'asset:'+url),before=JSON.stringify(source);
 const adventure=parseAdventure({...createAdventure([empty]),catalog:[object,npc]});
 const blob=await exportAdventure(adventure,{pack:async()=>source,blob:async id=>new Blob([readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));
 expect(restored.adventure.catalog).toEqual([object,npc]);
 expect(restored.pack.objects[npc.id]).toMatchObject({width:64,height:96,origin:[32,80],frame:[0,96,64,96],animations:{talk:{frames:4,fps:8}}});
 expect(restored.pack.activePlayer).toBe('custom.player');
 expect(restored.pack.players!['custom.player'].character.scale).toBe(1.5);
 expect(restored.pack.tileFrames).toEqual(base.tileFrames);
 expect(imageUrls(restored.pack).every(url=>url.startsWith('asset:'))).toBe(true);
 const original=readFileSync('static'+guide.image);
 const saved=new Uint8Array(await restored.blobs[restored.pack.objects[npc.id].image.slice(6)].arrayBuffer());
 expect(saved).toEqual(new Uint8Array(original));
 expect(JSON.stringify(source)).toBe(before);
});
