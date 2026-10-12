import type {Cell,MapDecoration,WorldScene} from './types';
import type {ObjectSprite} from './pixelart';
import {project} from './navigation';
import {LEVEL_HEIGHT} from './elevation';

export function validateDecorations(scene:WorldScene){
 if(scene.decorations===undefined)return;
 const fail=()=>{throw Error('Decorado exterior no válido.');};
 if(!Array.isArray(scene.decorations)||scene.decorations.length>64)fail();
 const ids=new Set(scene.entities.map(e=>e.id));
 for(const d of scene.decorations!){
  if(!d||typeof d.id!=='string'||!d.id.trim()||ids.has(d.id)||typeof d.label!=='string'||!d.label.trim()||d.label.length>120||typeof d.visualId!=='string'||!/^((custom|pixel)\.)[a-zA-Z0-9_-]{1,80}$/.test(d.visualId))fail();
  ids.add(d.id);
  for(const [point,min,max,integer]of [[d.position,-128,128,true],[d.size,1,64,true],[d.offset,-4096,4096,false]] as const)if(!point||![point.x,point.y].every(n=>Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isInteger(n))))fail();
  if(!Number.isInteger(d.baseLevel)||d.baseLevel< -2||d.baseLevel>2||!Number.isFinite(d.scale)||d.scale<.05||d.scale>4)fail();
  if(Object.keys(d).some(k=>!['id','label','visualId','position','size','baseLevel','offset','scale'].includes(k)))fail();
 }
}
export function decorationPosition(d:MapDecoration,position:Cell=d.position){const p=project(position);return {x:p.x+d.offset.x,y:p.y-d.baseLevel*LEVEL_HEIGHT+d.offset.y};}
export function decorationBounds(d:MapDecoration,item:ObjectSprite){
 const p=decorationPosition(d),a=(item.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points:Cell[]=[];
 for(const x of [-item.origin[0],item.width-item.origin[0]])for(const y of [-item.origin[1],item.height-item.origin[1]])points.push({x:p.x+(x*c-y*s)*d.scale,y:p.y+(x*s+y*c)*d.scale});
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
