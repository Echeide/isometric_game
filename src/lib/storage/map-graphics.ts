import {resolveEnvironment, terrainTileAt, type PixelArtPack, type WorldScene} from '@isometrico/world';
import type {Adventure} from '$lib/demo/adventure';
import {imageUrls, mapImages} from './local-adventures';
import {preloadItems, type PreloadOptions} from './preload';

/** Resolve this before requesting graphics. A future progress provider supplies savedMapId. */
export function adventureEntry(adventure:Adventure, options:{previewMapId?:string|null;savedMapId?:string|null}={}){
 const id=options.previewMapId??options.savedMapId??adventure.startMap;
 return adventure.maps.find(map=>map.id===id)??adventure.maps.find(map=>map.id===adventure.startMap)!;
}

/** Runtime resources, including every narrative appearance of objects in this map. */
export function mapGraphics(pack:PixelArtPack, adventure:Adventure, scene:WorldScene):PixelArtPack{
 const objects=new Set(scene.entities.map(e=>e.visualId??`pixel.${e.kind}`));
 for(const entity of scene.entities)if(entity.seat){objects.add('pixel.chair-base');objects.add(`pixel.chair-back-${entity.seat.facing}`);}
 for(const decoration of scene.decorations??[])objects.add(decoration.visualId);
 for(const behavior of adventure.story?.entities??[])if(behavior.mapId===scene.id)for(const state of behavior.states)if(state.visualId)objects.add(state.visualId);
 if(objects.has('pixel.goal'))objects.add('pixel.goal-completed');
 const tiles=new Set<string>([resolveEnvironment(scene).tile,...Object.values(scene.tiles??{}).filter(id=>id!=='void')]);
 for(let y=0;y<scene.height;y++)for(let x=0;x<scene.width;x++){const id=terrainTileAt(scene,pack,{x,y});if(id!=='void')tiles.add(id);}
 const railings=new Set(scene.walls?.map(w=>w.railingFamily).filter(Boolean));
 const selected:PixelArtPack={...pack,
  objects:Object.fromEntries(Object.entries(pack.objects).filter(([id])=>objects.has(id)).map(([id,item])=>{const {originalImage,generationImage,reductionOriginal,...runtime}=item;return [id,runtime];})),
  tiles:Object.fromEntries(Object.entries(pack.tiles).filter(([id])=>tiles.has(id))) as PixelArtPack['tiles'],
  railingFamilies:Object.fromEntries(Object.entries(pack.railingFamilies??{}).filter(([id])=>railings.has(id)).map(([id,family])=>{const {originalImage,...runtime}=family;return [id,runtime];})),
  players:pack.activePlayer&&pack.players?.[pack.activePlayer]?{[pack.activePlayer]:pack.players[pack.activePlayer]}:undefined,
  tileOriginalImages:undefined,paletteOriginalImages:undefined,objectFamilies:undefined
 };
 return selected;
}

/** Per-player URL cache: shared sheets download once, failures can be retried. */
export function createMapGraphicsLoader(pack:PixelArtPack, adventure:Adventure, load:(url:string)=>Promise<Blob>, signal:AbortSignal){
 const urls=new Map<string,string>(),pending=new Map<string,Promise<void>>(),packs=new Map<string,PixelArtPack>(),warmed=new Set<string>();
 let closed=false,queue:string[]=[],running=false;
 async function resource(url:string){
  if(urls.has(url))return;
  let promise=pending.get(url);
  if(!promise){promise=(async()=>{const blob=await load(url);signal.throwIfAborted();if(closed)throw new DOMException('Closed','AbortError');urls.set(url,URL.createObjectURL(blob));})().finally(()=>pending.delete(url));pending.set(url,promise);}
  await promise;
 }
 async function ensure(scene:WorldScene,options:PreloadOptions={},concurrency=6,definition:Adventure=adventure){
  signal.throwIfAborted();if(closed)throw new DOMException('Closed','AbortError');
  const subset=mapGraphics(pack,definition,scene),key=JSON.stringify(subset);
  const cached=packs.get(key);if(cached)return cached;
  await preloadItems(imageUrls(subset),resource,{...options,signal},concurrency);
  const resolved=mapImages(subset,url=>urls.get(url)??url);packs.set(key,resolved);if(packs.size>32)packs.delete(packs.keys().next().value!);warmed.add(scene.id);return resolved;
 }
 async function drain(){
  if(running)return;running=true;
  try{while(queue.length&&!closed&&!signal.aborted){const id=queue.shift()!,scene=adventure.maps.find(m=>m.id===id);if(scene)try{await ensure(scene,{},2);}catch{/* Retry on entry; background errors never stop play. */}}}finally{running=false;}
 }
 function background(currentId:string){
  const neighbors=adventure.exits.filter(exit=>exit.fromMap===currentId).map(exit=>exit.toMap);
  queue=[...new Set([...neighbors,...adventure.maps.map(m=>m.id)])].filter(id=>id!==currentId&&!warmed.has(id));
  return drain();
 }
 function release(){closed=true;queue=[];for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();packs.clear();warmed.clear();}
 return {ensure,background,release};
}
