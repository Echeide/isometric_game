<script lang="ts">
  import {readDraft,writeDraft} from '../../../packages/character-generator/src/draft';
  let {data}=$props();let migrationMessage=$state('');
  const draftKey=$derived('account:'+data.principal!.user.id+':'+data.principal!.tenant!.id);
  async function recoverLocal(){try{if(await readDraft(draftKey))throw new Error('Ya existe un borrador en este espacio. Descarga su ZIP antes de recuperar otro.');const draft=await readDraft();if(!draft)throw new Error('No hay un borrador anterior en este navegador.');await writeDraft(draft,draftKey);location.reload();}catch(e){migrationMessage=(e as Error).message;}}
  import {localAdventures} from '$lib/storage/local-adventures';
  import {paletteRGB} from '$lib/demo/adventure-palette';
  let palettes=$state<{id:string;name:string;colors:[number,number,number][] }[]>([]),paletteError=$state('');
  let palettesLoading=$state(false),paletteViewAlive=true;
  async function refreshPalettes(){palettesLoading=true;paletteError='';try{const library=await localAdventures.load();if(paletteViewAlive)palettes=library.adventures.filter(a=>a.palette).map(a=>({id:a.id,name:a.name+' · '+a.palette!.name,colors:paletteRGB(a.palette!)}));}catch{if(paletteViewAlive)paletteError='No se pudieron cargar las paletas de aventura. Pulsa «Actualizar paletas» para volver a intentarlo.';}finally{if(paletteViewAlive)palettesLoading=false;}}
  onMount(()=>{void refreshPalettes();return()=>{paletteViewAlive=false;};});
  import { onDestroy,onMount } from 'svelte';
  import ImageEditor from '$lib/components/ImageEditor.svelte';
  import type { ImageEditSession } from '$lib/workshop/image-edit';
  import { CharacterGenerator, PROFILES, readSheet, httpImageProvider, httpVideoProvider, type Sources, type PixelEditorProvider } from '@isometrico/character-generator';
  let editSession = $state<ImageEditSession | null>(null);
  let finishEdit: ((blob: Blob | null) => void) | undefined;
  const pixelEditor: PixelEditorProvider = { edit(request) {
    return new Promise(resolve => { finishEdit = resolve; editSession = request; });
  } };
  function closeEditor() { finishEdit?.(null); finishEdit = undefined; editSession = null; }
  onDestroy(closeEditor);
  const imageProvider = httpImageProvider('/api/characters/images');
  const videoProvider = httpVideoProvider('/api/characters/videos');
  async function example(): Promise<Sources> {
    const sources: Sources = {};
    for (const recipe of PROFILES.game.actions) {
      const response = await fetch(`/pixelart/characters/grey-player-v1/${recipe.action}.png`);
      if (!response.ok) throw new Error('No se pudo cargar el personaje de ejemplo.');
      const file = new File([await response.blob()], `${recipe.action}.png`, { type: 'image/png' });
      sources[recipe.action] = {};
      for (const [row, direction] of PROFILES.game.directions.entries()) {
        sources[recipe.action][direction] = await readSheet(file, recipe.frames, 4, row, recipe.fps);
      }
    }
    return sources;
  }
</script>
<svelte:head><title>Generador de personajes · Isométrico</title><meta name="description" content="Importa imágenes y vídeos para crear hojas de personaje con transparencia, ciclos y metadatos."/></svelte:head>
<main class="character-route">{#if paletteError}<p role="status">{paletteError}</p>{/if}<nav><a href="/admin">← Aventuras</a><a href="/sprites">Taller de sprites</a><details class="route-menu"><summary>Más opciones</summary><div><a href="/library">Biblioteca del espacio</a><a href="/sprites" target="_blank" rel="noreferrer">Paletas de aventura ↗</a><details><summary>Recuperar personaje de la versión anterior</summary><p>Copia el último borrador local a tu espacio, conservando el original.</p><button onclick={recoverLocal}>Copiar borrador anterior</button>{#if migrationMessage}<p role="status">{migrationMessage}</p>{/if}</details></div></details></nav>{#key draftKey}<CharacterGenerator studio {palettes} {palettesLoading} onrefreshPalettes={refreshPalettes} {draftKey} onexample={example} {imageProvider} {videoProvider} {pixelEditor}/>{/key}</main>
{#if editSession}<ImageEditor session={editSession} saveHint="Pulsa «Guardar copia» en el generador para conservar los retoques." onchange={() => {}} onapply={async blob => { finishEdit?.(blob); finishEdit = undefined; }} onclose={closeEditor}/>{/if}
<style>main{max-width:1280px;margin:auto;padding:28px 24px 60px}nav{display:flex;justify-content:space-between;gap:16px;margin-bottom:34px;font:13px system-ui,sans-serif}a{color:#526e37}@media(max-width:600px){main{padding:20px 14px 40px}}.character-route{display:flex;flex-direction:column;height:calc(100svh - var(--platform-bar-height,0px));min-height:500px;max-width:none;width:100%;margin:0;padding:0 20px 0;color:#2b4133;background:#f5f7f2;overflow:hidden}.character-route nav{min-height:42px;margin:0;display:flex;align-items:center;justify-content:flex-start;gap:18px;flex:none;border-bottom:1px solid #dce4d8;font-size:12px}.route-menu{margin-left:auto;position:relative}.route-menu>summary{cursor:pointer}.route-menu>div{position:absolute;right:0;top:28px;width:290px;max-width:calc(100vw - 30px);z-index:110;display:grid;gap:12px;padding:16px;border:1px solid #dce4d8;border-radius:9px;background:white;box-shadow:0 8px 25px #183a3118}.route-menu p{font-size:12px}.route-menu button{font-size:12px;border:1px solid #d8e0ce;padding:8px;border-radius:7px}@media(max-width:600px){.character-route{padding:0 12px;min-height:450px}}
</style>
