<script lang="ts">
  import { onDestroy } from 'svelte';
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
<main><nav><a href="/sprites">← Taller de sprites</a><a href="/">Volver al mundo →</a></nav><CharacterGenerator onexample={example} {imageProvider} {videoProvider} {pixelEditor}/></main>
{#if editSession}<ImageEditor session={editSession} saveHint="Pulsa «Guardar copia» en el generador para conservar los retoques." onchange={() => {}} onapply={async blob => { finishEdit?.(blob); finishEdit = undefined; }} onclose={closeEditor}/>{/if}
<style>main{max-width:1280px;margin:auto;padding:28px 24px 60px}nav{display:flex;justify-content:space-between;gap:16px;margin-bottom:34px;font:13px system-ui,sans-serif}a{color:#526e37}@media(max-width:600px){main{padding:20px 14px 40px}}</style>
