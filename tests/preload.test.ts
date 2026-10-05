import {it,expect,vi} from 'vitest';
import {preloadItems} from '../src/lib/storage/preload';
import {preloadGraphics} from '../src/lib/storage/local-adventures';
import {graphics} from '../src/lib/demo/pixelart';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
it('loads concurrently within a bound and reports real completed work',async()=>{
 const gates=Array.from({length:8},deferred),started:number[]=[],progress:number[]=[];
 const done=preloadItems(gates.map((_,i)=>i),async i=>{started.push(i);await gates[i].promise;},{onProgress:p=>progress.push(p.completed)},3);
 expect(started).toEqual([0,1,2]);gates[1].resolve();await vi.waitFor(()=>expect(started).toEqual([0,1,2,3]));
 gates.forEach(g=>g.resolve());await done;expect(progress).toEqual([0,1,2,3,4,5,6,7,8]);
});
it('stops queued work after failure and waits for active work before rejecting',async()=>{
 const gate=deferred(),started:number[]=[];let finished=false;
 const done=preloadItems([0,1,2,3],async i=>{started.push(i);if(i===0)throw new Error('offline');await gate.promise;},{},2).catch(e=>{finished=true;return e;});
 await Promise.resolve();expect(started).toEqual([0,1]);expect(finished).toBe(false);gate.resolve();expect((await done).message).toBe('offline');expect(started).toEqual([0,1]);
});
it('cancels pending work on navigation',async()=>{
 const controller=new AbortController(),gate=deferred(),started:number[]=[];
 const done=preloadItems([0,1,2],async i=>{started.push(i);await gate.promise;},{signal:controller.signal},1);
 controller.abort();gate.resolve();await expect(done).rejects.toMatchObject({name:'AbortError'});expect(started).toEqual([0]);
});
it('revokes all object URLs after failure, including work that finishes late',async()=>{
 const create=vi.spyOn(URL,'createObjectURL').mockImplementation(()=>`blob:${Math.random()}`),revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 let calls=0;const gate=deferred();
 try{const done=preloadGraphics(graphics,async()=>{if(++calls===1)throw new Error('offline');await gate.promise;return new Blob(['x']);}).catch(e=>e);
 gate.resolve();expect((await done).message).toBe('offline');expect(create.mock.calls.length).toBeGreaterThan(0);expect(new Set(revoke.mock.calls.map(c=>c[0]))).toEqual(new Set(create.mock.results.map(r=>r.value)));
 }finally{create.mockRestore();revoke.mockRestore();}
});
it('does not fetch the same graphic twice within a pack and releases successful loads',async()=>{
 const load=vi.fn(async(_url:string)=>new Blob(['x'])),revoke=vi.spyOn(URL,'revokeObjectURL');
 try{const resolved=await preloadGraphics(graphics,load);expect(new Set(load.mock.calls.map(c=>c[0])).size).toBe(load.mock.calls.length);resolved.release();expect(revoke).toHaveBeenCalledTimes(load.mock.calls.length);}finally{revoke.mockRestore();}
});
