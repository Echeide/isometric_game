import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {paintTiles} from '../src/lib/demo/editor';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {workshopEntries,workshopTiles,resourceUsages} from '../src/lib/workshop/resources';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {isTileKind,isCustomTile} from '../packages/world/src/types';
import {parseScene} from '../packages/world/src/scene';
import {tileAt,validateSceneTiles} from '../packages/world/src/terrain';
import {exportAdventure,unpackAdventure,pngSize,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';

const tile='custom.moss';
const bytes=readFileSync('static'+graphics.tiles.grass);
const sizes=new Map(imageUrls(graphics).map(url=>[url,pngSize(readFileSync('static'+url))]));
sizes.set('asset:custom-floor',pngSize(bytes));
function customPack(){const pack=structuredClone(graphics);pack.tiles[tile]='asset:custom-floor';pack.tileNames={[tile]:'Musgo'};pack.tileFrames={[tile]:[0,0,64,32]};return pack;}

it('paints custom terrain, preserves geometry and restores the original floor',()=>{
 const painted=paintTiles(office,[{x:3,y:5},{x:4,y:5}],tile);
 expect(tileAt(parseScene(JSON.parse(JSON.stringify(painted))),{x:3,y:5})).toBe(tile);
 expect(painted.entities).toEqual(office.entities);expect(painted.blocked).toEqual(office.blocked);
 expect(tileAt(paintTiles(painted,[{x:3,y:5}],'erase'),{x:3,y:5})).toBe('office');
 expect(()=>validateSceneTiles(painted,customPack().tiles)).not.toThrow();
});
it('uses the same named palette and crop in the workshop and map editor',()=>{
 const pack=customPack();expect(()=>validateGraphics(pack,sizes)).not.toThrow();
 expect(workshopTiles(pack)).toHaveLength(10);
 expect(workshopTiles(pack).find(t=>t.id===tile)).toEqual({id:tile,label:'Musgo',image:'asset:custom-floor',frame:[0,0,64,32]});
 const entry=workshopEntries(pack).find(e=>e.id===tile)!;
 expect(entry).toMatchObject({kind:'tile',name:'Musgo',custom:true});
 expect(resourceUsages([paintTiles(office,[{x:3,y:5}],tile)],entry)).toEqual([office.name]);
 pack.tileNames![tile]='Musgo húmedo';expect(workshopTiles(pack).find(t=>t.id===tile)?.label).toBe('Musgo húmedo');
 expect(workshopTiles(graphics)).toHaveLength(9);
});
it('rejects missing custom floor references instead of rendering a blank cell',()=>{
 const adventure=createAdventure([paintTiles(office,[{x:3,y:5}],tile)]);
 expect(()=>validateCatalogGraphics(adventure,graphics)).toThrow('Falta el suelo custom.moss');
 expect(()=>validateCatalogGraphics(adventure,customPack())).not.toThrow();
});
it('validates custom IDs, names and crop bounds while retaining the original floor requirements',()=>{
 expect(isTileKind('office')).toBe(true);expect(isCustomTile(tile)).toBe(true);
 for(const id of ['water','custom.','custom../floor','custom.a:b','__proto__'])expect(()=>parseScene({...office,tiles:{'3,5':id}})).toThrow('Baldosa no válida');
 const pack=customPack();delete pack.tileNames;
 expect(()=>validateGraphics(pack,sizes)).toThrow('nombre');
 pack.tileNames={[tile]:' '};expect(()=>validateGraphics(pack,sizes)).toThrow('Nombre');
 pack.tileNames={[tile]:'Musgo'};pack.tileFrames![tile]=[32,0,64,32];
 expect(()=>validateGraphics(pack,sizes)).toThrow('recorte');
 pack.tileFrames![tile]=[0,0,64,32];delete (pack.tiles as Partial<typeof pack.tiles>).office;
 expect(()=>validateGraphics(pack,sizes)).toThrow('suelo base office');
});
it('rejects orphan crop/name metadata and excessive custom floor libraries',()=>{
 const pack=customPack();pack.tileFrames!['custom.missing']=[0,0,64,32];
 expect(()=>validateGraphics(pack,sizes)).toThrow('no existe');delete pack.tileFrames!['custom.missing'];
 pack.tileNames!['custom.missing']='Fantasma';expect(()=>validateGraphics(pack,sizes)).toThrow('Nombre');delete pack.tileNames!['custom.missing'];
 for(let i=0;i<128;i++){pack.tiles[`custom.floor-${i}`]=graphics.tiles.office;pack.tileNames![`custom.floor-${i}`]='Suelo';}
 expect(()=>validateGraphics(pack,sizes)).toThrow('128 suelos propios');
});
it('round-trips a floor-only image, labels, crop and painted cells without replacing base floors',async()=>{
 const source=customPack(),before=JSON.stringify(source),adventure=createAdventure([paintTiles(office,[{x:3,y:5}],tile)]);
 const pack=mapImages(source,url=>url.startsWith('asset:')?url:'asset:'+url);
 expect(imageUrls(pack)).toContain('asset:custom-floor');
 const zip=await exportAdventure(adventure,{pack:async()=>pack,blob:async id=>new Blob([id==='custom-floor'?bytes:readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));
 expect(parseAdventure(restored.adventure).maps[0].tiles).toEqual({'3,5':tile});
 expect(restored.pack.tileNames).toEqual(source.tileNames);expect(restored.pack.tileFrames).toEqual(source.tileFrames);
 const png=new Uint8Array(await restored.blobs[restored.pack.tiles[tile].slice(6)].arrayBuffer());
 expect(png).toEqual(new Uint8Array(bytes));expect(JSON.stringify(source)).toBe(before);
 expect(Object.keys(restored.pack.tiles)).toHaveLength(10);
});
