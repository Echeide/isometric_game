<script lang="ts">
 import {onMount} from 'svelte';
 import {characterImage,type ActorPose,type CharacterPack,type ObjectSprite} from '@isometrico/world';
 import type {ResourceKind} from '$lib/workshop/resources';
 let {kind,item,character,pose='idle',direction=1,playing=true,zoom=2,size={x:1,y:1},tileImage='',tileFrame,reference,floorImage,resolve,onshift}:{kind:ResourceKind;item?:ObjectSprite;character?:CharacterPack;pose?:ActorPose;direction?:number;playing?:boolean;zoom?:number;size?:{x:number;y:number};tileImage?:string;tileFrame?:[number,number,number,number];reference:CharacterPack;floorImage:string;resolve:(url:string)=>string;onshift?:(dx:number,dy:number)=>void}=$props();
 let canvas:HTMLCanvasElement;
 const images=new Map<string,HTMLImageElement>();
 let elapsed=0,previousPose='',drag:{id:number;x:number;y:number}|null=null;
 function get(url:string){const source=resolve(url);if(!source)return null;let image=images.get(source);if(!image){image=new Image();image.src=source;images.set(source,image);}return image.complete&&image.naturalWidth?image:null;}
 function paint(ctx:CanvasRenderingContext2D,url:string,frame:number[]|undefined,x:number,y:number,w:number,h:number){
  const image=get(url);if(!image||!Number.isFinite(w+h+x+y)||w<=0||h<=0)return;
  const [sx,sy,sw,sh]=frame??[0,0,image.naturalWidth,image.naturalHeight];
  if(sw>0&&sh>0&&sx>=0&&sy>=0&&sx+sw<=image.naturalWidth&&sy+sh<=image.naturalHeight)ctx.drawImage(image,sx,sy,sw,sh,Math.round(x),Math.round(y),w,h);
 }
 function draw(dt:number){
  const signature=`${kind}:${pose}:${direction}:${character?.animations[pose]?.image??''}:${item?.image??''}`;
  if(previousPose!==signature){elapsed=0;previousPose=signature;}if(playing)elapsed+=dt;
  const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,680,430);ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.translate(340,kind==='tile'?82:170);ctx.scale(zoom,zoom);
  const floor=kind==='tile'?tileImage:floorImage;
  for(let sum=0;sum<=6;sum++)for(let x=0;x<=3;x++){const y=sum-x;if(y<0||y>3)continue;const px=(x-y)*32,py=(x+y)*16;paint(ctx,floor,kind==='tile'?tileFrame:undefined,px-32,py,64,32);}
  if(kind!=='tile'){
   // Match the same grid origin and 2:1 projection as the world renderer.
   ctx.translate(0,32);
   const w=size.x*32,h=size.y*32;
   ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,w/2);ctx.lineTo(w-h,(w+h)/2);ctx.lineTo(-h,h/2);ctx.closePath();ctx.fillStyle='#9dbd6340';ctx.fill();ctx.strokeStyle='#678544';ctx.lineWidth=1/zoom;ctx.stroke();
   const refScale=reference.scale??1,refClip=reference.animations.idle;
   paint(ctx,characterImage(reference,'idle','728da5'),[0,(refClip.row+1)*reference.frameHeight,reference.frameWidth,reference.frameHeight],-85-reference.anchor[0]*refScale,20-reference.anchor[1]*refScale,reference.frameWidth*refScale,reference.frameHeight*refScale);
   if(kind==='player'&&character){
    const c=character,clip=c.animations[pose],scale=c.scale??1,index=clip?Math.floor(elapsed*clip.fps)%clip.frames:0;
    if(clip)paint(ctx,characterImage(c,pose),[index*c.frameWidth,(clip.row+direction)*c.frameHeight,c.frameWidth,c.frameHeight],-c.anchor[0]*scale,16-c.anchor[1]*scale,c.frameWidth*scale,c.frameHeight*scale);
   }else if(item){
    const clip=kind==='npc'?(pose==='talk'?(item.animations?.talk??item.animations?.idle):item.animations?.idle):undefined;
    const frame=clip?[Math.floor(elapsed*clip.fps)%clip.frames*clip.frameWidth,clip.row*clip.frameHeight,clip.frameWidth,clip.frameHeight]:item.frame;
    paint(ctx,clip?.image??item.image,frame,-item.origin[0],-item.origin[1],item.width,item.height);
   }
   const cx=(size.x-size.y)*16,cy=(size.x+size.y)*8;
   ctx.strokeStyle='#d17943';ctx.lineWidth=1/zoom;ctx.beginPath();ctx.moveTo(cx-5,cy);ctx.lineTo(cx+5,cy);ctx.moveTo(cx,cy-5);ctx.lineTo(cx,cy+5);ctx.stroke();
  }
  ctx.restore();
 }
 onMount(()=>{let raf=0,last=performance.now();const tick=(now:number)=>{draw(Math.min(.05,(now-last)/1000));last=now;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);});
 function down(event:PointerEvent){if(kind==='tile'||!onshift||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent){if(!drag||drag.id!==event.pointerId)return;const rect=canvas.getBoundingClientRect();onshift?.((event.clientX-drag.x)*680/rect.width/zoom,(event.clientY-drag.y)*430/rect.height/zoom);drag={id:event.pointerId,x:event.clientX,y:event.clientY};}
 function up(event:PointerEvent){if(drag?.id===event.pointerId){drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}}
</script>
<div class="stage">
 <canvas width="680" height="430" bind:this={canvas} aria-label={kind==='tile'?'Vista previa del suelo repetido':'Vista previa del recurso sobre la retícula con un personaje de referencia'} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>Vista previa del recurso.</canvas>
 <div class="legend"><span>{kind==='tile'?'Mosaico · 4 × 4 casillas':'Referencia a la izquierda · Recurso a la derecha'}</span><span>{kind==='tile'?'Comprueba las uniones':'Arrastra el dibujo para ajustar su apoyo'}</span></div>
</div>
<style>
 .stage{background:radial-gradient(ellipse at 50% 50%,#f3f5e8,#e7eddd);border:1px solid #d8e1d0;border-radius:16px;overflow:hidden}.stage canvas{display:block;width:100%;height:auto;touch-action:none;cursor:grab}.stage canvas:active{cursor:grabbing}.legend{display:flex;justify-content:space-between;gap:12px;padding:14px 18px;border-top:1px solid #d7dfcf;font-size:11px;color:#68795c;background:#f2f5e9}@media(max-width:700px){.legend{flex-direction:column;gap:4px}}
</style>
