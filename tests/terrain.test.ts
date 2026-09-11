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
