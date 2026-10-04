import {describe,it,expect,vi,beforeEach} from 'vitest';
import type {RequestEvent} from '@sveltejs/kit';
const mocks=vi.hoisted(()=>({env:{} as Record<string,string>,dev:false}));
vi.mock('$env/dynamic/private',()=>({env:mocks.env}));
vi.mock('$app/environment',()=>({get dev(){return mocks.dev;}}));
import {accessLibrary,readLibraryBody} from '../src/lib/server/shared-library-api';
function event(authorized:boolean,method='GET',origin='https://game.example'){return {url:new URL('https://game.example/api/characters/library'),request:new Request('https://game.example/api/characters/library',{method,headers:{origin}}),locals:{characterWorkshopAuthorized:authorized},getClientAddress:()=> '127.0.0.1'} as RequestEvent;}
beforeEach(()=>{delete mocks.env.SPRITE_LIBRARY_DIR;mocks.dev=false;});
describe('private library access and limits',()=>{
 it('requires authentication for listing and rejects cross-origin writes before opening storage',()=>{
  for(const e of [event(false),event(false,'POST'),event(true,'POST','https://other.example')])expect(()=>accessLibrary(e)).toThrow(expect.objectContaining({status:403}));
 });
 it('fails closed in production without a persistent storage directory',()=>{expect(()=>accessLibrary(event(true))).toThrow(expect.objectContaining({status:503}));});
 it('bounds streamed bodies even without content-length',async()=>{
  const request=new Request('https://game.example',{method:'POST',body:new Uint8Array(12)});await expect(readLibraryBody(request,10)).rejects.toMatchObject({status:413});
  const valid=new Request('https://game.example',{method:'POST',body:new Uint8Array([1,2,3])});expect(await readLibraryBody(valid,10)).toEqual(new Uint8Array([1,2,3]));
 });
});
