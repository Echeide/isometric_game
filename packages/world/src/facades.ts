import type {MapFacade,Wall,WorldScene} from './types';
import {hasTile,sceneWalls} from './walls';
import {levelAt,stairAt,LEVEL_HEIGHT} from './elevation';
export const FACADE_MODULE=32;
export const facadeWidth=(scene:WorldScene,edge:MapFacade['edge'])=>edge==='ne'?scene.width:scene.height;
/** Image columns run left to right on screen, including the NW edge. */
export function facadeCell(scene:WorldScene,edge:MapFacade['edge'],column:number){return edge==='ne'?{x:column,y:0}:{x:0,y:scene.height-1-column};}
export function facadeWall(scene:WorldScene,edge:MapFacade['edge'],column:number):Wall{return {...facadeCell(scene,edge,column),axis:edge==='ne'?'x':'y',kind:'door'};}
export function facadeForWall(scene:WorldScene,wall:Wall){return scene.facades?.find(f=>f.edge==='ne'?wall.axis==='x'&&wall.y===0:wall.axis==='y'&&wall.x===0);}
/** Old nonzero bases were deliberately positioned; level-zero facades follow the terrain. */
export const facadeBaseMode=(f:MapFacade)=>f.baseMode??(f.baseLevel===0?'terrain':'fixed');
/** One continuous plane supported by the lowest non-void tile along its own edge. */
export function facadeBaseLevel(scene:WorldScene,f:MapFacade){
 if(facadeBaseMode(f)==='fixed')return f.baseLevel;
 const levels=Array.from({length:facadeWidth(scene,f.edge)},(_,i)=>facadeCell(scene,f.edge,i)).filter(p=>hasTile(scene,p)).map(p=>levelAt(scene,p));
 return levels.length?Math.min(...levels):0;
}
/** Door rectangle in the frontal image's logical coordinates, supported by its access tile. */
export function facadeDoorOpening(scene:WorldScene,f:MapFacade,column:number){
 const cell=facadeCell(scene,f.edge,column),offset=(levelAt(scene,cell)-facadeBaseLevel(scene,f))*LEVEL_HEIGHT;
 const bottom=f.height*FACADE_MODULE-offset,height=Math.min(2*FACADE_MODULE,bottom);
 if(!hasTile(scene,cell)||stairAt(scene,cell)||offset<0||height<=0)return null;
 return {x:column*FACADE_MODULE,y:bottom-height,width:FACADE_MODULE,height,bottom};
}
export function facadeProjection(scene:WorldScene,f:MapFacade){
 const width=facadeWidth(scene,f.edge),height=f.height*FACADE_MODULE;
 return {width:width*FACADE_MODULE,height,a:1,b:f.edge==='ne'?.5:-.5,c:0,d:1,tx:f.edge==='ne'?0:-width*32,ty:(f.edge==='ne'?0:width*16)-facadeBaseLevel(scene,f)*LEVEL_HEIGHT-height};
}
export function validateFacades(scene:WorldScene){
 if(scene.facades===undefined)return;
 const fail=():never=>{throw Error('Fachada no válida: revisa el borde, la imagen, la altura y las puertas.');};
 if(!Array.isArray(scene.facades)||scene.facades.length>2)fail();
 const edges=new Set<string>();
 for(const f of scene.facades){
  if(!f||!['ne','nw'].includes(f.edge)||edges.has(f.edge)||!/^custom\.[a-zA-Z0-9_-]{1,80}$/.test(f.imageId)||!Number.isInteger(f.height)||f.height<1||f.height>32||!Number.isInteger(f.baseLevel)||f.baseLevel< -2||f.baseLevel>2)fail();
  edges.add(f.edge);
  if(f.baseMode!==undefined&&!['terrain','fixed'].includes(f.baseMode))fail();
 }
 for(const f of scene.facades){
  for(const w of sceneWalls(scene).filter(w=>w.exitId&&facadeForWall(scene,w)===f)){
   const column=f.edge==='ne'?w.x:scene.height-1-w.y;
   if(!facadeDoorOpening(scene,f,column))throw Error('La puerta necesita suelo plano y espacio visible en la fachada. Revisa la base y la altura.');
  }
 }
}
