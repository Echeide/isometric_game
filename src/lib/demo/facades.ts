import {facadeCell,facadeWall,facadeDoorOpening,type MapFacade} from '@isometrico/world';
import {sceneWalls,wallKey,automaticWallKeys} from '../../../packages/world/src/walls';
import {walkable} from '../../../packages/world/src/navigation';
import {connectMaps,parseAdventure,type Adventure} from './adventure';
export function connectFacadeDoor(value:Adventure,mapId:string,edge:MapFacade['edge'],column:number,target:string,id:string){
 const map=value.maps.find(m=>m.id===mapId),facade=map?.facades?.find(f=>f.edge===edge);
 if(!map||!facade)throw Error('Añade primero una fachada.');
 const cell=facadeCell(map,edge,column),wall=facadeWall(map,edge,column);
 if(!Number.isInteger(column)||column<0||column>=(edge==='ne'?map.width:map.height)||!walkable(map,cell)||map.entities.some(e=>e.position.x===cell.x&&e.position.y===cell.y))throw Error('La puerta necesita una casilla libre en el borde.');
 if(!facadeDoorOpening(map,facade,column))throw Error('La puerta necesita suelo plano y espacio visible en la fachada. Revisa la base y la altura.');
 if(sceneWalls(map).some(w=>wallKey(w)===wallKey(wall)&&w.exitId))throw Error('Este módulo ya tiene una puerta conectada.');
 const next=connectMaps(value,mapId,target,id,undefined,cell);
 return parseAdventure({...next,maps:next.maps.map(m=>m.id!==mapId?m:{...m,automaticWalls:automaticWallKeys(m).filter(k=>k!==wallKey(wall)),walls:[...sceneWalls(m).filter(w=>wallKey(w)!==wallKey(wall)),{...wall,exitId:id}],entities:m.entities.map(e=>e.id!==id?e:{...e,solid:false,interactionPoints:[cell]})})});
}
