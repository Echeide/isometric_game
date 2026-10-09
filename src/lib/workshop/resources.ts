import {characterImage,actorPoses,visualCatalog,resolveVisualCatalog,isCustomTile,type CharacterPack,type ObjectSprite,type PixelArtPack,type VisualAsset,type TileKind,type BuiltinTileKind,type VisualCatalogOverrides} from '@isometrico/world';
export type ResourceKind='object'|'npc'|'player'|'tile';
export type ResourceEntry={id:string;kind:ResourceKind;name:string;image:string;custom:boolean;frame?:[number,number,number,number]};
/** Family names are searchable too; every visible tile occurs in exactly one section. */
export function groupWorkshopTiles(entries:ResourceEntry[],families:import('@isometrico/world').TileFamilies,query=''){
 const tiles=entries.filter(e=>e.kind==='tile'),byId=new Map(tiles.map(e=>[e.id,e])),grouped=new Set<string>(),search=query.trim().toLocaleLowerCase();
 const matches=(name:string)=>name.toLocaleLowerCase().includes(search);
 const groups=Object.entries(families).map(([id,family])=>{
  const members=Object.keys(family.tiles).flatMap(tile=>{const entry=byId.get(tile);if(!entry||grouped.has(tile))return [];grouped.add(tile);return [entry];});
  return {id,name:family.name,entries:matches(family.name)?members:members.filter(e=>matches(e.name))};
 }).filter(group=>group.entries.length);
 return {groups,ungrouped:tiles.filter(e=>!grouped.has(e.id)&&matches(e.name))};
}
export function groupWorkshopObjects(entries:ResourceEntry[],families:import('@isometrico/world').ObjectFamilies,query=''){
 const objects=entries.filter(e=>e.kind==='object'),byId=new Map(objects.map(e=>[e.id,e])),grouped=new Set<string>(),search=query.trim().toLocaleLowerCase();
 const matches=(text:string)=>text.toLocaleLowerCase().includes(search);
 const groups=Object.entries(families).map(([id,f])=>({id,name:f.name,entries:Object.entries(f.aspects).flatMap(([visual,label])=>{
  const e=byId.get(visual);if(!e||grouped.has(visual))return [];grouped.add(visual);
  return matches(f.name)||matches(label)||matches(e.name)?[{...e,name:label+' · '+e.name}]:[];
 })})).filter(g=>g.entries.length);
 return {groups,ungrouped:objects.filter(e=>!grouped.has(e.id)&&matches(e.name))};
}
export const actionLabels={idle:'Reposo',walk:'Caminar',sit:'Sentarse',work:'Trabajar',talk:'Conversar',celebrate:'Celebrar'};
export const tileLabels:Record<BuiltinTileKind,string>={office:'Oficina',grass:'Césped',path:'Camino',parquet:'Parquet',asphalt:'Asfalto',sidewalk:'Acera',cobble:'Empedrado',sand:'Arena',dirt:'Tierra'};
/** One resolved palette for the workshop and map editor, including cropped custom tiles. */
export function workshopTiles(pack:PixelArtPack){
 return (Object.keys(pack.tiles) as TileKind[]).map(id=>({id,label:pack.tileNames?.[id]??(isCustomTile(id)?id:tileLabels[id]),image:pack.tiles[id],frame:pack.tileFrames?.[id]}));
}
export function standaloneCharacter(character:CharacterPack,variant='default'):CharacterPack{
 const c:CharacterPack=JSON.parse(JSON.stringify(character));delete c.variants;
 for(const pose of actorPoses){c.animations[pose]={...c.animations[pose],image:characterImage(character,pose,variant)};delete c.animations[pose].variants;}
 c.image=c.animations.idle.image!;return c;
}
function characterThumbnail(c:CharacterPack):[number,number,number,number]{return [0,(c.animations.idle.row+1)*c.frameHeight,c.frameWidth,c.frameHeight];}
export function workshopNpc(pack:PixelArtPack,id:string):ObjectSprite{
 if(pack.objects[id]){
  const stored=pack.objects[id],asset=visualCatalog.find(a=>a.id===id&&a.kind==='person');
  if(!asset)return stored;
  const c=pack.character,variant=asset.color?.toString(16)??'default',animations={...stored.animations};let upgraded=false;
  // Recognize only original builtin sheets; never guess directions in custom PNGs.
  for(const pose of ['idle','talk'] as const){const clip=animations[pose],original=c.animations[pose];if(clip&&!clip.directions&&clip.image===characterImage(c,pose,variant)&&clip.frameWidth===c.frameWidth&&clip.frameHeight===c.frameHeight&&clip.row===original.row+1&&clip.frames===original.frames){animations[pose]={...clip,row:original.row,directions:[...c.directions]};upgraded=true;}}
  return upgraded?{...stored,animations}:stored;
 }
 const asset=visualCatalog.find(a=>a.id===id&&a.kind==='person');
 if(!asset)throw new Error('No se encuentra el PNJ.');
 const c=pack.character,variant=asset.color?.toString(16)??'default',scale=c.scale??1;
 const clip=(pose:'idle'|'talk')=>({image:characterImage(c,pose,variant),frameWidth:c.frameWidth,frameHeight:c.frameHeight,row:c.animations[pose].row,frames:c.animations[pose].frames,fps:c.animations[pose].fps,directions:[...c.directions]});
 return {image:characterImage(c,'idle',variant),width:c.frameWidth*scale,height:c.frameHeight*scale,origin:[c.anchor[0]*scale,c.anchor[1]*scale-16],frame:characterThumbnail(c),animations:{idle:clip('idle'),talk:clip('talk')}};
}
export function catalogAssetName(asset:VisualAsset,overrides:VisualCatalogOverrides={}){return asset.id.startsWith('custom.')||overrides[asset.id]?.label!==undefined?asset.label:asset.label.replace(' · Pixel','');}
export function workshopEntries(pack:PixelArtPack,catalog:VisualAsset[]=[],overrides:VisualCatalogOverrides={}):ResourceEntry[]{
 const assets=resolveVisualCatalog(catalog,overrides);
 return [
  ...Object.entries(pack.objects).filter(([id])=>assets.some(a=>a.id===id)).map(([id,o]):ResourceEntry=>{const asset=assets.find(a=>a.id===id)!;return {id,kind:asset.kind==='person'?'npc':'object',name:catalogAssetName(asset,overrides),image:o.image,frame:o.frame,custom:id.startsWith('custom.')};}),
  ...assets.filter(a=>a.kind==='person'&&!a.id.startsWith('custom.')&&!pack.objects[a.id]).map((a):ResourceEntry=>{const item=workshopNpc(pack,a.id);return {id:a.id,kind:'npc',name:catalogAssetName(a,overrides),image:item.image,frame:item.frame,custom:false};}),
  {id:'default',kind:'player',name:'Explorador original',image:characterImage(pack.character,'idle','728da5'),custom:false,frame:characterThumbnail(pack.character)},
  ...Object.entries(pack.players??{}).map(([id,p]):ResourceEntry=>({id,kind:'player',name:p.name,image:characterImage(p.character,'idle'),frame:characterThumbnail(p.character),custom:true})),
  ...workshopTiles(pack).map(({id,label,image,frame}):ResourceEntry=>({id,kind:'tile',name:label,image,frame,custom:isCustomTile(id)||image.startsWith('asset:')}))
 ];
}
export function supportOrigin(item:Pick<ObjectSprite,'width'|'height'|'rotation'>,size:{x:number;y:number}):[number,number]{const cx=(size.x-size.y)*16,cy=(size.x+size.y)*8,a=(item.rotation??0)*Math.PI/180;return [item.width/2-cx*Math.cos(a)-cy*Math.sin(a),item.height+cx*Math.sin(a)-cy*Math.cos(a)];}
export function resourceUsages(maps:import('@isometrico/world').WorldScene[],entry:ResourceEntry,story?:import('../story/types').StoryDefinition){
 if(entry.kind==='tile')return maps.filter(m=>Object.values(m.tiles??{}).includes(entry.id as TileKind)||({office:'office',castle:'cobble',outdoors:'grass',rock:'cobble',beach:'sand'}[m.theme]===entry.id)||(m.theme==='outdoors'&&entry.id==='path')).map(m=>m.name);
 return maps.filter(m=>m.entities.some(e=>e.visualId===entry.id)||story?.entities.some(b=>b.mapId===m.id&&b.states.some(s=>s.visualId===entry.id))).map(m=>m.name);
}
