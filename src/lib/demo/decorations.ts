import {parseScene,type Cell,type MapDecoration,type VisualAsset,type WorldScene} from '@isometrico/world';
export function insertDecoration(scene:WorldScene,asset:VisualAsset,id:string,position:Cell,options:{allowUnreachable?:boolean}={}){
 if(asset.kind==='person')throw Error('El decorado exterior necesita un objeto.');
 const d:MapDecoration={id,label:asset.label,visualId:asset.id,position:{...position},size:{...asset.size},baseLevel:0,offset:{x:0,y:0},scale:1};
 return parseScene({...scene,decorations:[...scene.decorations??[],d]},options);
}
export function updateDecoration(scene:WorldScene,id:string,patch:Partial<MapDecoration>,options:{allowUnreachable?:boolean}={}){
 return parseScene({...scene,decorations:scene.decorations?.map(d=>d.id===id?{...d,...patch,id}:d)},options);
}
