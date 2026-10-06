import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {unzlibSync} from 'fflate';
import {defaultAdventurePalette,validateAdventurePalette,importPalette,paletteRGB} from '../src/lib/demo/adventure-palette';
import {adaptFrame,mapResourceImages,resourceImages,prunePaletteOriginals,paletteFromColors} from '../src/lib/workshop/palette';
import {encodePalettePNG,adaptedPNG} from '../src/lib/workshop/palette-browser';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {processObjectFrame,objectImagePlan,validateObjectImageRequest} from '../src/lib/workshop/object-generation';
import {emptyFrame} from '../packages/character-generator/src/pipeline';

const palette=defaultAdventurePalette();
it('defines 64 distinct editable colors, imports HEX/JSON and keeps legacy adventures valid',()=>{
 expect(validateAdventurePalette(palette).colors).toHaveLength(64);expect(new Set(palette.colors).size).toBe(64);
 expect(importPalette(JSON.stringify(palette))).toEqual(palette);
 expect(importPalette(palette.colors.join('\n')).colors).toEqual(palette.colors);
 const adventure=createAdventure([office]);expect(adventure.palette).toEqual(palette);
 const legacy={...adventure};delete legacy.palette;expect(parseAdventure(legacy).palette).toBeUndefined();
 expect(parseAdventure({...adventure,palette}).palette).toEqual(palette);
 for(const p of [{...palette,colors:palette.colors.slice(1)},{...palette,colors:Array(64).fill('#000000')},{...palette,name:''},{...palette,version:2},{...palette,colors:[...palette.colors.slice(1),'red']}])expect(()=>parseAdventure({...adventure,palette:p})).toThrow('64 colores');
 expect(paletteFromColors(['#123456'],palette).colors).toHaveLength(64);
});

it('maps visible pixels perceptually into the fixed palette without changing alpha, dimensions or input',()=>{
 const data=new Uint8ClampedArray([181,46,121,255,33,58,87,128,11,27,90,1,255,0,255,0]),frame={width:2,height:2,data},before=data.slice();
 const mapped=adaptFrame(frame,palette),allowed=new Set(paletteRGB(palette).map(c=>c.join(',')));
 expect(mapped.width).toBe(2);expect(mapped.height).toBe(2);expect(frame.data).toEqual(before);
 for(let i=0;i<data.length;i+=4){expect(mapped.data[i+3]).toBe(data[i+3]);if(data[i+3])expect(allowed.has([...mapped.data.slice(i,i+3)].join(','))).toBe(true);else expect(mapped.data.slice(i,i+4)).toEqual(data.slice(i,i+4));}
 expect(adaptFrame(mapped,palette)).toEqual(mapped);
 expect(()=>adaptFrame({...frame,width:3},palette)).toThrow('Imagen');
});

it('encodes exact palette RGB and translucent alpha rather than canvas premultiplication rounding',()=>{
 const frame=adaptFrame({width:2,height:2,data:new Uint8ClampedArray([33,58,87,1,180,30,20,128,120,91,38,255,0,0,0,0])},palette),png=encodePalettePNG(frame);
 expect(pngSize(png)).toEqual({width:2,height:2});
 const view=new DataView(png.buffer);let offset=8,scanlines=new Uint8Array();
 while(offset<png.length){const size=view.getUint32(offset),type=new TextDecoder().decode(png.slice(offset+4,offset+8));if(type==='IDAT')scanlines=unzlibSync(png.slice(offset+8,offset+8+size));offset+=size+12;}
 expect(scanlines).toEqual(new Uint8Array([0,...frame.data.slice(0,8),0,...frame.data.slice(8)]));
});
it('yields processing without requiring a visible tab and supports disposal cancellation',async()=>{
 const frame={width:2,height:1,data:new Uint8ClampedArray([44,67,123,128,120,50,33,255])},result=await adaptedPNG(frame,palette);
 expect(result.frame).toEqual(adaptFrame(frame,palette));expect(pngSize(new Uint8Array(await result.blob.arrayBuffer()))).toEqual({width:2,height:1});
 const controller=new AbortController();controller.abort();await expect(adaptedPNG(frame,palette,controller.signal)).rejects.toThrow();
});

it('replaces all player directions, variants and action sheets while preserving grid, FPS, scale and anchor',()=>{
 const character=structuredClone(graphics.character);character.variants={blue:'asset:blue'};character.animations.walk.variants={blue:'asset:walk-blue'};
 const resource={kind:'player' as const,character,item:graphics.objects['pixel.key'],tileImage:''},before=structuredClone(resource),images=resourceImages(resource);
 expect(images).toContain('asset:walk-blue');expect(images).toContain('asset:blue');
 const mapped=mapResourceImages(resource,u=>'adapted:'+u);
 expect(mapped.character.anchor).toEqual(character.anchor);expect(mapped.character.frameWidth).toBe(character.frameWidth);expect(mapped.character.animations.walk.fps).toBe(character.animations.walk.fps);
 expect(resourceImages(mapped)).toEqual(images.map(u=>'adapted:'+u));expect(resource).toEqual(before);expect(mapped.item).toEqual(resource.item);
});

it('adapts every NPC clip and preserves original/generation references and world geometry',()=>{
 const item={...graphics.objects['pixel.key'],originalImage:'asset:old',generationImage:'asset:raw',animations:{idle:{image:'asset:idle',frameWidth:32,frameHeight:64,row:1,frames:4,fps:7},talk:{image:'asset:talk',frameWidth:32,frameHeight:64,row:0,frames:2,fps:4}}},resource={kind:'npc' as const,item,character:graphics.character,tileImage:''};
 const mapped=mapResourceImages(resource,u=>'new:'+u);expect(mapped.item).toEqual({...item,image:'new:'+item.image,animations:{idle:{...item.animations.idle,image:'new:asset:idle'},talk:{...item.animations.talk,image:'new:asset:talk'}}});
 expect(mapResourceImages({ ...resource,kind:'tile',tileImage:'asset:floor'},u=>'new:'+u).tileImage).toBe('new:asset:floor');
});

it('keeps restorable originals through adventure ZIP transfer, including mapping keys and metadata',async()=>{
 const key=graphics.objects['pixel.key'].image,bytes=readFileSync('static'+key),pack=structuredClone(graphics);pack.objects['pixel.key'].image='asset:adapted';pack.paletteOriginalImages={'asset:adapted':key};
 const adventure={...createAdventure([office]),palette},transport=mapImages(pack,u=>u.startsWith('/pixelart/')?'asset:'+u:u),zip=await exportAdventure(adventure,{pack:async()=>transport,blob:async id=>new Blob([id==='adapted'?bytes:readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer())),adapted=restored.pack.objects['pixel.key'].image,original=restored.pack.paletteOriginalImages![adapted];
 expect(restored.adventure.palette).toEqual(palette);expect(adapted).not.toBe(original);
 expect(new Uint8Array(await restored.blobs[original.slice(6)].arrayBuffer())).toEqual(new Uint8Array(bytes));
 expect(restored.pack.objects['pixel.key'].origin).toEqual(pack.objects['pixel.key'].origin);
 const portable=mapImages(pack,u=>'portable:'+u);expect(portable.paletteOriginalImages!['portable:asset:adapted']).toBe('portable:'+key);expect(imageUrls(portable)).toContain('portable:'+key);
});

it('rejects incomplete, mismatched or cyclic originals and prunes only obsolete adaptation history',()=>{
 const pack=structuredClone(graphics),key=pack.objects['pixel.key'].image,desk=pack.objects['pixel.desk'].image,sizes=new Map(imageUrls(pack).map(url=>[url,pngSize(readFileSync('static'+url))]));
 pack.paletteOriginalImages={[key]:'asset:missing'};expect(()=>validateGraphics(pack,sizes)).toThrow('Falta una imagen');
 pack.paletteOriginalImages={[key]:desk};expect(()=>validateGraphics(pack,sizes)).toThrow('mismas dimensiones');
 pack.paletteOriginalImages={[key]:key};expect(()=>validateGraphics(pack,sizes)).toThrow('Referencia original');
 pack.paletteOriginalImages={[key]:desk,[desk]:key};expect(()=>validateGraphics(pack,sizes)).toThrow('Referencia original');
 pack.paletteOriginalImages={[key]:'asset:original','asset:obsolete':'asset:old'};prunePaletteOriginals(pack);expect(pack.paletteOriginalImages).toEqual({[key]:'asset:original'});
 pack.objects['pixel.key'].originalImage='asset:backup';pack.paletteOriginalImages['asset:backup']='asset:before-backup';prunePaletteOriginals(pack);expect(pack.paletteOriginalImages['asset:backup']).toBe('asset:before-backup');
});

it('guides AI objects with the adventure palette and maps their final pixels after scaling, without extra quantization',()=>{
 const request={description:'Cofre',style:'Pixel art',direction:'se' as const,width:32,height:32,footprint:{x:1,y:1},quality:'low' as const,palette};
 expect(objectImagePlan(validateObjectImageRequest(request)).prompt).toContain(palette.colors.join(', '));
 expect(()=>validateObjectImageRequest({...request,palette:{...palette,colors:[]}})).toThrow('64 colores');
 const source=emptyFrame(32,32);for(let y=6;y<24;y++)for(let x=7;x<22;x++)source.data.set([100+x*3,30+y*2,40,255],(y*32+x)*4);
 const result=processObjectFrame(source,32,32,{background:'alpha',tolerance:0,colors:4,palette}),allowed=new Set(paletteRGB(palette).map(c=>c.join(',')));
 for(let i=0;i<result.data.length;i+=4)if(result.data[i+3])expect(allowed.has([...result.data.slice(i,i+3)].join(','))).toBe(true);
 expect(result.width).toBe(32);
});
