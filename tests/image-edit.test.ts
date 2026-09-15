import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {createAdventure} from '../src/lib/demo/adventure';
import {validateEditedImage,withEditedImage} from '../src/lib/workshop/image-edit';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';

const key=readFileSync('static'+graphics.objects['pixel.key'].image);
const size=pngSize(key);
const sizes=new Map(imageUrls(graphics).map(url=>[url,pngSize(readFileSync('static'+url))]));

it('accepts an edited PNG only at the original resolution',async()=>{
 await expect(validateEditedImage(new Blob([key]),size)).resolves.toEqual(size);
 await expect(validateEditedImage(new Blob([key]),{...size,width:size.width+1})).rejects.toThrow('tamaño');
 await expect(validateEditedImage(new Blob(['not a png']),size)).rejects.toThrow('PNG');
 await expect(validateEditedImage(new Blob([new Uint8Array(10_000_001)]),size)).rejects.toThrow('10 MB');
});

it('preserves crop, world size, pivot and optional NPC clips across repeated edits',()=>{
 const original={...graphics.objects['pixel.key'],frame:[8,4,24,16] as [number,number,number,number],width:48,height:32,origin:[11,23] as [number,number],animations:{idle:{image:'asset:idle',frameWidth:24,frameHeight:16,row:0,frames:3,fps:4}}};
 const before=structuredClone(original),first=withEditedImage(original,'asset:edit1'),second=withEditedImage(first,'asset:edit2');
 expect(second).toEqual({...original,image:'asset:edit2',originalImage:original.image});
 expect(original).toEqual(before);expect(first.image).toBe('asset:edit1');
});

it('validates original image references and rejects mismatched dimensions and orphan floors',()=>{
 const pack=structuredClone(graphics);
 pack.objects['pixel.key'].originalImage='asset:missing';
 expect(()=>validateGraphics(pack,sizes)).toThrow('Falta una imagen');
 pack.objects['pixel.key'].originalImage=graphics.objects['pixel.desk'].image;
 expect(()=>validateGraphics(pack,sizes)).toThrow('mismas dimensiones');
 delete pack.objects['pixel.key'].originalImage;
 pack.tileOriginalImages={'custom.missing':graphics.tiles.office};
 expect(()=>validateGraphics(pack,sizes)).toThrow('suelo que no existe');
 pack.tileOriginalImages={office:graphics.objects['pixel.desk'].image};
 expect(()=>validateGraphics(pack,sizes)).toThrow('mismas dimensiones');
});

it('carries edited pixels AND restorable originals through adventure ZIP export/import',async()=>{
 const source=structuredClone(graphics),originalFloor=source.tiles.office;
 source.objects['pixel.key']=withEditedImage(source.objects['pixel.key'],graphics.tiles.grass);
 source.tiles.office=graphics.tiles.path;
 source.tileOriginalImages={office:originalFloor};
 const snapshot=JSON.stringify(source),portable=mapImages(source,url=>'asset:'+url);
 expect(imageUrls(portable)).toContain('asset:'+source.objects['pixel.key'].originalImage);
 const zip=await exportAdventure(createAdventure([office]),{
  pack:async()=>portable,blob:async id=>new Blob([readFileSync('static'+id)])
 });
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));
 const bytes=async(url:string)=>new Uint8Array(await restored.blobs[url.slice(6)].arrayBuffer());
 const object=restored.pack.objects['pixel.key'];
 expect(await bytes(object.image)).toEqual(new Uint8Array(readFileSync('static'+graphics.tiles.grass)));
 expect(await bytes(object.originalImage!)).toEqual(new Uint8Array(key));
 expect(await bytes(restored.pack.tileOriginalImages!.office!)).toEqual(new Uint8Array(readFileSync('static'+originalFloor)));
 expect(object.width).toBe(source.objects['pixel.key'].width);
 expect(object.origin).toEqual(source.objects['pixel.key'].origin);
 expect(JSON.stringify(source)).toBe(snapshot);
});

it('keeps the deployed bridge identical to its source adapter',()=>{
 expect(readFileSync('static/tools/piskel/bridge.js','utf8')).toBe(readFileSync('vendor/piskel/bridge.js','utf8'));
 expect(readFileSync('static/tools/piskel/embed.css','utf8')).toBe(readFileSync('vendor/piskel/embed.css','utf8'));
 // Piskel has a nested HTML template; the real document must load the adapter stylesheet.
 expect(readFileSync('static/tools/piskel/index.html','utf8')).toMatch(/<link rel="stylesheet" href="embed.css">\s*<\/body>\s*<\/html>\s*$/);
});
