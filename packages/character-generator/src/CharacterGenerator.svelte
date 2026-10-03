<script lang="ts">
  import { onDestroy } from 'svelte';
  import { strToU8 } from 'fflate';
  import { ACTION_LABELS, availableActions, selectedActions, defaultSettings, MIRRORS, PROFILES, type BuildResult, type ClipInput, type PixelEditorProvider, type Direction, type Profile, type Sources } from './types';
  import { buildCharacter, missingSources } from './pipeline';
  import { createPrompts, type CharacterBrief } from './prompts';
  import { encodePNG, exportCharacter, importCharacterReference, loadProject, readImages, readSheet, readVideo, saveProject } from './browser';
  import SheetPreview from './SheetPreview.svelte';
  import ImageAssistant from './ImageAssistant.svelte';
  import ActionAssistant from './ActionAssistant.svelte';
  import VideoAssistant from './VideoAssistant.svelte';
  import type { VideoProvider, VideoJob } from './video';
  import { extractFrames } from './pixel-edit';
  import { workflowTasks } from './workflow';
  import { orientationLabels } from './generation';
  import { emptyArt, pngData, shortActionRecipe, type ImageProvider, type ImageRequest, type ImageResult } from './generation';

  let { onexample, imageProvider, videoProvider, pixelEditor }: { onexample?: () => Promise<Sources>; imageProvider?: ImageProvider; videoProvider?: VideoProvider; pixelEditor?: PixelEditorProvider } = $props();
  let settings = $state(defaultSettings());
  let brief = $state<CharacterBrief>({ description: '', style: 'Pixel art, readable silhouette, soft earthy palette, large head, compact body', props: '', notes: {} });
  let sources = $state.raw<Sources>({}), result = $state.raw<BuildResult | null>(null);
  let art = $state(emptyArt()), assistantRevision = $state(0);
  let urls = $state<Record<string, string>>({}), rawUrl = $state('');
  let downloadLink = $state<{ url: string; name: string } | null>(null);
  let action = $state('idle'), direction = $state<Direction>('se'), rawFrame = $state(0);
  let mode = $state('video'), sourceFps = $state(24), seconds = $state(5), start = $state(0);
  let columns = $state(8), rows = $state(4), sourceRow = $state(1);
  let busy = $state(''), error = $state(''), notice = $state(''), progress = $state(0);
  let aborter = $state<AbortController | undefined>();
  let destroyed = false;
  const profile = $derived(PROFILES[settings.profile]);
  const actions = $derived(selectedActions(settings));
  const actionOptions = $derived(availableActions(settings.profile));
  const active = $derived(sources[action]?.[direction]);
  const shortAction = $derived(shortActionRecipe(settings.profile, action));
  const mirrored = $derived(!active && settings.mirror && MIRRORS[direction] ? sources[action]?.[MIRRORS[direction]!] : undefined);
  const missing = $derived(missingSources(settings, sources));
  const recipes = $derived(createPrompts(brief, settings.profile, false, settings.actions));
  const prompt = $derived(recipes.find(r => r.direction === direction)!);
  const selectedSheet = $derived(result?.sheets.find(s => s.action === action));
  const tasks = $derived(workflowTasks(settings, sources, art, !!imageProvider));
  const nextTask = $derived(tasks[0]);
  const viewReady = $derived(!!(active || mirrored));
  const fullResult = $derived(result && result.character.directions.length === profile.directions.length && actions.every(a => result!.character.animations[a.action]));

  function clearResult() { Object.values(urls).forEach(URL.revokeObjectURL); urls = {}; result = null; }
  function clearDownload() { if (downloadLink) URL.revokeObjectURL(downloadLink.url); downloadLink = null; }
  function offerDownload(data: Uint8Array, name: string, type = 'application/zip') {
    if (destroyed) return;
    clearDownload();
    downloadLink = { url: URL.createObjectURL(new Blob([new Uint8Array(data)], { type })), name };
    notice = 'Archivo preparado. Pulsa el enlace para guardarlo en tu equipo.';
  }
  function changed() { clearResult(); clearDownload(); error = ''; notice = ''; }
  function chooseView(pose: string, facing: Direction) {
    if (!!shortActionRecipe(settings.profile, pose) !== !!shortAction) mode = shortActionRecipe(settings.profile, pose) ? 'images' : 'video';
    action = pose; direction = facing; rawFrame = 0;
  }
  function continueWorkflow() {
    const task = workflowTasks($state.snapshot(settings), sources, $state.snapshot(art), !!imageProvider)[0];
    if (!task) { void process(true); return; }
    chooseView(task.action, task.direction);
    if (task.step === 'review') void process(false, true);
    document.getElementById(task.step === 'import' && !shortActionRecipe(settings.profile, task.action) ? 'character-import' : 'character-cycle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function approveCycle() {
    if (!active) return;
    sources = { ...sources, [action]: { ...sources[action], [direction]: { ...active, reviewed: true } } };
    clearDownload(); notice = `Ciclo ${action}/${direction.toUpperCase()} aprobado. Guarda el proyecto para conservar los avances.`;
    continueWorkflow();
  }
  async function retouch() {
    if (!pixelEditor || !active) return;
    await process(false, true);
    const sheet = result?.sheets.find(s => s.action === action);
    if (!sheet || !active) return;
    const input = active, pose = action, facing = direction;
    await run('Editando el ciclo en Piskel…', async () => {
      const blob = new Blob([new Uint8Array(await encodePNG(sheet.image))], { type: 'image/png' });
      const edited = await pixelEditor.edit({ blob, name: `${settings.id} · ${pose}/${facing.toUpperCase()}`, width: sheet.image.width, height: sheet.image.height, frames: sheet.frames, fps: sheet.loops[facing]!.fps });
      if (!edited || destroyed) return;
      const bitmap = await createImageBitmap(edited);
      try {
        if (bitmap.width !== sheet.image.width || bitmap.height !== sheet.image.height) throw new Error('Piskel debe conservar el tamaño y los fotogramas del ciclo.');
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
        const frames = extractFrames({ width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data }, settings.width, settings.height, sheet.frames);
        setSource({ ...input, edits: frames, reviewed: false });
        notice = 'Retoques de Piskel incorporados. Revisa el ciclo y guarda el proyecto.';
      } finally { bitmap.close(); }
    });
    if (!destroyed) await process(false, true);
  }
  function toggleAction(name: string, checked: boolean) {
    const names = actions.map(r => r.action);
    const next = checked ? [...names, name] : names.filter(a => a !== name);
    if (!next.length) return;
    settings.actions = next;
    if (!next.includes(action)) chooseView(next[0], direction);
    changed();
  }
  function setProfile(value: Profile) { settings.profile = value; settings.actions = undefined; chooseView('idle', 'se'); changed(); }
  function newCharacter() {
    changed(); settings = defaultSettings(); sources = {}; art = emptyArt(); assistantRevision++;
    brief = { description: '', style: 'Pixel art, readable silhouette, soft earthy palette, large head, compact body', props: '', notes: {} };
    action = 'idle'; direction = 'se'; rawFrame = 0;
    notice = 'Empieza escribiendo la descripción y el estilo. Puedes crear una referencia con OpenAI o importar tus propios archivos.';
  }
  function setSource(input?: ClipInput) {
    const next: Sources = { ...sources, [action]: { ...sources[action] } };
    if (input) next[action][direction] = { ...input, reviewed: false }; else delete next[action][direction];
    const pixels = Object.values(next).flatMap(dirs => Object.values(dirs)).reduce((sum, clip) => sum + [...clip.frames, ...(clip.edits || [])].reduce((n, f) => n + f.width * f.height, 0), 0);
    if (pixels > 64_000_000) throw new Error('Demasiadas muestras en memoria. Reduce duración o fps antes de importar.');
    sources = next; rawFrame = 0; changed();
  }
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return;
    busy = label; error = ''; notice = ''; progress = 0;
    try { await new Promise(resolve => setTimeout(resolve, 30)); await task(); }
    catch (e) { error = e instanceof Error ? e.message : 'No se pudo completar la operación.'; }
    finally { busy = ''; aborter = undefined; }
  }
  async function importInspiration(event: Event) {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if (!file) return;
    await run('Preparando foto de referencia…', async () => {
      const inspiration = await importCharacterReference(file);
      if (destroyed) return;
      art = { ...art, inspiration }; assistantRevision++; clearDownload();
      notice = 'Referencia visual preparada. Elige el estilo y genera una vista; puedes escribir solo los cambios que quieras.';
    });
  }
  async function importFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement, files = [...(input.files || [])]; input.value = '';
    if (!files.length) return;
    await run('Importando fuentes…', async () => {
      aborter = new AbortController();
      const clip = mode === 'video' ? await readVideo(files[0], { start, seconds, fps: sourceFps, signal: aborter.signal, onprogress: p => progress = p })
        : mode === 'sheet' ? await readSheet(files[0], columns, rows, sourceRow - 1, sourceFps) : await readImages(files, sourceFps);
      if (!destroyed) { setSource(clip); notice = `${clip.frames.length} muestras importadas para ${action}/${direction.toUpperCase()}.`; }
    });
  }
  async function importGeneratedVideo(blob: Blob, job: VideoJob) {
    if (busy || job.projectId !== settings.id || job.profile !== settings.profile || job.action !== action || job.direction !== direction) return false;
    let imported = false;
    await run('Importando vídeo de Kling…', async () => {
      aborter = new AbortController();
      const clip = await readVideo(new File([blob], `${job.projectId}-${job.action}-${job.direction}.mp4`, { type: 'video/mp4' }), { start: 0, seconds: 5, fps: 24, signal: aborter.signal, onprogress: p => progress = p });
      if (!destroyed) { setSource(clip); imported = true; }
    });
    if (imported) await process(false, true);
    return imported;
  }
  async function importGeneratedAction(image: ImageResult, request: ImageRequest) {
    const recipe = shortActionRecipe(request.profile, request.action);
    if (busy || request.kind !== 'action' || !recipe || request.profile !== settings.profile || request.action !== action || request.direction !== direction) return false;
    let imported = false;
    await run('Preparando los fotogramas de OpenAI…', async () => {
      if (image.frames !== recipe.frames || image.columns !== recipe.frames || image.rows !== 1) throw new Error('La imagen no tiene la cuadrícula esperada para esta acción.');
      const file = new File([new Uint8Array(pngData(image.image, 20_000_000))], `openai-${request.action}-${request.direction}.png`, { type: 'image/png' });
      const clip = await readSheet(file, image.columns, image.rows, 0, recipe.fps);
      if (!destroyed) { setSource(clip); imported = true; }
    });
    if (imported) await process(false, true);
    return imported;
  }
  async function process(all: boolean, oneView = false) {
    await run(all ? 'Construyendo todas las hojas…' : 'Preparando vista previa…', async () => {
      clearResult();
      const built = buildCharacter($state.snapshot(settings), sources, all ? undefined : [action], oneView ? [direction] : undefined);
      const next: Record<string, string> = {};
      try {
        for (const sheet of built.sheets) next[sheet.action] = URL.createObjectURL(new Blob([new Uint8Array(await encodePNG(sheet.image))], { type: 'image/png' }));
        if (destroyed) { Object.values(next).forEach(URL.revokeObjectURL); return; }
        urls = next; result = built;
        notice = all ? 'Hojas construidas. Revisa todas las acciones y orientaciones antes de descargarlas.' : 'Vista previa lista. Comprueba la orientación y el movimiento; puedes retocar antes de aprobar.';
      } catch (e) { Object.values(next).forEach(URL.revokeObjectURL); throw e; }
    });
  }
  function crop(which: 'start' | 'end', value: number) {
    if (!active) return;
    const range: [number, number] = [...(active.range || [0, active.frames.length])];
    range[which === 'start' ? 0 : 1] = which === 'start' ? value - 1 : value;
    setSource({ ...active, range });
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); notice = 'Prompt copiado.'; }
    catch { error = 'No se pudo copiar automáticamente. Selecciona el texto del prompt.'; }
  }
  async function openProject(event: Event) {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0]; input.value = '';
    if (!file) return;
    await run('Abriendo proyecto…', async () => {
      const project = await loadProject(file);
      if (destroyed) return;
      clearResult(); clearDownload(); settings = project.settings; brief = project.brief; sources = project.sources; art = project.art; assistantRevision++; chooseView(selectedActions(settings)[0].action, 'se'); notice = 'Proyecto recuperado con sus imágenes fuente y referencias.';
    });
  }
  $effect(() => {
    const clip = active, index = Math.min(rawFrame, (clip?.frames.length || 1) - 1);
    let cancelled = false, url = '';
    rawUrl = '';
    if (clip) encodePNG(clip.frames[index]).then(bytes => {
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' })); rawUrl = url;
    }).catch(() => { if (!cancelled) error = 'No se pudo mostrar la muestra fuente.'; });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  });
  onDestroy(() => { destroyed = true; aborter?.abort(); clearDownload(); Object.values(urls).forEach(URL.revokeObjectURL); });
</script>

<div class="generator">
  <div class="toolbar">
    <div><span class="tag">TALLER LOCAL</span><h1>Generador de personajes</h1><p>De tus imágenes y vídeos a las hojas del juego.</p></div>
    <div class="toolbar-actions">
      <button disabled={!!busy} onclick={newCharacter}>Nuevo personaje</button>
      <label class="button secondary" title="Recuperar un archivo .project.zip guardado anteriormente">Abrir proyecto guardado<input type="file" accept=".zip" disabled={!!busy} onchange={openProject}/></label>
      <button disabled={!!busy} onclick={() => run('Guardando proyecto…', async () => offerDownload(await saveProject($state.snapshot(settings), $state.snapshot(brief), sources, $state.snapshot(art)), `${settings.id}.project.zip`))}>Guardar proyecto</button>
    </div>
  </div>
  <p class="local-note">Para empezar de cero, sube una foto o escribe una descripción en el paso 01. Abrir proyecto guardado sirve para recuperar un .project.zip anterior. {imageProvider ? 'La ayuda de OpenAI envía la descripción y la referencia elegida al pulsar Generar; el procesamiento de hojas sigue siendo local.' : 'Los archivos se procesan en este navegador.'} Guarda el proyecto antes de cerrar, recargar o empezar otro personaje.</p>
  <div class="status" aria-live="polite">{#if busy}<p>{busy}{progress ? ` ${Math.round(progress * 100)} %` : ''}</p>{:else if notice}<p>{notice}</p>{/if}</div>
  {#if downloadLink}<p class="ready-file"><a href={downloadLink.url} download={downloadLink.name}>Descargar {downloadLink.name}</a></p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if busy && aborter}<button onclick={() => aborter?.abort()}>Cancelar importación</button>{/if}
  <section class="guide" aria-label="Flujo del personaje">
    <div><span class="step">REFERENCIA → IMAGEN O VÍDEO → RETOQUE → EXPORTACIÓN</span><h2>{nextTask ? 'Tu siguiente paso' : 'Personaje revisado'}</h2>
    <p>{nextTask ? `${nextTask.step === 'reference' ? 'Crear la referencia' : nextTask.step === 'import' ? shortActionRecipe(settings.profile, nextTask.action) ? 'Crear o importar la imagen' : 'Importar la animación' : 'Revisar y retocar el ciclo'} ${nextTask.action} · ${nextTask.direction.toUpperCase()}` : 'Todos los ciclos seleccionados están aprobados. Ya puedes construir las hojas finales.'}</p>
    <p class="hint">Revisa un ciclo cada vez. Las vistas por reflejo se completan automáticamente. {tasks.length} pasos de ciclo pendientes.</p></div>
    <button class="primary" disabled={!!busy} onclick={continueWorkflow}>{nextTask ? 'Ir al siguiente paso' : 'Construir hojas finales'}</button>
  </section>
  <fieldset disabled={!!busy} class="workspace">
    <div class="sidebar">
      <section>
        <span class="step">01 · PERSONAJE</span><h2>Define la referencia</h2>
        <label>Identificador<input value={settings.id} oninput={e => { settings.id = e.currentTarget.value; settings.baseUrl = `/pixelart/characters/${settings.id}`; changed(); }} placeholder="mi-personaje"/></label>
        <label>Formato de salida<select value={settings.profile} onchange={e => setProfile(e.currentTarget.value as Profile)}>{#each Object.entries(PROFILES) as [id, p]}<option value={id}>{p.label}</option>{/each}</select></label>
        {#if settings.profile === 'iso-eight'}<p class="notice">Este perfil exporta ocho orientaciones y run/attack. El motor actual del juego requiere el perfil de cuatro direcciones.</p>{/if}
        <div class="inspiration">
          <details class="action-selection"><summary>Acciones del personaje · {actions.length} seleccionadas</summary>
          <p class="hint">Marca las acciones que necesita este personaje. Solo tendrás que completar esas acciones para construir y exportar sus hojas.</p>
          <div class="action-checks">{#each actionOptions as recipe}<label class="check"><input type="checkbox" checked={actions.some(a => a.action === recipe.action)} disabled={actions.length === 1 && actions[0].action === recipe.action} onchange={e => toggleAction(recipe.action, e.currentTarget.checked)}/><span>{ACTION_LABELS[recipe.action]} <small>({recipe.action}) · {recipe.frames} fotogramas</small></span></label>{/each}</div>
          <p class="hint">Las fuentes de acciones desmarcadas se conservan en el proyecto. Daño y sentarse pueden crearse con ChatGPT; las demás usan vídeo o importación manual.</p>
          <p class="hint">El jugador del juego actual necesita las seis acciones básicas. Ataque, daño y correr se exportan para su integración posterior en el juego.</p>
        </details>
        <h3>Foto o imagen de referencia</h3>
          <p class="hint">Parte de una foto, un dibujo o un personaje de referencia. Una imagen de cuerpo entero ayuda a definir ropa y accesorios.</p>
          <label class="button">{art.inspiration ? 'Cambiar imagen de referencia' : 'Subir foto o referencia'}<input type="file" accept="image/png,image/jpeg,image/webp" onchange={importInspiration}/></label>
          {#if art.inspiration}<img src={art.inspiration.image} alt="Foto o referente del personaje"/><p class="hint">{art.inspiration.name}</p><button onclick={() => { art = { ...art, inspiration: undefined }; assistantRevision++; clearDownload(); }}>Quitar foto de referencia</button>{/if}
          <p class="hint">PNG, JPG o WebP · hasta 20 MB. Se guarda con el proyecto. {imageProvider ? 'Solo se envía a OpenAI al generar una vista.' : 'Puedes usarla como guía visual y continuar con la importación manual.'}</p>
        </div>
        <label>{art.inspiration ? 'Descripción o cambios (opcional)' : 'Descripción'}<textarea rows="3" bind:value={brief.description} placeholder={art.inspiration ? 'Qué mantener o cambiar: misma ropa, añadir una mochila…' : 'Exploradora con chaqueta verde, pelo corto y botas…'}></textarea></label>
        <label>Estilo visual<textarea rows="2" bind:value={brief.style}></textarea></label>
        <div class="style-options"><button onclick={() => brief.style = 'Pixel art, crisp pixels, limited earthy palette, dark inner outline, large head, compact body'}>Píxel clásico</button><button onclick={() => brief.style = 'Soft illustrated game character, clean shapes, warm pastel palette, gentle shading, readable silhouette'}>Ilustrado suave</button><button onclick={() => brief.style = 'Isometric low-poly game character, faceted shapes, matte colors, consistent soft lighting'}>Low poly</button></div>
        <label>Accesorios y lado del cuerpo<textarea rows="2" bind:value={brief.props} placeholder="Mochila azul, herramienta en la mano derecha…"></textarea></label>
        <label class="check"><input type="checkbox" bind:checked={settings.mirror} onchange={changed}/> Completar SW, NW y W con reflejos</label>
        <p class="hint">Para diseños asimétricos, desactiva los reflejos o importa una vista propia. La vista importada tiene prioridad.</p>
        <button onclick={() => offerDownload(strToU8(JSON.stringify({ brief: $state.snapshot(brief), recipes: createPrompts($state.snapshot(brief), settings.profile, settings.mirror, settings.actions) }, null, 2)), `${settings.id}-prompts.json`, 'application/json')}>Descargar todos los prompts</button>
      </section>
      <section>
        <span class="step">02 · PROCESAMIENTO</span><h2>Cuadrícula y acabado</h2>
        <div class="pair"><label>Ancho de celda<input type="number" min="16" max="256" bind:value={settings.width} onchange={changed}/></label><label>Alto de celda<input type="number" min="16" max="256" bind:value={settings.height} onchange={changed}/></label></div>
        <div class="pair"><label>Apoyo X<input type="number" bind:value={settings.anchor[0]} onchange={changed}/></label><label>Apoyo Y<input type="number" bind:value={settings.anchor[1]} onchange={changed}/></label></div>
        <div class="pair"><label>Altura de personaje<input type="number" min="4" max={settings.anchor[1]} bind:value={settings.targetHeight} onchange={changed}/></label><label>Colores de paleta<input type="number" min="4" max="64" bind:value={settings.colors} onchange={changed}/></label></div>
        <label>Fondo del material<select value={settings.background ? settings.background[1] === 255 ? 'green' : 'magenta' : 'alpha'} onchange={e => { settings.background = e.currentTarget.value === 'alpha' ? null : e.currentTarget.value === 'green' ? [0, 255, 0] : [255, 0, 255]; changed(); }}><option value="magenta">Magenta</option><option value="green">Verde</option><option value="alpha">Ya tiene transparencia</option></select></label>
        {#if settings.background}<label>Tolerancia de fondo · {settings.tolerance}<input type="range" min="0" max="255" bind:value={settings.tolerance} oninput={changed}/></label>{/if}
        <label class="check"><input type="checkbox" bind:checked={settings.outline} onchange={changed}/> Contorno interior de 1 píxel</label>
        <label class="check"><input type="checkbox" bind:checked={settings.stabilize} onchange={changed}/> Fijar el apoyo de cada fotograma</label>
        <p class="hint">El apoyo se estima por la silueta. Fijarlo corrige desplazamientos, pero también elimina saltos. Usa fuentes con el mismo encuadre para conservar la escala de poses sentadas.</p>
        <label>Carpeta pública de los PNG<input bind:value={settings.baseUrl} onchange={changed}/></label>
      </section>
    </div>
    <div class="main">
      <section id="character-cycle">
        <div class="section-heading"><div><span class="step">03 · FUENTES</span><h2>Una acción, varias vistas</h2></div>{#if onexample}<button onclick={() => run('Cargando ejemplo…', async () => { const sample = await onexample!(); if (destroyed) return; clearResult(); clearDownload(); art = emptyArt(); assistantRevision++; settings = defaultSettings(); settings.id = 'ejemplo-grey'; settings.baseUrl = '/pixelart/characters/ejemplo-grey'; settings.background = null; settings.outline = false; sources = sample; action = 'idle'; direction = 'se'; brief = { description: 'Personaje Grey de ejemplo, ya incluido en el juego', style: 'Pixel art', props: '', notes: {} }; notice = 'Ejemplo cargado desde los recursos existentes del juego. No se ha generado arte nuevo.'; })}>Cargar ejemplo del juego</button>{/if}</div>
        <div class="actions" aria-label="Acción">{#each actions as recipe}<button class:selected={action === recipe.action} aria-pressed={action === recipe.action} onclick={() => chooseView(recipe.action, direction)}>{recipe.action}<small>{recipe.frames} frames</small></button>{/each}</div>
        <div class="facings" aria-label="Orientación">{#each profile.directions as d}{@const own = sources[action]?.[d]}{@const reflected = !own && settings.mirror && MIRRORS[d] && sources[action]?.[MIRRORS[d]!]}<button class:selected={direction === d} aria-pressed={direction === d} onclick={() => chooseView(action, d)}>{d.toUpperCase()}<small>{own?.reviewed ? 'Aprobada' : own ? 'Por revisar' : reflected ? 'Reflejo' : 'Pendiente'}</small></button>{/each}</div>
        <div class="cycle-review">
          <h3>{action} · {orientationLabels[direction]}</h3>
          {#if viewReady}
            <div class="export-actions"><button class="primary" onclick={() => process(false, true)}>Revisar este ciclo</button>{#if active && pixelEditor}<button onclick={retouch}>Retocar en Piskel</button>{/if}</div>
            {#if selectedSheet && result && selectedSheet.directions.includes(direction)}
              <div class="result"><SheetPreview sheet={selectedSheet} url={urls[action]} settings={result.metadata.settings}/></div>
              {#if active}<button class="primary" onclick={approveCycle}>Aprobar ciclo y continuar</button>{/if}
            {/if}
            {#if active?.edits}<p class="hint">Este ciclo tiene retoques finales: conserva sus colores y posición. Los reflejos usan también esos retoques.</p><button onclick={() => { if (active) setSource({ ...active, edits: undefined }); }}>Restaurar desde la fuente original</button>{/if}
          {:else}<p class="hint">{shortAction ? 'Genera esta acción con ChatGPT o importa una imagen. Podrás revisarla y retocarla en Piskel.' : 'Importa el vídeo de esta vista desde Kling u otra herramienta. En cuanto esté listo podrás reproducirla y retocarla aquí, sin esperar a las otras orientaciones.'}</p>{/if}
        </div>
        {#if imageProvider}{#key `${assistantRevision}:${settings.profile}`}<ImageAssistant provider={imageProvider} {brief} profile={settings.profile} {action} {direction} bind:art onbusy={label => busy = label} onerror={message => error = message}/>{/key}{/if}
        {#if shortAction}
          {#if imageProvider}{#key `${assistantRevision}:${settings.id}:${settings.profile}:${action}:${direction}`}<ActionAssistant provider={imageProvider} {art} {brief} profile={settings.profile} {action} {direction} hasSource={!!active} onaccept={importGeneratedAction} onbusy={label => busy = label} onerror={message => error = message}/>{/key}{/if}
        {:else if videoProvider}<VideoAssistant provider={videoProvider} reference={art.references[direction]?.image} projectId={settings.id} profile={settings.profile} {action} {direction} suggestedPrompt={prompt.clips.find(c => c.action === action)!.prompt} negative={prompt.clips.find(c => c.action === action)!.negative} hasSource={!!active} revision={assistantRevision} onaccept={importGeneratedVideo} onbusy={label => busy = label}/>{/if}
        <details class="prompts"><summary>Prompts para {direction.toUpperCase()} / {action}</summary><p class="hint">Genera primero una vista aprobada. Usa esa imagen como referencia al crear las demás vistas y al animar. Los prompts están en inglés; puedes usarlos con cualquier proveedor.</p><label>Nota específica de esta orientación<textarea rows="2" value={brief.notes[direction] || ''} oninput={e => brief.notes[direction] = e.currentTarget.value} placeholder="Qué accesorio se ve, hacia dónde apunta…"></textarea></label><h3>Imagen de referencia</h3><textarea rows="5" readonly value={prompt.still}></textarea><button onclick={() => copy(prompt.still)}>Copiar prompt de imagen</button><h3>{shortAction ? 'Imagen de la acción' : 'Animación'}</h3><textarea rows="6" readonly value={prompt.clips.find(c => c.action === action)!.prompt}></textarea><button onclick={() => copy(prompt.clips.find(c => c.action === action)!.prompt)}>{shortAction ? 'Copiar prompt de la acción' : 'Copiar prompt de animación'}</button><h3>Evitar</h3><textarea rows="3" readonly value={prompt.clips.find(c => c.action === action)!.negative}></textarea><p class="hint">Sugerencia: clips de 5 segundos. Para sit basta una pose. Si tu herramienta lo permite, fija la misma referencia al inicio y al final.</p></details>
        {#if mirrored}<p class="notice">Esta dirección usa un reflejo de {MIRRORS[direction]!.toUpperCase()}. Puedes importar una vista para reemplazarlo.</p>{/if}
        <details id="character-import" class="manual-import" open><summary>{shortAction ? 'Importar imagen o secuencia corta' : 'Importar vídeo de Kling u otra herramienta'}</summary><p class="hint">{shortAction ? 'Puedes cargar la pose o los fotogramas de esta acción desde cualquier herramienta. No necesitas generar un vídeo.' : 'Usa la referencia aprobada para crear el vídeo y carga aquí el resultado. Conserva un ciclo completo con un paso de cada pierna. También puedes importar imágenes o una hoja existente.'}</p><div class="import-box"><label>Tipo de fuente<select bind:value={mode}><option value="video">Vídeo</option><option value="images">Imágenes ordenadas por nombre</option><option value="sheet">Una fila de una hoja PNG</option></select></label>
          <div class="pair"><label>{mode === 'video' ? 'Muestras por segundo' : 'FPS de la secuencia'}<input type="number" min="1" max="30" bind:value={sourceFps}/></label>{#if mode === 'video'}<label>Desde el segundo<input type="number" min="0" step="0.1" bind:value={start}/></label>{:else if mode === 'sheet'}<label>Columnas<input type="number" min="1" max="180" bind:value={columns}/></label>{/if}</div>
          {#if mode === 'video'}<label>Segundos a importar<input type="number" min="0.1" max="10" step="0.1" bind:value={seconds}/></label>{:else if mode === 'sheet'}<div class="pair"><label>Filas totales<input type="number" min="1" max="180" bind:value={rows}/></label><label>Fila a importar (desde 1)<input type="number" min="1" max={rows} bind:value={sourceRow}/></label></div>{/if}
          <label class="button primary">{active ? 'Reemplazar fuente' : 'Importar fuente'} · {action}/{direction.toUpperCase()}<input type="file" accept={mode === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/webp,image/jpeg'} multiple={mode === 'images'} onchange={importFiles}/></label>
          <p class="hint">Hasta 180 muestras por clip; se reducen a 192 px de lado mayor al importar. Vídeos: hasta 100 MB. Las secuencias conservan su ciclo completo; los vídeos buscan un cierre automáticamente.</p>
        </div></details>
        {#if active}<details class="source-options"><summary>Ajustes de la fuente original</summary><div class="source-review"><div>{#if rawUrl}<img src={rawUrl} alt={`Muestra ${rawFrame + 1} de la fuente ${action}/${direction}`}/>{/if}<label>Muestra {rawFrame + 1} / {active.frames.length}<input type="range" min="0" max={active.frames.length - 1} bind:value={rawFrame}/></label></div><div><p class="filename">{active.name}</p><p class="hint">{active.frames.length} muestras · {active.sourceFps} fps de origen</p><label class="check"><input type="checkbox" checked={!!active.range} onchange={e => setSource({ ...active, range: e.currentTarget.checked ? [0, active.frames.length] : undefined })}/> Elegir intervalo manual</label>{#if active.range}<div class="pair"><label>Primera muestra<input type="number" min="1" max={active.frames.length} value={active.range[0] + 1} onchange={e => crop('start', e.currentTarget.valueAsNumber)}/></label><label>Última muestra (incluida)<input type="number" min="1" max={active.frames.length} value={active.range[1]} onchange={e => crop('end', e.currentTarget.valueAsNumber)}/></label></div>{/if}<label>FPS de salida · 0 = automático<input type="number" min="0" max="30" step="0.1" value={active.playbackFps || 0} onchange={e => setSource({ ...active, playbackFps: e.currentTarget.valueAsNumber || undefined })}/></label><details><summary>Ajustar tamaño y apoyo de esta vista</summary><label>Multiplicador de escala<input type="number" min="0.5" max="2" step="0.01" value={active.scaleBias ?? 1} onchange={e => setSource({ ...active, scaleBias: e.currentTarget.valueAsNumber })}/></label><div class="pair"><label>Desplazar X (px)<input type="number" min="-256" max="256" value={active.offset?.[0] ?? 0} onchange={e => setSource({ ...active, offset: [e.currentTarget.valueAsNumber, active.offset?.[1] ?? 0] })}/></label><label>Desplazar Y (px)<input type="number" min="-256" max="256" value={active.offset?.[1] ?? 0} onchange={e => setSource({ ...active, offset: [active.offset?.[0] ?? 0, e.currentTarget.valueAsNumber] })}/></label></div></details><button onclick={() => setSource()}>Quitar esta fuente</button></div></div></details>{/if}
      </section>
      <section>
        <span class="step">04 · HOJAS</span><h2>Revisa y exporta</h2>
        <p class="hint">{missing.length ? `Pendientes: ${missing.join(', ')}` : 'Todas las orientaciones están cubiertas.'}</p>
        <div class="export-actions"><button disabled={!!missingSources(settings, sources, [action]).length} onclick={() => process(false)}>Ver todas las vistas de {action}</button><button class="primary" disabled={!!missing.length} onclick={() => process(true)}>Construir todas las hojas</button><button disabled={!fullResult} onclick={() => run('Exportando personaje…', async () => offerDownload(await exportCharacter(result!, $state.snapshot(brief)), `${settings.id}.zip`))}>Descargar personaje ZIP</button></div>
        {#if selectedSheet && result && selectedSheet.directions.length === profile.directions.length}<div class="result"><SheetPreview sheet={selectedSheet} url={urls[action]} settings={result.metadata.settings}/></div>{:else}<div class="empty">Importa las vistas necesarias y previsualiza el ciclo para comprobar el apoyo y la orientación.</div>{/if}
        {#if result?.metadata.warnings.length}<div class="notice"><strong>Revisar antes de usar</strong><ul>{#each result.metadata.warnings as warning}<li>{warning}</li>{/each}</ul></div>{/if}
        <p class="hint">El ZIP incluye un PNG por acción, character.json, el registro de procesamiento y los prompts. Para cambiar el personaje activo, copia los PNG a la carpeta indicada y conecta character.json con el catálogo del juego.</p>
      </section>
    </div>
  </fieldset>

</div>

<style>
  .inspiration{border:1px dashed #bdcbb0;border-radius:8px;padding:12px;margin:16px 0}.inspiration h3{font-size:13px;margin:0 0 8px}.inspiration img{display:block;max-width:100%;max-height:220px;object-fit:contain;margin:12px auto;border-radius:6px}
  .action-selection{border-block:1px solid #dce3d4;padding:14px 0;margin:14px 0}.action-checks{display:grid;gap:5px}.action-checks small{display:block;color:#687561;font-size:10px}
  .guide{display:flex;align-items:center;justify-content:space-between;gap:18px;background:#e8efdf}.guide h2{margin-bottom:8px}.cycle-review{border:1px solid #c4d1b7;border-radius:8px;padding:16px;margin:18px 0}.cycle-review h3{margin-top:0}.manual-import,.source-options{margin:18px 0}@media(max-width:600px){.guide{align-items:stretch;flex-direction:column}}
  .style-options{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 16px}.style-options button{font-size:10px;padding:6px 8px}
  .ready-file{position:sticky;top:8px;z-index:2;background:#e1eacd;border:1px solid #698849;padding:14px;border-radius:8px;overflow-wrap:anywhere}.ready-file a{color:#304535;font-weight:600;text-decoration:underline}
  .generator{color:#304535;font:14px/1.55 system-ui,sans-serif}.toolbar,.toolbar-actions,.section-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.toolbar-actions{justify-content:flex-end;flex-wrap:wrap}.tag,.step{font-size:10px;letter-spacing:1.7px;font-weight:700;color:#617d45}h1{font-size:clamp(26px,4vw,36px);line-height:1.2;margin:10px 0}h2{font-size:19px;margin:7px 0 20px}h3{font-size:13px;margin:18px 0 8px}p{margin:8px 0 14px}.local-note{font-size:12px;color:#64735d;margin:22px 0}.workspace{display:grid;grid-template-columns:310px minmax(0,1fr);gap:22px;border:0;padding:0;margin:0;min-width:0}.sidebar,.main{min-width:0}section{background:#fffdf5;border:1px solid #dce3d4;border-radius:12px;padding:22px;margin-bottom:22px}label{display:flex;flex-direction:column;gap:7px;font-size:12px;margin-bottom:14px}input,select,textarea,button,.button{font:inherit;box-sizing:border-box}input:not([type=checkbox]):not([type=range]):not([type=file]),select,textarea{width:100%;min-width:0;padding:9px 10px;border:1px solid #cbd7be;border-radius:6px;background:#fff;color:#304535}textarea{resize:vertical;line-height:1.5}button,.button{border:1px solid #bdcbb0;border-radius:6px;padding:9px 12px;background:#fff;color:#304535;font-size:12px;cursor:pointer;text-align:center;text-decoration:none}button:disabled{opacity:.4;cursor:default}.primary{background:#526e37;color:white;border-color:#526e37}.button{position:relative;overflow:hidden;display:inline-flex;margin:0;align-items:center;justify-content:center}.button input{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}.button:focus-within,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #698849;outline-offset:3px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{flex-direction:row;align-items:flex-start;gap:8px}.check input{margin-top:3px;accent-color:#526e37}.hint{font-size:11px;line-height:1.6;color:#687561}.notice,.error,.status p{border-radius:7px;padding:12px;font-size:12px}.notice{background:#f4efd4;color:#695421}.error{background:#fbece6;color:#933d2c}.status p{background:#e8efdf}.section-heading{align-items:flex-start;flex-wrap:wrap}.actions,.facings{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}.actions button,.facings button{flex:1;min-width:62px;padding:9px 7px}.actions small,.facings small{display:block;font-size:10px;font-weight:400;margin-top:4px;white-space:nowrap}.selected{background:#e1eacd;border-color:#698849;box-shadow:inset 0 0 0 1px #698849}.prompts{border-top:1px solid #dce3d4;padding-top:16px;margin:18px 0}summary{cursor:pointer;font-weight:600;font-size:12px}.prompts textarea{font-size:12px}.import-box{background:#f2f5eb;border:1px dashed #c4d1b7;border-radius:8px;padding:16px;margin-top:20px}.import-box .button{width:100%}.import-box .hint{margin-bottom:0}.source-review{display:grid;grid-template-columns:160px minmax(0,1fr);gap:20px;margin-top:22px}.source-review img{display:block;width:100%;height:170px;object-fit:contain;image-rendering:pixelated;background:repeating-conic-gradient(#d8dfd1 0% 25%,#eef1e8 0% 50%) 0/16px 16px;border-radius:8px;margin-bottom:10px}.filename{font-size:12px;overflow-wrap:anywhere;max-height:80px;overflow:auto}.export-actions{display:flex;flex-wrap:wrap;gap:10px}.result{margin-top:26px}.empty{margin:22px 0;padding:40px 20px;text-align:center;border:1px dashed #c4d1b7;border-radius:8px;font-size:12px;color:#687561}ul{padding-left:18px}li{margin-top:6px}input[type=range]{width:100%;accent-color:#526e37}.status:empty{display:none}
  @media(max-width:950px){.workspace{grid-template-columns:270px minmax(0,1fr)}section{padding:18px}.source-review{grid-template-columns:1fr}.source-review img{width:160px}.toolbar{align-items:flex-start}}
  @media(max-width:720px){.workspace{grid-template-columns:1fr}.toolbar{flex-direction:column;align-items:stretch}.toolbar-actions{justify-content:flex-start}.sidebar{display:grid;grid-template-columns:1fr}.source-review{grid-template-columns:120px minmax(0,1fr)}.source-review img{width:120px}.pair{gap:8px}.actions button{min-width:75px}}
  @media(max-width:420px){.source-review{grid-template-columns:1fr}}
</style>
