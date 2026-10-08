import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {unzlibSync} from 'fflate';
import {replaceFrameColors,validateColorReplacements,collectSpriteColors,colorVariantResource} from '../src/lib/workshop/color-variant';
import {defaultAdventurePalette} from '../src/lib/demo/adventure-palette';
import {graphics} from '../src/lib/demo/pixelart';
import {standaloneCharacter,workshopNpc} from '../src/lib/workshop/resources';
import {resourceImages} from '../src/lib/workshop/palette';
import {encodePalettePNG,replacedColorsPNG} from '../src/lib/workshop/palette-browser';
import {createAdventure} from '../src/lib/demo/adventure';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {parseScene} from '../packages/world/src/scene';
import type {PaletteResource} from '../src/lib/workshop/palette';

describe('color variants',()=>{
 it('replaces exact source colors simultaneously and retains geometry, partial alpha and transparent RGB',()=>{
  const frame={width:4,height:1,data:new Uint8ClampedArray([255,0,0,128,0,0,255,1,254,0,0,255,255,0,0,0])},original=frame.data.slice();
  const result=replaceFrameColors(frame,[{from:'#FF0000',to:'#0000ff'},{from:'#0000ff',to:'#00ff00'}]);
  expect(result.width).toBe(4);expect(result.height).toBe(1);
  expect([...result.data]).toEqual([0,0,255,128,0,255,0,1,254,0,0,255,255,0,0,0]);expect(frame.data).toEqual(original);
  expect(replaceFrameColors(frame,[]).data).toEqual(original);
 });
 it('rejects ambiguous mappings and destinations outside the adventure palette',()=>{
  const palette=defaultAdventurePalette();
  expect(validateColorReplacements([{from:'#FF0000',to:palette.colors[0].toUpperCase()}],palette)).toEqual([{from:'#ff0000',to:palette.colors[0]}]);
  expect(()=>validateColorReplacements([{from:'#ff0000',to:palette.colors[0]},{from:'#FF0000',to:palette.colors[1]}],palette)).toThrow('una sola vez');
  expect(()=>validateColorReplacements([{from:'#ff0000',to:'#000000'}],palette)).toThrow('paleta');
  expect(()=>validateColorReplacements([{from:'red',to:'#000000'}])).toThrow('HEX');
  expect(()=>replaceFrameColors({width:3,height:1,data:new Uint8ClampedArray(4)},[])).toThrow('Imagen');
 });
 it('collects used RGB across animation sheets without including transparent background colors',()=>{
  const one={width:3,height:1,data:new Uint8ClampedArray([255,0,0,255,255,0,0,1,0,255,0,0])};
  const two={width:2,height:1,data:new Uint8ClampedArray([0,0,255,255,255,0,0,128])};
  expect(collectSpriteColors([one,two])).toEqual([{color:'#ff0000',pixels:3},{color:'#0000ff',pixels:1}]);
 });
 it('replaces shared player atlases once and retains every action, direction, FPS, scale and pivot',()=>{
  const character=standaloneCharacter(graphics.character,'728da5'),resource:PaletteResource={kind:'player',character,item:graphics.objects['pixel.desk'],tileImage:''},original=structuredClone(resource);
  const images=resourceImages(resource),mapping=Object.fromEntries(images.map((url,i)=>[url,`asset:variant-${i}`])),variant=colorVariantResource(resource,mapping);
  expect(resourceImages(variant)).toEqual(images.map(url=>mapping[url]));expect(resource).toEqual(original);
  expect(variant.character.anchor).toEqual(character.anchor);expect(variant.character.scale).toEqual(character.scale);expect(variant.character.directions).toEqual(character.directions);
  for(const action of Object.keys(character.animations) as Array<keyof typeof character.animations>){expect(variant.character.animations[action]).toEqual({...character.animations[action],image:mapping[character.animations[action].image!]});}
  expect(()=>colorVariantResource(resource,{})).toThrow('Falta una hoja');
 });
 it('keeps NPC rows, dimensions, world support and static image linked to the same recolored atlas',()=>{
  const item=workshopNpc(graphics,'pixel.person-lucia'),resource:PaletteResource={kind:'npc',item,character:graphics.character,tileImage:''},mapping=Object.fromEntries(resourceImages(resource).map((url,i)=>[url,`asset:npc-${i}`]));
  const variant=colorVariantResource(resource,mapping);
  expect(variant.item).toEqual({...item,image:mapping[item.image],animations:Object.fromEntries(Object.entries(item.animations!).map(([action,clip])=>[action,{...clip,image:mapping[clip.image]}]))});
 });
 it('encodes all rows without changing unmatched pixels or introducing cascaded replacements',async()=>{
  const frame={width:2,height:2,data:new Uint8ClampedArray([255,0,0,1,0,0,255,128,255,0,0,255,20,30,40,255])};
  const bytes=new Uint8Array(await (await replacedColorsPNG(frame,[{from:'#ff0000',to:'#0000ff'},{from:'#0000ff',to:'#00ff00'}])).arrayBuffer());
  let p=8,scanlines:Uint8Array|undefined;while(p<bytes.length){const size=new DataView(bytes.buffer,p,4).getUint32(0);if(String.fromCharCode(...bytes.subarray(p+4,p+8))==='IDAT')scanlines=unzlibSync(bytes.subarray(p+8,p+8+size));p+=size+12;}
  expect([...scanlines!]).toEqual([0,0,0,255,1,0,255,0,128,0,0,0,255,255,20,30,40,255]);
  const controller=new AbortController();controller.abort();await expect(replacedColorsPNG(frame,[],controller.signal)).rejects.toThrow();
 });
 it('exports the independent variant and original through the existing adventure ZIP format',async()=>{
  const pack=structuredClone(graphics),original=structuredClone(pack.objects['pixel.desk']),dimensions=pngSize(readFileSync('static'+original.image)),frame={...dimensions,data:new Uint8ClampedArray(dimensions.width*dimensions.height*4)};
  frame.data.set([255,0,0,128]);const png=encodePalettePNG(replaceFrameColors(frame,[{from:'#ff0000',to:'#0000ff'}]));
  pack.objects['custom.blue-desk']={...original,image:'asset:blue-desk',originalImage:original.image};
  const empty=parseScene({schemaVersion:1,id:'empty',name:'Prueba',theme:'office',width:10,height:10,spawn:{x:0,y:0},entities:[]});
  const adventure=createAdventure([empty]);adventure.catalog=[{id:'custom.blue-desk',label:'Mesa azul',kind:'object',category:'office',size:{x:1,y:1}}];
  const source=mapImages(pack,url=>url.startsWith('asset:')?url:'asset:'+url),before=JSON.stringify(source);
  const exported=await exportAdventure(adventure,{pack:async()=>source,blob:async id=>id==='blue-desk'?new Blob([new Uint8Array(png)],{type:'image/png'}):new Blob([readFileSync('static'+id)])});
  const imported=unpackAdventure(new Uint8Array(await exported.arrayBuffer()));expect(imported.pack.objects['pixel.desk'].origin).toEqual(original.origin);expect(imported.pack.objects['custom.blue-desk'].origin).toEqual(original.origin);
  const sizes=new Map(await Promise.all(imageUrls(imported.pack).map(async url=>[url,pngSize(new Uint8Array(await imported.blobs[url.slice(6)].arrayBuffer()))] as const)));expect(()=>validateGraphics(imported.pack,sizes)).not.toThrow();
  expect(imported.pack.objects['custom.blue-desk'].image).not.toBe(imported.pack.objects['pixel.desk'].image);
  expect(new Uint8Array(await imported.blobs[imported.pack.objects['pixel.desk'].image.slice(6)].arrayBuffer())).toEqual(new Uint8Array(readFileSync('static'+original.image)));
  expect(new Uint8Array(await imported.blobs[imported.pack.objects['custom.blue-desk'].image.slice(6)].arrayBuffer())).toEqual(png);expect(JSON.stringify(source)).toBe(before);
 });
});
