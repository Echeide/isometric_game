import { pixelActor, type LoadedPixelArt } from './pixelart';
import { Container, Graphics } from 'pixi.js';
import type { Facing, ActorPose } from './types';
export function facingFor(dx:number,dy:number,previous:Facing='se'):Facing {
 if(dx===0&&dy===0)return previous;
 return Math.abs(dx)>=Math.abs(dy)?(dx>0?'se':'nw'):(dy>0?'sw':'ne');
}
/** Articulation is isolated from locomotion. Can be replaced by a sprite-atlas player. */
export function createActor(color:number,me=false,art?:LoadedPixelArt){
 if(art)return pixelActor(art,color,me);
 const view=new Container(), shadow=new Graphics(), body=new Container(), torso=new Graphics(),head=new Container(),face=new Graphics();
 const leftArm=new Graphics(),rightArm=new Graphics(),leftLeg=new Graphics(),rightLeg=new Graphics(),spark=new Graphics();
 shadow.ellipse(0,2,14,6).fill({color:0x193e34,alpha:.16});
 if(me)shadow.ellipse(0,2,20,10).stroke({color:0x78a54c,width:1.5});
 for(const leg of [leftLeg,rightLeg])leg.roundRect(-3,0,6,17,3).fill(0x304951).roundRect(-3,13,8,5,2).fill(0x213638);
 for(const arm of [leftArm,rightArm])arm.roundRect(-3,0,6,9,3).fill(color).roundRect(-2.5,7,5,12,2.5).fill(0xe8b895);
 torso.roundRect(-10,-35,20,22,6).fill(color);
 body.addChild(leftLeg,rightLeg,leftArm,torso,rightArm,head);head.addChild(face);view.addChild(shadow,body,spark);
 let lastFacing:Facing|undefined;let seated=0;
 function drawFace(facing:Facing){
  const back=facing==='ne'||facing==='nw', sign=facing==='se'||facing==='ne'?1:-1;
  face.clear().circle(0,-46,10).fill(0xeac09d).roundRect(-10,-56,20,9,4).fill(0x344140);
  if(back)face.roundRect(-10,-52,20,12,5).fill(0x344140);
  else {face.circle(sign*4,-46,1.2).fill(0x293d39);face.moveTo(sign*3,-40).lineTo(sign*6,-40).stroke({color:0xac7a61,width:1});}
  face.circle(-sign*8,-45,2.4).fill(0xe4ac85);
  if(me)face.poly([-4,-65,4,-65,0,-60]).fill(0x7ca643);
 }
 function update(time:number,dt:number,pose:ActorPose,facing:Facing,reduced=false){
  if(lastFacing!==facing){drawFace(facing);lastFacing=facing;}
  const t=reduced?0:time, walk=pose==='walk',work=pose==='work',sit=pose==='sit'||work, talking=pose==='talk',celebrate=pose==='celebrate';
  seated+=(Number(sit)-seated)*Math.min(1,dt*9);
  const stride=walk?Math.sin(t*16):0;
  body.y=(reduced?0:walk?-Math.abs(Math.sin(t*16))*1.5:Math.sin(t*2)*.6)+seated*10-(celebrate&&!reduced?Math.abs(Math.sin(t*9))*8:0);
  const side=facing==='se'||facing==='ne'?1:-1;
  body.scale.x=1;head.x=side*1.5;
  leftLeg.position.set(-5,-15);rightLeg.position.set(5,-15);
  leftLeg.rotation=stride*.4+seated*side*-.9;rightLeg.rotation=-stride*.4+seated*side*-.9;
  leftArm.position.set(-11,-33);rightArm.position.set(11,-33);
  leftArm.rotation=-stride*.5;rightArm.rotation=stride*.5;
  if(sit){leftArm.rotation=-side*.8+(work?Math.sin(t*15)*.12:0);rightArm.rotation=-side*1+(work?Math.cos(t*15)*.12:0);}
  if(talking)rightArm.rotation=-.8+Math.sin(t*5)*.25;
  if(celebrate){leftArm.rotation=2.6;rightArm.rotation=-2.6;}
  spark.clear();if(celebrate)for(let i=0;i<5;i++){const a=i*1.26+t; spark.circle(Math.cos(a)*25,-38+Math.sin(a)*24,2).fill(i%2?0xe7b76d:0x96bf5f);}
 }
 update(0,1,'idle','se');
 return {view,update};
}
