/** A bounded, in-memory cache. An aborted caller does not cancel other callers of the same download. */
export class ResourceCache<T> {
 private values=new Map<string,{value:T;bytes:number}>();
 private pending=new Map<string,{promise:Promise<T>;controller:AbortController;users:number}>();
 private bytes=0;
 constructor(private size:(value:T)=>number,private maxBytes=64_000_000,private maxEntries=256){}
 async load(key:string,load:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();
  const cached=this.values.get(key);
  if(cached){this.values.delete(key);this.values.set(key,cached);return cached.value;}
  let entry=this.pending.get(key);
  if(!entry){
   const controller=new AbortController();
   entry={controller,users:0,promise:undefined!};
   const current=entry;
   current.promise=Promise.resolve().then(()=>{controller.signal.throwIfAborted();return load(controller.signal);}).then(value=>{
    controller.signal.throwIfAborted();
    if(this.pending.get(key)===current){
     const bytes=this.size(value);
     if(bytes<=this.maxBytes){this.values.set(key,{value,bytes});this.bytes+=bytes;this.trim();}
    }
    return value;
   }).finally(()=>{if(this.pending.get(key)===current)this.pending.delete(key);});
   this.pending.set(key,current);
  }
  const current=entry;current.users++;
  try{return await abortable(current.promise,signal);}
  finally{if(--current.users===0&&this.pending.get(key)===current){this.pending.delete(key);current.controller.abort();}}
 }
 private trim(){while(this.bytes>this.maxBytes||this.values.size>this.maxEntries){const [key,entry]=this.values.entries().next().value!;this.values.delete(key);this.bytes-=entry.bytes;}}
 clear(){this.values.clear();this.bytes=0;for(const entry of this.pending.values())entry.controller.abort();this.pending.clear();}
}
function abortable<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{
 if(!signal)return promise;
 return new Promise<T>((resolve,reject)=>{
  const aborted=()=>reject(signal.reason??new DOMException('Aborted','AbortError'));
  signal.addEventListener('abort',aborted,{once:true});
  promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',aborted));
  if(signal.aborted)aborted();
 });
}

/** Keep prepared values alive while a screen uses them, and retain recent values between screens. */
export class PreparedCache<T> {
 private entries=new Map<string,{value:T;bytes:number;release:()=>void;users:number;retired:boolean}>();
 constructor(private maxBytes=128_000_000,private maxEntries=6){}
 get(key:string){const entry=this.entries.get(key);if(!entry)return;
  this.entries.delete(key);this.entries.set(key,entry);return this.acquire(entry);
 }
 put(key:string,value:T,bytes:number,release:()=>void){
  const existing=this.get(key);if(existing){release();return existing;}
  const entry={value,bytes,release,users:0,retired:false};this.entries.set(key,entry);
  const lease=this.acquire(entry);this.trim();return lease;
 }
 private acquire(entry:{value:T;release:()=>void;users:number;retired:boolean}){
  entry.users++;let released=false;
  return {value:entry.value,release:()=>{if(released)return;released=true;entry.users--;if(entry.retired&&entry.users===0)entry.release();this.trim();}};
 }
 private trim(){let bytes=[...this.entries.values()].reduce((sum,e)=>sum+e.bytes,0);
  for(const [key,entry]of this.entries){if(bytes<=this.maxBytes&&this.entries.size<=this.maxEntries)break;if(entry.users)continue;this.entries.delete(key);bytes-=entry.bytes;entry.retired=true;entry.release();}
 }
 clear(){for(const entry of this.entries.values()){entry.retired=true;if(!entry.users)entry.release();}this.entries.clear();}
}
