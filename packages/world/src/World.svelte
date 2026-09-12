<script lang="ts">
  import type { PixelArtPack } from './pixelart';
  import { onMount, untrack } from 'svelte';
  import type { WorldAdapter, WorldController, WorldEntity, WorldEditor } from './types';
  let { paused=false, exitIndicators={}, hiddenIds=[], revision=0, adapter, working = false, celebration = 0, editor, graphics, panMode=false, onready, onstatus }: {paused?:boolean;exitIndicators?:Record<string,import('./types').ExitIndicator>;hiddenIds?:string[];revision?:number; adapter: WorldAdapter; working?: boolean; celebration?: number; editor?: WorldEditor; graphics: PixelArtPack; panMode?: boolean; onready?: (controller: WorldController) => void; onstatus?: (message: string) => void} = $props();
  let host: HTMLDivElement;
  let engine: Awaited<ReturnType<typeof import('./renderer').createWorld>> | undefined = $state();
  let error = $state('');
  let ready = $state(false);
  async function interact(entity:WorldEntity) {
    if(!entity.interaction){if(entity.description)await adapter.interact({sceneId:adapter.scene.id,entityId:entity.id,action:'info.open',resourceId:entity.id});return;}
    try { await adapter.interact({sceneId:adapter.scene.id,entityId:entity.id,action:entity.interaction.action,resourceId:entity.interaction.resourceId}); }
    catch { onstatus?.('No se pudo abrir esta interacción. Inténtalo de nuevo.'); }
  }
  let mounted=$state(false),disposed=false,building=false,requested=0;
  async function rebuild(){
    if(building||disposed)return;
    building=true;
    try{
      while(!disposed){
        const version=requested,scene=adapter.scene,authoring=editor;
        const {createWorld}=await import('./renderer');
        if(disposed)break;
        const next=await createWorld(host,scene,interact,s=>onstatus?.(s),authoring,graphics,engine?.application);
        if(disposed||version!==requested){next.destroy(!!engine);continue;}
        engine?.destroy(true);
        engine=next;ready=true;error='';lastCelebration=celebration;
        next.setPaused(paused);next.setExitIndicators(exitIndicators);next.setHidden(hiddenIds);next.setEditor(editor);next.setPanMode(panMode);next.setWorking(working);
        next.renderFrame();onready?.(next);
        if(version===requested)break;
      }
    }catch(cause){console.error('World initialization failed',cause);if(!disposed)error='No se pudo actualizar el escenario. La vista anterior se conserva.';}
    finally{building=false;if(disposed)engine?.destroy();}
  }
  onMount(()=>{
    mounted=true;
    return ()=>{disposed=true;if(!building)engine?.destroy();};
  });
  $effect(()=>{if(mounted){revision;untrack(()=>{requested++;void rebuild();});}});
  $effect(()=>{engine?.setPaused(paused);});
  $effect(()=>{engine?.setWorking(working);});
  $effect(()=>{engine?.setExitIndicators(exitIndicators);});
  $effect(()=>{engine?.setHidden(hiddenIds);});
  $effect(()=>{engine?.setCompleted(adapter.scene.entities.filter(e=>e.completed).map(e=>e.id));});
  $effect(()=>{engine?.setEditor(editor);});
  $effect(()=>{engine?.setPanMode(panMode);});
  let lastCelebration=0;
  $effect(()=>{if(engine&&celebration>lastCelebration){lastCelebration=celebration;engine.celebrate();}});
</script>
<!-- Keyboard input is handled by the game engine; direct DOM actions are available in the host. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="world" bind:this={host} tabindex="0" role="application" aria-label={editor ? `${adapter.scene.name}. Editor: selecciona un objeto y arrástralo o usa las flechas para moverlo.` : `${adapter.scene.name}. Usa las flechas o WASD para moverte y Enter para interactuar. También hay accesos directos fuera del mapa.`}>
  {#if error}<p class="feedback" role="alert">{error}</p>{:else if !ready}<p class="feedback">Preparando tu espacio…</p>{/if}
</div>
<style>
.world{position:absolute;inset:0;outline:none;overflow:hidden}.world:focus-visible{outline:2px solid #577c35;outline-offset:-5px;border-radius:12px}.world :global(canvas){display:block}.feedback{position:absolute;inset:45% 20% auto;text-align:center;color:#48605b;font:14px system-ui}
</style>
