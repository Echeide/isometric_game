<script lang="ts">
 import {onMount} from 'svelte';
 import type {WorldController} from '@isometrico/world';
 let {controller,description,action,onaction,onclose}:{controller?:WorldController;description:string;action?:string;onaction:()=>void;onclose:()=>void}=$props();
 let bubble:HTMLDivElement;
 onMount(()=>{
  let frame=0;
  function place(){const p=controller?.getPlayerAnchor();if(p&&bubble){const x=Math.max(bubble.offsetWidth/2+12,Math.min(innerWidth-bubble.offsetWidth/2-12,p.x));const y=Math.max(bubble.offsetHeight+12,p.y-12);bubble.style.left=`${x}px`;bubble.style.top=`${y}px`;}frame=requestAnimationFrame(place);}
  place();
  const outside=(e:PointerEvent)=>{if(!bubble.contains(e.target as Node))onclose();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onclose();};
  window.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);};
 });
</script>
<div bind:this={bubble} class="info-bubble" class:with-action={!!action} role="region" aria-label="Información del personaje">
 <p class:hint={description==='Selecciona la acción para continuar.'}>{description}</p>
 {#if action}<div class="action-area"><button class="action" onclick={onaction}>{action}</button></div>{/if}
</div>
<style>
.info-bubble{position:fixed;left:50%;top:50%;transform:translate(-50%,-100%);z-index:8;width:max-content;max-width:min(240px,calc(100vw - 32px));padding:0;text-align:center;background:white;border-radius:10px;box-shadow:0 3px 12px #20382d1a;color:#304839}.info-bubble::after{content:'';position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);border-left:11px solid transparent;border-right:11px solid transparent;border-top:11px solid white}.info-bubble p{padding:0;font-size:12px;font-weight:600;line-height:1.4;margin:10px 14px;max-height:25vh;overflow:auto}.info-bubble p.hint{font-weight:400;color:#7b887f;font-size:11px}.info-bubble.with-action{min-width:190px}.action-area{margin:0 12px;padding:9px 0 10px;border-top:1px solid #e9eee5}.action{display:block;width:100%;min-height:40px;padding:8px 14px;border-radius:7px;background:#e8efde;color:#35502f;font-size:12px;font-weight:600}.action:hover{background:#dce8cf}.action:focus-visible{outline:2px solid #577c35;outline-offset:2px}
</style>
