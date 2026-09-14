import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {zipSync,unzipSync,strFromU8,strToU8} from 'fflate';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {mapImages,imageUrls,type AdventureRepository} from '../src/lib/storage/local-adventures';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure} from '../src/lib/demo/adventure';
import {office,outdoors} from '../src/lib/demo/scenes';
const adventure=createAdventure([office,outdoors]);
const pack=mapImages(graphics,url=>'asset:'+url);
const repository={pack:async()=>pack,blob:async(id:string)=>new Blob([readFileSync('static'+id)])} satisfies Pick<AdventureRepository,'pack'|'blob'>;
async function archive(){return new Uint8Array(await (await exportAdventure(adventure,repository)).arrayBuffer());}
it('exports every image and imports a portable adventure without server paths or progress',async()=>{
 const bytes=await archive(),restored=unpackAdventure(bytes);
 expect(restored.adventure).toEqual(adventure);
 expect(imageUrls(restored.pack).every(url=>url.startsWith('asset:'))).toBe(true);
 expect(Object.keys(restored.blobs)).toHaveLength(imageUrls(graphics).length);
 const files=unzipSync(bytes),manifest=JSON.parse(strFromU8(files['manifest.json']));
 expect(Object.keys(manifest).sort()).toEqual(['adventure','graphics','kind','version']);
 expect(Object.keys(files)).toHaveLength(imageUrls(graphics).length+1);
});
it('rejects missing resources and unsupported versions before saving',async()=>{
 const files=unzipSync(await archive());delete files['assets/0.png'];
 expect(()=>unpackAdventure(zipSync(files))).toThrow('Falta un recurso');
 const manifest=JSON.parse(strFromU8(files['manifest.json']));manifest.version=999;files['manifest.json']=strToU8(JSON.stringify(manifest));
 expect(()=>unpackAdventure(zipSync(files))).toThrow('Versión');
});
it('rejects external URLs, invalid frame ranges and path traversal',async()=>{
 const files=unzipSync(await archive()),manifest=JSON.parse(strFromU8(files['manifest.json']));
 manifest.graphics.character.image='https://example.com/tracking.png';files['manifest.json']=strToU8(JSON.stringify(manifest));
 expect(()=>unpackAdventure(zipSync(files))).toThrow('Falta un recurso');
 manifest.graphics.character.image='assets/0.png';manifest.graphics.character.animations.walk.frames=64;files['manifest.json']=strToU8(JSON.stringify(manifest));
 expect(()=>unpackAdventure(zipSync(files))).toThrow('sale de su hoja');
 files['../secret.png']=new Uint8Array();expect(()=>unpackAdventure(zipSync(files))).toThrow('ruta');
});
it('rejects excessive decompressed data and non-PNG images',()=>{
 expect(()=>unpackAdventure(zipSync({'manifest.json':new Uint8Array(10_000_001)}))).toThrow('límites');
 expect(()=>pngSize(strToU8('<svg></svg>'))).toThrow('PNG');
});
it('does not mutate the source catalogue when resolving or replacing images',()=>{
 const before=JSON.stringify(graphics);mapImages(graphics,()=> 'asset:replacement');
 expect(JSON.stringify(graphics)).toBe(before);
});
