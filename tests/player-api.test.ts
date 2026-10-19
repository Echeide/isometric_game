import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),register:vi.fn(),login:vi.fn(),logout:vi.fn()}));
vi.mock('$lib/server/platform/runtime',()=>({platform:()=>({saves:{read:mocks.read,write:mocks.write},players:{register:mocks.register,login:mocks.login,logout:mocks.logout}})}));
import {GET,POST} from '../src/routes/api/game-saves/+server';
import {POST as authPost} from '../src/routes/api/player/[action]/+server';
import {GameSaveError} from '../src/lib/server/platform/game-saves';
function event(path:string,body?:unknown){const url=new URL('https://game.example'+path);return {url,request:new Request(url,{method:body===undefined?'GET':'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),locals:{principal:null,player:null} as any,params:{action:'register'},getClientAddress:()=> 'test-address',cookies:{set:vi.fn(),delete:vi.fn()}} as any;}
beforeEach(()=>{vi.resetAllMocks();});
describe('saved game HTTP API',()=>{
 it('requires a verified session and never exposes private state through public caches',async()=>{const response=await GET(event('/api/game-saves?publication=one'));expect(response.status).toBe(401);expect(response.headers.get('cache-control')).toBe('no-store');expect(mocks.read).not.toHaveBeenCalled();});
 it('derives the player from locals and passes only the selected adventure and version preconditions',async()=>{const e=event('/api/game-saves?publication=one&release=version&account=player:p&playerId=other');e.locals.player={id:'p',username:'player',sessionId:'s'};mocks.read.mockResolvedValue({save:null,revision:0});const response=await GET(e);expect(response.status).toBe(200);expect(mocks.read).toHaveBeenCalledWith(null,e.locals.player,{publication:'one',adventure:null,release:'version',account:'player:p',tenant:null});});
 it('preserves conflict information and rejects cross-origin writes',async()=>{const e=event('/api/game-saves?publication=one',{save:{},revision:0,writeId:'id'});e.locals.player={id:'p'};mocks.write.mockRejectedValue(new GameSaveError(409,'other device','conflict'));const response=await POST(e);expect(response.status).toBe(409);expect(await response.json()).toEqual({message:'other device',code:'conflict'});e.request=new Request(e.url,{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});expect((await POST(e)).status).toBe(403);expect(mocks.write).toHaveBeenCalledTimes(1);});
 it('bounds payload size before calling the save service',async()=>{const e=event('/api/game-saves?publication=one',{padding:'x'.repeat(1_100_001)});e.locals.player={id:'p'};expect((await POST(e)).status).toBe(413);expect(mocks.write).not.toHaveBeenCalled();});
});
it('registers only a player session with secure cookie attributes and keeps authentication errors private',async()=>{
 const e=event('/api/player/register',{username:'new-player',password:'test-only-long-password'});mocks.register.mockResolvedValue('test-token');const response=await authPost(e);expect(response.status).toBe(200);expect(e.cookies.set).toHaveBeenCalledWith('player_session','test-token',expect.objectContaining({httpOnly:true,secure:true,sameSite:'lax',maxAge:2592000,path:'/'}));expect(e.cookies.set).toHaveBeenCalledTimes(1);expect(response.headers.get('cache-control')).toBe('no-store');
});
