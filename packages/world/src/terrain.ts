import {environments} from './environments';
import type {Cell,TileKind,WorldScene} from './types';
import type {PixelArtPack} from './pixelart';
import {terrainSides,interiorMembers,sampleTileVariant,type TileFamilies} from './tile-families';
export function terrainAt(scene:WorldScene,cell:Cell){const key=`${cell.x},${cell.y}`;return tileAt(scene,cell)==='void'?undefined:scene.terrains?.[key]??(scene.tiles?.[key]===undefined?scene.baseTerrain:undefined);}
/** Only an explicitly automatic cell changes graphic. Manually painted cells remain fixed. */
export function terrainTileAt(scene:WorldScene,pack:PixelArtPack,cell:Cell):TileKind|'void'{
 const fallback=tileAt(scene,cell),id=terrainAt(scene,cell),family=id?pack.tileFamilies?.[id]:undefined;if(!family||fallback==='void')return fallback;
 let mask=0;
 for(const side of terrainSides){const neighbor={x:cell.x+side.dx,y:cell.y+side.dy},outside=neighbor.x<0||neighbor.y<0||neighbor.x>=scene.width||neighbor.y>=scene.height;
  const same=!outside&&(terrainAt(scene,neighbor)===id||Object.hasOwn(family.tiles,tileAt(scene,neighbor)));
  if(!same&&(outside||!family.borderAgainst||tileAt(scene,neighbor)===family.borderAgainst))mask|=side.bit;
 }
 return family.borders?.[String(mask)]??sampleTileVariant(interiorMembers(family),cell.x,cell.y)?.id??fallback;
}
export function defaultTile(scene:WorldScene,_cell:Cell):TileKind{
 return scene.baseTile??environments[scene.theme].tile;
}
export function tileAt(scene:WorldScene,cell:Cell):TileKind|'void'{return scene.tiles?.[`${cell.x},${cell.y}`]??defaultTile(scene,cell);}
/** Validate resource references at the host / rendering boundary; maps keep stable tile IDs. */
export function validateSceneTiles(scene:WorldScene,tiles:Record<TileKind,string>,families?:TileFamilies){
 for(const id of new Set([scene.baseTerrain,...Object.values(scene.terrains??{})].filter(Boolean)))if(families&&!Object.hasOwn(families,id!))throw new Error(`Falta la familia de terreno ${id} utilizada en ${scene.name}.`);
 if(scene.baseTile&&!Object.hasOwn(tiles,scene.baseTile))throw new Error(`Falta el suelo base ${scene.baseTile} utilizado en ${scene.name}.`);
 for(const id of new Set(Object.values(scene.tiles??{})))if(id!=='void'&&!Object.hasOwn(tiles,id))throw new Error(`Falta el suelo ${id} utilizado en ${scene.name}.`);
}
