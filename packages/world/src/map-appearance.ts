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
 const next={...scene,width,height};if(scene.walls===undefined||scene.automaticWalls===undefined)return next;
 const generated=new Set(automaticWallKeys(scene)),custom=scene.walls.filter(w=>!generated.has(wallKey(w))),occupied=new Set(custom.map(wallKey));
 const oldBoundary=new Set(defaultWalls(scene).map(wallKey));
 const automatic=resolveEnvironment(next).outdoor?[]:defaultWalls(next).filter(w=>!occupied.has(wallKey(w))&&(generated.has(wallKey(w))||!oldBoundary.has(wallKey(w))));
 return {...next,walls:[...custom,...automatic],automaticWalls:automatic.map(wallKey)};
}
