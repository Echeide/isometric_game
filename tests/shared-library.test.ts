import {describe,it,expect,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {graphics} from '../src/lib/demo/pixelart';
import {standaloneCharacter,workshopNpc} from '../src/lib/workshop/resources';
import {packResource,unpackResource,instantiateResource,addSharedResource,resourceImages,type SharedResource} from '../src/lib/workshop/shared-resource';
import {SharedLibrary} from '../src/lib/server/shared-library';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {imageUrls} from '../src/lib/storage/local-adventures';
import {pngSize} from '../src/lib/storage/adventure-package';
const read=async(url:string)=>new Blob([readFileSync('static'+url)],{type:'image/png'});
const object=():SharedResource=>({format:'isometric-resource',version:1,kind:'object',name:'Llave compartida',category:'office',size:{x:1,y:1},object:{...graphics.objects['pixel.key'],generationImage:graphics.objects['pixel.desk'].image}});
const folders:string[]=[];
afterEach(async()=>{await Promise.all(folders.splice(0).map(p=>rm(p,{recursive:true,force:true})));});
async function storage(){const path=await mkdtemp(join(tmpdir(),'sprite-library-test-'));folders.push(path);return new SharedLibrary(path);}
describe('shared sprite library',()=>{
 it('preserves a standalone object, its original and its geometry without unrelated assets',async()=>{
  const r=object(),bytes=await packResource(r,read),unpacked=unpackResource(bytes);expect(await packResource(r,read)).toEqual(bytes);expect(resourceImages(unpacked.resource)).toHaveLength(2);expect(Object.keys(unpacked.files)).toHaveLength(3);expect(unpacked.resource.object).toMatchObject({width:r.object!.width,origin:r.object!.origin});
  const a=instantiateResource(bytes),b=instantiateResource(bytes);expect(a.resource.object!.image).not.toBe(b.resource.object!.image);expect([...Object.values(a.blobs)].map(v=>v.size)).toEqual([...Object.values(b.blobs)].map(v=>v.size));
  const base=structuredClone(graphics),first=addSharedResource(base,[],a.resource,{id:'source',version:1}),second=addSharedResource(base,[],b.resource,{id:'source',version:1});expect(first.id).not.toBe(second.id);first.pack.objects[first.id].width=12;expect(second.pack.objects[second.id].width).toBe(r.object!.width);expect(base).toEqual(graphics);expect(first.pack.resourceOrigins?.[first.id]).toEqual({id:'source',version:1});
 });
 it('round-trips playable characters with every action, directional speeds, anchors and scale',async()=>{
  const character=standaloneCharacter(graphics.character,'728da5');character.scale=1.5;character.animations.walk.directionFps={se:7};const r:SharedResource={...object(),kind:'player',object:undefined,character};const bytes=await packResource(r,read),a=instantiateResource(bytes),added=addSharedResource(graphics,[],a.resource,{id:'player',version:1});
  expect(a.resource.character).toMatchObject({scale:1.5,anchor:character.anchor,animations:{walk:{directionFps:{se:7}}}});expect(Object.keys(a.resource.character!.animations)).toEqual(Object.keys(character.animations));expect(added.pack.activePlayer).toBeUndefined();
  const sizes=new Map();for(const url of imageUrls(added.pack)){const blob=url.startsWith('asset:')?a.blobs[url.slice(6)]:await read(url);sizes.set(url,pngSize(new Uint8Array(await blob.arrayBuffer())));}expect(()=>validateGraphics(added.pack,sizes)).not.toThrow();
 });
 it('preserves NPC clips and cropped tile originals',async()=>{
  const npc={...object(),kind:'npc' as const,object:graphics.objects['pixel.key']};
  // Find an actual built-in NPC rather than assuming its identifier.
  const {workshopEntries}=await import('../src/lib/workshop/resources');npc.object=workshopNpc(graphics,workshopEntries(graphics).find(e=>e.kind==='npc')!.id);
  expect(instantiateResource(await packResource(npc,read)).resource.object!.animations).toMatchObject({idle:{fps:npc.object.animations!.idle!.fps},talk:{frames:npc.object.animations!.talk!.frames}});
  const tile:SharedResource={...object(),kind:'tile',object:undefined,tile:{image:graphics.tiles.office,originalImage:graphics.tiles.office,frame:[0,0,32,16]}};const decoded=instantiateResource(await packResource(tile,read)),added=addSharedResource(graphics,[],decoded.resource,{id:'tile',version:1});expect(added.pack.tileFrames?.[added.id as keyof typeof added.pack.tiles]).toEqual([0,0,32,16]);expect(added.pack.tileOriginalImages?.[added.id as keyof typeof added.pack.tiles]).toBeDefined();
 });
 it('rejects bad sheets, missing images, external URLs and traversal archives',async()=>{
  const bytes=await packResource(object(),read),files=unzipSync(bytes),manifest=unpackResource(bytes).resource;
  const bad=(value:unknown)=>zipSync({...files,'resource.json':strToU8(JSON.stringify(value))});
  expect(()=>unpackResource(bad({...manifest,object:{...manifest.object,image:'https://example.org/image.png'}}))).toThrow();expect(()=>unpackResource(bad({...manifest,object:{...manifest.object,frame:[0,0,4096,4096]}}))).toThrow();expect(()=>unpackResource(bad({...manifest,kind:'player'}))).toThrow();expect(()=>unpackResource(zipSync({'../secret':strToU8('x')}))).toThrow();
  const missing={...files};delete missing['assets/0.png'];expect(()=>unpackResource(zipSync(missing))).toThrow();
 });
 it('persists across server restart, deduplicates concurrent saves and exports/imports an entire library',async()=>{
  const a=await storage(),bytes=await packResource(object(),read),saved=await Promise.all([a.save(bytes),a.save(bytes)]);expect(saved[0].id).toBe(saved[1].id);expect(await new SharedLibrary(a.directory).list()).toHaveLength(1);
  const archive=await a.export(),b=await storage();expect(await b.import(archive)).toBe(1);await b.import(archive);expect(await b.list()).toHaveLength(1);expect(await b.get(saved[0].id)).toEqual(bytes);await expect(b.get('../outside')).rejects.toThrow();
  const files=unzipSync(archive);files[`resources/${'0'.repeat(64)}.zip`]=bytes;await expect(b.import(zipSync(files))).rejects.toThrow('identificador');expect(await b.list()).toHaveLength(1);
 });
});
