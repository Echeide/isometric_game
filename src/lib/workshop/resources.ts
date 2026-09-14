import {characterImage,actorPoses,visualCatalog,resolveVisualCatalog,isCustomTile,type CharacterPack,type ObjectSprite,type PixelArtPack,type VisualAsset,type TileKind,type BuiltinTileKind,type VisualCatalogOverrides} from '@isometrico/world';
export type ResourceKind='object'|'npc'|'player'|'tile';
export type ResourceEntry={id:string;kind:ResourceKind;name:string;image:string;custom:boolean;frame?:[number,number,number,number]};
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
 if(pack.objects[id])return pack.objects[id];
 const asset=visualCatalog.find(a=>a.id===id&&a.kind==='person');
 if(!asset)throw new Error('No se encuentra el PNJ.');
 const c=pack.character,variant=asset.color?.toString(16)??'default',scale=c.scale??1;
 const clip=(pose:'idle'|'talk')=>({image:characterImage(c,pose,variant),frameWidth:c.frameWidth,frameHeight:c.frameHeight,row:c.animations[pose].row+1,frames:c.animations[pose].frames,fps:c.animations[pose].fps});
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
export function supportOrigin(item:Pick<ObjectSprite,'width'|'height'>,size:{x:number;y:number}):[number,number]{return [item.width/2-(size.x-size.y)*16,item.height-(size.x+size.y)*8];}
export function resourceUsages(maps:import('@isometrico/world').WorldScene[],entry:ResourceEntry){
 if(entry.kind==='tile')return maps.filter(m=>Object.values(m.tiles??{}).includes(entry.id as TileKind)||({office:'office',castle:'cobble',outdoors:'grass',rock:'cobble',beach:'sand'}[m.theme]===entry.id)||(m.theme==='outdoors'&&entry.id==='path')).map(m=>m.name);
 return maps.filter(m=>m.entities.some(e=>e.visualId===entry.id)).map(m=>m.name);
}
