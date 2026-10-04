<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { emptyArt, imageReferenceInput, orientationLabels, selectImageReference, type ArtProject, type ImageProvider, type ImageRequest, type ImageResult } from './generation';
  import { prepareReference } from './browser';
  import type { Direction, Profile } from './types';
  import type { CharacterBrief } from './prompts';

  let { provider, brief, profile, action, direction, art = $bindable(emptyArt()), onbusy, onerror }:
    { provider: ImageProvider; brief: CharacterBrief; profile: Profile; action: string; direction: Direction; art?: ArtProject;
      onbusy: (label: string) => void; onerror: (message: string) => void } = $props();
  let status = $state<{ available: boolean; model?: string; message?: string }>({ available: false, message: 'Comprobando configuración…' });
  let quality = $state<'low' | 'medium' | 'high'>('medium');
  let candidate = $state.raw<{ result: ImageResult; request: ImageRequest } | null>(null);
  let checking = $state(false), preferPhoto = $state(false);
  let aborter: AbortController | undefined, alive = true;
  const selectedReference = $derived(selectImageReference(art, direction));
  const referenceInput = $derived(imageReferenceInput(art, direction, preferPhoto));
  const usingPhoto = $derived(referenceInput.referenceKind === 'inspiration');
  async function check() {
    checking = true;
    try { const value = await provider.status(); if (alive) status = value; }
    catch { if (alive) status = { available: false, message: 'No se pudo comprobar la conexión del servidor. Puedes continuar importando tus archivos.' }; }
    finally { if (alive) checking = false; }
  }
  onMount(check);
  onDestroy(() => { alive = false; aborter?.abort(); });
  async function generate() {
    if (!status.available) return;
    const request: ImageRequest = { brief: structuredClone($state.snapshot(brief)), profile, direction, action, kind: 'reference', quality, ...referenceInput };
    onbusy('Generando referencia con OpenAI… Puede tardar unos minutos.'); onerror('');
    aborter = new AbortController();
    try {
      const result = await provider.generate(request, aborter.signal);
      if (alive) candidate = { result, request };
    } catch (e) { if (alive) onerror(e instanceof Error ? e.message : 'No se pudo generar la imagen.'); }
    finally { if (alive) onbusy(''); }
  }
  async function accept() {
    if (!candidate) return;
    const { result, request } = candidate;
    onbusy('Preparando la referencia aprobada…'); onerror('');
    try {
      const image = await prepareReference(result.image);
      if (alive) {
        art = { ...art, references: { ...art.references, [request.direction]: { image, prompt: result.prompt, model: result.model } } };
        candidate = null;
      }
    } catch (e) { if (alive) onerror((e as Error).message); }
    finally { if (alive) onbusy(''); }
  }
</script>

<div class="assistant">
  <details class="connection"><summary>OpenAI · {status.available ? 'Conectado' : 'Sin conexión'}</summary><p>{status.message}</p><button disabled={checking} onclick={check}>{checking ? 'Comprobando…' : 'Comprobar conexión'}</button>{#if !status.available}<p>Configura la conexión en el servidor o importa una imagen.</p>{/if}</details>
  <details><summary>Opciones de generación</summary>
    {#if art.inspiration && selectedReference}<label class="photo-choice"><input type="checkbox" bind:checked={preferPhoto}/> Usar la foto original</label>{/if}
    <label class="quality">Calidad<select bind:value={quality}><option value="low">Borrador</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
  </details>
  <p class="hint">{usingPhoto ? 'Se enviará la foto importada a OpenAI.' : selectedReference ? `Se enviará la referencia ${selectedReference.direction.toUpperCase()} a OpenAI.` : 'La vista se creará a partir de tu descripción y estilo.'} Cada generación consume uso de la API.</p>
  <button class="primary" disabled={!status.available || (!brief.description.trim() && !referenceInput.reference) || !brief.style.trim()} onclick={generate}>Generar vista {direction.toUpperCase()}</button>
  {#if !brief.description.trim() && !referenceInput.reference}<p class="hint">Escribe una descripción o importa una foto en el paso Personaje.</p>{/if}
  {#if candidate}
    <div class="candidate"><h4>Revisar referencia · {candidate.request.direction.toUpperCase()}</h4>
      <div class="image"><img src={candidate.result.image} alt="Referencia generada pendiente de revisión"/></div>
      <p class="hint"><strong>Antes de aceptar: {orientationLabels[candidate.request.direction]}.</strong> Si la orientación no coincide, descarta esta propuesta y vuelve a generar.</p>
      <div class="buttons"><button class="primary" onclick={accept}>Aprobar como referencia</button><a href={candidate.result.image} download={`propuesta-reference-${candidate.request.direction}.png`}>Descargar PNG original</a><button onclick={() => candidate = null}>Descartar</button></div>
      <details><summary>Prompt utilizado · {candidate.result.model}</summary><p>{candidate.result.prompt}</p></details>
    </div>
  {/if}
</div>
<style>
 .photo-choice{display:flex;gap:8px;align-items:center;font-size:12px;margin-top:14px}.assistant{border:1px solid #b8c8a6;background:#f0f5e9;border-radius:9px;padding:18px;margin:20px 0}h4{font-size:14px;margin:0 0 14px}p{font-size:12px;line-height:1.6;margin:8px 0 14px}.hint{font-size:11px;color:#60705c}button,a{font:inherit;font-size:12px;padding:9px 12px;border:1px solid #bdcbb0;border-radius:6px;background:white;color:#304535;cursor:pointer}button:disabled{opacity:.4;cursor:default}.primary{background:#526e37;color:white;border-color:#526e37}a{text-decoration:none}.quality{max-width:240px;margin:18px 0 10px;display:grid;gap:6px;font-size:12px}select{font:inherit;padding:9px;border:1px solid #bdcbb0;border-radius:6px;min-width:0;width:100%;box-sizing:border-box;background:white;color:#304535}.candidate{margin-top:22px;padding-top:18px;border-top:1px solid #bdcbb0}.image{max-width:640px}.image img{display:block;width:100%;height:auto}.buttons{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}details{margin:14px 0;font-size:12px}summary{cursor:pointer;font-weight:600}details p{white-space:pre-wrap;overflow-wrap:anywhere}button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid #526e37;outline-offset:3px}
</style>
