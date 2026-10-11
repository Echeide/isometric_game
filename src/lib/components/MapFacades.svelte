<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 import {facadeWidth,facadeWall,facadeBaseLevel,facadeBaseMode,facadeDoorOpening,type WorldScene,type PixelArtPack,type MapFacade} from '@isometrico/world';
 import {sceneWalls,wallKey} from '../../../packages/world/src/walls';
 import type {Adventure} from '$lib/demo/adventure';
 import {downloadBlob} from '$lib/storage/adventure-package';
 const ui=interfaceLanguage();
 let {value,graphics,adventure,busy=false,edge=$bindable('ne'),onchange,onupload,ondoor,onselect}:{value:WorldScene;graphics:PixelArtPack;adventure:Adventure;busy?:boolean;edge?:MapFacade['edge'];onchange:(scene:WorldScene)=>void;onupload:(file:File,edge:MapFacade['edge'],height:number)=>Promise<void>;ondoor:(edge:MapFacade['edge'],column:number,target:string)=>void;onselect:(id:string)=>void}=$props();
 let newHeight=$state(4),column=$state(0),target=$state(''),uploadError=$state('');
 const facade=$derived(value.facades?.find(f=>f.edge===edge)),width=$derived(facadeWidth(value,edge)),height=$derived(facade?.height??newHeight);
 const resource=$derived(facade?graphics.facades?.[facade.imageId]:undefined);
 const doors=$derived(sceneWalls(value).filter(w=>w.exitId&&(edge==='ne'?w.axis==='x'&&w.y===0:w.axis==='y'&&w.x===0)));
 function setFacade(next:MapFacade|undefined){onchange({...value,facades:[...(value.facades??[]).filter(f=>f.edge!==edge),...(next?[next]:[])]});}
 async function upload(event:Event){const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;uploadError='';try{if(file.size>10_000_000)throw Error('La imagen no puede superar 10 MB.');const bitmap=await createImageBitmap(file);bitmap.close();await onupload(file,edge,height);}catch(e){uploadError=(e as Error).message;}}
 function template(){
  const scale=64,canvas=document.createElement('canvas');canvas.width=width*scale;canvas.height=height*scale;
  const c=canvas.getContext('2d')!;c.fillStyle='#f1f3ec';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle='#819474';c.lineWidth=1;
  for(let x=0;x<=width;x++){c.beginPath();c.moveTo(x*scale,0);c.lineTo(x*scale,canvas.height);c.stroke();}
  for(let y=0;y<=height;y++){c.beginPath();c.moveTo(0,y*scale);c.lineTo(canvas.width,y*scale);c.stroke();}
  const f=facade??{edge,height,baseLevel:0,imageId:''};c.font='16px sans-serif';
  for(let x=0;x<width;x++){
   const opening=facadeDoorOpening(value,f,x),bottom=opening?opening.bottom*2:canvas.height;
   if(opening){c.fillStyle='#6d927d40';c.fillRect(x*scale,bottom,scale,canvas.height-bottom);c.strokeStyle='#426e57';c.lineWidth=3;c.beginPath();c.moveTo(x*scale,bottom);c.lineTo((x+1)*scale,bottom);c.stroke();}
   c.fillStyle='#334b2d';c.fillText(String(x+1),x*scale+8,Math.max(18,bottom-10));
  }
  canvas.toBlob(blob=>{if(blob)downloadBlob(blob,`fachada-${edge}-${width}x${height}.png`);},'image/png');
 }
</script>
<section aria-label={ui.text('Fachadas')}>
 <h3>{ui.text('Fachadas')}</h3>
 <p>{ui.text('Carga una imagen frontal, sin perspectiva. Se ajustará al ancho completo del borde.')}</p>
 <label>{ui.text('Borde de la fachada')}<select bind:value={edge} onchange={()=>column=0}><option value="ne">{ui.text('Noreste')}</option><option value="nw">{ui.text('Noroeste')}</option></select></label>
 <div class="pair"><label>{ui.text('Ancho en módulos')}<output>{width}</output></label><label>{ui.text('Altura en módulos')}<input type="number" min="1" max="32" step="1" value={height} onchange={e=>{const n=+e.currentTarget.value;if(facade)setFacade({...facade,height:n});else newHeight=Math.max(1,Math.min(32,Math.round(n)||1));}}/></label></div>
 <button onclick={template}>{ui.text('Descargar plantilla PNG')}</button>
 <label>{ui.text('Imagen de fachada')}<select disabled={busy} value={facade?.imageId??''} onchange={e=>setFacade(e.currentTarget.value?{...facade,edge,imageId:e.currentTarget.value,height,baseLevel:facade?.baseLevel??0}:undefined)}><option value="">{ui.text('Sin fachada')}</option>{#each Object.entries(graphics.facades??{}) as [id,f]}<option value={id}>{f.name}</option>{/each}</select></label>
 <label>{busy?ui.text('Cargando…'):ui.text('Cargar PNG de fachada')}<input type="file" accept="image/png,.png" disabled={busy} onchange={upload}/></label>
 {#if uploadError}<p role="alert">{ui.text(uploadError)}</p>{/if}
 {#if facade&&resource}
  <label>{ui.text('Apoyo de la fachada')}<select value={facadeBaseMode(facade)} onchange={e=>setFacade({...facade!,baseMode:e.currentTarget.value as 'terrain'|'fixed',baseLevel:facadeBaseLevel(value,facade!)})}><option value="terrain">{ui.text('Automático según el borde')}</option><option value="fixed">{ui.text('Nivel fijo')}</option></select></label>
  <label>{ui.text('Nivel de la base')}<input type="number" min="-2" max="2" step="1" disabled={facadeBaseMode(facade)==='terrain'} value={facadeBaseLevel(value,facade)} onchange={e=>setFacade({...facade!,baseMode:'fixed',baseLevel:+e.currentTarget.value})}/></label>
  <p>{ui.text('La fachada conserva un solo plano. La base automática toma el suelo más bajo del borde; el terreno elevado oculta la parte inferior.')}</p>
  <div class="preview" style:aspect-ratio={`${width}/${height}`}>
   <img src={resource.image} alt={resource.name}/>
   {#each Array.from({length:width},(_,i)=>i) as i}
    {@const wall=doors.find(w=>wallKey(w)===wallKey(facadeWall(value,edge,i)))}
    {@const opening=facadeDoorOpening(value,facade,i)}
    <button class="cell" disabled={!opening} class:linked={!!wall} class:chosen={column===i} style:left={`${i/width*100}%`} style:width={`${100/width}%`} style:bottom={`${opening?(1-opening.bottom/(height*32))*100:0}%`} style:height={`${(opening?.height??16)/(height*32)*100}%`} aria-label={ui.text('Módulo {arg0}',{arg0:i+1})} title={`${i+1}`} onclick={()=>column=i}>{i+1}</button>
   {/each}
  </div>
  <p>{ui.text('Marca el módulo de la puerta en la imagen. Cada acceso ocupa un módulo de ancho y hasta dos de alto.')}</p>
  <label>{ui.text('Módulo de la puerta')}<input type="number" min="1" max={width} value={Math.min(column,width-1)+1} onchange={e=>column=Math.max(0,Math.min(width-1,Math.floor(+e.currentTarget.value)-1))}/></label>
  {@const existing=doors.find(w=>wallKey(w)===wallKey(facadeWall(value,edge,Math.min(column,width-1))))}
  {#if existing}<button onclick={()=>onselect(existing.exitId!)}>{ui.text('Editar puerta y destino')}</button>{:else}
   <label>{ui.text('Mapa destino')}<select bind:value={target}><option value="">{ui.text('Selecciona un mapa')}</option>{#each adventure.maps.filter(m=>m.id!==value.id) as map}<option value={map.id}>{map.name}</option>{/each}</select></label>
   <button disabled={!target||busy||!facadeDoorOpening(value,facade,Math.min(column,width-1))} onclick={()=>ondoor(edge,Math.min(column,width-1),target)}>{ui.text('Crear puerta de fachada')}</button>
  {/if}
  <p>{ui.text('Cada puerta se marca a la altura de su casilla. Dibuja la entrada en esa zona de la imagen. Necesita suelo plano y espacio visible en la fachada.')}</p>
 {/if}
</section>
<style>
 section{border-top:1px solid #dce5d6;padding-top:16px;margin:18px 0;color:#3c5135}h3{font-size:14px;margin:0 0 10px}p{font-size:11px;line-height:1.5;color:#718269}label{display:grid;gap:6px;font-size:12px;margin:12px 0}select,input,button{font:inherit;font-size:12px;border:1px solid #dce5d6;border-radius:6px;padding:8px;background:white;color:#3c5135;box-sizing:border-box;max-width:100%}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}output{padding:9px}.preview{position:relative;width:100%;background:repeating-conic-gradient(#eef1e9 0% 25%,#fff 0% 50%) 0/16px 16px}.preview img{width:100%;height:100%;display:block;image-rendering:pixelated}.cell{position:absolute;bottom:0;padding:0;border-radius:0;background:#8bad4a25;border-color:#52694a80;font-size:10px}.cell.chosen{outline:2px solid #375827;outline-offset:-2px;background:#a3d86166}.cell.linked{background:#61bcca70}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
