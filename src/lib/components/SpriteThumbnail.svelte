<script lang="ts">
 let {image,frame,width=80,height=80}:{image:string;frame?:[number,number,number,number];width?:number;height?:number}=$props();
 let canvas=$state<HTMLCanvasElement>();
 $effect(()=>{
  const target=canvas,url=image,crop=frame;if(!target)return;
  const canvasWidth=width,canvasHeight=height,ctx=target.getContext('2d')!;ctx.clearRect(0,0,canvasWidth,canvasHeight);
  if(!url)return;
  let cancelled=false;const source=new Image();
  source.onload=()=>{
   if(cancelled)return;
   const [x,y,w,h]=crop??[0,0,source.naturalWidth,source.naturalHeight];
   if(w<=0||h<=0||x<0||y<0||x+w>source.naturalWidth||y+h>source.naturalHeight)return;
   const scale=Math.min((canvasWidth-4)/w,(canvasHeight-4)/h);ctx.imageSmoothingEnabled=false;
   ctx.drawImage(source,x,y,w,h,(canvasWidth-w*scale)/2,(canvasHeight-h*scale)/2,w*scale,h*scale);
  };
  source.src=url;return()=>{cancelled=true;source.onload=null;};
 });
</script>
<canvas {width} {height} bind:this={canvas} aria-hidden="true"></canvas>
<style>canvas{display:block;width:100%;height:100%;image-rendering:pixelated}</style>
