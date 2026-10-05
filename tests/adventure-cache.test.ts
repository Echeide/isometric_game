import {afterEach,beforeEach,it,expect,vi,type MockInstance} from 'vitest';
import {localAdventures,resolveGraphics,resourceBlob,setStorageContext} from '../src/lib/storage/local-adventures';
import {revalidatedJson} from '../src/lib/server/platform/cache-response';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
let row:{definition:ReturnType<typeof createAdventure>;graphics:typeof graphics;revision:number},denied=false;
let fetcher:ReturnType<typeof vi.fn>,created:MockInstance<typeof URL.createObjectURL>,revoked:MockInstance<typeof URL.revokeObjectURL>;
beforeEach(()=>{
 setStorageContext(null);denied=false;row={definition:createAdventure([structuredClone(office)]),graphics:structuredClone(graphics),revision:1};
 const session=new Map<string,string>();vi.stubGlobal('sessionStorage',{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v)});
 fetcher=vi.fn(async(path:string,init?:RequestInit)=>{
  if(denied)return Response.json({message:'Inicia sesión.'},{status:401});
  const request=new Request('http://localhost'+path,init);
  if(path==='/api/platform/adventures')return revalidatedJson(request,{version:1,activeId:'',adventures:[{...row.definition,_revision:row.revision}]});
  if(path.startsWith('/api/platform/adventures/')){
   if(init?.method==='POST'){const manifest=JSON.parse(String((init.body as FormData).get('manifest')));row={definition:manifest.adventure,graphics:manifest.pack??row.graphics,revision:row.revision+1};return Response.json({revision:row.revision});}
   return revalidatedJson(request,row);
  }
  return new Response(new Blob(['image']));
 });vi.stubGlobal('fetch',fetcher);
 created=vi.spyOn(URL,'createObjectURL').mockImplementation(()=>`blob:cached-${Math.random()}`);revoked=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 setStorageContext('user:tenant');
});
afterEach(()=>{setStorageContext(null);created.mockRestore();revoked.mockRestore();vi.unstubAllGlobals();});
it('validates adventure metadata but reuses the prepared pack and all images after returning to the editor',async()=>{
 const first=await localAdventures.load(),a=await resolveGraphics(row.definition.id);a.release();
 const downloads=fetcher.mock.calls.filter(([url])=>!url.startsWith('/api/platform/adventures')).length;
 first.adventures[0].name='Unsaved draft';const next=await localAdventures.load();expect(next.adventures[0].name).toBe(row.definition.name);
 const progress=vi.fn(),b=await resolveGraphics(row.definition.id,{onProgress:progress});expect(b.pack).toBe(a.pack);b.release();
 expect(fetcher.mock.calls.filter(([url])=>!url.startsWith('/api/platform/adventures'))).toHaveLength(downloads);
 expect(revoked).not.toHaveBeenCalled();expect(progress).toHaveBeenCalledWith({completed:downloads,total:downloads});
 const validations=fetcher.mock.calls.filter(([,init])=>init?.headers?.['If-None-Match']);expect(validations).toHaveLength(2);
});
it('uses a new revision after saves, downloads only new images and keeps cached data separate from drafts',async()=>{
 await localAdventures.load();const a=await resolveGraphics(row.definition.id);a.release();fetcher.mockClear();
 const newPack=structuredClone(row.graphics);newPack.objects[Object.keys(newPack.objects)[0]].image='asset:new-object';
 await localAdventures.save({...row.definition,name:'Updated'},{pack:newPack,blobs:{}});
 const loaded=await localAdventures.load();expect(loaded.adventures[0].name).toBe('Updated');
 const b=await resolveGraphics(row.definition.id);expect(b.pack).not.toBe(a.pack);b.release();
 expect(fetcher.mock.calls.filter(([url])=>!url.startsWith('/api/platform/adventures')).map(([url])=>url)).toEqual(['/api/platform/assets/new-object']);
 const draft=await localAdventures.pack(row.definition.id);draft.activePlayer='unsaved';expect((await localAdventures.pack(row.definition.id)).activePlayer).toBeUndefined();
});
it('detects updates from another session, even without a local save',async()=>{
 await localAdventures.load();const a=await resolveGraphics(row.definition.id);a.release();
 row.revision++;row.definition.name='Another session';row.graphics.objects[Object.keys(row.graphics.objects)[0]].width++;
 expect((await localAdventures.load()).adventures[0].name).toBe('Another session');
 const b=await resolveGraphics(row.definition.id);expect(b.pack).not.toBe(a.pack);b.release();
});
it('clears scoped images and metadata when entering another tenant, while preserving active screen URLs',async()=>{
 await localAdventures.load();const a=await resolveGraphics(row.definition.id);fetcher.mockClear();
 setStorageContext('user:another-tenant');expect(revoked).not.toHaveBeenCalled();a.release();expect(revoked.mock.calls.length).toBeGreaterThan(0);
 await localAdventures.load();const b=await resolveGraphics(row.definition.id);expect(b.pack).not.toBe(a.pack);b.release();
 expect(fetcher.mock.calls.filter(([url])=>!url.startsWith('/api/platform/adventures')).length).toBeGreaterThan(0);
 expect(fetcher.mock.calls.filter(([,init])=>init?.headers?.['If-None-Match'])).toHaveLength(0);
});
it('does not serve a private cached adventure after access has been revoked',async()=>{
 await localAdventures.load();const a=await resolveGraphics(row.definition.id);a.release();denied=true;
 await expect(resolveGraphics(row.definition.id)).rejects.toThrow('Inicia sesión.');expect(revoked.mock.calls.length).toBeGreaterThan(0);
});
it('abandons an old context load rather than caching its response under a new tenant',async()=>{
 let complete!:(response:Response)=>void;fetcher.mockImplementationOnce(()=>new Promise<Response>(r=>complete=r));
 const loading=localAdventures.load();setStorageContext('user:other');complete(Response.json({version:1,activeId:'',adventures:[]}));
 await expect(loading).rejects.toMatchObject({name:'AbortError'});
 expect((await localAdventures.load()).adventures).toHaveLength(1);
});
it('caches scoped immutable blobs independently of the workshop and never caches failed fetches',async()=>{
 await resourceBlob('asset:shared');await resourceBlob('asset:shared');expect(fetcher).toHaveBeenCalledTimes(1);
 denied=true;await expect(resourceBlob('asset:missing')).rejects.toThrow('Inicia sesión.');denied=false;
 await resourceBlob('asset:shared');expect(fetcher).toHaveBeenCalledTimes(3);
});
