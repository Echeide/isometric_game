<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 import type {AdventureImportProgress} from '$lib/storage/adventure-package';
 const ui=interfaceLanguage();
 let {filename,progress}:{filename:string;progress:AdventureImportProgress}=$props();
 const labels={preparing:'Guardando los cambios actuales…',reading:'Leyendo el archivo…',validating:'Comprobando imágenes…',saving:'Guardando la aventura y sus recursos…',opening:'Cargando la aventura importada…'};
</script>

<div class="import-status" role="status" aria-live="polite" aria-atomic="true">
 <span class="spinner" aria-hidden="true"></span>
 <div class="details">
  <strong>{ui.text('Importando aventura…')}</strong>
  <span class="filename" title={filename}>{filename}</span>
  <p>{ui.text(labels[progress.phase])}{#if progress.phase==='validating'} <span>{progress.completed} / {progress.total}</span>{/if}</p>
  <small>{ui.text('Puede tardar unos minutos. Mantén esta página abierta.')}</small>
 </div>
</div>

<style>
 .import-status{position:fixed;z-index:100;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:flex-start;gap:14px;width:390px;max-width:calc(100vw - 32px);padding:18px 20px;border:1px solid #b9cbaa;border-radius:12px;background:#fbfdf7;color:#304b2b;box-shadow:0 8px 32px #223b2a30;pointer-events:none}
 .details{min-width:0}.details strong{display:block;font-size:14px}.filename{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#64735b;margin-top:4px}p{font-size:13px;margin:10px 0 5px}p span{font-variant-numeric:tabular-nums;white-space:nowrap}small{font-size:11px;line-height:1.5;color:#64735b}.spinner{flex:none;width:20px;height:20px;border:3px solid #dce6d1;border-top-color:#526e37;border-radius:50%;animation:spin .8s linear infinite;margin-top:2px}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
</style>
