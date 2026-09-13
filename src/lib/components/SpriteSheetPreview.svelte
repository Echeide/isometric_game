<script lang="ts">
 import { onDestroy } from 'svelte';

 let source=$state<{url:string;name:string;width:number;height:number}|null>(null);
 let error=$state('');
 let loading=$state(false);
 let cellWidth=$state(64),cellHeight=$state(96),frames=$state(4),row=$state(0),fps=$state(10);
 let frame=$state(0),playing=$state(true),zoom=$state(2),showAnchor=$state(true);
 let request=0;
 const positiveInteger=(value:number)=>Number.isInteger(value)&&value>0;
 const columns=$derived(source&&positiveInteger(cellWidth)?Math.floor(source.width/cellWidth):0);
 const rows=$derived(source&&positiveInteger(cellHeight)?Math.floor(source.height/cellHeight):0);
 const problem=$derived(!source?'':
  !positiveInteger(cellWidth)||!positiveInteger(cellHeight)?'Indica un ancho y un alto de celda enteros, mayores que cero.':
  columns<1||rows<1?'La celda es mayor que la imagen.':
  !positiveInteger(frames)||frames>columns?`Esta hoja admite entre 1 y ${columns} fotogramas por fila.`:
  !Number.isInteger(row)||row<0||row>=rows?`Elige una fila entre 1 y ${rows}.`:
  !Number.isFinite(fps)||fps<1||fps>60?'La velocidad debe estar entre 1 y 60 fps.':'');
 const valid=$derived(!!source&&!problem);
 const remainder=$derived(valid&&source&&(source.width%cellWidth!==0||source.height%cellHeight!==0));
 const directions=['NE ↗','SE ↘','SW ↙','NW ↖'];

 async function loadFile(event:Event){
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];
  input.value='';
  if(!file)return;
  const current=++request;
  error='';loading=false;
  if(!file.name.toLowerCase().endsWith('.png')){error='Elige una imagen PNG.';return;}
  if(file.size>20*1024*1024){error='La imagen supera los 20 MB. Exporta una hoja más pequeña.';return;}
  loading=true;
  const url=URL.createObjectURL(file);
  try{
   const image=new Image();image.src=url;await image.decode();
   if(current!==request){URL.revokeObjectURL(url);return;}
   if(image.naturalWidth*image.naturalHeight>32_000_000)throw new Error('large');
   if(source)URL.revokeObjectURL(source.url);
   source={url,name:file.name,width:image.naturalWidth,height:image.naturalHeight};
   cellWidth=64;cellHeight=96;frames=Math.max(1,Math.floor(source.width/64));row=0;frame=0;fps=10;playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }catch{
   URL.revokeObjectURL(url);
   if(current===request)error='No se pudo abrir el PNG. Comprueba que sea una imagen válida de hasta 32 megapíxeles.';
  }finally{if(current===request)loading=false;}
 }
 function clear(){
  request++;loading=false;error='';
  if(source)URL.revokeObjectURL(source.url);
  source=null;
 }
 onDestroy(()=>{request++;if(source)URL.revokeObjectURL(source.url);});
 $effect(()=>{source;cellWidth;cellHeight;frames;row;frame=0;});
 $effect(()=>{
  if(!valid||!playing)return;
  const count=frames;
  const timer=setInterval(()=>{frame=(frame+1)%count;},1000/fps);
  return ()=>clearInterval(timer);
 });
</script>

<section class="upload-section" aria-labelledby="sheet-title">
 <div class="intro">
  <div><h2 id="sheet-title">Probar una hoja nueva</h2><p>Carga un PNG para revisar el movimiento y la cuadrícula. La prueba se queda en este navegador y no sustituye los gráficos del juego.</p></div>
  <label class="upload-button">{source?'Cambiar PNG':'Cargar hoja PNG'}<input aria-label="Cargar hoja PNG" type="file" accept="image/png,.png" onchange={loadFile}/></label>
 </div>
 {#if loading}<p role="status">Abriendo imagen…</p>{/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 {#if source}
  <div class="file-info"><p><strong>{source.name}</strong><br/>{source.width} × {source.height} px · {columns} columnas × {rows} filas con estas celdas</p><button onclick={clear}>Quitar hoja</button></div>
  <div class="workspace">
   <div class="settings">
    <div class="fields">
     <label>Ancho de celda (px)<input type="number" min="1" max={source.width} step="1" bind:value={cellWidth}/></label>
     <label>Alto de celda (px)<input type="number" min="1" max={source.height} step="1" bind:value={cellHeight}/></label>
     <label>Fotogramas por fila<input type="number" min="1" max={Math.max(1,columns)} step="1" bind:value={frames}/></label>
     <label>Velocidad (fps)<input type="number" min="1" max="60" step="1" bind:value={fps}/></label>
     <label>Fila a previsualizar<input type="number" min="1" max={Math.max(1,rows)} step="1" value={row+1} oninput={event=>row=event.currentTarget.valueAsNumber-1}/></label>
     <label>Ampliación<select bind:value={zoom}><option value={1}>1× · tamaño real</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option></select></label>
    </div>
    <p class="hint">Las columnas se leen de izquierda a derecha. En el formato del juego, las filas son NE, SE, SW y NW.{rows===4&&Number.isInteger(row)&&row>=0&&row<4?` Fila seleccionada: ${directions[row]}.`:''}</p>
    {#if problem}<p class="error" role="alert">{problem}</p>{/if}
    {#if remainder}<p class="notice">Las medidas no encajan exactamente: el borde sobrante queda fuera de la animación. Ajusta el tamaño de celda si ves cortes.</p>{/if}
    <div class="playback"><button disabled={!valid} onclick={()=>playing=!playing}>{playing?'Pausar':'Reproducir'}</button><span>Fotograma {valid?frame+1:'—'} / {frames||'—'}</span></div>
    <label class="scrubber">Elegir fotograma<input aria-label="Elegir fotograma" type="range" min="0" max={Math.max(0,frames-1)||0} step="1" value={frame} disabled={!valid} oninput={event=>{playing=false;frame=event.currentTarget.valueAsNumber;}}/></label>
    <label class="checkbox"><input type="checkbox" bind:checked={showAnchor}/> Mostrar apoyo de referencia (32, 80)</label>
   </div>
   <div class="preview" aria-label="Vista previa de la hoja cargada">
    {#if valid}
     <div class="sprite-space" style:width={`${cellWidth*zoom}px`} style:height={`${cellHeight*zoom}px`}>
      <div class="sprite" style:width={`${cellWidth}px`} style:height={`${cellHeight}px`} style:transform={`scale(${zoom})`} style:background-image={`url("${source.url}")`} style:background-position={`${-frame*cellWidth}px ${-row*cellHeight}px`}>
       {#if showAnchor&&cellWidth>32&&cellHeight>80}<span class="anchor" aria-hidden="true"></span>{/if}
      </div>
     </div>
    {:else}<p>Ajusta la cuadrícula para ver la animación.</p>{/if}
   </div>
  </div>
  <details><summary>Ver hoja completa</summary><div class="sheet"><img src={source.url} alt={`Hoja completa: ${source.name}`}/></div></details>
 {:else}
  <p class="empty">PNG transparente · Celdas iniciales de 64 × 96 px · Tamaño de celda, fila y velocidad ajustables</p>
 {/if}
</section>

<style>
 .upload-section{margin-top:28px;padding:28px;background:#fffdf5;border:1px solid #dce3d4;border-radius:12px;color:#304535}
 h2{font-size:21px;margin:0 0 14px}p{font-size:14px;line-height:1.7;margin:0 0 14px}.intro{display:flex;align-items:center;justify-content:space-between;gap:24px}.intro>div{max-width:680px}
 button,.upload-button{font:inherit;font-size:13px;border:1px solid #bdcbb0;border-radius:6px;padding:10px 14px;background:white;color:#304535;cursor:pointer;white-space:nowrap}.upload-button{position:relative;overflow:hidden;background:#526e37;color:white;border-color:#526e37}.upload-button input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}.upload-button:focus-within,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #526e37;outline-offset:3px}button:disabled{opacity:.45;cursor:default}
 .file-info{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid #dce3d4;padding-top:20px;margin-top:16px}.file-info p{overflow-wrap:anywhere;min-width:0}.workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,320px);gap:28px;margin-top:12px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}label{display:grid;gap:7px;font-size:13px}input[type=number],select{box-sizing:border-box;width:100%;min-width:0;font:inherit;padding:8px;background:white;border:1px solid #cbd7be;border-radius:6px}.hint{font-size:12px;margin-top:14px}.error{background:#fbece6;color:#933d2c;padding:10px;border-radius:6px}.notice{background:#f4efd4;padding:10px;border-radius:6px}.playback{display:flex;align-items:center;gap:16px;font-size:13px;margin:16px 0}.scrubber{margin-bottom:16px}input[type=range]{width:100%;accent-color:#526e37}.checkbox{display:flex;align-items:center;gap:8px}.checkbox input{accent-color:#526e37}
 .preview,.sheet{background-color:#eef1e8;background-image:conic-gradient(#dce3d4 25%,transparent 0 50%,#dce3d4 0 75%,transparent 0);background-size:20px 20px}.preview{border:1px solid #dce3d4;border-radius:8px;min-height:300px;max-height:480px;overflow:auto;display:flex;padding:20px}.preview>p{margin:auto;background:#fffdf5;padding:12px}.sprite-space{flex-shrink:0;margin:auto}.sprite{position:relative;transform-origin:top left;image-rendering:pixelated;background-repeat:no-repeat;outline:1px solid #526e3766;overflow:hidden}.anchor{position:absolute;left:32px;top:80px;width:9px;height:9px;transform:translate(-50%,-50%);background:linear-gradient(#e07628,#e07628) center/1px 9px no-repeat,linear-gradient(#e07628,#e07628) center/9px 1px no-repeat}
 details{margin-top:24px;font-size:13px}summary{cursor:pointer;padding:8px 0}.sheet{overflow:auto;max-height:500px;margin-top:10px}.sheet img{display:block;max-width:none;image-rendering:pixelated}.empty{margin:14px 0 0;padding:18px;border:1px dashed #bdcbb0;border-radius:8px;font-size:13px}
 @media(max-width:700px){.upload-section{padding:20px}.intro{align-items:flex-start;flex-direction:column;gap:8px}.workspace{grid-template-columns:minmax(0,1fr)}.preview{min-height:240px}.file-info{align-items:flex-start}.fields{gap:12px}.file-info button{padding:8px}}
</style>
