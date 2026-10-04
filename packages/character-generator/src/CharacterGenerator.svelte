<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { animationProgress, invalidateReference, resumeCursor, WIZARD_STEPS, type WizardStep, type WizardCursor } from './wizard';
  import { readDraft, writeDraft, type CharacterDraft } from './draft';
  import { strToU8 } from 'fflate';
  import { ACTION_LABELS, availableActions, actionRecipe, validateActionOptions, type ActionOptions, type ExportFormat, selectedActions, defaultSettings, MIRRORS, PROFILES, type BuildResult, type ClipInput, type PixelEditorProvider, type Direction, type Profile, type Sources } from './types';
  import { buildCharacter, missingSources } from './pipeline';
  import { createPrompts, type CharacterBrief } from './prompts';
  import { encodePNG, exportCharacter, importCharacterReference, loadProject, readImages, readSheet, readVideo, saveProject } from './browser';
  import WorkshopIcon from './WorkshopIcon.svelte';
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
  let generationMethod = $state<'image' | 'video'>('image');
  let mode = $state('video'), sourceFps = $state(24), seconds = $state(5), start = $state(0);
  let columns = $state(8), rows = $state(4), sourceRow = $state(1);
  let busy = $state(''), error = $state(''), notice = $state(''), progress = $state(0);
  let aborter = $state<AbortController | undefined>();
  let step = $state<WizardStep>(1), inputMethod = $state<'ai' | 'manual'>('ai');
  let draftReady = $state(false), pendingDraft = $state.raw<CharacterDraft | undefined>();
  let draftStatus = $state('Preparando guardado local…'), draftDirty = $state(false);
  const saveLabel = $derived(draftStatus.startsWith('No se pudo') || draftStatus.includes('no disponible') ? 'Guardar copia: fallo local' : !draftReady ? 'Preparando guardado' : pendingDraft ? 'Borrador disponible' : draftDirty ? 'Guardando cambios' : draftStatus.startsWith('Guardado en') ? 'Guardado local' : 'Guardado preparado');
  let saveQueue: Promise<void> = Promise.resolve(), draftRevision = 0;
  let previousReferences: Record<string,string> = {};
  let videoUpdates = $state<Record<string,VideoJob>>({});
  function recordVideo(job:VideoJob) {videoUpdates={...videoUpdates,[`${job.projectId}:${job.profile}:${job.action}:${job.direction}`]:job};}
  function videoLabel(pose:string,facing:Direction) {const job=videoUpdates[`${settings.id}:${settings.profile}:${pose}:${facing}`];return job?.status==='pending' || job?.status==='submitting' ? 'Generando vídeo' : job?.status==='failed' ? 'Generación fallida' : '';}
  let destroyed = false;
  const progressViews = $derived(animationProgress(settings,sources));
  const approvedViews = $derived(progressViews.filter(v=>v.status==='approved').length);
  const pendingReviews = $derived(progressViews.filter(v=>v.status!=='approved').length);
  const visibleReference = $derived(art.references[direction] ?? (settings.mirror && MIRRORS[direction] ? art.references[MIRRORS[direction]!] : undefined));
  const referenceMirrored = $derived(!art.references[direction] && !!visibleReference);
  function cursor(): WizardCursor { return {step,action,direction}; }
  async function goStep(value: WizardStep) {
    step=value; notice='';
    if(value===4 && viewReady) await process(false,true);
    await tick(); document.getElementById('wizard-title')?.focus();
  }
  function restoreState(project: {settings: typeof settings; brief: CharacterBrief; sources: Sources; art: typeof art; navigation?: WizardCursor}) {
    // ZIP imports are validated by loadProject; drafts retain unfinished form values.
    clearResult(); clearDownload();
    previousReferences=Object.fromEntries(Object.entries(project.art.references).map(([d,r])=>[d,r.image]));
    settings=project.settings; brief=project.brief; sources=project.sources; art=project.art; assistantRevision++;
    const saved=resumeCursor(settings,sources,art,!!imageProvider,project.navigation);
    chooseView(saved.action,saved.direction);step=saved.step;
  }
  async function recoverDraft() {
    if(!pendingDraft) return;
    const saved=pendingDraft;
    await run('Recuperando borrador local…',async()=>{restoreState(saved);pendingDraft=undefined;notice='Borrador recuperado con sus fuentes y retoques.';});
    if(step===4 && viewReady) await process(false,true);
  }
  async function importView(event: Event) {
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
    await run('Importando vista del personaje…',async()=>{
      const imported=await importCharacterReference(file);
      art={...art,references:{...art.references,[direction]:{image:imported.image,prompt:'Vista importada por el usuario',model:'manual'}}};
      notice=`Vista ${direction.toUpperCase()} preparada. Comprueba su orientación antes de animarla.`;
    });
  }
  async function loadExample() {
    if(!onexample)return;
    await run('Cargando ejemplo…',async()=>{
      const sample=await onexample!();if(destroyed)return;
      restoreState({settings:{...defaultSettings(),id:'ejemplo-grey',baseUrl:'/pixelart/characters/ejemplo-grey',background:null,outline:false},brief:{description:'Personaje Grey de ejemplo',style:'Pixel art',props:'',notes:{}},sources:sample,art:emptyArt(),navigation:{step:4,action:'idle',direction:'se'}});
      pendingDraft=undefined;
    });
    if(!error)await goStep(4);
  }
  function saveBackup() { return run('Preparando copia del proyecto…',async()=>offerDownload(await saveProject($state.snapshot(settings),$state.snapshot(brief),sources,$state.snapshot(art),cursor()),`${settings.id}.project.zip`)); }
  onMount(()=>{
    let alive=true;
    readDraft().then(saved=>{if(alive){if(saved?.version===1)pendingDraft=saved;draftReady=true;draftStatus=saved?'Hay un borrador anterior disponible.':'Guardado local preparado.';}}).catch(()=>{if(alive){draftReady=true;draftStatus='Guardado local no disponible. Descarga una copia del proyecto.';}});
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(draftDirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{alive=false;window.removeEventListener('beforeunload',beforeUnload);};
  });
  $effect(()=>{
    const refs=Object.fromEntries(Object.entries(art.references).map(([d,r])=>[d,r.image]));
    untrack(()=>{
      const changedDirections=Object.keys(previousReferences).filter(d=>previousReferences[d]!==refs[d]);
      if(changedDirections.length){for(const d of changedDirections)sources=invalidateReference(sources,d as Direction);clearResult();clearDownload();notice='Referencia actualizada. Conservamos las animaciones; revisa las vistas que dependían de ella.';}
      previousReferences=refs;
    });
  });
  $effect(()=>{
    const ready=draftReady && !pendingDraft;
    const data={settings:$state.snapshot(settings),brief:$state.snapshot(brief),sources,art:$state.snapshot(art),navigation:{step,action,direction}};
    if(!ready)return;
    const meaningful=JSON.stringify(data.settings)!==JSON.stringify(defaultSettings()) || data.brief.description.trim() || data.art.inspiration || Object.keys(data.art.references).length || Object.values(data.sources).some(d=>Object.values(d).some(Boolean));
    if(!meaningful)return;
    const revision=++draftRevision;
    draftDirty=true;draftStatus='Cambios pendientes de guardar…';
    const timer=setTimeout(()=>{
      draftStatus='Guardando en este navegador…';
      saveQueue=saveQueue.catch(()=>{}).then(()=>writeDraft({version:1,savedAt:Date.now(),...data})).then(()=>{if(!destroyed && revision===draftRevision){draftDirty=false;draftStatus=`Guardado en este navegador · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;}}).catch(()=>{if(!destroyed){draftDirty=true;draftStatus='No se pudo guardar localmente. Descarga una copia del proyecto.';}});
    },1200);
    return()=>clearTimeout(timer);
  });
  const profile = $derived(PROFILES[settings.profile]);
  const actions = $derived(selectedActions(settings));
  const actionChoices = $derived(availableActions(settings.profile).map(r=>actionRecipe(settings.profile,r.action,settings.actionOptions?.[r.action])!));
  const activeRecipe = $derived(actionRecipe(settings.profile,action,settings.actionOptions?.[action])!);
  const hasRetouchedFrames = $derived(Object.values(sources).some(d=>Object.values(d).some(c=>!!c?.edits)));
  const hasProfileAssets = $derived(Object.values(sources).some(d=>Object.values(d).some(Boolean)) || Object.keys(art.references).length>0);
  const exportFormat = $derived(settings.exportFormat ?? (settings.profile === 'game' ? 'game' : 'generic'));
  const canExportGame = $derived(settings.profile === 'game' && actions.every(r=>r.playback !== 'once'));
  const active = $derived(sources[action]?.[direction]);
  const shortAction = $derived(shortActionRecipe(settings.profile, action, settings.actionOptions?.[action]));
  const useImage = $derived(!!shortAction && !!imageProvider && (generationMethod === 'image' || !videoProvider));
  const mirrored = $derived(!active && settings.mirror && MIRRORS[direction] ? sources[action]?.[MIRRORS[direction]!] : undefined);
  const missing = $derived(missingSources(settings, sources));
  const recipes = $derived(createPrompts(brief, settings.profile, false, settings.actions, 'auto', settings.actionOptions));
  const prompt = $derived(recipes.find(r => r.direction === direction)!);
  const videoPrompt = $derived(createPrompts(brief, settings.profile, false, settings.actions, 'video', settings.actionOptions).find(r => r.direction === direction)!.clips.find(c => c.action === action)!);
  const actionPrompt = $derived(useImage ? prompt.clips.find(c => c.action === action)! : videoPrompt);
  const selectedSheet = $derived(result?.sheets.find(s => s.action === action));
  const previewSheet = $derived(selectedSheet && selectedSheet.directions.includes(direction) ? selectedSheet : undefined);

  const viewReady = $derived(!!(active || mirrored));
  const fullResult = $derived(result && result.character.directions.length === profile.directions.length && actions.every(a => result!.character.animations[a.action]));

  async function downloadSheets() {
    if(busy || missing.length || pendingReviews) return;
    await process(true);
    if(error || !fullResult || !result) return;
    await run('Preparando descarga…', async()=> {
      const bytes=await exportCharacter(result!, $state.snapshot(brief), exportFormat);
      offerDownload(bytes, `${settings.id}.zip`);
      if(downloadLink){const link=document.createElement('a');link.href=downloadLink.url;link.download=downloadLink.name;link.click();notice='Descarga preparada. Si no se inicia, utiliza el enlace.';}
    });
  }
  function viewStatus(pose:string,facing:Direction) {
    const view=progressViews.find(v=>v.action===pose && v.direction===facing)!;
    return `${videoLabel(pose,facing) || (view.status==='approved' ? 'Aprobada' : view.status==='review' ? 'Por revisar' : 'Pendiente')}${view.reflected ? ' · reflejo' : ''}`;
  }
  function clearResult() { Object.values(urls).forEach(URL.revokeObjectURL); urls = {}; result = null; }
  function clearDownload() { if (downloadLink) URL.revokeObjectURL(downloadLink.url); downloadLink = null; }
  function offerDownload(data: Uint8Array, name: string, type = 'application/zip') {
    if (destroyed) return;
    clearDownload();
    downloadLink = { url: URL.createObjectURL(new Blob([new Uint8Array(data)], { type })), name };
    notice = 'Archivo preparado. Pulsa el enlace para guardarlo en tu equipo.';
  }
  function processingChanged() { sources=Object.fromEntries(Object.entries(sources).map(([a,dirs])=>[a,Object.fromEntries(Object.entries(dirs).map(([d,c])=>[d,{...c,reviewed:false}]))])); changed(); }
  function changed() { clearResult(); clearDownload(); error = ''; notice = ''; }
  function chooseView(pose: string, facing: Direction) {
    if (!!shortActionRecipe(settings.profile, pose, settings.actionOptions?.[pose]) !== !!shortAction) mode = shortActionRecipe(settings.profile, pose, settings.actionOptions?.[pose]) ? 'images' : 'video';
    action = pose; direction = facing; rawFrame = 0;
  }
  function continueWorkflow() {
    const task = workflowTasks($state.snapshot(settings), sources, $state.snapshot(art), inputMethod==='ai' && !!imageProvider)[0];
    if (!task) { step=5; void process(true); return; }
    chooseView(task.action, task.direction);
    void goStep(task.step === 'review' ? 4 : task.step === 'reference' ? 2 : 3);
  }
  function approveCycle() {
    if (!active || !previewSheet) return;
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
  function setProfile(value: Profile) {
    if (hasProfileAssets) return;
    settings.profile = value; settings.actions = undefined; settings.actionOptions = undefined;
    settings.exportFormat = value === 'game' ? 'game' : 'generic';
    assistantRevision++; chooseView('idle', PROFILES[value].initialDirection); changed();
  }
  function hasEdits(name:string) { return Object.values(sources[name] ?? {}).some(c=>!!c?.edits); }
  function configureAction(name:string, update:ActionOptions) {
    const current=actionRecipe(settings.profile,name,settings.actionOptions?.[name])!;
    if (update.frames !== undefined && hasEdits(name)) return;
    const options={frames:current.frames,fps:current.fps,playback:current.playback,...update};
    try { validateActionOptions(options); } catch(e) { error=(e as Error).message; return; }
    settings.actionOptions={...settings.actionOptions,[name]:options};
    if(options.playback==='once') settings.exportFormat='generic';
    sources={...sources,[name]:Object.fromEntries(Object.entries(sources[name] ?? {}).map(([d,c])=>[d,c ? {...c,reviewed:false} : c]))};
    assistantRevision++; changed();
  }
  function newCharacter() {
    if(hasProfileAssets && !window.confirm('¿Empezar otro personaje? Guarda una copia ZIP para conservar este proyecto antes de sustituirlo.'))return;
    pendingDraft=undefined;draftRevision++;draftDirty=false;draftStatus='Listo para crear otro personaje.';
    previousReferences={}; step=1; changed(); settings = defaultSettings(); sources = {}; art = emptyArt(); assistantRevision++;
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
    if(!error && viewReady) await goStep(4);
  }
  async function importGeneratedVideo(blob: Blob, job: VideoJob) {
    if (busy || job.projectId !== settings.id || job.profile !== settings.profile || job.action !== action || job.direction !== direction) return false;
    let imported = false;
    await run('Importando vídeo de Kling…', async () => {
      aborter = new AbortController();
      const clip = await readVideo(new File([blob], `${job.projectId}-${job.action}-${job.direction}.mp4`, { type: 'video/mp4' }), { start: 0, seconds: 5, fps: 24, signal: aborter.signal, onprogress: p => progress = p });
      if (!destroyed) { setSource(clip); imported = true; }
    });
    if (imported) await goStep(4);
    return imported;
  }
  async function importGeneratedAction(image: ImageResult, request: ImageRequest) {
    const recipe = shortActionRecipe(request.profile, request.action, request.recipe);
    if (busy || request.kind !== 'action' || !recipe || request.profile !== settings.profile || request.action !== action || request.direction !== direction) return false;
    let imported = false;
    await run('Preparando los fotogramas de OpenAI…', async () => {
      if (image.frames !== recipe.frames || image.columns !== recipe.frames || image.rows !== 1) throw new Error('La imagen no tiene la cuadrícula esperada para esta acción.');
      const file = new File([new Uint8Array(pngData(image.image, 20_000_000))], `openai-${request.action}-${request.direction}.png`, { type: 'image/png' });
      const clip = await readSheet(file, image.columns, image.rows, 0, recipe.fps);
      if (!destroyed) { setSource(clip); imported = true; }
    });
    if (imported) await goStep(4);
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
        notice = '';
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
      restoreState(project); pendingDraft=undefined; notice = 'Proyecto recuperado con sus imágenes fuente y referencias.';
    });
    if(step===4 && viewReady) await process(false,true);
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
  <header class="toolbar"><div><h1>Taller de personajes</h1><span class="project-name">{settings.id}</span></div>
    <div class="toolbar-actions"><button disabled={!!busy} onclick={newCharacter}>Nuevo personaje</button><label class="button secondary">Abrir proyecto<input type="file" accept=".zip" disabled={!!busy} onchange={openProject}/></label><button disabled={!!busy} onclick={saveBackup}>Guardar copia</button></div>
  </header>
  <details class="save-status"><summary><WorkshopIcon name={saveLabel.startsWith('Guardar copia') ? 'close' : draftDirty ? 'clock' : 'check'} size={14}/>{saveLabel}</summary><p aria-live="polite">{draftStatus}</p><p>Guarda una copia ZIP para llevar el proyecto a otro equipo.</p></details>
  {#if pendingDraft}<section class="recovery"><h2>Continúa donde lo dejaste</h2><p>Borrador de {pendingDraft.settings.id} · {new Date(pendingDraft.savedAt).toLocaleString()}</p><button class="primary" disabled={!!busy} onclick={recoverDraft}>Recuperar borrador</button><button disabled={!!busy} onclick={()=>{pendingDraft=undefined;draftStatus='El próximo cambio se guardará como nuevo borrador.';}}>Continuar con esta sesión</button><p class="hint">El borrador anterior se conservará hasta que guardemos cambios de esta sesión.</p></section>{/if}
  <nav class="steps" aria-label="Pasos del personaje">{#each WIZARD_STEPS as label,index}<button disabled={!!busy} class:current={step===index+1} aria-current={step===index+1 ? 'step' : undefined} onclick={()=>goStep((index+1) as WizardStep)}><span>{index+1}</span>{label}</button>{/each}</nav>
  <div class="wizard-heading"><h2 id="wizard-title" tabindex="-1">{step}. {WIZARD_STEPS[step-1]}</h2><span>{approvedViews}/{progressViews.length} vistas aprobadas</span></div>
  <progress class="overall-progress" max={progressViews.length} value={approvedViews} aria-label="Vistas de animación aprobadas"></progress>
  <div class="status" aria-live="polite">{#if busy}<p>{busy}{progress ? ` ${Math.round(progress*100)} %` : ''}</p>{:else if notice}<p>{notice}<button class="icon-button" aria-label="Cerrar aviso" onclick={()=>notice=''}><WorkshopIcon name="close" size={14}/></button></p>{/if}</div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if downloadLink}<p class="ready-file"><a href={downloadLink.url} download={downloadLink.name}>Descargar {downloadLink.name}</a></p>{/if}
  {#if busy && aborter}<button onclick={()=>aborter?.abort()}>Cancelar importación</button>{/if}
  <fieldset disabled={!!busy} class="wizard-layout" class:review-layout={step===4}>
    <div class="panels">
      <div hidden={step!==1}><section aria-labelledby="format-title" class="format-panel">
        <h2 id="format-title">Formato y dimensiones</h2>

        <label>Tipo de juego<select disabled={hasProfileAssets} value={settings.profile} onchange={e => setProfile(e.currentTarget.value as Profile)}>{#each Object.entries(PROFILES) as [id, p]}<option value={id}>{p.label}</option>{/each}</select></label>
        {#if hasProfileAssets}<p class="hint">Tipo bloqueado: este personaje ya tiene imágenes. Crea otro proyecto para cambiarlo.</p>{/if}
        {#if settings.profile !== 'game'}<p class="notice">{settings.profile === 'platformer' ? 'Cámara lateral: derecha e izquierda. Saltar, caer y morir conservan su desplazamiento vertical; deja margen en la celda para todo el movimiento.' : 'Cámara isométrica con ocho orientaciones.'} Exporta como hojas genéricas para integrarlas en otro juego.</p>{/if}
        <h3>Estilo visual</h3>
        <div class="style-options"><button onclick={() => brief.style = 'Pixel art, crisp pixels, limited earthy palette, dark inner outline, large head, compact body'}>Píxel clásico</button><button onclick={() => brief.style = 'Soft illustrated game character, clean shapes, warm pastel palette, gentle shading, readable silhouette'}>Ilustrado suave</button><button onclick={() => brief.style = 'Low-poly game character, faceted shapes, matte colors, consistent soft lighting'}>Low poly</button></div><details class="style-detail"><summary>Personalizar estilo</summary><label>Descripción del estilo<textarea rows="3" bind:value={brief.style}></textarea></label></details>
        <h3>Tamaño de cada fotograma</h3>
        <div class="pair"><label>Ancho (px)<input type="number" min="16" max="256" disabled={hasRetouchedFrames} bind:value={settings.width} onchange={processingChanged}/></label><label>Alto (px)<input type="number" min="16" max="256" disabled={hasRetouchedFrames} bind:value={settings.height} onchange={processingChanged}/></label></div>        <label>Altura del personaje (px)<input type="number" min="4" max={settings.anchor[1]} bind:value={settings.targetHeight} onchange={processingChanged}/></label>
        {#if hasRetouchedFrames}<p class="hint">Tamaño bloqueado por retoques de Piskel. Puedes restaurar las fuentes en Revisar.</p>{/if}
        <details class="advanced"><summary>Apoyo, paleta y fondo</summary>
        <div class="pair"><label>Apoyo X<input type="number" bind:value={settings.anchor[0]} onchange={processingChanged}/></label><label>Apoyo Y<input type="number" bind:value={settings.anchor[1]} onchange={processingChanged}/></label></div><label>Colores de paleta<input type="number" min="4" max="64" bind:value={settings.colors} onchange={processingChanged}/></label>        <label>Fondo del material<select value={settings.background ? settings.background[1] === 255 ? 'green' : 'magenta' : 'alpha'} onchange={e => { settings.background = e.currentTarget.value === 'alpha' ? null : e.currentTarget.value === 'green' ? [0, 255, 0] : [255, 0, 255]; processingChanged(); }}><option value="magenta">Magenta</option><option value="green">Verde</option><option value="alpha">Ya tiene transparencia</option></select></label>
        {#if settings.background}<label>Tolerancia de fondo · {settings.tolerance}<input type="range" min="0" max="255" bind:value={settings.tolerance} oninput={processingChanged}/></label>{/if}
        <label class="check"><input type="checkbox" bind:checked={settings.outline} onchange={processingChanged}/> Contorno interior de 1 píxel</label>
        <label class="check"><input type="checkbox" bind:checked={settings.stabilize} onchange={processingChanged}/> Fijar el apoyo de cada fotograma</label>
        <p class="hint">El apoyo se estima por la silueta. Saltar, caer y morir conservan el movimiento vertical aunque marques esta opción. En las demás acciones, fijar el apoyo corrige desplazamientos y elimina saltos. Usa fuentes con el mismo encuadre para conservar la escala entre poses.</p>
        </details>
        <details class="sheet-sizes"><summary>Tamaño calculado de las hojas · {profile.directions.length} orientaciones</summary><p class="hint">Cada acción ocupa una hoja: los fotogramas son las columnas y las orientaciones son las filas.</p><div class="sizes-scroll"><table><thead><tr><th>Acción</th><th>Cuadrícula</th><th>Hoja (px)</th></tr></thead><tbody>{#each actions as recipe}<tr><th scope="row">{ACTION_LABELS[recipe.action]}</th><td>{recipe.frames} × {profile.directions.length}</td><td>{Number.isFinite(settings.width) && Number.isFinite(settings.height) ? `${settings.width*recipe.frames} × ${settings.height*profile.directions.length}` : '—'}</td></tr>{/each}</tbody></table></div></details>
      </section>
      <section>
        <h2>Define tu personaje</h2>{#if onexample && settings.profile==='game'}<details class="example"><summary>Probar con el personaje de ejemplo</summary><p class="hint">Carga las animaciones incluidas en el juego para conocer el recorrido.</p><button onclick={loadExample}>Cargar ejemplo del juego</button></details>{/if}
        <label>Nombre del proyecto (sin espacios)<input value={settings.id} oninput={e => { settings.id = e.currentTarget.value; settings.baseUrl = `/pixelart/characters/${settings.id}`; changed(); }} placeholder="mi-personaje"/></label>
        <details class="action-selection"><summary>Acciones del personaje · {actions.length} seleccionadas</summary>
          <p class="hint">Solo se exportarán las acciones seleccionadas.</p>
          <div class="action-checks">{#each actionChoices as recipe}<label class="check"><input type="checkbox" checked={actions.some(a => a.action === recipe.action)} disabled={actions.length === 1 && actions[0].action === recipe.action} onchange={e => toggleAction(recipe.action, e.currentTarget.checked)}/><span>{ACTION_LABELS[recipe.action]} <small>({recipe.action}) · {recipe.frames} fotogramas</small></span></label>
          {#if actions.some(a=>a.action===recipe.action)}<details class="action-config"><summary>Ajustar {ACTION_LABELS[recipe.action]}</summary>
            <div class="pair"><label>Fotogramas · {recipe.action}<input type="number" min="1" max="16" value={recipe.frames} disabled={hasEdits(recipe.action)} onchange={e=>configureAction(recipe.action,{frames:e.currentTarget.valueAsNumber})}/></label>
            <label>FPS · {recipe.action}<input type="number" min="1" max="30" step="0.1" value={recipe.fps} onchange={e=>configureAction(recipe.action,{fps:e.currentTarget.valueAsNumber})}/></label></div>
            <label>Reproducción · {recipe.action}<select value={recipe.playback ?? 'loop'} onchange={e=>configureAction(recipe.action,{playback:e.currentTarget.value as 'loop'|'once'})}><option value="loop">En bucle</option><option value="once">Una vez · mantener última pose</option></select></label>
            <p class="hint">Un FPS ajustado en una vista concreta tiene prioridad sobre el de la acción.</p>
            {#if hasEdits(recipe.action)}<p class="hint">La cantidad de fotogramas está bloqueada para conservar los retoques de Piskel. Restaura las fuentes retocadas de esta acción si necesitas cambiarla.</p>{/if}
          </details>{/if}{/each}</div>
          <p class="hint">Las fuentes de acciones desmarcadas se conservan en el proyecto. Las acciones de hasta 4 fotogramas admiten ChatGPT o Kling. Las demás usan vídeo. También puedes importar tus archivos.</p>
          {#if settings.profile === 'game'}<p class="hint">El jugador del juego actual necesita las seis acciones básicas. Las acciones adicionales se exportan para su integración posterior.</p>{/if}
        </details>
        <div class="inspiration"><h3>Foto o imagen de referencia</h3>
          <p class="hint">Una imagen de cuerpo entero ayuda a definir ropa y accesorios.</p>
          <label class="button">{art.inspiration ? 'Cambiar imagen de referencia' : 'Subir foto o referencia'}<input type="file" accept="image/png,image/jpeg,image/webp" onchange={importInspiration}/></label>
          {#if art.inspiration}<img src={art.inspiration.image} alt="Foto o referente del personaje"/><p class="hint">{art.inspiration.name}</p><button onclick={() => { art = { ...art, inspiration: undefined }; assistantRevision++; clearDownload(); }}>Quitar foto de referencia</button>{/if}
          <p class="hint">PNG, JPG o WebP · hasta 20 MB. Se guarda con el proyecto. {imageProvider ? 'Solo se envía a OpenAI al generar una vista.' : 'Puedes usarla como guía visual y continuar con la importación manual.'}</p>
        </div>
        <label>{art.inspiration ? 'Descripción o cambios (opcional)' : 'Descripción'}<textarea rows="3" bind:value={brief.description} placeholder={art.inspiration ? 'Qué mantener o cambiar: misma ropa, añadir una mochila…' : 'Exploradora con chaqueta verde, pelo corto y botas…'}></textarea></label>
        <label>Accesorios y lado del cuerpo<textarea rows="2" bind:value={brief.props} placeholder="Mochila azul, herramienta en la mano derecha…"></textarea></label>
        <label class="check"><input type="checkbox" bind:checked={settings.mirror} onchange={changed}/> {settings.profile === 'platformer' ? 'Crear izquierda por reflejo de derecha' : 'Completar las vistas opuestas con reflejos'}</label>
        <p class="hint">Para diseños asimétricos, desactiva los reflejos o importa una vista propia. La vista importada tiene prioridad.</p>
        <details><summary>Prompts y opciones avanzadas</summary><button onclick={() => offerDownload(strToU8(JSON.stringify({ brief: $state.snapshot(brief), recipes: createPrompts($state.snapshot(brief), settings.profile, settings.mirror, settings.actions, 'auto', settings.actionOptions) }, null, 2)), `${settings.id}-prompts.json`, 'application/json')}>Descargar todos los prompts</button></details>
      </section><div class="step-footer"><button class="primary" onclick={()=>goStep(2)}>Continuar a las vistas →</button></div></div>
      <div hidden={step!==2}><section><h2>El aspecto desde cada lado</h2><p class="hint">Una referencia por orientación, compartida por todas las acciones.</p>
        <div class="reference-grid">{#each profile.directions as d}{@const ref=art.references[d]}{@const mirror=!ref && settings.mirror && MIRRORS[d] ? art.references[MIRRORS[d]!] : undefined}<button aria-pressed={direction===d} class:selected={direction===d} onclick={()=>chooseView(action,d)}>{#if ref || mirror}<img class:flipped={!!mirror} src={(ref ?? mirror)!.image} alt={`Referencia ${d.toUpperCase()}`}/>{/if}<strong>{d.toUpperCase()}</strong><small>{ref ? 'Preparada' : mirror ? 'Por reflejo' : 'Pendiente'}</small></button>{/each}</div>
        <p class="hint">{orientationLabels[direction]}</p>
        {#if art.references[direction]}<div class="reference-tools"><a class="button" href={art.references[direction]!.image} download={`referencia-${direction}.png`}><WorkshopIcon name="download" size={14}/> PNG</a><button onclick={()=>{const refs={...art.references};delete refs[direction];art={...art,references:refs};}}>Quitar referencia {direction.toUpperCase()}</button></div>{/if}
        <label class="button">Importar vista {direction.toUpperCase()}<input type="file" accept="image/png,image/jpeg,image/webp" onchange={importView}/></label>
                {#if imageProvider}{#key `${assistantRevision}:${settings.profile}`}<ImageAssistant provider={imageProvider} {brief} profile={settings.profile} {action} {direction} bind:art onbusy={label => busy = label} onerror={message => error = message}/>{/key}{/if}

        <div class="step-footer"><button onclick={()=>goStep(1)}>← Personaje</button><button class="primary" onclick={()=>goStep(3)}>Continuar a las animaciones →</button></div><p class="hint">También puedes continuar sin referencias si vas a importar animaciones existentes.</p>
      </section></div>
      <div hidden={step<3 || step===5}>        <div class="actions" aria-label="Acción">{#each actions as recipe}<button class:selected={action === recipe.action} aria-pressed={action === recipe.action} onclick={() => {chooseView(recipe.action, direction);if(step===4)void goStep(4);}}>{ACTION_LABELS[recipe.action]}<small title="Vistas aprobadas">{progressViews.filter(v=>v.action===recipe.action && v.status==='approved').length}/{profile.directions.length}</small></button>{/each}</div>
        <div class="facings" aria-label="Orientación">{#each profile.directions as d}{@const view=progressViews.find(v=>v.action===action && v.direction===d)!}<button class:selected={direction === d} aria-pressed={direction === d} aria-label={`${d.toUpperCase()} · ${viewStatus(action,d)}`} title={viewStatus(action,d)} onclick={() => {chooseView(action, d);if(step===4)void goStep(4);}}>{d.toUpperCase()}<WorkshopIcon size={14} name={videoLabel(action,d) ? 'clock' : view.status==='approved' ? 'check' : view.status==='review' ? 'clock' : 'minus'}/></button>{/each}</div>
</div>
      <div hidden={step!==3}><section id="character-cycle"><h2>{ACTION_LABELS[action]} · {direction.toUpperCase()}</h2>
        <div class="generation-choice" role="group" aria-label="Origen de la animación">
          {#if videoProvider}<button aria-pressed={inputMethod==='ai' && !useImage} onclick={()=>{inputMethod='ai';generationMethod='video';}}>Kling</button>{/if}
          {#if shortAction && imageProvider}<button aria-pressed={inputMethod==='ai' && useImage} onclick={()=>{inputMethod='ai';generationMethod='image';}}>ChatGPT</button>{/if}
          <button aria-pressed={inputMethod==='manual'} onclick={()=>inputMethod='manual'}>Importar archivo</button>
        </div>
        <div hidden={inputMethod!=='ai'}>{#if !imageProvider && !videoProvider}<p>La generación por API no está configurada. Puedes importar imágenes o vídeos.</p>{/if}{#if !art.references[direction]}<p class="notice">Prepara una referencia para generar esta orientación.</p><button onclick={()=>goStep(2)}>Preparar referencia {direction.toUpperCase()}</button>{/if}
        {#if shortAction && imageProvider}<div hidden={!useImage}>
          {#key `${assistantRevision}:${settings.id}:${settings.profile}:${action}:${direction}`}<ActionAssistant provider={imageProvider} {art} {brief} profile={settings.profile} {action} {direction} options={settings.actionOptions?.[action]} hasSource={!!active} onaccept={importGeneratedAction} onbusy={label => busy = label} onerror={message => error = message}/>{/key}</div>{/if}
        {#if videoProvider}<div hidden={useImage}><VideoAssistant onjob={recordVideo} provider={videoProvider} reference={art.references[direction]?.image} projectId={settings.id} profile={settings.profile} {action} {direction} suggestedPrompt={videoPrompt.prompt} negative={videoPrompt.negative} hasSource={!!active} revision={assistantRevision} onaccept={importGeneratedVideo} onbusy={label => busy = label}/></div>{/if}
</div>
        <div hidden={inputMethod!=='manual'}>        {#if mirrored}<p class="notice">Esta dirección usa un reflejo de {MIRRORS[direction]!.toUpperCase()}. Puedes importar una vista para reemplazarlo.</p>{/if}
        <details id="character-import" class="manual-import" open><summary>{shortAction ? 'Importar imágenes, hoja o vídeo' : 'Importar vídeo de Kling u otra herramienta'}</summary><p class="hint">{shortAction ? 'Puedes cargar imágenes, una hoja o un vídeo para esta acción desde cualquier herramienta.' : activeRecipe.playback === 'once' ? 'Importa la acción completa, desde el inicio hasta la última pose. Puedes recortar el intervalo antes de revisarla.' : 'Usa la referencia aprobada para crear el vídeo y carga aquí el resultado. Conserva un ciclo completo. También puedes importar imágenes o una hoja existente.'}</p><div class="import-box"><label>Tipo de fuente<select bind:value={mode}><option value="video">Vídeo</option><option value="images">Imágenes ordenadas por nombre</option><option value="sheet">Una fila de una hoja PNG</option></select></label>
          <div class="pair"><label>{mode === 'video' ? 'Muestras por segundo' : 'FPS de la secuencia'}<input type="number" min="1" max="30" bind:value={sourceFps}/></label>{#if mode === 'video'}<label>Desde el segundo<input type="number" min="0" step="0.1" bind:value={start}/></label>{:else if mode === 'sheet'}<label>Columnas<input type="number" min="1" max="180" bind:value={columns}/></label>{/if}</div>
          {#if mode === 'video'}<label>Segundos a importar<input type="number" min="0.1" max="10" step="0.1" bind:value={seconds}/></label>{:else if mode === 'sheet'}<div class="pair"><label>Filas totales<input type="number" min="1" max="180" bind:value={rows}/></label><label>Fila a importar (desde 1)<input type="number" min="1" max={rows} bind:value={sourceRow}/></label></div>{/if}
          <label class="button primary">{active ? 'Reemplazar fuente' : 'Importar fuente'} · {action}/{direction.toUpperCase()}<input type="file" accept={mode === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/webp,image/jpeg'} multiple={mode === 'images'} onchange={importFiles}/></label>
          <p class="hint">Hasta 180 muestras por clip; se reducen a 192 px de lado mayor al importar. Vídeos: hasta 100 MB. {activeRecipe.playback === 'once' ? 'Se conserva la secuencia completa, sin buscar un cierre repetitivo.' : 'Las secuencias conservan su ciclo completo; los vídeos buscan un cierre automáticamente.'}</p>
        </div></details>
</div>
                <details class="prompts" hidden={inputMethod!=='manual'}><summary>Prompts para {direction.toUpperCase()} / {action}</summary><p class="hint">Genera primero una vista aprobada. Usa esa imagen como referencia al crear las demás vistas y al animar. Los prompts están en inglés; puedes usarlos con cualquier proveedor.</p><label>Nota específica de esta orientación<textarea rows="2" value={brief.notes[direction] || ''} oninput={e => brief.notes[direction] = e.currentTarget.value} placeholder="Qué accesorio se ve, hacia dónde apunta…"></textarea></label><h3>Imagen de referencia</h3><textarea rows="5" readonly value={prompt.still}></textarea><button onclick={() => copy(prompt.still)}>Copiar prompt de imagen</button><h3>{useImage ? 'Imagen de la acción' : 'Animación'}</h3><textarea rows="6" readonly value={actionPrompt.prompt}></textarea><button onclick={() => copy(actionPrompt.prompt)}>{useImage ? 'Copiar prompt de la acción' : 'Copiar prompt de animación'}</button><h3>Evitar</h3><textarea rows="3" readonly value={prompt.clips.find(c => c.action === action)!.negative}></textarea><p class="hint">Sugerencia: clips de 5 segundos. {activeRecipe.playback === 'once' ? 'Conserva la acción completa y su última pose; no fijes la misma imagen al inicio y al final.' : 'Para sit basta una pose. En acciones repetidas puedes fijar la misma referencia al inicio y al final.'}</p></details>

        <div class="step-footer"><button onclick={()=>goStep(2)}>← Vistas</button><button class="primary" disabled={!viewReady} onclick={()=>goStep(4)}>Revisar esta animación →</button></div>
      </section></div>
      <div hidden={step!==4}><section><h2>Revisa {ACTION_LABELS[action].toLowerCase()} · {direction.toUpperCase()}</h2>
        {#if viewReady}<p class="hint">Comprueba el movimiento y el apoyo antes de aprobar.</p><div class="export-actions"><button class="icon-button" aria-label="Actualizar vista previa" title="Actualizar vista previa" onclick={()=>process(false,true)}><WorkshopIcon name="refresh"/></button>{#if active && pixelEditor}<button onclick={retouch}><WorkshopIcon name="edit" size={16}/> Retocar en Piskel</button>{/if}</div>
          {#if active?.edits}<p class="hint">Los retoques conservan colores y posición; también se aplican a las vistas por reflejo.</p><button onclick={()=>{if(active)setSource({...active,edits:undefined});}}>Restaurar fuente original</button>{/if}
                  {#if active}<details class="source-options"><summary>Intervalo, velocidad y posición</summary><div class="source-review"><div>{#if rawUrl}<img src={rawUrl} alt={`Muestra ${rawFrame + 1} de la fuente ${action}/${direction}`}/>{/if}<label>Muestra {rawFrame + 1} / {active.frames.length}<input type="range" min="0" max={active.frames.length - 1} bind:value={rawFrame}/></label></div><div><p class="filename">{active.name}</p><p class="hint">{active.frames.length} muestras · {active.sourceFps} fps de origen</p><label class="check"><input type="checkbox" checked={!!active.range} onchange={e => setSource({ ...active, range: e.currentTarget.checked ? [0, active.frames.length] : undefined })}/> Elegir intervalo manual</label>{#if active.range}<div class="pair"><label>Primera muestra<input type="number" min="1" max={active.frames.length} value={active.range[0] + 1} onchange={e => crop('start', e.currentTarget.valueAsNumber)}/></label><label>Última muestra (incluida)<input type="number" min="1" max={active.frames.length} value={active.range[1]} onchange={e => crop('end', e.currentTarget.valueAsNumber)}/></label></div>{/if}<label>FPS de salida · 0 = automático<input type="number" min="0" max="30" step="0.1" value={active.playbackFps || 0} onchange={e => setSource({ ...active, playbackFps: e.currentTarget.valueAsNumber || undefined })}/></label><details><summary>Ajustar tamaño y apoyo de esta vista</summary><label>Multiplicador de escala<input type="number" min="0.5" max="2" step="0.01" value={active.scaleBias ?? 1} onchange={e => setSource({ ...active, scaleBias: e.currentTarget.valueAsNumber })}/></label><div class="pair"><label>Desplazar X (px)<input type="number" min="-256" max="256" value={active.offset?.[0] ?? 0} onchange={e => setSource({ ...active, offset: [e.currentTarget.valueAsNumber, active.offset?.[1] ?? 0] })}/></label><label>Desplazar Y (px)<input type="number" min="-256" max="256" value={active.offset?.[1] ?? 0} onchange={e => setSource({ ...active, offset: [active.offset?.[0] ?? 0, e.currentTarget.valueAsNumber] })}/></label></div></details><button onclick={() => setSource()}>Quitar esta fuente</button></div></div></details>{/if}

          {#if mirrored}<p class="notice">Esta vista refleja {MIRRORS[direction]!.toUpperCase()}. Revisa y aprueba la original.</p><button onclick={()=>{chooseView(action,MIRRORS[direction]!);void goStep(4);}}>Revisar original</button>{/if}
          <button class="text-button" onclick={()=>goStep(1)}><WorkshopIcon name="settings" size={14}/> Formato y dimensiones</button>
          {#if result?.metadata.warnings.length}<div class="notice"><ul>{#each result.metadata.warnings as warning}<li>{warning}</li>{/each}</ul></div>{/if}
        {:else}<p>Esta vista todavía no tiene animación.</p><button onclick={()=>goStep(3)}>Crear o importar animación</button>{/if}
        <div class="step-footer"><button onclick={()=>goStep(3)}>← Animaciones</button><button class="primary" disabled={!active || !previewSheet} onclick={approveCycle}>Aprobar y continuar →</button></div>
      </section></div>
      <div hidden={step!==5}>      <section>
        <h2>Hojas para el juego</h2>
        <p class="hint">{missing.length ? `Faltan ${missing.length} vistas por completar.` : 'Todas las orientaciones están cubiertas.'}</p>
        <label>Formato de exportación<select value={exportFormat} onchange={e=>{settings.exportFormat=e.currentTarget.value as ExportFormat;clearDownload();}}><option value="game" disabled={!canExportGame}>Nuestro juego · character.json</option><option value="generic">Genérico · PNG + sprites.json</option></select></label>
        <div class="export-actions"><button class="primary" disabled={!!missing.length || pendingReviews>0} onclick={downloadSheets}><WorkshopIcon name="download" size={16}/> Generar y descargar hojas</button></div>
        <p class="hint">{pendingReviews ? `${pendingReviews} vistas pendientes de aprobación.` : `${actions.length} hojas listas para exportar.`}</p>
        <details class="advanced"><summary>Previsualizar las hojas</summary><label>Acción a previsualizar<select value={action} onchange={e=>chooseView(e.currentTarget.value,direction)}>{#each actions as recipe}<option value={recipe.action}>{ACTION_LABELS[recipe.action]}</option>{/each}</select></label><button disabled={!!missingSources(settings, sources, [action]).length} onclick={() => process(false)}>Ver {ACTION_LABELS[action]}</button><button disabled={!!missing.length} onclick={() => process(true)}>Construir todas las hojas</button></details>
        {#if result?.metadata.warnings.length}<div class="notice"><strong>Revisar antes de usar</strong><ul>{#each result.metadata.warnings as warning}<li>{warning}</li>{/each}</ul></div>{/if}
        <p class="hint">Un PNG por acción + {exportFormat === 'generic' ? 'sprites.json para otros motores.' : 'character.json para nuestro juego.'}</p>
      </section><section><h2>Proyecto editable</h2><p class="hint">Conserva referencias, fotogramas y retoques para continuar en el taller.</p><button onclick={saveBackup}>Guardar copia .project.zip</button></section></div>
    </div>
    <aside class="preview-panel" aria-label="Vista previa del personaje"><div class="preview-sticky"><h2 class="preview-caption">{step===1 ? 'Imagen de partida' : step===2 ? `Referencia · ${direction.toUpperCase()}` : `${ACTION_LABELS[action]} · ${direction.toUpperCase()}`}</h2>
      {#if step>=3 && previewSheet && result}<SheetPreview onlyDirection={step===5 ? undefined : direction} sheet={previewSheet} url={urls[action]} settings={result.metadata.settings}/>
      {:else if visibleReference}<img class="portrait" class:flipped={referenceMirrored} src={visibleReference.image} alt={`Referencia ${direction.toUpperCase()}`}/>
      {:else if art.inspiration}<img class="portrait" src={art.inspiration.image} alt="Imagen de partida del personaje"/>
      {:else}<p class="empty">Aquí verás tu personaje al importar una imagen o aprobar una referencia.</p>{/if}
      {#if step>=3 && viewReady && !previewSheet}<button onclick={()=>goStep(4)}>Ver animación</button>{/if}
    </div></aside>
    {#if step>=3}<section class="progress-panel"><details open={step===5}><summary><span>▸ Progreso de las animaciones</span><span>{approvedViews}/{progressViews.length}</span></summary><div class="matrix-scroll"><table class="progress-matrix"><thead><tr><th scope="col">Acción</th>{#each profile.directions as d}<th scope="col">{d.toUpperCase()}</th>{/each}</tr></thead><tbody>{#each actions as recipe}<tr><th scope="row">{ACTION_LABELS[recipe.action]}</th>{#each profile.directions as d}{@const view=progressViews.find(v=>v.action===recipe.action && v.direction===d)!}<td><button class:approved={view.status==='approved'} class:selected={action===recipe.action && direction===d} aria-label={`${ACTION_LABELS[recipe.action]} · ${d.toUpperCase()} · ${viewStatus(recipe.action,d)}`} title={viewStatus(recipe.action,d)} onclick={()=>{chooseView(recipe.action,d);void goStep(view.status==='missing'?3:4);}}><WorkshopIcon size={16} name={videoLabel(recipe.action,d) ? 'clock' : view.status==='approved' ? 'check' : view.status==='review' ? 'clock' : 'minus'}/></button></td>{/each}</tr>{/each}</tbody></table></div><p class="matrix-key"><span>✓ Aprobada</span><span>◷ Por revisar / generando</span><span>− Pendiente</span></p></details></section>{/if}
  </fieldset>
</div>
<style>
  .format-panel h3{font-size:14px}.sheet-sizes{margin-top:20px;border-top:1px solid #dce3d4;padding-top:16px}.sizes-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #dce3d4}thead th{color:#60705c}td{white-space:nowrap}
 .example{margin-bottom:18px}.example summary{font-weight:400}
  [hidden]{display:none!important}.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}.steps button{display:flex;gap:8px;align-items:center;justify-content:center;min-height:48px}.steps button span{display:grid;place-items:center;border:1px solid #c4d1b7;border-radius:50%;width:24px;height:24px}.steps .current{background:#526e37;color:white;border-color:#526e37}.wizard-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.wizard-heading h2{margin:8px 0}.wizard-heading>span{font-size:12px}.overall-progress{width:100%;height:6px;accent-color:#526e37;margin:0 0 14px}.wizard-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;border:0;padding:0;margin:0;min-width:0}.panels{min-width:0}.preview-panel{min-width:0}.preview-sticky{position:sticky;top:16px;border:1px solid #dce3d4;border-radius:12px;background:#fffdf5;padding:20px;}.preview-sticky h2{margin:0 0 8px}.preview-caption{font-size:12px}.portrait{display:block;width:100%;max-height:340px;object-fit:contain;background:repeating-conic-gradient(#d8dfd1 0% 25%,#eef1e8 0% 50%) 0/16px 16px;border-radius:8px}.flipped{transform:scaleX(-1)}.step-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 8px}.step-footer button{min-height:44px}.save-status{font-size:12px;color:#506547}.advanced{margin-top:22px;border-top:1px solid #dce3d4;padding-top:16px}.advanced>summary{margin-bottom:18px}.reference-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin:20px 0}.reference-grid button{min-height:76px;display:grid;justify-items:center;gap:6px}.reference-grid img{width:80px;height:100px;object-fit:contain}.reference-grid small{font-size:11px}.recovery{background:#e8efdf}.recovery button{margin-right:8px}#wizard-title:focus{outline:2px solid #698849;outline-offset:4px}
  @media(max-width:1000px){.wizard-layout{grid-template-columns:minmax(0,1fr) 270px;gap:16px}.preview-sticky{padding:14px}}
  @media(max-width:760px){.wizard-layout{grid-template-columns:1fr}.preview-panel{grid-row:1}.preview-sticky{position:static;max-height:none}.portrait{max-height:180px}.steps{gap:4px}.steps button{flex-direction:column;font-size:11px;padding:8px 3px;gap:4px}.wizard-heading>span{font-size:11px}}

  .inspiration{border:1px dashed #bdcbb0;border-radius:8px;padding:12px;margin:16px 0}.inspiration h3{font-size:13px;margin:0 0 8px}.inspiration img{display:block;max-width:100%;max-height:220px;object-fit:contain;margin:12px auto;border-radius:6px}
  .generation-choice{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.generation-choice button[aria-pressed=true]{background:#526e37;color:white;border-color:#526e37}
  .action-config{padding:8px 0 12px 20px}.action-config summary{margin-bottom:10px}.action-selection{border-block:1px solid #dce3d4;padding:14px 0;margin:14px 0}.action-checks{display:grid;gap:5px}.action-checks small{display:block;color:#687561;font-size:10px}
  .manual-import,.source-options{margin:18px 0}@media(max-width:600px){}
  .style-options{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 16px}.style-options button{font-size:10px;padding:6px 8px}
  .ready-file{position:sticky;top:8px;z-index:2;background:#e1eacd;border:1px solid #698849;padding:14px;border-radius:8px;overflow-wrap:anywhere}.ready-file a{color:#304535;font-weight:600;text-decoration:underline}
  .generator{color:#304535;font:14px/1.55 system-ui,sans-serif}.toolbar,.toolbar-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.toolbar-actions{justify-content:flex-end;flex-wrap:wrap}h1{font-size:clamp(22px,3vw,28px);line-height:1.2;margin:10px 0}h2{font-size:19px;margin:7px 0 20px}h3{font-size:13px;margin:18px 0 8px}p{margin:8px 0 14px}section{background:#fffdf5;border:1px solid #dce3d4;border-radius:12px;padding:22px;margin-bottom:22px}label{display:flex;flex-direction:column;gap:7px;font-size:12px;margin-bottom:14px}input,select,textarea,button,.button{font:inherit;box-sizing:border-box}input:not([type=checkbox]):not([type=range]):not([type=file]),select,textarea{width:100%;min-width:0;padding:9px 10px;border:1px solid #cbd7be;border-radius:6px;background:#fff;color:#304535}textarea{resize:vertical;line-height:1.5}button,.button{border:1px solid #bdcbb0;border-radius:6px;padding:9px 12px;background:#fff;color:#304535;font-size:12px;cursor:pointer;text-align:center;text-decoration:none}button:disabled{opacity:.4;cursor:default}.primary{background:#526e37;color:white;border-color:#526e37}.button{position:relative;overflow:hidden;display:inline-flex;margin:0;align-items:center;justify-content:center}.button input{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}.button:focus-within,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #698849;outline-offset:3px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{flex-direction:row;align-items:flex-start;gap:8px}.check input{margin-top:3px;accent-color:#526e37}.hint{font-size:11px;line-height:1.6;color:#687561}.notice,.error,.status p{border-radius:7px;padding:12px;font-size:12px}.notice{background:#f4efd4;color:#695421}.error{background:#fbece6;color:#933d2c}.status p{background:#e8efdf}.actions,.facings{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}.actions button,.facings button{flex:1;min-width:90px;padding:9px 7px}.actions small{display:block;font-size:10px;font-weight:400;margin-top:4px;white-space:normal}.selected{background:#e1eacd;border-color:#698849;box-shadow:inset 0 0 0 1px #698849}.prompts{border-top:1px solid #dce3d4;padding-top:16px;margin:18px 0}summary{cursor:pointer;font-weight:600;font-size:12px}.prompts textarea{font-size:12px}.import-box{background:#f2f5eb;border:1px dashed #c4d1b7;border-radius:8px;padding:16px;margin-top:20px}.import-box .button{width:100%}.import-box .hint{margin-bottom:0}.source-review{display:grid;grid-template-columns:160px minmax(0,1fr);gap:20px;margin-top:22px}.source-review img{display:block;width:100%;height:170px;object-fit:contain;image-rendering:pixelated;background:repeating-conic-gradient(#d8dfd1 0% 25%,#eef1e8 0% 50%) 0/16px 16px;border-radius:8px;margin-bottom:10px}.filename{font-size:12px;overflow-wrap:anywhere;max-height:80px;overflow:auto}.export-actions{display:flex;flex-wrap:wrap;gap:10px}.empty{margin:22px 0;padding:40px 20px;text-align:center;border:1px dashed #c4d1b7;border-radius:8px;font-size:12px;color:#687561}ul{padding-left:18px}li{margin-top:6px}input[type=range]{width:100%;accent-color:#526e37}.status:empty{display:none}
  @media(max-width:950px){section{padding:18px}.source-review{grid-template-columns:1fr}.source-review img{width:160px}.toolbar{align-items:flex-start}}
  @media(max-width:720px){.toolbar{flex-direction:column;align-items:stretch}.toolbar-actions{justify-content:flex-start}.source-review{grid-template-columns:120px minmax(0,1fr)}.source-review img{width:120px}.pair{gap:8px}.actions button{min-width:75px}}
  @media(max-width:420px){.source-review{grid-template-columns:1fr}}

  .project-name{font-size:12px;color:#60705c;overflow-wrap:anywhere}.save-status{position:relative;min-height:22px;margin:8px 0;font-size:11px}.save-status summary{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:400}.save-status p{margin:4px 0}.style-detail{margin:12px 0 18px}.style-detail label{margin-top:10px}.reference-tools{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.reference-tools .button{gap:6px}.facings button{display:flex;justify-content:center;align-items:center;gap:8px;min-width:52px;flex:0 1 64px}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.actions button{min-width:0}.icon-button{display:inline-grid;place-items:center;width:36px;height:36px;padding:0;flex-shrink:0}.status p{display:flex;align-items:center;justify-content:space-between;gap:10px}.text-button{border:0;background:transparent;padding-left:0;text-decoration:underline}.preview-sticky .preview-caption{font-size:14px;margin-bottom:14px}.progress-panel{grid-column:1 / -1;margin:0}.progress-panel summary{display:flex;justify-content:space-between;gap:12px}.matrix-scroll{overflow-x:auto;margin-top:12px}.progress-matrix th,.progress-matrix td{padding:4px;text-align:center}.progress-matrix th:first-child{text-align:left}.progress-matrix button{display:inline-grid;place-items:center;padding:6px;min-width:32px;min-height:32px}.progress-matrix button.approved{color:#405a2d;background:#e8efdf}.matrix-key{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#60705c;margin-bottom:0}.review-layout{grid-template-columns:minmax(0,1fr) minmax(270px,1fr)}
  @media(max-width:760px){.review-layout{grid-template-columns:1fr}.preview-panel{grid-row:auto}.review-layout .preview-panel{grid-row:1}.progress-panel{padding:14px}.toolbar-actions{gap:6px}.toolbar-actions button,.toolbar-actions .button{padding:8px}.actions button{min-width:0}.steps button{min-width:0}.progress-matrix{font-size:11px}}
</style>
