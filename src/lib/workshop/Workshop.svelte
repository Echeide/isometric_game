<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte';
 import LoadProgress from '$lib/components/LoadProgress.svelte';
 import {preloadItems,type LoadProgress as Progress} from '$lib/storage/preload';
 const preloadAbort=new AbortController();let loadProgress=$state<Progress|null>(null);
 import {beforeNavigate,goto} from '$app/navigation';
 import {ArrowLeft,Plus,Search,Box,UserRound,Users,Layers,Upload,Download,Copy,Save,Trash2,Play,Pause,Check,Minus,RotateCcw,Move,Scissors,Pencil} from 'lucide-svelte';
 import {actorPoses,characterImage,resolveVisualCatalog,type PixelArtPack,type ObjectSprite,type CharacterPack,type ActorPose,type TileKind,type VisualAsset,type Facing} from '@isometrico/world';
 import {graphics as defaultGraphics} from '$lib/demo/pixelart';
 import type {Adventure} from '$lib/demo/adventure';
 import {localAdventures,resourceBlob,imageUrls,saveWorkshopDraft,loadWorkshopDraft,clearWorkshopDraft} from '$lib/storage/local-adventures';
 import {downloadBlob,exportAdventure,pngSize,validateCatalogGraphics} from '$lib/storage/adventure-package';
 import {validateGraphics,type ImageSize} from '@isometrico/world';
 import {workshopEntries,workshopNpc,standaloneCharacter,supportOrigin,resourceUsages,actionLabels,type ResourceKind,type ResourceEntry} from './resources';
 import AdventurePaletteEditor from './AdventurePaletteEditor.svelte';
 import {defaultAdventurePalette,type AdventurePalette} from '$lib/demo/adventure-palette';
 import {mapResourceImages,resourceImages,prunePaletteOriginals,paletteFromColors,type PaletteResource} from './palette';
 import {decodePaletteImage,encodePalettePNG,adaptedColorsPNG} from './palette-browser';
 import {extractSpritePalette} from '../../../packages/character-generator/src/pipeline';
 import {readPng,visibleCrop} from './images';
 import {readCharacterZip} from './character-package';
 import ResourceStage from '$lib/components/ResourceStage.svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import ObjectAssistant from './ObjectAssistant.svelte';
 import SharedLibrary from './SharedLibrary.svelte';
 import {packResource,instantiateResource,addSharedResource,type SharedResource,type SharedSummary} from './shared-resource';
 import {objectReference,type PreparedObjectImage} from './object-image-browser';
 import ImageEditor from '$lib/components/ImageEditor.svelte';
 import {validateEditedImage,withEditedImage,playerEditClip,extractAnimationStrip,replaceAnimationStrip,type AnimationSheetClip,type ImageEditSession,type ImageEditOptions,cycleActions,cycleDirections,validateCycleSelection,type CycleSelection,type CycleNavigation} from './image-edit';
 import type {Frame} from '../../../packages/character-generator/src/types';
 import {npcClipRow} from '../../../packages/world/src/pixelart';

 const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
 const tabs=[{id:'object',label:'Objetos',icon:Box},{id:'npc',label:'PNJ',icon:Users},{id:'player',label:'Jugador',icon:UserRound},{id:'tile',label:'Suelos',icon:Layers}] as const;
 const npcPoses:('idle'|'talk')[]=['idle','talk'];
 let adventure=$state<Adventure>(),adventures=$state<Adventure[]>([]),pack=$state.raw<PixelArtPack>(clone(defaultGraphics));
 let kind=$state<ResourceKind>('object'),selected=$state(''),name=$state(''),category=$state<VisualAsset['category']>('office'),size=$state({x:1,y:1});
 let item=$state<ObjectSprite>({image:'',width:64,height:64,origin:[32,48]});
 let character=$state<CharacterPack>(standaloneCharacter(defaultGraphics.character,'728da5'));
 let tileImage=$state(''),tileOriginalImage=$state<string>(),tileFrame=$state<[number,number,number,number]>([0,0,64,32]);
 let libraryScope=$state<'adventure'|'general'|'global'>('adventure'),libraryKind=$state<ResourceKind>('object');
 let objectProposal=$state<string|null>(null);
 let paletteDialogOpen=$state(false),paletteLinks=$state<Record<string,string>>({});
 const paletteOriginals=$derived({...pack.paletteOriginalImages,...paletteLinks});
 const paletteResource=$derived({kind,item,character,tileImage});
 type WorkshopImageEdit=ImageEditSession&{source:string;original?:Frame;clip?:AnimationSheetClip;action?:ActorPose;direction?:Facing};
 let imageEdit=$state.raw<WorkshopImageEdit>(),imageEditDirty=$state(false);
 let pose=$state<ActorPose>('idle'),direction=$state(1),playing=$state(true),zoom=$state(2),reuseSit=$state(false),locked=$state(true);
 let search=$state(''),dirty=$state(false),busy=$state(false),loading=$state(true),loadFailed=$state(false),error=$state(''),notice=$state(''),hasDraft=$state(false);
 let imageRevision=$state(0),fileInput:HTMLInputElement,characterZipInput:HTMLInputElement,confirmDialog:HTMLDialogElement;
 let pendingAction:(()=>void)|undefined,uploadSlot='base',packSignature='',catalogSignature='',disposed=false;
 const pending=new Map<string,Blob>(),urls=new Map<string,string>(),sizes=new Map<string,ImageSize>();
 type Draft={kind:ResourceKind;selected:string;name:string;category:VisualAsset['category'];size:{x:number;y:number};item:ObjectSprite;character:CharacterPack;tileImage:string;tileOriginalImage?:string;tileFrame:[number,number,number,number];reuseSit:boolean;paletteLinks?:Record<string,string>;pending:Record<string,Blob>};
 const entries=$derived(workshopEntries(pack,adventure?.catalog,adventure?.catalogOverrides));
 function catalogVersion(a:Adventure){return JSON.stringify([a.catalog??[],a.catalogOverrides??{},a.palette??null]);}
 const filtered=$derived(entries.filter(e=>e.kind===kind&&e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 const current=$derived(entries.find(e=>e.id===selected&&e.kind===kind));
 const custom=$derived(selected.startsWith('custom.'));
 const usages=$derived(adventure&&current?resourceUsages(adventure.maps,current):[]);
 const previewItem=$derived(objectProposal && kind==='object'?{...item,image:objectProposal,frame:[0,0,Math.round(item.width),Math.round(item.height)] as [number,number,number,number]}:item);
 const source=$derived(kind==='player'?characterImage(character,pose):kind==='tile'?tileImage:item.image);
 const sourceSize=$derived.by(()=>{imageRevision;return sizes.get(source);});
 const originalImage=$derived(kind==='tile'?tileOriginalImage:kind==='player'?undefined:item.originalImage);
 const crop=$derived(item.frame??[0,0,sourceSize?.width??64,sourceSize?.height??64]);
 const scalePercent=$derived(Math.round(item.width/(crop[2]||1)*100));
 const isActivePlayer=$derived(kind==='player'&&(pack.activePlayer??'default')===selected);
 const activeClip=$derived(kind==='npc'?(pose==='talk'?item.animations?.talk??item.animations?.idle:item.animations?.idle):undefined);
 const editSource=$derived(activeClip?.image??source);
 const editSize=$derived.by(()=>{imageRevision;return sizes.get(editSource);});
 const editAction=$derived(kind==='npc'&&pose==='talk'&&!item.animations?.talk?'idle':pose);
 const editingAnimation=$derived(kind==='player'||!!activeClip);
 function resolve(url:string){imageRevision;return urls.get(url)??(url.startsWith('asset:')?'':url);}
 function message(cause:unknown){error=cause instanceof Error?cause.message:'No se pudo completar la operación.';}
 function ask(action:()=>void){if(dirty||objectProposal){pendingAction=action;confirmDialog.showModal();}else action();}
 function continueAction(){dirty=false;confirmDialog.close();const action=pendingAction;pendingAction=undefined;action?.();}
 beforeNavigate(nav=>{if(imageEdit||paletteDialogOpen){nav.cancel();return;}if((dirty||objectProposal)&&nav.to?.url&&!nav.willUnload){nav.cancel();ask(()=>void goto(nav.to!.url));}});
 function beforeUnload(event:BeforeUnloadEvent){if(dirty||imageEditDirty||objectProposal||paletteDialogOpen){event.preventDefault();event.returnValue='';}}
 async function addImage(url:string,blob:Blob){const dimensions=pngSize(new Uint8Array(await blob.arrayBuffer()));if(disposed)return;const old=urls.get(url);if(old)URL.revokeObjectURL(old);urls.set(url,URL.createObjectURL(blob));sizes.set(url,dimensions);imageRevision++;}
 async function hydrate(next:PixelArtPack){await preloadItems(imageUrls(next).filter(url=>!sizes.has(url)),async url=>addImage(url,await resourceBlob(url,localAdventures,preloadAbort.signal)),{signal:preloadAbort.signal,onProgress:p=>loadProgress=p});}
 async function load(id?:string){
  loading=true;loadFailed=false;loadProgress=null;error='';pending.clear();
  try{const library=await localAdventures.load();if(disposed)return;adventures=library.adventures;adventure=library.adventures.find(a=>a.id===(id??library.activeId));if(!adventure)throw new Error('No se encuentra la aventura.');
   const next=await localAdventures.pack(adventure.id);await hydrate(next);if(disposed)return;pack=next;packSignature=JSON.stringify(next);catalogSignature=catalogVersion(adventure);hasDraft=!!await loadWorkshopDraft(adventure.id);dirty=false;
   const first=workshopEntries(next,adventure.catalog,adventure.catalogOverrides).find(e=>e.kind===kind);if(first)select(first);else selected='';
   const url=new URL(location.href);url.searchParams.set('adventure',adventure.id);history.replaceState(null,'',url);
  }catch(e){if(!disposed){loadFailed=true;message(e);}}finally{loading=false;}
 }
 onMount(()=>{playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;const query=new URLSearchParams(location.search),section=query.get('section');if(tabs.some(t=>t.id===section))kind=section as ResourceKind;void load(query.get('adventure')??undefined);});
 onDestroy(()=>{disposed=true;preloadAbort.abort();urls.forEach(url=>URL.revokeObjectURL(url));});
 function select(entry:ResourceEntry){
  paletteLinks={};kind=entry.kind;selected=entry.id;name=entry.name;pose='idle';error='';notice='';dirty=false;zoom=2;locked=true;
  const asset=resolveVisualCatalog(adventure?.catalog,adventure?.catalogOverrides).find(a=>a.id===entry.id);category=asset?.category??'office';size=clone(asset?.size??{x:1,y:1});
  if(kind==='player'){character=entry.id==='default'?standaloneCharacter(pack.character,'728da5'):clone(pack.players![entry.id].character);reuseSit=characterImage(character,'sit')===characterImage(character,'work')&&character.animations.sit.frames===1;}
  else if(kind==='tile'){tileImage=pack.tiles[entry.id as TileKind];tileOriginalImage=pack.tileOriginalImages?.[entry.id as TileKind];const dimensions=sizes.get(tileImage)!;tileFrame=clone(pack.tileFrames?.[entry.id as TileKind]??[0,0,dimensions.width,dimensions.height]);}
  else item=clone(kind==='npc'?workshopNpc(pack,entry.id):pack.objects[entry.id]);
 }
 function tab(next:ResourceKind){ask(()=>{kind=next;search='';const entry=entries.find(e=>e.kind===next);if(entry)select(entry);else{selected='';dirty=false;}});}
 function create(){ask(()=>{
  paletteLinks={};selected=`custom.${crypto.randomUUID()}`;name=kind==='npc'?'Nuevo PNJ':kind==='player'?'Nuevo jugador':kind==='tile'?'Nuevo suelo':'Nuevo objeto';size={x:1,y:1};category=kind==='npc'?'people':'office';pose='idle';error='';notice='';dirty=true;
  if(kind==='player'){character=standaloneCharacter(defaultGraphics.character);character.image='';for(const p of actorPoses)character.animations[p].image='';reuseSit=true;}
  else if(kind==='tile'){tileImage='';tileOriginalImage=undefined;tileFrame=[0,0,64,32];}
  else item={image:'',width:64,height:64,origin:[32,48]};
 });}
 function duplicate(){ask(()=>{selected=`custom.${crypto.randomUUID()}`;name=`${name} · copia`;dirty=true;notice='Variante independiente. Guarda para añadirla al catálogo.';});}
 function support(){item.origin=supportOrigin(item,size);dirty=true;}
 function setScale(percent:number){if(!Number.isFinite(percent)||percent<=0)return;const factor=percent/100,newW=crop[2]*factor,newH=crop[3]*factor,ratio=newW/item.width,cx=(size.x-size.y)*16,cy=(size.x+size.y)*8;item.origin=[(item.origin[0]+cx)*ratio-cx,(item.origin[1]+cy)*ratio-cy];item.width=newW;item.height=newH;dirty=true;}
 function dimension(axis:'width'|'height',value:number){const old=item[axis];if(!Number.isFinite(value)||value<=0)return;if(locked){const ratio=value/old;item.width*=ratio;item.height*=ratio;const cx=(size.x-size.y)*16,cy=(size.x+size.y)*8;item.origin=[(item.origin[0]+cx)*ratio-cx,(item.origin[1]+cy)*ratio-cy];}else item[axis]=value;dirty=true;}
 function setCrop(index:number,value:number){const frame=[...crop] as [number,number,number,number];frame[index]=value;item.frame=frame;dirty=true;}
 async function trim(){busy=true;try{const frame=await visibleCrop(resolve(item.image),crop),factor=item.width/crop[2];item.frame=frame;item.width=frame[2]*factor;item.height=frame[3]*factor;support();notice='Márgenes transparentes recortados. El PNG original se conserva.';}catch(e){message(e);}finally{busy=false;}}
 function shift(dx:number,dy:number){if(busy)return;if(kind==='player'){const scale=character.scale??1;if(!Number.isFinite(scale)||scale<=0)return;character.anchor=[character.anchor[0]-dx/scale,character.anchor[1]-dy/scale];}else item.origin=[item.origin[0]-dx,item.origin[1]-dy];dirty=true;}
 function chooseUpload(slot='base'){uploadSlot=slot;fileInput.click();}
 async function importCharacterZip(event:Event){
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';
  if(!file||busy||!adventure)return;
  busy=true;error='';notice='';
  let imported:Awaited<ReturnType<typeof readCharacterZip>>|undefined;
  try{
   if(Object.keys(pack.players??{}).length>=24)throw new Error('La biblioteca admite hasta 24 jugadores propios.');
   imported=await readCharacterZip(file);
  }catch(e){message(e);}finally{busy=false;}
  if(imported&&!disposed){const content=imported;ask(()=>void applyCharacterZip(content));}
 }
 async function applyCharacterZip(imported:Awaited<ReturnType<typeof readCharacterZip>>){
  busy=true;error='';
  try{
   for(const [id,blob]of Object.entries(imported.blobs))await addImage(`asset:${id}`,blob);
   if(disposed)return;
   for(const [id,blob]of Object.entries(imported.blobs))pending.set(id,blob);
   reuseSit=false;character=imported.character;kind='player';selected=`custom.${crypto.randomUUID()}`;name=imported.name;
   pose='idle';direction=1;zoom=2;locked=true;search='';dirty=true;
   notice='Personaje importado con sus seis acciones y configuración. Revisa la vista previa, pulsa «Guardar en aventura» y después «Usar como jugador».';
  }catch(e){message(e);}finally{busy=false;}
 }
 async function upload(event:Event){
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;busy=true;error='';
  try{const dimensions=await readPng(file),id=crypto.randomUUID(),url=`asset:${id}`;pending.set(id,file);await addImage(url,file);
   if(kind==='player'){
    const p=uploadSlot as ActorPose;character.animations[p]={...character.animations[p],image:url,row:0,frames:Math.min(64,Math.max(1,Math.floor(dimensions.width/character.frameWidth)))};
    if(p==='idle')character.image=url;if(p==='work'&&reuseSit)syncSit();
   }else if(kind==='tile'){tileImage=url;tileOriginalImage=undefined;tileFrame=[0,0,dimensions.width,dimensions.height];}
   else if(uploadSlot==='idle'||uploadSlot==='talk'){
    const frameWidth=item.frame?.[2]??sizes.get(item.image)?.width??dimensions.width,frameHeight=item.frame?.[3]??sizes.get(item.image)?.height??dimensions.height;
    item.animations={...item.animations,[uploadSlot]:{image:url,frameWidth,frameHeight,row:0,frames:Math.min(64,Math.max(1,Math.floor(dimensions.width/frameWidth))),fps:6}};
   }else{item.image=url;delete item.originalImage;delete item.generationImage;item.frame=[0,0,dimensions.width,dimensions.height];const factor=Math.min(1,96/dimensions.width,96/dimensions.height);item.width=dimensions.width*factor;item.height=dimensions.height*factor;support();}
   dirty=true;notice='PNG cargado. Ajusta el tamaño y comprueba la vista previa.';
  }catch(e){message(e);}finally{busy=false;}
 }
 async function generationReference(id:string){
  const entry=entries.find(e=>e.id===id&&e.kind==='object');if(!entry)throw new Error('No se encuentra la referencia.');
  const blob=pending.get(entry.image.slice(6))??await resourceBlob(entry.image);
  return objectReference(blob,entry.frame);
 }
 async function acceptObjectImage(image:PreparedObjectImage){
  if(disposed||kind!=='object')return;
  const id=crypto.randomUUID(),rawId=crypto.randomUUID(),url=`asset:${id}`,rawUrl=`asset:${rawId}`;
  await addImage(url,image.blob);await addImage(rawUrl,image.original);if(disposed)return;
  pending.set(id,image.blob);pending.set(rawId,image.original);
  item={...item,image:url,generationImage:rawUrl,originalImage:undefined,frame:[0,0,image.width,image.height]};
  objectProposal=null;dirty=true;notice='Imagen de IA aplicada. Revisa tamaño y apoyo, retoca en Piskel si lo necesitas y guarda en catálogo.';
 }
 async function downloadGeneration(){if(item.generationImage){const blob=pending.get(item.generationImage.slice(6))??await resourceBlob(item.generationImage);downloadBlob(blob,`${name}-original-ia.png`);}}
 function syncSit(){if(reuseSit)character.animations.sit={...character.animations.work,frames:1};}
 const cycleNavigation=$derived.by<CycleNavigation|undefined>(()=>{
  if(!imageEdit?.clip||!imageEdit.action||(kind!=='player'&&kind!=='npc'))return;
  const labels={ne:'NE ↗',se:'SE ↘',sw:'SW ↙',nw:'NW ↖'};
  return {name,action:imageEdit.action,direction:imageEdit.direction,actions:cycleActions(kind,character,item).map(value=>({value,label:actionLabels[value]})),directions:cycleDirections(kind,character,item,imageEdit.action).map(value=>({value,label:labels[value]}))};
 });
 async function prepareImageEdit(action:ActorPose,view:number,staticImage=false):Promise<WorkshopImageEdit>{
  const owner=selected,ownerKind=kind,facing=(['ne','se','sw','nw'] as const)[view]??'se';
  const npc=kind==='npc'?(action==='talk'?item.animations?.talk??item.animations?.idle:item.animations?.idle):undefined;
  const actualAction=kind==='npc'&&action==='talk'&&!item.animations?.talk?'idle':action;
  const image=staticImage?source:kind==='player'?characterImage(character,action):npc?.image??source,dimensions=sizes.get(image);
  if(!image||!dimensions)throw Error('No hay una imagen para esta acción.');
  const blob=await paletteBlob(image),clip=staticImage?undefined:kind==='player'?playerEditClip(character,action,view):npc?{...npc,row:npcClipRow(npc,facing)}:undefined;
  if(clip){
   const original=await decodePaletteImage(blob),strip=extractAnimationStrip(original,clip);
   if(disposed||selected!==owner||kind!==ownerKind)throw Error('El recurso cambió mientras se cargaba el ciclo.');
   const directional=kind==='player'||!!npc?.directions,title=`${name} · ${actionLabels[actualAction]}${directional?' / '+facing.toUpperCase():''}`;
   return {blob:new Blob([new Uint8Array(encodePalettePNG(strip))],{type:'image/png'}),name:title,width:strip.width,height:strip.height,frames:clip.frames,fps:Math.max(1,Math.min(30,clip.fps)),source:image,original,clip:clone(clip),action:actualAction,direction:directional?facing:undefined};
  }
  if(disposed||selected!==owner||kind!==ownerKind)throw Error('El recurso cambió mientras se cargaba la imagen.');
  return {blob,name,width:dimensions.width,height:dimensions.height,source:image};
 }
 async function editImage(staticImage=false){
  if(busy)return;busy=true;error='';
  try{const prepared=await prepareImageEdit(pose,direction,staticImage);imageEditDirty=false;imageEdit=prepared;}
  catch(e){message(e);}finally{busy=false;}
 }
 async function selectEditCycle(selection:CycleSelection){
  if(!imageEdit?.clip||(kind!=='player'&&kind!=='npc'))throw Error('No hay un ciclo seleccionado.');
  const chosen=validateCycleSelection(kind,character,item,selection),view=chosen.direction?(['ne','se','sw','nw'] as const).indexOf(chosen.direction):direction;
  const prepared=await prepareImageEdit(chosen.action,view);
  pose=chosen.action;direction=view;imageEdit=prepared;imageEditDirty=false;
 }
 async function applyImage(blob:Blob,options:ImageEditOptions={}){
  if(!imageEdit)return;
  await validateEditedImage(blob,imageEdit);
  const {original,clip,source:editedSource}=imageEdit;
  if(options.palette){
   const edited=options.pixels??await decodePaletteImage(blob),blobs:Record<string,Blob>={};
   for(const source of resourceImages(paletteResource)){
    if(source===editedSource){
     if(original&&clip){const adapted=await adaptedColorsPNG(original,options.palette,preloadAbort.signal),merged=replaceAnimationStrip(adapted.frame,clip,edited);blobs[source]=new Blob([new Uint8Array(encodePalettePNG(merged))],{type:'image/png'});}
     else blobs[source]=blob;
    }else blobs[source]=(await adaptedColorsPNG(await decodePaletteImage(await paletteBlob(source)),options.palette,preloadAbort.signal)).blob;
   }
   // Validate the entire set before publishing any pending image to the workshop.
   for(const [source,result] of Object.entries(blobs))await validateEditedImage(result,sizes.get(source)!);
   await acceptPalette(blobs);return;
  }
  if(original&&clip){const merged=replaceAnimationStrip(original,clip,options.pixels??await decodePaletteImage(blob));blob=new Blob([new Uint8Array(encodePalettePNG(merged))],{type:'image/png'});await validateEditedImage(blob,original);}
  const id=crypto.randomUUID(),url=`asset:${id}`;await addImage(url,blob);if(disposed)return;pending.set(id,blob);
  if(clip){
   const updated=mapResourceImages(paletteResource,u=>u===editedSource?url:u);
   if(kind==='npc'&&item.image===editedSource)updated.item.originalImage=item.originalImage??item.image;
   usePaletteResource(updated);
  }else if(kind==='tile'){tileOriginalImage??=tileImage;tileImage=url;}else item=withEditedImage(item,url);
  dirty=true;notice=clip?'Ciclo retocado. Las demás filas, los fotogramas, FPS y apoyo se conservan. Pulsa «Guardar en aventura».':'Retoques aplicados. Revisa la vista previa y pulsa «Guardar en aventura». La imagen original se conserva.';
 }
 function closeImageEditor(){imageEdit=undefined;imageEditDirty=false;}
 function restoreOriginalImage(){
  if(!originalImage)return;
  if(kind==='tile')tileImage=originalImage;
  else if(kind==='npc'&&activeClip?.image===item.image){const image=item.image;usePaletteResource(mapResourceImages(paletteResource,u=>u===image?originalImage!:u));}
  else item.image=originalImage;
  dirty=true;notice='Imagen original recuperada. Guarda en el catálogo para aplicar el cambio.';
 }
 $effect(()=>{if(kind==='player'&&reuseSit){const work={...character.animations.work};untrack(()=>{character.animations.sit={...work,frames:1};});}});
 async function paletteBlob(url:string){return pending.get(url.slice(6))??await resourceBlob(url);}
 async function savePalette(palette:AdventurePalette){
  if(busy)throw Error('Espera a que termine la operación actual.');busy=true;
  try{const {currentAdventure}=await latest();currentAdventure.palette=palette;await localAdventures.save(currentAdventure);adventure=currentAdventure;catalogSignature=catalogVersion(adventure);adventures=adventures.map(a=>a.id===adventure!.id?currentAdventure:a);notice='Paleta de 64 colores guardada. Ya puedes adaptar los recursos de esta aventura.';}finally{busy=false;}
 }
 async function extractPalette():Promise<AdventurePalette>{
  const frames=[];
  for(const url of resourceImages(paletteResource)){
   const frame=await decodePaletteImage(await paletteBlob(paletteOriginals[url]??url)),pixels=frame.width*frame.height,count=Math.min(2048,pixels),data=new Uint8ClampedArray(count*4);
   for(let i=0;i<count;i++){const p=Math.floor(i*pixels/count)*4;data.set(frame.data.subarray(p,p+4),i*4);}
   frames.push({width:count,height:1,data});
  }
  const colors=extractSpritePalette(frames,64).map(c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join(''));
  return paletteFromColors(colors,defaultAdventurePalette());
 }
 function usePaletteResource(resource:PaletteResource){if(kind==='player')character=resource.character;else if(kind==='tile')tileImage=resource.tileImage;else item=resource.item;}
 async function acceptPalette(blobs:Record<string,Blob>){
  busy=true;try{const replacements:Record<string,string>={},links:Record<string,string>={};
   for(const [url,blob]of Object.entries(blobs)){const id=crypto.randomUUID(),next=`asset:${id}`;await addImage(next,blob);if(disposed)return;pending.set(id,blob);replacements[url]=next;links[next]=paletteOriginals[url]??url;}
   usePaletteResource(mapResourceImages(paletteResource,u=>replacements[u]??u));paletteLinks={...paletteLinks,...links};dirty=true;notice='Adaptación aplicada a todas las hojas. Guarda en aventura para usarla en el juego.';
  }finally{busy=false;}
 }
 function restorePalette(){usePaletteResource(mapResourceImages(paletteResource,u=>paletteOriginals[u]??u));dirty=true;notice='Colores originales recuperados en todas las hojas. Guarda en aventura para conservarlos.';}
 async function publishResource(){
  if(busy||dirty||objectProposal||!current)return;busy=true;error='';
  try{await latest();const resource:SharedResource={format:'isometric-resource',version:1,kind,name:name.trim(),category,size:clone(size),...(kind==='player'?{character:clone(character)}:kind==='tile'?{tile:{image:tileImage,originalImage:tileOriginalImage,frame:clone(tileFrame)}}:{object:clone(item)})};
   const bytes=await packResource(resource,url=>resourceBlob(url)),response=await fetch('/api/characters/library',{method:'POST',headers:{'Content-Type':'application/zip'},body:new Uint8Array(bytes)});
   if(!response.ok){let text=response.status===401?'Accede al taller privado desde Biblioteca general y vuelve a intentarlo.':'No se pudo guardar en la biblioteca.';try{text=(await response.json()).message??text;}catch{}throw Error(text);}
   notice='Recurso guardado en la biblioteca de tu espacio. Ya puedes incorporarlo a otras aventuras.';
  }catch(e){message(e);}finally{busy=false;}
 }
 async function incorporateResource(entry:SharedSummary){
  if(busy||!adventure)return;busy=true;error='';
  try{const response=await fetch(`/api/characters/library/${entry.id}`);if(!response.ok)throw Error('No se pudo descargar el recurso. Vuelve a abrir la biblioteca.');const content=instantiateResource(new Uint8Array(await response.arrayBuffer()));
   for(const [id,blob]of Object.entries(content.blobs)){const bitmap=await createImageBitmap(blob);bitmap.close();await addImage(`asset:${id}`,blob);}
   const {currentAdventure,currentPack}=await latest(),added=addSharedResource(currentPack,currentAdventure.catalog??[],content.resource,{id:entry.id,version:entry.version});currentAdventure.catalog=added.catalog;
   validateGraphics(added.pack,sizes);validateCatalogGraphics(currentAdventure,added.pack);
   await localAdventures.save(currentAdventure,{pack:added.pack,blobs:content.blobs});
   adventure=currentAdventure;pack=added.pack;packSignature=JSON.stringify(pack);catalogSignature=catalogVersion(adventure);kind=content.resource.kind;select(workshopEntries(pack,adventure.catalog,adventure.catalogOverrides).find(e=>e.id===added.id)!);libraryScope='adventure';notice='Copia incorporada y guardada en esta aventura. Puedes retocarla sin cambiar la biblioteca ni otras aventuras.';
  }catch(e){message(e);}finally{busy=false;}
 }
 async function latest(){if(!adventure)throw new Error('No hay aventura seleccionada.');const library=await localAdventures.load(),currentAdventure=library.adventures.find(a=>a.id===adventure!.id);if(!currentAdventure)throw new Error('La aventura ya no existe.');const currentPack=await localAdventures.pack(adventure.id);if(JSON.stringify(currentPack)!==packSignature||catalogVersion(currentAdventure)!==catalogSignature)throw new Error('Los recursos han cambiado en otra pestaña. Guarda un borrador y recarga el taller antes de continuar.');return {currentAdventure,currentPack};}
 async function save(){
  if(busy||!adventure)return;busy=true;error='';notice='';
  try{const {currentAdventure,currentPack}=await latest();let id=selected;
   if(!name.trim()||name.length>120)throw new Error('Escribe un nombre de hasta 120 caracteres.');
   if(kind==='player'){syncSit();if(id==='default')id=`custom.${crypto.randomUUID()}`;currentPack.players={...currentPack.players,[id]:{name:name.trim(),character:clone(character)}};}
   else if(kind==='tile'){currentPack.tiles[id as TileKind]=tileImage;currentPack.tileFrames={...currentPack.tileFrames,[id]:clone(tileFrame)};currentPack.tileNames={...currentPack.tileNames,[id]:name.trim()};if(tileOriginalImage)currentPack.tileOriginalImages={...currentPack.tileOriginalImages,[id]:tileOriginalImage};else if(currentPack.tileOriginalImages)delete currentPack.tileOriginalImages[id as TileKind];}
   else{currentPack.objects[id]=clone(item);if(custom){const entry:VisualAsset={id,label:name.trim(),kind:kind==='npc'?'person':'object',category:kind==='npc'?'people':category,size:clone(size)};currentAdventure.catalog=[...(currentAdventure.catalog??[]).filter(e=>e.id!==id),entry];}else currentAdventure.catalogOverrides={...currentAdventure.catalogOverrides,[id]:{label:name.trim(),category:kind==='npc'?'people':category}};}
   currentPack.paletteOriginalImages={...currentPack.paletteOriginalImages,...paletteLinks};prunePaletteOriginals(currentPack);
   validateGraphics(currentPack,sizes);validateCatalogGraphics(currentAdventure,currentPack);
   const used=new Set(imageUrls(currentPack).filter(u=>u.startsWith('asset:')).map(u=>u.slice(6))),blobs=Object.fromEntries([...pending].filter(([key])=>used.has(key)));
   await localAdventures.save(currentAdventure,{pack:currentPack,blobs});await clearWorkshopDraft(adventure.id);hasDraft=false;
   adventure=currentAdventure;pack=currentPack;packSignature=JSON.stringify(currentPack);catalogSignature=catalogVersion(currentAdventure);selected=id;paletteLinks={};dirty=false;notice=kind==='player'?'Jugador guardado. Pulsa «Usar como jugador» para activarlo.':kind==='tile'?'Suelo guardado. Ya puedes seleccionarlo en Baldosas y pintar el mapa.':'Recurso guardado. Ya está disponible en el editor y en el juego.';
  }catch(e){message(e);}finally{busy=false;}
 }
 async function activate(){if(dirty||busy)return;busy=true;error='';try{const {currentAdventure,currentPack}=await latest();if(selected==='default')delete currentPack.activePlayer;else currentPack.activePlayer=selected;await localAdventures.save(currentAdventure,{pack:currentPack,blobs:{}});pack=currentPack;packSignature=JSON.stringify(currentPack);catalogSignature=catalogVersion(currentAdventure);notice='Jugador activado para esta aventura.';}catch(e){message(e);}finally{busy=false;}}
 async function remove(){busy=true;error='';try{const {currentAdventure,currentPack}=await latest();if(kind==='player'){if(currentPack.activePlayer===selected)throw new Error('Activa otro jugador antes de eliminar este.');delete currentPack.players?.[selected];}else if(kind==='tile'){
    if(currentAdventure.maps.some(m=>Object.values(m.tiles??{}).includes(selected as TileKind)))throw new Error('Este suelo se utiliza en un mapa. Sustituye las baldosas pintadas antes de eliminarlo.');
    delete currentPack.tiles[selected as TileKind];delete currentPack.tileFrames?.[selected as TileKind];delete currentPack.tileNames?.[selected as TileKind];
    delete currentPack.tileOriginalImages?.[selected as TileKind];
   }else{if(currentAdventure.maps.some(m=>m.entities.some(e=>e.visualId===selected)))throw new Error('Este recurso se utiliza en un mapa. Retira sus instancias antes de eliminarlo.');delete currentPack.objects[selected];currentAdventure.catalog=currentAdventure.catalog?.filter(e=>e.id!==selected);}
   prunePaletteOriginals(currentPack);validateGraphics(currentPack,sizes);validateCatalogGraphics(currentAdventure,currentPack);
   await localAdventures.save(currentAdventure,{pack:currentPack,blobs:{}});dirty=false;await load(adventure!.id);notice='Recurso eliminado del catálogo.';
  }catch(e){message(e);}finally{busy=false;}}
 async function saveDraft(){if(!adventure)return false;busy=true;try{const draft:Draft={kind,selected,name,category,size:clone(size),item:clone(item),character:clone(character),tileImage,tileOriginalImage,tileFrame:clone(tileFrame),reuseSit,paletteLinks:clone(paletteLinks),pending:Object.fromEntries(pending)};await saveWorkshopDraft(adventure.id,draft);hasDraft=true;notice='Borrador guardado en este navegador. Aún no modifica el juego.';return true;}catch(e){message(e);return false;}finally{busy=false;}}
 async function restoreDraft(){if(!adventure)return;busy=true;try{const draft=await loadWorkshopDraft<Draft>(adventure.id);if(!draft)return;for(const [id,blob]of Object.entries(draft.pending)){pending.set(id,blob);await addImage(`asset:${id}`,blob);}kind=draft.kind;selected=draft.selected;name=draft.name;category=draft.category;size=draft.size;item=draft.item;character=draft.character;tileImage=draft.tileImage;tileOriginalImage=draft.tileOriginalImage;tileFrame=draft.tileFrame;reuseSit=draft.reuseSit;paletteLinks=draft.paletteLinks??{};dirty=true;notice='Borrador recuperado. Revisa los campos y guarda en la aventura.';}catch(e){message(e);}finally{busy=false;}}
 async function download(){try{if(editSource)downloadBlob(await paletteBlob(editSource),`${name||'recurso'}.png`);}catch(e){message(e);}}
 async function exportZip(){busy=true;try{const a=(await localAdventures.load()).adventures.find(a=>a.id===adventure!.id)!;downloadBlob(await exportAdventure(a),`${a.id}.zip`);notice='ZIP exportado con el catálogo y sus imágenes guardadas.';}catch(e){message(e);}finally{busy=false;}}
</script>

<svelte:window onbeforeunload={beforeUnload}/>
<div class="workshop">
 <header class="top"><a href={adventure?`/editor?adventure=${encodeURIComponent(adventure.id)}`:'/editor'}><ArrowLeft size={17}/> Editor de mapas</a><nav aria-label="Herramientas del taller"><a href="/characters">Generador de personajes IA ↗</a><a href={adventure?`/preview?adventure=${encodeURIComponent(adventure.id)}`:'/'}>Ir al mundo ↗</a></nav></header>
 <div class="intro"><h1>Taller de sprites</h1><div class="adventure-tools"><label>Aventura<select aria-label="Aventura del taller" value={adventure?.id??''} disabled={loading||busy} onchange={e=>{const id=e.currentTarget.value;ask(()=>void load(id));}}>{#each adventures as a}<option value={a.id}>{a.name}</option>{/each}</select></label><button disabled={!adventure||busy} onclick={exportZip}><Download size={16}/> Exportar ZIP</button></div>
 <div class="scope-switch" aria-label="Ámbito de recursos"><button aria-pressed={libraryScope==='adventure'} disabled={busy} onclick={()=>libraryScope='adventure'}>Esta aventura</button><button aria-pressed={libraryScope==='general'} disabled={busy} onclick={()=>libraryScope='general'}>Mi espacio</button><button aria-pressed={libraryScope==='global'} disabled={busy} onclick={()=>libraryScope='global'}>Compartidos</button></div>
 </div>
 {#if error}<p class="alert error" role="alert">{error}</p>{/if}
 {#if notice}<p class="alert notice" role="status"><Check size={16}/>{notice}</p>{/if}
 {#if hasDraft}<div class="draft-banner"><span>Tienes un borrador guardado en esta aventura.</span><button disabled={busy} onclick={()=>ask(()=>void restoreDraft())}>Recuperar borrador</button></div>{/if}
 <div class="resource-toolbar">
 <div class="category-bar" aria-label="Tipos de recurso">{#each tabs as t}<button aria-pressed={(libraryScope!=='adventure'?libraryKind:kind)===t.id} disabled={loading||busy} onclick={()=>{if(libraryScope!=='adventure')libraryKind=t.id;else tab(t.id);}}><t.icon size={18}/>{t.label}{#if libraryScope==='adventure'}<span>{entries.filter(e=>e.kind===t.id).length}</span>{/if}</button>{/each}</div>
 <div class="palette-tools" hidden={libraryScope!=='adventure'}>{#if !loading&&!loadFailed&&adventure}
 {#key adventure.id}<AdventurePaletteEditor palette={adventure.palette} disabled={busy||!!objectProposal} onsave={savePalette} onextract={selected&&resourceImages(paletteResource).length?extractPalette:undefined} onediting={open=>paletteDialogOpen=open}/>{/key}
 {/if}</div>
 </div>
 {#if loading}<LoadProgress title="Preparando tu biblioteca…" progress={loadProgress}/>{:else if loadFailed}<button onclick={()=>load(adventure?.id)}>Reintentar carga</button>{:else if adventure}
 {#if libraryScope!=='adventure'}{#key libraryScope}<SharedLibrary scope={libraryScope==='global'?'global':'tenant'} kind={libraryKind} {busy} onincorporate={entry=>ask(()=>void incorporateResource(entry))}/>{/key}{/if}
 <div hidden={libraryScope!=='adventure'}>
 <div class="workspace">
  <aside class="library" aria-label="Catálogo de recursos"><div class="library-title"><h2>{tabs.find(t=>t.id===kind)?.label}</h2><span>{filtered.length}</span></div><label class="search"><Search size={15}/><input aria-label="Buscar recurso" placeholder="Buscar recurso…" bind:value={search}/></label>
   <button class="add" disabled={busy} onclick={create}><Plus size={16}/> Añadir {kind==='npc'?'PNJ':kind==='player'?'jugador':kind==='tile'?'suelo':'objeto'}</button>{#if kind==='tile'}<p class="library-note">Añade un suelo propio o selecciona uno existente. Al guardar, podrás pintarlo desde Baldosas en el editor.</p>{/if}
   {#if kind==='player'}<button class="upload" disabled={busy} onclick={()=>characterZipInput.click()}><Upload size={16}/> Importar ZIP del personaje</button><p class="zip-note">Usa «Descargar personaje ZIP» del generador, con el perfil de 4 direcciones. Las hojas, fotogramas, FPS y apoyo se cargan automáticamente.</p>{/if}
   <div class="resource-list">{#each filtered as entry}<button class:selected={selected===entry.id} aria-pressed={selected===entry.id} disabled={busy} onclick={()=>ask(()=>select(entry))}><span class="thumb"><SpriteThumbnail image={resolve(entry.image)} frame={entry.frame}/></span><span class="resource-name"><strong>{entry.name}</strong><small>{entry.kind==='player'&&(pack.activePlayer??'default')===entry.id?'Jugador activo':entry.custom?'Personalizado':'Catálogo base'}</small></span>{#if entry.id===selected}<span class="selection-dot"></span>{/if}</button>{:else}<p class="empty-list">{search?'No hay coincidencias.':'Tu primer PNJ puede ser una sola imagen. Añádelo y ajusta su tamaño.'}</p>{/each}</div>
   <p class="storage-note">Guardado local en este navegador.<br/>El ZIP lleva tus recursos a otro dispositivo.</p>
  </aside>
  {#if selected}
  <main class="stage-column"><div class="resource-heading"><div><p class="eyebrow">{kind==='npc'?'PERSONAJE NO JUGABLE':kind==='player'?'PERSONAJE JUGABLE':kind==='tile'?'TEXTURA DE SUELO':'OBJETO DEL MUNDO'}</p><h2>{name}</h2></div><span class:unsaved={dirty} class="state-badge">{objectProposal?'Propuesta IA':dirty?'Sin guardar':'Guardado'}</span></div>
   <ResourceStage {kind} item={previewItem} {character} {pose} {direction} {playing} {zoom} {size} {tileImage} {tileFrame} reference={pack.activePlayer?pack.players![pack.activePlayer].character:pack.character} floorImage={defaultGraphics.tiles.office} {resolve} onshift={shift}/>
   <div class="preview-tools"><div>{#if kind==='player'||kind==='npc'}<button aria-label={playing?'Pausar animación':'Reproducir animación'} onclick={()=>playing=!playing}>{#if playing}<Pause size={16}/>{:else}<Play size={16}/>{/if}</button><select aria-label="Acción de vista previa" bind:value={pose}>{#each kind==='npc'?npcPoses:actorPoses as p}<option value={p}>{actionLabels[p]}</option>{/each}</select>{/if}{#if kind==='player'||activeClip?.directions}<select aria-label="Dirección de vista previa" bind:value={direction}><option value={0}>NE ↗</option><option value={1}>SE ↘</option><option value={2}>SW ↙</option><option value={3}>NW ↖</option></select>{/if}</div><div><span>Vista</span><button aria-label="Alejar vista previa" disabled={zoom<=.5} onclick={()=>zoom=Math.max(.5,zoom-.5)}><Minus size={15}/></button><output>{zoom}×</output><button aria-label="Acercar vista previa" disabled={zoom>=4} onclick={()=>zoom=Math.min(4,zoom+.5)}><Plus size={15}/></button></div></div>
   {#if kind==='npc'}<p class="preview-note">{activeClip?`${pose==='talk'&&item.animations?.talk?'Conversación animada':'Animación de reposo'} · ${activeClip.frames} fotogramas a ${activeClip.fps} fps`:'Imagen estática · lista para usar sin animaciones.'}</p>{/if}
   {#if kind==='player'}<div class="action-strip">{#each actorPoses as p}<button class:active={pose===p} onclick={()=>pose=p}><span>{actionLabels[p]}</span><small>{characterImage(character,p)?`${character.animations[p].frames} fotogramas`:'Sin imagen'}</small></button>{/each}</div>{/if}
   {#if resourceImages(paletteResource).some(u=>!!paletteOriginals[u])}<button class="restore-image" disabled={busy||!!objectProposal} onclick={restorePalette}><RotateCcw size={15}/> Recuperar colores originales</button>{/if}
   <div class="source-card"><div><h3>{editingAnimation?`Hoja · ${actionLabels[editAction]}`:'Imagen original'}</h3><p>{editSize?`${editSize.width} × ${editSize.height} px`:'Carga un PNG para empezar'} · PNG transparente</p></div><div class="source-actions"><button disabled={busy||!editSource||!!objectProposal} onclick={()=>editImage()}><Pencil size={15}/>{editingAnimation?'Editar ciclo':'Editar imagen'}</button>{#if kind==='npc'&&activeClip}<button disabled={busy||!source||!!objectProposal} onclick={()=>editImage(true)}>Editar imagen estática</button>{/if}<button disabled={busy||!editSource||!!objectProposal} onclick={download}><Download size={15}/> Descargar</button></div></div>
   {#if kind==='object' && item.generationImage}<button class="restore-image" disabled={busy} onclick={()=>downloadGeneration().catch(message)}><Download size={14}/> Descargar original de IA</button>{/if}
   {#if originalImage&&source!==originalImage}<button class="restore-image" disabled={busy} onclick={restoreOriginalImage}><RotateCcw size={14}/> Recuperar imagen original</button>{/if}
   {#if editingAnimation}<p class="source-hint">Se edita {actionLabels[editAction].toLowerCase()}{kind==='player'||activeClip?.directions?' / '+(['NE','SE','SW','NW'][direction]??'SE'):''}, fotograma a fotograma. Las demás filas de la hoja se conservan.</p>{/if}
   {#if editSource}<details class="source-detail"><summary>Ver {editingAnimation?'hoja de la acción':'imagen y márgenes'} originales</summary><div><img src={resolve(editSource)} alt={`Original de ${name}`}/></div></details>{/if}
   <div class="usage-card"><h3>Uso en la aventura</h3><p>{kind==='player'?(isActivePlayer?'Es el personaje controlado al jugar esta aventura.':'Guárdalo y actívalo para usarlo al jugar.'):usages.length?`Este recurso se utiliza en: ${usages.join(', ')}. Guardar su aspecto actualizará esos usos.`:'Disponible para colocar al guardar. Las variantes mantienen su propio gráfico.'}</p>{#if current}<button disabled={busy} onclick={duplicate}><Copy size={15}/> Duplicar como variante</button>{/if}</div>
  </main>
  <form class="inspector" onsubmit={e=>{e.preventDefault();void save();}} oninput={()=>dirty=true} onchange={()=>dirty=true} aria-label="Propiedades del recurso"><fieldset disabled={busy}><div class="inspector-title"><h2>Propiedades</h2><span>{kind==='tile'?'Textura':kind==='player'?'Jugador':kind==='npc'?'PNJ':'Objeto'}</span></div>
   <label>Nombre<input aria-label="Nombre del recurso" maxlength="120" bind:value={name} disabled={kind==='tile'&&!custom}/></label>
   {#if kind==='object'||kind==='npc'}
    <p class="metadata-note">El nombre del catálogo se usa al colocar objetos nuevos. Cada objeto del mapa tiene su propio nombre.</p>
    <button type="button" class="upload" onclick={()=>chooseUpload()}><Upload size={16}/>{item.image?'Sustituir imagen':'Subir imagen PNG'}</button>
    {#if kind==='object'}{#key `${adventure.id}:${selected}`}<ObjectAssistant palette={adventure.palette} width={Math.round(item.width)} height={Math.round(item.height)} footprint={size} references={entries.filter(e=>e.kind==='object').map(e=>({id:e.id,name:e.name}))} onreference={generationReference} onpreview={image=>objectProposal=image} onaccept={acceptObjectImage} onbusy={value=>busy=value}/>{/key}<label>Categoría<select bind:value={category}><option value="office">Oficina</option><option value="nature">Naturaleza</option><option value="urban">Urbano</option></select></label>{/if}
    <section class="fields-section"><h3>Escala en el mundo</h3><label>Tamaño proporcional <span>{scalePercent}%</span><input aria-label="Escala del objeto" type="range" min="5" max="400" step="1" value={scalePercent} oninput={e=>setScale(e.currentTarget.valueAsNumber)}/></label><div class="two-fields"><label>Ancho (px)<input aria-label="Ancho del dibujo" type="number" min="1" max="4096" step="any" value={Math.round(item.width*100)/100} oninput={e=>dimension('width',e.currentTarget.valueAsNumber)}/></label><label>Alto (px)<input aria-label="Alto del dibujo" type="number" min="1" max="4096" step="any" value={Math.round(item.height*100)/100} oninput={e=>dimension('height',e.currentTarget.valueAsNumber)}/></label></div><label class="checkbox"><input type="checkbox" bind:checked={locked}/> Mantener proporciones</label><p>La ampliación de la vista previa no cambia este tamaño.</p></section>
    <section class="fields-section"><h3>Huella y apoyo</h3><div class="two-fields"><label>Casillas X<input aria-label="Huella X" type="number" min="1" max="16" bind:value={size.x} disabled={!custom}/></label><label>Casillas Y<input aria-label="Huella Y" type="number" min="1" max="16" bind:value={size.y} disabled={!custom}/></label></div><button type="button" onclick={support}><Move size={15}/> Apoyar sobre la huella</button><p>También puedes arrastrar el dibujo. La huella es el tamaño predeterminado de las nuevas instancias.</p><details><summary>Ajustar apoyo con precisión</summary><div class="two-fields"><label>Origen X<input aria-label="Origen X" type="number" step="any" bind:value={item.origin[0]}/></label><label>Origen Y<input aria-label="Origen Y" type="number" step="any" bind:value={item.origin[1]}/></label></div></details></section>
    <details class="fields-section"><summary>Recorte del PNG</summary><p>Selecciona un objeto de una hoja o elimina sus márgenes.</p><div class="two-fields">{#each ['X','Y','Ancho','Alto'] as title,i}<label>{title}<input aria-label={`Recorte ${title}`} type="number" min={i<2?0:1} value={crop[i]} oninput={e=>setCrop(i,e.currentTarget.valueAsNumber)}/></label>{/each}</div><button type="button" disabled={!item.image} onclick={trim}><Scissors size={15}/> Recortar transparencia</button></details>
    {#if kind==='npc'}<section class="fields-section"><h3>Animaciones opcionales</h3><p>Una imagen estática basta. Añade animación cuando la tengas.</p>{#each npcPoses as p}<details class="clip-editor"><summary>{actionLabels[p]} <span>{item.animations?.[p]?'Configurada':'Opcional'}</span></summary><button type="button" onclick={()=>chooseUpload(p)}><Upload size={15}/>{item.animations?.[p]?'Cambiar hoja':'Añadir hoja PNG'}</button>{#if item.animations?.[p]}{@const clip=item.animations[p]!}<div class="two-fields"><label>Ancho celda<input aria-label={`PNJ ${p} ancho`} type="number" min="1" bind:value={clip.frameWidth}/></label><label>Alto celda<input aria-label={`PNJ ${p} alto`} type="number" min="1" bind:value={clip.frameHeight}/></label><label>Fotogramas<input aria-label={`PNJ ${p} fotogramas`} type="number" min="1" max="64" bind:value={clip.frames}/></label><label>FPS<input aria-label={`PNJ ${p} fps`} type="number" min="1" max="60" bind:value={clip.fps}/></label><label>Vistas de la hoja<select aria-label={`PNJ ${p} direcciones`} value={clip.directions?'four':'single'} onchange={e=>{if(e.currentTarget.value==='four')clip.directions=['ne','se','sw','nw'];else delete clip.directions;dirty=true;}}><option value="single">Una dirección</option><option value="four">4 direcciones: NE, SE, SW, NW</option></select></label><label>{clip.directions?'Primera fila (NE)':'Fila (desde 0)'}<input type="number" min="0" bind:value={clip.row}/></label></div><button type="button" class="text-danger" onclick={()=>{delete item.animations![p];dirty=true;}}>Quitar animación</button>{/if}</details>{/each}</section>{/if}
   {:else if kind==='player'}
    <section class="fields-section"><h3>Formato del personaje</h3><div class="two-fields"><label>Ancho celda<input aria-label="Ancho de fotograma" type="number" min="1" bind:value={character.frameWidth}/></label><label>Alto celda<input aria-label="Alto de fotograma" type="number" min="1" bind:value={character.frameHeight}/></label></div><label>Escala (%)<input aria-label="Escala del jugador" type="number" min="5" max="800" value={Math.round((character.scale??1)*100)} oninput={e=>character.scale=e.currentTarget.valueAsNumber/100}/></label><div class="two-fields"><label>Apoyo X<input type="number" step="any" bind:value={character.anchor[0]}/></label><label>Apoyo Y<input type="number" step="any" bind:value={character.anchor[1]}/></label></div><p>Las seis acciones comparten tamaño de celda y apoyo. Filas: NE, SE, SW y NW.</p></section>
    <section class="fields-section"><h3>Acción · {actionLabels[pose]}</h3>{#if pose==='sit'}<label class="checkbox"><input type="checkbox" bind:checked={reuseSit} onchange={syncSit}/> Usar primer fotograma de trabajar</label>{/if}{#if pose!=='sit'||!reuseSit}<button type="button" class="upload" onclick={()=>chooseUpload(pose)}><Upload size={15}/>{characterImage(character,pose)?'Sustituir hoja':'Subir hoja PNG'}</button><div class="two-fields"><label>Fotogramas<input aria-label="Fotogramas de la acción" type="number" min="1" max="64" bind:value={character.animations[pose].frames}/></label><label>FPS<input aria-label="FPS de la acción" type="number" min="1" max="60" bind:value={character.animations[pose].fps}/></label><label>Primera fila<input aria-label="Fila de la acción" type="number" min="0" bind:value={character.animations[pose].row}/></label></div><p>Se leen cuatro filas consecutivas desde la indicada.</p>{:else}<p>La postura sentada utiliza la hoja de trabajar.</p>{/if}</section>
   {:else}
    <p class="metadata-note">El nombre del catálogo se usa al colocar objetos nuevos. Cada objeto del mapa tiene su propio nombre.</p>
    <button type="button" class="upload" onclick={()=>chooseUpload()}><Upload size={16}/> {tileImage?'Sustituir textura PNG':'Subir textura PNG'}</button><section class="fields-section"><h3>Recorte de la baldosa</h3><div class="two-fields">{#each ['X','Y','Ancho','Alto'] as title,i}<label>{title}<input aria-label={`Baldosa ${title}`} type="number" min={i<2?0:1} bind:value={tileFrame[i]}/></label>{/each}</div><p>El recorte se adapta a una baldosa de 64 × 32. Usa un dibujo isométrico y revisa las uniones del mosaico.</p></section><p class="tile-info">{current?`Guardar «${name}» cambia su aspecto en las casillas que utilizan este suelo.`:'El nuevo suelo aparecerá en la paleta de Baldosas del editor. La imagen se conserva con su recorte.'}</p>
   {/if}
   <div class="save-actions"><button type="button" disabled={dirty||!current||!!objectProposal} onclick={publishResource}>Añadir a mi biblioteca</button>{#if dirty}<small>Guarda en la aventura antes de añadirlo a la biblioteca.</small>{/if}<button class="primary" type="submit" disabled={!dirty||!!objectProposal}><Save size={16}/>{busy?'Guardando…':'Guardar en aventura'}</button>{#if kind==='player'&&current}<button type="button" disabled={dirty||isActivePlayer} onclick={activate}>{#if isActivePlayer}<Check size={16}/>Jugador activo{:else}<UserRound size={16}/>Usar como jugador{/if}</button>{/if}<button type="button" disabled={!dirty||!!objectProposal} onclick={saveDraft}>Guardar borrador</button>{#if current&&dirty}<button type="button" onclick={()=>ask(()=>select(current!))}><RotateCcw size={14}/> Restaurar guardado</button>{/if}{#if custom&&current}<button type="button" class="text-danger" disabled={usages.length>0||isActivePlayer} onclick={()=>ask(()=>void remove())}><Trash2 size={14}/> Eliminar del catálogo</button>{/if}</div>
  </fieldset></form>
  {:else}<main class="empty-stage"><Users size={40}/><h2>Un nuevo habitante para tu mundo</h2><p>Sube una imagen, ajusta su tamaño junto al jugador y colócala en el mapa. Las animaciones son opcionales.</p><button class="primary" onclick={create}><Plus size={17}/>Añadir PNJ</button></main>{/if}
 </div></div>{/if}
</div>
{#if imageEdit}<ImageEditor session={imageEdit} palette={adventure?.palette} navigation={cycleNavigation} onselect={selectEditCycle} saveHint="Los retoques se guardarán cuando pulses «Guardar en aventura»." onapply={applyImage} onclose={closeImageEditor} onchange={value=>imageEditDirty=value}/>{/if}
<input class="sr-only" bind:this={fileInput} type="file" accept="image/png,.png" aria-label="Archivo PNG del recurso" onchange={upload}/>
<input class="sr-only" bind:this={characterZipInput} type="file" accept=".zip,application/zip" aria-label="ZIP del personaje" onchange={importCharacterZip}/>
<dialog bind:this={confirmDialog} class="confirm"><h2>Tienes cambios sin guardar</h2><p>{objectProposal?'Usa o descarta la propuesta de IA antes de guardar.':'Puedes conservarlos como borrador antes de continuar.'}</p><div><button onclick={()=>confirmDialog.close()}>Seguir editando</button><button onclick={continueAction}>Descartar cambios</button><button class="primary" disabled={busy||!!objectProposal} onclick={async()=>{if(await saveDraft())continueAction();}}>Guardar borrador y continuar</button></div></dialog>

<style>
 .scope-switch{display:flex;gap:4px;margin-left:auto;flex-shrink:0}.scope-switch button{padding:8px 10px;border:1px solid #d8e0ce;border-radius:7px;white-space:nowrap}.scope-switch button[aria-pressed=true],.scope-switch button[aria-pressed=true]:hover:not(:disabled){background:#476238;color:white}.save-actions small{font-size:11px;color:#627354;line-height:1.5}

 .zip-note{font-size:11px;line-height:1.6;color:#627354;margin:0 0 14px}
 .source-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.source-card{flex-wrap:wrap}.restore-image{font-size:11px;margin:8px 0}.source-hint{font-size:11px;line-height:1.5;color:#7a8671;margin:0 0 10px}
 .workshop{max-width:1560px;margin:auto;padding:0 32px 40px;color:#2b4133}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:40px;border-bottom:1px solid #dce3d5;font-size:11px}.top a{display:flex;align-items:center;gap:7px}.top nav{display:flex;align-items:center;gap:20px}.intro{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:14px 0}.eyebrow{font-size:9px;letter-spacing:1.7px;color:#7a886b;font-weight:650;margin:0 0 9px}h1{font-size:23px;font-weight:600;letter-spacing:-.6px;margin:0;white-space:nowrap}.adventure-tools{display:flex;align-items:center;gap:8px}.adventure-tools label{display:flex;flex-direction:row;align-items:center;gap:8px;margin:0}.adventure-tools select{width:180px;padding:8px}.adventure-tools button{padding:8px 10px;white-space:nowrap}.resource-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #dce3d5;margin-bottom:16px;padding:0 0 10px}.category-bar{display:flex;align-items:center;gap:4px;min-width:0}.category-bar button{border-color:transparent;background:transparent;padding:8px 12px;white-space:nowrap}.category-bar button[aria-pressed=true]{background:#e5edda;color:#38552c;border-color:#d8e3c9}.category-bar button>span{font-size:10px;background:#ffffff90;padding:2px 6px;border-radius:5px}.palette-tools{min-width:0;margin-left:auto;max-width:40%}.palette-tools[hidden]{display:none}.workspace{padding:0;margin:0;max-width:none;display:grid;grid-template-columns:240px minmax(300px,1fr) 292px;gap:24px;align-items:start}.library{border-right:1px solid #e0e6d9;padding-right:18px;min-width:0}.library-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.library-title h2,.inspector h2{font-size:14px;margin:0}.library-title>span{font-size:11px;color:#869078}.search{display:flex;flex-direction:row;align-items:center;gap:7px;border:1px solid #d9e1d1;border-radius:8px;padding:0 9px;background:#fff}.search input{border:0;background:transparent;padding:10px 0;min-width:0}.add{width:100%;justify-content:center;margin:12px 0;background:#f1f5e9;border-style:dashed;color:#587641}.resource-list{display:grid;gap:6px;max-height:650px;overflow-y:auto;margin-top:12px}.resource-list button{padding:8px;gap:10px;text-align:left;background:transparent;border-color:transparent;min-width:0}.resource-list button.selected{background:#edf2e4;border-color:#c7d8b4}.thumb{width:44px;height:49px;background:#e8eedf;border-radius:5px;display:grid;place-items:center;overflow:hidden;flex-shrink:0}.thumb :global(canvas){width:100%;height:100%}.resource-name{display:grid;gap:5px;min-width:0}.resource-name strong{font-size:11px;font-weight:550;white-space:normal;overflow-wrap:anywhere}.resource-name small{font-size:9px;color:#869176}.selection-dot{width:6px;height:6px;background:#7ea253;border-radius:50%;margin-left:auto;flex-shrink:0}.storage-note,.library-note,.empty-list{font-size:11px;line-height:1.65;color:#87927b;margin-top:20px}.stage-column{min-width:0;margin-left:0;width:100%}.resource-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:63px;margin-bottom:15px}.resource-heading h2{font-size:23px;font-weight:550;margin:0;overflow-wrap:anywhere}.state-badge{font-size:10px;color:#748164;background:#edf1e6;border:1px solid #e0e7d4;border-radius:20px;padding:6px 10px;white-space:nowrap}.state-badge.unsaved{color:#957138;background:#faf0db;border-color:#ebd9b5}.preview-tools{display:flex;justify-content:space-between;gap:10px;margin:12px 0}.preview-tools>div{display:flex;align-items:center;gap:5px}.preview-tools button{padding:7px}.preview-tools select{width:auto;padding:7px;font-size:11px}.preview-tools span,.preview-tools output{font-size:11px;min-width:25px;text-align:center;color:#839174}.preview-note{font-size:11px;color:#768867;margin:14px 0}.action-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:20px 0}.action-strip button{display:grid;gap:6px;text-align:left;padding:10px;font-size:11px}.action-strip small{font-size:9px;color:#829073}.action-strip button.active{border-color:#9cb57e;background:#eff5e5}.source-card{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:18px 0 12px;border-top:1px solid #e1e6da;margin-top:24px}h3{font-size:12px;font-weight:600;margin:0 0 9px}.source-card p{margin:0;font-size:11px;color:#89927b}.source-card button{font-size:11px;padding:8px}.source-detail{font-size:11px;color:#708361}.source-detail>div{background:repeating-conic-gradient(#e6e9e1 0% 25%,#f6f8f0 0% 50%) 0/16px 16px;max-height:240px;overflow:auto;margin-top:10px;padding:14px}.source-detail img{max-width:100%;image-rendering:pixelated}.usage-card{border-top:1px solid #e1e6da;margin-top:24px;padding-top:18px}.usage-card p{font-size:11px;line-height:1.7;color:#7d8b71}.usage-card button{font-size:11px}.inspector{border:1px solid #dce3d3;background:#fffef9;border-radius:13px;padding:18px;min-width:0}.inspector fieldset{border:0;padding:0;margin:0;min-width:0}.inspector-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.inspector-title span{font-size:9px;color:#91a07d;text-transform:uppercase;letter-spacing:1px}label{display:flex;flex-direction:column;gap:7px;font-size:11px;color:#627354;margin-bottom:12px}input,select{font:inherit;color:#3e5334;border:1px solid #d8e0ce;border-radius:6px;padding:9px;background:#fff;width:100%;box-sizing:border-box;min-width:0}input[type=range]{padding:0;accent-color:#648944}input[type=checkbox]{width:14px;height:14px;accent-color:#628541}.checkbox{flex-direction:row;align-items:center;font-size:10px}.metadata-note{font-size:11px;color:#7d8b71;line-height:1.6;margin:0 0 12px}.fields-section{border-top:1px solid #e4e8dd;padding-top:17px;margin-top:20px}.fields-section p,.tile-info{font-size:10px;line-height:1.65;color:#8a947e;margin:10px 0}.fields-section button{font-size:10px;width:100%;justify-content:center}.fields-section>label>span{align-self:flex-end;margin-top:-18px;font-size:10px}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}.upload{justify-content:center;width:100%;background:#f2f6ea;border-style:dashed;font-size:11px;margin:10px 0 16px}.clip-editor{border:1px solid #e1e7d7;border-radius:7px;padding:10px;margin-top:10px}.clip-editor summary{font-size:11px}.clip-editor summary span{font-size:9px;float:right;color:#9ba58c}.clip-editor .two-fields{margin-top:12px}.clip-editor button{margin-top:12px}.save-actions{display:grid;gap:8px;margin-top:25px;border-top:1px solid #e0e6d8;padding-top:18px}.save-actions button{justify-content:center;font-size:11px}.text-danger{color:#a57565;background:transparent;border-color:transparent;font-size:10px}button,a{color:inherit}a{text-decoration:none}button{display:flex;align-items:center;gap:7px;font:inherit;font-size:12px;padding:10px 12px;border:1px solid #d8e0ce;background:#fffef9;border-radius:7px;cursor:pointer;line-height:1.3}button:hover:not(:disabled){border-color:#9eb687;background:#f1f5e9}button:disabled{opacity:.45;cursor:default}.primary{background:#476238;color:#fff;border-color:#476238}.primary:hover:not(:disabled){background:#365128;color:#fff}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #74994e;outline-offset:3px}summary{cursor:pointer;font-size:11px;color:#677d54}details[open]>summary{margin-bottom:12px}.alert{padding:12px 16px;border-radius:8px;margin:0 0 16px;font-size:12px;display:flex;align-items:center;gap:8px}.error{color:#963f31;background:#fbeae3}.notice{background:#e9f3df;color:#557a34}.draft-banner{display:flex;align-items:center;gap:12px;justify-content:space-between;font-size:12px;background:#f3eddc;padding:10px 14px;border-radius:8px;margin-bottom:18px}.empty-stage{margin-left:0;width:100%;grid-column:span 2;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;background:#eef3e6;border:1px dashed #cbd9bc;border-radius:16px;padding:28px}.empty-stage h2{font-size:22px}.empty-stage p{max-width:380px;font-size:13px;line-height:1.7;color:#7f8e71}.empty-stage button{margin-top:16px}.confirm{border:1px solid #d3dec6;border-radius:16px;padding:28px;max-width:460px;color:#344a2e}.confirm::backdrop{background:#26332266;backdrop-filter:blur(3px)}.confirm h2{font-size:21px}.confirm p{font-size:13px;color:#829271;line-height:1.6}.confirm>div{display:flex;gap:8px;flex-wrap:wrap}.confirm button{font-size:11px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 @media(max-width:1180px){.workshop{padding:0 20px 30px}.workspace{grid-template-columns:190px minmax(260px,1fr) 260px;gap:16px}.category-bar button{padding:9px 12px}.library{padding-right:12px}}
 @media(max-width:960px){.workspace{grid-template-columns:190px minmax(0,1fr)}.inspector{grid-column:2}.stage-column{grid-column:2}.library{grid-row:span 2}.scope-switch{width:100%;margin-left:0}.intro{gap:10px 16px}.adventure-tools{margin-left:auto}.category-bar button{padding:8px 9px}.empty-stage{grid-column:2}}
 @media(max-width:650px){.workshop{padding:0 12px 24px}.top{gap:8px;padding:8px 0;min-height:32px;align-items:flex-start}.top nav{gap:8px;flex-wrap:wrap;justify-content:flex-end}.top a{font-size:10px}.intro{padding:12px 0;gap:10px}.intro h1{font-size:21px}.adventure-tools{width:100%;margin:0}.adventure-tools label{flex:1;min-width:0}.adventure-tools select{width:100%;min-width:0}.adventure-tools button{font-size:11px}.scope-switch{width:100%}.scope-switch button{flex:1;justify-content:center;font-size:11px}.resource-toolbar{gap:8px;flex-wrap:wrap;margin-bottom:12px;padding-bottom:8px}.category-bar{width:100%;justify-content:space-between}.category-bar button{font-size:11px;gap:5px;padding:8px 6px}.category-bar button>span{display:none}.palette-tools{max-width:100%}.workspace{display:flex;flex-direction:column;gap:18px}.library{border-right:0;padding:0;width:100%}.library-title,.storage-note,.library-note{display:none}.library .search{margin:0}.library .add{margin:8px 0}.resource-list{display:flex;overflow-x:auto;margin:8px 0 0;max-height:100px;padding-bottom:8px}.resource-list button{min-width:145px;max-width:175px}.thumb{width:36px;height:40px}.resource-name strong{font-size:10px}.stage-column,.inspector{width:100%;box-sizing:border-box}.resource-heading{margin-bottom:8px;min-height:45px}.resource-heading h2{font-size:20px}.resource-heading .eyebrow{font-size:8px}.preview-tools{flex-wrap:wrap}.empty-stage{box-sizing:border-box;width:100%;min-height:280px}.draft-banner{font-size:11px}.draft-banner button{font-size:10px}.save-actions .primary{min-height:44px}}
</style>
