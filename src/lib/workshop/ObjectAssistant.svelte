<script lang="ts">
 import {onDestroy,untrack} from 'svelte';
 import type {AdventurePalette} from '$lib/demo/adventure-palette';
 import {Sparkles,LoaderCircle} from 'lucide-svelte';
 import {validateObjectImageRequest,type ObjectImageRequest} from './object-generation';
 import {objectReference,finishObjectImage,type PreparedObjectImage} from './object-image-browser';
 let {palette,width,height,footprint,references,onreference,onpreview,onaccept,onbusy,open=$bindable(false),embedded=false}:{open?:boolean;embedded?:boolean;palette?:AdventurePalette;width:number;height:number;footprint:{x:number;y:number};references:{id:string;name:string}[];onreference:(id:string)=>Promise<string>;onpreview:(image:string|null)=>void;onaccept:(image:PreparedObjectImage)=>Promise<void>;onbusy:(value:boolean)=>void}=$props();
 let description=$state(''),style=$state('Pixel art, formas limpias, paleta terrosa limitada, iluminación suave desde arriba a la izquierda'),direction=$state<ObjectImageRequest['direction']>('se');
 let quality=$state<'low'|'medium'|'high'>('low'),referenceId=$state(''),uploaded=$state(''),referenceName=$state('');
 let available=$state(false),checked=$state(false),connection=$state(''),working=$state(''),error=$state('');
 let useAdventurePalette=$state(true);
 let background=$state<'magenta'|'green'|'alpha'>('magenta'),tolerance=$state(90),colors=$state(28);
 let raw=$state(''),prepared=$state.raw<PreparedObjectImage>(),sourceDescription=$state(''),controller:AbortController|undefined,alive=true;
 const dimensions=$derived(`${width}:${height}:${footprint.x}:${footprint.y}`);
 $effect(()=>{dimensions; untrack(()=>{raw='';prepared=undefined;onpreview(null);});});
 onDestroy(()=>{alive=false;controller?.abort();onpreview(null);});
 async function connectionStatus(){
  try {const response=await fetch('/api/characters/objects');if(!response.ok)throw Error(response.status===401?'Accede al taller privado de personajes y vuelve a comprobar la conexión.':'No se pudo comprobar la conexión.');const status=await response.json();if(alive){available=!!status.available;connection=status.message;checked=true;}}
  catch(e){if(alive){available=false;checked=true;connection=(e as Error).message;}}
 }
 async function run(label:string,task:()=>Promise<void>){if(working)return;working=label;error='';onbusy(true);try{await task();}catch(e){if(alive)error=(e as Error).message;}finally{if(alive){working='';onbusy(false);}}}
 async function upload(event:Event){const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;await run('Preparando referencia…',async()=>{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20_000_000)throw Error('Usa PNG, JPG o WebP de hasta 20 MB.');const image=await objectReference(file);if(alive){uploaded=image;referenceName=file.name;referenceId='upload';}});}
 async function finish(image=raw){const result=await finishObjectImage(image,width,height,{background,tolerance,colors,palette:useAdventurePalette?palette:undefined});if(alive){prepared=result;onpreview(result.image);}}
 async function generate(){await run('Generando objeto…',async()=>{
   const reference=referenceId==='upload'?uploaded:referenceId?await onreference(referenceId):undefined;
   const request:ObjectImageRequest={description,style,direction,width,height,footprint:{...footprint},quality,reference:reference||undefined,palette:useAdventurePalette?palette:undefined};validateObjectImageRequest(request);
   controller=new AbortController();const response=await fetch('/api/characters/objects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal});
   if(!response.ok){let message='No se pudo generar el objeto. No se reintenta automáticamente.';try{message=(await response.json()).error??message;}catch{}throw Error(message);}
   const result=await response.json();if(!alive)return;raw=result.image;prepared=undefined;onpreview(null);sourceDescription=description;await finish();
 });}
 async function accept(){if(prepared)await run('Aplicando propuesta…',async()=>{await onaccept(prepared!);if(alive){raw='';prepared=undefined;onpreview(null);}});}
 export async function acceptProposal(){await accept();}
 export function discardProposal(){if(working)return;raw='';prepared=undefined;onpreview(null);}
</script>
<details class:embedded class="assistant" bind:open ontoggle={e=>{if(e.currentTarget.open&&!checked)void connectionStatus();}}>
 <summary><Sparkles size={15}/> Generar con IA</summary>
 {#if palette}<p class="size">Paleta de aventura: {palette.name} · 64 colores.</p>{/if}
 <p class="size">Salida {width} × {height} px · huella {footprint.x} × {footprint.y}. Ajusta estos valores en las propiedades antes de generar.</p>
 <fieldset disabled={!!working}>
 <label>Descripción del objeto<textarea rows="3" maxlength="2000" bind:value={description} placeholder="Cofre de madera con herrajes oscuros…"></textarea></label>
 <label>Referencia de estilo<select bind:value={referenceId}><option value="">Sin referencia</option>{#each references as ref}<option value={ref.id}>{ref.name}</option>{/each}{#if uploaded}<option value="upload">{referenceName}</option>{/if}</select></label>
 <label class="upload">Importar referencia<input type="file" accept="image/png,image/jpeg,image/webp" onchange={upload}/></label>
 {#if referenceId==='upload'&&uploaded}<img class="reference" src={uploaded} alt="Referencia de estilo del objeto"/>{/if}
 <details><summary>Estilo y orientación</summary><label>Estilo<textarea rows="2" maxlength="1000" bind:value={style}></textarea></label><label>Orientación<select bind:value={direction}><option value="se">SE · frente y derecha</option><option value="sw">SW · frente e izquierda</option><option value="ne">NE · detrás y derecha</option><option value="nw">NW · detrás e izquierda</option></select></label><label>Calidad<select bind:value={quality}><option value="low">Borrador</option><option value="medium">Media</option><option value="high">Alta</option></select></label></details>
 {#if !available}<p>{connection||'Comprobando conexión…'}</p>{#if checked}<button type="button" onclick={connectionStatus}>Comprobar conexión</button><a href="/characters" target="_blank" rel="noreferrer">Acceder al taller privado</a>{/if}{/if}
 <p>Cada generación consume uso de OpenAI. Si eliges una referencia, también se enviará al proveedor.</p>
 <button class="primary" type="button" disabled={!available||!description.trim()} onclick={generate}>{#if working}<LoaderCircle class="spinner" size={16}/>{working}{:else}<Sparkles size={16}/>{raw?'Generar otra propuesta':'Generar objeto'}{/if}</button>
 {#if raw}
 <div class="proposal"><strong>Propuesta · {sourceDescription}</strong><p>La vista central muestra la propuesta. El objeto se sustituye al pulsar «Usar esta imagen».</p>
 <details open><summary>Acabado · sin volver a generar</summary><label>Fondo<select bind:value={background}><option value="magenta">Magenta</option><option value="green">Verde</option><option value="alpha">Transparencia existente</option></select></label><label>Tolerancia · {tolerance}<input type="range" min="0" max="255" bind:value={tolerance}/></label>{#if palette}<label><span><input type="checkbox" bind:checked={useAdventurePalette}/> Usar {palette.name} · 64 colores</span></label>{/if}{#if !palette||!useAdventurePalette}<label>Colores<input type="number" min="4" max="64" bind:value={colors}/></label>{/if}<button type="button" onclick={()=>run('Actualizando acabado…',()=>finish())}>Actualizar acabado</button></details>
 <div class="actions"><button type="button" class="primary" disabled={!prepared} onclick={accept}>Usar esta imagen</button><button type="button" onclick={discardProposal}>Descartar propuesta</button></div></div>
 {/if}
 </fieldset>
 {#if working}<p role="status">{working} Puede tardar unos minutos.</p>{/if}
 {#if error}<p role="alert" class="error">{error}</p>{/if}
</details>
<style>
 .assistant.embedded{border:0;padding:0;margin:0;background:transparent}.assistant.embedded>summary{display:none}
 .assistant{margin:10px 0 18px;border:1px solid #cbd8bf;border-radius:8px;padding:12px;background:#f5f8ee}summary{cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}details[open]>summary{margin-bottom:12px}fieldset{border:0;margin:0;padding:0;min-width:0}label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:11px}textarea,select,input[type=number]{box-sizing:border-box;width:100%;min-width:0;padding:8px;font:inherit;border:1px solid #cbd8bf;border-radius:5px;background:white;color:#304535}textarea{resize:vertical}p{font-size:11px;line-height:1.5;color:#627354;overflow-wrap:anywhere}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:11px;cursor:pointer;padding:9px;border:1px solid #cbd8bf;border-radius:6px;background:#fff;color:#304535;max-width:100%}.primary{background:#476238;color:white}.primary:disabled{opacity:.5;cursor:default}.upload{cursor:pointer;text-decoration:underline}.upload input{max-width:100%;font-size:10px}.reference{max-width:100%;max-height:90px;object-fit:contain}.proposal{border-top:1px solid #cbd8bf;margin-top:14px;padding-top:12px}.proposal strong{font-size:12px;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.error{color:#963f31}.size{font-size:10px}a{font-size:11px;color:#476238;display:block;margin-top:8px}:global(.spinner){animation:object-spin 1s linear infinite}@keyframes object-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){:global(.spinner){animation:none}}
</style>
