<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {Maximize2,RotateCw,RotateCcw,Move,ArrowUp,ArrowDown,ArrowLeft,ArrowRight,Crosshair,X,Minus,Plus,Lock,Unlock} from 'lucide-svelte';
 let {disabled=false,width,height,scale,rotation,locked,onlock,onscale,ondimension,onrotate,onshift,onsupport}:{disabled?:boolean;width:number;height:number;scale:number;rotation:number;locked:boolean;onlock:(value:boolean)=>void;onscale:(value:number)=>void;ondimension:(axis:'width'|'height',value:number)=>void;onrotate:(value:number)=>void;onshift:(dx:number,dy:number)=>void;onsupport:()=>void}=$props();
 let tool=$state<'size'|'rotate'|'move'|null>(null);
 function toggle(value:typeof tool){tool=tool===value?null:value;}
</script>
<svelte:window onkeydown={e=>{if(e.key==='Escape')tool=null;}}/>
<div class="transform-tools" role="group" aria-label={ui.text("Herramientas de transformación")}>
 <div class="tools" role="group" aria-label={ui.text("Transformar imagen")}>
  <button type="button" {disabled} title={ui.text("Ajustar tamaño")} aria-label={ui.text("Ajustar tamaño")} aria-expanded={tool==='size'} class:active={tool==='size'} onclick={()=>toggle('size')}><Maximize2 size={18}/></button>
  <button type="button" {disabled} title={ui.text("Inclinar imagen")} aria-label={ui.text("Inclinar imagen")} aria-expanded={tool==='rotate'} class:active={tool==='rotate'} onclick={()=>toggle('rotate')}><RotateCw size={18}/></button>
  <button type="button" {disabled} title={ui.text("Ajustar posición")} aria-label={ui.text("Ajustar posición")} aria-expanded={tool==='move'} class:active={tool==='move'} onclick={()=>toggle('move')}><Move size={18}/></button>
 </div>
 {#if tool}
 <fieldset class="panel" {disabled}>
  <div class="heading"><strong>{tool==='size'?ui.text("Tamaño"):tool==='rotate'?ui.text("Inclinación"):ui.text("Posición")}</strong><button type="button" title={ui.text("Cerrar herramientas")} aria-label={ui.text("Cerrar herramientas")} onclick={()=>tool=null}><X size={15}/></button></div>
  {#if tool==='size'}
   <label>{ui.text("Escala")} <span>{scale}%</span><input aria-label={ui.text("Escala del objeto")} type="range" min="5" max="400" step="1" value={scale} oninput={e=>onscale(e.currentTarget.valueAsNumber)}/></label>
   <div class="dimensions"><label>{ui.text("Ancho (px)")}<input aria-label={ui.text("Ancho del dibujo")} type="number" min="1" max="4096" step="0.5" value={Math.round(width*100)/100} oninput={e=>ondimension('width',e.currentTarget.valueAsNumber)}/></label><button type="button" title={locked?ui.text("Desbloquear proporciones"):ui.text("Mantener proporciones")} aria-label={ui.text("Mantener proporciones")} aria-pressed={locked} onclick={()=>onlock(!locked)}>{#if locked}<Lock size={15}/>{:else}<Unlock size={15}/>{/if}</button><label>{ui.text("Alto (px)")}<input aria-label={ui.text("Alto del dibujo")} type="number" min="1" max="4096" step="0.5" value={Math.round(height*100)/100} oninput={e=>ondimension('height',e.currentTarget.valueAsNumber)}/></label></div>
   <small>{ui.text("Tamaño en el juego; el zoom de vista no cambia.")}</small>
  {:else if tool==='rotate'}
   <label>{ui.text("Grados")} <input aria-label={ui.text("Inclinación en grados")} type="number" min="-180" max="180" step="0.5" value={rotation} oninput={e=>onrotate(e.currentTarget.valueAsNumber)}/></label>
   <input aria-label={ui.text("Ajuste fino de inclinación")} type="range" min="-30" max="30" step="0.5" value={rotation} oninput={e=>onrotate(e.currentTarget.valueAsNumber)}/>
   <div class="rotation-actions"><button type="button" title={ui.text("Inclinar medio grado a la izquierda")} aria-label={ui.text("Inclinar medio grado a la izquierda")} disabled={disabled||rotation<=-180} onclick={()=>onrotate(rotation-.5)}><Minus size={15}/></button><button type="button" disabled={disabled||rotation===0} onclick={()=>onrotate(0)}><RotateCcw size={14}/> {ui.text("Restablecer")}</button><button type="button" title={ui.text("Inclinar medio grado a la derecha")} aria-label={ui.text("Inclinar medio grado a la derecha")} disabled={disabled||rotation>=180} onclick={()=>onrotate(rotation+.5)}><Plus size={15}/></button></div>
   <small>{ui.text("Gira alrededor del apoyo. La huella no cambia.")}</small>
  {:else}
   <div class="arrows"><button type="button" title={ui.text("Subir 1 píxel")} aria-label={ui.text("Subir 1 píxel")} onclick={()=>onshift(0,-1)}><ArrowUp size={17}/></button><div><button type="button" title={ui.text("Mover 1 píxel a la izquierda")} aria-label={ui.text("Mover 1 píxel a la izquierda")} onclick={()=>onshift(-1,0)}><ArrowLeft size={17}/></button><button type="button" title={ui.text("Apoyar sobre la huella")} aria-label={ui.text("Apoyar sobre la huella")} onclick={onsupport}><Crosshair size={17}/></button><button type="button" title={ui.text("Mover 1 píxel a la derecha")} aria-label={ui.text("Mover 1 píxel a la derecha")} onclick={()=>onshift(1,0)}><ArrowRight size={17}/></button></div><button type="button" title={ui.text("Bajar 1 píxel")} aria-label={ui.text("Bajar 1 píxel")} onclick={()=>onshift(0,1)}><ArrowDown size={17}/></button></div>
   <small>{ui.text("También puedes arrastrar la imagen.")}</small>
  {/if}
 </fieldset>
 {/if}
</div>
<style>
 .transform-tools{position:absolute;top:12px;right:12px;z-index:2;max-width:calc(100% - 24px);font-size:12px;color:#263b2e}.tools{display:flex;justify-content:flex-end;gap:3px;width:fit-content;margin-left:auto;padding:4px;background:#fffffff0;border:1px solid #cad8c8;border-radius:10px;box-shadow:0 3px 12px #263b2e15}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:34px;min-height:34px;padding:5px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer}button:hover,button.active{background:#dce8d7}button:focus-visible,input:focus-visible{outline:2px solid #426948;outline-offset:2px}button:disabled{opacity:.4;cursor:default}.panel{box-sizing:border-box;width:270px;max-width:100%;margin:6px 0 0;padding:12px;border:1px solid #cad8c8;border-radius:12px;background:#fffffff5;box-shadow:0 6px 18px #263b2e20;display:grid;gap:10px;min-width:0}.heading{display:flex;align-items:center;justify-content:space-between}.heading button{min-width:26px;min-height:26px}label{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:5px;font-size:12px}input{min-width:0;box-sizing:border-box;max-width:100%;accent-color:#527443}input[type=number]{width:84px;padding:7px;border:1px solid #cad8c8;border-radius:6px;background:white;font:inherit;color:inherit}input[type=range]{width:100%}.dimensions{display:grid;grid-template-columns:1fr 30px 1fr;align-items:end;gap:4px}.dimensions label{display:grid}.dimensions input{width:100%}.rotation-actions{display:flex;justify-content:space-between;gap:4px}.arrows{display:flex;flex-direction:column;align-items:center;gap:2px}.arrows div{display:flex;gap:4px}.arrows button,.rotation-actions button{background:#eef3eb}small{color:#61715e;font-size:11px;line-height:1.4}
</style>
