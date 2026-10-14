<script lang="ts">
 import {onMount} from 'svelte';
 import {Trash2,LoaderCircle} from 'lucide-svelte';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 const ui=interfaceLanguage();
 let {name,onconfirm,onclose}:{name:string;onconfirm:(confirmation:string)=>Promise<void>;onclose:()=>void}=$props();
 let dialog:HTMLDialogElement,cancel:HTMLButtonElement;
 let confirmation=$state(''),busy=$state(false),error=$state('');
 onMount(()=>{dialog.showModal();cancel.focus();});
 function close(){if(!busy)onclose();}
 async function submit(){
  if(busy||confirmation!=='ELIMINAR')return;
  busy=true;error='';
  try{await onconfirm(confirmation);onclose();}catch(e){error=(e as Error).message;}finally{busy=false;}
 }
</script>

<dialog bind:this={dialog} aria-labelledby="delete-adventure-title" aria-describedby="delete-adventure-warning" oncancel={e=>{e.preventDefault();close();}}>
 <form onsubmit={e=>{e.preventDefault();void submit();}} aria-busy={busy}>
  <div class="icon" aria-hidden="true"><Trash2 size={22}/></div>
  <h2 id="delete-adventure-title">{ui.text('Eliminar aventura')}</h2>
  <p class="name">{name}</p>
  <p id="delete-adventure-warning">{ui.text('Se eliminarán sus mapas y configuración. Si está publicada, dejará de estar disponible para los jugadores. Esta acción no se puede deshacer.')}</p>
  <p class="hint">{ui.text('Los recursos de la biblioteca y las demás aventuras se conservan. Puedes cancelar y exportar un ZIP desde el editor antes de continuar.')}</p>
  <label for="delete-adventure-confirmation">{ui.text('Escribe ELIMINAR para confirmar.')}</label>
  <input id="delete-adventure-confirmation" bind:value={confirmation} disabled={busy} autocomplete="off" spellcheck="false" autocapitalize="characters"/>
  {#if error}<p class="error" role="alert">{ui.text(error)}</p>{/if}
  <footer><button bind:this={cancel} type="button" disabled={busy} onclick={close}>{ui.text('Cancelar')}</button><button class="danger" type="submit" disabled={busy||confirmation!=='ELIMINAR'}>{#if busy}<LoaderCircle class="spin" size={15}/>{/if}{busy?ui.text('Eliminando…'):ui.text('Eliminar definitivamente')}</button></footer>
 </form>
</dialog>

<style>
 dialog{box-sizing:border-box;width:min(480px,calc(100% - 32px));max-height:90vh;overflow:auto;border:1px solid #dce3d6;border-radius:16px;padding:28px;background:#fffef9;color:#304535;box-shadow:0 20px 70px #17261d33}dialog::backdrop{background:#16231780}.icon{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#fae9e4;color:#9b3e32;margin-bottom:16px}h2{margin:0;font-size:22px}.name{font-size:17px;font-weight:600;overflow-wrap:anywhere;margin:12px 0}p{font-size:13px;line-height:1.65}.hint{font-size:12px;color:#718069;margin:12px 0 22px}label{display:block;font-size:13px;font-weight:600;margin-bottom:8px}input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd8bf;border-radius:7px;font:inherit;color:inherit;background:white}footer{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:24px}button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 14px;border:1px solid #cbd8bf;border-radius:8px;background:white;color:#476238;font:13px system-ui;cursor:pointer}.danger{background:#a33c31;border-color:#a33c31;color:white}button:disabled{opacity:.45;cursor:default}.error{padding:10px;background:#fbeae3;color:#963f31;border-radius:7px}button:focus-visible,input:focus-visible{outline:2px solid #74994e;outline-offset:3px}.danger :global(.spin){animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.danger :global(.spin){animation:none}}@media(max-width:480px){dialog{padding:22px}footer button{flex:1}}
</style>
