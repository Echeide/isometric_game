<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte';
 import {Palette,LoaderCircle,Trash2,X,RotateCcw,Pipette} from 'lucide-svelte';
 import type {ActorPose,CharacterPack} from '@isometrico/world';
 import type {AdventurePalette} from '$lib/demo/adventure-palette';
 import type {Frame} from '../../../packages/character-generator/src/types';
 import ResourceStage from '$lib/components/ResourceStage.svelte';
 import {resourceImages,type PaletteResource} from './palette';
 import {collectSpriteColors,validateColorReplacements,colorVariantResource,type ColorReplacement,type SpriteColor} from './color-variant';
 import {decodePaletteImage,replacedColorsPNG} from './palette-browser';
 import {cycleActions,cycleDirections} from './image-edit';
 import {actionLabels} from './resources';

 let {resource,name,palette,size,tileFrame,reference,floorImage,resolve,load,onaccept,onclose,initialPose='idle',initialDirection=1}:{
  resource:PaletteResource;name:string;palette:AdventurePalette;size:{x:number;y:number};tileFrame:[number,number,number,number];reference:CharacterPack;floorImage:string;
  resolve:(url:string)=>string;load:(url:string)=>Promise<Blob>;onaccept:(name:string,blobs:Record<string,Blob>)=>Promise<void>;onclose:()=>void;initialPose?:ActorPose;initialDirection?:number;
 }=$props();
 let dialog:HTMLDialogElement;
 let draftName=$state(untrack(()=>`${name.slice(0,105)} · variante`)),colors=$state.raw<SpriteColor[]>([]),replacements=$state<ColorReplacement[]>([]);
 let selectedColor=$state(''),search=$state(''),preparing=$state(true),updating=$state(false),applying=$state(false),error=$state(''),completed=$state(0);
 let preview=$state.raw<PaletteResource>(),pose=$state<ActorPose>(untrack(()=>initialPose)),direction=$state(untrack(()=>initialDirection)),playing=$state(true);
 let picking=$state(false),pickMessage=$state('');
 const frames=new Map<string,Frame>(),urls=new Map<string,string>();let blobs:Record<string,Blob>={},alive=true,revision=0;
 const lifetime=new AbortController();let previewAbort:AbortController|undefined;
 const sources=$derived(resourceImages(resource));
 const actions=$derived(resource.kind==='player'||resource.kind==='npc'?cycleActions(resource.kind,resource.character,resource.item):[]);
 const directions=$derived(resource.kind==='player'||resource.kind==='npc'?cycleDirections(resource.kind,resource.character,resource.item,pose):[]);
 const matching=$derived(colors.filter(c=>c.color.includes(search.trim().toLowerCase().replace(/^#/,''))));
 const visibleColors=$derived(matching.slice(0,256));
 const changes=$derived(replacements.filter(r=>r.from!==r.to));
 const canApply=$derived(!preparing&&!updating&&!applying&&!!preview&&changes.length>0&&!!draftName.trim()&&draftName.length<=120);
 function clean(){urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();}
 function close(){if(!applying)onclose();}
 onDestroy(()=>{alive=false;revision++;lifetime.abort();previewAbort?.abort();clean();frames.clear();});
 onMount(()=>{dialog.showModal();playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;void prepare();});
 async function prepare(){
  try{
   let pixels=0;
   for(const source of sources){const frame=await decodePaletteImage(await load(source));if(!alive)return;
    pixels+=frame.width*frame.height;if(pixels>32_000_000)throw Error('El recurso es demasiado grande para comparar todas las hojas a la vez.');
    frames.set(source,frame);completed++;
   }
   colors=collectSpriteColors(frames.values());preview=resource;
   if(actions.length&&!actions.includes(pose))pose=actions[0];
  }catch(e){if(alive)error=(e as Error).message;}finally{if(alive)preparing=false;}
 }
 function chooseDestination(to:string){
  if(!selectedColor)return;
  try{const next=[...replacements.filter(r=>r.from!==selectedColor),{from:selectedColor,to}];replacements=validateColorReplacements(next,palette);void updatePreview();}
  catch(e){error=(e as Error).message;}
 }
 function remove(from:string){replacements=replacements.filter(r=>r.from!==from);void updatePreview();}
 function reset(){replacements=[];selectedColor='';void updatePreview();}
 function pickColor(event:PointerEvent){
  if(!picking||applying||event.button!==0||!(event.target instanceof HTMLCanvasElement))return;
  const canvas=event.target,rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*canvas.width/rect.width),y=Math.floor((event.clientY-rect.top)*canvas.height/rect.height);
  const pixel=canvas.getContext('2d')?.getImageData(x,y,1,1).data;if(!pixel)return;
  const color='#'+[pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(colors.some(entry=>entry.color===color)){selectedColor=color;pickMessage='';picking=false;}else pickMessage='Haz clic en un color del recurso, dentro de la vista Original.';
 }
 async function updatePreview(){
  previewAbort?.abort();const controller=new AbortController();previewAbort=controller;const current=++revision;
  updating=true;error='';const nextUrls=new Map<string,string>(),nextBlobs:Record<string,Blob>={};
  try{
   const mapping=validateColorReplacements(replacements,palette).filter(r=>r.from!==r.to);
   if(!mapping.length){if(alive&&revision===current){clean();blobs={};preview=resource;}return;}
   for(const [source,frame] of frames){
    const blob=await replacedColorsPNG(frame,mapping,controller.signal);if(!alive||revision!==current)return;
    nextBlobs[source]=blob;nextUrls.set(source,URL.createObjectURL(blob));
   }
   if(!alive||revision!==current)return;
   const next=colorVariantResource(resource,Object.fromEntries(nextUrls));clean();nextUrls.forEach((url,source)=>urls.set(source,url));nextUrls.clear();blobs=nextBlobs;preview=next;
  }catch(e){if(alive&&revision===current&&!controller.signal.aborted){preview=undefined;error=(e as Error).message;}}
  finally{nextUrls.forEach(url=>URL.revokeObjectURL(url));if(alive&&revision===current)updating=false;}
 }
 async function accept(){
  if(!canApply)return;applying=true;error='';
  try{await onaccept(draftName.trim(),blobs);if(alive){applying=false;onclose();}}
  catch(e){if(alive)error=(e as Error).message;}finally{if(alive)applying=false;}
 }
</script>

<dialog bind:this={dialog} aria-labelledby="color-variant-title" oncancel={e=>{e.preventDefault();close();}}>
 <header><div><h2 id="color-variant-title">Variante de color · {name}</h2><p>{sources.length} {sources.length===1?'hoja':'hojas'} · todos los fotogramas y direcciones</p></div><button class="icon" aria-label="Cerrar variante de color" disabled={applying} onclick={close}><X size={18}/></button></header>
 {#if preparing}<p class="loading" role="status"><LoaderCircle class="spin" size={20}/> Leyendo colores · {completed} / {sources.length} hojas</p>
 {:else if colors.length}
 <div class="layout">
  <section class="mapping" aria-label="Sustituciones de color">
   <label>Nombre de la variante<input aria-label="Nombre de la variante" maxlength="120" bind:value={draftName} disabled={applying}/></label>
   <fieldset disabled={applying}>
    <legend>1. Elige un color del recurso</legend>
    <button class="eyedropper" aria-pressed={picking} onclick={()=>{picking=!picking;pickMessage='';}}><Pipette size={14}/> {picking?'Haz clic en Original':'Cuentagotas'}</button>
    {#if pickMessage}<p class="hint" role="status">{pickMessage}</p>{/if}
    <input class="search" aria-label="Buscar color de origen" placeholder="Buscar por HEX…" bind:value={search}/>
    <div class="swatches" aria-label="Colores de origen">{#each visibleColors as entry}<button class:chosen={selectedColor===entry.color} style:background={entry.color} aria-label={`Seleccionar ${entry.color}`} aria-pressed={selectedColor===entry.color} title={`${entry.color} · ${entry.pixels} píxeles`} onclick={()=>selectedColor=entry.color}></button>{/each}</div>
    <small>{matching.length>256?`256 de ${matching.length} colores · busca por HEX para ver el resto`:`${matching.length} colores`}</small>
   </fieldset>
   <fieldset disabled={applying||!selectedColor}>
    <legend>2. Sustituir {selectedColor||'por un color de la paleta'}</legend>
    <div class="swatches" aria-label="Colores de destino">{#each palette.colors as color}<button style:background={color} aria-label={`Usar ${color}`} title={color} onclick={()=>chooseDestination(color)}></button>{/each}</div>
    <small><Palette size={13}/> {palette.name}</small>
   </fieldset>
   <div class="mapping-heading"><h3>Cambios <span>{changes.length}</span></h3><button class="icon" aria-label="Restablecer cambios de color" disabled={applying||!replacements.length} onclick={reset}><RotateCcw size={15}/></button></div>
   <div class="replacements">{#each replacements as replacement}<div class="replacement"><span class="sample" style:background={replacement.from}></span><code>{replacement.from}</code><span>→</span><span class="sample" style:background={replacement.to}></span><code>{replacement.to}</code><button class="icon" disabled={applying} aria-label={`Eliminar sustitución ${replacement.from}`} onclick={()=>remove(replacement.from)}><Trash2 size={14}/></button></div>{:else}<p class="hint">Puedes cambiar varios tonos de sombra, base y luz.</p>{/each}</div>
   <p class="hint">El mismo color cambia en todo el recurso, aunque aparezca en partes distintas.</p>{#if colors.length>256}<p class="hint">Para cambiar gamas con muchos tonos similares, adapta primero el recurso a la paleta desde Piskel.</p>{/if}
  </section>
  <section class="comparison" aria-label="Comparación de colores">
   <div class="controls">{#if actions.length}<label>Acción<select aria-label="Acción de variante" bind:value={pose} disabled={applying}>{#each actions as action}<option value={action}>{actionLabels[action]}</option>{/each}</select></label>{/if}{#if directions.length}<label>Dirección<select aria-label="Dirección de variante" bind:value={direction} disabled={applying}>{#each directions as facing,i}<option value={i}>{facing.toUpperCase()}</option>{/each}</select></label>{/if}{#if actions.length}<label class="play"><input type="checkbox" bind:checked={playing}/> Reproducir</label>{/if}<span class="progress" role="status">{#if updating}<LoaderCircle size={14} class="spin"/> Actualizando…{/if}</span></div>
   <div class="compare"><div class:picking role="group" aria-label="Original · cuentagotas" onpointerdown={pickColor}><h3>Original</h3><ResourceStage kind={resource.kind} item={resource.item} character={resource.character} tileImage={resource.tileImage} {tileFrame} {size} {reference} {floorImage} {resolve} {pose} {direction} {playing}/></div><div><h3>Variante</h3>{#if preview}<ResourceStage kind={preview.kind} item={preview.item} character={preview.character} tileImage={preview.tileImage} {tileFrame} {size} {reference} {floorImage} {resolve} {pose} {direction} {playing}/>{/if}</div></div>
  </section>
 </div>
 {:else if !error}<p>No hay colores visibles en este recurso.</p>{/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 <footer><small>Se crea una copia. Después pulsa «Guardar en aventura».</small><button disabled={applying} onclick={close}>Cancelar</button><button class="primary" disabled={!canApply} onclick={accept}>{#if applying}<LoaderCircle class="spin" size={16}/>{/if}{applying?'Creando…':'Crear variante'}</button></footer>
</dialog>

<style>
 dialog{box-sizing:border-box;width:min(1260px,calc(100% - 32px));max-height:92vh;overflow:auto;padding:20px;border:1px solid #cbd8bf;border-radius:14px;color:#304535;background:#fafbf7}dialog::backdrop{background:#16231780}header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}h2{font-size:20px;margin:0 0 6px;overflow-wrap:anywhere}header p{margin:0;font-size:12px;color:#627354}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px}.mapping,.comparison,.compare>div{min-width:0}label{display:grid;gap:6px;font-size:12px;margin-bottom:14px}input,select{box-sizing:border-box;width:100%;font:inherit;border:1px solid #cbd8bf;border-radius:6px;padding:8px;background:white;color:inherit;min-width:0}fieldset{padding:0;margin:0 0 14px;border:0;min-width:0}legend{font-size:12px;font-weight:600;margin-bottom:8px}.search{font-size:11px;margin-bottom:8px}.swatches{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px;max-height:200px;overflow:auto;padding:3px}.swatches button{padding:0;aspect-ratio:1;min-width:0;border:1px solid #84917860;border-radius:4px}.swatches .chosen{outline:2px solid #304535;outline-offset:1px}small{display:flex;align-items:center;gap:5px;font-size:11px;line-height:1.5;color:#627354;margin-top:5px}.eyedropper{margin-bottom:8px;font-size:11px}.eyedropper[aria-pressed=true]{background:#e5edda}.picking :global(canvas){cursor:crosshair!important}.mapping-heading{display:flex;align-items:center;justify-content:space-between}h3{font-size:12px;margin:8px 0}h3 span{font-weight:400;color:#627354}.replacements{max-height:180px;overflow:auto}.replacement{display:flex;align-items:center;gap:6px;padding:5px 0}.sample{width:18px;height:18px;border:1px solid #84917860;border-radius:3px;flex-shrink:0}code{font-size:10px}.replacement .icon{margin-left:auto}.hint{font-size:11px;line-height:1.5;color:#627354}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:50px}.controls label{margin:0}.controls select{padding:6px}.play{display:flex;align-items:center;gap:6px}.play input{width:auto;accent-color:#476238}.progress{display:flex;gap:5px;align-items:center;font-size:11px;color:#627354}.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;border:1px solid #cbd8bf;border-radius:7px;background:white;color:#3f5634;font:12px system-ui;cursor:pointer}button:disabled{opacity:.45;cursor:default}.icon{padding:6px;background:transparent}.primary{background:#476238;color:white}footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:18px;border-top:1px solid #dce3d5;padding-top:14px}footer small{margin-right:auto}.error{font-size:12px;color:#963f31;background:#fbeae3;padding:12px;border-radius:7px}.loading{display:flex;align-items:center;gap:8px;min-height:100px;font-size:13px}.loading :global(.spin),.progress :global(.spin),footer :global(.spin){animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:3px}@media(max-width:1050px){.layout{grid-template-columns:260px minmax(0,1fr)}.compare :global(.legend){display:none}}@media(max-width:650px){dialog{padding:14px;width:calc(100% - 20px)}.layout{display:flex;flex-direction:column;gap:12px}.comparison{order:-1}.compare{grid-template-columns:1fr 1fr}.compare :global(.legend){display:none}.swatches{grid-template-columns:repeat(8,minmax(0,1fr))}footer{flex-wrap:wrap}footer small{width:100%}h2{font-size:17px}}@media(prefers-reduced-motion:reduce){.loading :global(.spin),.progress :global(.spin),footer :global(.spin){animation:none}}
</style>
