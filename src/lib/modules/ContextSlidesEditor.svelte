<script lang="ts">
 import {onMount} from 'svelte';
 import {beforeNavigate} from '$app/navigation';
 import {Save,Plus,Trash2,ArrowUp,ArrowDown,Play,X} from 'lucide-svelte';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import ModuleEditorHeader from '../components/ModuleEditorHeader.svelte';
 import MediaField from './MediaField.svelte';
 import ContextSlidesPlayer from './ContextSlidesPlayer.svelte';
 import {editableContextSlides,validateContext,MAX_CONTEXT_SLIDES} from './context-slides';
 import type {ContextModule,ContextSlide} from './types';
 let {module,title,onapply,onclose,ondirty}:{module:ContextModule;title:string;onapply:(module:ContextModule)=>void;onclose:()=>void;ondirty:(dirty:boolean)=>void}=$props();
 let heading=$state(''),slides=$state<ContextSlide[]>([]),index=$state(0),initial='',ready=$state(false),error=$state(''),discarding=$state(false),previewing=$state(false);
 let preview:HTMLDialogElement;
 const dirty=$derived(ready&&JSON.stringify({heading,slides})!==initial);
 const slide=$derived(slides[index]);
 onMount(()=>{heading=module.title;slides=editableContextSlides(module);initial=JSON.stringify({heading,slides});ready=true;});
 $effect(()=>ondirty(dirty));
 beforeNavigate(event=>{if(dirty&&!confirm(ui.text('¿Descartar los cambios de este contexto?')))event.cancel();});
 function leave(){if(dirty)discarding=true;else onclose();}
 function add(){if(slides.length>=MAX_CONTEXT_SLIDES)return;slides=[...slides,{id:crypto.randomUUID(),text:''}];index=slides.length-1;}
 function remove(){if(slides.length<=1)return;slides=slides.filter((_,i)=>i!==index);index=Math.min(index,slides.length-1);}
 function move(delta:number){const next=index+delta;if(next<0||next>=slides.length)return;const copy=[...slides];[copy[index],copy[next]]=[copy[next],copy[index]];slides=copy;index=next;}
 function apply(){try{const next:ContextModule={id:module.id,type:'context',title:heading.trim(),text:slides[0]?.text??'',slides:structuredClone($state.snapshot(slides))};validateContext(next);onapply(next);}catch(e){error=(e as Error).message;}}
 function openPreview(){previewing=true;preview.showModal();}
 function closePreview(){preview.close();previewing=false;}
 function keydown(event:KeyboardEvent){if(event.key==='Escape'&&!event.defaultPrevented&&!previewing){event.preventDefault();leave();}}
 function unload(event:BeforeUnloadEvent){if(dirty){event.preventDefault();event.returnValue='';}}
</script>
<svelte:window onkeydown={keydown} onbeforeunload={unload}/>
<section class="context-editor" aria-label={ui.text('Editor de contexto')}>
 <ModuleEditorHeader title={ui.text('Contexto')} context={title} onclose={leave}/>
 <div class="content">
  <label>{ui.text('Nombre del contexto')}<input aria-label={ui.text('Nombre del contexto')} bind:value={heading} maxlength="120"/></label>
  <div class="slides-toolbar"><strong>{ui.text('Diapositivas')} · {slides.length}</strong><button disabled={slides.length>=MAX_CONTEXT_SLIDES} onclick={add}><Plus size={15}/>{ui.text('Añadir diapositiva')}</button></div>
  <nav aria-label={ui.text('Diapositivas del contexto')}>{#each slides as entry,i}<button aria-pressed={index===i} onclick={()=>index=i} aria-label={ui.text('Editar diapositiva {arg0}',{arg0:i+1})}>{i+1}</button>{/each}</nav>
  {#if slide}
   <div class="slide-heading"><strong>{ui.text('Diapositiva {arg0}',{arg0:index+1})}</strong><div><button disabled={index===0} aria-label={ui.text('Mover diapositiva antes')} onclick={()=>move(-1)}><ArrowUp size={15}/></button><button disabled={index===slides.length-1} aria-label={ui.text('Mover diapositiva después')} onclick={()=>move(1)}><ArrowDown size={15}/></button><button disabled={slides.length<=1} aria-label={ui.text('Eliminar diapositiva')} onclick={remove}><Trash2 size={15}/></button></div></div>
   <MediaField label={ui.text('Imagen opcional')} value={slide.image??''} onchange={image=>slides=slides.map((s,i)=>i===index?{...s,image}:s)}/>
   {#if slide.image}<img class="image-preview" src={slide.image} alt=""/>{/if}
   <label>{ui.text('Título opcional')}<input aria-label={ui.text('Título de la diapositiva')} value={slide.title??''} maxlength="120" oninput={event=>slides=slides.map((s,i)=>i===index?{...s,title:event.currentTarget.value}:s)}/></label>
   <label>{ui.text('Texto')}<textarea aria-label={ui.text('Texto de la diapositiva')} value={slide.text} maxlength="12000" rows="9" placeholder={ui.text('Explica qué ocurre en este punto de la historia…')} oninput={event=>slides=slides.map((s,i)=>i===index?{...s,text:event.currentTarget.value}:s)}></textarea></label>
   <p class="hint">{ui.text('La imagen aparece arriba y el texto abajo. Completa el texto de cada diapositiva para activar el contexto.')}</p>
  {/if}
  {#if error}<p class="error" role="alert">{ui.text(error)}</p>{/if}
  {#if discarding}<div role="alert"><p>{ui.text('¿Descartar los cambios de este contexto?')}</p><button onclick={onclose}>{ui.text('Descartar')}</button><button onclick={()=>discarding=false}>{ui.text('Seguir editando')}</button></div>{/if}
 </div>
 <footer><button disabled={!ready||!slides.length} onclick={openPreview}><Play size={16}/>{ui.text('Probar presentación')}</button><button class="apply" disabled={!ready} onclick={apply}><Save size={17}/>{ui.text('Aplicar al borrador')}</button></footer>
</section>
<dialog class="preview" bind:this={preview} aria-label={ui.text('Vista previa del contexto')} oncancel={event=>{event.preventDefault();closePreview();}}><header><span>{ui.text('Vista previa del contexto')}</span><button aria-label={ui.text('Cerrar vista previa')} onclick={closePreview}><X size={20}/></button></header>{#if previewing}<ContextSlidesPlayer slides={$state.snapshot(slides)} onfinish={closePreview}/>{/if}</dialog>
<style>
 .context-editor{display:flex;flex-direction:column;height:100%;min-height:0;color:#35502f;font-size:12px}.content{flex:1;overflow:auto;padding:18px}label{display:block;margin-bottom:18px}input,textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:10px;border:1px solid #d5dfce;border-radius:7px;background:white;font:inherit;color:inherit}textarea{resize:vertical;min-height:160px}.slides-toolbar,.slide-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0 12px}.slide-heading div{display:flex;gap:4px}nav{display:flex;gap:6px;flex-wrap:wrap}nav button{min-width:34px;justify-content:center}nav button[aria-pressed=true]{background:#355d43;color:white}.image-preview{display:block;width:100%;max-height:180px;object-fit:contain;background:#e9eee3;margin-bottom:16px}.hint{font-size:11px;line-height:1.6;color:#73816b}footer{padding:14px;border-top:1px solid #dce5d6;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}button{display:inline-flex;align-items:center;gap:7px;padding:9px;border:1px solid #d5dfce;border-radius:7px;background:white;font:inherit;color:inherit;cursor:pointer}.apply{background:#dfeccd}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #789557;outline-offset:2px}.error{color:#a04d3a}.preview{position:fixed;inset:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;margin:0;padding:0;border:0;box-sizing:border-box;background:#17211e;color:white}.preview[open]{display:flex;flex-direction:column}.preview::backdrop{background:#17211e}.preview header{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;flex:none;font-size:12px}.preview header button{background:transparent;color:white;border-color:#607368}
</style>
