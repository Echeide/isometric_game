<script lang="ts">
  import WorkshopIcon from './WorkshopIcon.svelte';
  import { onMount } from 'svelte';
  import type { Sheet, GeneratorSettings, Direction } from './types';
  let { sheet, url, settings, onlyDirection }: { sheet: Sheet; url: string; settings: GeneratorSettings; onlyDirection?: Direction } = $props();
  let playing = $state(false), elapsed = $state(0), frame = $state(0), speed = $state(1);
  const visibleDirections = $derived(onlyDirection ? sheet.directions.filter(d=>d===onlyDirection) : sheet.directions);
  const fps = $derived(sheet.loops[visibleDirections[0] ?? sheet.directions[0]]!.fps);
  const frameAt = (time:number, rate:number) => sheet.playback === 'once' ? Math.min(sheet.frames-1,Math.floor(time*rate)) : Math.floor(time*rate)%sheet.frames;
  const currentFrame = $derived(playing ? frameAt(elapsed,fps) : frame);
  function seek(index: number) { playing = false; frame = index; elapsed = index / fps; }
  function toggle() {
    if (playing) seek(currentFrame);
    else { if(sheet.playback === 'once' && frame === sheet.frames-1) frame=0; elapsed = frame / fps; playing = true; }
  }
  onMount(() => { playing = !matchMedia('(prefers-reduced-motion: reduce)').matches; });
  $effect(() => { sheet; onlyDirection; elapsed = 0; frame = 0; });
  $effect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); elapsed += (now - previous) / 1000 * speed; previous = now; if(sheet.playback === 'once' && visibleDirections.every(d=>elapsed*sheet.loops[d]!.fps>=sheet.frames)){frame=sheet.frames-1;playing=false;} }, 40);
    return () => clearInterval(timer);
  });
</script>
<div class="directions">
  {#each sheet.directions as direction, row}
    {#if !onlyDirection || onlyDirection===direction}
    {@const loop = sheet.loops[direction]!}
    {@const index = playing ? frameAt(elapsed,loop.fps) : frame}
    <div class="direction"><div class="stage" style:height={`${settings.height * 2}px`}>
      <div class="sprite" style:width={`${settings.width}px`} style:height={`${settings.height}px`} style:background-image={`url("${url}")`} style:background-position={`${-index * settings.width}px ${-row * settings.height}px`}>
        <span class="pivot" style:left={`${settings.anchor[0]}px`} style:top={`${settings.anchor[1]}px`}></span>
      </div>
    </div><strong>{direction.toUpperCase()}</strong><small>{loop.fps} fps{loop.mirroredFrom ? ` · reflejo ${loop.mirroredFrom.toUpperCase()}` : ''}</small></div>
    {/if}
  {/each}
</div>

<div class="controls" aria-label="Reproductor de animación">
  <button class="play" onclick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'} title={playing ? 'Pausar' : 'Reproducir'}><WorkshopIcon name={playing ? 'pause' : 'play'}/></button>
  <input aria-label="Fotograma" type="range" min="0" max={sheet.frames - 1} value={currentFrame} oninput={e => seek(e.currentTarget.valueAsNumber)}/>
  <span class="counter" aria-label={`Fotograma ${currentFrame + 1} de ${sheet.frames}`}>{currentFrame + 1} / {sheet.frames}</span>
  <div class="playback"><WorkshopIcon name={sheet.playback === 'once' ? 'once' : 'loop'} size={14}/><span>{sheet.playback === 'once' ? 'Una vez' : 'Bucle'}</span></div>
  <label class="speed">Velocidad <select aria-label="Velocidad de revisión" bind:value={speed}><option value={1}>1×</option><option value={0.5}>0,5×</option></select></label>
</div>

<details><summary>Ver hoja completa · {sheet.image.width} × {sheet.image.height} px</summary><div class="full"><img src={url} alt={`Hoja de ${sheet.action}, ${sheet.frames} columnas y ${sheet.directions.length} orientaciones`}/></div></details>
<style>
  .controls{display:grid;grid-template-columns:36px minmax(0,1fr) 5ch;grid-template-rows:36px 32px;gap:8px;align-items:center;font-size:12px;margin-top:12px}
  .controls input{width:100%;min-width:0;margin:0;accent-color:#526e37}.counter{width:5ch;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .play{display:grid;place-items:center;width:36px;height:36px;padding:0;background:#526e37;border:0;border-radius:6px;color:white;cursor:pointer}
  .playback{grid-column:1 / 3;display:flex;gap:6px;align-items:center;color:#60705c}.speed{grid-column:3;justify-self:end;display:flex;align-items:center;gap:6px;white-space:nowrap}
  .playback{max-width:calc(100% - 90px)}.controls select{font:inherit;padding:4px;border:1px solid #bdcbb0;border-radius:4px;background:white;color:#304535}
  button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #698849;outline-offset:3px}
  .directions{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}.direction{text-align:center;min-width:0}.stage{display:flex;justify-content:center;align-items:center;overflow:auto;min-height:192px;background-color:#e8ece2;background-image:conic-gradient(#d8dfd1 25%,transparent 0 50%,#d8dfd1 0 75%,transparent 0);background-size:16px 16px;border-radius:8px}.sprite{position:relative;flex-shrink:0;transform:scale(2);image-rendering:pixelated;background-repeat:no-repeat}.pivot{position:absolute;width:5px;height:5px;transform:translate(-50%,-50%);border:1px solid #e26f39;border-radius:50%}strong,small{display:block;margin-top:7px}small{font-size:11px;color:#60705c}details{margin-top:14px;font-size:12px}summary{cursor:pointer}.full{overflow:auto;max-height:420px;margin-top:12px;background:#d8dfd1}.full img{display:block;max-width:none;image-rendering:pixelated}
</style>
