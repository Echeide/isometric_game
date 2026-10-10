<script lang="ts">
 import {onMount,onDestroy,untrack,tick} from 'svelte';
 import LoadProgress from '$lib/components/LoadProgress.svelte';
 import {preloadItems,type LoadProgress as Progress} from '$lib/storage/preload';
 const preloadAbort=new AbortController();let loadProgress=$state<Progress|null>(null);
 import {beforeNavigate,goto} from '$app/navigation';
 import {ArrowLeft,Plus,Search,Box,UserRound,Users,Layers,Upload,Download,Copy,Save,Trash2,Play,Pause,Check,Minus,RotateCcw,Move,Scissors,Pencil,Palette,PanelLeft,Settings2,Sparkles,MoreHorizontal,ChevronLeft,ChevronRight,X,Info,LoaderCircle} from 'lucide-svelte';
 import {EditorPanel as WorkshopPanel} from '@isometrico/editor-ui';
 import TransformToolbar from './TransformToolbar.svelte';
 import {actorPoses,characterImage,resolveVisualCatalog,type PixelArtPack,type ObjectSprite,type CharacterPack,type ActorPose,type TileKind,type VisualAsset,type Facing} from '@isometrico/world';
 import {graphics as defaultGraphics} from '$lib/demo/pixelart';
 import type {Adventure} from '$lib/demo/adventure';
 import {localAdventures,resourceBlob,imageUrls,saveWorkshopDraft,loadWorkshopDraft,clearWorkshopDraft} from '$lib/storage/local-adventures';
 import {downloadBlob,exportAdventure,pngSize,validateCatalogGraphics} from '$lib/storage/adventure-package';
 import {validateGraphics,type ImageSize} from '@isometrico/world';
 import {workshopEntries,workshopNpc,standaloneCharacter,supportOrigin,resourceUsages,actionLabels,type ResourceKind,type ResourceEntry} from './resources';
 import AdventurePaletteEditor from './AdventurePaletteEditor.svelte';
 import ColorVariantEditor from './ColorVariantEditor.svelte';
 import {colorVariantResource} from './color-variant';
 import {defaultAdventurePalette,type AdventurePalette} from '$lib/demo/adventure-palette';
 import {mapResourceImages,resourceImages,prunePaletteOriginals,paletteFromColors,type PaletteResource} from './palette';
 import {decodePaletteImage,encodePalettePNG,adaptedColorsPNG} from './palette-browser';
 import {createTileBase} from './tile-base';
 import TileFamilyEditor from './TileFamilyEditor.svelte';
 import AdventureResourceCatalog from './AdventureResourceCatalog.svelte';
 import type {CatalogCategory} from './catalog';
 let catalogCategory=$state<CatalogCategory>('all');
 import ObjectFamilyEditor from './ObjectFamilyEditor.svelte';
 import {detachObject,objectFamilyId,appendObjectAspect,type ObjectFamilies} from '../../../packages/world/src/object-families';
 import {detachTile,tileFamilyId,type TileFamilies} from '../../../packages/world/src/tile-families';
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
 let tileFamilies=$state.raw<TileFamilies>({}),tilePreview=$state<'single'|'family'>('single');
 let objectFamilies=$state.raw<ObjectFamilies>({});
 const activeTileFamily=$derived(tileFamilyId(tileFamilies,selected));

 let libraryScope=$state<'adventure'|'general'|'global'>('adventure'),libraryKind=$state<ResourceKind>('object');
 let objectProposal=$state<string|null>(null);
 let paletteDialogOpen=$state(false),paletteLinks=$state<Record<string,string>>({});
 const paletteOriginals=$derived({...pack.paletteOriginalImages,...paletteLinks});
 const paletteResource=$derived({kind,item,character,tileImage});
 type WorkshopImageEdit=ImageEditSession&{source:string;original?:Frame;clip?:AnimationSheetClip;action?:ActorPose;direction?:Facing};
 let imageEdit=$state.raw<WorkshopImageEdit>(),imageEditDirty=$state(false);
 type ColorVariantSession={resource:PaletteResource;name:string;sourceId:string;adventureId:string;tileFrame:[number,number,number,number];size:{x:number;y:number};palette:AdventurePalette};
 let colorVariantSession=$state.raw<ColorVariantSession>();
 let pose=$state<ActorPose>('idle'),direction=$state(1),playing=$state(true),zoom=$state(2),reuseSit=$state(false),locked=$state(true);
 let kindSearch=$state<Record<ResourceKind,string>>({object:'',npc:'',player:'',tile:''});
 let search=$state(''),dirty=$state(false),busy=$state(false),loading=$state(true),loadFailed=$state(false),error=$state(''),notice=$state(''),hasDraft=$state(false);
 let imageRevision=$state(0),fileInput:HTMLInputElement,characterZipInput:HTMLInputElement,confirmDialog:HTMLDialogElement;
 let pendingAction:(()=>void)|undefined,uploadSlot='base',packSignature='',catalogSignature='',disposed=false;
 let catalogOpen=$state(false),catalogPinned=$state(false),inspectorOpen=$state(false),inspectorPinned=$state(true),wide=$state(false);
 let inspectorMode=$state<'properties'|'ai'|'source'>('properties'),assistantOpen=$state(true),editingName=$state(false);let nameInput:HTMLInputElement|undefined=$state();
 let objectAssistant:{acceptProposal:()=>Promise<void>;discardProposal:()=>void}|undefined=$state();
 const catalogShown=$derived(catalogOpen||(catalogPinned&&wide));
 const inspectorShown=$derived(inspectorOpen||(inspectorPinned&&wide));
 const overlayOpen=$derived((catalogOpen&&!(catalogPinned&&wide))||(inspectorOpen&&!(inspectorPinned&&wide)));
 function switchKind(next:ResourceKind){if(next!==kind){kindSearch[kind]=search;search=kindSearch[next];kind=next;}libraryKind=next;}
 function closeMenus(){document.querySelectorAll<HTMLDetailsElement>('.workshop details.menu[open]').forEach(d=>{const focused=d.contains(document.activeElement);d.open=false;if(focused)d.querySelector('summary')?.focus();});}
 function action(task:()=>unknown){closeMenus();void task();}
 function openCatalog(){inspectorOpen=false;catalogOpen=true;}
 function openInspector(mode:'properties'|'ai'|'source'='properties'){catalogOpen=false;inspectorMode=mode;assistantOpen=true;inspectorOpen=true;}
 function chooseResource(entry:ResourceEntry){if(busy)return;if(entry.id===selected&&entry.kind===kind){catalogOpen=false;return;}ask(()=>{select(entry);catalogOpen=false;});}
 function chooseId(id:string){const entry=entries.find(e=>e.id===id);if(entry)chooseResource(entry);}
 function navigateResource(delta:number){const entry=navigationEntries[selectedIndex+delta];if(selectedIndex>=0&&entry)chooseResource(entry);}
 function browseKind(next:ResourceKind){if(libraryScope!=='adventure'){libraryKind=next;return;}ask(()=>{switchKind(next);const entry=entries.find(e=>e.kind===next);if(entry)select(entry);else{selected='';dirty=false;}catalogOpen=true;});}
 function createFromCatalog(){ask(()=>{libraryScope='adventure';kind=libraryKind;catalogOpen=false;openInspector();void createResource();});}
 async function rename(){editingName=true;await tick();nameInput?.focus();nameInput?.select();}
 async function saveRequest(){if(busy||!dirty||objectProposal)return;const form=document.getElementById('resource-properties') as HTMLFormElement|null;if(form&&!form.checkValidity()){editingName=false;openInspector();form.querySelectorAll<HTMLDetailsElement>('details').forEach(d=>d.open=true);await tick();form.reportValidity();return;}await save();if(error){openInspector();form?.querySelectorAll<HTMLDetailsElement>('details').forEach(d=>d.open=true);}}
 onMount(()=>{const media=matchMedia('(min-width:1200px)');wide=media.matches;const change=()=>wide=media.matches;media.addEventListener('change',change);return()=>media.removeEventListener('change',change);});
 const pending=new Map<string,Blob>(),urls=new Map<string,string>(),sizes=new Map<string,ImageSize>();
 type Draft={kind:ResourceKind;selected:string;name:string;category:VisualAsset['category'];size:{x:number;y:number};item:ObjectSprite;character:CharacterPack;tileImage:string;tileOriginalImage?:string;tileFrame:[number,number,number,number];tileFamilies?:TileFamilies;objectFamilies?:ObjectFamilies;reuseSit:boolean;paletteLinks?:Record<string,string>;pending:Record<string,Blob>};
 const entries=$derived(workshopEntries(pack,adventure?.catalog,adventure?.catalogOverrides));
 const current=$derived(entries.find(e=>e.id===selected&&e.kind===kind));
 const tileDraft=$derived(kind==='tile'&&tileImage?{id:selected,kind:'tile' as const,name,image:tileImage,frame:tileFrame,custom:current?.custom??true}:undefined);
 const tileChoices=$derived([...entries.filter(e=>e.kind==='tile').map(e=>e.id===selected&&tileDraft?tileDraft:e),...(tileDraft&&!current?[tileDraft]:[])]);
 const objectDraft=$derived(kind==='object'&&item.image?{id:selected,kind:'object' as const,name,category,image:item.image,frame:item.frame,custom:current?.custom??true}:undefined);
 const objectChoices=$derived([...entries.filter(e=>e.kind==='object').map(e=>e.id===selected&&objectDraft?objectDraft:e),...(objectDraft&&!current?[objectDraft]:[])]);
 const tileFamilyPreview=$derived(activeTileFamily?Object.entries(tileFamilies[activeTileFamily].tiles).map(([id,weight])=>{const entry=tileChoices.find(e=>e.id===id);return {image:entry?.image??'',frame:entry?.frame,weight:weight??0};}).filter(e=>e.image):[]);
 function catalogVersion(a:Adventure){return JSON.stringify([a.catalog??[],a.catalogOverrides??{},a.palette??null]);}
 const custom=$derived(selected.startsWith('custom.'));
 const usages=$derived(adventure&&current?resourceUsages(adventure.maps,current,adventure.story):[]);
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
 const navigationEntries=$derived(entries.filter(e=>e.kind===kind)),selectedIndex=$derived(navigationEntries.findIndex(e=>e.id===selected));
 const familyId=$derived(kind==='object'?objectFamilyId(objectFamilies,selected):kind==='tile'?activeTileFamily:undefined);
 const familyName=$derived(kind==='object'&&familyId?objectFamilies[familyId]?.name:kind==='tile'&&familyId?tileFamilies[familyId]?.name:undefined);
 const familyMembers=$derived(kind==='object'&&familyId?Object.entries(objectFamilies[familyId].aspects).map(([id,label])=>({...objectChoices.find(e=>e.id===id)!,label})).filter(e=>e.id):kind==='tile'&&familyId?Object.keys(tileFamilies[familyId].tiles).map(id=>({...tileChoices.find(e=>e.id===id)!,label:tileChoices.find(e=>e.id===id)?.name??id})).filter(e=>e.id):[]);
 function resolve(url:string){imageRevision;return urls.get(url)??(url.startsWith('asset:')?'':url);}
 function message(cause:unknown){error=cause instanceof Error?cause.message:'No se pudo completar la operación.';}
 function ask(action:()=>void){if(dirty||objectProposal){pendingAction=action;confirmDialog.showModal();}else action();}
 function continueAction(){dirty=false;confirmDialog.close();const action=pendingAction;pendingAction=undefined;action?.();}
 beforeNavigate(nav=>{if(busy){nav.cancel();notice='Espera a que termine la operación en curso antes de salir del taller.';return;}if(imageEdit||paletteDialogOpen||colorVariantSession){nav.cancel();return;}if((dirty||objectProposal)&&nav.to?.url&&!nav.willUnload){nav.cancel();ask(()=>void goto(nav.to!.url));}});
 function beforeUnload(event:BeforeUnloadEvent){if(busy||dirty||imageEditDirty||objectProposal||paletteDialogOpen||colorVariantSession){event.preventDefault();event.returnValue='';}}
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
 onMount(()=>{playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;const query=new URLSearchParams(location.search),section=query.get('section');if(tabs.some(t=>t.id===section)){kind=section as ResourceKind;libraryKind=kind;}void load(query.get('adventure')??undefined);});
 onDestroy(()=>{disposed=true;preloadAbort.abort();urls.forEach(url=>URL.revokeObjectURL(url));});
 function select(entry:ResourceEntry){
  switchKind(entry.kind);editingName=false;inspectorMode='properties';objectFamilies=clone(pack.objectFamilies??{});paletteLinks={};kind=entry.kind;selected=entry.id;name=entry.name;pose='idle';error='';notice='';dirty=false;zoom=2;locked=true;
  const asset=resolveVisualCatalog(adventure?.catalog,adventure?.catalogOverrides).find(a=>a.id===entry.id);category=asset?.category??'office';size=clone(asset?.size??{x:1,y:1});
  if(kind==='player'){character=entry.id==='default'?standaloneCharacter(pack.character,'728da5'):clone(pack.players![entry.id].character);reuseSit=characterImage(character,'sit')===characterImage(character,'work')&&character.animations.sit.frames===1;}
  else if(kind==='tile'){tileFamilies=clone(pack.tileFamilies??{});tilePreview='single';tileImage=pack.tiles[entry.id as TileKind];tileOriginalImage=pack.tileOriginalImages?.[entry.id as TileKind];const dimensions=sizes.get(tileImage)!;tileFrame=clone(pack.tileFrames?.[entry.id as TileKind]??[0,0,dimensions.width,dimensions.height]);}
  else item=clone(kind==='npc'?workshopNpc(pack,entry.id):pack.objects[entry.id]);
 }
 function tab(next:ResourceKind){ask(()=>{switchKind(next);const entry=entries.find(e=>e.kind===next);if(entry)select(entry);else{selected='';dirty=false;}catalogOpen=false;});}
 function create(){ask(()=>void createResource());}
 async function createResource(){
  if(busy)return;busy=true;error='';
  try{
  let baseImage='';
  if(kind==='tile'){
   const base=createTileBase(adventure?.palette),blob=new Blob([new Uint8Array(encodePalettePNG(base))],{type:'image/png'}),id=crypto.randomUUID();
   baseImage=`asset:${id}`;await addImage(baseImage,blob);if(disposed)return;pending.set(id,blob);
  }
  objectFamilies=clone(pack.objectFamilies??{});paletteLinks={};selected=`custom.${crypto.randomUUID()}`;name=kind==='npc'?'Nuevo PNJ':kind==='player'?'Nuevo jugador':kind==='tile'?'Nuevo suelo':'Nuevo objeto';size={x:1,y:1};category=kind==='npc'?'people':'office';pose='idle';error='';notice='';dirty=true;
  if(kind==='player'){character=standaloneCharacter(defaultGraphics.character);character.image='';for(const p of actorPoses)character.animations[p].image='';reuseSit=true;}
  else if(kind==='tile'){tileFamilies=clone(pack.tileFamilies??{});tilePreview='single';tileImage=baseImage;tileOriginalImage=undefined;tileFrame=[0,0,64,32];notice='Base de 64 × 32 preparada. Pulsa «Editar imagen» para dibujar el suelo en Piskel.';}
  else item={image:'',width:64,height:64,origin:[32,48]};
  }catch(e){message(e);}finally{busy=false;}
 }
 function duplicate(){ask(()=>{selected=`custom.${crypto.randomUUID()}`;name=`${name} · copia`;dirty=true;notice='Variante independiente. Guarda para añadirla al catálogo.';});}
 function addTileVariant(){
  if(busy||dirty||kind!=='tile'||!current)return;
  if(Object.keys(pack.tiles).filter(id=>id.startsWith('custom.')).length>=128){error='La biblioteca admite hasta 128 suelos propios.';return;}
  const base=selected,id=`custom.${crypto.randomUUID()}` as TileKind,next=clone(pack.tileFamilies??{});
  let familyId=tileFamilyId(next,base);
  if(!familyId){familyId=`family.${crypto.randomUUID()}`;next[familyId]={name,tiles:{[base]:70}};}
  next[familyId].tiles[id]=30;
  selected=id;name=`${name.slice(0,109)} · variante`;tileFamilies=next;tilePreview='family';paletteLinks={};dirty=true;error='';
  notice='Variante preparada en su familia. Retócala con «Editar imagen» y guarda en la aventura.';
 }
 function addObjectAspect(){
  if(busy||dirty||objectProposal||kind!=='object'||!current)return;
  if((adventure?.catalog??[]).length>=128){error='El catálogo admite hasta 128 recursos propios.';return;}
  const base=selected,id=`custom.${crypto.randomUUID()}`;
  objectFamilies=appendObjectAspect(pack.objectFamilies??{},base,id,name);
  selected=id;name=`${name.slice(0,105)} · aspecto`;paletteLinks={};dirty=true;error='';
  notice='Aspecto preparado con el mismo tamaño y apoyo. Ponle un nombre como Abierto, retócalo en Piskel y guarda.';
 }
 function selectObjectAspect(id:string){const entry=entries.find(e=>e.kind==='object'&&e.id===id);if(entry&&id!==selected)ask(()=>select(entry));}
 function selectTileVariant(id:string){const entry=entries.find(e=>e.kind==='tile'&&e.id===id);if(entry)ask(()=>select(entry));}
 function openColorVariant(){
  if(busy||dirty||objectProposal||!current||!adventure)return;
  colorVariantSession={resource:clone(paletteResource),name,sourceId:selected,adventureId:adventure.id,tileFrame:clone(tileFrame),size:clone(size),palette:clone(adventure.palette??defaultAdventurePalette())};
 }
 async function applyColorVariant(variantName:string,blobs:Record<string,Blob>){
  const session=colorVariantSession;if(!session||session.sourceId!==selected||session.adventureId!==adventure?.id)throw Error('El recurso ha cambiado. Vuelve a abrir la variante.');
  if(!variantName.trim()||variantName.length>120)throw Error('Escribe un nombre de hasta 120 caracteres.');
  const sources=resourceImages(session.resource);if(Object.keys(blobs).length!==sources.length)throw Error('La variante debe incluir todas las hojas del recurso.');
  for(const source of sources){if(!blobs[source]||!sizes.has(source))throw Error('Falta una hoja de la variante.');await validateEditedImage(blobs[source],sizes.get(source)!);}
  busy=true;
  try{
   const replacements:Record<string,string>={};
   for(const source of sources){const id=crypto.randomUUID(),url=`asset:${id}`;await addImage(url,blobs[source]);if(disposed)return;pending.set(id,blobs[source]);replacements[source]=url;}
   const variant=colorVariantResource(session.resource,replacements);
   if(variant.kind==='object'||variant.kind==='npc')variant.item.originalImage=session.resource.item.image;
   usePaletteResource(variant);if(variant.kind==='tile')tileOriginalImage=session.resource.tileImage;
   selected=`custom.${crypto.randomUUID()}`;if(session.resource.kind==='object')objectFamilies=appendObjectAspect(pack.objectFamilies??{},session.sourceId,selected,session.name);name=variantName.trim();paletteLinks={};dirty=true;error='';
   notice='Variante de color preparada. El original se conserva. Pulsa «Guardar en aventura» para añadirla al catálogo.';
  }finally{busy=false;}
 }
 function support(){item.origin=supportOrigin(item,size);dirty=true;}
 function setScale(percent:number){if(!Number.isFinite(percent)||percent<5||percent>400)return;const factor=percent/100,newW=crop[2]*factor,newH=crop[3]*factor;if(newW>4096||newH>4096)return;const ratio=newW/item.width,cx=(size.x-size.y)*16,cy=(size.x+size.y)*8;const a=(item.rotation??0)*Math.PI/180,px=cx*Math.cos(a)+cy*Math.sin(a),py=-cx*Math.sin(a)+cy*Math.cos(a);item.origin=[(item.origin[0]+px)*ratio-px,(item.origin[1]+py)*ratio-py];item.width=newW;item.height=newH;dirty=true;}
 function dimension(axis:'width'|'height',value:number){const old=item[axis];if(!Number.isFinite(value)||value<1||value>4096)return;if(locked){const ratio=value/old;if(item.width*ratio>4096||item.height*ratio>4096)return;item.width*=ratio;item.height*=ratio;const cx=(size.x-size.y)*16,cy=(size.x+size.y)*8;const a=(item.rotation??0)*Math.PI/180,px=cx*Math.cos(a)+cy*Math.sin(a),py=-cx*Math.sin(a)+cy*Math.cos(a);item.origin=[(item.origin[0]+px)*ratio-px,(item.origin[1]+py)*ratio-py];}else item[axis]=value;dirty=true;}
 function setCrop(index:number,value:number){const frame=[...crop] as [number,number,number,number];frame[index]=value;item.frame=frame;dirty=true;}
 async function trim(){busy=true;try{const frame=await visibleCrop(resolve(item.image),crop),factor=item.width/crop[2];item.frame=frame;item.width=frame[2]*factor;item.height=frame[3]*factor;support();notice='Márgenes transparentes recortados. El PNG original se conserva.';}catch(e){message(e);}finally{busy=false;}}
 function shift(dx:number,dy:number){if(busy||objectProposal)return;if(kind==='player'){const scale=character.scale??1;if(!Number.isFinite(scale)||scale<=0)return;character.anchor=[character.anchor[0]-dx/scale,character.anchor[1]-dy/scale];}else {const a=(item.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);item.origin=[item.origin[0]-dx*c-dy*s,item.origin[1]+dx*s-dy*c];}dirty=true;}
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
   }else{const keepGeometry=kind==='object'&&!!item.image&&!!objectFamilyId(objectFamilies,selected);item.image=url;delete item.originalImage;delete item.generationImage;item.frame=[0,0,dimensions.width,dimensions.height];if(!keepGeometry){const factor=Math.min(1,96/dimensions.width,96/dimensions.height);item.width=dimensions.width*factor;item.height=dimensions.height*factor;support();}}
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
   if(kind==='tile')currentPack.tileFamilies=clone(tileFamilies);
   if(kind==='object')currentPack.objectFamilies=clone(objectFamilies);
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
    currentPack.tileFamilies=detachTile(currentPack.tileFamilies??{},selected);
   }else{if(current&&resourceUsages(currentAdventure.maps,current,currentAdventure.story).length)throw new Error('Este recurso se utiliza en un mapa. Retira sus instancias antes de eliminarlo.');delete currentPack.objects[selected];currentPack.objectFamilies=detachObject(currentPack.objectFamilies??{},selected);currentAdventure.catalog=currentAdventure.catalog?.filter(e=>e.id!==selected);}
   prunePaletteOriginals(currentPack);validateGraphics(currentPack,sizes);validateCatalogGraphics(currentAdventure,currentPack);
   await localAdventures.save(currentAdventure,{pack:currentPack,blobs:{}});dirty=false;await load(adventure!.id);notice='Recurso eliminado del catálogo.';
  }catch(e){message(e);}finally{busy=false;}}
 async function saveDraft(){if(!adventure)return false;busy=true;try{const draft:Draft={kind,selected,name,category,size:clone(size),item:clone(item),character:clone(character),tileImage,tileOriginalImage,tileFrame:clone(tileFrame),tileFamilies:clone(tileFamilies),objectFamilies:clone(objectFamilies),reuseSit,paletteLinks:clone(paletteLinks),pending:Object.fromEntries(pending)};await saveWorkshopDraft(adventure.id,draft);hasDraft=true;notice='Borrador guardado en este navegador. Aún no modifica el juego.';return true;}catch(e){message(e);return false;}finally{busy=false;}}
 async function restoreDraft(){if(!adventure)return;busy=true;try{const draft=await loadWorkshopDraft<Draft>(adventure.id);if(!draft)return;for(const [id,blob]of Object.entries(draft.pending)){pending.set(id,blob);await addImage(`asset:${id}`,blob);}kind=draft.kind;selected=draft.selected;name=draft.name;category=draft.category;size=draft.size;item=draft.item;character=draft.character;tileImage=draft.tileImage;tileOriginalImage=draft.tileOriginalImage;tileFrame=draft.tileFrame;tileFamilies=clone(draft.tileFamilies??pack.tileFamilies??{});tilePreview='single';objectFamilies=clone(draft.objectFamilies??pack.objectFamilies??{});reuseSit=draft.reuseSit;paletteLinks=draft.paletteLinks??{};dirty=true;notice='Borrador recuperado. Revisa los campos y guarda en la aventura.';}catch(e){message(e);}finally{busy=false;}}
 async function download(){try{if(editSource)downloadBlob(await paletteBlob(editSource),`${name||'recurso'}.png`);}catch(e){message(e);}}
 async function exportZip(){busy=true;try{const a=(await localAdventures.load()).adventures.find(a=>a.id===adventure!.id)!;downloadBlob(await exportAdventure(a),`${a.id}.zip`);notice='ZIP exportado con el catálogo y sus imágenes guardadas.';}catch(e){message(e);}finally{busy=false;}}
</script>

<svelte:window onbeforeunload={beforeUnload} onkeydown={e=>{if(e.key==='Escape')closeMenus();}}/>
<div class="workshop">
 <header class="context-header" inert={overlayOpen}>
  <a class="back" href={adventure?`/editor?adventure=${encodeURIComponent(adventure.id)}`:'/editor'} title="Volver al mapa"><ArrowLeft size={18}/><span>Mapa</span></a>
  <h1>Taller de sprites</h1>
  <label class="adventure-context"><span>Aventura</span><select aria-label="Aventura del taller" value={adventure?.id??''} disabled={loading||busy} onchange={e=>{const id=e.currentTarget.value;ask(()=>void load(id));}}>{#each adventures as a}<option value={a.id}>{a.name}</option>{/each}</select></label>
  <details class="menu context-menu"><summary aria-label="Opciones del taller" title="Opciones del taller"><MoreHorizontal size={20}/></summary><div class="menu-items"><a href="/characters">Generador de personajes IA ↗</a><a href={adventure?`/preview?adventure=${encodeURIComponent(adventure.id)}`:'/'}>Ir al mundo ↗</a><button disabled={!adventure||busy} onclick={()=>action(exportZip)}><Download size={15}/> Exportar aventura ZIP</button></div></details>
 </header>
 <nav class="workspace-toolbar" aria-label="Herramientas del taller" inert={overlayOpen}>
  <button class="catalog-trigger" aria-expanded={catalogShown} aria-controls="resource-catalog" disabled={loading||busy} onclick={()=>{if(catalogShown){catalogOpen=false;catalogPinned=false;}else openCatalog();}}><PanelLeft size={18}/><span>Catálogo</span></button>
  <div class="resource-types" role="group" aria-label="Tipos de recurso">{#each tabs as t}<button aria-label={t.label} aria-pressed={kind===t.id} disabled={loading||busy} onclick={()=>tab(t.id)} title={t.label}><t.icon size={16}/><span>{t.label}</span><small>{entries.filter(e=>e.kind===t.id).length}</small></button>{/each}</div>
  <div class="palette-tools">{#if !loading&&!loadFailed&&adventure}{#key adventure.id}<AdventurePaletteEditor compact palette={adventure.palette} disabled={busy||!!objectProposal} onsave={savePalette} onextract={selected&&resourceImages(paletteResource).length?extractPalette:undefined} onediting={value=>paletteDialogOpen=value}/>{/key}{/if}</div>
 </nav>
 {#if error}<div class="alert error" role="alert"><span>{error}</span><button aria-label="Cerrar aviso" onclick={()=>error=''}><X size={16}/></button></div>{/if}
 {#if notice}<div class="alert notice" role="status"><Check size={16}/><span>{notice}</span><button aria-label="Cerrar información" onclick={()=>notice=''}><X size={16}/></button></div>{/if}
 {#if loading}<LoadProgress title="Preparando tu biblioteca…" progress={loadProgress}/>{:else if loadFailed}<button class="retry" onclick={()=>load(adventure?.id)}>Reintentar carga</button>{:else if adventure}
 <div class="workbench">
  <WorkshopPanel id="resource-catalog" title="Catálogo de recursos" subtitle={adventure.name} side="left" large={libraryScope!=='adventure'} bind:open={catalogOpen} bind:pinned={catalogPinned} {wide} pinnable>
   <div class="scope-switch" role="group" aria-label="Ámbito de recursos"><button aria-pressed={libraryScope==='adventure'} disabled={busy} onclick={()=>{libraryScope='adventure';libraryKind=kind;}}>Esta aventura</button><button aria-pressed={libraryScope==='general'} disabled={busy} onclick={()=>libraryScope='general'}>Mi espacio</button><button aria-pressed={libraryScope==='global'} disabled={busy} onclick={()=>libraryScope='global'}>Compartidos</button></div>
   {#if libraryScope!=='adventure'}<div class="catalog-types" role="group" aria-label="Tipos del catálogo">{#each tabs as t}<button disabled={busy} aria-pressed={libraryKind===t.id} onclick={()=>browseKind(t.id)}><t.icon size={15}/>{t.label}</button>{/each}</div>{/if}{#if libraryScope!=='adventure'}{#key libraryScope}<SharedLibrary scope={libraryScope==='global'?'global':'tenant'} kind={libraryKind} {busy} onincorporate={entry=>ask(()=>{catalogOpen=false;void incorporateResource(entry);})}/>{/key}
   {:else}
    <AdventureResourceCatalog entries={kind==='object'?objectChoices:kind==='tile'?tileChoices:entries} {kind} onkindchange={browseKind} bind:query={search} bind:category={catalogCategory} {objectFamilies} {tileFamilies} {selected} {dirty} {busy} activePlayer={pack.activePlayer??'default'} {resolve} onselect={chooseId}>
     {#snippet tools()}<button class="add" disabled={busy} onclick={()=>{libraryKind=kind;createFromCatalog();}}><Plus size={16}/> Añadir {kind==='npc'?'PNJ':kind==='player'?'jugador':kind==='tile'?'suelo':'objeto'}</button>{#if kind==='player'}<button disabled={busy} onclick={()=>characterZipInput.click()}><Upload size={15}/> Importar ZIP del personaje</button><p class="hint">ZIP de hojas de animación del generador.</p>{/if}{/snippet}
    </AdventureResourceCatalog>
   {/if}
  </WorkshopPanel>
  <main class="editor-area" inert={overlayOpen}>
   {#if selected}
    <div class="selected-heading"><span class="selected-thumb"><SpriteThumbnail image={resolve(source)} frame={kind==='tile'?tileFrame:kind==='player'?current?.frame:item.frame}/></span><div class="selected-title"><span class="eyebrow">{tabs.find(t=>t.id===kind)?.label}</span>{#if editingName}<input bind:this={nameInput} class="selected-name" aria-label="Nombre del recurso" form="resource-properties" maxlength="120" required bind:value={name} oninput={()=>dirty=true} onblur={()=>{if(name.trim())editingName=false;}} onkeydown={e=>{if(e.key==='Enter'){e.preventDefault();if(name.trim())editingName=false;}}}/>{:else}<h2 aria-label={name}><button class="rename" title="Cambiar nombre" aria-label={`Cambiar nombre de ${name}`} disabled={busy} onclick={rename}><span>{name}</span><Pencil size={14}/></button></h2>{/if}</div><div class="resource-navigation" role="group" aria-label="Cambiar recurso"><button aria-label="Recurso anterior" title="Anterior" disabled={busy||selectedIndex<=0} onclick={()=>navigateResource(-1)}><ChevronLeft size={18}/></button><small>{selectedIndex>=0?`${selectedIndex+1} / ${navigationEntries.length}`:'Nuevo'}</small><button aria-label="Recurso siguiente" title="Siguiente" disabled={busy||selectedIndex<0||selectedIndex>=navigationEntries.length-1} onclick={()=>navigateResource(1)}><ChevronRight size={18}/></button></div><button class="properties-trigger" aria-controls="resource-inspector" aria-expanded={inspectorShown} title="Propiedades del recurso" aria-label="Propiedades del recurso" onclick={()=>{if(inspectorShown){inspectorOpen=false;inspectorPinned=false;}else{inspectorPinned=true;openInspector();}}}><Settings2 size={18}/><span>Propiedades</span></button></div>
    {#if objectProposal}<div class="proposal-banner" role="status"><Sparkles size={18}/><span>Propuesta de IA pendiente</span><button disabled={busy} class="primary" onclick={()=>void objectAssistant?.acceptProposal()}>Usar esta imagen</button><button disabled={busy} onclick={()=>objectAssistant?.discardProposal()}>Descartar propuesta</button><button onclick={()=>openInspector('ai')}>Acabado</button></div>{/if}
    <div class="canvas-area">
     <div class="image-tools" role="group" aria-label="Herramientas de imagen"><button disabled={busy||!editSource||!!objectProposal} title={editingAnimation?'Editar ciclo en Piskel':'Editar imagen en Piskel'} aria-label={editingAnimation?'Editar ciclo':'Editar imagen'} onclick={()=>void editImage()}><Pencil size={18}/></button><button disabled={busy||!!objectProposal} title="Sustituir imagen PNG" aria-label="Sustituir imagen" onclick={()=>chooseUpload(kind==='player'?pose:'base')}><Upload size={18}/></button>{#if kind==='object'}<button title="Generar con IA" aria-label="Generar con IA" onclick={()=>openInspector('ai')}><Sparkles size={18}/></button>{/if}<details class="menu"><summary aria-label="Más acciones de imagen" title="Más acciones de imagen"><MoreHorizontal size={19}/></summary><div class="menu-items"><button disabled={busy||!editSource||!!objectProposal} onclick={()=>action(download)}><Download size={15}/> Descargar PNG</button><button disabled={!editSource} onclick={()=>action(()=>openInspector('source'))}><Info size={15}/> Ver imagen y márgenes originales</button>{#if kind==='npc'&&activeClip}<button disabled={busy||!source||!!objectProposal} onclick={()=>action(()=>editImage(true))}>Editar imagen estática</button>{/if}{#if kind==='object'&&item.generationImage}<button disabled={busy||!!objectProposal} onclick={()=>action(()=>downloadGeneration().catch(message))}>Descargar original de IA</button>{/if}{#if originalImage&&source!==originalImage}<button disabled={busy||!!objectProposal} onclick={()=>action(restoreOriginalImage)}>Recuperar imagen original</button>{/if}{#if resourceImages(paletteResource).some(u=>!!paletteOriginals[u])}<button disabled={busy||!!objectProposal} onclick={()=>action(restorePalette)}>Recuperar colores originales</button>{/if}<button disabled={busy||dirty||!!objectProposal||!current} onclick={()=>action(openColorVariant)}><Palette size={15}/> Crear variante de color</button></div></details></div>
     <ResourceStage fit tileVariants={kind==='tile'&&tilePreview==='family'&&tileFamilyPreview.length>1?tileFamilyPreview:undefined} {kind} item={previewItem} {character} {pose} {direction} {playing} {zoom} {size} {tileImage} {tileFrame} reference={pack.activePlayer?pack.players![pack.activePlayer].character:pack.character} floorImage={defaultGraphics.tiles.office} {resolve} onshift={busy||objectProposal?undefined:shift}/>
     {#if kind==='object'||kind==='npc'}{#key selected}<TransformToolbar disabled={busy||!!objectProposal||!item.image} width={item.width} height={item.height} scale={scalePercent} rotation={item.rotation??0} {locked} onlock={v=>locked=v} onscale={setScale} ondimension={dimension} onrotate={v=>{if(Number.isFinite(v)&&Math.abs(v)<=180){item.rotation=v;dirty=true;}}} onshift={shift} onsupport={support}/>{/key}{/if}
    </div>
    <div class="preview-tools"><div>{#if kind==='tile'&&tileFamilyPreview.length>1}<select aria-label="Vista del suelo" bind:value={tilePreview}><option value="single">Solo esta textura</option><option value="family">Mosaico de familia</option></select>{/if}{#if kind==='player'||kind==='npc'}<button aria-label={playing?'Pausar animación':'Reproducir animación'} title={playing?'Pausar':'Reproducir'} onclick={()=>playing=!playing}>{#if playing}<Pause size={16}/>{:else}<Play size={16}/>{/if}</button><select aria-label="Acción de vista previa" bind:value={pose}>{#each kind==='npc'?npcPoses:actorPoses as p}<option value={p}>{actionLabels[p]}</option>{/each}</select>{/if}{#if kind==='player'||activeClip?.directions}<select aria-label="Dirección de vista previa" bind:value={direction}><option value={0}>NE ↗</option><option value={1}>SE ↘</option><option value={2}>SW ↙</option><option value={3}>NW ↖</option></select>{/if}</div><div class="zoom-tools"><span>Vista</span><button aria-label="Alejar vista previa" disabled={zoom<=.5} onclick={()=>zoom=Math.max(.5,zoom-.5)}><Minus size={15}/></button><output>{zoom}×</output><button aria-label="Acercar vista previa" disabled={zoom>=4} onclick={()=>zoom=Math.min(4,zoom+.5)}><Plus size={15}/></button></div></div>
    {#if kind==='object'||kind==='tile'}<div class="family-strip" aria-label={kind==='tile'?'Texturas del suelo':'Aspectos del objeto'}><span class="family-label">{familyName??(kind==='tile'?'Texturas':'Aspectos')}</span><div class="family-members">{#each familyMembers as member}<button disabled={busy} aria-pressed={member.id===selected} title={member.label} aria-label={`Seleccionar ${kind==='tile'?'textura':'aspecto'} ${member.label}`} onclick={()=>chooseId(member.id)}><span class="aspect-thumb"><SpriteThumbnail image={resolve(member.image)} frame={member.frame}/></span><span>{member.label}</span></button>{/each}<button class="add-aspect" disabled={busy||dirty||!!objectProposal||!current} title={kind==='tile'?'Añadir variante de textura':'Añadir aspecto'} aria-label={kind==='tile'?'Añadir variante de textura':'Añadir aspecto'} onclick={()=>kind==='tile'?addTileVariant():addObjectAspect()}><Plus size={18}/></button></div><button title="Configurar familia" aria-label="Configurar familia" onclick={()=>{openInspector();void tick().then(()=>{const details=document.getElementById('family-settings') as HTMLDetailsElement|null;if(details)details.open=true;});}}><Settings2 size={16}/></button></div>{/if}
   {:else}<div class="empty-stage"><Box size={40}/><h2>Un recurso para tu aventura</h2><p>Selecciona uno del catálogo o crea uno nuevo.</p><button class="primary" onclick={openCatalog}><PanelLeft size={17}/> Abrir catálogo</button></div>{/if}
  </main>
  <WorkshopPanel id="resource-inspector" title={inspectorMode==='ai'?'Generar con IA':inspectorMode==='source'?'Imagen fuente':'Propiedades'} subtitle={name} bind:open={inspectorOpen} bind:pinned={inspectorPinned} {wide}>
   {#snippet footer()}<div class="panel-save"><small>{busy?'Procesando…':objectProposal?'Resuelve la propuesta de IA':dirty?'Cambios sin guardar':'Guardado'}</small><button class="primary" disabled={busy||!dirty||!!objectProposal||!selected} onclick={()=>void saveRequest()}><Save size={16}/> Guardar en aventura</button></div>{/snippet}
   {#if selected}
   <div class="inspector-tabs" role="group" aria-label="Panel del recurso"><button aria-pressed={inspectorMode==='properties'} onclick={()=>inspectorMode='properties'}>Propiedades</button>{#if kind==='object'}<button aria-pressed={inspectorMode==='ai'} onclick={()=>{inspectorMode='ai';assistantOpen=true;}}><Sparkles size={14}/> IA</button>{/if}</div>
   <form id="resource-properties" class="inspector" novalidate onsubmit={e=>{e.preventDefault();void saveRequest();}} oninput={()=>dirty=true} onchange={()=>dirty=true} aria-label="Propiedades del recurso"><fieldset disabled={busy||!!objectProposal&&inspectorMode!=='ai'}>
    <div hidden={inspectorMode!=='properties'}>
     <details class="property-section" open={!current}><summary><ChevronRight class="disclosure" size={14}/>Organización <small>{category==='nature'?'Naturaleza':category==='urban'?'Urbano':category==='people'?'Personajes':'Oficina'}</small></summary><label>Nombre<input aria-label="Nombre en propiedades" maxlength="120" required bind:value={name}/></label>{#if kind==='object'||kind==='npc'}<label>Categoría<select bind:value={category}><option value="office">Oficina</option><option value="nature">Naturaleza</option><option value="urban">Urbano</option>{#if kind==='npc'}<option value="people">Personajes</option>{/if}</select></label>{/if}<p class="hint">Nombre del recurso en el catálogo. Los objetos del mapa conservan sus propios nombres.</p></details>
     {#if kind==='object'||kind==='tile'}<details id="family-settings" class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Familia <small>{familyName??'Sin familia'}</small></summary>{#if kind==='object'}<ObjectFamilyEditor families={objectFamilies} {selected} choices={objectChoices} {resolve} {busy} showAdd={false} canAdd={!dirty&&!!current&&!objectProposal} onchange={v=>{objectFamilies=v;dirty=true;}} onselect={chooseId} onadd={addObjectAspect}/>{:else}<TileFamilyEditor families={tileFamilies} {selected} choices={tileChoices} {resolve} {busy} showAdd={false} canAdd={!dirty&&!!current} onchange={v=>{tileFamilies=v;dirty=true;}} onselect={chooseId} onadd={addTileVariant}/>{/if}</details>{/if}
     {#if kind==='object'||kind==='npc'}
      <details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Huella y apoyo <small>{size.x} × {size.y} casillas</small></summary>{#if custom}<div class="two-fields"><label>Casillas X<input aria-label="Huella X" type="number" min="1" max="16" bind:value={size.x}/></label><label>Casillas Y<input aria-label="Huella Y" type="number" min="1" max="16" bind:value={size.y}/></label></div>{:else}<p class="hint">Huella del catálogo base: {size.x} × {size.y}. Se conserva para mantener su colocación en mapas.</p>{/if}<button type="button" disabled={!!objectProposal} onclick={support}><Move size={15}/> Apoyar sobre la huella</button><div class="two-fields"><label>Origen X<input aria-label="Origen X" type="number" step="any" bind:value={item.origin[0]}/></label><label>Origen Y<input aria-label="Origen Y" type="number" step="any" bind:value={item.origin[1]}/></label></div><p class="hint">También puedes arrastrar la imagen. La huella es el tamaño predeterminado de nuevas instancias.</p></details>
      <details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Recorte del PNG <small>{crop[2]} × {crop[3]} px</small></summary><div class="two-fields">{#each ['X','Y','Ancho','Alto'] as title,i}<label>{title}<input aria-label={`Recorte ${title}`} type="number" min={i<2?0:1} value={crop[i]} oninput={e=>setCrop(i,e.currentTarget.valueAsNumber)}/></label>{/each}</div><button type="button" disabled={!item.image||!!objectProposal} onclick={trim}><Scissors size={15}/> Recortar transparencia</button></details>
      {#if kind==='npc'}<details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Animaciones <small>Reposo y conversación</small></summary><p class="hint">La imagen estática es suficiente. Añade hojas para animar el PNJ.</p>{#each npcPoses as p}<details class="clip-editor"><summary><ChevronRight class="disclosure" size={13}/>{actionLabels[p]} <small>{item.animations?.[p]?'Configurada':'Opcional'}</small></summary><button type="button" onclick={()=>chooseUpload(p)}><Upload size={15}/>{item.animations?.[p]?'Cambiar hoja':'Añadir hoja PNG'}</button>{#if item.animations?.[p]}{@const clip=item.animations[p]!}<div class="two-fields"><label>Ancho celda<input aria-label={`PNJ ${p} ancho`} type="number" min="1" bind:value={clip.frameWidth}/></label><label>Alto celda<input aria-label={`PNJ ${p} alto`} type="number" min="1" bind:value={clip.frameHeight}/></label><label>Fotogramas<input aria-label={`PNJ ${p} fotogramas`} type="number" min="1" max="64" bind:value={clip.frames}/></label><label>FPS<input aria-label={`PNJ ${p} fps`} type="number" min="1" max="60" bind:value={clip.fps}/></label><label>Vistas de la hoja<select aria-label={`PNJ ${p} direcciones`} value={clip.directions?'four':'single'} onchange={e=>{if(e.currentTarget.value==='four')clip.directions=['ne','se','sw','nw'];else delete clip.directions;dirty=true;}}><option value="single">Una dirección</option><option value="four">4 direcciones: NE, SE, SW, NW</option></select></label><label>{clip.directions?'Primera fila (NE)':'Fila (desde 0)'}<input type="number" min="0" bind:value={clip.row}/></label></div><button type="button" class="text-danger" onclick={()=>{delete item.animations![p];dirty=true;}}>Quitar animación</button>{/if}</details>{/each}</details>{/if}
     {:else if kind==='player'}
      <details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Formato del personaje <small>{character.frameWidth} × {character.frameHeight} px</small></summary><div class="two-fields"><label>Ancho celda<input aria-label="Ancho de fotograma" type="number" min="1" bind:value={character.frameWidth}/></label><label>Alto celda<input aria-label="Alto de fotograma" type="number" min="1" bind:value={character.frameHeight}/></label></div><label>Escala (%)<input aria-label="Escala del jugador" type="number" min="5" max="800" value={Math.round((character.scale??1)*100)} oninput={e=>character.scale=e.currentTarget.valueAsNumber/100}/></label><div class="two-fields"><label>Apoyo X<input type="number" step="any" bind:value={character.anchor[0]}/></label><label>Apoyo Y<input type="number" step="any" bind:value={character.anchor[1]}/></label></div><p class="hint">Acciones con celda y apoyo comunes. Filas: NE, SE, SW y NW.</p></details>
      <details class="property-section" open><summary><ChevronRight class="disclosure" size={14}/>Acción · {actionLabels[pose]} <small>{character.animations[pose].frames} fotogramas</small></summary>{#if pose==='sit'}<label class="checkbox"><input type="checkbox" bind:checked={reuseSit} onchange={syncSit}/> Usar primer fotograma de trabajar</label>{/if}{#if pose!=='sit'||!reuseSit}<button type="button" onclick={()=>chooseUpload(pose)}><Upload size={15}/>{characterImage(character,pose)?'Sustituir hoja':'Subir hoja PNG'}</button><div class="two-fields"><label>Fotogramas<input aria-label="Fotogramas de la acción" type="number" min="1" max="64" bind:value={character.animations[pose].frames}/></label><label>FPS<input aria-label="FPS de la acción" type="number" min="1" max="60" bind:value={character.animations[pose].fps}/></label><label>Primera fila<input aria-label="Fila de la acción" type="number" min="0" bind:value={character.animations[pose].row}/></label></div>{:else}<p class="hint">La postura sentada utiliza la hoja de trabajar.</p>{/if}</details>
     {:else}
      <details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Recorte de la baldosa <small>{tileFrame[2]} × {tileFrame[3]} px</small></summary><div class="two-fields">{#each ['X','Y','Ancho','Alto'] as title,i}<label>{title}<input aria-label={`Baldosa ${title}`} type="number" min={i<2?0:1} bind:value={tileFrame[i]}/></label>{/each}</div><p class="hint">Se adapta a una baldosa de 64 × 32. Comprueba las uniones en el mosaico.</p></details>
     {/if}
     <details class="property-section"><summary><ChevronRight class="disclosure" size={14}/>Uso en la aventura <small>{usages.length} mapas</small></summary><p class="hint">{kind==='tile'?'Guardar actualiza las casillas que usan este suelo.':usages.length?`Guardar su aspecto actualiza sus usos en: ${usages.join(', ')}.`:'Disponible para colocar desde el catálogo.'}</p></details>
    </div>
    {#if kind==='object'}<div hidden={inspectorMode!=='ai'}>{#key `${adventure.id}:${selected}`}<ObjectAssistant bind:this={objectAssistant} bind:open={assistantOpen} embedded palette={adventure.palette} width={Math.round(item.width)} height={Math.round(item.height)} footprint={size} references={entries.filter(e=>e.kind==='object').map(e=>({id:e.id,name:e.name}))} onreference={generationReference} onpreview={v=>objectProposal=v} onaccept={acceptObjectImage} onbusy={v=>busy=v}/>{/key}</div>{/if}
    <div class="source-view" hidden={inspectorMode!=='source'}><p class="hint">{editSize?`${editSize.width} × ${editSize.height} px`:'Sin imagen'} · PNG transparente</p>{#if editSource}<div class="source-image"><img src={resolve(editSource)} alt={`Imagen fuente de ${name}`}/></div>{/if}<p class="hint">La edición conserva los márgenes y las demás filas de las hojas.</p></div>
   </fieldset></form>
   {/if}
  </WorkshopPanel>
 </div>
 <footer class="workshop-footer" inert={overlayOpen}><div class="save-state" role="status">{#if busy}<LoaderCircle size={16} class="spinner"/> Procesando…{:else if objectProposal}<Sparkles size={16}/> Propuesta pendiente{:else if dirty}<span class="dirty-dot"></span> Cambios sin guardar{:else}<Check size={16}/> Guardado{/if}</div><span class="dimensions">{kind==='player'?`${character.frameWidth} × ${character.frameHeight} px`:kind==='tile'?'64 × 32 px':`${Math.round(item.width)} × ${Math.round(item.height)} px`}</span>{#if kind==='player'&&current}<button disabled={busy||dirty||isActivePlayer} onclick={activate}>{#if isActivePlayer}<Check size={15}/> Jugador activo{:else}<UserRound size={15}/> Usar como jugador{/if}</button>{/if}<details class="menu footer-menu"><summary aria-label="Más acciones del recurso" title="Más acciones del recurso"><MoreHorizontal size={20}/></summary><div class="menu-items">{#if hasDraft}<button disabled={busy} onclick={()=>action(()=>ask(()=>void restoreDraft()))}>Recuperar borrador</button>{/if}<button disabled={busy||!dirty||!!objectProposal} onclick={()=>action(saveDraft)}>Guardar borrador</button><button disabled={busy||dirty||!current||!!objectProposal} onclick={()=>action(publishResource)}>Añadir a mi biblioteca</button><button disabled={busy||!selected||!!objectProposal} onclick={()=>action(duplicate)}><Copy size={15}/> Duplicar recurso</button>{#if current&&dirty}<button disabled={busy} onclick={()=>action(()=>ask(()=>select(current!)))}>Restaurar guardado</button>{/if}{#if custom&&current}<button class="text-danger" disabled={busy||usages.length>0||isActivePlayer} onclick={()=>action(()=>ask(()=>void remove()))}><Trash2 size={15}/> Eliminar del catálogo</button>{/if}</div></details><button class="primary save-button" disabled={busy||!dirty||!!objectProposal||!selected} onclick={()=>void saveRequest()}><Save size={16}/> Guardar en aventura</button></footer>
 {/if}
</div>
{#if colorVariantSession}<ColorVariantEditor resource={colorVariantSession.resource} name={colorVariantSession.name} palette={colorVariantSession.palette} size={colorVariantSession.size} tileFrame={colorVariantSession.tileFrame} reference={pack.activePlayer?pack.players![pack.activePlayer].character:pack.character} floorImage={defaultGraphics.tiles.office} {resolve} load={paletteBlob} onaccept={applyColorVariant} onclose={()=>colorVariantSession=undefined} initialPose={pose} initialDirection={direction}/>{/if}
{#if imageEdit}<ImageEditor session={imageEdit} palette={adventure?.palette} navigation={cycleNavigation} onselect={selectEditCycle} saveHint="Los retoques se guardarán cuando pulses «Guardar en aventura»." onapply={applyImage} onclose={closeImageEditor} onchange={value=>imageEditDirty=value}/>{/if}
<input class="sr-only" bind:this={fileInput} type="file" accept="image/png,.png" aria-label="Archivo PNG del recurso" onchange={upload}/>
<input class="sr-only" bind:this={characterZipInput} type="file" accept=".zip,application/zip" aria-label="ZIP del personaje" onchange={importCharacterZip}/>
<dialog bind:this={confirmDialog} class="confirm"><h2>Tienes cambios sin guardar</h2><p>{objectProposal?'Usa o descarta la propuesta de IA antes de guardar.':'Puedes conservarlos como borrador antes de continuar.'}</p><div><button onclick={()=>confirmDialog.close()}>Seguir editando</button><button onclick={continueAction}>Descartar cambios</button><button class="primary" disabled={busy||!!objectProposal} onclick={async()=>{if(await saveDraft())continueAction();}}>Guardar borrador y continuar</button></div></dialog>

<style>
 .workshop{box-sizing:border-box;height:calc(100svh - var(--platform-bar-height,0px));min-height:500px;display:flex;flex-direction:column;gap:0;padding:0 20px;color:#2b4133;background:#f5f7f2;overflow:hidden}.context-header{display:flex;align-items:center;gap:14px;min-height:58px;flex:none;border-bottom:1px solid #dce4d8}.back{display:flex;align-items:center;gap:5px;font-size:12px;color:#607359}h1{font-size:17px;font-weight:650;letter-spacing:-.35px;margin:0;white-space:nowrap}.adventure-context{display:flex;flex-direction:row;align-items:center;gap:8px;margin:0 0 0 auto;font-size:11px}.adventure-context select{width:160px;padding:7px 10px;background:#fff}.workspace-toolbar{display:flex;align-items:center;gap:14px;min-height:52px;flex:none}.catalog-trigger{font-weight:600}.resource-types{display:flex;align-items:center;gap:2px}.resource-types button{padding:7px 9px;font-size:12px;border-color:transparent;background:transparent}.resource-types button[aria-pressed=true]{background:#e5edda;border-color:#d4e0c8;color:#38552c}.resource-types small{font-size:10px;padding:2px 4px;color:#728069}.palette-tools{margin-left:auto;min-width:0;max-width:32%}.workbench{display:flex;gap:14px;min-height:0;flex:1;padding:0 0 12px}.editor-area{margin:0;padding:0;width:0;flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;gap:10px}.selected-heading{display:flex;align-items:center;gap:10px;min-height:58px;flex:none}.selected-thumb{width:42px;height:42px;flex:none;border:1px solid #dce4d8;background:#eaf0e3;border-radius:9px;padding:3px;box-sizing:border-box}.selected-title{min-width:0;flex:1}.eyebrow{font-size:10px;color:#7b8973;font-weight:600;text-transform:uppercase;letter-spacing:.8px}.selected-title h2{font-size:21px;margin:2px 0 0;font-weight:600;letter-spacing:-.3px}.rename{border:0;background:transparent;padding:0;min-height:28px;width:100%;text-align:left;justify-content:flex-start;font:inherit}.rename span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rename :global(svg){opacity:.5;flex:none}.selected-name{font-size:18px;width:100%;padding:3px 6px;margin-top:3px}.resource-navigation{display:flex;align-items:center;gap:4px;flex:none}.resource-navigation small{white-space:nowrap;font-size:10px;color:#7b8973}.resource-navigation button,.properties-trigger{padding:7px}.properties-trigger span{font-size:11px}.canvas-area{flex:1;min-height:160px;position:relative;isolation:isolate}.canvas-area :global(.stage){height:100%;box-sizing:border-box}.image-tools{position:absolute;top:12px;left:12px;z-index:3;display:flex;align-items:center;gap:2px;padding:4px;border:1px solid #cad8c8;background:#fffffff0;border-radius:10px;box-shadow:0 3px 12px #263b2e15}.image-tools>button,.image-tools>details>summary{width:32px;height:32px;min-height:32px;padding:0;border:0;display:grid;place-items:center;background:transparent;border-radius:6px}.preview-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:34px}.preview-tools>div{display:flex;align-items:center;gap:5px;min-width:0}.preview-tools button{padding:6px}.preview-tools select{width:auto;padding:7px;font-size:12px}.zoom-tools{margin-left:auto}.zoom-tools span,.zoom-tools output{font-size:11px;color:#76866e;min-width:24px;text-align:center}.family-strip{display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 10px;border:1px solid #dde5d7;border-radius:10px;background:#fbfcf8;flex:none;min-width:0}.family-label{font-size:11px;color:#65765d;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}.family-members{display:flex;align-items:center;gap:6px;overflow:auto;min-width:0;flex:1}.family-members button{padding:4px 8px;min-width:0;flex-shrink:0;font-size:11px}.family-members button[aria-pressed=true]{background:#e9f0e0;border-color:#b8cda4}.family-members button>span:not(.aspect-thumb){max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aspect-thumb{width:32px;height:30px;flex:none;background:#edf2e4;border-radius:4px}.family-members .add-aspect{min-width:34px;min-height:38px;border-style:dashed}.family-strip>button{padding:6px;flex:none}.proposal-banner{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 10px;background:#edf3e5;border:1px solid #cbdabf;border-radius:8px;flex:none}.proposal-banner>span{font-size:12px;flex:1}.proposal-banner button{font-size:11px;padding:7px}.workshop-footer{display:flex;align-items:center;gap:12px;min-height:58px;border-top:1px solid #dce4d8;flex:none}.save-state{display:flex;align-items:center;gap:6px;font-size:12px;min-width:0}.dimensions{font-size:11px;color:#7b8973}.footer-menu{margin-left:auto}.save-button{white-space:nowrap;font-weight:600;padding:10px 14px}.dirty-dot{width:7px;height:7px;border-radius:50%;background:#b0843a}.panel-save{display:grid;gap:8px}.panel-save small{font-size:11px;color:#77866d}.panel-save button{justify-content:center;width:100%}.scope-switch,.catalog-types,.inspector-tabs{display:flex;gap:3px;padding:3px;background:#edf1e7;border-radius:8px;margin-bottom:14px;flex-wrap:wrap}.scope-switch button,.catalog-types button,.inspector-tabs button{flex:1;justify-content:center;font-size:11px;border:0;background:transparent;padding:8px 5px;white-space:nowrap}.scope-switch button[aria-pressed=true],.catalog-types button[aria-pressed=true],.inspector-tabs button[aria-pressed=true]{background:#fff;box-shadow:0 1px 4px #263b2e12;color:#3b582e}.add{width:100%;justify-content:center;margin:12px 0;background:#f0f5e9;border-style:dashed}.inspector fieldset{border:0;padding:0;margin:0;min-width:0}.property-section{border-bottom:1px solid #e0e7d9;padding:0 0 10px;margin:0 0 12px;min-width:0}.property-section>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;min-height:32px}.property-section>summary :global(.disclosure){flex:none;transition:transform .15s}.property-section[open]>summary :global(.disclosure),.clip-editor[open]>summary :global(.disclosure){transform:rotate(90deg)}.property-section small{margin-left:auto}.property-section small,.clip-editor small{font-size:10px;color:#819174;font-weight:400;max-width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.property-section[open]>summary{margin-bottom:10px}.inspector label{font-size:12px}.two-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 10px}.checkbox{flex-direction:row;align-items:center}.checkbox input{width:14px}.clip-editor{padding:10px;border:1px solid #dce5d4;border-radius:8px;margin:10px 0}.clip-editor summary{display:flex;justify-content:space-between;gap:8px}.clip-editor[open]>summary{margin-bottom:12px}.property-section button{margin:8px 0}.property-section :global(.object-family),.property-section :global(.family-editor){border:0;margin:0;padding:0}.source-image{overflow:auto;max-height:60vh;background:repeating-conic-gradient(#e6e9e1 0% 25%,#f6f8f0 0% 50%) 0/16px 16px;border:1px solid #dce4d8;border-radius:8px}.source-image img{display:block;max-width:100%;image-rendering:pixelated}.source-view[hidden]{display:none}.empty-stage{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;border:1px dashed #cbd9bc;border-radius:12px;background:#eef3e6}.empty-stage h2{font-size:20px;margin:0}.empty-stage p{font-size:13px;margin:0;color:#7b8973}.menu{position:relative;flex:none}.menu>summary{display:flex;align-items:center;justify-content:center;list-style:none;cursor:pointer;width:36px;height:36px;border:1px solid transparent;border-radius:7px}.menu>summary::-webkit-details-marker{display:none}.menu[open]>summary{background:#e9f0e2;border-color:#cadabd}.menu-items{position:absolute;top:calc(100% + 6px);right:0;z-index:30;min-width:220px;max-width:calc(100vw - 36px);padding:5px;border:1px solid #d6e1ce;border-radius:9px;background:#fff;box-shadow:0 8px 26px #263b2e20;display:grid;gap:2px}.menu-items button,.menu-items a{border:0;border-radius:5px;background:transparent;padding:10px;text-align:left;font-size:12px;white-space:normal;justify-content:flex-start;text-decoration:none}.menu-items button:hover:not(:disabled),.menu-items a:hover{background:#edf3e7}.footer-menu .menu-items{top:auto;bottom:calc(100% + 6px)}.image-tools .menu-items{right:auto;left:0}.context-menu{z-index:10}.context-menu .menu-items{right:0}.hint{font-size:11px;line-height:1.55;color:#7b8973;margin:10px 0}.alert{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;line-height:1.5;padding:8px 12px;border-radius:8px;margin:0 0 8px}.alert span{flex:1;min-width:0}.alert button{padding:3px;border:0;background:transparent;flex:none}.error{color:#963f31;background:#fbeae3}.notice{color:#557a34;background:#eaf3e1}.retry{align-self:center;margin:20px}.text-danger{color:#a15a48}.confirm{border:1px solid #d3dec6;border-radius:14px;padding:24px;max-width:460px;color:#344a2e}.confirm::backdrop{background:#26332266;backdrop-filter:blur(3px)}.confirm h2{font-size:20px}.confirm p{font-size:13px;line-height:1.55;color:#748368}.confirm>div{display:flex;gap:8px;flex-wrap:wrap}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px}input,select{font:inherit;color:#3e5334;border:1px solid #d8e0ce;border-radius:7px;padding:9px;background:#fff;width:100%;box-sizing:border-box;min-width:0}button,a{color:inherit}a{text-decoration:none}button{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12px;padding:8px 10px;border:1px solid #d8e0ce;background:#fffef9;border-radius:7px;cursor:pointer;line-height:1.3;min-height:34px}button:hover:not(:disabled){background:#f0f5e8;border-color:#a6bd93}button:disabled{opacity:.45;cursor:default}.primary{background:#476238;border-color:#476238;color:white}.primary:hover:not(:disabled){background:#365128;color:white}.workshop :global(.spinner){animation:spin 1s linear infinite}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #74994e;outline-offset:2px}@keyframes spin{to{transform:rotate(360deg)}}
 @media(max-width:900px){.workshop{padding:0 14px}.context-header{gap:10px}.resource-types button{padding:7px}.resource-types small{display:none}.properties-trigger span{display:none}.palette-tools{max-width:25%}.dimensions{display:none}.family-label{max-width:75px}.back span{display:none}}@media(max-width:600px){.context-header{flex-wrap:wrap;min-height:72px;padding:8px 0;gap:8px}.context-header h1{font-size:15px}.adventure-context{margin-left:auto}.adventure-context span{display:none}.adventure-context select{width:130px}.workspace-toolbar{gap:5px;min-height:48px}.catalog-trigger span{display:none}.resource-types button span{display:none}.palette-tools{max-width:48%;margin-left:auto}.selected-heading{gap:6px}.selected-thumb{display:none}.selected-title h2{font-size:18px}.resource-navigation small{display:none}.workshop-footer{gap:6px}.save-state{font-size:11px}.save-button{font-size:11px;padding:9px}.family-label{display:none}.preview-tools select{max-width:100px}.workbench{padding-bottom:8px}.canvas-area{min-height:140px}.image-tools{top:8px;left:8px}.family-strip{padding:5px}.workshop-footer>button:not(.save-button){font-size:10px}}@media(prefers-reduced-motion:reduce){.workshop :global(.spinner){animation:none}}
</style>
