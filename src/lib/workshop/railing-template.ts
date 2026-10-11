import {railingRoles,railingAnchor,type RailingFamily,type RailingRole,type WorldScene,type Wall} from '@isometrico/world';
import {railingPolygons} from '../../../packages/world/src/railing-art';
import type {Frame} from '../../../packages/character-generator/src/types';
export const railingRoleLabels:Record<RailingRole,string>={middle:'Tramo central',start:'Inicio',end:'Final',single:'Tramo aislado',cornerStart:'Esquina inicial',cornerEnd:'Esquina final'};
function inside(x:number,y:number,points:number[][]){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function createRailingTemplate(style:'stone'|'metal'):{family:RailingFamily;pixels:Frame}{
 const family:RailingFamily={name:style==='stone'?'Balaustrada de piedra':'Baranda metálica',image:'',template:style,pieces:railingRoles.map(role=>({id:role,label:railingRoleLabels[role],role,weight:100}))};
 const pixels:Frame={width:384,height:128,data:new Uint8ClampedArray(384*128*4)},scene={width:4,height:4} as WorldScene;
 for(const [column,piece]of family.pieces.entries())for(const axis of ['x','y'] as const){
  const w:Wall={x:0,y:0,axis,kind:'railing',railingStyle:style},walls:Wall[]=[w];
  if(['middle','end','cornerEnd'].includes(piece.role))walls.push({...w,x:axis==='x'?-1:0,y:axis==='y'?-1:0});
  if(['middle','start','cornerStart'].includes(piece.role))walls.push({...w,x:axis==='x'?1:0,y:axis==='y'?1:0});
  const [ox,oy]=railingAnchor(axis),row=axis==='x'?0:64;
  for(const face of railingPolygons(scene,w,walls)){
   const points=face.points.map(([x,y])=>[x+ox,y+oy]);
   for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(inside(x+.5,y+.5,points)){const at=((row+y)*pixels.width+column*64+x)*4;pixels.data.set([(face.color>>16)&255,(face.color>>8)&255,face.color&255,255],at);}
  }
 }
 return {family,pixels};
}
function region(sheet:Frame,column:number,axis:Wall['axis']){if(!Number.isInteger(column)||column<0||sheet.width%64||sheet.height!==128||column>=sheet.width/64||sheet.data.length!==sheet.width*sheet.height*4)throw Error('La hoja de barandas no contiene esa pieza.');return {x:column*64,y:axis==='x'?0:64};}
export function extractRailingPiece(sheet:Frame,column:number,axis:Wall['axis']):Frame{const {x,y}=region(sheet,column,axis),data=new Uint8ClampedArray(64*64*4);for(let row=0;row<64;row++)data.set(sheet.data.subarray(((row+y)*sheet.width+x)*4,((row+y)*sheet.width+x+64)*4),row*256);return {width:64,height:64,data};}
export function replaceRailingPiece(sheet:Frame,column:number,axis:Wall['axis'],edited:Frame):Frame{const {x,y}=region(sheet,column,axis);if(edited.width!==64||edited.height!==64||edited.data.length!==64*64*4)throw Error('Conserva el tamaño de 64 × 64 de la pieza.');const data=new Uint8ClampedArray(sheet.data);for(let row=0;row<64;row++)data.set(edited.data.subarray(row*256,(row+1)*256),((y+row)*sheet.width+x)*4);return {...sheet,data};}
export function appendRailingVariant(sheet:Frame,column:number):Frame{region(sheet,column,'x');const width=sheet.width+64,data=new Uint8ClampedArray(width*128*4);for(let row=0;row<128;row++){data.set(sheet.data.subarray(row*sheet.width*4,(row+1)*sheet.width*4),row*width*4);data.set(sheet.data.subarray((row*sheet.width+column*64)*4,(row*sheet.width+column*64+64)*4),(row*width+sheet.width)*4);}return {width,height:128,data};}
