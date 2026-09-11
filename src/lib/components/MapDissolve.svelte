<script lang="ts">
 import {onDestroy} from 'svelte';
 let {image,ready,ondone}:{image:string|null;ready:boolean;ondone:()=>void}=$props();
 let fading=$state(false);
 let frame=0,timer:ReturnType<typeof setTimeout>|undefined;
 function cancel(){if(typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(frame);clearTimeout(timer);}
 $effect(()=>{
  cancel();fading=false;
  if(image&&!ready)timer=setTimeout(ondone,10000);
  if(image&&ready){
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{fading=true;timer=setTimeout(ondone,reduced?0:450);});});
  }
  return cancel;
 });
 onDestroy(cancel);
</script>
{#if image}<div class="dissolve" class:fading aria-hidden="true"><img src={image} alt="" onerror={ondone}/></div>{/if}
<style>
 .dissolve{position:absolute;inset:0;z-index:2;background:#e9efe3;opacity:1;transition:opacity 450ms ease-in-out;pointer-events:auto}.dissolve.fading{opacity:0}.dissolve img{display:block;width:100%;height:100%;object-fit:fill}@media(prefers-reduced-motion:reduce){.dissolve{transition:none}}
</style>
