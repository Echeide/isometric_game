import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({principal:null as any}));
vi.mock('$lib/server/platform/runtime',()=>({platform:()=>({auth:{principal:async()=>mocks.principal}})}));
import {handle} from '../src/hooks.server';
const event=(path:string,method='GET',origin='https://game.example')=>({url:new URL('https://game.example'+path),request:new Request('https://game.example'+path,{method,headers:{origin}}),locals:{},cookies:{get:()=>undefined}});
const run=(e:any)=>handle({event:e,resolve:async()=>new Response('ok')});
describe('platform HTTP boundary',()=>{
 it('requires sessions for editors, aliases and all private APIs, including local mode',async()=>{mocks.principal=null;for(const path of ['/editor','/sprites','/resources','/characters','/preview','/library','/account','/superadmin']){const r=await run(event(path));expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('/login');}for(const path of ['/api/characters/library','/api/characters/videos','/api/platform/adventures'])expect((await run(event(path))).status).toBe(401);});
 it('rejects cross-origin and origin-less writes even for authenticated sessions',async()=>{mocks.principal={actor:{role:'superadmin'},user:{role:'superadmin'},tenant:null,impersonating:false};expect((await run(event('/api/platform/management','POST','https://attacker.example'))).status).toBe(403);expect((await run(event('/api/auth/login','POST',''))).status).toBe(403);});
 it('keeps public browsing available and prevents privileged UI while impersonating',async()=>{mocks.principal=null;expect((await run(event('/'))).status).toBe(200);expect((await run(event('/api/public/adventures'))).status).toBe(200);mocks.principal={actor:{role:'superadmin'},user:{role:'admin'},tenant:{id:'t'},impersonating:true};expect((await run(event('/superadmin'))).status).toBe(403);const response=await run(event('/sprites'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');});
});
