import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateTileImageRequest,tileImagePlan,processTileFrame} from '../src/lib/workshop/tile-generation';
import {createTileImageService} from '../src/lib/server/tile-images';
import {createTileBase} from '../src/lib/workshop/tile-base';
import {defaultAdventurePalette} from '../src/lib/demo/adventure-palette';
import {emptyFrame} from '../packages/character-generator/src/pipeline';
import {pngUrl} from '../packages/character-generator/src/generation';
import {encodePalettePNG} from '../src/lib/workshop/palette-browser';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {mapImages} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
const request={description:'Piedra volcánica con musgo',style:'Pixel art',quality:'low' as const};
function material(){const frame=emptyFrame(128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++)frame.data.set([60+x,60+y,80,255],(y*128+x)*4);return frame;}

it('requests an opaque repeating surface, with palette and optional material reference',()=>{
 const palette=defaultAdventurePalette(),plan=tileImagePlan({...request,palette,reference:'reference'});
 expect(plan.size).toBe('1024x1024');expect(plan.prompt).toContain('seamlessly in both axes');expect(plan.prompt).toContain('Do NOT draw an isometric diamond');expect(plan.prompt).toContain('64 by 32');expect(plan.prompt).toContain(palette.colors.join(', '));expect(plan.prompt).toContain('material and color reference only');
 expect(validateTileImageRequest(request)).toEqual(request);
});
it('rejects invalid requests before contacting the paid provider',async()=>{
 const fetcher=vi.fn(),generate=createTileImageService(fetcher);
 for(const patch of [{description:''},{style:' '},{quality:'ultra'},{palette:{colors:[]}},{reference:'https://example.com/image.png'}])await expect(generate({...request,...patch},{apiKey:'test'})).rejects.toMatchObject({status:400});
 expect(fetcher).not.toHaveBeenCalled();
});
it('uses the existing private transport for floor generation and reference edits without retries',async()=>{
 const image=pngUrl(encodePalettePNG(material())),fetcher=vi.fn(async()=>Response.json({data:[{b64_json:image.slice(22)}]})),generate=createTileImageService(fetcher);
 expect((await generate(request,{apiKey:'test'})).image).toBe(image);
 const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toContain('/images/generations');expect(JSON.parse(init.body as string)).toMatchObject({size:'1024x1024',background:'opaque',n:1});
 await generate({...request,reference:image},{apiKey:'test'});
 const [editUrl,editInit]=fetcher.mock.calls[1] as unknown as [string,RequestInit];expect(editUrl).toContain('/images/edits');expect((editInit.body as FormData).getAll('image[]')).toHaveLength(1);
 fetcher.mockImplementation(async()=>new Response('',{status:429}));await expect(generate(request,{apiKey:'test'})).rejects.toMatchObject({status:429});expect(fetcher).toHaveBeenCalledTimes(3);
});
it('projects an opaque material onto the exact gap-free 64×32 floor mask without modifying the source',()=>{
 const source=material(),before=source.data.slice(),result=processTileFrame(source,{colors:16}),mask=createTileBase();
 expect(pngSize(encodePalettePNG(result))).toEqual({width:64,height:32});
 const colors=new Set<string>();for(let i=0;i<result.data.length;i+=4){expect(result.data[i+3]).toBe(mask.data[i+3]);if(result.data[i+3])colors.add([...result.data.subarray(i,i+3)].join(','));}
 expect(colors.size).toBeLessThanOrEqual(16);expect(source.data).toEqual(before);
});
it('maps to the adventure palette and rejects transparent holes or invalid processing settings',()=>{
 const source=material(),palette=defaultAdventurePalette(),result=processTileFrame(source,{colors:28,palette});
 for(let i=0;i<result.data.length;i+=4)if(result.data[i+3])expect(palette.colors).toContain('#'+[...result.data.subarray(i,i+3)].map(n=>n.toString(16).padStart(2,'0')).join(''));
 expect(()=>processTileFrame(source,{colors:NaN})).toThrow('colores');
 source.data.fill(0);expect(()=>processTileFrame(source,{colors:28})).toThrow('transparencia');
 expect(()=>processTileFrame({...source,width:0},{colors:28})).toThrow('Textura');
});
it('round-trips generated tiles through an adventure ZIP with their normal frame and family',async()=>{
 const bytes=encodePalettePNG(processTileFrame(material(),{colors:28})),pack=mapImages(graphics,url=>'asset:'+url);
 pack.tiles['custom.ai-floor']='asset:generated';pack.tileFrames={...pack.tileFrames,'custom.ai-floor':[0,0,64,32]};pack.tileNames={...pack.tileNames,'custom.ai-floor':'Piedra'};pack.tileFamilies={'family.ai':{name:'Piedra',tiles:{'custom.ai-floor':100}}};
 const zip=await exportAdventure(createAdventure([office]),{pack:async()=>pack,blob:async id=>new Blob([new Uint8Array(id==='generated'?bytes:readFileSync('static'+id))])});
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer())),id=restored.pack.tiles['custom.ai-floor'].slice(6);
 expect(new Uint8Array(await restored.blobs[id].arrayBuffer())).toEqual(bytes);expect(restored.pack.tileFrames?.['custom.ai-floor']).toEqual([0,0,64,32]);expect(restored.pack.tileFamilies).toEqual(pack.tileFamilies);
});
