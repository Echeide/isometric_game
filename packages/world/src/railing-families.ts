import {wallHeight} from './elevation';
import type {Wall,WorldScene} from './types';
export const railingRoles=['middle','start','end','single','cornerStart','cornerEnd'] as const;
export type RailingRole=typeof railingRoles[number];
export interface RailingPiece {id:string;label:string;role:RailingRole;weight:number}
/** Columns are pieces; rows are X and Y. Fixed anchors keep all edited joins aligned. */
export interface RailingFamily {name:string;image:string;originalImage?:string;template:'stone'|'metal';pieces:RailingPiece[]}
export type RailingFamilies=Record<string,RailingFamily>;
export const railingCell=64;
export function railingAnchor(axis:Wall['axis']):[number,number]{return axis==='x'?[16,42]:[48,42];}
export function railingFrame(family:RailingFamily,piece:RailingPiece,axis:Wall['axis']):[number,number,number,number]{return [family.pieces.indexOf(piece)*64,axis==='x'?0:64,64,64];}
export function railingCompatible(scene:WorldScene,a:Wall,b:Wall){return b.kind==='railing'&&(a.railingFamily?b.railingFamily===a.railingFamily:!b.railingFamily&&(b.railingStyle??'stone')===(a.railingStyle??'stone'))&&wallHeight(scene,a)===wallHeight(scene,b);}
export function railingNeighbor(scene:WorldScene,w:Wall,walls:Wall[],step:number){return walls.find(n=>n.axis===w.axis&&railingCompatible(scene,w,n)&&n.x===w.x+(w.axis==='x'?step:0)&&n.y===w.y+(w.axis==='y'?step:0));}
function endpoint(w:Wall,end:number){return {x:w.x+(w.axis==='x'?end:0),y:w.y+(w.axis==='y'?end:0)};}
function corner(scene:WorldScene,w:Wall,walls:Wall[],end:number){const p=endpoint(w,end);return walls.some(n=>n.axis!==w.axis&&railingCompatible(scene,w,n)&&[0,1].some(e=>{const q=endpoint(n,e);return q.x===p.x&&q.y===p.y;}));}
export function railingRole(scene:WorldScene,w:Wall,walls:Wall[]):RailingRole{
 const before=!!railingNeighbor(scene,w,walls,-1),after=!!railingNeighbor(scene,w,walls,1);
 if(!before&&corner(scene,w,walls,0))return 'cornerStart';
 if(!after&&corner(scene,w,walls,1))return 'cornerEnd';
 return before?(after?'middle':'end'):(after?'start':'single');
}
export function railingPiece(scene:WorldScene,w:Wall,walls:Wall[],family:RailingFamily){
 if(w.railingVariant){const manual=family.pieces.find(p=>p.id===w.railingVariant);if(!manual)throw Error('La variante de baranda no existe.');return manual;}
 const role=railingRole(scene,w,walls);let choices=family.pieces.filter(p=>p.role===role&&p.weight>0);
 if(!choices.length)choices=family.pieces.filter(p=>p.role==='middle'&&p.weight>0);
 choices.sort((a,b)=>a.id.localeCompare(b.id));let hash=2166136261;
 for(const ch of `${scene.id}:${w.railingFamily}:${w.x},${w.y}:${w.axis}`){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
 let sample=(hash>>>0)%choices.reduce((n,p)=>n+p.weight,0);
 for(const p of choices){sample-=p.weight;if(sample<0)return p;}
 return choices[0];
}
export function validateRailingFamilies(families:RailingFamilies|undefined,sizes:Map<string,{width:number;height:number}>){
 if(families===undefined)return;
 const fail=()=>{throw Error('Familia de barandas no válida. Usa piezas de 64 × 64 y dos filas de orientaciones.');};
 if(!families||typeof families!=='object'||Array.isArray(families)||Object.keys(families).length>32)fail();
 for(const [id,f]of Object.entries(families)){
  if(!/^custom\.[a-zA-Z0-9_-]{1,80}$/.test(id)||!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>120||!['stone','metal'].includes(f.template)||!Array.isArray(f.pieces)||f.pieces.length<6||f.pieces.length>16)fail();
  const seen=new Set<string>();
  for(const p of f.pieces){if(!p||typeof p.id!=='string'||!/^[-\w]{1,80}$/.test(p.id)||seen.has(p.id)||typeof p.label!=='string'||!p.label.trim()||p.label.length>80||!railingRoles.includes(p.role)||!Number.isInteger(p.weight)||p.weight<0||p.weight>1000)fail();seen.add(p.id);}
  if(railingRoles.some(role=>!f.pieces.some(p=>p.role===role&&p.weight>0)))fail();
  const s=sizes.get(f.image);if(!s||s.width!==f.pieces.length*64||s.height!==128)fail();
  if(f.originalImage){const o=sizes.get(f.originalImage);if(!o||o.width!==s!.width||o.height!==128)fail();}
 }
}
export function validateSceneRailings(scene:WorldScene,families:RailingFamilies={}){
 for(const w of scene.walls??[])if(w.railingFamily){const f=families[w.railingFamily];if(!f)throw Error('Falta la familia de baranda: '+w.railingFamily);if(w.railingVariant&&!f.pieces.some(p=>p.id===w.railingVariant))throw Error('Falta la variante de baranda: '+w.railingVariant);}
}
