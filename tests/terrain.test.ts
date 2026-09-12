import {expect,it} from 'vitest';
import {paintTiles} from '../src/lib/demo/editor';
import {office,outdoors} from '../src/lib/demo/scenes';
import {tileAt} from '../packages/world/src/terrain';
import {parseScene} from '../packages/world/src/scene';
import {saveMap,readMaps} from '../src/lib/demo/saved-maps';
it('paints cells without changing furniture or collisions, and restores defaults',()=>{
 const painted=paintTiles(office,[{x:3,y:5},{x:4,y:5}],'grass');
 expect(tileAt(painted,{x:3,y:5})).toBe('grass');expect(painted.entities).toEqual(office.entities);expect(office.tiles).toBeUndefined();
 expect(tileAt(paintTiles(painted,[{x:3,y:5}],'erase'),{x:3,y:5})).toBe('office');
 expect(tileAt(outdoors,{x:6,y:2})).toBe('path');
});
it('rejects invalid coordinates and tile types in imported maps',()=>{
 for(const tiles of [{'13,0':'grass'},{'1.5,2':'grass'},{'01,2':'grass'},{'1,2':'water'},[]])expect(()=>parseScene({...office,tiles})).toThrow('Suelo no válido|Baldosa no válida'.split('|')[Array.isArray(tiles)?0:1]);
});
it('preserves painted terrain when saving and loading the playable map',()=>{
 let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
 saveMap(storage,paintTiles(office,[{x:7,y:8}],'path'));
 expect(readMaps(storage).maps.checkpoint?.tiles).toEqual({'7,8':'path'});
});
it('paints and restores every available finish while preserving paths',async()=>{
 const {tileKinds}=await import('../packages/world/src/types');
 const {default:catalog}=await import('../static/pixelart/catalog.json');
 for(const kind of tileKinds){
  expect(catalog.tiles[kind]).toMatch(/\.png$/);
  const painted=paintTiles(office,[{x:7,y:8}],kind);
  expect(tileAt(parseScene(JSON.parse(JSON.stringify(painted))),{x:7,y:8})).toBe(kind);
  expect(tileAt(paintTiles(painted,[{x:7,y:8}],'erase'),{x:7,y:8})).toBe('office');
 }
});
it('round-trips all environments and preserves custom terrain and walls',async()=>{
 const {environments}=await import('../packages/world/src/environments');
 const {sceneWalls}=await import('../packages/world/src/walls');
 for(const theme of Object.keys(environments) as Array<keyof typeof environments>){
  const scene=parseScene(JSON.parse(JSON.stringify({...office,theme})));
  expect(tileAt(scene,{x:2,y:2})).toBe(environments[theme].tile);
  expect(sceneWalls(scene).length>0).toBe(!environments[theme].outdoor);
  if(theme==='castle')expect(sceneWalls(scene).every(w=>w.material==='stone')).toBe(true);
  const custom=parseScene({...scene,tiles:{'2,2':'parquet'},walls:[]});
  expect(tileAt(custom,{x:2,y:2})).toBe('parquet');
  expect(sceneWalls(custom)).toEqual([]);
 }
 expect(()=>parseScene({...office,theme:'toString'})).toThrow('Entorno no válido');
});
