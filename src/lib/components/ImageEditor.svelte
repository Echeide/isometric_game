<script lang="ts">
 import {onMount,tick} from 'svelte';
 import {X, Save, LoaderCircle, RotateCcw, RotateCw} from 'lucide-svelte';
 import {editorChannel,editorRevision,validateEditorLoaded,validateEditedImage,validateEditorPalette,validateEditorPixels,type ImageEditSession,type EditorPalette,type ImageEditOptions,type CycleNavigation,type CycleSelection} from '$lib/workshop/image-edit';
 import {encodePalettePNG} from '$lib/workshop/palette-browser';

 let {session,palette,navigation,onselect,onapply,onclose,onchange,saveHint='Los retoques se guardarán cuando pulses «Guardar en catálogo».'}:{session:ImageEditSession;palette?:EditorPalette;navigation?:CycleNavigation;onselect?:(selection:CycleSelection)=>Promise<void>;saveHint?:string;onapply:(blob:Blob,options?:ImageEditOptions)=>Promise<void>;onclose:()=>void;onchange:(dirty:boolean)=>void}=$props();
 let dialog:HTMLDialogElement;
 let frame=$state<HTMLIFrameElement>();
 let nonce=$state(''),ready=$state(false),working=$state(false),changed=$state(false),error=$state(''),confirmClose=$state(false);
 let confirmSelection=$state<CycleSelection|null>(null),applyDestination:CycleSelection|null=null;
 let timer:ReturnType<typeof setTimeout>,mounted=true;
 const send=(type:string,payload:Record<string,unknown>={})=>frame?.contentWindow?.postMessage({channel:editorChannel,session:nonce,type,...payload},location.origin);
 function timeout(message:string){clearTimeout(timer);timer=setTimeout(()=>{working=false;error=message;},30000);}
 function close(){if(working)return;confirmSelection=null;if(changed)confirmClose=true;else onclose();}
 function apply(destination:CycleSelection|null=null){if(!ready||working)return;applyDestination=destination;working=true;error='';timeout('El editor no ha respondido. Puedes volver a intentarlo sin perder los retoques.');send('apply');}
 function requestSelection(selection:CycleSelection){
  if(!navigation||!onselect||working||!ready||selection.action===navigation.action&&selection.direction===navigation.direction)return;
  confirmClose=false;error='';
  if(changed)confirmSelection=selection;else void switchCycle(selection);
 }
 async function switchCycle(selection:CycleSelection,applied=false){
  if(!onselect)return;working=true;error='';
  try{await onselect(selection);if(!mounted)return;await tick();ready=false;changed=false;onchange(false);confirmSelection=null;confirmClose=false;nonce=crypto.randomUUID();timeout('No se pudo cargar el ciclo. Cierra el editor y vuelve a intentarlo.');}
  catch(e){if(mounted){error=applied?'Retoques aplicados, pero no se pudo abrir el nuevo ciclo. Cierra el editor y vuelve a abrirlo. '+(e as Error).message:(e as Error).message;if(applied){ready=false;confirmSelection=null;}}}
  finally{if(mounted)working=false;}
 }
 async function receive(event:MessageEvent){
  const data=event.data;
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||!data||data.channel!==editorChannel||data.session!==nonce)return;
  if(data.type==='ready'){send('open',{blob:session.blob,name:session.name,width:session.width,height:session.height,frames:session.frames,fps:session.fps,palette:palette?validateEditorPalette(palette):undefined});}
  else if(data.type==='loaded'){
   clearTimeout(timer);
   try{validateEditorLoaded(data,session);ready=true;error='';}
   catch(e){ready=false;error=(e as Error).message;}
  }
  else if(data.type==='dirty'&&ready&&typeof data.dirty==='boolean'){changed=data.dirty;onchange(changed);}
  else if(data.type==='apply-request')apply();
  else if(data.type==='palette-start'&&ready){working=true;error='';timeout('La adaptación no ha respondido. Puedes volver a intentarlo.');}
  else if(data.type==='palette-progress'&&working){timeout('La adaptación no ha respondido. Puedes volver a intentarlo.');}
  else if(data.type==='palette-done'){clearTimeout(timer);working=false;}
  else if(data.type==='error'){clearTimeout(timer);working=false;error=typeof data.message==='string'?data.message:'No se pudo editar la imagen.';}
  else if(data.type==='result'&&working){
   clearTimeout(timer);
   try{
    if(typeof data.changed!=='boolean')throw new Error('Respuesta del editor no válida.');
    const pixels=data.rgba===undefined?undefined:validateEditorPixels(data.rgba,session);
    const blob=pixels?new Blob([new Uint8Array(encodePalettePNG(pixels))],{type:'image/png'}):data.blob;
    await validateEditedImage(blob,session);
    const bitmap=await createImageBitmap(blob);bitmap.close();
    if(!mounted)return;
    const options:ImageEditOptions={pixels,...(data.paletteApplied?{palette:validateEditorPalette(data.paletteApplied)}:{})};
    if(data.changed)await onapply(blob,options);
    if(mounted){changed=false;onchange(false);const destination=applyDestination;applyDestination=null;if(destination)await switchCycle(destination,true);else onclose();}
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

<dialog bind:this={dialog} class="image-editor" aria-labelledby="image-editor-title" aria-describedby="image-editor-hint" oncancel={e=>{e.preventDefault();if(confirmSelection)confirmSelection=null;else close();}}>
 <div class="editor-shell">
  <header>
   <h2 id="image-editor-title" title={navigation?.name??session.name}>{session.frames !== undefined ? 'Editar ciclo' : 'Editar imagen'} · {navigation?.name??session.name}</h2>
   {#if navigation&&onselect}<div class="cycle-selects" role="group" aria-label="Ciclo que se está editando">
    <select aria-label="Acción del ciclo" title="Acción" value={navigation.action} disabled={!ready||working} onchange={e=>{const action=e.currentTarget.value;e.currentTarget.value=navigation!.action;requestSelection({action,direction:navigation!.direction});}}>{#each navigation.actions as action}<option value={action.value}>{action.label}</option>{/each}</select>
    {#if navigation.directions.length}<select aria-label="Dirección del ciclo" title="Dirección" value={navigation.direction} disabled={!ready||working} onchange={e=>{const direction=e.currentTarget.value;e.currentTarget.value=navigation!.direction??'';requestSelection({action:navigation!.action,direction});}}>{#each navigation.directions as direction}<option value={direction.value}>{direction.label}</option>{/each}</select>{/if}
   </div>{/if}
   <div class="header-actions" role="group" aria-label="Acciones del editor">
    <button aria-label="Deshacer" title="Deshacer" disabled={!ready||working} onclick={()=>send('undo')}><RotateCcw size={18} aria-hidden="true"/></button>
    <button aria-label="Rehacer" title="Rehacer" disabled={!ready||working} onclick={()=>send('redo')}><RotateCw size={18} aria-hidden="true"/></button>
    <button class="save" aria-label={working?'Procesando retoques':'Aplicar al taller'} title="Guardar · aplicar al taller" aria-busy={working} disabled={!ready||working} onclick={()=>apply()}>{#if working}<LoaderCircle size={18} class="spinner" aria-hidden="true"/>{:else}<Save size={18} aria-hidden="true"/>{/if}</button>
    <button class="close" aria-label="Cerrar editor de imagen" title="Cerrar · cancelar" disabled={working} onclick={close}><X size={20} aria-hidden="true"/></button>
   </div>
  </header>
  <p id="image-editor-hint" class="sr-only">{saveHint} Las capas se combinan al exportar el PNG.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if confirmClose}<div class="discard" role="alert"><span>Hay retoques sin aplicar.</span><button onclick={()=>confirmClose=false}>Seguir editando</button><button onclick={onclose}>Descartar retoques</button></div>{/if}
  {#if confirmSelection}<div class="discard" role="alert"><span>Hay retoques sin aplicar. Aplica o descarta antes de cambiar de ciclo.</span><button disabled={working} onclick={()=>apply(confirmSelection)}>Aplicar y cambiar</button><button disabled={working} onclick={()=>{if(confirmSelection)void switchCycle(confirmSelection);}}>Descartar y cambiar</button><button disabled={working} onclick={()=>confirmSelection=null}>Seguir editando</button></div>{/if}
  <div class="canvas-area" class:working={working||!ready}>
   {#if nonce}{#key nonce}<iframe bind:this={frame} title="Editor de píxeles Piskel" src={`/tools/piskel/index.html?v=${editorRevision}#${nonce}`} sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>{/key}{/if}
   {#if !ready&&!error}<div class="loading" role="status">Preparando la imagen…</div>{/if}
  </div>
  <footer>{session.width / (session.frames || 1)} × {session.height} px</footer>
 </div>
</dialog>

<style>
 .image-editor{box-sizing:border-box;padding:0;border:1px solid #454545;border-radius:10px;width:calc(100vw - 16px);max-width:none;height:calc(100dvh - 16px);max-height:none;color:#e6e6e6;background:#202020;overflow:hidden;color-scheme:dark}
 .image-editor::backdrop{background:#000b;backdrop-filter:blur(2px)}
 .editor-shell{height:100%;display:flex;flex-direction:column}
 header{display:flex;align-items:center;gap:16px;flex-shrink:0;padding:7px 10px 7px 16px;border-bottom:1px solid #3a3a3a;background:#262626}
 h2{flex:0 1 auto;min-width:0;margin:0;font:600 14px/1.4 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cycle-selects{display:flex;gap:6px;align-items:center;flex-shrink:0}
 .cycle-selects select{font:12px system-ui;height:30px;max-width:150px;padding:4px 7px;border:1px solid #4c4c4c;border-radius:5px;background:#303030;color:#dedede}
 .cycle-selects select:focus-visible{outline:2px solid #e8c74a;outline-offset:2px}
 .header-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:auto}
 button{display:inline-flex;align-items:center;justify-content:center;font:12px system-ui;border:1px solid #494949;background:#303030;color:#dedede;border-radius:5px;cursor:pointer}
 .header-actions button{width:34px;height:34px;padding:0;border-color:transparent;background:transparent}
 .header-actions .save{border-color:#555;background:#373737;color:#f2d45c}
 .header-actions .close{margin-left:4px}
 button:hover:not(:disabled){background:#444;color:white}
 .close:hover:not(:disabled){background:#573333}
 button:disabled{opacity:.4;cursor:default}
 button:focus-visible{outline:2px solid #e8c74a;outline-offset:2px}
 .canvas-area{position:relative;flex:1;min-height:0;overflow:auto;background:#202020}
 .canvas-area.working{pointer-events:none;opacity:.7}
 iframe{display:block;width:100%;min-width:760px;height:100%;min-height:460px;border:0}
 .loading{position:absolute;inset:0;display:grid;place-items:center;background:#202020;color:#d0d0d0;font:13px system-ui}
 footer{flex-shrink:0;padding:5px 14px;border-top:1px solid #3a3a3a;background:#262626;color:#a8a8a8;font:11px/1.3 system-ui;font-variant-numeric:tabular-nums}
 .error,.discard{flex-shrink:0;margin:0;padding:9px 14px;font:12px/1.5 system-ui;background:#402929;color:#f1b1aa}
 .discard{display:flex;align-items:center;gap:10px;background:#3b3425;color:#e6d3a1}
 .discard span{flex:1}
 .discard button{padding:6px 10px}
 .sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
 :global(.header-actions .spinner){animation:piskel-saving 1s linear infinite}
 @keyframes piskel-saving{to{transform:rotate(360deg)}}
 @media(prefers-reduced-motion:reduce){:global(.header-actions .spinner){animation:none}}
 @media(max-width:900px){header{gap:8px;flex-wrap:wrap}h2{flex:1}.cycle-selects{order:2;flex-basis:100%}.cycle-selects select{flex:1;max-width:none}.discard{flex-wrap:wrap}.discard span{flex-basis:100%}}
 @media(max-width:700px){.image-editor{width:100vw;height:100dvh;border:0;border-radius:0}header{padding:6px 8px}h2{font-size:12px}.header-actions button{width:36px;height:36px}}
</style>
