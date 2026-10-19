<script lang="ts">
 import {resourceBlob} from '$lib/storage/local-adventures';
 let {image,frame,width=80,height=80}:{image:string;frame?:[number,number,number,number];width?:number;height?:number}=$props();
 let canvas=$state<HTMLCanvasElement>();
 $effect(()=>{
  const target=canvas,url=image,crop=frame;if(!target)return;
  const canvasWidth=width,canvasHeight=height,ctx=target.getContext('2d')!;ctx.clearRect(0,0,canvasWidth,canvasHeight);
  if(!url)return;
  let cancelled=false,started=false,objectUrl:string|undefined;const controller=new AbortController(),source=new Image();
  source.onload=()=>{
   if(cancelled)return;
   const [x,y,w,h]=crop??[0,0,source.naturalWidth,source.naturalHeight];
   if(w<=0||h<=0||x<0||y<0||x+w>source.naturalWidth||y+h>source.naturalHeight)return;
   const scale=Math.min((canvasWidth-4)/w,(canvasHeight-4)/h);ctx.imageSmoothingEnabled=false;
   ctx.drawImage(source,x,y,w,h,(canvasWidth-w*scale)/2,(canvasHeight-h*scale)/2,w*scale,h*scale);
  };
  async function load(){
   if(started||cancelled)return;started=true;
   try{
    if(url.startsWith('asset:')){const blob=await resourceBlob(url,undefined,controller.signal);if(cancelled)return;objectUrl=URL.createObjectURL(blob);source.src=objectUrl;}
    else source.src=url;
   }catch{/* Missing previews do not block the map or the catalog. */}
  }
  const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();void load();}},{rootMargin:'160px'});
  if(observer)observer.observe(target);else void load();
  return()=>{cancelled=true;controller.abort();observer?.disconnect();source.onload=null;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 });
</script>
<canvas {width} {height} bind:this={canvas} aria-hidden="true"></canvas>
<style>canvas{display:block;width:100%;height:100%;image-rendering:pixelated}</style>
