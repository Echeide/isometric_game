<script lang="ts">
 import {onMount} from 'svelte';
 import {X, Check, RotateCcw, RotateCw} from 'lucide-svelte';
 import {editorChannel,validateEditedImage,type ImageEditSession} from '$lib/workshop/image-edit';

 let {session,onapply,onclose,onchange}:{session:ImageEditSession;onapply:(blob:Blob)=>Promise<void>;onclose:()=>void;onchange:(dirty:boolean)=>void}=$props();
 let dialog:HTMLDialogElement;
 let frame=$state<HTMLIFrameElement>();
 let nonce=$state(''),ready=$state(false),working=$state(false),changed=$state(false),error=$state(''),confirmClose=$state(false);
 let timer:ReturnType<typeof setTimeout>,mounted=true;
 const send=(type:string,payload:Record<string,unknown>={})=>frame?.contentWindow?.postMessage({channel:editorChannel,session:nonce,type,...payload},location.origin);
 function timeout(message:string){clearTimeout(timer);timer=setTimeout(()=>{working=false;error=message;},30000);}
 function close(){if(working)return;if(changed)confirmClose=true;else onclose();}
 function apply(){if(!ready||working)return;working=true;error='';timeout('El editor no ha respondido. Puedes volver a intentarlo sin perder los retoques.');send('apply');}
 async function receive(event:MessageEvent){
  const data=event.data;
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||!data||data.channel!==editorChannel||data.session!==nonce)return;
  if(data.type==='ready'){send('open',{blob:session.blob,name:session.name,width:session.width,height:session.height});}
  else if(data.type==='loaded'){clearTimeout(timer);ready=true;error='';}
  else if(data.type==='dirty'&&typeof data.dirty==='boolean'){changed=data.dirty;onchange(changed);}
  else if(data.type==='apply-request')apply();
  else if(data.type==='error'){clearTimeout(timer);working=false;error=typeof data.message==='string'?data.message:'No se pudo editar la imagen.';}
  else if(data.type==='result'&&working){
   clearTimeout(timer);
   try{
    if(typeof data.changed!=='boolean')throw new Error('Respuesta del editor no válida.');
    await validateEditedImage(data.blob,session);
    const bitmap=await createImageBitmap(data.blob);bitmap.close();
    if(!mounted)return;
    if(data.changed)await onapply(data.blob);
    if(mounted){onchange(false);onclose();}
   }catch(e){if(mounted)error=(e as Error).message;}finally{if(mounted)working=false;}
  }
 }
 onMount(()=>{
  mounted=true;nonce=crypto.randomUUID();dialog.showModal();
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  window.addEventListener('message',receive);
  timeout('No se pudo iniciar el editor. Cierra esta ventana y vuelve a intentarlo.');
  return()=>{mounted=false;clearTimeout(timer);window.removeEventListener('message',receive);document.body.style.overflow=previousOverflow;};
 });
</script>

<dialog bind:this={dialog} class="image-editor" aria-labelledby="image-editor-title" oncancel={e=>{e.preventDefault();close();}}>
 <div class="editor-shell">
  <header><div><p>RETOQUE DE PÍXELES · PISKEL</p><h2 id="image-editor-title">Editar imagen · {session.name}</h2></div><button class="close" aria-label="Cerrar editor de imagen" disabled={working} onclick={close}><X size={20}/></button></header>
  <div class="toolbar"><span>{session.width} × {session.height} px · Tamaño y apoyo conservados</span><div><button disabled={!ready||working} onclick={()=>send('undo')}><RotateCcw size={15}/> Deshacer</button><button disabled={!ready||working} onclick={()=>send('redo')}><RotateCw size={15}/> Rehacer</button></div></div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if confirmClose}<div class="discard" role="alert"><span>Hay retoques sin aplicar.</span><button onclick={()=>confirmClose=false}>Seguir editando</button><button onclick={onclose}>Descartar retoques</button></div>{/if}
  <div class="canvas-area" class:working>
   {#if nonce}<iframe bind:this={frame} title="Editor de píxeles Piskel" src={`/tools/piskel/index.html#${nonce}`} sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>{/if}
   {#if !ready&&!error}<div class="loading" role="status">Preparando la imagen…</div>{/if}
  </div>
  <footer><div><span>Los retoques se guardarán cuando pulses «Guardar en catálogo».</span><small>Las capas se combinan en un PNG. Editor pensado para ratón y teclado.</small></div><button disabled={working} onclick={close}>Cancelar</button><button class="primary" disabled={!ready||working} onclick={apply}><Check size={16}/>{working?'Aplicando…':'Aplicar al taller'}</button></footer>
 </div>
</dialog>

<style>
 .image-editor{padding:0;border:1px solid #b9caaa;border-radius:16px;width:calc(100vw - 32px);max-width:1600px;height:calc(100dvh - 32px);max-height:1000px;color:#2b4133;background:#fffef9;overflow:hidden}.image-editor::backdrop{background:#18221d99;backdrop-filter:blur(3px)}.editor-shell{height:100%;display:flex;flex-direction:column}header{display:flex;align-items:center;justify-content:space-between;padding:15px 22px;gap:15px}header p{font-size:9px;letter-spacing:1.5px;color:#7a886b;margin:0 0 5px}h2{margin:0;font-size:19px;font-weight:600;overflow-wrap:anywhere}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 22px;background:#eef3e7;border-block:1px solid #dce3d3;font-size:12px}.toolbar>div{display:flex;gap:8px}.toolbar button{padding:6px 10px;font-size:11px}.canvas-area{position:relative;flex:1;min-height:0;overflow:auto;background:#202020}.canvas-area.working{pointer-events:none;opacity:.7}iframe{display:block;width:100%;min-width:760px;height:100%;min-height:460px;border:0}.loading{position:absolute;inset:0;display:grid;place-items:center;background:#202020;color:#e8eedf;font-size:14px}footer{display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid #dce3d3}footer>div{flex:1;font-size:12px;line-height:1.5}small{display:block;color:#7a8671;font-size:10px;margin-top:3px}button{display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;font-size:12px;padding:10px 13px;border:1px solid #cbd8bf;background:#fffef9;border-radius:7px;cursor:pointer;color:inherit;white-space:nowrap}button:disabled{opacity:.45;cursor:default}button:focus-visible{outline:2px solid #74994e;outline-offset:2px}.primary{background:#476238;border-color:#476238;color:white}.close{border:0;background:transparent;padding:8px}.error,.discard{margin:0;padding:10px 22px;font-size:12px;background:#fbeae3;color:#963f31}.discard{display:flex;align-items:center;gap:10px;background:#fff2d9;color:#765b25}.discard span{flex:1}.discard button{font-size:11px;padding:7px 10px}@media(max-width:700px){.image-editor{width:100vw;height:100dvh;max-height:none;max-width:none;border-radius:0;border:0}header,.toolbar,footer{padding:12px}h2{font-size:16px}.toolbar{flex-wrap:wrap}footer{flex-wrap:wrap}footer>div{flex-basis:100%}footer button{flex:1}.discard{padding:10px;flex-wrap:wrap}}
</style>
