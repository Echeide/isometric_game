import {preloadItems,type PreloadOptions} from './preload';
import {ResourceCache,PreparedCache} from './resource-cache';
import type { PixelArtPack } from '@isometrico/world';
import { parseAdventure, type Adventure } from '$lib/demo/adventure';
import { loadAdventureLibrary as legacyLibrary, parseLibrary, type AdventureLibrary } from '$lib/demo/adventure-library';
import { graphics } from '$lib/demo/pixelart';

/** Host applications can implement this contract using their own API and asset storage. */
export interface AdventureRepository {
 load():Promise<AdventureLibrary>;
 save(adventure:Adventure, resources?:{pack:PixelArtPack; blobs:Record<string,Blob>}):Promise<AdventureLibrary>;
 select(id:string):Promise<Adventure>;
 pack(id:string):Promise<PixelArtPack>;
 blob(id:string):Promise<Blob>;
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open('isometrico-workshop',1);
 request.onupgradeneeded=()=>{for(const name of ['library','packs','assets'])request.result.createObjectStore(name);};
 request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
 request.onerror=()=>{database=undefined;reject(request.error);};
 request.onblocked=()=>{database=undefined;reject(new Error('Cierra otras pestañas para actualizar la biblioteca.'));};
});}
function result<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function complete(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error??new Error('No se pudo guardar la aventura.'));});}
async function read<T>(store:string,key:IDBValidKey){return result<T|undefined>((await db()).transaction(store).objectStore(store).get(key));}
/** Workshop drafts keep Blob originals without adding incomplete assets to the playable pack. */
export async function saveWorkshopDraft(id:string,value:unknown){const tx=(await db()).transaction('packs','readwrite'),done=complete(tx);tx.objectStore('packs').put(value,['workshop-draft',context??'local',id]);await done;}
export const loadWorkshopDraft=async<T>(id:string)=>await read<T>('packs',['workshop-draft',context??'local',id])??(!context?await read<T>('packs',['workshop-draft',id]):undefined);
export async function clearWorkshopDraft(id:string){const tx=(await db()).transaction('packs','readwrite'),done=complete(tx);tx.objectStore('packs').delete(['workshop-draft',context??'local',id]);await done;}
export const browserAdventures:AdventureRepository={
 async load(){
  const saved=await read<AdventureLibrary>('library','current');
  if(saved)return parseLibrary(saved);
  // Keep legacy data untouched as a recovery copy. The migration commits atomically.
  const migrated=legacyLibrary({getItem:key=>localStorage.getItem(key)},true),tx=(await db()).transaction('library','readwrite'),done=complete(tx);
  const store=tx.objectStore('library'),existing=await result<AdventureLibrary|undefined>(store.get('current'));
  if(!existing)store.put(migrated,'current');await done;return existing?parseLibrary(existing):migrated;
 },
 async save(value,resources){
  const adventure=parseAdventure(value);await this.load();
  const tx=(await db()).transaction(['library','packs','assets'],'readwrite'),done=complete(tx);
  const library=await result<AdventureLibrary>(tx.objectStore('library').get('current'));
  const next={...library,activeId:adventure.id,adventures:[...library.adventures.filter(a=>a.id!==adventure.id),adventure]};
  tx.objectStore('library').put(next,'current');
  if(resources){tx.objectStore('packs').put(JSON.parse(JSON.stringify(resources.pack)),adventure.id);for(const [id,blob] of Object.entries(resources.blobs))tx.objectStore('assets').put(blob,id);}
  await done;return next;
 },
 async select(id){
  await this.load();const tx=(await db()).transaction('library','readwrite'),done=complete(tx),store=tx.objectStore('library');
  const library=await result<AdventureLibrary>(store.get('current')),adventure=library.adventures.find(a=>a.id===id);
  if(!adventure){await done;throw new Error('No existe esa aventura.');}
  store.put({...library,activeId:id},'current');await done;return adventure;
 },
 async pack(id){return await read<PixelArtPack>('packs',id)??JSON.parse(JSON.stringify(graphics));},
 async blob(id){const blob=await read<Blob>('assets',id);if(!blob)throw new Error(`Falta el recurso ${id}.`);return blob;}
};

// Compatibility at the demo boundary; storage is not imported by the world engine.
export const loadAdventureLibrary=()=>localAdventures.load();
export const storeAdventure=(value:Adventure)=>localAdventures.save(value);
export const selectAdventure=(id:string)=>localAdventures.select(id);

export function mapImages(pack:PixelArtPack,replace:(url:string)=>string):PixelArtPack{
 const copy:PixelArtPack=JSON.parse(JSON.stringify(pack));
 for(const character of [copy.character,...Object.values(copy.players??{}).map(p=>p.character)]){
 character.image=replace(character.image);
 for(const variants of [character.variants,...Object.values(character.animations).map(a=>a.variants)])if(variants)for(const key of Object.keys(variants))variants[key]=replace(variants[key]);
 for(const animation of Object.values(character.animations))if(animation.image)animation.image=replace(animation.image);
 }
 for(const object of Object.values(copy.objects)){object.image=replace(object.image);if(object.originalImage)object.originalImage=replace(object.originalImage);if(object.generationImage)object.generationImage=replace(object.generationImage);for(const clip of Object.values(object.animations??{}))clip.image=replace(clip.image);}
 for(const key of Object.keys(copy.tiles) as (keyof typeof copy.tiles)[])copy.tiles[key]=replace(copy.tiles[key]);
 for(const key of Object.keys(copy.tileOriginalImages??{}) as (keyof typeof copy.tiles)[])copy.tileOriginalImages![key]=replace(copy.tileOriginalImages![key]!);
 if(copy.paletteOriginalImages)copy.paletteOriginalImages=Object.fromEntries(Object.entries(copy.paletteOriginalImages).map(([url,original])=>[replace(url),replace(original)]));
 return copy;
}
export function imageUrls(pack:PixelArtPack){const urls=new Set<string>();mapImages(pack,url=>{urls.add(url);return url;});return [...urls];}
const resourceCache=new ResourceCache<Blob>(blob=>blob.size);
const preparedCache=new PreparedCache<PixelArtPack>();
let cacheGeneration=0;
export async function resourceBlob(url:string,repository:Pick<AdventureRepository,'blob'>=localAdventures,signal?:AbortSignal){
 signal?.throwIfAborted();
 const load=async(sharedSignal?:AbortSignal)=>{
  if(url.startsWith('asset:'))return repository===localAdventures&&context?(await api('assets/'+encodeURIComponent(url.slice(6)),{signal:sharedSignal})).blob():repository.blob(url.slice(6));
  if(!url.startsWith('/pixelart/')||url.includes('..')||url.includes('\\'))throw new Error('Origen de recurso no admitido.');
  const response=await fetch(url,{signal:sharedSignal});if(!response.ok)throw new Error(`No se pudo leer ${url}.`);return response.blob();
 };
 // Explicit repositories may replace assets in place; only cache our scoped, saved resources.
 return repository===localAdventures?resourceCache.load(JSON.stringify([context,url]),load,signal):load(signal);
}
export async function preloadGraphics(pack:PixelArtPack,load:(url:string)=>Promise<Blob>,options:PreloadOptions={}){
 const urls=new Map<string,string>();
 const release=()=>{for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();};
 try{await preloadItems(imageUrls(pack),async url=>{const blob=await load(url);options.signal?.throwIfAborted();urls.set(url,URL.createObjectURL(blob));},options);}
 catch(error){release();throw error;}
 return {pack:mapImages(pack,url=>urls.get(url)??url),release};
}
export async function resolveGraphics(id:string,options:PreloadOptions={}){
 const pack=await localAdventures.pack(id);options.signal?.throwIfAborted();
 const key=JSON.stringify([context,pack]),cached=preparedCache.get(key);
 if(cached){try{options.onProgress?.({completed:imageUrls(pack).length,total:imageUrls(pack).length});return {pack:cached.value,release:cached.release};}catch(error){cached.release();throw error;}}
 const generation=cacheGeneration;let bytes=0;
 const resolved=await preloadGraphics(pack,async url=>{const blob=await resourceBlob(url,localAdventures,options.signal);bytes+=blob.size;return blob;},options);
 if(generation!==cacheGeneration){resolved.release();throw new DOMException('El espacio ha cambiado.','AbortError');}
 const saved=preparedCache.put(key,resolved.pack,bytes,resolved.release);
 return {pack:saved.value,release:saved.release};
}

let context:string|null=null;
const revisions=new Map<string,number>();
type CachedJson<T>={value:T;etag:string|null};
type ServerLibrary=Omit<AdventureLibrary,'adventures'>&{adventures:Array<Adventure&{_revision:number}>};
type ServerAdventure={definition:Adventure;graphics:PixelArtPack;revision:number};
let cachedLibrary:CachedJson<ServerLibrary>|undefined;
const cachedRows=new Map<string,CachedJson<ServerAdventure>>();
function clearCaches(){cacheGeneration++;resourceCache.clear();preparedCache.clear();cachedLibrary=undefined;cachedRows.clear();}
export function setStorageContext(key:string|null){if(context!==key){clearCaches();revisions.clear();context=key;}}
async function api(path:string,init?:RequestInit,allowNotModified=false){const response=await fetch('/api/platform/'+path,init);if(!response.ok&&!(allowNotModified&&response.status===304)){if(response.status===401||response.status===403)clearCaches();const body=await response.json().catch(()=>({}));throw new Error(body.message??'No se pudo acceder al espacio.');}return response;}
async function revalidate<T>(path:string,cached?:CachedJson<T>):Promise<CachedJson<T>>{
 const generation=cacheGeneration;
 const response=await api(path,cached?.etag?{headers:{'If-None-Match':cached.etag}}:undefined,true);
 const result=response.status===304&&cached?cached:{value:await response.json() as T,etag:response.headers.get('etag')};
 if(generation!==cacheGeneration)throw new DOMException('El espacio ha cambiado.','AbortError');
 return result;
}
async function serverRow(id:string){
 const row=await revalidate<ServerAdventure>('adventures/'+encodeURIComponent(id),cachedRows.get(id));
 cachedRows.delete(id);cachedRows.set(id,row);
 if(cachedRows.size>8)cachedRows.delete(cachedRows.keys().next().value!);
 return row.value;
}
const serverAdventures:AdventureRepository={
 async load(){cachedLibrary=await revalidate<ServerLibrary>('adventures',cachedLibrary);const library=structuredClone(cachedLibrary.value);for(const a of library.adventures)if(!revisions.has(a.id))revisions.set(a.id,a._revision);const selected=sessionStorage.getItem('active:'+context);return {...library,activeId:library.adventures.some((a:Adventure)=>a.id===selected)?selected!:library.adventures[0]?.id??''};},
 async save(adventure,resources){const form=new FormData();form.set('manifest',JSON.stringify({adventure,pack:resources?.pack??(!revisions.has(adventure.id)?graphics:undefined),revision:revisions.has(adventure.id)?((adventure as Adventure&{_revision?:number})._revision??revisions.get(adventure.id)):0}));for(const [id,blob] of Object.entries(resources?.blobs??{}))form.set(id,blob,`${id}.png`);const r=await(await api('adventures/'+encodeURIComponent(adventure.id),{method:'POST',body:form})).json();cachedRows.delete(adventure.id);revisions.set(adventure.id,r.revision);sessionStorage.setItem('active:'+context,adventure.id);return this.load();},
 async select(id){const row=await serverRow(id);revisions.set(id,row.revision);sessionStorage.setItem('active:'+context,id);return {...structuredClone(row.definition),_revision:row.revision};},
 async pack(id){if(!revisions.has(id))return JSON.parse(JSON.stringify(graphics));const row=await serverRow(id);if(!revisions.has(id))revisions.set(id,row.revision);return structuredClone(row.graphics);},
 async blob(id){return(await api('assets/'+encodeURIComponent(id))).blob();}
};
export const localAdventures:AdventureRepository={load:()=>active().load(),save:async(a,r)=>{if(!context){resourceCache.clear();preparedCache.clear();cacheGeneration++;}return active().save(a,r);},select:id=>active().select(id),pack:id=>active().pack(id),blob:id=>active().blob(id)};
function active(){return context?serverAdventures:browserAdventures;}

export const storageScope=()=>context??'local';
