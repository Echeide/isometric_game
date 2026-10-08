import type {TileKind} from './types';

/** Workshop grouping. Maps continue to store individual tile IDs. */
export interface TileFamily {name:string;tiles:Partial<Record<TileKind,number>>}
export type TileFamilies=Record<string,TileFamily>;
export function validateTileFamilies(value:unknown,tiles:Record<TileKind,string>):asserts value is TileFamilies|undefined {
 if(value===undefined)return;
 const fail=():never=>{throw Error('Familias de suelos no válidas. Revisa nombres, miembros y pesos.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>128)fail();
 const used=new Set<string>();
 for(const [id,family]of Object.entries(value as TileFamilies)){
  if(!/^family\.[a-zA-Z0-9_-]{1,80}$/.test(id)||!family||typeof family.name!=='string'||!family.name.trim()||family.name.length>120||!family.tiles||typeof family.tiles!=='object'||Array.isArray(family.tiles))fail();
  const members=Object.entries(family.tiles);if(!members.length||members.length>137||!members.some(([,w])=>w!>0))fail();
  for(const [tile,weight]of members){
   if(!Object.hasOwn(tiles,tile)||used.has(tile)||!Number.isInteger(weight)||weight!<0||weight!>100)fail();
   used.add(tile);
  }
 }
}
export function tileFamilyId(families:TileFamilies,tile:string){return Object.keys(families).find(id=>Object.hasOwn(families[id].tiles,tile));}
export function detachTile(families:TileFamilies,tile:string):TileFamilies {
 const next:TileFamilies=JSON.parse(JSON.stringify(families));
 for(const [id,family]of Object.entries(next)){
  delete family.tiles[tile as TileKind];const members=Object.keys(family.tiles) as TileKind[];
  if(!members.length)delete next[id];
  else if(!Object.values(family.tiles).some(w=>w!>0))family.tiles[members[0]]=100;
 }
 return next;
}
/** Stable coordinate sampling prevents the preview from changing on every draw. */
export function sampleTileVariant<T extends {weight:number}>(members:readonly T[],x:number,y:number):T|undefined {
 const active=members.filter(m=>Number.isFinite(m.weight)&&m.weight>0),total=active.reduce((sum,m)=>sum+m.weight,0);
 if(!total)return;
 let hash=Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b);
 hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);hash^=hash>>>16;
 let choice=(hash>>>0)/4294967296*total;
 for(const member of active){choice-=member.weight;if(choice<0)return member;}
 return active[active.length-1];
}
