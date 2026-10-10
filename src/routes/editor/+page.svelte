<script lang="ts">
 import StoryBoard from '$lib/story/StoryBoard.svelte';
 import NarrativeEventEditor from '$lib/story/NarrativeEventEditor.svelte';
 import {createNarrativeEvent,replaceNarrativeEvent,narrativeEvent,attachNarrativeChat} from '$lib/story/narrative';
 import {objectNode,eventNode,mapNode,type BoardSelection} from '$lib/story/board';
 import type {NarrativeEvent} from '$lib/story/types';
 import {EditorPanel} from '@isometrico/editor-ui';
 import {environments} from '@isometrico/world';
 import {sceneWalls,wallKey,wallCells,hasTile} from '../../../packages/world/src/walls';
 import {walkable} from '../../../packages/world/src/navigation';
 import type {Wall,MapBrush,WallMaterial} from '@isometrico/world';
 import {loadAdventureLibrary,storeAdventure,selectAdventure} from '$lib/storage/local-adventures';
 let availableAdventures=$state<Adventure[]>([]);
 import { draggablePanel } from '$lib/actions/draggable-panel';
 const panelPositions = new Map();
 function inspectorDrag(node:HTMLElement){if(mapProperties)return draggablePanel(node,{key:'map-properties',positions:panelPositions});}
 import MapDissolve from '$lib/components/MapDissolve.svelte';
 let transitionImage=$state<string|null>(null),transitionReady=$state(false);
 let arrivalCamera:ReturnType<WorldController['getCamera']>|undefined;
 let panMode=$state(false);
 import { graphics as defaultGraphics } from '$lib/demo/pixelart';
 import LoadProgress from '$lib/components/LoadProgress.svelte';
 import type {LoadProgress as Progress} from '$lib/storage/preload';
 import {resolveGraphics,localAdventures} from '$lib/storage/local-adventures';
 import {selectMainPlayer} from '$lib/storage/player-selection';
 import ChatEditor from '$lib/chat/ChatEditor.svelte';
 import BehaviorEditor from '$lib/story/BehaviorEditor.svelte';
 import {replaceBehavior,behavior,entityModules as storyModules} from '$lib/story/engine';
 import {prepareOpenClosed} from '$lib/story/open-closed';
 import {validateStory,storyUsesItem} from '$lib/story/validation';
 import type {EntityBehavior} from '$lib/story/types';
 import EntityModules from '$lib/modules/EntityModules.svelte';
 import type {ContentModuleCard,ContentModuleType} from '$lib/modules/types';
 import {fly} from 'svelte/transition';
 let editorView=$state<'map'|'story'>('map'),narrativeSelection=$state<string|null>(null);
 let inspectorTab=$state<'properties'|'modules'|'conditions'>('properties');
 function leaveChat(){if(chatDirty&&!confirm('¿Descartar los cambios de esta conversación?'))return false;chatEditing=null;chatDirty=false;return true;}
 async function closeChatLayer(){const eventModule=chatEditing?.moduleId;chatEditing=null;chatDirty=false;await tick();if(!disposed)(document.querySelector<HTMLButtonElement>(`[data-event-chat="${eventModule}"]`)??document.querySelector<HTMLButtonElement>('.module-list [data-edit-chat]')??document.querySelector<HTMLButtonElement>('.module-add button'))?.focus({preventScroll:true});}
 function closeInspector(){if(!leaveChat())return;selected=null;mapProperties=false;narrativeSelection=null;}
 import {chatResource,loadChat,createChat,type AdventureChat} from '$lib/chat/editor';
 import {attachChat} from '$lib/chat/adventure-chats';
 import type {ChatConfig} from '$lib/chat/routingtales';
 let chatEditing=$state<{chat:AdventureChat;title:string;mapId:string;entityId:string;uses:number;eventId?:string;moduleId?:string}|null>(null),chatLoading=$state(false),chatDirty=$state(false);
 async function openChatEditor(fresh=false){
  if(!entity||chatLoading)return;
  const target=entity,mapId=draft.id,adventureId=adventure.id;chatLoading=true;error='';
  try{
   const resource=target.interaction?.action==='chat.open'?target.interaction.resourceId:'';
   const saved=!fresh?(adventure.chats??[]).find(c=>chatResource(c.id)===resource):undefined;
   const chat=saved??{id:crypto.randomUUID(),name:target.label,config:!fresh&&resource?await loadChat(resource,preloadAbort.signal):createChat()};
   if(disposed||adventure.id!==adventureId||draft.id!==mapId||selected!==target.id)return;
   const uses=saved?bundle().maps.reduce((count,m)=>count+m.entities.filter(e=>e.interaction?.action==='chat.open'&&e.interaction.resourceId===resource).length,0):1;
   inspectorCollapsed=false;chatEditing={chat,title:target.label,mapId,entityId:target.id,uses};
  }catch(e){if(!disposed)error=(e as Error).message;}finally{chatLoading=false;}
 }
 function applyChat(name:string,config:ChatConfig){
  if(!chatEditing)return;
  const chat={...chatEditing.chat,name,config};const next=chatEditing.eventId?parseAdventure(attachNarrativeChat(bundle(),chatEditing.eventId,chatEditing.moduleId!,chat)):attachChat(bundle(),chatEditing.mapId,chatEditing.entityId,chat);
  snapshot();adventure=next;draft=structuredClone(next.maps.find(m=>m.id===draft.id)!);void closeChatLayer();error='';notice='Conversación aplicada al borrador. Guarda la aventura para conservarla.';
 }
 function addContentModule(type:ContentModuleType){if(type==='chat')void openChatEditor(true);}
 function editContentModule(type:ContentModuleType){if(type==='chat')void openChatEditor();}
 function removeContentModule(type:ContentModuleType){if(type==='chat'&&entity?.interaction?.action==='chat.open'){try{const next={...bundle(),maps:bundle().maps.map(m=>m.id!==draft.id?m:{...m,entities:m.entities.map(e=>e.id!==entity!.id?e:{...e,interaction:undefined})})};validateStory(next);update({interaction:undefined});notice='Módulo eliminado del elemento. Puedes deshacer o guardar la aventura.';}catch(e){error=(e as Error).message;}}}
 function editBehavior(b:EntityBehavior){try{const next=replaceBehavior(bundle(),b);validateStory(next);snapshot();adventure=next;error='';notice='Condiciones actualizadas. Guarda la aventura para conservarlas.';}catch(e){error=(e as Error).message;}}
 function addOpenClosed(){if(!entity)return;try{const next=prepareOpenClosed(bundle(),{mapId:draft.id,entityId:entity.id});validateStory(next);const map=structuredClone($state.snapshot(next.maps.find(m=>m.id===draft.id)!));snapshot();adventure=next;draft=map;error='';notice='Abierto/cerrado preparado. Elige los gráficos de ambos estados y guarda la aventura.';}catch(e){error=(e as Error).message;}}
 import {onDestroy} from 'svelte';
 let graphics=$state.raw(defaultGraphics);
 let playerChanging=$state(false),graphicsReady=$state(false);
 const resourceReleases:Array<()=>void>=[];
 let disposed=false;
 const preloadAbort=new AbortController();let loadProgress=$state<Progress|null>(null),loadFailed=$state(false);
 async function loadGraphics(id:string){
  const wasReady=graphicsReady;arrivalCamera=controller?.getCamera()??arrivalCamera;controller=undefined;graphicsReady=false;loadFailed=false;loadProgress=null;
  try{const resolved=await resolveGraphics(id,{signal:preloadAbort.signal,onProgress:p=>loadProgress=p});if(disposed){resolved.release();return;}resourceReleases.push(resolved.release);graphics=resolved.pack;graphicsReady=true;}
  catch(cause){graphicsReady=wasReady;throw cause;}
 }

 async function chooseMainPlayer(id:string){
  if(playerChanging||!graphicsReady||id===(graphics.activePlayer??'default'))return;
  playerChanging=true;error='';const adventureId=adventure.id;
  try{const expected=(adventure as Adventure&{_revision?:number})._revision;const name=await selectMainPlayer(adventureId,id,localAdventures,expected);if(expected!==undefined)(adventure as Adventure&{_revision?:number})._revision=expected+1;if(disposed||adventure.id!==adventureId)return;await loadGraphics(adventureId);revision++;notice=`${name} es el personaje principal de esta aventura. Selección guardada.`;}
  catch(e){error=(e as Error).message;}finally{playerChanging=false;}
 }
 async function refreshPlayers(){
  if(playerChanging)return;playerChanging=true;error='';
  try{await loadGraphics(adventure.id);revision++;notice='Jugadores actualizados desde el taller.';}catch(e){error=(e as Error).message;}finally{playerChanging=false;}
 }
 onDestroy(()=>{disposed=true;preloadAbort.abort();resourceReleases.forEach(release=>release());});
 import { untrack, onMount, tick } from 'svelte';
 import { goto, preloadCode } from '$app/navigation';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import AdventureResourceCatalog from '$lib/workshop/AdventureResourceCatalog.svelte';
 import type {CatalogCategory} from '$lib/workshop/catalog';
 import {workshopEntries,workshopTiles,type ResourceKind} from '$lib/workshop/resources';
 import { World, parseScene as validateScene, resolveVisualCatalog, compatibleVisualKind, type WorldScene, type WorldEntity, type WorldAdapter, type WorldEditor, type WorldController, type Facing, type TileKind, type Cell } from '@isometrico/world';
 import { insertEntity, moveEntity, flipEntity, paintTiles } from '$lib/demo/editor';
 import { office, outdoors } from '$lib/demo/scenes';
 import { UserRound, Backpack, ArrowLeft, Download, Upload, Plus, Trash2, Undo2, Redo2, Play, Check, Minus, Scan, Hand, MousePointer2, Layers, Paintbrush, Link, List, LoaderCircle, MoreHorizontal, Settings2, X, Pencil, Search, Workflow, Map as MapIcon, Clapperboard, ChevronUp, ChevronDown } from 'lucide-svelte';
 import {createAdventure,parseAdventure as validateAdventure,connectMaps,travel,type Adventure,type MapExit} from '$lib/demo/adventure';
 const parseScene=(value:unknown)=>validateScene(value,{allowUnreachable:true});
 const parseAdventure=(value:unknown)=>validateAdventure(value,{allowUnreachable:true});
 type ToolPanel='player'|'inventory'|'adventures'|'maps'|'objects'|'catalog'|'paint';
 let inventorySelection=$state('');
 function addInventoryArticle(){snapshot();const id=crypto.randomUUID();adventure={...adventure,items:[...(adventure.items??[]),{id,name:'Nuevo artículo',description:'',stackable:false}]};inventorySelection=id;}
 function editInventoryArticle(values:Partial<NonNullable<Adventure['items']>[number]>){snapshot();adventure={...adventure,items:adventure.items?.map(i=>i.id===inventorySelection?{...i,...values}:i)};}
 function switchEditorView(view:'map'|'story'){if(view===editorView||!leaveChat())return;arrivalCamera=controller?.getCamera()??arrivalCamera;controller=undefined;editorView=view;toolPanel=null;selected=null;mapProperties=false;narrativeSelection=null;testing=false;panMode=false;brush=null;pendingAsset=null;pendingExit=false;syncUrl();}
 function openBoardSelection(selection:BoardSelection,relationship=false){
  if(!leaveChat())return;const value=bundle();if(selection.kind==='event'){selected=null;mapProperties=false;toolPanel=null;narrativeSelection=selection.eventId;inspectorCollapsed=false;return;}
  narrativeSelection=null;if(selection.kind==='item'){inventorySelection=selection.itemId;showTool('inventory');return;}
  const mapId=selection.kind==='map'?selection.mapId:selection.ref.mapId;if(mapId!==draft.id){adopt(value,mapId);syncUrl();}
  selectObject(selection.kind==='map'?'':selection.ref.entityId);if(selection.kind==='object')inspectorTab=relationship?'conditions':storyModules(value,selection.ref).length?'modules':behavior(value,selection.ref)?'conditions':'properties';
 }
 function newNarrative(){if(!leaveChat())return;try{const event=createNarrativeEvent(draft.id),next=parseAdventure(replaceNarrativeEvent(bundle(),event));snapshot();adventure=next;editorView='story';openBoardSelection({kind:'event',eventId:event.id});notice='Evento creado como borrador. Añade contenido y actívalo cuando esté listo.';}catch(e){error=(e as Error).message;}}
 function editNarrative(event:NarrativeEvent){try{const next=parseAdventure(replaceNarrativeEvent(bundle(),event));snapshot();adventure=next;error='';notice='Evento actualizado. Guarda la aventura para conservarlo.';}catch(e){error=(e as Error).message;}}
 function removeNarrative(){if(!narrativeSelection)return;try{const value=bundle(),next=parseAdventure({...value,story:{...value.story!,events:value.story?.events?.filter(e=>e.id!==narrativeSelection)}});snapshot();adventure=next;narrativeSelection=null;notice='Evento eliminado. Puedes deshacer el cambio.';}catch(e){error=(e as Error).message;}}
 function boardLayout(positions:Record<string,{x:number;y:number}>){if(!leaveChat())return;const value=bundle(),next=parseAdventure({...value,story:{version:1,...value.story,entities:value.story?.entities??[],layout:{...value.story?.layout,...positions}}});snapshot();adventure=next;notice='Distribución del guion actualizada. Guarda para conservarla.';}
 async function openNarrativeChat(moduleId:string){if(!narrativeSelection||chatLoading||!leaveChat())return;const event=narrativeEvent(bundle(),narrativeSelection),module=event?.modules.find(m=>m.id===moduleId);if(!event||module?.type!=='chat')return;const saved=adventure.chats?.find(c=>chatResource(c.id)===module.resourceId),chat=saved??{id:crypto.randomUUID(),name:event.name,config:createChat()};chatEditing={chat,title:event.name,mapId:event.mapId??draft.id,entityId:'',eventId:event.id,moduleId,uses:saved?adventure.maps.reduce((sum,m)=>sum+m.entities.filter(e=>e.interaction?.action==='chat.open'&&e.interaction.resourceId===module.resourceId).length,0)+(adventure.story?.events??[]).reduce((sum,e)=>sum+e.modules.filter(m=>m.type==='chat'&&m.resourceId===module.resourceId).length,0):1};inspectorCollapsed=false;}
 function inventoryInUse(id:string){return bundle().maps.some(m=>m.entities.some(e=>e.pickup?.itemId===id))||adventure.exits.some(e=>e.requirement?.itemId===id)||storyUsesItem(bundle(),id);}
 function removeInventoryArticle(){if(inventoryInUse(inventorySelection))return;snapshot();adventure={...adventure,items:adventure.items?.filter(i=>i.id!==inventorySelection)};inventorySelection='';}
 let toolsPinned=$state(false),editorWide=$state(false),savedContent=$state('');
 onMount(()=>{const mq=matchMedia('(min-width:1200px)');editorWide=mq.matches;const update=()=>editorWide=mq.matches;mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);});
 function attachTools(node:HTMLElement){return draggablePanel(node,{key:'tools',positions:panelPositions});}
 function contentState(){const content=JSON.parse(JSON.stringify(bundle()));for(const key of Object.keys(content))if(key.startsWith('_'))delete content[key];return JSON.stringify(content);}
 const hasChanges=$derived(!!savedContent&&contentState()!==savedContent);
 let toolPanel=$state<ToolPanel|null>(null),mapProperties=$state(false),fileMenu=$state(false);
 let toolCollapsed=$state(false),inspectorCollapsed=$state(false);
 let catalogKind=$state<ResourceKind>('object'),catalogCategory=$state<CatalogCategory>('all'),catalogSearch=$state('');
 let search=$state(''),pendingAsset=$state<string|null>(null),pendingExit=$state(false);
 function selectObject(id:string){if((id!==selected||narrativeSelection)&&!leaveChat())return;narrativeSelection=null;if(id!==selected)inspectorTab='properties';wallTool=null;selectedWall=null;selected=id||null;mapProperties=!id;inspectorCollapsed=false;if(!(toolsPinned&&editorWide&&(toolPanel==='objects'||toolPanel==='catalog')))toolPanel=null;brush=null;pendingAsset=null;pendingExit=false;panMode=false;testing=false;}
 function showTool(value:ToolPanel|null){if(!leaveChat())return false;narrativeSelection=null;wallTool=null;selectedWall=null;
  if(pickingExitId)cancelPicking();
  toolCollapsed=false;toolPanel=toolPanel===value?null:value;selected=null;mapProperties=false;brush=null;pendingAsset=null;pendingExit=false;panMode=false;testing=false;fileMenu=false;return true;
 }
 function clearTools(){if(!leaveChat())return;narrativeSelection=null;wallTool=null;selectedWall=null;testing=false;if(pickingExitId)cancelPicking();toolPanel=null;selected=null;mapProperties=false;brush=null;pendingAsset=null;pendingExit=false;panMode=false;fileMenu=false;}
 function beginPlacement(id:string){pendingAsset=id;pendingExit=false;if(!(toolsPinned&&editorWide))toolPanel=null;selected=null;mapProperties=false;panMode=false;notice='Pulsa una casilla para colocar el objeto. Escape cancela.';}
 function placeAt(cell:Cell){if(pendingAsset)add(pendingAsset,cell);else if(pendingExit)addExit(cell);}
 function toolKeys(event:KeyboardEvent){if(chatEditing||saving||openingGame)return;if((event.ctrlKey||event.metaKey)&&!event.altKey&&!(event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable=true]'))){const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();if(key==='y'||event.shiftKey)redo();else undo();return;}}if(event.key==='Escape'){clearTools();return;}if(editorView==='map')arrowMove(event);}
 let adventure=$state<Adventure>(createAdventure([structuredClone(office),structuredClone(outdoors)]));
 const catalogEntries=$derived(workshopEntries(graphics,adventure.catalog,adventure.catalogOverrides));
 const visualCatalog=$derived(resolveVisualCatalog(adventure.catalog,adventure.catalogOverrides));
 const inventoryArticle=$derived(adventure.items?.find(i=>i.id===inventorySelection));
 let arrival=$state<Cell|null>(null);
 let arrivalFacing=$state<Facing>('se');
 let destination=$state('');
 let pickingExitId=$state<string|null>(null);
 const selectedExit=$derived(adventure.exits.find(e=>e.fromMap===draft.id&&e.entityId===selected));
 function bundle():Adventure{return {...adventure,maps:adventure.maps.map(m=>m.id===draft.id?draft:m)};}
 function adopt(a:Adventure,mapId=draft.id){narrativeSelection=null;wallTool=null;selectedWall=null;pickingExitId=null;adventure=a;draft=structuredClone(a.maps.find(m=>m.id===mapId)??a.maps[0]);selected=null;mapProperties=false;pendingAsset=null;pendingExit=false;arrival=null;arrivalFacing='se';arrivalCamera=undefined;controller=undefined;zoomLevel=1;brush=null;}

 let draft=$state<WorldScene>(structuredClone(office));
 let preview=$state<WorldScene>(structuredClone(office));
 let selected=$state<string|null>(null);
 let brush=$state<MapBrush|null>(null);
 const wallMaterials=[{id:'white',label:'Blanca'},{id:'glass',label:'Cristal'},{id:'stone',label:'Piedra'},{id:'cobble',label:'Empedrada'}] as const;
 let wallMaterial=$state<WallMaterial>('white');
 let mapMode=$state<'tiles'|'wall'|'door'|'levels'>('tiles');
 let wallTool=$state<'wall'|'door'|'remove'|null>(null),wallOpacity=$state(.7),selectedWall=$state<Wall|null>(null);
 const tileChoices=$derived([{id:'void' as const,label:'Vacío'},...workshopTiles(graphics)]);
 let revision=$state(0),history=$state<string[]>([]),future=$state<string[]>([]);
 let error=$state(''),notice=$state('Selecciona un objeto del mapa para editarlo. Arrastra para moverlo.');
 let testing=$state(false);
 let fileInput:HTMLInputElement;
 let adventureFileInput=$state<HTMLInputElement>();
 let canvasHost=$state<HTMLDivElement>();
 let restoreCanvasFocus=false;
 let controller=$state<WorldController>();
 let controllerRevision=$state(-1);
 let zoomLevel=$state(1);
 const cameraReady=$derived(!!controller&&controllerRevision===revision);
 function zoom(delta:number){if(!cameraReady)return;zoomLevel=controller?.getCamera().zoom??zoomLevel;const next=Math.round(Math.max(.65,Math.min(3,zoomLevel+delta))*100)/100;controller?.zoom(next-zoomLevel);zoomLevel=next;}
 function fitMap(){if(!cameraReady)return;controller?.recenter();zoomLevel=1;}
 const editing=$derived<WorldEditor|undefined>(testing?undefined:{selectedId:selected??'',onpick:pickingExitId?pickArrival:pendingAsset||pendingExit?placeAt:undefined,wallTool:wallTool??undefined,onwall:editWall,wallOpacity,brush:selected===null?brush??undefined:undefined,onpaint:paint,onselect:selectObject,onmove:move});
 async function initialize(){
  error='';loadFailed=false;loadProgress=null;
  try{const library=await loadAdventureLibrary(),query=new URLSearchParams(location.search);availableAdventures=library.adventures;const saved=library.adventures.find(a=>a.id===(query.get('adventure')??library.activeId))??library.adventures.find(a=>a.id===library.activeId)!;
   await loadGraphics(saved.id);adopt(saved,query.get('map')??query.get('world')??saved.startMap);savedContent=contentState();editorView=query.get('view')==='story'?'story':'map';
  }catch(e){if(!disposed){loadFailed=true;error=`No se pudo cargar la aventura: ${(e as Error).message}`;}}
 }
 onMount(()=>{void initialize();});
 function syncUrl(){const url=new URL(location.href);url.search='';url.searchParams.set('adventure',adventure.id);url.searchParams.set('map',draft.id);if(editorView==='story')url.searchParams.set('view','story');window.history.replaceState(null,'',url);}
 let saving=$state(false),openingGame=$state(false);
 async function persist(){
  if(chatEditing||saving||playerChanging||!graphicsReady)return false;
  saving=true;fileMenu=false;error='';notice='Guardando la aventura…';
  const value=bundle();
  try{await tick();const library=await storeAdventure(value);if(disposed)return false;availableAdventures=library.adventures;adventure=library.adventures.find(a=>a.id===library.activeId)!;syncUrl();savedContent=contentState();notice='Aventura guardada en tu espacio.';return true;}
  catch(e){if(!disposed)error=(e as Error).message;return false;}
  finally{saving=false;}
 }
 async function playSaved(){
  if(openingGame||saving||playerChanging||!graphicsReady||chatEditing)return;
  openingGame=true;
  // Download the game screen while the server saves, without delaying the save on failure.
  void preloadCode('/preview').catch(()=>{});
  try{if(await persist()){notice='Abriendo la aventura…';await goto(`/preview?adventure=${encodeURIComponent(adventure.id)}`);}}
  catch(e){if(!disposed)error=`No se pudo abrir la aventura: ${(e as Error).message}`;}
  finally{openingGame=false;}
 }
 async function switchAdventure(id:string){
  if(id===adventure.id||!(await persist()))return;
  try{const next=await selectAdventure(id);await loadGraphics(next.id);adopt(next,next.startMap);syncUrl();savedContent=contentState();history=[];future=[];toolPanel='adventures';notice='Aventura seleccionada.';}catch(e){error=(e as Error).message;}
 }
 async function newAdventure(){
  if(!(await persist()))return;
  const map:WorldScene={schemaVersion:1,id:crypto.randomUUID(),name:'Mapa inicial',theme:'outdoors',width:12,height:12,spawn:{x:1,y:1},entities:[]};
  const next={...createAdventure([map]),id:crypto.randomUUID(),name:`Aventura ${availableAdventures.length+1}`};
  try{const library=await storeAdventure(next);await loadGraphics(next.id);availableAdventures=library.adventures;adopt(next,map.id);syncUrl();savedContent=contentState();history=[];future=[];toolPanel='adventures';}catch(e){error=(e as Error).message;}
 }
 function chooseWallMaterial(material:WallMaterial){
  wallMaterial=material;
  if(selectedWall?.kind!=='wall')return;
  const updated={...selectedWall,material};
  const next=parseScene({...draft,walls:sceneWalls(draft).map(w=>wallKey(w)===wallKey(updated)?updated:w)});
  snapshot();draft=next;selectedWall=updated;notice='Acabado actualizado. Puedes deshacer.';
 }
 function editWall(w:Wall){
  const walls=sceneWalls(draft),existing=walls.find(e=>wallKey(e)===wallKey(w));
  if(!wallTool){wallMaterial=existing?.material??'white';selectedWall=existing??null;mapMode=existing?.kind??'wall';selected=null;mapProperties=false;toolPanel='paint';toolCollapsed=false;brush=null;return;}
  try{
   if(existing?.exitId)throw new Error('Desvincula la puerta antes de modificarla.');
   if(wallTool==='door'&&!existing)throw new Error('Coloca primero una pared en ese borde.');
   const next=parseScene({...draft,walls:[...walls.filter(e=>wallKey(e)!==wallKey(w)),...(wallTool==='remove'?[]:[{...w,kind:wallTool,material:wallTool==='wall'?wallMaterial:existing?.material}])]});
   parseAdventure({...bundle(),maps:bundle().maps.map(m=>m.id===draft.id?next:m)});
   snapshot();draft=next;selectedWall=wallTool==='remove'?null:next.walls!.find(e=>wallKey(e)===wallKey(w))!;error='';notice='Borde actualizado. Puedes deshacer.';
  }catch(e){error=(e as Error).message;}
 }
 function linkDoor(){
  if(!selectedWall||selectedWall.kind!=='door')return;
  try{
   const cell=wallCells(selectedWall).find(p=>walkable(draft,p)&&!(p.x===draft.spawn.x&&p.y===draft.spawn.y));
   if(!cell)throw new Error('La puerta necesita una casilla libre junto a ella, distinta de la entrada.');
   const id=crypto.randomUUID();let a=connectMaps(bundle(),draft.id,destination,id,undefined,cell);
   a={...a,maps:a.maps.map(m=>m.id!==draft.id?m:{...m,entities:m.entities.map(e=>e.id===id?{...e,solid:false,interactionPoints:[cell]}:e),walls:sceneWalls(m).map(w=>wallKey(w)===wallKey(selectedWall!)?{...w,exitId:id}:w)})};
   a=parseAdventure(a);snapshot();adopt(a);selectObject(id);notice='Puerta conectada. Configura su llegada en el inspector.';
  }catch(e){error=(e as Error).message;}
 }
 function unlinkDoor(){
  const id=selectedWall?.exitId;if(!id)return;
  const a=bundle(),mapId=draft.id;
  const next=parseAdventure({...a,maps:a.maps.map(m=>m.id!==mapId?m:{...m,entities:m.entities.filter(e=>e.id!==id),walls:m.walls?.map(w=>w.exitId===id?{...w,exitId:undefined}:w)}),exits:a.exits.filter(e=>e.fromMap!==mapId||e.entityId!==id).map(e=>e.toMap===mapId&&e.destinationEntityId===id?{...e,destinationEntityId:undefined}:e)});
  snapshot();adopt(next);notice='Puerta desvinculada. El paso permanece abierto.';
 }
 function paint(cells:Cell[],tile:MapBrush){
  try{const next=paintTiles(draft,cells,tile,{allowUnreachable:true});parseAdventure({...bundle(),maps:bundle().maps.map(m=>m.id===draft.id?next:m)});if(JSON.stringify(next)===JSON.stringify(draft))return;snapshot();draft=next;notice=`Mapa actualizado en ${cells.length} casillas. Puedes deshacer el trazo.`;error='';}
  catch(e){error=(e as Error).message;}
 }
 function move(id:string,position:{x:number;y:number}){
  try{const next=moveEntity(draft,id,position);snapshot();restoreCanvasFocus=document.activeElement===canvasHost?.querySelector('[role=application]');draft=next;selected=id;error='';notice='Objeto movido. Puedes deshacer el cambio.';return true;}
  catch(e){error=(e as Error).message;return false;}
 }
 function ready(next:WorldController){if(editorView!=='map')return;const camera=controller?.getCamera()??arrivalCamera;next.setFacing(arrivalFacing);const pan=controller?.getPan();if(pan)next.panBy(pan.x,pan.y);controller=next;controllerRevision=revision;if(camera){next.restoreCamera(camera);zoomLevel=camera.zoom;}else next.zoom(zoomLevel-1);arrivalCamera=undefined;transitionReady=true;if(restoreCanvasFocus){canvasHost?.querySelector<HTMLElement>('[role=application]')?.focus({preventScroll:true});restoreCanvasFocus=false;}}
 function arrowMove(event:KeyboardEvent){
  if(testing||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||!entity)return;
  if(event.target instanceof Element&&event.target.closest('input,select,textarea,[contenteditable=true]'))return;
  const directions:Record<string,{x:number;y:number}>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  const direction=directions[event.key];if(!direction)return;event.preventDefault();move(entity.id,{x:entity.position.x+direction.x,y:entity.position.y+direction.y});
 }
 const entity=$derived(draft.entities.find(e=>e.id===selected));
 const entityModules=$derived<ContentModuleCard[]>(entity?.interaction?.action==='chat.open'?[{type:'chat',name:adventure.chats?.find(chat=>chatResource(chat.id)===entity?.interaction?.resourceId)?.name??entity.label}]:[]);
 const adapter=$derived<WorldAdapter>({scene:preview,interact:e=>{
  if(e.action==='adventure.exit'){if(transitionImage)return;try{const a=parseAdventure(bundle()),next=travel(a,e.sceneId,e.entityId,controller?.getFacing());const camera=controller?.getCamera();transitionReady=false;transitionImage=controller?.captureFrame()??null;adopt(a,next.scene.id);arrivalCamera=camera;zoomLevel=camera?.zoom??1;arrival=next.scene.spawn;arrivalFacing=next.facing;testing=true;notice=`Has llegado a ${next.scene.name}.`; }catch(cause){error=(cause as Error).message;}}
  else notice=`Interacción: ${e.action} → ${e.resourceId}`;
 }});
 $effect(()=>{
  try {preview=parseScene(testing&&arrival?{...draft,spawn:arrival}:draft);untrack(()=>revision++);error='';}
  catch(e){error=(e instanceof Error?e.message:'Mapa no válido.')+' La vista conserva el último mapa válido.';}
 });
 function snapshot(){future=[];history=[...history.slice(-29),JSON.stringify({adventure:bundle(),mapId:draft.id})];}
 function update(values:Partial<WorldEntity>){const next={...draft,entities:draft.entities.map(e=>e.id===selected?{...e,...values}:e)};try{validateStory({...bundle(),maps:bundle().maps.map(m=>m.id===next.id?next:m)});snapshot();draft=next;error='';}catch(e){error=(e as Error).message;}}
 function position(axis:'x'|'y',value:number){if(entity)update({position:{...entity.position,[axis]:value}});}
 function apply(){clearTools();try{adventure=validateAdventure(bundle());preview=parseScene(draft);revision++;error='';notice='Aventura validada. Pulsa una salida para caminar hasta ella y viajar.';testing=true;}catch(e){error=e instanceof Error?e.message:'Mapa no válido.';}}
 function historyState(){return JSON.stringify({adventure:bundle(),mapId:draft.id});}
 function restoreHistory(value:string){const saved=JSON.parse(value),previousController=saved.mapId===draft.id?controller:undefined;adopt(saved.adventure,saved.mapId);if(previousController){controller=previousController;zoomLevel=previousController.getCamera().zoom;}testing=false;error='';}
 function undo(){const previous=history.at(-1);if(!previous)return;future=[...future,historyState()];history=history.slice(0,-1);restoreHistory(previous);notice='Cambio deshecho.';}
 function redo(){const next=future.at(-1);if(!next)return;history=[...history.slice(-29),historyState()];future=future.slice(0,-1);restoreHistory(next);notice='Cambio rehecho.';}

 function add(visualId:string,cell?:Cell){
  const asset=visualCatalog.find(a=>a.id===visualId);if(!asset)return;
  const kind=asset.kind;
  try{
   const id=crypto.randomUUID();const next=insertEntity(draft,kind,id,visualId,cell,visualCatalog);
   snapshot();draft=next;selectObject(id);
   if(kind==='person'&&visualId.startsWith('custom.')){inspectorTab='modules';notice='Personaje añadido. Crea o asigna su conversación en Módulos.';}
   const placed=next.entities.find(e=>e.id===id)!;
   notice=kind==='person'&&visualId.startsWith('custom.')?'Personaje añadido. Crea o asigna su conversación en Módulos.':`${placed.label} añadido en ${placed.position.x}, ${placed.position.y}. Ya aparece en el mapa.`;error='';
  }catch(e){error=e instanceof Error?e.message:'No se pudo añadir el objeto.';}
 }
 function flip(){
  if(!entity)return;
  try{const next=flipEntity(draft,entity.id);snapshot();draft=next;testing=false;error='';notice='Elemento volteado. Su huella y asiento se han ajustado; puedes deshacer.';}
  catch(e){error=`No se puede voltear aquí: ${(e as Error).message}`;}
 }
 function remove(){const remaining={...bundle(),story:adventure.story?{...adventure.story,entities:adventure.story.entities.filter(e=>e.mapId!==draft.id||e.entityId!==selected)}:undefined,maps:bundle().maps.map(m=>m.id!==draft.id?m:{...m,entities:m.entities.filter(e=>e.id!==selected)})};try{validateStory(remaining);}catch(e){error=(e as Error).message;return;}snapshot();adventure={...adventure,story:remaining.story};adventure={...adventure,exits:adventure.exits.filter(e=>!(e.fromMap===draft.id&&e.entityId===selected)).map(e=>e.toMap===draft.id&&e.destinationEntityId===selected?{...e,destinationEntityId:undefined}:e)};draft={...draft,entities:draft.entities.filter(e=>e.id!==selected),...(draft.walls?{walls:draft.walls.map(w=>w.exitId===selected?{...w,exitId:undefined}:w)}:{})};selected=null;}
 function changeWorld(value:string){if(!leaveChat())return;pickingExitId=null;try{const a=parseAdventure(bundle());adopt(a,value);syncUrl();testing=false;error='';}catch(e){error=(e as Error).message;}}
 function newMap(duplicate=false){try{const a=parseAdventure(bundle());snapshot();const id=crypto.randomUUID();
  const map:WorldScene=duplicate?{...parseScene(draft),id,name:`${draft.name} (copia)`,...(draft.walls?{walls:draft.walls.map(w=>({...w,exitId:undefined}))}:{}),entities:(JSON.parse(JSON.stringify(draft.entities)) as WorldEntity[]).filter(e=>e.interaction?.action!=='adventure.exit')}:{schemaVersion:1,id,name:`Mapa ${a.maps.length+1}`,theme:'outdoors',width:12,height:12,spawn:{x:1,y:1},entities:[]};
  adopt(parseAdventure({...a,maps:[...a.maps,map]}),id);testing=false;error='';
 }catch(e){error=(e as Error).message;}}
 function addExit(cell?:Cell){try{const a=connectMaps(bundle(),draft.id,destination,crypto.randomUUID(),undefined,cell);snapshot();const id=a.exits.at(-1)!.entityId;adopt(a);selectObject(id);error='';notice='Salida añadida. Ajusta su posición y la casilla de llegada en el inspector.';}catch(e){error=(e as Error).message;}}
 function editExit(values:Partial<MapExit>){if(!selectedExit)return;try{const a=parseAdventure({...bundle(),exits:adventure.exits.map(e=>e.id===selectedExit.id?{...e,...values}:e)});snapshot();adventure=a;error='';}catch(e){error=(e as Error).message;}}
 function chooseArrival(){if(!selectedExit)return;const exit=selectedExit;changeWorld(exit.toMap);if(draft.id===exit.toMap){pickingExitId=exit.id;panMode=false;notice='Pulsa una casilla libre para elegir la llegada. También puedes cancelar.';}}
 function cancelPicking(){const exit=adventure.exits.find(e=>e.id===pickingExitId);pickingExitId=null;if(exit){changeWorld(exit.fromMap);selected=exit.entityId;}}
 function pickArrival(cell:Cell){const exit=adventure.exits.find(e=>e.id===pickingExitId);if(!exit)return;try{const a=parseAdventure({...bundle(),exits:adventure.exits.map(e=>e.id===exit.id?{...e,arrival:cell}:e)});snapshot();adopt(a,exit.fromMap);selected=exit.entityId;pickingExitId=null;notice=`Llegada elegida en ${cell.x}, ${cell.y}.`;error='';}catch(e){error=(e as Error).message;}}
 function returnExit(){if(!selectedExit)return;try{const a=connectMaps(bundle(),selectedExit.toMap,draft.id,crypto.randomUUID());snapshot();adventure=a;notice='Conexión de vuelta creada. Selecciona el mapa destino para colocarla.';error='';}catch(e){error=(e as Error).message;}}
 import {exportAdventure,importAdventure,downloadBlob} from '$lib/storage/adventure-package';
 let transferring=$state(false);
 async function download(){if(transferring)return;transferring=true;notice='Preparando el paquete con todos sus recursos…';try{downloadBlob(await exportAdventure(parseAdventure(bundle())),`${adventure.id}.zip`);error='';notice='Paquete exportado con mapas, catálogo e imágenes.';}catch(e){error=(e as Error).message;}finally{transferring=false;}}
 async function openResources(section?:'tile'|'player'){if(await persist())await goto(`/sprites?adventure=${encodeURIComponent(adventure.id)}${section?'&section='+section:''}`);}
 async function duplicateAdventure(){if(!(await persist()))return;try{const copy={...parseAdventure(bundle()),id:crypto.randomUUID(),name:adventure.name+' (copia)'};const library=await localAdventures.save(copy,{pack:await localAdventures.pack(adventure.id),blobs:{}});availableAdventures=library.adventures;await loadGraphics(copy.id);adopt(library.adventures.find(a=>a.id===copy.id)!,copy.startMap);syncUrl();savedContent=contentState();history=[];future=[];notice='Copia creada con sus recursos. El progreso del juego es independiente.';}catch(e){error=(e as Error).message;}}
 async function upload(event:Event,adventureOnly=false){const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];if(!file||transferring)return;transferring=true;try{if(file.name.toLowerCase().endsWith('.zip')){if(!(await persist()))return;const imported=await importAdventure(file);availableAdventures=(await localAdventures.load()).adventures;await loadGraphics(imported.id);adopt(imported,imported.startMap);syncUrl();savedContent=contentState();history=[];future=[];notice='Aventura importada y guardada con todos sus recursos.';error='';return;}if(file.size>10_000_000)throw new Error('El archivo no puede superar 10 MB.');const data=JSON.parse(await file.text());if(adventureOnly&&data?.kind!=='isometric-adventure')throw new Error('Selecciona un JSON de aventura completa. Para importar un mapa suelto, usa Más opciones → Importar JSON.');let a:Adventure;let mapId:string;
  if(data.kind==='isometric-adventure'){a=parseAdventure(data);if(!(await persist()))return;if(availableAdventures.some(item=>item.id===a.id))a={...a,id:crypto.randomUUID(),name:`${a.name} (importada)`};mapId=a.startMap;}
  else{const scene=parseScene(data);const current=parseAdventure(bundle());if(current.maps.some(m=>m.id===scene.id))scene.id=crypto.randomUUID();a=parseAdventure({...current,maps:[...current.maps,scene]});mapId=scene.id;}
  snapshot();if(a.id!==adventure.id)await loadGraphics(a.id);adopt(a,mapId);syncUrl();testing=false;error='';notice='Importación validada. Guarda para conservarla.';
 }catch(e){error=(e as Error).message;}finally{input.value='';transferring=false;}}
 function setInteraction(key:'label'|'action'|'resourceId',value:string){if(entity)update({interaction:{label:'Abrir',action:'space.open',resourceId:'world',...entity.interaction,[key]:value}});}
 function setSeat(axis:'x'|'y',value:number){if(entity?.seat)update({seat:{...entity.seat,cell:{...entity.seat.cell,[axis]:value}},interactionPoints:[{...entity.seat.cell,[axis]:value}]});}
</script>
<svelte:window onkeydown={toolKeys}/>
<svelte:head><title>Editor de escenarios — Isométrico</title></svelte:head>
<div class="editor">
 <header class="world-context-header"><a href="/admin" title="Volver a mis aventuras"><ArrowLeft size={18}/><span>Aventuras</span></a><strong>Editor de mundo</strong><label class="world-adventure-selector"><span>Aventura</span><select aria-label="Aventura del editor" value={adventure.id} disabled={saving||openingGame||playerChanging} onchange={e=>switchAdventure(e.currentTarget.value)}>{#each availableAdventures as entry}<option value={entry.id}>{entry.name}</option>{/each}</select></label><div class="file-menu"><button disabled={saving||openingGame} aria-label="Más opciones" aria-expanded={fileMenu} onclick={()=>fileMenu=!fileMenu}><MoreHorizontal size={20}/></button>{#if fileMenu}<div class="file-popover"><button onclick={()=>{fileMenu=false;fileInput.click();}}><Upload size={16}/>Importar ZIP / JSON</button><button onclick={()=>{fileMenu=false;download();}}><Download size={16}/>Exportar ZIP con recursos</button><button onclick={()=>openResources()}>Taller de sprites</button></div>{/if}</div><input class="sr-only" tabindex="-1" type="file" aria-label="Archivo de mapa JSON" accept=".zip,application/zip,.json,application/json" bind:this={fileInput} onchange={upload}/></header>
 <nav inert={saving||openingGame} class="editor-tools" aria-label="Herramientas del editor">
  <div class="view-switch" role="group" aria-label="Vista del editor"><button aria-pressed={editorView==='map'} disabled={!graphicsReady} onclick={()=>switchEditorView('map')}><MapIcon size={17}/>Mapa</button><button aria-pressed={editorView==='story'} disabled={!graphicsReady} onclick={()=>switchEditorView('story')}><Workflow size={17}/>Guion</button></div><span class="tool-divider"></span>
  {#if editorView==='map'}
  <button aria-pressed={!toolPanel&&!panMode&&!brush&&!pendingAsset&&!pendingExit&&!pickingExitId&&!testing} onclick={clearTools}><MousePointer2 size={18}/>Seleccionar</button>
  <span class="tool-divider"></span>
  <button aria-pressed={toolPanel==='paint'||!!brush} onclick={()=>showTool('paint')}><Paintbrush size={18}/>Terreno</button>
  <button aria-pressed={toolPanel==='catalog'||!!pendingAsset} onclick={()=>showTool('catalog')}><Plus size={18}/>Añadir</button>
  <span class="tool-divider"></span>
  <button aria-pressed={toolPanel==='player'} onclick={()=>showTool('player')}><UserRound size={18}/>Jugador</button>
  <button aria-pressed={toolPanel==='inventory'} onclick={()=>showTool('inventory')}><Backpack size={18}/>Inventario</button>
  <button aria-pressed={toolPanel==='objects'} onclick={()=>showTool('objects')}><List size={18}/>Objetos</button>
  {:else}<button disabled={!graphicsReady} onclick={newNarrative}><Clapperboard size={17}/> Añadir evento narrativo</button>{/if}
 </nav>
 <div class="editor-body" inert={saving||openingGame}>
  {#if toolPanel}<EditorPanel id="world-tools" title={toolPanel==='player'?'Personaje principal':toolPanel==='inventory'?'Inventario de la aventura':toolPanel==='adventures'?'Aventuras':toolPanel==='maps'?'Mapas de la aventura':toolPanel==='objects'?'Objetos del mapa':toolPanel==='catalog'?'Catálogo de recursos':'Suelo y construcción'} subtitle={adventure.name} side="left" width={340} wide={editorWide} bind:pinned={toolsPinned} open modalWhenFloating={false} local collapsed={toolCollapsed} panelAction={attachTools} onclose={()=>showTool(null)} pinnable>
   {#snippet headerActions()}<button class="panel-minimize" aria-label={toolCollapsed?'Expandir herramienta':'Minimizar herramienta'} onclick={()=>toolCollapsed=!toolCollapsed}>{#if toolCollapsed}<ChevronDown size={17}/>{:else}<ChevronUp size={17}/>{/if}</button>{/snippet}
   <div class="world-tool-content"><div hidden={toolCollapsed}>
   {#if toolPanel==='player'}
    <p class="environment-note">Elige el personaje que controlarás en todos los mapas de esta aventura.</p>
    <label>Personaje principal<select aria-label="Personaje principal" value={graphics.activePlayer??'default'} disabled={playerChanging||!graphicsReady} onchange={e=>chooseMainPlayer(e.currentTarget.value)}><option value="default">Explorador original</option>{#each Object.entries(graphics.players??{}) as [id,player]}<option value={id}>{player.name}</option>{/each}</select></label>
    <p class="environment-note">{playerChanging?'Actualizando personaje…':'La selección se guarda automáticamente en este navegador.'}</p>
    {#if !Object.keys(graphics.players??{}).length}<p class="environment-note">Aún no hay jugadores propios guardados. Importa el ZIP de tu personaje en el taller para añadirlo aquí.</p>{/if}
    <button class="panel-primary" disabled={playerChanging} onclick={refreshPlayers}>Actualizar jugadores</button>
    <button class="panel-primary" disabled={playerChanging} onclick={()=>openResources('player')}>Importar o gestionar jugadores</button>
   {:else if toolPanel==='inventory'}
    <p class="environment-note">Artículos compartidos por todos los mapas. Asígnalos a objetos recogibles desde sus propiedades.</p>
    <button class="panel-primary" onclick={addInventoryArticle}><Plus size={16}/> Nuevo artículo</button>
    <label>Artículo<select bind:value={inventorySelection}><option value="">Seleccionar…</option>{#each adventure.items??[] as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
    {#if inventoryArticle}<label>Nombre<input value={inventoryArticle.name} onchange={e=>{if(e.currentTarget.value.trim())editInventoryArticle({name:e.currentTarget.value.trim()});}}/></label>
    <label>Descripción<input value={inventoryArticle.description} onchange={e=>editInventoryArticle({description:e.currentTarget.value})}/></label>
    <label class="checkbox"><input type="checkbox" checked={inventoryArticle.stackable} onchange={e=>editInventoryArticle({stackable:e.currentTarget.checked})}/> Apilable</label>
    <button class="delete-object" disabled={inventoryInUse(inventoryArticle.id)} onclick={removeInventoryArticle}><Trash2 size={16}/> Eliminar artículo</button>
    {#if inventoryInUse(inventoryArticle.id)}<p class="environment-note">Este artículo está vinculado a objetos o condiciones. Desvincúlalo antes de eliminarlo.</p>{/if}
    {:else}<p class="environment-note">Selecciona un artículo o crea uno nuevo.</p>{/if}
   {:else if toolPanel==='adventures'}<label>Aventura<select value={adventure.id} onchange={e=>switchAdventure(e.currentTarget.value)}>{#each availableAdventures as item}<option value={item.id}>{item.id===adventure.id?adventure.name:item.name}</option>{/each}</select></label><label>Nombre de la aventura<input value={adventure.name} onchange={e=>{snapshot();adventure={...adventure,name:e.currentTarget.value};}}/></label><p class="environment-note">{adventure.maps.length} mapas en esta aventura. Al cambiar de aventura se guardan tus cambios.</p><button class="panel-primary" onclick={newAdventure}>Nueva aventura</button><button class="panel-primary" onclick={duplicateAdventure}>Duplicar aventura</button><button class="panel-primary" onclick={()=>openResources()}>Gestionar recursos</button><button class="panel-primary" onclick={()=>showTool('maps')}>Gestionar mapas de esta aventura</button><section class="adventure-transfer" aria-label="Importar y exportar aventuras"><h3>Importar y exportar</h3><div class="paint-actions"><button disabled={transferring} onclick={download}><Download size={16}/> Exportar ZIP con recursos</button><button onclick={()=>adventureFileInput?.click()}><Upload size={16}/> Importar aventura</button></div><input class="sr-only" tabindex="-1" type="file" aria-label="Archivo ZIP o JSON de aventura" accept=".zip,application/zip,.json,application/json" bind:this={adventureFileInput} onchange={e=>upload(e,true)}/></section>
   {:else if toolPanel==='maps'}<label for="template">Mapas · {adventure.maps.length}</label><select id="template" value={draft.id} onchange={e=>changeWorld(e.currentTarget.value)}>{#each adventure.maps as map}<option value={map.id}>{map.id===draft.id?draft.name:map.name}{map.id===adventure.startMap?' · Inicio':''}</option>{/each}</select><div class="paint-actions"><button onclick={()=>newMap()}>+ Nuevo mapa</button><button onclick={()=>newMap(true)}>Duplicar</button><button disabled={adventure.startMap===draft.id} onclick={()=>{snapshot();adventure={...adventure,startMap:draft.id};}}>Empezar aquí</button></div><button class="panel-primary" onclick={()=>{selectObject('');}}>Propiedades del mapa actual</button>
   {:else if toolPanel==='objects'}<label class="search-label"><Search size={16}/><input aria-label="Buscar objetos" placeholder="Buscar objeto…" bind:value={search}/></label><div class="object-list">{#each draft.entities.filter(e=>e.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())) as e}<button onclick={()=>selectObject(e.id)}><span>{e.label}</span><small>{e.position.x}, {e.position.y}</small></button>{:else}<p class="environment-note">No hay objetos que coincidan.</p>{/each}</div>
   {:else if toolPanel==='catalog'}<AdventureResourceCatalog entries={catalogEntries} kind={catalogKind} kinds={['object','npc']} onkindchange={next=>{catalogKind=next;catalogCategory='all';}} bind:query={catalogSearch} bind:category={catalogCategory} objectFamilies={graphics.objectFamilies??{}} selected={pendingAsset??''} resolve={url=>url} onselect={beginPlacement}/><p class="environment-note">Elige un gráfico y pulsa sobre el mapa para colocarlo. Organiza las familias en el taller de sprites.</p><button class="panel-primary" onclick={()=>openResources()}><Pencil size={15}/> Abrir taller de sprites</button>
   {:else if toolPanel==='paint'}   <section class="tile-palette" aria-label="Editar terreno"><div class="paint-actions map-tabs">{#each [['tiles','Baldosas'],['wall','Paredes'],['door','Puertas'],['levels','Niveles']] as [id,label]}<button aria-pressed={mapMode===id} onclick={()=>{mapMode=id as 'tiles'|'wall'|'door'|'levels';brush=null;wallTool=id==='wall'||id==='door'?id:null;selectedWall=null;}}>{label}</button>{/each}</div>{#if mapMode==='tiles'}<h3>Baldosas</h3><p>Elige una baldosa y pinta pulsando o arrastrando sobre el mapa.</p><div class="tile-options">{#each tileChoices as tile}<button aria-pressed={brush===tile.id} onclick={()=>{wallTool=null;brush=tile.id;testing=false;notice=`Pincel: ${tile.label}. Arrastra para pintar; deshacer revierte el trazo.`;}}>{#if tile.id==='void'}<span class="empty-tile" aria-hidden="true"></span>{:else}<span class="tile-thumbnail"><SpriteThumbnail image={graphics.tiles[tile.id]} frame={graphics.tileFrames?.[tile.id]} width={64} height={32}/></span>{/if}<span>{tile.label}</span></button>{/each}</div><button class="panel-primary" onclick={()=>openResources('tile')}><Plus size={15}/> Añadir suelos en el taller</button><div class="paint-actions"><button aria-pressed={brush==='erase'} onclick={()=>{wallTool=null;brush='erase';testing=false;}}>Restaurar suelo</button><button disabled={brush===null} onclick={()=>{brush=null;notice='Pincel desactivado.';}}>Dejar de pintar</button></div><p>{brush===null?'Pincel desactivado':brush==='erase'?'Restaurar: recupera el suelo original de cada casilla.':brush==='void'?'Vacío: elimina casillas libres. Mueve primero los objetos y accesos.':'Pincel activo. Puedes pintar también debajo de los objetos.'} Las casillas vacías no se pueden atravesar.</p>
 {:else if mapMode==='levels'}<h3>Altura</h3><div class="stair-options level-options" role="group" aria-label="Altura del terreno">{#each [-2,-1,0,1,2] as level}<button aria-label={`Pintar nivel ${level}`} title={level===0?'Nivel 0 · Base':`Nivel ${level>0?'+':''}${level}`} aria-pressed={brush===`height:${level}`} onclick={()=>{brush=`height:${level}`;wallTool=null;}}><img src={`/editor/level-${level}.svg`} alt=""/><span>{level>0?'+':''}{level}</span></button>{/each}</div>
 <h3>Escaleras</h3><div class="stair-options" role="group" aria-label="Orientación de escaleras">{#each [['se','Sureste'],['sw','Suroeste'],['nw','Noroeste'],['ne','Noreste']] as [direction,label]}<button aria-label={`Escalera hacia ${label.toLowerCase()}`} title={`Subir hacia ${label.toLowerCase()}`} aria-pressed={brush===`stairs:${direction}`} onclick={()=>{brush=`stairs:${direction}` as MapBrush;wallTool=null;}}><img src={`/editor/stairs-${direction}.svg`} alt=""/></button>{/each}<button class="erase-stairs" aria-label="Eliminar escalera" title="Eliminar escalera" aria-pressed={brush==='stairs:erase'} onclick={()=>{brush='stairs:erase';wallTool=null;}}><X size={22}/></button></div>
 {:else}<h3>{mapMode==='wall'?'Paredes':'Puertas'}</h3><p>Pulsa cerca de un borde del suelo. Para puertas, elige un tramo de pared existente.</p><div class="paint-actions">{#each (mapMode==='wall'?[['wall','Pared'],['remove','Borrar pared']]:[['door','Puerta']]) as [id,label]}<button aria-pressed={wallTool===id} onclick={()=>{brush=null;wallTool=id as 'wall'|'door'|'remove';selectedWall=null;}}>{label}</button>{/each}<button onclick={()=>{wallTool=null;brush=null;}}>Seleccionar borde</button></div>
 {#if mapMode==='wall'}<p id="wall-finish-label">Acabado</p><div class="wall-materials" role="group" aria-labelledby="wall-finish-label">{#each wallMaterials as material}<button aria-pressed={wallMaterial===material.id} onclick={()=>chooseWallMaterial(material.id)}><span class={`material-swatch ${material.id}`}></span>{material.label}</button>{/each}</div>{/if}
 <label>Opacidad de paredes<input type="range" min="0.15" max="1" step="0.05" bind:value={wallOpacity}/></label>
 {#if selectedWall}<p>{selectedWall.kind==='door'?'Puerta':'Pared'} · {selectedWall.x}, {selectedWall.y}</p>{#if selectedWall.kind==='door'}{#if selectedWall.exitId}<button class="panel-primary" onclick={()=>selectObject(selectedWall!.exitId!)}>Editar destino</button><button class="panel-primary" onclick={unlinkDoor}>Desvincular puerta</button>{:else}<label>Conectar puerta con<select bind:value={destination}><option value="">Elegir destino…</option>{#each adventure.maps.filter(m=>m.id!==draft.id) as m}<option value={m.id}>{m.name}</option>{/each}</select></label><button class="panel-primary" disabled={!destination} onclick={linkDoor}>Conectar puerta</button>{/if}{/if}{/if}
 {/if}</section>{/if}
</div></div>
  </EditorPanel>{/if}
  <main class="editor-preview" class:with-inspector={!!entity&&!testing&&!pickingExitId}>{#if editorView==='story'}{#key adventure.id}<StoryBoard adventure={bundle()} {graphics} selected={narrativeSelection?eventNode(narrativeSelection):selected?objectNode({mapId:draft.id,entityId:selected}):mapProperties?mapNode(draft.id):''} onselect={openBoardSelection} onlayout={boardLayout}/>{/key}{:else}<div class="editor-canvas" bind:this={canvasHost}><div class="map-heading"><h1><button onclick={()=>selectObject('')} title="Propiedades del mapa">{preview.name}</button></h1></div>{#if graphicsReady}<World {revision} {panMode} {graphics} {adapter} editor={editing} onready={ready} onstatus={s=>notice=s}/>{:else}<div class="preload-stage">{#if loadFailed}<p role="alert">{error}</p><button onclick={initialize}>Reintentar carga</button>{:else}<LoadProgress progress={loadProgress}/>{/if}</div>{/if}<MapDissolve image={transitionImage} ready={transitionReady} ondone={()=>transitionImage=null}/></div><div class="editor-feedback">{#if pendingAsset||pendingExit}<p>Pulsa una casilla para colocar {pendingExit?'la salida':'el objeto'}. <button onclick={clearTools}>Cancelar</button></p>{/if}{#if pickingExitId}<p>Selecciona una casilla libre en este mapa. <button onclick={cancelPicking}>Cancelar selección</button></p>{/if}{#if error}<p role="alert" class="editor-error">{error}</p>{:else}<p role="status">{notice}</p>{/if}<small>Mano: desplazar vista. También espacio + arrastre o botón central. Selecciona y arrastra con ratón o dedo, o mueve con las flechas de la cuadrícula. Guardar y jugar aplica el mapa en este navegador. Exporta el JSON como copia.</small></div>{/if}</main>
  {#if narrativeSelection&&narrativeEvent(bundle(),narrativeSelection)}{@const event=narrativeEvent(bundle(),narrativeSelection)!}<aside class="editor-inspector entity-drawer" aria-label="Inspector del evento narrativo"><div class="inspector-main" inert={!!chatEditing}><div class="panel-heading"><h2>{event.name}</h2><button aria-label="Cerrar inspector del evento" onclick={closeInspector}><X size={18}/></button></div><div class="inspector-body"><NarrativeEventEditor adventure={bundle()} {event} onchange={editNarrative} onchat={id=>void openNarrativeChat(id)} onremove={removeNarrative}/></div></div>{#if chatEditing}<section class="module-layer" aria-label="Editar conversación del evento"><ChatEditor chat={chatEditing.chat} title={chatEditing.title} uses={chatEditing.uses} onapply={applyChat} onclose={()=>void closeChatLayer()} ondirty={value=>chatDirty=value}/></section>{/if}</aside>{/if}
  {#if !testing&&!pickingExitId&&(entity||mapProperties)}{#key mapProperties}<aside use:inspectorDrag transition:fly={{x:mapProperties?-24:24,duration:160}} class="editor-inspector" class:entity-drawer={!!entity&&!mapProperties} class:map-properties={mapProperties} class:collapsed={inspectorCollapsed&&!chatEditing} aria-label="Inspector"><div class="inspector-main" inert={!!chatEditing} aria-hidden={chatEditing?true:undefined}><div class="panel-heading"><h2>{selected===null?'Propiedades del mapa':entity?.label}</h2><div class="panel-actions"><button aria-label={inspectorCollapsed?"Expandir inspector":"Minimizar inspector"} aria-expanded={!inspectorCollapsed} onclick={()=>inspectorCollapsed=!inspectorCollapsed}>{#if inspectorCollapsed}<ChevronDown size={18}/>{:else}<ChevronUp size={18}/>{/if}</button><button aria-label="Cerrar inspector" onclick={closeInspector}><X size={18}/></button></div></div><div class="inspector-body" hidden={inspectorCollapsed}>
   {#if selected===null}
   <div class="map-adventure-context"><div><small>Aventura</small><strong>{adventure.name}</strong></div><button aria-label="Ajustes de la aventura" title="Ajustes de la aventura" onclick={()=>showTool('adventures')}><Settings2 size={19}/></button></div>
   <label for="mapname">Nombre del mapa</label><input id="mapname" value={draft.name} onchange={e=>{snapshot();draft={...draft,name:e.currentTarget.value};}}/>
   <label for="maptheme">Entorno</label><select id="maptheme" value={draft.theme} onchange={e=>{snapshot();draft={...draft,theme:e.currentTarget.value as WorldScene['theme']};notice='Entorno actualizado. Las baldosas pintadas se conservan.';}}>{#each Object.entries(environments) as [id,environment]}<option value={id}>{environment.label}</option>{/each}</select><p class="environment-note">Define el suelo base y los bordes. Las baldosas y paredes personalizadas se conservan.</p>
   <div class="pair"><label>Ancho<input type="number" min="1" max="64" value={draft.width} onchange={e=>{snapshot();draft={...draft,width:+e.currentTarget.value};}}/></label><label>Alto<input type="number" min="1" max="64" value={draft.height} onchange={e=>{snapshot();draft={...draft,height:+e.currentTarget.value};}}/></label></div>
   <div class="pair"><label>Entrada X<input type="number" min="0" value={draft.spawn.x} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,x:+e.currentTarget.value}};}}/></label><label>Entrada Y<input type="number" min="0" value={draft.spawn.y} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,y:+e.currentTarget.value}};}}/></label></div>

   <details class="advanced map-connections"><summary><Link size={16}/> Conectar mapas</summary><label>Mapa destino<select bind:value={destination}><option value="">Elegir destino…</option>{#each adventure.maps.filter(m=>m.id!==draft.id) as map}<option value={map.id}>{map.name}</option>{/each}</select></label><button class="panel-primary" disabled={!destination||destination===draft.id} onclick={()=>{pendingExit=true;pendingAsset=null;mapProperties=false;toolPanel=null;notice='Pulsa una casilla para colocar la salida. Escape cancela.';}}><Plus size={16}/> Colocar salida</button>
   {#each adventure.exits.filter(e=>e.fromMap===draft.id) as exit}<button class="connection-row" onclick={()=>selectObject(exit.entityId)}><Link size={15}/><span>{adventure.maps.find(m=>m.id===exit.toMap)?.name}</span><Settings2 size={15}/></button>{/each}</details>
   <button class="panel-primary" onclick={()=>showTool('maps')}><Layers size={16}/> Gestionar mapas</button>

   {:else if entity}<div class="inspector-tabs" role="group" aria-label="Secciones del elemento"><button aria-pressed={inspectorTab==='properties'} onclick={()=>inspectorTab='properties'}>Propiedades</button><button aria-pressed={inspectorTab==='modules'} onclick={()=>inspectorTab='modules'}>Módulos</button><button aria-pressed={inspectorTab==='conditions'} onclick={()=>inspectorTab='conditions'}>Condiciones</button></div><div hidden={inspectorTab!=='conditions'}><BehaviorEditor adventure={bundle()} ref={{mapId:draft.id,entityId:entity.id}} {graphics} onchange={editBehavior} onprepare={addOpenClosed}/></div><div hidden={inspectorTab!=='modules'}>{#if selectedExit||entity.pickup}<p class="environment-note">Este elemento utiliza su acción para viajar o recoger un artículo. Puedes añadir chats a los demás objetos y personajes.</p>{:else}
    <EntityModules modules={entityModules} loading={chatLoading} onadd={addContentModule} onedit={editContentModule} onremove={removeContentModule}/>{/if}</div><div hidden={inspectorTab!=='properties'}><label for="entityname">Nombre del objeto</label><input id="entityname" value={entity.label} onchange={e=>update({label:e.currentTarget.value})}/><label>Descripción<input value={entity.description??''} onchange={e=>update({description:e.currentTarget.value})}/></label>{#if selectedExit}<p class="environment-note">{draft.walls?.some(w=>w.exitId===entity.id)?'Puerta conectada a otro mapa.':'Loseta de salida con flecha hacia el borde más cercano.'}</p>{:else if visualCatalog.filter(a=>compatibleVisualKind(entity.kind,a.kind)).length>1}<label>Gráfico<select value={entity.visualId??`pixel.${entity.kind}`} onchange={e=>{const asset=visualCatalog.find(a=>a.id===e.currentTarget.value)!;update({visualId:asset.id,...(asset.color!==undefined?{color:asset.color}:{})});}}>{#each visualCatalog.filter(a=>compatibleVisualKind(entity.kind,a.kind)) as asset}<option value={asset.id}>{asset.label}</option>{/each}</select></label>{/if}<button class="flip-button" aria-pressed={entity.flipX??false} onclick={flip}>↔ Voltear horizontalmente</button><small>{entity.flipX?'Orientación reflejada':'Orientación original'}</small><small class="asset-id">{selectedExit?(draft.walls?.some(w=>w.exitId===entity.id)?'Puerta de salida':'Loseta de salida'):entity.visualId??`pixel.${entity.kind}`}</small>
    {#if !selectedExit}<label>Objeto de inventario<select value={entity.pickup?.itemId??''} onchange={e=>{const id=e.currentTarget.value;update(id?{pickup:{itemId:id,quantity:1},solid:false,interaction:{label:'Recoger',action:'inventory.collect',resourceId:id}}:{pickup:undefined,interaction:undefined});}}><option value="">No es recogible</option>{#each adventure.items??[] as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
    <button onclick={()=>{inventorySelection=entity?.pickup?.itemId??'';showTool('inventory');}}>Gestionar artículos</button>
    {#if entity.pickup}<label>Cantidad<input type="number" min="1" step="1" value={entity.pickup.quantity} onchange={e=>update({pickup:{...entity!.pickup!,quantity:Math.max(1,Math.floor(+e.currentTarget.value)||1)}})}/></label>{/if}{/if}
    <details class="advanced"><summary>Posición, tamaño y colisiones</summary>    <div class="pair"><label>Posición X<input type="number" min="0" value={entity.position.x} onchange={e=>position('x',+e.currentTarget.value)}/></label><label>Posición Y<input type="number" min="0" value={entity.position.y} onchange={e=>position('y',+e.currentTarget.value)}/></label></div>
    <div class="pair"><label>Anchura<input type="number" min="1" value={entity.size?.x??1} onchange={e=>update({size:{x:+e.currentTarget.value,y:entity?.size?.y??1}})}/></label><label>Profundidad<input type="number" min="1" value={entity.size?.y??1} onchange={e=>update({size:{x:entity?.size?.x??1,y:+e.currentTarget.value}})}/></label></div>
    <label class="checkbox"><input type="checkbox" checked={entity.solid!==false} onchange={e=>update({solid:e.currentTarget.checked})}/> Bloquea el paso</label>
</details>
    {#if selectedExit}<section aria-label="Destino de la salida"><h3>Salida a otro mapa</h3><label>Artículo necesario<select value={selectedExit.requirement?.itemId??''} onchange={e=>editExit({requirement:e.currentTarget.value?{itemId:e.currentTarget.value,quantity:1,consume:false}:undefined})}><option value="">Ninguno</option>{#each adventure.items??[] as item}<option value={item.id}>{item.name}</option>{/each}</select></label>{#if selectedExit.requirement}<label>Cantidad requerida<input type="number" min="1" step="1" value={selectedExit.requirement.quantity} onchange={e=>editExit({requirement:{...selectedExit!.requirement!,quantity:Math.max(1,Math.floor(+e.currentTarget.value)||1)}})}/></label><label class="checkbox"><input type="checkbox" checked={selectedExit.requirement.consume} onchange={e=>editExit({requirement:{...selectedExit!.requirement!,consume:e.currentTarget.checked}})}/> Consumir al desbloquear</label>{/if}<label>Mapa destino<select value={selectedExit.toMap} onchange={e=>{const map=adventure.maps.find(m=>m.id===e.currentTarget.value)!;editExit({toMap:map.id,arrival:map.spawn,destinationEntityId:undefined});}}>{#each adventure.maps as map}<option value={map.id}>{map.name}</option>{/each}</select></label><div class="pair"><label>Llegada X<input type="number" min="0" value={selectedExit.arrival.x} onchange={e=>editExit({arrival:{...selectedExit!.arrival,x:+e.currentTarget.value}})}/></label><label>Llegada Y<input type="number" min="0" value={selectedExit.arrival.y} onchange={e=>editExit({arrival:{...selectedExit!.arrival,y:+e.currentTarget.value}})}/></label></div><p class="environment-note">Si existe una salida de vuelta, aparecerás sobre su baldosa mirando hacia el interior. Estas coordenadas se usan cuando no hay una entrada vinculada.</p><div class="paint-actions"><button onclick={chooseArrival}>Elegir llegada en el mapa</button><button onclick={returnExit}>Crear conexión de vuelta</button><button onclick={()=>changeWorld(selectedExit!.toMap)}>Editar mapa destino</button></div></section>{:else}
    <details class="advanced"><summary>Interacción y acciones</summary><label class="checkbox"><input type="checkbox" checked={!!entity.interaction} onchange={e=>update({interaction:e.currentTarget.checked?{label:'Abrir',action:'space.open',resourceId:'world'}:undefined})}/> Tiene interacción</label>
    {#if entity.interaction}<label>Texto de la interacción<input value={entity.interaction.label} onchange={e=>setInteraction('label',e.currentTarget.value)}/></label><label>Acción del anfitrión<input value={entity.interaction.action} onchange={e=>setInteraction('action',e.currentTarget.value)}/></label><label>Recurso asociado<input value={entity.interaction.resourceId} onchange={e=>setInteraction('resourceId',e.currentTarget.value)}/></label>{/if}
    </details>{/if}
    {#if entity.kind==='desk'||entity.seat}<details class="advanced"><summary>Asiento y orientación</summary>
    {#if entity.kind==='desk'}<label class="checkbox"><input type="checkbox" checked={!!entity.seat} onchange={e=>update({seat:e.currentTarget.checked?{cell:{x:entity!.position.x,y:entity!.position.y+(entity!.size?.y??1)},facing:'ne'}:undefined,interactionPoints:undefined})}/> Puesto con asiento</label>{/if}
    {#if entity.seat}<div class="pair"><label>Asiento X<input type="number" min="0" value={entity.seat.cell.x} onchange={e=>setSeat('x',+e.currentTarget.value)}/></label><label>Asiento Y<input type="number" min="0" value={entity.seat.cell.y} onchange={e=>setSeat('y',+e.currentTarget.value)}/></label></div><label>Orientación del asiento<select value={entity.seat.facing} onchange={e=>update({seat:{...entity!.seat!,facing:e.currentTarget.value as Facing}})}><option value="ne">Noreste</option><option value="se">Sureste</option><option value="sw">Suroeste</option><option value="nw">Noroeste</option></select></label>{/if}
    </details>{/if}
    <button class="delete-object" onclick={()=>{if(leaveChat())remove();}}><Trash2 size={16}/> Eliminar objeto</button></div>
   {/if}
  </div></div>
  {#if chatEditing}<section class="module-layer" transition:fly={{x:24,duration:160}} aria-label="Editar módulo de conversación"><ChatEditor chat={chatEditing.chat} title={chatEditing.title} uses={chatEditing.uses} onapply={applyChat} onclose={()=>void closeChatLayer()} ondirty={value=>chatDirty=value}/></section>{/if}
  </aside>{/key}{/if}
 </div>
 <footer class="world-footer">{#if editorView==='story'&&error}<span class="story-error" role="alert">{error}</span>{/if}<span class="world-save-status" role="status">{saving?'Guardando…':hasChanges?'Cambios sin guardar':'Guardado'}</span><div class="quick-map" role="group" aria-label="Mapa actual"><Layers size={18}/><select aria-label="Seleccionar mapa" value={draft.id} onchange={e=>changeWorld(e.currentTarget.value)}>{#each adventure.maps as map}<option value={map.id}>{map.id===draft.id?draft.name:map.name}{map.id===adventure.startMap?' · Inicio':''}</option>{/each}</select><button aria-label="Propiedades del mapa actual" title="Propiedades del mapa actual" aria-expanded={mapProperties&&!inspectorCollapsed} onclick={()=>selectObject('')}><Settings2 size={19}/></button></div>{#if editorView==='map'}<div class="editor-zoom" role="group" aria-label="Controles del mapa"><button aria-label="Deshacer" title="Deshacer (Ctrl/⌘ Z)" disabled={!history.length} onclick={undo}><Undo2 size={17}/></button><button aria-label="Rehacer" title="Rehacer (Ctrl/⌘ Mayús Z)" disabled={!future.length} onclick={redo}><Redo2 size={17}/></button><span class="control-divider" aria-hidden="true"></span><button aria-label="Mover vista" title="Mover vista" aria-pressed={panMode} onclick={()=>panMode=!panMode}><Hand size={18}/></button><button aria-label="Alejar mapa" title="Alejar" disabled={!cameraReady||zoomLevel<=.65} onclick={()=>zoom(-.15)}><Minus size={18}/></button><output aria-label="Nivel de zoom">{Math.round(zoomLevel*100)}%</output><button aria-label="Acercar mapa" title="Acercar" disabled={!cameraReady||zoomLevel>=3} onclick={()=>zoom(.15)}><Plus size={18}/></button><button aria-label="Ajustar mapa a la vista" title="Ajustar mapa a la vista" disabled={!cameraReady} onclick={fitMap}><Scan size={18}/></button></div>{:else}<div class="board-history"><button aria-label="Deshacer" disabled={!history.length} onclick={undo}><Undo2 size={17}/></button><button aria-label="Rehacer" disabled={!future.length} onclick={redo}><Redo2 size={17}/></button></div>{/if}<div class="editor-actions"><button disabled={!graphicsReady||!!chatEditing||saving||openingGame||playerChanging} aria-busy={saving&&!openingGame} aria-label={saving&&!openingGame?'Guardando aventura':'Guardar'} onclick={persist}>{#if saving&&!openingGame}<LoaderCircle size={17} class="save-spinner"/>{:else}<Check size={17}/>{/if}<span>{saving&&!openingGame?'Guardando…':'Guardar'}</span></button><button class="save-play" disabled={!graphicsReady||!!chatEditing||saving||openingGame||playerChanging} aria-busy={openingGame} aria-label={openingGame?(saving?'Guardando aventura':'Abriendo aventura'):'Guardar y jugar'} onclick={playSaved}>{#if openingGame}<LoaderCircle size={17} class="save-spinner"/>{:else}<Play size={17}/>{/if}<span>{openingGame?(saving?'Guardando…':'Abriendo…'):'Guardar y jugar'}</span></button></div></footer>
</div>
<style>
.editor-actions :global(.save-spinner){animation:save-spin 1s linear infinite}.editor-actions button:disabled{cursor:wait;opacity:.65}@keyframes save-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.editor-actions :global(.save-spinner){animation:none}}

.preload-stage{position:absolute;inset:0;display:grid;place-content:center;z-index:5;background:#f4f7f0}.preload-stage :global(.preload){width:min(420px,85vw)}

.map-adventure-context{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid #dce5d6}.map-adventure-context div{min-width:0;flex:1}.map-adventure-context small{display:block;font-size:11px;color:#718269;margin-bottom:4px}.map-adventure-context strong{display:block;font-size:14px;overflow-wrap:anywhere}.map-adventure-context button{display:grid;place-items:center;width:36px;height:36px;flex-shrink:0;border-radius:7px;color:#35502f;background:#edf3e5}.map-connections summary{display:flex;align-items:center;gap:8px}.connection-row{display:flex;align-items:center;gap:8px;padding:10px 0;width:100%;text-align:left;font-size:12px}.connection-row span{flex:1}.map-adventure-context button:focus-visible,.connection-row:focus-visible{outline:2px solid #577c35;outline-offset:2px}

.adventure-transfer{margin-top:20px;padding-top:16px;border-top:1px solid #dce5d6}.adventure-transfer h3{font-size:13px}.adventure-transfer .paint-actions button{display:flex;align-items:center;gap:7px}

.environment-note{font-size:11px;line-height:1.5;color:#718269;margin:8px 0 16px}.editor-zoom{position:absolute;right:16px;bottom:16px;z-index:2;display:flex;align-items:center;background:#fffef8;border:1px solid #d5dfce;border-radius:9px;box-shadow:0 3px 12px #28433318;overflow:hidden}.editor-zoom button{display:grid;place-items:center;width:40px;height:40px;color:#35502f}.editor-zoom button:hover:not(:disabled){background:#e8efde}.editor-zoom button:disabled{opacity:.35;cursor:default}.editor-zoom button:focus-visible{outline:2px solid #577c35;outline-offset:-3px}.editor-zoom output{min-width:44px;text-align:center;font-size:12px;color:#52664a;font-variant-numeric:tabular-nums}.tile-palette{margin-top:24px;padding-top:18px;border-top:1px solid #dce5d6}.tile-palette h3{font-size:14px}.tile-palette p{font-size:12px;line-height:1.5;color:#718269;margin:10px 0}.tile-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tile-options button{padding:10px 5px;border:1px solid #dce5d6;border-radius:7px;display:grid;justify-items:center;gap:8px;font-size:11px}.tile-thumbnail{display:block;width:64px;height:32px}.tile-palette button[aria-pressed=true]{background:#d8e8c9;border-color:#789557}.paint-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.paint-actions button{border:1px solid #dce5d6;border-radius:6px;padding:8px;font-size:11px}.editor-actions .save-play{background:#284333;color:#e4f5d1}.editor-actions .save-play span{display:inline!important}.flip-button{display:block;width:100%;padding:10px;margin:12px 0 6px;border:1px solid #c8d6be;border-radius:6px;background:#edf3e5;color:#35502f}.flip-button[aria-pressed=true]{background:#d8e8c9}.editor{height:100dvh;display:flex;flex-direction:column;background:#f4f7f1}.editor header{min-height:70px;padding:14px 22px;background:white;border-bottom:1px solid #dde5d9;display:flex;align-items:center;gap:26px}.editor header a,.editor-actions,.editor-actions button{display:flex;align-items:center;gap:8px}.editor header a{font-size:14px;color:#74836c}.editor header strong{font-size:16px}.editor-actions{margin-left:auto}.editor-actions button{padding:9px;border-radius:6px;font-size:12px}.editor-body{display:grid;grid-template-columns:220px minmax(0,1fr) 265px;flex:1;min-height:0}.editor aside{padding:20px;background:#fcfdfb;overflow:auto}.editor-objects{border-right:1px solid #dde5d9}.editor-inspector{border-left:1px solid #dde5d9}.editor label{display:block;font-size:12px;color:#718269;margin:14px 0 6px}.editor input,.editor select{width:100%;border:1px solid #dce5d6;border-radius:6px;background:white;padding:9px;font-size:13px;color:#3c5135}.editor label input,.editor label select{margin-top:6px}.object-list{display:flex;flex-direction:column;gap:3px;max-height:49vh;overflow:auto}.object-list button{display:flex;justify-content:space-between;text-align:left;padding:10px 8px;border-radius:6px;font-size:12px;gap:8px}.object-list small{color:#86977b;white-space:nowrap}.editor-preview{margin:0;width:auto;position:relative;display:flex;flex-direction:column;min-width:0}.editor-canvas{position:relative;flex:1;min-height:320px;background:#e9efe3}.editor-feedback{padding:17px 24px;font-size:13px;min-height:90px}.editor-feedback small{display:block;font-size:11px;margin-top:7px;color:#89977f}.editor-error{color:#a34736}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.editor .checkbox{display:flex;align-items:center;gap:8px}.editor .checkbox input{width:15px;margin:0}.asset-id{font-size:10px;color:#92a088;display:block;margin-top:6px}.delete-object{margin-top:22px;font-size:12px;display:flex;align-items:center;gap:8px;color:#a66754}@media(max-width:1000px){.editor-body{grid-template-columns:175px minmax(0,1fr) 220px}.editor header{gap:14px}.editor-actions button span{display:none}.editor aside{padding:14px}}@media(max-width:700px){.editor{height:auto;min-height:100dvh}.editor header{flex-wrap:wrap;padding:14px}.editor header strong{font-size:14px}.editor-actions{margin-left:0}.editor-body{display:flex;flex-direction:column}.editor-preview{order:-1;min-height:450px}.editor-objects,.editor-inspector{border:0;border-top:1px solid #dce5d6}.object-list{max-height:200px}.editor-actions button span{display:inline}.editor header a{font-size:12px}}


 .editor-body{display:block;position:relative;min-height:0}.editor-preview{height:100%;width:100%}.editor-tools{display:flex;gap:4px;align-items:center;padding:8px 20px;background:#fffef8;border-bottom:1px solid #dde5d9;overflow-x:auto;flex-shrink:0}.editor-tools button{display:flex;align-items:center;gap:7px;white-space:nowrap;padding:10px 12px;border-radius:8px;font-size:12px;color:#62755c}.editor-tools button[aria-pressed=true]{background:#dfeccd;color:#284333}.tool-divider{height:22px;border-left:1px solid #dce5d6;margin:0 6px}.editor aside{position:absolute;top:76px;bottom:132px;width:288px;z-index:4;padding:18px;background:#fffef8;border:1px solid #d5dfce;border-radius:14px;box-shadow:0 8px 30px #28433314;overflow:auto}.editor-objects{left:16px}.editor-inspector{right:16px}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.panel-heading h2{font-size:15px;overflow-wrap:anywhere}.panel-heading button{display:grid;place-items:center;min-width:28px;height:28px;border-radius:6px}.editor-feedback{min-height:64px;padding:12px 22px;font-size:12px}.editor-feedback small{display:none}.editor-canvas{min-height:0}.advanced{border-top:1px solid #e2e9db;padding:14px 0;margin-top:14px}.advanced summary{cursor:pointer;font-size:12px;color:#52694a;font-weight:600}.asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.asset-thumb{width:80px;height:80px}.person-preview{display:block;width:64px;height:80px;background-repeat:no-repeat;image-rendering:pixelated}.panel-primary{padding:12px;border:1px solid #c8d6be;border-radius:8px;margin-top:16px;width:100%;font-size:12px}.editor .search-label{display:flex;align-items:center;gap:8px}.editor .search-label input{margin:0}.object-list{max-height:none}.tile-palette{margin:0;padding:0;border:0}.file-menu{position:relative}.file-popover{position:absolute;right:0;top:42px;min-width:210px;z-index:12;background:#fffef8;border:1px solid #d5dfce;padding:8px;border-radius:10px;box-shadow:0 8px 30px #28433318}.file-popover button{width:100%;padding:12px;font-size:12px}.editor header{min-height:64px;padding:12px 20px;gap:18px}.editor header strong{font-size:14px}.editor-actions{gap:6px}.editor .delete-object{margin-top:12px}.editor-tools button:focus-visible,.panel-heading button:focus-visible{outline:2px solid #577c35;outline-offset:-2px}@media(max-width:700px){.editor{height:100dvh;min-height:0}.editor header{flex-wrap:nowrap;padding:10px;gap:10px}.editor header strong{display:none}.editor-actions{margin-left:auto}.editor-actions button span{display:none}.editor-actions .save-play span{display:none!important}.editor-tools{padding:6px 8px}.editor-tools button{padding:9px}.editor-preview{min-height:0}.editor aside{top:68px;bottom:120px;max-width:calc(100% - 24px);width:288px}.editor-objects{left:12px}.editor-inspector{right:12px}.editor-feedback{padding:10px 12px}.file-popover{right:0}}
.map-heading{position:absolute;top:22px;left:24px;z-index:2}.map-heading h1{font-size:22px;margin:0;color:#284333}.map-heading button{text-align:left}.panel-actions{display:flex;gap:2px;flex-shrink:0}.editor aside.collapsed{bottom:auto;overflow:hidden}.collapsed .panel-heading{margin-bottom:0}.editor [hidden]{display:none!important}
.panel-heading{cursor:grab;touch-action:none;user-select:none}.panel-actions{cursor:default}.editor aside:global(.drag-positioned){right:auto;bottom:auto;height:min(var(--panel-height),calc(100% - 24px))}.editor aside.collapsed:global(.drag-positioned){height:auto}.editor aside:global(.dragging) .panel-heading{cursor:grabbing}
.wall-materials{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wall-materials button{display:grid;gap:6px;padding:8px;border:1px solid #d5dfce;border-radius:8px;font-size:12px}.wall-materials button[aria-pressed=true]{outline:2px solid #789557}.material-swatch{height:28px;border-radius:4px;border:1px solid #bac9bf;background:#d4ded5}.material-swatch.glass{background:linear-gradient(135deg,#c2dfe1 35%,#f2ffff 38%,#b4d6dd 45%,#e4f4f5 65%,#a8cbd2 68%)}.material-swatch.stone{background-color:#a8a99f;background-image:linear-gradient(#777e75 1px,transparent 1px),linear-gradient(90deg,#777e75 1px,transparent 1px);background-size:20px 10px}.material-swatch.cobble{background:radial-gradient(ellipse,#aaa494 55%,#747970 58%,#747970 68%,transparent 70%) 0 0/16px 13px,#888d80}
.empty-tile{width:64px;height:32px;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:repeating-conic-gradient(#ccd3c7 0% 25%,#f3f5ee 0% 50%) 0 0/12px 12px}
.catalog-categories{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.stair-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:12px}.stair-options button{display:grid;place-items:center;min-width:0;min-height:56px;padding:3px;border:1px solid #dce5d6;border-radius:8px;background:#fcfdf8}.stair-options img{display:block;width:100%;height:44px;pointer-events:none}.stair-options button:hover{border-color:#789557}.stair-options button:focus-visible{outline:2px solid #577c35;outline-offset:2px}.stair-options .erase-stairs{color:#a66754}
.level-options button{gap:3px;padding:5px 3px;font-size:12px;font-weight:600;color:#52694a}.level-options img{height:54px}.level-options + h3{margin-top:20px}
.map-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.map-tabs button{padding:8px 3px}
.editor-zoom button[aria-pressed=true]{background:#dfeccd;color:#284333}.control-divider{height:22px;border-left:1px solid #d5dfce}
.quick-map{position:absolute;left:16px;bottom:16px;z-index:3;display:flex;align-items:center;gap:8px;width:288px;max-width:calc(100% - 32px);height:44px;padding:0 8px 0 12px;background:#fffef8;border:1px solid #d5dfce;border-radius:9px;box-shadow:0 3px 12px #28433318;color:#52694a}.editor .quick-map select{flex:1;min-width:0;margin:0;border:0;background:transparent;padding:8px 0;font-size:12px;text-overflow:ellipsis}.quick-map button{display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;border-radius:6px}.quick-map button:hover,.quick-map button[aria-expanded=true]{background:#dfeccd}.quick-map button:focus-visible,.quick-map select:focus-visible{outline:2px solid #577c35;outline-offset:1px}@media(max-width:680px){.quick-map{bottom:68px;left:12px;width:260px}}
@media(min-width:701px){.editor aside.map-properties{left:16px;right:auto;top:auto;bottom:132px;height:auto;max-height:calc(100% - 156px)}.editor aside.map-properties.collapsed{bottom:132px}.editor aside.map-properties:global(.drag-positioned){bottom:auto}}
.editor aside.entity-drawer{right:0;left:auto;top:0;bottom:0;width:400px;max-width:calc(100% - 40px);border-radius:14px 0 0 14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:-8px 0 30px #28433320}.entity-drawer .panel-heading{flex-shrink:0;cursor:default;touch-action:auto}.entity-drawer .inspector-body{flex:1;min-height:0;overflow:auto}.editor aside.entity-drawer.collapsed{bottom:auto}.inspector-tabs{display:flex;gap:6px;position:sticky;top:0;background:#fffef8;padding:0 0 12px;z-index:2}.inspector-tabs button{flex:1;padding:10px;border:1px solid #d5dfce;border-radius:8px;font-size:12px}.inspector-tabs button[aria-pressed=true]{background:#dfeccd;border-color:#789557}.entity-drawer .paint-actions button{font-size:12px}@media(prefers-reduced-motion:reduce){.entity-drawer{transition:none!important}}
@media(min-width:1000px){}
.inspector-main{min-height:0}.entity-drawer .inspector-main{display:flex;flex-direction:column;flex:1;overflow:hidden}.module-layer{position:absolute;inset:0;z-index:6;display:flex;min-width:0;min-height:0;background:#fffef8;border-radius:inherit;overflow:hidden}.module-layer :global(.chat-editor){flex:1}

 .editor{height:calc(100svh - var(--platform-bar-height,0px));min-height:480px;padding:0 20px;background:#f5f7f2}.editor .world-context-header{min-height:58px;padding:0;border-bottom:1px solid #dce4d8;background:transparent;gap:14px}.world-context-header>a{font-size:12px}.world-context-header strong{font-size:17px;white-space:nowrap}.world-adventure-selector{display:flex!important;align-items:center;gap:8px;margin:0 0 0 auto!important;font-size:11px!important}.world-adventure-selector select{width:160px;margin:0!important;padding:7px 10px!important}.editor-tools{min-height:52px;padding:6px 0;background:transparent;border:0;gap:3px}.editor-tools button{padding:8px 10px;font-size:12px;min-height:34px}.editor-tools button[aria-pressed=true]{background:#e5edda;color:#38552c}.editor-body{display:flex;gap:14px;padding-bottom:12px;min-height:0}.editor-preview{margin:0;width:0;min-height:0;flex:1;height:auto;border:1px solid #dce4d8;border-radius:12px;overflow:hidden}.editor-canvas{background:#eaf0e4;min-height:0}.map-heading{top:18px;left:20px}.map-heading h1{font-size:21px}.editor-feedback{font-size:11px;min-height:36px;padding:8px 12px;background:#f9fbf6}.world-footer{display:flex;align-items:center;gap:10px;min-height:58px;border-top:1px solid #dce4d8;flex:none}.world-save-status{font-size:12px;color:#677a5e;white-space:nowrap}.world-footer .quick-map,.world-footer .editor-zoom{position:static;box-shadow:none;border-color:#dce4d8;background:#fffef9;flex:none}.world-footer .quick-map{padding:0 7px;gap:4px;width:240px;max-width:none;box-sizing:border-box}.world-footer .quick-map select{max-width:180px;font-size:11px}.world-footer .quick-map button,.world-footer .editor-zoom button{width:32px;height:34px}.world-footer .editor-zoom output{font-size:11px;min-width:38px}.world-footer .editor-actions{margin-left:auto;gap:5px}.world-footer .editor-actions button{min-height:36px;border:1px solid #d8e0ce;background:#fffef9}.world-footer .editor-actions .save-play{background:#476238;border-color:#476238;color:white}.world-footer .editor-actions button span{display:inline!important}.world-tool-content{min-width:0}.world-tool-content .panel-primary{font-size:12px;padding:9px}.panel-minimize{display:grid;place-items:center;width:32px;height:32px;border-radius:6px}.editor aside.editor-inspector{right:0;left:auto;top:0;bottom:0;width:400px;max-width:calc(100% - 24px);border-radius:12px;padding:16px;background:#fbfcf9;border-color:#dce4d8;box-shadow:-8px 0 30px #183a3115}.editor aside.map-properties .panel-heading{cursor:grab}.inspector-tabs{background:#fbfcf9;gap:3px}.inspector-tabs button{font-size:12px;padding:8px}.editor label{font-size:12px}.editor input,.editor select{font-size:12px;border-color:#d8e0ce}.editor .panel-heading h2{font-size:15px}.editor .inspector-body{font-size:12px}.editor aside.entity-drawer .inspector-main{overflow:hidden}.editor .module-layer{background:#fbfcf9}.world-context-header .file-menu{margin-left:0}.file-popover{background:#fff;border-color:#d6e1ce;z-index:15}
 @media(min-width:1200px){.editor aside.editor-inspector{position:relative;inset:auto;max-width:none;height:100%;flex:none;box-shadow:none}.editor aside.editor-inspector:global(.drag-positioned){position:absolute;z-index:5}}
 @media(max-width:1050px){.world-save-status{display:none}.world-footer .quick-map select{max-width:140px}.world-footer .editor-actions .save-play span{display:none!important}.world-footer .editor-actions button{padding:7px}.world-context-header strong{font-size:15px}}
 @media(max-width:700px){.editor{padding:0 12px;height:calc(100svh - var(--platform-bar-height,0px));min-height:420px}.editor .world-context-header{flex-wrap:nowrap}.world-context-header>a span,.world-adventure-selector>span{display:none}.world-context-header strong{display:block!important;font-size:14px}.world-adventure-selector select{width:120px}.editor-tools{padding:5px 0}.editor-body{display:flex;flex-direction:row}.editor-preview{order:0;min-height:0}.world-footer{gap:5px}.world-footer .quick-map select{max-width:95px}.world-footer .editor-zoom button{width:28px}.world-footer .editor-zoom output{min-width:32px}.world-footer .editor-actions button span{display:none!important}.world-footer .editor-zoom .control-divider{margin:0 2px}.editor aside.editor-inspector{max-width:calc(100% - 20px)}}
@media(max-width:700px){.world-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:6px 0}.world-footer .quick-map{width:auto;min-width:0;height:38px}.world-footer .quick-map select{max-width:none}.world-footer .editor-actions{margin:0;grid-column:2;grid-row:1}.world-footer .editor-zoom{grid-column:1/-1;grid-row:2;justify-content:center;width:100%;box-sizing:border-box}.world-footer .editor-zoom button{width:32px}.world-footer .editor-zoom output{min-width:42px}}
.view-switch{display:flex;gap:3px}.editor-preview{display:flex;flex-direction:column}.board-history{display:flex;gap:5px}.story-error{color:#963f31;font-size:11px;max-width:300px;overflow-wrap:anywhere}.editor aside.entity-drawer .inspector-main{display:flex;flex-direction:column;min-height:0;flex:1}.editor aside.entity-drawer .inspector-body{overflow:auto;min-height:0;flex:1}
</style>
