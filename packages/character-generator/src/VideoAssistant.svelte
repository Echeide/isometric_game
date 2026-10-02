<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Direction, Profile } from './types';
  import type { VideoJob, VideoProvider } from './video';
  import { validateVideoRequest } from './video';
  let { provider, reference, projectId, profile, action, direction, suggestedPrompt, negative, hasSource, revision, onaccept, onbusy }:
    { provider: VideoProvider; reference?: string; projectId: string; profile: Profile; action: string; direction: Direction; suggestedPrompt: string; negative: string; hasSource: boolean; revision: number; onaccept: (blob: Blob, job: VideoJob) => Promise<boolean>; onbusy: (label: string) => void } = $props();
  let available = $state(false), statusMessage = $state('Comprobando configuración…'), error = $state('');
  let prompt = $state(''), jobs = $state<VideoJob[]>([]), current = $state<VideoJob | null>(null);
  let submitting = $state(false), checking = $state(false), importing = $state(false), imported = $state('');
  let download = $state(''), downloadedId = '', downloadBlob: Blob | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, destroyed = false, autoImport = false, checks = 0, generatedRevision = -1;
  const labels = { submitting: 'Enviando', pending: 'Generando', completed: 'Vídeo listo', failed: 'No se pudo generar', uncertain: 'Respuesta sin confirmar' };
  const matching = $derived(!!current && current.projectId === projectId && current.profile === profile && current.action === action && current.direction === direction);
  const working = $derived(submitting || checking || importing);
  const generating = $derived(current?.status === 'pending' || current?.status === 'submitting');
  const videoBusy = $derived(submitting || generating || importing);
  const buttonLabel = $derived(submitting ? 'Enviando a Kling…' : importing ? 'Importando vídeo…' : generating ? 'Generando en Kling…' : `Generar vídeo · ${action}/${direction.toUpperCase()}`);
  $effect(() => { prompt = suggestedPrompt; });
  function update(job: VideoJob) { current = job; jobs = [job, ...jobs.filter(j => j.id !== job.id)].slice(0, 50); }
  function releaseVideo() { if (download) URL.revokeObjectURL(download); download = ''; downloadedId = ''; downloadBlob = undefined; }
  async function refresh() {
    error = '';
    try { const status = await provider.status(); if (destroyed) return; available = status.available; statusMessage = status.message; jobs = await provider.list(); }
    catch { if (!destroyed) error = 'No se pudo comprobar Magnific. Comprueba que el servidor local sigue activo.'; }
  }
  async function importVideo() {
    if (!current || !matching || working) return;
    const job = current; importing = true; error = '';
    try {
      if (downloadedId !== job.id) {
        const blob = await provider.video(job.id);
        if (destroyed) return;
        releaseVideo(); downloadBlob = blob; downloadedId = job.id; download = URL.createObjectURL(blob);
      }
      if (destroyed || !matching || current?.id !== job.id) return;
      if (await onaccept(downloadBlob!, job)) imported = job.id;
    } catch (e) { if (!destroyed) error = e instanceof Error ? e.message : 'No se pudo importar el vídeo. Puedes volver a importarlo sin regenerar.'; }
    finally { importing = false; }
  }
  async function check() {
    if (!current || checking || destroyed) return;
    clearTimeout(timer); checking = true; error = '';
    const id = current.id;
    try {
      const job = await provider.poll(id);
      if (destroyed || current?.id !== id) return;
      update(job);
      if (job.status === 'pending' || job.status === 'submitting') {
        if (++checks < 160) timer = setTimeout(() => void check(), 7500);
        else error = 'La generación sigue pendiente. Puedes consultar de nuevo; no hace falta volver a generar.';
      }
    } catch (e) { if (!destroyed) error = e instanceof Error ? e.message : 'Consulta interrumpida. Puedes consultar de nuevo sin generar otro vídeo.'; }
    finally { checking = false; }
    if (!destroyed && current?.id === id && current.status === 'completed' && autoImport) {
      autoImport = false;
      if (matching && !hasSource && revision === generatedRevision) await importVideo();
    }
  }
  async function generate() {
    if (working || !available || !reference || current?.status === 'pending' || current?.status === 'submitting') return;
    error = '';
    const request = { requestId: crypto.randomUUID(), projectId, profile, action, direction, reference, prompt, negative };
    try { validateVideoRequest(request); } catch (e) { error = (e as Error).message; return; }
    submitting = true; onbusy('Enviando referencia a Kling 2.6…'); clearTimeout(timer); releaseVideo(); imported = ''; checks = 0;
    try {
      const job = await provider.create(request);
      if (destroyed) return;
      update(job); autoImport = !hasSource; generatedRevision = revision;
    } catch (e) {
      if (!destroyed) { await refresh(); error = `${e instanceof Error ? e.message : 'La conexión se interrumpió.'} Revisa las solicitudes guardadas antes de generar otra vez.`; }
    } finally { submitting = false; onbusy(''); }
    if (!destroyed && current?.id === request.requestId) await check();
  }
  function recover(job: VideoJob) {
    if (working) return;
    clearTimeout(timer); releaseVideo(); imported = ''; checks = 0; autoImport = false; update(job); void check();
  }
  onMount(() => { void refresh(); });
  onDestroy(() => { destroyed = true; clearTimeout(timer); releaseVideo(); });
</script>

<div class="video-assistant">
  <span class="eyebrow">AYUDA OPCIONAL · MAGNIFIC</span>
  <h3>Animar con Kling 2.6</h3>
  <p>{statusMessage}</p>
  <p>Envía la referencia de {direction.toUpperCase()} y recibe aquí su animación. Podrás revisar el ciclo y retocarlo en Piskel.</p>
  {#if reference}<img src={reference} alt={`Referencia para animar ${direction.toUpperCase()}`}/>{:else}<p>Aprueba primero una referencia de {direction.toUpperCase()} arriba, o abre un proyecto que ya la incluya.</p>{/if}
  <details><summary>Prompt del vídeo · {action}/{direction.toUpperCase()}</summary><label>Movimiento<textarea rows="6" maxlength="2500" bind:value={prompt}></textarea></label><small>{prompt.length}/2500 caracteres</small><button onclick={() => prompt = suggestedPrompt}>Restaurar prompt sugerido</button></details>
  <p class="hint">Un clic genera un vídeo de 5 segundos y consume créditos de Magnific. Se enviarán esta imagen y el prompt. Revisa el movimiento antes de aprobarlo.</p>
  <button class="primary generate" class:loading={videoBusy} aria-busy={videoBusy} disabled={working || generating || !available || !reference || !prompt.trim() || prompt.length > 2500} onclick={generate}>
    {#if videoBusy}<span class="spinner" aria-hidden="true"></span>{/if}
    {buttonLabel}
  </button>
  <div role="status">
    {#if submitting}<p class="hint">Enviando la referencia y el movimiento. No hace falta volver a pulsar.</p>
    {:else if importing}<p class="hint">Preparando el vídeo y extrayendo los fotogramas del ciclo…</p>
    {:else if generating}<p class="hint">Kling está preparando el vídeo. Puede tardar unos minutos; puedes seguir trabajando. El proveedor no indica un porcentaje de avance.</p>{/if}
  </div>
  {#if hasSource}<p class="hint">Conservarás el ciclo actual hasta pulsar «Reemplazar ciclo con este vídeo».</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if current}
    <div class="job" aria-live="polite">
      <strong>{labels[current.status]} · {current.projectId} · {current.action}/{current.direction.toUpperCase()}</strong>
      {#if current.message}<p>{current.message}</p>{/if}
      {#if current.status === 'pending' || current.status === 'submitting'}<p>Puedes seguir trabajando. Consultamos el estado sin repetir la generación.</p>{/if}
      <button disabled={working} onclick={() => { checks = 0; void check(); }}>Consultar estado</button>
      {#if current.status === 'completed'}
        {#if matching}<button class="primary" disabled={working} onclick={importVideo}>{importing ? 'Importando…' : hasSource ? 'Reemplazar ciclo con este vídeo' : 'Importar y revisar ciclo'}</button>
        {:else}<p>Abre el personaje «{current.projectId}» y selecciona {current.action}/{current.direction.toUpperCase()} para importar este vídeo.</p>{/if}
        {#if imported === current.id}<p>Ciclo incorporado. Revisa la vista previa y guarda el proyecto.</p>{/if}
      {/if}
      {#if download}<a href={download} download={`${current.projectId}-${current.action}-${current.direction}.mp4`}>Descargar vídeo original</a>{/if}
    </div>
  {/if}
  <details><summary>Recuperar solicitudes de vídeo ({jobs.length})</summary><p class="hint">Se guardan en este servidor local. Abrir una solicitud no genera otro vídeo. Descarga o importa los resultados pronto: los enlaces de Magnific caducan.</p><button disabled={working} onclick={refresh}>Actualizar solicitudes</button>
    {#each jobs as job}<button class="saved" disabled={working} onclick={() => recover(job)}>{job.projectId} · {job.action}/{job.direction.toUpperCase()} · {new Date(job.createdAt).toLocaleString()}</button>{/each}
  </details>
</div>

<style>
  .generate{display:inline-flex;align-items:center;justify-content:center;gap:8px}.generate.loading:disabled{opacity:1;cursor:wait}.spinner{display:inline-block;flex-shrink:0;width:14px;height:14px;border:2px solid #ffffff55;border-top-color:currentColor;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none;border-style:dotted}}
  .video-assistant{border:1px solid #cad5b8;background:#f4f7ed;border-radius:12px;padding:20px;margin-top:20px;color:#26371e}.eyebrow{font-size:11px;letter-spacing:.1em;color:#526e37;font-weight:700}h3{margin:8px 0 12px}p{font-size:13px;line-height:1.6}img{width:96px;height:128px;object-fit:contain;border-radius:6px}details{margin:14px 0}summary{cursor:pointer;font-size:13px;font-weight:600}label{display:grid;gap:6px;margin-top:10px;font-size:13px}textarea{width:100%;box-sizing:border-box;border:1px solid #b6c5a1;padding:10px;border-radius:6px;font:12px/1.5 monospace}button{font:13px system-ui;padding:9px 12px;border:1px solid #acbb99;border-radius:7px;background:white;cursor:pointer;margin:5px 6px 5px 0}button:disabled{opacity:.5;cursor:default}.primary{background:#405a2d;color:white;border-color:#405a2d}.hint,small{font-size:12px;color:#58644d}.error{color:#a12b24}.job{border-top:1px solid #cad5b8;margin-top:16px;padding-top:16px;font-size:13px}.saved{display:block;text-align:left}a{display:block;color:#405a2d;margin:12px 0}
</style>
