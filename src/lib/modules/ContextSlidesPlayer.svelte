<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import type {ContextSlide} from './types';
 import {advanceContextSlide} from './context-slides';
 let {slides,onfinish}:{slides:ContextSlide[];onfinish:()=>boolean|void}=$props();
 let index=$state(0),finished=false,imageFailed=$state(false);
 const slide=$derived(slides[Math.min(index,slides.length-1)]);
 $effect(()=>{slide?.id;slide?.image;imageFailed=false;});
 function next(){if(finished||!slide)return;const result=advanceContextSlide(index,slides.length);if(result.completed){finished=onfinish()!==false;}else index=result.index;}
 function previous(){if(index>0)index--;}
 function keydown(event:KeyboardEvent){if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable=true]'))return;if(event.key==='ArrowRight'){event.preventDefault();next();}else if(event.key==='ArrowLeft'){event.preventDefault();previous();}}
</script>
<svelte:window onkeydown={keydown}/>
<section class="context-slides" aria-label={ui.text('Presentación de contexto')}>
 {#if slide}
  {#if slide.image}<div class="slide-image">{#if imageFailed}<p role="status">{ui.text('No se pudo cargar la imagen. Puedes continuar leyendo.')}</p>{:else}<img src={slide.image} alt={slide.title??''} onerror={()=>imageFailed=true}/>{/if}</div>{/if}
  {#key slide.id}<div class="slide-copy" aria-live="polite">{#if slide.title}<h2>{slide.title}</h2>{/if}<div class="slide-text">{#each slide.text.split(/\n\s*\n/) as paragraph}<p>{paragraph}</p>{/each}</div></div>{/key}
  <footer><span aria-label={ui.text('Diapositiva actual')}>{index+1} / {slides.length}</span><div><button disabled={index===0} onclick={previous}>{ui.text('Anterior')}</button><button class="next" onclick={next}>{index===slides.length-1?ui.text('Continuar'):ui.text('Siguiente')}</button></div></footer>
 {/if}
</section>
<style>
 .context-slides{display:flex;flex-direction:column;flex:1;min-height:0;width:100%;background:#17211e;color:#f4f3e9}.slide-image{flex:0 1 55%;min-height:100px;display:flex;justify-content:center;align-items:center;overflow:hidden;background:#0c1411}.slide-image img{display:block;width:100%;height:100%;object-fit:contain}.slide-image p{padding:20px;font-size:14px}.slide-copy{flex:1;min-height:0;overflow:auto;padding:clamp(20px,4vw,48px) max(24px,calc((100% - 1000px)/2));box-sizing:border-box}h2{margin:0 0 18px;font:600 clamp(24px,3vw,38px) system-ui}.slide-text{font-size:clamp(16px,1.5vw,20px);line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.slide-text p{margin:0 0 16px}footer{display:flex;align-items:center;justify-content:space-between;gap:16px;flex:none;padding:16px max(24px,calc((100% - 1000px)/2));border-top:1px solid #ffffff20;padding-bottom:max(16px,env(safe-area-inset-bottom))}footer span{font-size:13px;color:#c2d0c4}footer div{display:flex;gap:10px}button{padding:11px 20px;border:1px solid #869b8b;border-radius:8px;background:transparent;color:inherit;font:14px system-ui;cursor:pointer}.next{background:#e6edd9;color:#23392b;border-color:#e6edd9}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:3px solid #ccda9e;outline-offset:3px}@media(max-height:500px){.slide-image{flex-basis:40%}.slide-copy{padding:14px 24px}footer{padding:10px 24px}}@media(max-width:500px){button{padding:10px 14px}.slide-image{flex-basis:45%}}
</style>
