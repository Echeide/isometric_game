import {it,expect,vi} from 'vitest';
import {ResourceCache,PreparedCache} from '../src/lib/storage/resource-cache';
const gate=()=>{let resolve!:(value:Blob)=>void;const promise=new Promise<Blob>(r=>resolve=r);return {promise,resolve};};
it('shares a download but cancellation belongs to each caller',async()=>{
 const cache=new ResourceCache<Blob>(b=>b.size),pending=gate(),abort=new AbortController();let sharedSignal!:AbortSignal;
 const load=vi.fn((signal:AbortSignal)=>{sharedSignal=signal;return pending.promise;});
 const a=cache.load('image',load,abort.signal),b=cache.load('image',load);
 await Promise.resolve();abort.abort();await expect(a).rejects.toMatchObject({name:'AbortError'});
 expect(sharedSignal.aborted).toBe(false);pending.resolve(new Blob(['x']));await b;
 await cache.load('image',load);expect(load).toHaveBeenCalledTimes(1);
});
it('cancels unused downloads, retries failures and prevents a cleared download repopulating the cache',async()=>{
 const cache=new ResourceCache<Blob>(b=>b.size),pending=gate(),load=vi.fn(()=>pending.promise);
 const a=cache.load('image',load);await Promise.resolve();cache.clear();pending.resolve(new Blob(['old']));
 await expect(a).rejects.toMatchObject({name:'AbortError'});
 const retry=vi.fn(async()=>new Blob(['new']));expect(await (await cache.load('image',retry)).text()).toBe('new');
 const fail=vi.fn(async()=>{throw new Error('offline');});await expect(cache.load('error',fail)).rejects.toThrow('offline');await expect(cache.load('error',fail)).rejects.toThrow('offline');expect(fail).toHaveBeenCalledTimes(2);
});
it('evicts the least recently used resource when byte or entry budgets are exceeded',async()=>{
 const cache=new ResourceCache<Blob>(b=>b.size,4,2),load=vi.fn(async()=>new Blob(['xx']));
 await cache.load('a',load);await cache.load('b',load);await cache.load('a',load);await cache.load('c',load);
 await cache.load('a',load);expect(load).toHaveBeenCalledTimes(3);await cache.load('b',load);expect(load).toHaveBeenCalledTimes(4);
});
it('retains preparation between screens and releases active values only after their final user leaves',()=>{
 const cache=new PreparedCache<object>(10,1),releaseA=vi.fn(),releaseB=vi.fn(),value={};
 const a=cache.put('a',value,4,releaseA);a.release();const reused=cache.get('a')!;expect(reused.value).toBe(value);expect(releaseA).not.toHaveBeenCalled();
 const b=cache.put('b',{},4,releaseB);cache.clear();expect(releaseA).not.toHaveBeenCalled();expect(releaseB).not.toHaveBeenCalled();
 reused.release();reused.release();b.release();expect(releaseA).toHaveBeenCalledTimes(1);expect(releaseB).toHaveBeenCalledTimes(1);
});
it('disposes old preparation on eviction and temporary preparation from concurrent cache fills',()=>{
 const cache=new PreparedCache<object>(4,2),releaseA=vi.fn(),releaseB=vi.fn(),duplicate=vi.fn();
 const a=cache.put('a',{},4,releaseA);a.release();const same=cache.put('a',{},4,duplicate);same.release();expect(duplicate).toHaveBeenCalledTimes(1);
 const b=cache.put('b',{},4,releaseB);expect(releaseA).toHaveBeenCalledTimes(1);b.release();cache.clear();expect(releaseB).toHaveBeenCalledTimes(1);
});
