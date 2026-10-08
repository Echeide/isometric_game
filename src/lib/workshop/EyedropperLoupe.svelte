<script lang="ts">
 import {onDestroy,type Snippet} from 'svelte';
 import {eyedropperPixel,eyedropperLoupePosition} from './eyedropper';
 let {active,colors,children}:{active:boolean;colors:Set<string>;children:Snippet}=$props();
 let wrapper:HTMLDivElement,lens:HTMLCanvasElement;
 let position=$state<{left:number;top:number}>(),color=$state(''),valid=$state(false);
 let source:HTMLCanvasElement|undefined,point:{x:number;y:number}|undefined,raf=0;
 const scale=8,radius=8,size=(radius*2+1)*scale;
 function hide(){cancelAnimationFrame(raf);raf=0;source=undefined;point=undefined;position=undefined;}
 $effect(()=>{if(!active)hide();});
 onDestroy(hide);
 function draw(){
  if(!active||!source||!point||!lens)return;
  const ctx=lens.getContext('2d'),original=source.getContext('2d');if(!ctx||!original)return;
  const pixel=original.getImageData(point.x,point.y,1,1).data;
  color='#'+[pixel[0],pixel[1],pixel[2]].map(v=>v.toString(16).padStart(2,'0')).join('');valid=!!pixel[3]&&colors.has(color);
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,size,size);ctx.fillStyle='#dce3d5';ctx.fillRect(0,0,size,size);
  const left=point.x-radius,top=point.y-radius,sx=Math.max(0,left),sy=Math.max(0,top),w=Math.min(source.width,point.x+radius+1)-sx,h=Math.min(source.height,point.y+radius+1)-sy;
  ctx.drawImage(source,sx,sy,w,h,(sx-left)*scale,(sy-top)*scale,w*scale,h*scale);
  // Two outlines keep the exact center pixel visible against light and dark colors.
  ctx.lineWidth=3;ctx.strokeStyle='#20202b';ctx.strokeRect(radius*scale-.5,radius*scale-.5,scale+1,scale+1);
  ctx.lineWidth=1;ctx.strokeStyle='#ffffff';ctx.strokeRect(radius*scale-.5,radius*scale-.5,scale+1,scale+1);
  raf=requestAnimationFrame(draw);
 }
 function move(event:PointerEvent){
  if(!active||!(event.target instanceof HTMLCanvasElement)||event.target===lens){hide();return;}
  const canvas=event.target,bounds=canvas.getBoundingClientRect(),next=eyedropperPixel(event.clientX,event.clientY,bounds,canvas.width,canvas.height);if(!next){hide();return;}
  source=canvas;point=next;const area=wrapper.getBoundingClientRect();position=eyedropperLoupePosition(event.clientX-area.left,event.clientY-area.top,area.width,area.height,size+6);
  cancelAnimationFrame(raf);draw();
 }
</script>

<div class="preview" bind:this={wrapper} role="group" aria-label="Vista previa con lupa del cuentagotas" onpointermove={move} onpointerleave={hide} onpointercancel={hide}>
 {@render children()}
 <div class="loupe" aria-hidden="true" hidden={!active||!position} style:left={`${position?.left??0}px`} style:top={`${position?.top??0}px`}>
  <canvas bind:this={lens} width={size} height={size}></canvas>
  <span class:invalid={!valid}><i style:background={color}></i>{valid?color:'Fuera del recurso'}</span>
 </div>
</div>

<style>
 .preview{position:relative;min-width:0}.loupe{position:absolute;width:136px;height:136px;pointer-events:none;z-index:2;border:3px solid white;box-sizing:content-box;border-radius:50%;overflow:hidden;box-shadow:0 3px 16px #14231670,0 0 0 1px #304535}.loupe[hidden]{display:none}.loupe canvas{display:block;width:100%;height:100%;image-rendering:pixelated}.loupe span{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:5px;white-space:nowrap;background:#20202be8;color:white;border-radius:4px;padding:3px 6px;font:10px/1.2 monospace}.loupe i{width:10px;height:10px;border:1px solid #ffffff80}.loupe .invalid{font:9px/1.2 system-ui}.loupe .invalid i{display:none}
</style>
