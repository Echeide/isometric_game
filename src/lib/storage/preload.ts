export type LoadProgress = {completed:number;total:number};
export type PreloadOptions = {signal?:AbortSignal;onProgress?:(progress:LoadProgress)=>void};

/** Bound requests and drain in-flight work before returning an error, so callers can clean up safely. */
export async function preloadItems<T>(items:readonly T[],load:(item:T)=>Promise<void>,options:PreloadOptions={},concurrency=6){
 if(!Number.isInteger(concurrency)||concurrency<1)throw new Error('Invalid concurrency');
 let next=0,completed=0,failed=false,failure:unknown;
 options.onProgress?.({completed,total:items.length});
 async function worker(){
  while(!failed&&next<items.length){
   try{options.signal?.throwIfAborted();const item=items[next++];await load(item);options.signal?.throwIfAborted();completed++;options.onProgress?.({completed,total:items.length});}
   catch(error){failed=true;failure??=error;}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,items.length)},worker));
 options.signal?.throwIfAborted();if(failed)throw failure;
}
