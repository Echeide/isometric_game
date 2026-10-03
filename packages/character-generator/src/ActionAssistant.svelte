<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { orientationLabels, selectImageReference, shortActionRecipe, type ArtProject, type ImageProvider, type ImageRequest, type ImageResult } from './generation';
  import type { CharacterBrief } from './prompts';
  import type { Direction, Profile, ActionOptions } from './types';

  let { provider, art, brief, profile, action, direction, options, hasSource, onaccept, onbusy, onerror }:
    { provider: ImageProvider; art: ArtProject; brief: CharacterBrief; profile: Profile; options?: ActionOptions; action: string; direction: Direction; hasSource: boolean;
      onaccept: (result: ImageResult, request: ImageRequest) => Promise<boolean>; onbusy: (label: string) => void; onerror: (message: string) => void } = $props();
  let available = $state(false), generating = $state(false), accepting = $state(false);
  let statusMessage = $state('Comprobando configuración…'), quality = $state<'low' | 'medium' | 'high'>('medium');
  let candidate = $state.raw<{ result: ImageResult; request: ImageRequest } | null>(null);
  let alive = true, aborter: AbortController | undefined;
  const reference = $derived(selectImageReference(art, direction));
  const recipe = $derived(shortActionRecipe(profile, action, options));
  async function check() {
    try { const status = await provider.status(); if (alive) { available = status.available; statusMessage = status.message || ''; } }
    catch { if (alive) { available = false; statusMessage = 'No se pudo comprobar OpenAI. Puedes importar imágenes manualmente.'; } }
  }
  async function generate() {
    if (!available || !reference || !recipe || generating || accepting) return;
    const request: ImageRequest = { kind: 'action', profile, action, direction, quality, recipe: options ? structuredClone($state.snapshot(options)) : undefined, brief: structuredClone($state.snapshot(brief)), reference: reference.asset.image, referenceDirection: reference.direction };
    generating = true; aborter = new AbortController(); onerror(''); onbusy(`Generando ${action}/${direction.toUpperCase()} con OpenAI…`);
    try { const result = await provider.generate(request, aborter.signal); if (alive) candidate = { result, request }; }
    catch (e) { if (alive) onerror(e instanceof Error ? e.message : 'No se pudo generar la acción.'); }
    finally { generating = false; if (alive) onbusy(''); }
  }
  async function accept() {
    if (!candidate || generating || accepting) return;
    accepting = true;
    try { if (await onaccept(candidate.result, candidate.request)) candidate = null; }
    catch (e) { if (alive) onerror(e instanceof Error ? e.message : 'No se pudo importar la acción.'); }
    finally { accepting = false; }
  }
  onMount(() => { void check(); });
  onDestroy(() => { alive = false; aborter?.abort(); });
</script>

<div class="action-assistant">
  <span class="tag">ACCIÓN CORTA · OPENAI</span>
  <h3>Crear {action} con ChatGPT</h3>
  <p>Esta acción necesita {recipe?.frames} {recipe?.frames === 1 ? 'fotograma' : 'fotogramas'}. Genera una imagen, revísala e incorpórala directamente al ciclo para retocarla en Piskel.</p>
  {#if !available}<p>{statusMessage}</p><button onclick={check}>Comprobar conexión</button>{/if}
  {#if reference}<p class="hint">Usaremos la referencia aprobada {reference.direction.toUpperCase()}. Vista final: {orientationLabels[direction]}.</p>
  {:else}<p>Aprueba primero una referencia del personaje en el apartado anterior.</p>{/if}
  <label>Calidad de la acción<select bind:value={quality}><option value="low">Borrador</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
  <p class="hint">Cada clic solicita una imagen y consume uso de tu API de OpenAI.</p>
  <button class="primary" aria-busy={generating} disabled={!available || !reference || !recipe || !brief.style.trim() || generating || accepting} onclick={generate}>
    {#if generating}<span class="spinner" aria-hidden="true"></span>{/if}
    {generating ? 'Generando imagen…' : `Generar ${action} · ${direction.toUpperCase()} con ChatGPT`}
  </button>
  <div role="status">{#if generating}<p>OpenAI está preparando la imagen. Puede tardar unos minutos.</p>{/if}</div>
  {#if hasSource}<p class="hint">La fuente actual se conserva hasta que aceptes la nueva propuesta.</p>{/if}
  {#if candidate}
    <div class="candidate">
      <h4>Revisar {candidate.request.action} · {candidate.request.direction.toUpperCase()}</h4>
      <img src={candidate.result.image} alt={`Propuesta de ${candidate.request.action} pendiente de revisión`}/>
      <p>Comprueba la pose, la orientación y que el personaje esté completo antes de incorporarlo.</p>
      <div class="buttons">
        <button class="primary" disabled={generating || accepting} onclick={accept}>{accepting ? 'Importando…' : hasSource ? 'Reemplazar ciclo con esta imagen' : 'Usar imagen y revisar ciclo'}</button>
        <a href={candidate.result.image} download={`${candidate.request.action}-${candidate.request.direction}.png`}>Descargar PNG</a>
        <button disabled={generating || accepting} onclick={() => candidate = null}>Descartar</button>
      </div>
      <details><summary>Prompt utilizado · {candidate.result.model}</summary><p>{candidate.result.prompt}</p></details>
    </div>
  {/if}
</div>

<style>
  .action-assistant{border:1px solid #b8c8a6;background:#f0f5e9;border-radius:9px;padding:18px;margin:20px 0;color:#304535}.tag{font-size:10px;letter-spacing:1.3px;color:#617d45;font-weight:700}h3{font-size:18px;margin:6px 0 12px}h4{font-size:14px}p{font-size:12px;line-height:1.6}.hint{font-size:11px;color:#60705c}label{display:grid;gap:6px;max-width:240px;margin:14px 0;font-size:12px}button,a,select{font:inherit;font-size:12px;padding:9px 12px;border:1px solid #bdcbb0;border-radius:6px;background:white;color:#304535}button,a{cursor:pointer}a{text-decoration:none}.primary{display:inline-flex;gap:8px;align-items:center;background:#526e37;color:white;border-color:#526e37}button:disabled{opacity:.5;cursor:default}.primary[aria-busy=true]{opacity:1}.spinner{width:14px;height:14px;border:2px solid #ffffff55;border-top-color:currentColor;border-radius:50%;animation:spin .8s linear infinite}.candidate{margin-top:20px;border-top:1px solid #bdcbb0}.candidate img{display:block;max-width:100%;max-height:440px;object-fit:contain}.buttons{display:flex;flex-wrap:wrap;gap:8px}details{margin:14px 0;font-size:12px}details p{white-space:pre-wrap;overflow-wrap:anywhere}button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid #526e37;outline-offset:3px}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none;border-style:dotted}}
</style>
