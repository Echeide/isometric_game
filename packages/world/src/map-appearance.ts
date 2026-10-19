import type {WorldScene,WallMaterial} from './types';
import {resolveEnvironment} from './environments';
import {sceneWalls,defaultWalls,automaticWallKeys,wallKey} from './walls';
/** Preserve authored walls/doors while managing generated perimeter walls independently. */
export function changeMapEnvironment(scene:WorldScene,environment:'interior'|'exterior'):WorldScene{
 const next={...scene,environment};if(scene.walls===undefined)return next;
 const generated=new Set(automaticWallKeys(scene)),custom=sceneWalls(scene).filter(w=>!generated.has(wallKey(w)));
 const occupied=new Set(custom.map(wallKey)),automatic=environment==='interior'?defaultWalls(next).filter(w=>!occupied.has(wallKey(w))):[];
 return {...next,walls:[...custom,...automatic],automaticWalls:automatic.map(wallKey)};
}
export function changeWallDefault(scene:WorldScene,wallMaterial:WallMaterial):WorldScene{
 const generated=new Set(automaticWallKeys(scene));return {...scene,wallMaterial,...(scene.walls?{walls:scene.walls.map(w=>generated.has(wallKey(w))?{...w,material:wallMaterial}:w)}:{})};
}
export function resizeMapWalls(scene:WorldScene,width:number,height:number):WorldScene{
 // Cell layers must follow the new bounds; otherwise a removed edge invalidates the scene.
 const inside=(x:number,y:number)=>x>=0&&y>=0&&x<width&&y<height;
 const crop=<T>(layer:Record<string,T>|undefined)=>layer===undefined?undefined:Object.fromEntries(Object.entries(layer).filter(([key])=>{const [x,y]=key.split(',').map(Number);return inside(x,y);}));
 const next:WorldScene={...scene,width,height,tiles:crop(scene.tiles),terrains:crop(scene.terrains),elevations:crop(scene.elevations),stairs:crop(scene.stairs),blocked:scene.blocked?.filter(cell=>inside(cell.x,cell.y))};
 const wallInside=(wall:NonNullable<WorldScene['walls']>[number])=>wall.x>=0&&wall.y>=0&&wall.x<=width-(wall.axis==='x'?1:0)&&wall.y<=height-(wall.axis==='y'?1:0);
 if(scene.walls===undefined)return next;
 if(scene.automaticWalls===undefined)return {...next,walls:scene.walls.filter(wallInside)};
 const generated=new Set(automaticWallKeys(scene)),custom=scene.walls.filter(w=>!generated.has(wallKey(w))&&wallInside(w)),occupied=new Set(custom.map(wallKey));
 const oldBoundary=new Set(defaultWalls(scene).map(wallKey));
 const automatic=resolveEnvironment(next).outdoor?[]:defaultWalls(next).filter(w=>!occupied.has(wallKey(w))&&(generated.has(wallKey(w))||!oldBoundary.has(wallKey(w))));
 return {...next,walls:[...custom,...automatic],automaticWalls:automatic.map(wallKey)};
}
