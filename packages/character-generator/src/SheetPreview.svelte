<script lang="ts">
  import { onMount } from 'svelte';
  import type { Sheet, GeneratorSettings } from './types';
  let { sheet, url, settings }: { sheet: Sheet; url: string; settings: GeneratorSettings } = $props();
  let playing = $state(false), elapsed = $state(0), frame = $state(0), speed = $state(1);
  const fps = $derived(sheet.loops[sheet.directions[0]]!.fps);
  const currentFrame = $derived(playing ? Math.floor(elapsed * fps) % sheet.frames : frame);
  function seek(index: number) { playing = false; frame = index; elapsed = index / fps; }
  function toggle() {
    if (playing) seek(currentFrame);
    else { elapsed = frame / fps; playing = true; }
  }
  onMount(() => { playing = !matchMedia('(prefers-reduced-motion: reduce)').matches; });
  $effect(() => { sheet; elapsed = 0; frame = 0; });
  $effect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); elapsed += (now - previous) / 1000 * speed; previous = now; }, 40);
    return () => clearInterval(timer);
  });
</script>
<div class="controls"><button onclick={toggle}>{playing ? 'Pausar' : 'Reproducir'}</button><label>Fotograma <input type="range" min="0" max={sheet.frames - 1} value={currentFrame} oninput={e => seek(e.currentTarget.valueAsNumber)}/></label><span>{currentFrame + 1} / {sheet.frames}</span><label>Velocidad de revisión <select bind:value={speed}><option value={1}>Normal</option><option value={0.5}>Media velocidad</option></select></label></div>

<div class="directions">
  {#each sheet.directions as direction, row}
    {@const loop = sheet.loops[direction]!}
    {@const index = playing ? Math.floor(elapsed * loop.fps) % sheet.frames : frame}
    <div class="direction"><div class="stage" style:height={`${settings.height * 2}px`}>
      <div class="sprite" style:width={`${settings.width}px`} style:height={`${settings.height}px`} style:background-image={`url("${url}")`} style:background-position={`${-index * settings.width}px ${-row * settings.height}px`}>
        <span class="pivot" style:left={`${settings.anchor[0]}px`} style:top={`${settings.anchor[1]}px`}></span>
      </div>
    </div><strong>{direction.toUpperCase()}</strong><small>{loop.fps} fps{loop.mirroredFrom ? ` · reflejo ${loop.mirroredFrom.toUpperCase()}` : ''}</small></div>
  {/each}
</div>

<details><summary>Ver hoja completa · {sheet.image.width} × {sheet.image.height} px</summary><div class="full"><img src={url} alt={`Hoja de ${sheet.action}, ${sheet.frames} columnas y ${sheet.directions.length} orientaciones`}/></div></details>
<style>
  .controls select{font:inherit;padding:6px;border:1px solid #bdcbb0;border-radius:4px;background:white;color:#304535}
  .controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;margin-bottom:18px}.controls label{display:flex;align-items:center;gap:8px}.controls button{font:inherit;padding:8px 12px;background:white;border:1px solid #bdcbb0;border-radius:6px;color:#304535;cursor:pointer}.directions{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}.direction{text-align:center;min-width:0}.stage{display:flex;justify-content:center;align-items:center;overflow:auto;min-height:192px;background-color:#e8ece2;background-image:conic-gradient(#d8dfd1 25%,transparent 0 50%,#d8dfd1 0 75%,transparent 0);background-size:16px 16px;border-radius:8px}.sprite{position:relative;flex-shrink:0;transform:scale(2);image-rendering:pixelated;background-repeat:no-repeat}.pivot{position:absolute;width:5px;height:5px;transform:translate(-50%,-50%);border:1px solid #e26f39;border-radius:50%}strong,small{display:block;margin-top:7px}small{font-size:11px;color:#60705c}details{margin-top:20px;font-size:12px}summary{cursor:pointer}.full{overflow:auto;max-height:420px;margin-top:12px;background:#d8dfd1}.full img{display:block;max-width:none;image-rendering:pixelated}
</style>
