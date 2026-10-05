import {beforeEach,it,expect,vi} from 'vitest';
import type {RequestEvent} from '@sveltejs/kit';
import {PlatformError} from '../src/lib/server/platform/auth';
const store=vi.hoisted(()=>({list:vi.fn(),adventure:vi.fn()}));
vi.mock('$lib/server/platform/runtime',()=>({platform:()=>({store})}));
import {GET} from '../src/routes/api/platform/[...path]/+server';
const event=(path:string,etag?:string)=>({locals:{principal:{user:{id:'admin'},tenant:{id:'tenant'}}},params:{path},request:new Request('https://game.example/api/platform/'+path,{headers:etag?{'If-None-Match':etag}:{}})}) as unknown as RequestEvent;
beforeEach(()=>{store.list.mockReset();store.adventure.mockReset();});
it.each(['adventures','adventures/a'])('revalidates %s only after reading its currently authorized data',async path=>{
 const read=path==='adventures'?store.list:store.adventure;read.mockResolvedValue({revision:1,name:'Original'});
 const initial=await GET(event(path)),etag=initial.headers.get('etag')!;
 expect(initial.status).toBe(200);expect(initial.headers.get('cache-control')).toBe('no-store');expect(initial.headers.get('vary')).toBe('Cookie');
 const unchanged=await GET(event(path,etag));expect(unchanged.status).toBe(304);expect(await unchanged.text()).toBe('');expect(read).toHaveBeenCalledTimes(2);
 read.mockResolvedValue({revision:2,name:'New'});expect((await GET(event(path,etag))).status).toBe(200);
 read.mockRejectedValue(new PlatformError(403,'Acceso denegado'));expect((await GET(event(path,etag))).status).toBe(403);
});
