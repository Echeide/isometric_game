import {describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({principal:null as any,player:null as any}));
vi.mock('$lib/server/platform/runtime',()=>({platform:()=>({auth:{principal:async()=>mocks.principal},players:{principal:async()=>mocks.player}})}));
import {handle} from '../src/hooks.server';
const event=(path:string,method='GET',origin='https://game.example')=>({url:new URL('https://game.example'+path),request:new Request('https://game.example'+path,{method,headers:{origin}}),locals:{},cookies:{get:()=>undefined}});
const run=(e:any)=>handle({event:e,resolve:async()=>new Response('ok')});
describe('platform HTTP boundary',()=>{
 it('requires sessions for editors, aliases and all private APIs, including local mode',async()=>{mocks.principal=null;for(const path of ['/editor','/sprites','/resources','/characters','/preview','/library','/account','/superadmin']){const r=await run(event(path));expect(r.status).toBe(303);expect(r.headers.get('location')).toBe('/login');}for(const path of ['/api/characters/library','/api/characters/videos','/api/platform/adventures'])expect((await run(event(path))).status).toBe(401);});
 it('rejects cross-origin and origin-less writes even for authenticated sessions',async()=>{mocks.principal={actor:{role:'superadmin'},user:{role:'superadmin'},tenant:null,impersonating:false};expect((await run(event('/api/platform/management','POST','https://attacker.example'))).status).toBe(403);expect((await run(event('/api/auth/login','POST',''))).status).toBe(403);});
 it('keeps public browsing available and prevents privileged UI while impersonating',async()=>{mocks.principal=null;expect((await run(event('/'))).status).toBe(200);expect((await run(event('/api/public/adventures'))).status).toBe(200);mocks.principal={actor:{role:'superadmin'},user:{role:'admin'},tenant:{id:'t'},impersonating:true};expect((await run(event('/superadmin'))).status).toBe(403);const response=await run(event('/sprites'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');});
});
it('keeps player sessions separate from authoring access and never caches personal save responses',async()=>{
 mocks.principal=null;mocks.player={id:'player-one',username:'one',sessionId:'session'};
 const playerEvent=(path:string)=>{const e=event(path);e.cookies={get:(name:string)=>name==='player_session'?'player-token':undefined} as any;return e;};
 const play=playerEvent('/play/public');expect((await run(play)).status).toBe(200);expect((play.locals as any).player.id).toBe('player-one');expect((play.locals as any).characterWorkshopAuthorized).toBeUndefined();
 expect((await run(playerEvent('/editor'))).status).toBe(303);expect((await run(playerEvent('/api/characters/library'))).status).toBe(401);
 expect((await run(playerEvent('/api/game-saves'))).headers.get('cache-control')).toBe('no-store');mocks.player=null;
});
it('keeps SSR language request-local and marks HTML as varying by browser preference and cookie',async()=>{
 mocks.principal=null;const render=(cookie:string|undefined,language:string)=>{const e=event('/');e.request=new Request(e.url,{headers:{'accept-language':language}});e.cookies={get:(name:string)=>name==='isometric_locale'?cookie:undefined} as any;return handle({event:e as any,resolve:async(_event:any,options:any)=>{await Promise.resolve();return new Response(options.transformPageChunk({html:'<html lang="%lang%">'}),{headers:{'content-type':'text/html','Vary':'Accept-Encoding'}});}});};
 const [en,es]=await Promise.all([render('en','es'),render(undefined,'es-ES')]);expect(await en.text()).toBe('<html lang="en">');expect(await es.text()).toBe('<html lang="es">');expect(en.headers.get('vary')).toBe('Accept-Encoding, Cookie, Accept-Language');
});
