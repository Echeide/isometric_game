<script lang="ts">
 import {sceneWalls,wallKey,wallCells,hasTile} from '../../../packages/world/src/walls';
 import {walkable} from '../../../packages/world/src/navigation';
 import type {Wall,MapBrush,WallMaterial} from '@isometrico/world';
 import {loadAdventureLibrary,storeAdventure,selectAdventure} from '$lib/demo/adventure-library';
 let availableAdventures=$state<Adventure[]>([]);
 import { draggablePanel } from '$lib/actions/draggable-panel';
 const panelPositions = new Map();
 import MapDissolve from '$lib/components/MapDissolve.svelte';
 let transitionImage=$state<string|null>(null),transitionReady=$state(false);
 let arrivalCamera:ReturnType<WorldController['getCamera']>|undefined;
 let panMode=$state(false);
 import { graphics } from '$lib/demo/pixelart';
 import { untrack, onMount } from 'svelte';
 import { goto } from '$app/navigation';
 import { World, parseScene, visualCatalog, type WorldScene, type WorldEntity, type WorldAdapter, type WorldEditor, type WorldController, type Facing, type TileKind, type Cell } from '@isometrico/world';
 import { insertEntity, moveEntity, flipEntity, paintTiles } from '$lib/demo/editor';
 import { office, outdoors } from '$lib/demo/scenes';
 import { ArrowLeft, Download, Upload, Plus, Trash2, Undo2, Play, Check, Minus, Scan, Hand, MousePointer2, Layers, Paintbrush, Link, List, MoreHorizontal, X, Search, ChevronUp, ChevronDown } from 'lucide-svelte';
 import {createAdventure,parseAdventure,connectMaps,travel,type Adventure,type MapExit} from '$lib/demo/adventure';
 type ToolPanel='adventures'|'maps'|'objects'|'catalog'|'paint'|'connect';
 let toolPanel=$state<ToolPanel|null>(null),mapProperties=$state(false),fileMenu=$state(false);
 let toolCollapsed=$state(false),inspectorCollapsed=$state(false);
 const objectCategories=[{id:'office',label:'Oficina'},{id:'nature',label:'Naturaleza'},{id:'urban',label:'Urbano'},{id:'people',label:'Personajes'}] as const;
 let objectCategory=$state('office'),catalogSearch=$state('');
 let search=$state(''),pendingAsset=$state<string|null>(null),pendingExit=$state(false);
 function selectObject(id:string){wallTool=null;selectedWall=null;selected=id||null;mapProperties=!id;inspectorCollapsed=false;toolPanel=null;brush=null;pendingAsset=null;pendingExit=false;panMode=false;testing=false;}
 function showTool(value:ToolPanel|null){wallTool=null;selectedWall=null;
  if(pickingExitId)cancelPicking();
  toolCollapsed=false;toolPanel=toolPanel===value?null:value;selected=null;mapProperties=false;brush=null;pendingAsset=null;pendingExit=false;panMode=false;testing=false;fileMenu=false;
 }
 function clearTools(){wallTool=null;selectedWall=null;testing=false;if(pickingExitId)cancelPicking();toolPanel=null;selected=null;mapProperties=false;brush=null;pendingAsset=null;pendingExit=false;panMode=false;fileMenu=false;}
 function beginPlacement(id:string){pendingAsset=id;pendingExit=false;toolPanel=null;selected=null;mapProperties=false;panMode=false;notice='Pulsa una casilla para colocar el objeto. Escape cancela.';}
 function placeAt(cell:Cell){if(pendingAsset)add(pendingAsset,cell);else if(pendingExit)addExit(cell);}
 function toolKeys(event:KeyboardEvent){if(event.key==='Escape'){clearTools();return;}arrowMove(event);}
 let adventure=$state<Adventure>(createAdventure([structuredClone(office),structuredClone(outdoors)]));
 let arrival=$state<Cell|null>(null);
 let arrivalFacing=$state<Facing>('se');
 let destination=$state('');
 let pickingExitId=$state<string|null>(null);
 const selectedExit=$derived(adventure.exits.find(e=>e.fromMap===draft.id&&e.entityId===selected));
 function bundle():Adventure{return {...adventure,maps:adventure.maps.map(m=>m.id===draft.id?draft:m)};}
 function adopt(a:Adventure,mapId=draft.id){wallTool=null;selectedWall=null;pickingExitId=null;adventure=a;draft=structuredClone(a.maps.find(m=>m.id===mapId)??a.maps[0]);selected=null;mapProperties=false;pendingAsset=null;pendingExit=false;arrival=null;arrivalFacing='se';arrivalCamera=undefined;controller=undefined;zoomLevel=1;brush=null;}

 let draft=$state<WorldScene>(structuredClone(office));
 let preview=$state<WorldScene>(structuredClone(office));
 let selected=$state<string|null>(null);
 let brush=$state<MapBrush|null>(null);
 const wallMaterials=[{id:'white',label:'Blanca'},{id:'glass',label:'Cristal'},{id:'stone',label:'Piedra'},{id:'cobble',label:'Empedrada'}] as const;
 let wallMaterial=$state<WallMaterial>('white');
 let mapMode=$state<'tiles'|'wall'|'door'>('tiles');
 let wallTool=$state<'wall'|'door'|'remove'|null>(null),wallOpacity=$state(.7),selectedWall=$state<Wall|null>(null);
 const tileChoices=[{id:'void',label:'Vacío'},{id:'office',label:'Suelo de oficina'},{id:'grass',label:'Césped'},{id:'path',label:'Camino'},{id:'parquet',label:'Parquet'},{id:'asphalt',label:'Piche · Asfalto'},{id:'sidewalk',label:'Acera'},{id:'cobble',label:'Empedrado'},{id:'sand',label:'Arena'},{id:'dirt',label:'Tierra'}] as const;
 let revision=$state(0),history=$state<string[]>([]);
 let error=$state(''),notice=$state('Selecciona un objeto del mapa para editarlo. Arrastra para moverlo.');
 let testing=$state(false);
 let fileInput:HTMLInputElement;
 let canvasHost:HTMLDivElement;
 let restoreCanvasFocus=false;
 let controller=$state<WorldController>();
 let controllerRevision=$state(-1);
 let zoomLevel=$state(1);
 const cameraReady=$derived(!!controller&&controllerRevision===revision);
 function zoom(delta:number){if(!cameraReady)return;zoomLevel=controller?.getCamera().zoom??zoomLevel;const next=Math.round(Math.max(.65,Math.min(3,zoomLevel+delta))*100)/100;controller?.zoom(next-zoomLevel);zoomLevel=next;}
 function fitMap(){if(!cameraReady)return;controller?.recenter();zoomLevel=1;}
 const editing=$derived<WorldEditor|undefined>(testing?undefined:{selectedId:selected??'',onpick:pickingExitId?pickArrival:pendingAsset||pendingExit?placeAt:undefined,wallTool:wallTool??undefined,onwall:editWall,wallOpacity,brush:selected===null?brush??undefined:undefined,onpaint:paint,onselect:selectObject,onmove:move});
 onMount(()=>{
  try{const library=loadAdventureLibrary(localStorage),query=new URLSearchParams(location.search);availableAdventures=library.adventures;const saved=library.adventures.find(a=>a.id===(query.get('adventure')??library.activeId))??library.adventures.find(a=>a.id===library.activeId)!;
   adopt(saved,query.get('map')??query.get('world')??saved.startMap);
  }catch(e){error=`No se pudo cargar la aventura: ${(e as Error).message}`;}
 });
 function syncUrl(){const url=new URL(location.href);url.search='';url.searchParams.set('adventure',adventure.id);url.searchParams.set('map',draft.id);window.history.replaceState(null,'',url);}
 function persist(){try{const library=storeAdventure(localStorage,bundle());availableAdventures=library.adventures;adventure=library.adventures.find(a=>a.id===library.activeId)!;syncUrl();error='';notice='Aventura guardada en este navegador.';return true;}catch(e){error=(e as Error).message;return false;}}
 async function playSaved(){if(persist())await goto(`/?adventure=${encodeURIComponent(adventure.id)}`);}
 function switchAdventure(id:string){
  if(id===adventure.id||!persist())return;
  try{const next=selectAdventure(localStorage,id);adopt(next,next.startMap);syncUrl();history=[];toolPanel='adventures';notice='Aventura seleccionada.';}catch(e){error=(e as Error).message;}
 }
 function newAdventure(){
  if(!persist())return;
  const map:WorldScene={schemaVersion:1,id:crypto.randomUUID(),name:'Mapa inicial',theme:'outdoors',width:12,height:12,spawn:{x:1,y:1},entities:[]};
  const next={...createAdventure([map]),id:crypto.randomUUID(),name:`Aventura ${availableAdventures.length+1}`};
  try{const library=storeAdventure(localStorage,next);availableAdventures=library.adventures;adopt(next,map.id);syncUrl();history=[];toolPanel='adventures';}catch(e){error=(e as Error).message;}
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
  try{const next=paintTiles(draft,cells,tile);parseAdventure({...bundle(),maps:bundle().maps.map(m=>m.id===draft.id?next:m)});if(JSON.stringify(next.tiles)===JSON.stringify(draft.tiles??{}))return;snapshot();draft=next;notice=`Suelo actualizado en ${cells.length} casillas. Puedes deshacer el trazo.`;error='';}
  catch(e){error=(e as Error).message;}
 }
 function move(id:string,position:{x:number;y:number}){
  try{const next=moveEntity(draft,id,position);snapshot();restoreCanvasFocus=document.activeElement===canvasHost?.querySelector('[role=application]');draft=next;selected=id;error='';notice='Objeto movido. Puedes deshacer el cambio.';return true;}
  catch(e){error=(e as Error).message;return false;}
 }
 function ready(next:WorldController){const camera=controller?.getCamera()??arrivalCamera;next.setFacing(arrivalFacing);const pan=controller?.getPan();if(pan)next.panBy(pan.x,pan.y);controller=next;controllerRevision=revision;if(camera){next.restoreCamera(camera);zoomLevel=camera.zoom;}else next.zoom(zoomLevel-1);arrivalCamera=undefined;transitionReady=true;if(restoreCanvasFocus){canvasHost?.querySelector<HTMLElement>('[role=application]')?.focus({preventScroll:true});restoreCanvasFocus=false;}}
 function arrowMove(event:KeyboardEvent){
  if(testing||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||!entity)return;
  if(event.target instanceof Element&&event.target.closest('input,select,textarea,[contenteditable=true]'))return;
  const directions:Record<string,{x:number;y:number}>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  const direction=directions[event.key];if(!direction)return;event.preventDefault();move(entity.id,{x:entity.position.x+direction.x,y:entity.position.y+direction.y});
 }
 const entity=$derived(draft.entities.find(e=>e.id===selected));
 const adapter=$derived<WorldAdapter>({scene:preview,interact:e=>{
  if(e.action==='adventure.exit'){if(transitionImage)return;try{const a=parseAdventure(bundle()),next=travel(a,e.sceneId,e.entityId,controller?.getFacing());const camera=controller?.getCamera();transitionReady=false;transitionImage=controller?.captureFrame()??null;adopt(a,next.scene.id);arrivalCamera=camera;zoomLevel=camera?.zoom??1;arrival=next.scene.spawn;arrivalFacing=next.facing;testing=true;notice=`Has llegado a ${next.scene.name}.`; }catch(cause){error=(cause as Error).message;}}
  else notice=`Interacción: ${e.action} → ${e.resourceId}`;
 }});
 $effect(()=>{
  try {preview=parseScene(testing&&arrival?{...draft,spawn:arrival}:draft);untrack(()=>revision++);error='';}
  catch(e){error=(e instanceof Error?e.message:'Mapa no válido.')+' La vista conserva el último mapa válido.';}
 });
 function snapshot(){history=[...history.slice(-29),JSON.stringify({adventure:bundle(),mapId:draft.id})];}
 function update(values:Partial<WorldEntity>){snapshot();draft={...draft,entities:draft.entities.map(e=>e.id===selected?{...e,...values}:e)};error='';}
 function position(axis:'x'|'y',value:number){if(entity)update({position:{...entity.position,[axis]:value}});}
 function apply(){clearTools();try{adventure=parseAdventure(bundle());preview=parseScene(draft);revision++;error='';notice='Aventura validada. Pulsa una salida para caminar hasta ella y viajar.';testing=true;}catch(e){error=e instanceof Error?e.message:'Mapa no válido.';}}
 function undo(){const previous=history.at(-1);if(previous){const saved=JSON.parse(previous);adopt(saved.adventure,saved.mapId);history=history.slice(0,-1);testing=false;error='';notice='Cambio deshecho.';}}
 function add(visualId:string,cell?:Cell){
  const asset=visualCatalog.find(a=>a.id===visualId);if(!asset)return;
  const kind=asset.kind;
  try{
   const id=crypto.randomUUID();const next=insertEntity(draft,kind,id,visualId,cell);
   snapshot();draft=next;selectObject(id);
   const placed=next.entities.find(e=>e.id===id)!;
   notice=`${placed.label} añadido en ${placed.position.x}, ${placed.position.y}. Ya aparece en el mapa.`;error='';
  }catch(e){error=e instanceof Error?e.message:'No se pudo añadir el objeto.';}
 }
 function flip(){
  if(!entity)return;
  try{const next=flipEntity(draft,entity.id);snapshot();draft=next;testing=false;error='';notice='Elemento volteado. Su huella y asiento se han ajustado; puedes deshacer.';}
  catch(e){error=`No se puede voltear aquí: ${(e as Error).message}`;}
 }
 function remove(){snapshot();adventure={...adventure,exits:adventure.exits.filter(e=>!(e.fromMap===draft.id&&e.entityId===selected)).map(e=>e.toMap===draft.id&&e.destinationEntityId===selected?{...e,destinationEntityId:undefined}:e)};draft={...draft,entities:draft.entities.filter(e=>e.id!==selected),...(draft.walls?{walls:draft.walls.map(w=>w.exitId===selected?{...w,exitId:undefined}:w)}:{})};selected=null;}
 function changeWorld(value:string){pickingExitId=null;try{const a=parseAdventure(bundle());adopt(a,value);testing=false;error='';}catch(e){error=(e as Error).message;}}
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
 function download(){try{const valid=parseAdventure(bundle());const blob=new Blob([JSON.stringify(valid,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${valid.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);error='';notice='Aventura completa exportada.';}catch(e){error=(e as Error).message;}}
 async function upload(event:Event){const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>10_000_000)throw new Error('El archivo no puede superar 10 MB.');const data=JSON.parse(await file.text());let a:Adventure;let mapId:string;
  if(data.kind==='isometric-adventure'){a=parseAdventure(data);if(!persist())return;if(availableAdventures.some(item=>item.id===a.id))a={...a,id:crypto.randomUUID(),name:`${a.name} (importada)`};mapId=a.startMap;}
  else{const scene=parseScene(data);const current=parseAdventure(bundle());if(current.maps.some(m=>m.id===scene.id))scene.id=crypto.randomUUID();a=parseAdventure({...current,maps:[...current.maps,scene]});mapId=scene.id;}
  snapshot();adopt(a,mapId);testing=false;error='';notice='Importación validada. Guarda para conservarla.';
 }catch(e){error=(e as Error).message;}finally{input.value='';}}
 function setInteraction(key:'label'|'action'|'resourceId',value:string){if(entity)update({interaction:{label:'Abrir',action:'space.open',resourceId:'world',...entity.interaction,[key]:value}});}
 function setSeat(axis:'x'|'y',value:number){if(entity?.seat)update({seat:{...entity.seat,cell:{...entity.seat.cell,[axis]:value}},interactionPoints:[{...entity.seat.cell,[axis]:value}]});}
</script>
<svelte:window onkeydown={toolKeys}/>
<svelte:head><title>Editor de escenarios — Isométrico</title></svelte:head>
<div class="editor">
 <header><a href="/" title="Volver al juego"><ArrowLeft size={18}/><span>Juego</span></a><strong>Editor <span>{draft.name}</span></strong><div class="editor-actions"><button onclick={undo} disabled={!history.length} title="Deshacer"><Undo2 size={17}/><span>Deshacer</span></button><button onclick={persist}><Check size={17}/><span>Guardar</span></button><button class="save-play" onclick={playSaved}><Play size={17}/><span>Guardar y jugar</span></button><div class="file-menu"><button aria-label="Más opciones" aria-expanded={fileMenu} onclick={()=>fileMenu=!fileMenu}><MoreHorizontal size={20}/></button>{#if fileMenu}<div class="file-popover"><button onclick={()=>{fileMenu=false;fileInput.click();}}><Upload size={16}/>Importar JSON</button><button onclick={()=>{fileMenu=false;download();}}><Download size={16}/>Exportar aventura</button><a href="/sprites">Hojas de sprites</a></div>{/if}</div></div><input class="sr-only" tabindex="-1" type="file" aria-label="Archivo de mapa JSON" accept=".json,application/json" bind:this={fileInput} onchange={upload}/></header>
 <nav class="editor-tools" aria-label="Herramientas del editor">
  <button aria-pressed={!toolPanel&&!panMode&&!brush&&!pendingAsset&&!pendingExit&&!pickingExitId&&!testing} onclick={clearTools}><MousePointer2 size={18}/>Seleccionar</button>
  <button aria-pressed={panMode} onclick={()=>{clearTools();panMode=true;testing=false;}}><Hand size={18}/>Mover vista</button>
  <span class="tool-divider"></span>
  <button aria-pressed={toolPanel==='paint'||!!brush} onclick={()=>showTool('paint')}><Paintbrush size={18}/>Mapa</button>
  <button aria-pressed={toolPanel==='catalog'||!!pendingAsset} onclick={()=>showTool('catalog')}><Plus size={18}/>Añadir</button>
  <button aria-pressed={toolPanel==='connect'||pendingExit} onclick={()=>showTool('connect')}><Link size={18}/>Conectar</button>
  <span class="tool-divider"></span>
  <button aria-pressed={toolPanel==='adventures'} onclick={()=>showTool('adventures')}><Layers size={18}/>Aventuras</button><button aria-pressed={toolPanel==='maps'} onclick={()=>showTool('maps')}><Layers size={18}/>Mapas</button>
  <button aria-pressed={toolPanel==='objects'} onclick={()=>showTool('objects')}><List size={18}/>Objetos</button>
 </nav>
 <div class="editor-body">
  {#if toolPanel}<aside use:draggablePanel={{key:"tools",positions:panelPositions}} class="editor-objects" class:collapsed={toolCollapsed} aria-label="Herramienta activa"><div class="panel-heading"><h2>{toolPanel==='adventures'?'Aventuras':toolPanel==='maps'?'Mapas de la aventura':toolPanel==='objects'?'Objetos del mapa':toolPanel==='catalog'?'Añadir objeto':toolPanel==='paint'?'Editar mapa':'Conectar mapas'}</h2><div class="panel-actions"><button aria-label={toolCollapsed?"Expandir herramienta":"Minimizar herramienta"} aria-expanded={!toolCollapsed} onclick={()=>toolCollapsed=!toolCollapsed}>{#if toolCollapsed}<ChevronDown size={18}/>{:else}<ChevronUp size={18}/>{/if}</button><button aria-label="Cerrar herramienta" onclick={()=>showTool(null)}><X size={18}/></button></div></div><div hidden={toolCollapsed}>
   {#if toolPanel==='adventures'}<label>Aventura<select value={adventure.id} onchange={e=>switchAdventure(e.currentTarget.value)}>{#each availableAdventures as item}<option value={item.id}>{item.id===adventure.id?adventure.name:item.name}</option>{/each}</select></label><label>Nombre de la aventura<input value={adventure.name} onchange={e=>{snapshot();adventure={...adventure,name:e.currentTarget.value};}}/></label><p class="environment-note">{adventure.maps.length} mapas en esta aventura. Al cambiar de aventura se guardan tus cambios.</p><button class="panel-primary" onclick={newAdventure}>Nueva aventura</button><button class="panel-primary" onclick={()=>showTool('maps')}>Gestionar mapas de esta aventura</button>
   {:else if toolPanel==='maps'}<label for="template">Mapas · {adventure.maps.length}</label><select id="template" value={draft.id} onchange={e=>changeWorld(e.currentTarget.value)}>{#each adventure.maps as map}<option value={map.id}>{map.id===draft.id?draft.name:map.name}{map.id===adventure.startMap?' · Inicio':''}</option>{/each}</select><div class="paint-actions"><button onclick={()=>newMap()}>+ Nuevo mapa</button><button onclick={()=>newMap(true)}>Duplicar</button><button disabled={adventure.startMap===draft.id} onclick={()=>{snapshot();adventure={...adventure,startMap:draft.id};}}>Empezar aquí</button></div><button class="panel-primary" onclick={()=>{selectObject('');}}>Propiedades del mapa actual</button>
   {:else if toolPanel==='connect'}<p class="environment-note">Elige el destino y después pulsa una casilla del mapa para colocar la salida.</p><label>Conectar con<select bind:value={destination}><option value="">Elegir destino…</option>{#each adventure.maps.filter(m=>m.id!==draft.id) as map}<option value={map.id}>{map.name}</option>{/each}</select></label><div class="paint-actions"><button disabled={!destination||destination===draft.id} onclick={()=>{pendingExit=true;pendingAsset=null;toolPanel=null;notice='Pulsa una casilla para colocar la salida. Escape cancela.';}}>+ Añadir salida</button></div>
   {:else if toolPanel==='objects'}<label class="search-label"><Search size={16}/><input aria-label="Buscar objetos" placeholder="Buscar objeto…" bind:value={search}/></label><div class="object-list">{#each draft.entities.filter(e=>e.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())) as e}<button onclick={()=>selectObject(e.id)}><span>{e.label}</span><small>{e.position.x}, {e.position.y}</small></button>{:else}<p class="environment-note">No hay objetos que coincidan.</p>{/each}</div>
   {:else if toolPanel==='catalog'}<div class="catalog-categories" role="group" aria-label="Categorías de objetos">{#each objectCategories as category}<button aria-pressed={objectCategory===category.id} onclick={()=>objectCategory=category.id}>{category.label}</button>{/each}</div><label class="search-label"><Search size={16}/><input aria-label="Buscar en la categoría" placeholder="Buscar…" bind:value={catalogSearch}/></label><p class="environment-note">Elige un objeto y pulsa sobre el mapa para colocarlo.</p><div class="asset-grid">{#each visualCatalog.filter(a=>a.category===objectCategory&&a.label.toLocaleLowerCase().includes(catalogSearch.toLocaleLowerCase())) as asset}<button onclick={()=>beginPlacement(asset.id)}>{#if graphics.objects[asset.id]}<img src={graphics.objects[asset.id].image} alt=""/>{:else}<span class="person-preview" style={`background-image:url(${asset.color===0xce936a?'/pixelart/characters/lucia/idle.png':asset.color===0x819582?'/pixelart/characters/marcos/idle.png':graphics.character.image})`}></span>{/if}<span>{asset.label.replace(' · Pixel','')}</span><small>{asset.size.x} × {asset.size.y}</small></button>{:else}<p class="environment-note">No hay elementos que coincidan.</p>{/each}</div>
   {:else if toolPanel==='paint'}   <section class="tile-palette" aria-label="Editar terreno"><div class="paint-actions">{#each [['tiles','Baldosas'],['wall','Paredes'],['door','Puertas']] as [id,label]}<button aria-pressed={mapMode===id} onclick={()=>{mapMode=id as 'tiles'|'wall'|'door';brush=null;wallTool=id==='tiles'?null:id as 'wall'|'door';selectedWall=null;}}>{label}</button>{/each}</div>{#if mapMode==='tiles'}<h3>Baldosas</h3><p>Elige una baldosa y pinta pulsando o arrastrando sobre el mapa.</p><div class="tile-options">{#each tileChoices as tile}<button aria-pressed={brush===tile.id} onclick={()=>{wallTool=null;brush=tile.id;testing=false;notice=`Pincel: ${tile.label}. Arrastra para pintar; deshacer revierte el trazo.`;}}>{#if tile.id==='void'}<span class="empty-tile" aria-hidden="true"></span>{:else}<img src={graphics.tiles[tile.id]} alt=""/>{/if}<span>{tile.label}</span></button>{/each}</div><div class="paint-actions"><button aria-pressed={brush==='erase'} onclick={()=>{wallTool=null;brush='erase';testing=false;}}>Restaurar suelo</button><button disabled={brush===null} onclick={()=>{brush=null;notice='Pincel desactivado.';}}>Dejar de pintar</button></div><p>{brush===null?'Pincel desactivado':brush==='erase'?'Restaurar: recupera el suelo original de cada casilla.':brush==='void'?'Vacío: elimina casillas libres. Mueve primero los objetos y accesos.':'Pincel activo. Puedes pintar también debajo de los objetos.'} Las casillas vacías no se pueden atravesar.</p>
 {:else}<h3>{mapMode==='wall'?'Paredes':'Puertas'}</h3><p>Pulsa cerca de un borde del suelo. Para puertas, elige un tramo de pared existente.</p><div class="paint-actions">{#each (mapMode==='wall'?[['wall','Pared'],['remove','Borrar pared']]:[['door','Puerta']]) as [id,label]}<button aria-pressed={wallTool===id} onclick={()=>{brush=null;wallTool=id as 'wall'|'door'|'remove';selectedWall=null;}}>{label}</button>{/each}<button onclick={()=>{wallTool=null;brush=null;}}>Seleccionar borde</button></div>
 {#if mapMode==='wall'}<p id="wall-finish-label">Acabado</p><div class="wall-materials" role="group" aria-labelledby="wall-finish-label">{#each wallMaterials as material}<button aria-pressed={wallMaterial===material.id} onclick={()=>chooseWallMaterial(material.id)}><span class={`material-swatch ${material.id}`}></span>{material.label}</button>{/each}</div>{/if}
 <label>Opacidad de paredes<input type="range" min="0.15" max="1" step="0.05" bind:value={wallOpacity}/></label>
 {#if selectedWall}<p>{selectedWall.kind==='door'?'Puerta':'Pared'} · {selectedWall.x}, {selectedWall.y}</p>{#if selectedWall.kind==='door'}{#if selectedWall.exitId}<button class="panel-primary" onclick={()=>selectObject(selectedWall!.exitId!)}>Editar destino</button><button class="panel-primary" onclick={unlinkDoor}>Desvincular puerta</button>{:else}<label>Conectar puerta con<select bind:value={destination}><option value="">Elegir destino…</option>{#each adventure.maps.filter(m=>m.id!==draft.id) as m}<option value={m.id}>{m.name}</option>{/each}</select></label><button class="panel-primary" disabled={!destination} onclick={linkDoor}>Conectar puerta</button>{/if}{/if}{/if}
 {/if}</section>{/if}
  </div></aside>{/if}
  <main class="editor-preview"><div class="editor-canvas" bind:this={canvasHost}><div class="map-heading"><h1><button onclick={()=>selectObject('')} title="Propiedades del mapa">{preview.name}</button></h1></div>{#key revision}<World {panMode} {graphics} {adapter} editor={editing} onready={ready} onstatus={s=>notice=s}/>{/key}<MapDissolve image={transitionImage} ready={transitionReady} ondone={()=>transitionImage=null}/><div class="editor-zoom" role="group" aria-label="Zoom del mapa"><button aria-label="Alejar mapa" title="Alejar" disabled={!cameraReady||zoomLevel<=.65} onclick={()=>zoom(-.15)}><Minus size={18}/></button><output aria-label="Nivel de zoom">{Math.round(zoomLevel*100)}%</output><button aria-label="Acercar mapa" title="Acercar" disabled={!cameraReady||zoomLevel>=3} onclick={()=>zoom(.15)}><Plus size={18}/></button><button aria-label="Ajustar mapa a la vista" title="Ajustar mapa a la vista" disabled={!cameraReady} onclick={fitMap}><Scan size={18}/></button></div></div><div class="editor-feedback">{#if pendingAsset||pendingExit}<p>Pulsa una casilla para colocar {pendingExit?'la salida':'el objeto'}. <button onclick={clearTools}>Cancelar</button></p>{/if}{#if pickingExitId}<p>Selecciona una casilla libre en este mapa. <button onclick={cancelPicking}>Cancelar selección</button></p>{/if}{#if error}<p role="alert" class="editor-error">{error}</p>{:else}<p role="status">{notice}</p>{/if}<small>Mano: desplazar vista. También espacio + arrastre o botón central. Selecciona y arrastra con ratón o dedo, o mueve con las flechas de la cuadrícula. Guardar y jugar aplica el mapa en este navegador. Exporta el JSON como copia.</small></div></main>
  {#if !testing&&!pickingExitId&&(entity||mapProperties)}<aside use:draggablePanel={{key:"inspector",positions:panelPositions}} class="editor-inspector" class:collapsed={inspectorCollapsed} aria-label="Inspector"><div class="panel-heading"><h2>{selected===null?'Propiedades del mapa':entity?.label}</h2><div class="panel-actions"><button aria-label={inspectorCollapsed?"Expandir inspector":"Minimizar inspector"} aria-expanded={!inspectorCollapsed} onclick={()=>inspectorCollapsed=!inspectorCollapsed}>{#if inspectorCollapsed}<ChevronDown size={18}/>{:else}<ChevronUp size={18}/>{/if}</button><button aria-label="Cerrar inspector" onclick={()=>{selected=null;mapProperties=false;}}><X size={18}/></button></div></div><div hidden={inspectorCollapsed}>
   {#if selected===null}
   <label for="mapname">Nombre del mapa</label><input id="mapname" value={draft.name} onchange={e=>{snapshot();draft={...draft,name:e.currentTarget.value};}}/>
   <label for="maptheme">Entorno</label><select id="maptheme" value={draft.theme} onchange={e=>{snapshot();draft={...draft,theme:e.currentTarget.value as WorldScene['theme']};notice='Entorno actualizado. Las baldosas pintadas se conservan.';}}><option value="office">Interior</option><option value="outdoors">Exterior</option></select><p class="environment-note">Interior muestra paredes y ventanas; exterior, un espacio abierto. Las casillas sin pintar usan el suelo del entorno.</p>
   <div class="pair"><label>Ancho<input type="number" min="1" max="64" value={draft.width} onchange={e=>{snapshot();draft={...draft,width:+e.currentTarget.value};}}/></label><label>Alto<input type="number" min="1" max="64" value={draft.height} onchange={e=>{snapshot();draft={...draft,height:+e.currentTarget.value};}}/></label></div>
   <div class="pair"><label>Entrada X<input type="number" min="0" value={draft.spawn.x} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,x:+e.currentTarget.value}};}}/></label><label>Entrada Y<input type="number" min="0" value={draft.spawn.y} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,y:+e.currentTarget.value}};}}/></label></div>

   {:else if entity}<label for="entityname">Nombre del objeto</label><input id="entityname" value={entity.label} onchange={e=>update({label:e.currentTarget.value})}/>{#if selectedExit}<p class="environment-note">{draft.walls?.some(w=>w.exitId===entity.id)?'Puerta conectada a otro mapa.':'Loseta de salida con flecha hacia el borde más cercano.'}</p>{:else if visualCatalog.filter(a=>a.kind===entity.kind).length>1}<label>Gráfico<select value={entity.visualId??`pixel.${entity.kind}`} onchange={e=>{const asset=visualCatalog.find(a=>a.id===e.currentTarget.value)!;update({visualId:asset.id,...(asset.color!==undefined?{color:asset.color}:{})});}}>{#each visualCatalog.filter(a=>a.kind===entity.kind) as asset}<option value={asset.id}>{asset.label}</option>{/each}</select></label>{/if}<button class="flip-button" aria-pressed={entity.flipX??false} onclick={flip}>↔ Voltear horizontalmente</button><small>{entity.flipX?'Orientación reflejada':'Orientación original'}</small><small class="asset-id">{selectedExit?(draft.walls?.some(w=>w.exitId===entity.id)?'Puerta de salida':'Loseta de salida'):entity.visualId??`pixel.${entity.kind}`}</small>
    <details class="advanced"><summary>Posición, tamaño y colisiones</summary>    <div class="pair"><label>Posición X<input type="number" min="0" value={entity.position.x} onchange={e=>position('x',+e.currentTarget.value)}/></label><label>Posición Y<input type="number" min="0" value={entity.position.y} onchange={e=>position('y',+e.currentTarget.value)}/></label></div>
    <div class="pair"><label>Anchura<input type="number" min="1" value={entity.size?.x??1} onchange={e=>update({size:{x:+e.currentTarget.value,y:entity?.size?.y??1}})}/></label><label>Profundidad<input type="number" min="1" value={entity.size?.y??1} onchange={e=>update({size:{x:entity?.size?.x??1,y:+e.currentTarget.value}})}/></label></div>
    <label class="checkbox"><input type="checkbox" checked={entity.solid!==false} onchange={e=>update({solid:e.currentTarget.checked})}/> Bloquea el paso</label>
</details>
    {#if selectedExit}<section aria-label="Destino de la salida"><h3>Salida a otro mapa</h3><label>Mapa destino<select value={selectedExit.toMap} onchange={e=>{const map=adventure.maps.find(m=>m.id===e.currentTarget.value)!;editExit({toMap:map.id,arrival:map.spawn,destinationEntityId:undefined});}}>{#each adventure.maps as map}<option value={map.id}>{map.name}</option>{/each}</select></label><div class="pair"><label>Llegada X<input type="number" min="0" value={selectedExit.arrival.x} onchange={e=>editExit({arrival:{...selectedExit!.arrival,x:+e.currentTarget.value}})}/></label><label>Llegada Y<input type="number" min="0" value={selectedExit.arrival.y} onchange={e=>editExit({arrival:{...selectedExit!.arrival,y:+e.currentTarget.value}})}/></label></div><p class="environment-note">Si existe una salida de vuelta, aparecerás sobre su baldosa mirando hacia el interior. Estas coordenadas se usan cuando no hay una entrada vinculada.</p><div class="paint-actions"><button onclick={chooseArrival}>Elegir llegada en el mapa</button><button onclick={returnExit}>Crear conexión de vuelta</button><button onclick={()=>changeWorld(selectedExit!.toMap)}>Editar mapa destino</button></div></section>{:else}
    <details class="advanced"><summary>Interacción y acciones</summary><label class="checkbox"><input type="checkbox" checked={!!entity.interaction} onchange={e=>update({interaction:e.currentTarget.checked?{label:'Abrir',action:'space.open',resourceId:'world'}:undefined})}/> Tiene interacción</label>
    {#if entity.interaction}<label>Texto de la interacción<input value={entity.interaction.label} onchange={e=>setInteraction('label',e.currentTarget.value)}/></label><label>Acción del anfitrión<input value={entity.interaction.action} onchange={e=>setInteraction('action',e.currentTarget.value)}/></label><label>Recurso asociado<input value={entity.interaction.resourceId} onchange={e=>setInteraction('resourceId',e.currentTarget.value)}/></label>{/if}
    </details>{/if}
    {#if entity.kind==='desk'||entity.seat}<details class="advanced"><summary>Asiento y orientación</summary>
    {#if entity.kind==='desk'}<label class="checkbox"><input type="checkbox" checked={!!entity.seat} onchange={e=>update({seat:e.currentTarget.checked?{cell:{x:entity!.position.x,y:entity!.position.y+(entity!.size?.y??1)},facing:'ne'}:undefined,interactionPoints:undefined})}/> Puesto con asiento</label>{/if}
    {#if entity.seat}<div class="pair"><label>Asiento X<input type="number" min="0" value={entity.seat.cell.x} onchange={e=>setSeat('x',+e.currentTarget.value)}/></label><label>Asiento Y<input type="number" min="0" value={entity.seat.cell.y} onchange={e=>setSeat('y',+e.currentTarget.value)}/></label></div><label>Orientación del asiento<select value={entity.seat.facing} onchange={e=>update({seat:{...entity!.seat!,facing:e.currentTarget.value as Facing}})}><option value="ne">Noreste</option><option value="se">Sureste</option><option value="sw">Suroeste</option><option value="nw">Noroeste</option></select></label>{/if}
    </details>{/if}
    <button class="delete-object" onclick={remove}><Trash2 size={16}/> Eliminar objeto</button>
   {/if}
  </div></aside>{/if}
 </div>
</div>
<style>
.environment-note{font-size:11px;line-height:1.5;color:#718269;margin:8px 0 16px}.editor-zoom{position:absolute;right:16px;bottom:16px;z-index:2;display:flex;align-items:center;background:#fffef8;border:1px solid #d5dfce;border-radius:9px;box-shadow:0 3px 12px #28433318;overflow:hidden}.editor-zoom button{display:grid;place-items:center;width:40px;height:40px;color:#35502f}.editor-zoom button:hover:not(:disabled){background:#e8efde}.editor-zoom button:disabled{opacity:.35;cursor:default}.editor-zoom button:focus-visible{outline:2px solid #577c35;outline-offset:-3px}.editor-zoom output{min-width:44px;text-align:center;font-size:12px;color:#52664a;font-variant-numeric:tabular-nums}.tile-palette{margin-top:24px;padding-top:18px;border-top:1px solid #dce5d6}.tile-palette h3{font-size:14px}.tile-palette p{font-size:12px;line-height:1.5;color:#718269;margin:10px 0}.tile-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tile-options button{padding:10px 5px;border:1px solid #dce5d6;border-radius:7px;display:grid;justify-items:center;gap:8px;font-size:11px}.tile-options img{width:64px;height:32px;image-rendering:pixelated}.tile-palette button[aria-pressed=true]{background:#d8e8c9;border-color:#789557}.paint-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.paint-actions button{border:1px solid #dce5d6;border-radius:6px;padding:8px;font-size:11px}.editor-actions .save-play{background:#284333;color:#e4f5d1}.editor-actions .save-play span{display:inline!important}.flip-button{display:block;width:100%;padding:10px;margin:12px 0 6px;border:1px solid #c8d6be;border-radius:6px;background:#edf3e5;color:#35502f}.flip-button[aria-pressed=true]{background:#d8e8c9}.editor{height:100dvh;display:flex;flex-direction:column;background:#f4f7f1}.editor header{min-height:70px;padding:14px 22px;background:white;border-bottom:1px solid #dde5d9;display:flex;align-items:center;gap:26px}.editor header a,.editor-actions,.editor-actions button{display:flex;align-items:center;gap:8px}.editor header a{font-size:14px;color:#74836c}.editor header strong{font-size:16px}.editor header strong span{font-size:11px;color:#8b9881;margin-left:8px}.editor-actions{margin-left:auto}.editor-actions button{padding:9px;border-radius:6px;font-size:12px}.editor-body{display:grid;grid-template-columns:220px minmax(0,1fr) 265px;flex:1;min-height:0}.editor aside{padding:20px;background:#fcfdfb;overflow:auto}.editor-objects{border-right:1px solid #dde5d9}.editor-inspector{border-left:1px solid #dde5d9}.editor label{display:block;font-size:12px;color:#718269;margin:14px 0 6px}.editor input,.editor select{width:100%;border:1px solid #dce5d6;border-radius:6px;background:white;padding:9px;font-size:13px;color:#3c5135}.editor label input,.editor label select{margin-top:6px}.object-list{display:flex;flex-direction:column;gap:3px;max-height:49vh;overflow:auto}.object-list button{display:flex;justify-content:space-between;text-align:left;padding:10px 8px;border-radius:6px;font-size:12px;gap:8px}.object-list small{color:#86977b;white-space:nowrap}.editor-preview{margin:0;width:auto;position:relative;display:flex;flex-direction:column;min-width:0}.editor-canvas{position:relative;flex:1;min-height:320px;background:#e9efe3}.editor-feedback{padding:17px 24px;font-size:13px;min-height:90px}.editor-feedback small{display:block;font-size:11px;margin-top:7px;color:#89977f}.editor-error{color:#a34736}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.editor .checkbox{display:flex;align-items:center;gap:8px}.editor .checkbox input{width:15px;margin:0}.asset-id{font-size:10px;color:#92a088;display:block;margin-top:6px}.delete-object{margin-top:22px;font-size:12px;display:flex;align-items:center;gap:8px;color:#a66754}@media(max-width:1000px){.editor-body{grid-template-columns:175px minmax(0,1fr) 220px}.editor header strong span{display:none}.editor header{gap:14px}.editor-actions button span{display:none}.editor aside{padding:14px}}@media(max-width:700px){.editor{height:auto;min-height:100dvh}.editor header{flex-wrap:wrap;padding:14px}.editor header strong{font-size:14px}.editor-actions{margin-left:0}.editor-body{display:flex;flex-direction:column}.editor-preview{order:-1;min-height:450px}.editor-objects,.editor-inspector{border:0;border-top:1px solid #dce5d6}.object-list{max-height:200px}.editor-actions button span{display:inline}.editor header a{font-size:12px}}


 .editor-body{display:block;position:relative;min-height:0}.editor-preview{height:100%;width:100%}.editor-tools{display:flex;gap:4px;align-items:center;padding:8px 20px;background:#fffef8;border-bottom:1px solid #dde5d9;overflow-x:auto;flex-shrink:0}.editor-tools button{display:flex;align-items:center;gap:7px;white-space:nowrap;padding:10px 12px;border-radius:8px;font-size:12px;color:#62755c}.editor-tools button[aria-pressed=true]{background:#dfeccd;color:#284333}.tool-divider{height:22px;border-left:1px solid #dce5d6;margin:0 6px}.editor aside{position:absolute;top:76px;bottom:132px;width:288px;z-index:4;padding:18px;background:#fffef8;border:1px solid #d5dfce;border-radius:14px;box-shadow:0 8px 30px #28433314;overflow:auto}.editor-objects{left:16px}.editor-inspector{right:16px}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.panel-heading h2{font-size:15px;overflow-wrap:anywhere}.panel-heading button{display:grid;place-items:center;min-width:28px;height:28px;border-radius:6px}.editor-feedback{min-height:64px;padding:12px 22px;font-size:12px}.editor-feedback small{display:none}.editor-canvas{min-height:0}.advanced{border-top:1px solid #e2e9db;padding:14px 0;margin-top:14px}.advanced summary{cursor:pointer;font-size:12px;color:#52694a;font-weight:600}.asset-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.asset-grid button{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;border:1px solid #dce5d6;border-radius:10px;min-height:126px;padding:10px;font-size:11px}.asset-grid img{width:80px;height:80px;object-fit:contain;image-rendering:pixelated}.person-preview{display:block;width:64px;height:80px;background-repeat:no-repeat;image-rendering:pixelated}.panel-primary{padding:12px;border:1px solid #c8d6be;border-radius:8px;margin-top:16px;width:100%;font-size:12px}.editor .search-label{display:flex;align-items:center;gap:8px}.editor .search-label input{margin:0}.object-list{max-height:none}.tile-palette{margin:0;padding:0;border:0}.file-menu{position:relative}.file-popover{position:absolute;right:0;top:42px;min-width:210px;z-index:12;background:#fffef8;border:1px solid #d5dfce;padding:8px;border-radius:10px;box-shadow:0 8px 30px #28433318}.file-popover button,.file-popover a{width:100%;padding:12px;font-size:12px}.editor header{min-height:64px;padding:12px 20px;gap:18px}.editor header strong{font-size:14px}.editor header strong span{font-weight:400}.editor-actions{gap:6px}.editor .delete-object{margin-top:12px}.editor-tools button:focus-visible,.panel-heading button:focus-visible{outline:2px solid #577c35;outline-offset:-2px}@media(max-width:700px){.editor{height:100dvh;min-height:0}.editor header{flex-wrap:nowrap;padding:10px;gap:10px}.editor header strong{display:none}.editor-actions{margin-left:auto}.editor-actions button span{display:none}.editor-actions .save-play span{display:none!important}.editor-tools{padding:6px 8px}.editor-tools button{padding:9px}.editor-preview{min-height:0}.editor aside{top:68px;bottom:120px;max-width:calc(100% - 24px);width:288px}.editor-objects{left:12px}.editor-inspector{right:12px}.editor-feedback{padding:10px 12px}.file-popover{right:0}}
.map-heading{position:absolute;top:22px;left:24px;z-index:2}.map-heading h1{font-size:22px;margin:0;color:#284333}.map-heading button{text-align:left}.panel-actions{display:flex;gap:2px;flex-shrink:0}.editor aside.collapsed{bottom:auto;overflow:hidden}.collapsed .panel-heading{margin-bottom:0}.editor [hidden]{display:none!important}
.panel-heading{cursor:grab;touch-action:none;user-select:none}.panel-actions{cursor:default}.editor aside:global(.drag-positioned){right:auto;bottom:auto;height:min(var(--panel-height),calc(100% - 24px))}.editor aside.collapsed:global(.drag-positioned){height:auto}.editor aside:global(.dragging) .panel-heading{cursor:grabbing}
.wall-materials{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wall-materials button{display:grid;gap:6px;padding:8px;border:1px solid #d5dfce;border-radius:8px;font-size:12px}.wall-materials button[aria-pressed=true]{outline:2px solid #789557}.material-swatch{height:28px;border-radius:4px;border:1px solid #bac9bf;background:#d4ded5}.material-swatch.glass{background:linear-gradient(135deg,#c2dfe1 35%,#f2ffff 38%,#b4d6dd 45%,#e4f4f5 65%,#a8cbd2 68%)}.material-swatch.stone{background-color:#a8a99f;background-image:linear-gradient(#777e75 1px,transparent 1px),linear-gradient(90deg,#777e75 1px,transparent 1px);background-size:20px 10px}.material-swatch.cobble{background:radial-gradient(ellipse,#aaa494 55%,#747970 58%,#747970 68%,transparent 70%) 0 0/16px 13px,#888d80}
.empty-tile{width:64px;height:32px;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:repeating-conic-gradient(#ccd3c7 0% 25%,#f3f5ee 0% 50%) 0 0/12px 12px}
.catalog-categories{display:grid;grid-template-columns:1fr 1fr;gap:6px}.catalog-categories button{padding:9px;border:1px solid #d5dfce;border-radius:7px;font-size:12px}.catalog-categories button[aria-pressed=true]{background:#dfeccd;border-color:#789557}.asset-grid small{font-size:10px;color:#718269}
</style>
