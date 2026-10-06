<script lang="ts">
 import {onDestroy} from 'svelte';
 import {Palette,LoaderCircle,RotateCcw} from 'lucide-svelte';
 import {actorPoses,type ActorPose,type CharacterPack} from '@isometrico/world';
 import type {AdventurePalette} from '$lib/demo/adventure-palette';
 import ResourceStage from '$lib/components/ResourceStage.svelte';
 import {mapResourceImages,resourceImages,visibleColors,type PaletteResource} from './palette';
 import {decodePaletteImage,adaptedPNG} from './palette-browser';
 import {actionLabels} from './resources';
 let {palette,resource,originals,disabled=false,size,tileFrame,reference,floorImage,resolve,load,onaccept,onrestore,onopen}:{palette?:AdventurePalette;resource:PaletteResource;originals:Record<string,string>;disabled?:boolean;size:{x:number;y:number};tileFrame:[number,number,number,number];reference:CharacterPack;floorImage:string;resolve:(url:string)=>string;load:(url:string)=>Promise<Blob>;onaccept:(blobs:Record<string,Blob>)=>Promise<void>;onrestore:()=>void;onopen:(open:boolean)=>void}=$props();
 let dialog:HTMLDialogElement,working=$state(false),error=$state(''),ready=$state(false),before=$state(0),after=$state(0),count=$state(0),completed=$state(0);
 let preview=$state.raw<PaletteResource>(),pose=$state<ActorPose>('idle'),direction=$state(1),playing=$state(true);
 const blobs:Record<string,Blob>={},urls=new Map<string,string>();let alive=true;const controller=new AbortController();
 const canRestore=$derived(resourceImages(resource).some(u=>!!originals[u]));
 function clean(){urls.forEach(u=>URL.revokeObjectURL(u));urls.clear();for(const key of Object.keys(blobs))delete blobs[key];preview=undefined;ready=false;}
 function close(){if(working)return;dialog.close();clean();onopen(false);}
 onDestroy(()=>{alive=false;controller.abort();clean();onopen(false);});
 async function prepare(){
  if(!palette||working)return;clean();error='';pose='idle';direction=1;completed=0;working=true;dialog.showModal();onopen(true);
  try{const colorsBefore=new Set<number>(),colorsAfter=new Set<number>();const sources=resourceImages(resource);count=sources.length;
   for(const url of sources){
    // Repeated adaptations always start from the retained original, avoiding cumulative loss.
    const frame=await decodePaletteImage(await load(originals[url]??url));if(!alive)return;
    const adapted=await adaptedPNG(frame,palette,controller.signal),current=originals[url]?await decodePaletteImage(await load(url)):frame;if(!alive)return;
    visibleColors(current).forEach(c=>colorsBefore.add(c));visibleColors(adapted.frame).forEach(c=>colorsAfter.add(c));blobs[url]=adapted.blob;urls.set(url,URL.createObjectURL(adapted.blob));
    completed++;
   }
   if(alive){preview=mapResourceImages(resource,u=>urls.get(u)??u);before=colorsBefore.size;after=colorsAfter.size;ready=true;}
  }catch(e){if(alive)error=(e as Error).message;}finally{if(alive)working=false;}
 }
 async function accept(){working=true;error='';try{await onaccept(blobs);working=false;close();}catch(e){error=(e as Error).message;}finally{working=false;}}
</script>
<div class="palette-actions"><button disabled={disabled||!palette||!resourceImages(resource).length} title={palette?'Comparar antes de aplicar':'Define primero la paleta de aventura'} onclick={prepare}><Palette size={15}/> Adaptar a la paleta</button>{#if canRestore}<button disabled={disabled} onclick={onrestore}><RotateCcw size={15}/> Recuperar colores originales</button>{/if}{#if !palette}<small>Define la paleta arriba para adaptar este recurso.</small>{/if}</div>
<dialog bind:this={dialog} oncancel={e=>{e.preventDefault();close();}} aria-labelledby="adapt-title">
 <header><h2 id="adapt-title">Adaptar a {palette?.name}</h2><p>{working&&!ready?`Preparando ${completed} / ${count} PNG…`:`${count} PNG · ${before} → ${after} colores visibles · sin cambiar tamaño ni animaciones`}</p></header>
 {#if working&&!ready}<p class="loading" role="status"><LoaderCircle size={20}/> Preparando comparación…</p>{/if}
 {#if ready&&preview}
 <div class="compare"><section><h3>Actual</h3><ResourceStage kind={resource.kind} item={resource.item} character={resource.character} tileImage={resource.tileImage} {tileFrame} {size} {reference} {floorImage} {resolve} {pose} {direction} {playing}/></section><section><h3>Adaptado</h3><ResourceStage kind={preview.kind} item={preview.item} character={preview.character} tileImage={preview.tileImage} {tileFrame} {size} {reference} {floorImage} {resolve} {pose} {direction} {playing}/></section></div>
 <div class="controls">{#if resource.kind==='player'||resource.kind==='npc'}<label>Acción<select bind:value={pose}>{#each resource.kind==='player'?actorPoses:['idle','talk'] as p}<option value={p}>{actionLabels[p as ActorPose]}</option>{/each}</select></label><label><input type="checkbox" bind:checked={playing}/> Reproducir</label>{/if}{#if resource.kind==='player'}<label>Vista<select bind:value={direction}><option value={0}>NE</option><option value={1}>SE</option><option value={2}>SW</option><option value={3}>NW</option></select></label>{/if}</div>
 <p>Se adaptan todas las hojas del recurso con la misma paleta. Los originales se conservan. Después pulsa «Guardar en aventura».</p>
 {/if}
 {#if error}<p role="alert" class="error">{error}</p>{/if}
 <footer><button disabled={working} onclick={close}>Cancelar</button><button class="primary" disabled={working||!ready} onclick={accept}>{working?(ready?'Aplicando…':'Preparando…'):'Usar adaptación'}</button></footer>
</dialog>
<style>
 .palette-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:14px 0}.palette-actions small{font:11px system-ui;color:#68795c}button{display:inline-flex;align-items:center;gap:6px;font:12px system-ui;padding:10px 12px;border:1px solid #cbd8bf;border-radius:7px;background:white;color:#3f5634;cursor:pointer}button:disabled{opacity:.5;cursor:default}dialog{width:min(1100px,calc(100% - 52px));max-height:88vh;overflow:auto;padding:24px;border:1px solid #cbd8bf;border-radius:16px;color:#304535;background:#fafbf7}dialog::backdrop{background:#16231780}h2{font-size:20px;margin:0 0 10px}p{font:12px/1.6 system-ui;color:#627354}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px;min-width:0}.compare section{min-width:0}h3{font:600 13px system-ui}.controls{display:flex;gap:12px;align-items:center;margin:16px 0;font:12px system-ui}.controls label{display:flex;gap:6px;align-items:center}select{font:inherit;padding:6px;border:1px solid #cbd8bf;border-radius:5px}footer{display:flex;justify-content:flex-end;gap:10px}.primary{background:#476238;color:white}.error{color:#963f31}.loading{display:flex;gap:10px;align-items:center;min-height:120px}@media(max-width:700px){.compare{grid-template-columns:1fr}dialog{padding:16px}.controls{flex-wrap:wrap}}
</style>
