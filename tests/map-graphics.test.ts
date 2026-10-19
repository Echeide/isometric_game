import {expect,it,vi} from 'vitest';
import {adventureEntry,mapGraphics,createMapGraphicsLoader} from '../src/lib/storage/map-graphics';
import {graphics} from '../src/lib/demo/pixelart';
import type {Adventure} from '../src/lib/demo/adventure';
import type {WorldScene} from '../packages/world/src/types';
const map=(id:string):WorldScene=>({id,name:id,theme:'outdoors',width:2,height:2,spawn:{x:0,y:0},entities:[{id:'box',kind:'object',label:'Box',position:{x:1,y:1},visualId:id}]});
const a:Adventure={kind:'isometric-adventure',version:1,id:'a',name:'A',startMap:'first',maps:[map('first'),map('second')],exits:[],story:{version:1,entities:[{mapId:'first',entityId:'box',states:[{id:'changed',name:'Changed',visualId:'changed'}],reactions:[]}]}};
const sprite=(image:string)=>({image,width:16,height:16,origin:[0,0] as [number,number]});
const pack={...graphics,objects:{first:sprite('/first.png'),second:sprite('/second.png'),changed:{...sprite('/changed.png'),originalImage:'/editor-only.png'}}};
it('selects the saved map before loading, supports preview and falls back for deleted maps',()=>{
 expect(adventureEntry(a,{savedMapId:'second'}).id).toBe('second');
 expect(adventureEntry(a,{previewMapId:'first',savedMapId:'second'}).id).toBe('first');
 expect(adventureEntry(a,{savedMapId:'deleted'}).id).toBe('first');
});
it('keeps narrative appearances and excludes other maps and editing originals',()=>{
 const selected=mapGraphics(pack,a,a.maps[0]);
 expect(Object.keys(selected.objects)).toEqual(['first','changed']);
 expect(selected.objects.changed.originalImage).toBeUndefined();
 expect(Object.keys(selected.tiles)).toEqual(['grass']);
});
it('loads only the entry resources, shares downloads across maps and releases URLs',async()=>{
 const load=vi.fn(async(_url:string)=>new Blob(['image'])),controller=new AbortController();
 const loader=createMapGraphicsLoader(pack,a,load,controller.signal);
 await loader.ensure(a.maps[0]);
 expect(load.mock.calls.map(args=>args[0])).not.toContain('/second.png');
 const before=load.mock.calls.length;
 await loader.ensure(a.maps[1]);
 expect(load.mock.calls.length).toBe(before+1);
 loader.release();await expect(loader.ensure(a.maps[0])).rejects.toThrow('Closed');
});
it('retries failed downloads on entry',async()=>{
 const load=vi.fn(async(url:string)=>{if(url==='/first.png'&&load.mock.calls.filter(args=>args[0]===url).length===1)throw Error('offline');return new Blob(['image']);});
 const loader=createMapGraphicsLoader(pack,a,load,new AbortController().signal);
 await expect(loader.ensure(a.maps[0])).rejects.toThrow('offline');
 await expect(loader.ensure(a.maps[0])).resolves.toBeDefined();loader.release();
});
it('warms connected destinations first and does not surface background failures',async()=>{
 const third=map('third'),value={...a,maps:[a.maps[0],third,a.maps[1]],exits:[{id:'exit',fromMap:'first',entityId:'door',toMap:'second',arrival:{x:0,y:0}}]};
 const load=vi.fn(async(url:string)=>{if(url==='/third.png')throw Error('offline');return new Blob(['image']);});
 const loader=createMapGraphicsLoader({...pack,objects:{...pack.objects,third:sprite('/third.png')}},value,load,new AbortController().signal);
 await loader.ensure(value.maps[0]);await expect(loader.background('first')).resolves.toBeUndefined();
 const requested=load.mock.calls.map(args=>args[0]);expect(requested.indexOf('/second.png')).toBeLessThan(requested.indexOf('/third.png'));
 loader.release();
});
it('does not create object URLs when a pending download completes after release',async()=>{
 let complete!:(blob:Blob)=>void;const pending=new Promise<Blob>(resolve=>complete=resolve);
 const loader=createMapGraphicsLoader(pack,a,()=>pending,new AbortController().signal);
 const preparing=loader.ensure(a.maps[0]);loader.release();complete(new Blob(['image']));
 await expect(preparing).rejects.toThrow('Closed');
});
it('includes the separate base and facing-specific back of interactive seats',()=>{
 const scene={...a.maps[0],entities:[{...a.maps[0].entities[0],seat:{cell:{x:0,y:1},facing:'ne' as const}}]};
 const selected=mapGraphics({...pack,objects:{...pack.objects,'pixel.chair-base':sprite('/base.png'),'pixel.chair-back-ne':sprite('/back-ne.png'),'pixel.chair-back-sw':sprite('/back-sw.png')}},a,scene);
 expect(selected.objects['pixel.chair-base']).toBeDefined();expect(selected.objects['pixel.chair-back-ne']).toBeDefined();expect(selected.objects['pixel.chair-back-sw']).toBeUndefined();
});
