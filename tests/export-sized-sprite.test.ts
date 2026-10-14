import {expect,it} from 'vitest';
import {sizedSprite} from '../src/lib/workshop/export-sized-sprite';
it('exports only the selected atlas crop at world dimensions, preserving alpha and the source',()=>{
 const source={width:4,height:2,data:new Uint8ClampedArray(32)};for(let i=0;i<8;i++)source.data.set([i,20,30,i%2?128:255],i*4);
 const before=source.data.slice(),result=sizedSprite(source,[1,0,2,2],1,2);
 expect(result.width).toBe(1);expect(result.height).toBe(2);expect([...result.data]).toEqual([2,20,30,255,6,20,30,255]);expect(source.data).toEqual(before);
 const expanded=sizedSprite(source,[1,0,1,1],2,2);expect([...expanded.data]).toEqual(Array(4).fill([1,20,30,128]).flat());
});
it('rounds fractional world dimensions and rejects invalid crops or oversized output',()=>{
 const source={width:4,height:2,data:new Uint8ClampedArray(32)};
 expect(sizedSprite(source,[0,0,4,2],2.4,1.6)).toMatchObject({width:2,height:2});
 for(const crop of [[-1,0,2,2],[0,0,5,2],[0,0,2.5,2]])expect(()=>sizedSprite(source,crop,2,2)).toThrow();
 for(const width of [0,NaN,4097])expect(()=>sizedSprite(source,[0,0,4,2],width,2)).toThrow();
});

it('keeps the reduction backup through resource export and excludes it from public gameplay',async()=>{
 const {graphics}=await import('../src/lib/demo/pixelart');
 const {packResource,instantiateResource}=await import('../src/lib/workshop/shared-resource');
 const {publicGraphics}=await import('../src/lib/server/platform/publication-state');
 const {validateObjectGraphics}=await import('../packages/world/src/graphics-validation');
 const {readFile}=await import('node:fs/promises');
 const {encodePalettePNG}=await import('../src/lib/workshop/palette-browser');
 const original=structuredClone(graphics.objects['pixel.key']),image='asset:reduced-fixture';
 const object={...original,image,width:2,height:2,frame:[0,0,2,2] as [number,number,number,number],reductionOriginal:{image:original.image,frame:[0,0,1,1] as [number,number,number,number],width:original.width,height:original.height,origin:original.origin}};
 delete object.originalImage;
 const blob=new Blob([new Uint8Array(encodePalettePNG({width:2,height:2,data:new Uint8ClampedArray(16)}))],{type:'image/png'});
 const archive=await packResource({format:'isometric-resource',version:1,kind:'object',name:'Reducida',category:'office',size:{x:1,y:1},object},async url=>url===image?blob:new Blob([new Uint8Array(await readFile('static'+url))]));
 const copy=instantiateResource(archive);
 expect(copy.resource.object?.reductionOriginal).toMatchObject({width:original.width,height:original.height,origin:original.origin});
 expect(copy.resource.object?.reductionOriginal?.image).not.toBe(original.image);
 const pack=structuredClone(graphics);pack.objects['custom.reduced']=object;
 expect(publicGraphics(pack).objects['custom.reduced'].reductionOriginal).toBeUndefined();
 const sizes=new Map([[image,{width:2,height:2}],[original.image,{width:32,height:32}]]);
 expect(()=>validateObjectGraphics(object,sizes)).not.toThrow();
 expect(()=>validateObjectGraphics({...object,reductionOriginal:{...object.reductionOriginal,frame:[0,0,99,99]}},sizes)).toThrow();
});
