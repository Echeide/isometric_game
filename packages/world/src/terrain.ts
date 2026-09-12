import {environments} from './environments';
import type {Cell,TileKind,WorldScene} from './types';
export function defaultTile(scene:WorldScene,{x,y}:Cell):TileKind{
 return scene.theme==='outdoors'&&(y===5||y===6||x===6)?'path':environments[scene.theme].tile;
}
export function tileAt(scene:WorldScene,cell:Cell):TileKind|'void'{return scene.tiles?.[`${cell.x},${cell.y}`]??defaultTile(scene,cell);}
