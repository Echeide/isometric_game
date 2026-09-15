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
export async function saveWorkshopDraft(id:string,value:unknown){const tx=(await db()).transaction('packs','readwrite'),done=complete(tx);tx.objectStore('packs').put(value,['workshop-draft',id]);await done;}
export const loadWorkshopDraft=<T>(id:string)=>read<T>('packs',['workshop-draft',id]);
export async function clearWorkshopDraft(id:string){const tx=(await db()).transaction('packs','readwrite'),done=complete(tx);tx.objectStore('packs').delete(['workshop-draft',id]);await done;}
export const localAdventures:AdventureRepository={
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
 for(const object of Object.values(copy.objects)){object.image=replace(object.image);if(object.originalImage)object.originalImage=replace(object.originalImage);for(const clip of Object.values(object.animations??{}))clip.image=replace(clip.image);}
 for(const key of Object.keys(copy.tiles) as (keyof typeof copy.tiles)[])copy.tiles[key]=replace(copy.tiles[key]);
 for(const key of Object.keys(copy.tileOriginalImages??{}) as (keyof typeof copy.tiles)[])copy.tileOriginalImages![key]=replace(copy.tileOriginalImages![key]!);
 return copy;
}
export function imageUrls(pack:PixelArtPack){const urls=new Set<string>();mapImages(pack,url=>{urls.add(url);return url;});return [...urls];}
export async function resourceBlob(url:string,repository:Pick<AdventureRepository,'blob'>=localAdventures){
 if(url.startsWith('asset:'))return repository.blob(url.slice(6));
 if(!url.startsWith('/pixelart/')||url.includes('..')||url.includes('\\'))throw new Error('Origen de recurso no admitido.');
 const response=await fetch(url);if(!response.ok)throw new Error(`No se pudo leer ${url}.`);return response.blob();
}
export async function resolveGraphics(id:string){
 const pack=await localAdventures.pack(id),urls=new Map<string,string>();
 try{for(const url of imageUrls(pack))if(url.startsWith('asset:'))urls.set(url,URL.createObjectURL(await resourceBlob(url)));}
 catch(error){for(const url of urls.values())URL.revokeObjectURL(url);throw error;}
 return {pack:mapImages(pack,url=>urls.get(url)??url),release(){for(const url of urls.values())URL.revokeObjectURL(url);}};
}
