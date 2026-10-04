import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateObjectImageRequest,objectImagePlan,processObjectFrame,type ObjectImageRequest} from '../src/lib/workshop/object-generation';
import {createObjectImageService} from '../src/lib/server/object-images';
import {pngUrl} from '../packages/character-generator/src/generation';
import {emptyFrame,bounds} from '../packages/character-generator/src/pipeline';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {createAdventure} from '../src/lib/demo/adventure';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {imageUrls,mapImages} from '../src/lib/storage/local-adventures';
import {validateGraphics} from '../packages/world/src/graphics-validation';
const image=pngUrl(new Uint8Array(readFileSync('static'+graphics.objects['pixel.key'].image)));
const request=():ObjectImageRequest=>({description:'Cofre de madera',style:'Pixel art terroso',direction:'se',width:96,height:64,footprint:{x:2,y:1},quality:'low'});
describe('object image generation',()=>{
 it('plans one prop with target dimensions, footprint and optional style reference',()=>{
  const plan=objectImagePlan(request());expect(plan.size).toBe('1536x1024');expect(plan.prompt).toContain('96 by 64');expect(plan.prompt).toContain('2 by 1');expect(plan.prompt).toContain('ONE isolated game prop');expect(plan.prompt).toContain('#FF00FF');
  expect(objectImagePlan({...request(),height:160}).size).toBe('1024x1536');
  expect(objectImagePlan({...request(),reference:image}).prompt).toContain('reference for material, palette');
 });
 it('rejects malformed settings and remote references before spending a request',async()=>{
  const fetcher=vi.fn(),generate=createObjectImageService(fetcher);
  for(const change of [{description:''},{width:0},{height:1024},{width:3.5},{direction:'constructor'},{footprint:{x:0,y:1}},{quality:'ultra'},{reference:'https://example.org/object.png'}])await expect(generate({...request(),...change},{apiKey:'test-only'})).rejects.toMatchObject({status:400});
  expect(fetcher).not.toHaveBeenCalled();expect(validateObjectImageRequest(request())).toEqual(request());
 });
 it('uses the existing private image transport for new images and references',async()=>{
  const fetcher=vi.fn(async()=>Response.json({data:[{b64_json:image.slice(22)}]}));const generate=createObjectImageService(fetcher);
  const result=await generate(request(),{apiKey:'test-only'});
  const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://api.openai.com/v1/images/generations');expect(JSON.parse(init.body as string)).toMatchObject({n:1,background:'opaque',size:'1536x1024'});expect(result.image).toBe(image);
  await generate({...request(),reference:image},{apiKey:'test-only'});const [editUrl,editInit]=fetcher.mock.calls[1] as unknown as [string,RequestInit];expect(editUrl).toContain('/images/edits');expect((editInit.body as FormData).getAll('image[]')).toHaveLength(1);
 });
 it('rejects missing configuration and does not retry paid failures',async()=>{
  const fetcher=vi.fn(async()=>new Response('error',{status:429}));const generate=createObjectImageService(fetcher);
  await expect(generate(request(),{})).rejects.toMatchObject({status:503});expect(fetcher).not.toHaveBeenCalled();
  await expect(generate(request(),{apiKey:'test-only'})).rejects.toMatchObject({status:429});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('removes chroma and fits original pixels directly into the requested output without changing proportions',()=>{
  const frame=emptyFrame(400,400);for(let i=0;i<frame.data.length;i+=4)frame.data.set([255,0,255,255],i);
  for(let y=100;y<300;y++)for(let x=50;x<350;x++)frame.data.set([140,90+x%16,30,255],(y*400+x)*4);
  const result=processObjectFrame(frame,96,64,{background:'magenta',tolerance:90,colors:16}),box=bounds(result)!;
  expect([result.width,result.height]).toEqual([96,64]);expect([box.right-box.left+1,box.height,box.bottom]).toEqual([90,60,61]);expect(result.data[3]).toBe(0);expect(frame.data[3]).toBe(255);
  const colors=new Set<string>();for(let i=0;i<result.data.length;i+=4)if(result.data[i+3])colors.add([...result.data.slice(i,i+3)].join(','));expect(colors.size).toBeLessThanOrEqual(16);
 });
 it('preserves full-resolution generation sources through ZIP export and import independently of Piskel originals',async()=>{
  const pack=structuredClone(graphics),key=pack.objects['pixel.key'];key.generationImage=graphics.objects['pixel.desk'].image;
  const sizes=new Map(imageUrls(pack).map(url=>[url,pngSize(readFileSync('static'+url))]));expect(()=>validateGraphics(pack,sizes)).not.toThrow();
  const portable=mapImages(pack,url=>'asset:'+url);expect(imageUrls(portable)).toContain('asset:'+key.generationImage);
  const zip=await exportAdventure(createAdventure([office]),{pack:async()=>portable,blob:async id=>new Blob([readFileSync('static'+id)])});
  const loaded=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));const raw=loaded.pack.objects['pixel.key'].generationImage!;
  expect(new Uint8Array(await loaded.blobs[raw.slice(6)].arrayBuffer())).toEqual(new Uint8Array(readFileSync('static'+key.generationImage)));
  expect(loaded.pack.objects['pixel.key'].origin).toEqual(key.origin);expect(loaded.pack.objects['pixel.key'].width).toBe(key.width);
  key.generationImage='asset:missing';expect(()=>validateGraphics(pack,sizes)).toThrow('Falta una imagen');
 });
});
