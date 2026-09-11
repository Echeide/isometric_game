<script lang="ts">
 let panMode=$state(false);
 import { graphics } from '$lib/demo/pixelart';
 import { untrack, onMount } from 'svelte';
 import { goto } from '$app/navigation';
 import {readMaps,saveMap,type WorldSlot} from '$lib/demo/saved-maps';
 import { World, parseScene, visualCatalog, type WorldScene, type WorldEntity, type WorldAdapter, type WorldEditor, type WorldController, type Facing, type TileKind, type Cell } from '@isometrico/world';
 import { insertEntity, moveEntity, flipEntity, paintTiles } from '$lib/demo/editor';
 import { office, outdoors } from '$lib/demo/scenes';
 import { ArrowLeft, Download, Upload, Plus, Trash2, Undo2, Play, Pencil, Check, Minus, Scan, Hand } from 'lucide-svelte';
 let slot=$state<WorldSlot>('checkpoint');
 let draft=$state<WorldScene>(structuredClone(office));
 let preview=$state<WorldScene>(structuredClone(office));
 let selected=$state<string|null>(null);
 let brush=$state<TileKind|'erase'|null>(null);
 const tileChoices=[{id:'office',label:'Suelo de oficina'},{id:'grass',label:'Césped'},{id:'path',label:'Camino'}] as const;
 let revision=$state(0),history=$state<string[]>([]);
 let error=$state(''),notice=$state('Selecciona un objeto en la lista para colocarlo.');
 let testing=$state(false);
 let fileInput:HTMLInputElement;
 let canvasHost:HTMLDivElement;
 let restoreCanvasFocus=false;
 let controller=$state<WorldController>();
 let controllerRevision=$state(-1);
 let zoomLevel=$state(1);
 const cameraReady=$derived(!!controller&&controllerRevision===revision);
 function zoom(delta:number){if(!cameraReady)return;const next=Math.round(Math.max(.65,Math.min(1.6,zoomLevel+delta))*100)/100;controller?.zoom(next-zoomLevel);zoomLevel=next;}
 function fitMap(){if(!cameraReady)return;controller?.recenter();zoomLevel=1;}
 const editing=$derived<WorldEditor|undefined>(testing?undefined:{selectedId:selected??'',brush:selected===null?brush??undefined:undefined,onpaint:paint,onselect:(id)=>{selected=id;},onmove:move});
 onMount(()=>{
  try{const saved=readMaps(localStorage),requested=new URLSearchParams(location.search).get('world');
   slot=requested==='checkpoint'||requested==='routingtales'?requested:saved.active;
   draft=structuredClone(saved.maps[slot]??(slot==='checkpoint'?office:outdoors));selected=null;
  }catch{notice='No se pudo leer el mapa guardado en este navegador.';}
 });
 async function playSaved(){
  try{const target=saveMap(localStorage,draft);error='';await goto(`/?world=${target}`);}
  catch(e){error=`No se pudo guardar y jugar: ${e instanceof Error?e.message:'almacenamiento no disponible'}. Puedes exportar el JSON como copia.`;}
 }
 function paint(cells:Cell[],tile:TileKind|'erase'){
  try{const next=paintTiles(draft,cells,tile);if(JSON.stringify(next.tiles)===JSON.stringify(draft.tiles??{}))return;snapshot();draft=next;notice=`Suelo actualizado en ${cells.length} casillas. Puedes deshacer el trazo.`;error='';}
  catch(e){error=(e as Error).message;}
 }
 function move(id:string,position:{x:number;y:number}){
  try{const next=moveEntity(draft,id,position);snapshot();restoreCanvasFocus=document.activeElement===canvasHost?.querySelector('[role=application]');draft=next;selected=id;error='';notice='Objeto movido. Puedes deshacer el cambio.';return true;}
  catch(e){error=(e as Error).message;return false;}
 }
 function ready(next:WorldController){const pan=controller?.getPan();if(pan)next.panBy(pan.x,pan.y);controller=next;controllerRevision=revision;next.zoom(zoomLevel-1);if(restoreCanvasFocus){canvasHost?.querySelector<HTMLElement>('[role=application]')?.focus({preventScroll:true});restoreCanvasFocus=false;}}
 function arrowMove(event:KeyboardEvent){
  if(testing||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||!entity)return;
  if(event.target instanceof Element&&event.target.closest('input,select,textarea,[contenteditable=true]'))return;
  const directions:Record<string,{x:number;y:number}>={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
  const direction=directions[event.key];if(!direction)return;event.preventDefault();move(entity.id,{x:entity.position.x+direction.x,y:entity.position.y+direction.y});
 }
 const entity=$derived(draft.entities.find(e=>e.id===selected));
 const adapter=$derived<WorldAdapter>({scene:preview,interact:e=>{notice=`Interacción: ${e.action} → ${e.resourceId}`;}});
 $effect(()=>{
  try {preview=parseScene(draft);untrack(()=>revision++);error='';}
  catch(e){error=(e instanceof Error?e.message:'Mapa no válido.')+' La vista conserva el último mapa válido.';}
 });
 function snapshot(){history=[...history.slice(-29),JSON.stringify(draft)];}
 function update(values:Partial<WorldEntity>){snapshot();draft={...draft,entities:draft.entities.map(e=>e.id===selected?{...e,...values}:e)};error='';}
 function position(axis:'x'|'y',value:number){if(entity)update({position:{...entity.position,[axis]:value}});}
 function apply(){try{preview=parseScene(draft);revision++;error='';notice='Mapa validado. Puedes recorrerlo y probar sus interacciones.';testing=true;}catch(e){error=e instanceof Error?e.message:'Mapa no válido.';}}
 function undo(){const previous=history.at(-1);if(previous){draft=JSON.parse(previous);history=history.slice(0,-1);selected=selected!==null&&draft.entities.some(e=>e.id===selected)?selected:null;error='';}}
 function add(visualId:string){
  const asset=visualCatalog.find(a=>a.id===visualId);if(!asset)return;
  const kind=asset.kind;
  try{
   const id=crypto.randomUUID();const next=insertEntity(draft,kind,id,visualId);
   snapshot();draft=next;selected=id;testing=false;
   const placed=next.entities.find(e=>e.id===id)!;
   notice=`${placed.label} añadido en ${placed.position.x}, ${placed.position.y}. Ya aparece en el mapa.`;error='';
  }catch(e){error=e instanceof Error?e.message:'No se pudo añadir el objeto.';}
 }
 function flip(){
  if(!entity)return;
  try{const next=flipEntity(draft,entity.id);snapshot();draft=next;testing=false;error='';notice='Elemento volteado. Su huella y asiento se han ajustado; puedes deshacer.';}
  catch(e){error=`No se puede voltear aquí: ${(e as Error).message}`;}
 }
 function remove(){snapshot();draft={...draft,entities:draft.entities.filter(e=>e.id!==selected)};selected=null;}
 function changeWorld(value:string){
  try{saveMap(localStorage,draft);const saved=readMaps(localStorage);snapshot();slot=value as WorldSlot;
   draft=structuredClone(saved.maps[slot]??(slot==='routingtales'?outdoors:office));selected=null;preview=structuredClone(draft);revision++;testing=false;error='';
  }catch(e){error=`No se pudo cambiar de mapa: ${(e as Error).message}`;}
 }
 function download(){try{const valid=parseScene(draft);const blob=new Blob([JSON.stringify(valid,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${valid.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);error='';notice='Mapa exportado. Guarda este archivo para conservar tus cambios.';}catch(e){error=(e as Error).message;}}
 async function upload(event:Event){const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>1_000_000)throw new Error('El archivo no puede superar 1 MB.');const scene=parseScene(JSON.parse(await file.text()));snapshot();slot=scene.theme==='office'?'checkpoint':'routingtales';draft=scene;preview=structuredClone(scene);selected=null;revision++;error='';notice='Mapa importado y validado.';}catch(e){error=(e as Error).message;}finally{input.value='';}}
 function setInteraction(key:'label'|'action'|'resourceId',value:string){if(entity)update({interaction:{label:'Abrir',action:'space.open',resourceId:'world',...entity.interaction,[key]:value}});}
 function setSeat(axis:'x'|'y',value:number){if(entity?.seat)update({seat:{...entity.seat,cell:{...entity.seat.cell,[axis]:value}},interactionPoints:[{...entity.seat.cell,[axis]:value}]});}
</script>
<svelte:window onkeydown={arrowMove}/>
<svelte:head><title>Editor de escenarios — Isométrico</title></svelte:head>
<div class="editor">
 <header><a href="/" onclick={e=>{e.preventDefault();void playSaved();}}><ArrowLeft size={18}/> Volver al mundo</a><strong>Editor de escenarios <span>Primera versión</span></strong><a href="/sprites">Hojas de sprites</a><div class="editor-actions"><button class="save-play" onclick={playSaved}><Play size={17}/><span>Guardar y jugar</span></button><button onclick={undo} disabled={!history.length} title="Deshacer"><Undo2 size={17}/><span>Deshacer</span></button><button aria-label="Importar mapa JSON" onclick={()=>fileInput.click()}><Upload size={17}/><span>Importar</span></button><button aria-label="Exportar mapa JSON" onclick={download}><Download size={17}/><span>Exportar JSON</span></button></div><input class="sr-only" tabindex="-1" type="file" aria-label="Archivo de mapa JSON" accept=".json,application/json" bind:this={fileInput} onchange={upload}/></header>
 <div class="editor-body">
  <aside class="editor-objects"><label for="template">Escenario de partida</label><select id="template" value={slot} onchange={e=>changeWorld(e.currentTarget.value)}><option value="checkpoint">Oficina Checkpoint</option><option value="routingtales">Ruta exterior</option></select><div class="list-title"><h2>Elementos</h2><span>{draft.entities.length+1}</span></div><div class="object-list"><button class="map-item" class:selected={selected===null} aria-pressed={selected===null} onclick={()=>{selected=null;testing=false;notice='Edita el nombre, las dimensiones y la entrada del mapa.';}}><span><strong>Mapa</strong><span class="map-name">{draft.name}</span></span><small>{draft.width} × {draft.height}</small></button>{#each draft.entities as e}<button class:selected={selected===e.id} aria-pressed={selected===e.id} onclick={()=>{selected=e.id;testing=false;}}><span>{e.label}</span><small>{e.position.x}, {e.position.y}</small></button>{/each}</div><label for="add">Añadir objeto</label><select id="add" value="" onchange={e=>{if(e.currentTarget.value)add(e.currentTarget.value);e.currentTarget.value='';}}><option value="" disabled>Elegir del catálogo…</option>{#each visualCatalog as asset}<option value={asset.id}>{asset.label}</option>{/each}</select></aside>
  <main class="editor-preview"><div class="preview-heading"><div><span>VISTA PREVIA</span><h1>{preview.name}</h1></div><button class="apply-map" onclick={()=>{if(testing){testing=false;notice="Selecciona un objeto para moverlo.";}else apply();}}>{#if testing}<Pencil size={16}/> Editar mapa{:else}<Play size={16}/> Probar mapa{/if}</button></div><div class="editor-canvas" bind:this={canvasHost}>{#key revision}<World {panMode} {graphics} {adapter} editor={editing} onready={ready} onstatus={s=>notice=s}/>{/key}<div class="editor-zoom" role="group" aria-label="Zoom del mapa"><button aria-label="Mover vista" aria-pressed={panMode} title="Mover vista: arrastra con ratón o dedo" onclick={()=>panMode=!panMode}><Hand size={18}/></button><button aria-label="Alejar mapa" title="Alejar" disabled={!cameraReady||zoomLevel<=.65} onclick={()=>zoom(-.15)}><Minus size={18}/></button><output aria-label="Nivel de zoom">{Math.round(zoomLevel*100)}%</output><button aria-label="Acercar mapa" title="Acercar" disabled={!cameraReady||zoomLevel>=1.6} onclick={()=>zoom(.15)}><Plus size={18}/></button><button aria-label="Ajustar mapa a la vista" title="Ajustar mapa a la vista" disabled={!cameraReady} onclick={fitMap}><Scan size={18}/></button></div></div><div class="editor-feedback">{#if error}<p role="alert" class="editor-error">{error}</p>{:else}<p role="status">{notice}</p>{/if}<small>Mano: desplazar vista. También espacio + arrastre o botón central. Selecciona y arrastra con ratón o dedo, o mueve con las flechas de la cuadrícula. Guardar y jugar aplica el mapa en este navegador. Exporta el JSON como copia.</small></div></main>
  <aside class="editor-inspector"><div class="list-title"><h2>{selected===null?'Propiedades del mapa':'Propiedades del objeto'}</h2><Pencil size={16}/></div>
   {#if selected===null}
   <label for="mapname">Nombre del mapa</label><input id="mapname" value={draft.name} onchange={e=>{snapshot();draft={...draft,name:e.currentTarget.value};}}/>
   <div class="pair"><label>Ancho<input type="number" min="1" max="64" value={draft.width} onchange={e=>{snapshot();draft={...draft,width:+e.currentTarget.value};}}/></label><label>Alto<input type="number" min="1" max="64" value={draft.height} onchange={e=>{snapshot();draft={...draft,height:+e.currentTarget.value};}}/></label></div>
   <div class="pair"><label>Entrada X<input type="number" min="0" value={draft.spawn.x} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,x:+e.currentTarget.value}};}}/></label><label>Entrada Y<input type="number" min="0" value={draft.spawn.y} onchange={e=>{snapshot();draft={...draft,spawn:{...draft.spawn,y:+e.currentTarget.value}};}}/></label></div>
   <section class="tile-palette" aria-label="Pintar suelo"><h3>Baldosas del suelo</h3><p>Elige una baldosa y pinta pulsando o arrastrando sobre el mapa.</p><div class="tile-options">{#each tileChoices as tile}<button aria-pressed={brush===tile.id} onclick={()=>{brush=tile.id;testing=false;notice=`Pincel: ${tile.label}. Arrastra para pintar; deshacer revierte el trazo.`;}}><img src={graphics.tiles[tile.id]} alt=""/><span>{tile.label}</span></button>{/each}</div><div class="paint-actions"><button aria-pressed={brush==='erase'} onclick={()=>{brush='erase';testing=false;}}>Restaurar suelo</button><button disabled={brush===null} onclick={()=>{brush=null;notice='Pincel desactivado.';}}>Dejar de pintar</button></div><p>{brush===null?'Pincel desactivado':brush==='erase'?'Restaurar: recupera el suelo original de cada casilla.':'Pincel activo. Puedes pintar también debajo de los objetos.'} El suelo no cambia las colisiones.</p></section>
   {:else if entity}<label for="entityname">Nombre del objeto</label><input id="entityname" value={entity.label} onchange={e=>update({label:e.currentTarget.value})}/><label>Gráfico<select value={entity.visualId??`builtin.${entity.kind}`} onchange={e=>update({visualId:e.currentTarget.value})}>{#each visualCatalog.filter(a=>a.kind===entity.kind) as asset}<option value={asset.id}>{asset.label}</option>{/each}</select></label><button class="flip-button" aria-pressed={entity.flipX??false} onclick={flip}>↔ Voltear horizontalmente</button><small>{entity.flipX?'Orientación reflejada':'Orientación original'}</small><small class="asset-id">{entity.visualId??`builtin.${entity.kind}`}</small>
    <div class="pair"><label>Posición X<input type="number" min="0" value={entity.position.x} onchange={e=>position('x',+e.currentTarget.value)}/></label><label>Posición Y<input type="number" min="0" value={entity.position.y} onchange={e=>position('y',+e.currentTarget.value)}/></label></div>
    <div class="pair"><label>Anchura<input type="number" min="1" value={entity.size?.x??1} onchange={e=>update({size:{x:+e.currentTarget.value,y:entity?.size?.y??1}})}/></label><label>Profundidad<input type="number" min="1" value={entity.size?.y??1} onchange={e=>update({size:{x:entity?.size?.x??1,y:+e.currentTarget.value}})}/></label></div>
    <label class="checkbox"><input type="checkbox" checked={entity.solid!==false} onchange={e=>update({solid:e.currentTarget.checked})}/> Bloquea el paso</label>
    <label class="checkbox"><input type="checkbox" checked={!!entity.interaction} onchange={e=>update({interaction:e.currentTarget.checked?{label:'Abrir',action:'space.open',resourceId:'world'}:undefined})}/> Tiene interacción</label>
    {#if entity.interaction}<label>Texto de la interacción<input value={entity.interaction.label} onchange={e=>setInteraction('label',e.currentTarget.value)}/></label><label>Acción del anfitrión<input value={entity.interaction.action} onchange={e=>setInteraction('action',e.currentTarget.value)}/></label><label>Recurso asociado<input value={entity.interaction.resourceId} onchange={e=>setInteraction('resourceId',e.currentTarget.value)}/></label>{/if}
    {#if entity.kind==='desk'}<label class="checkbox"><input type="checkbox" checked={!!entity.seat} onchange={e=>update({seat:e.currentTarget.checked?{cell:{x:entity!.position.x,y:entity!.position.y+(entity!.size?.y??1)},facing:'ne'}:undefined,interactionPoints:undefined})}/> Puesto con asiento</label>{/if}
    {#if entity.seat}<div class="pair"><label>Asiento X<input type="number" min="0" value={entity.seat.cell.x} onchange={e=>setSeat('x',+e.currentTarget.value)}/></label><label>Asiento Y<input type="number" min="0" value={entity.seat.cell.y} onchange={e=>setSeat('y',+e.currentTarget.value)}/></label></div><label>Orientación del asiento<select value={entity.seat.facing} onchange={e=>update({seat:{...entity!.seat!,facing:e.currentTarget.value as Facing}})}><option value="ne">Noreste</option><option value="se">Sureste</option><option value="sw">Suroeste</option><option value="nw">Noroeste</option></select></label>{/if}
    <button class="delete-object" onclick={remove}><Trash2 size={16}/> Eliminar objeto</button>
   {/if}
  </aside>
 </div>
</div>
<style>
.editor-zoom{position:absolute;right:16px;bottom:16px;z-index:2;display:flex;align-items:center;background:#fffef8;border:1px solid #d5dfce;border-radius:9px;box-shadow:0 3px 12px #28433318;overflow:hidden}.editor-zoom button{display:grid;place-items:center;width:40px;height:40px;color:#35502f}.editor-zoom button[aria-pressed=true]{background:#d8e8c9}.editor-zoom button:hover:not(:disabled){background:#e8efde}.editor-zoom button:disabled{opacity:.35;cursor:default}.editor-zoom button:focus-visible{outline:2px solid #577c35;outline-offset:-3px}.editor-zoom output{min-width:44px;text-align:center;font-size:12px;color:#52664a;font-variant-numeric:tabular-nums}.tile-palette{margin-top:24px;padding-top:18px;border-top:1px solid #dce5d6}.tile-palette h3{font-size:14px}.tile-palette p{font-size:12px;line-height:1.5;color:#718269;margin:10px 0}.tile-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tile-options button{padding:10px 5px;border:1px solid #dce5d6;border-radius:7px;display:grid;justify-items:center;gap:8px;font-size:11px}.tile-options img{width:64px;height:32px;image-rendering:pixelated}.tile-palette button[aria-pressed=true]{background:#d8e8c9;border-color:#789557}.paint-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.paint-actions button{border:1px solid #dce5d6;border-radius:6px;padding:8px;font-size:11px}.editor-actions .save-play{background:#284333;color:#e4f5d1}.editor-actions .save-play span{display:inline!important}.flip-button{display:block;width:100%;padding:10px;margin:12px 0 6px;border:1px solid #c8d6be;border-radius:6px;background:#edf3e5;color:#35502f}.flip-button[aria-pressed=true]{background:#d8e8c9}.editor{height:100dvh;display:flex;flex-direction:column;background:#f4f7f1}.editor header{min-height:70px;padding:14px 22px;background:white;border-bottom:1px solid #dde5d9;display:flex;align-items:center;gap:26px}.editor header a,.editor-actions,.editor-actions button{display:flex;align-items:center;gap:8px}.editor header a{font-size:14px;color:#74836c}.editor header strong{font-size:16px}.editor header strong span{font-size:11px;color:#8b9881;margin-left:8px}.editor-actions{margin-left:auto}.editor-actions button{padding:9px;border-radius:6px;font-size:12px}.editor-body{display:grid;grid-template-columns:220px minmax(0,1fr) 265px;flex:1;min-height:0}.editor aside{padding:20px;background:#fcfdfb;overflow:auto}.editor-objects{border-right:1px solid #dde5d9}.editor-inspector{border-left:1px solid #dde5d9}.editor label{display:block;font-size:12px;color:#718269;margin:14px 0 6px}.editor input,.editor select{width:100%;border:1px solid #dce5d6;border-radius:6px;background:white;padding:9px;font-size:13px;color:#3c5135}.editor label input,.editor label select{margin-top:6px}.list-title{display:flex;justify-content:space-between;align-items:center;margin:22px 0 13px}.list-title h2{font-size:14px}.list-title span{font-size:12px;color:#8b9980}.object-list{display:flex;flex-direction:column;gap:3px;max-height:49vh;overflow:auto}.object-list button{display:flex;justify-content:space-between;text-align:left;padding:10px 8px;border-radius:6px;font-size:12px;gap:8px}.object-list button.selected{background:#e5efda;color:#53703d}.object-list .map-item{border:1px solid #dce5d6;margin-bottom:8px;padding:12px 8px}.map-item strong{font-size:12px}.map-name{display:block;font-size:11px;margin-top:5px;overflow-wrap:anywhere}.object-list small{color:#86977b;white-space:nowrap}.editor-preview{margin:0;width:auto;position:relative;display:flex;flex-direction:column;min-width:0}.preview-heading{padding:24px;display:flex;align-items:center;justify-content:space-between;gap:15px}.preview-heading span{font-size:10px;letter-spacing:1.3px;color:#879780}.preview-heading h1{font-size:23px;margin-top:7px}.apply-map{display:flex;align-items:center;gap:7px;padding:11px 14px;background:#284333;color:#e4f5d1;border-radius:7px;white-space:nowrap;font-size:13px}.apply-map:hover{color:#284333}.editor-canvas{position:relative;flex:1;min-height:320px;background:#e9efe3}.editor-feedback{padding:17px 24px;font-size:13px;min-height:90px}.editor-feedback small{display:block;font-size:11px;margin-top:7px;color:#89977f}.editor-error{color:#a34736}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.editor .checkbox{display:flex;align-items:center;gap:8px}.editor .checkbox input{width:15px;margin:0}.asset-id{font-size:10px;color:#92a088;display:block;margin-top:6px}.delete-object{margin-top:22px;font-size:12px;display:flex;align-items:center;gap:8px;color:#a66754}.editor-inspector .list-title{margin-top:0}@media(max-width:1000px){.editor-body{grid-template-columns:175px minmax(0,1fr) 220px}.editor header strong span{display:none}.editor header{gap:14px}.editor-actions button span{display:none}.editor aside{padding:14px}}@media(max-width:700px){.editor{height:auto;min-height:100dvh}.editor header{flex-wrap:wrap;padding:14px}.editor header strong{font-size:14px}.editor-actions{margin-left:0}.editor-body{display:flex;flex-direction:column}.editor-preview{order:-1;min-height:450px}.editor-objects,.editor-inspector{border:0;border-top:1px solid #dce5d6}.object-list{max-height:200px}.editor-actions button span{display:inline}.editor header a{font-size:12px}}
</style>
