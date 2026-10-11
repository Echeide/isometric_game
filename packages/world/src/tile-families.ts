import type {TileKind} from './types';

/** A family groups interior variants and full-tile border pieces. */
export interface TileFamily {name:string;tiles:Partial<Record<TileKind,number>>;borders?:Partial<Record<string,TileKind>>;borderAgainst?:TileKind}
export const terrainSides=[{bit:1,dx:0,dy:-1,label:'NE ↗'},{bit:2,dx:1,dy:0,label:'SE ↘'},{bit:4,dx:0,dy:1,label:'SW ↙'},{bit:8,dx:-1,dy:0,label:'NW ↖'}] as const;
export const terrainMasks=[1,2,4,8,3,6,12,9,5,10,7,11,13,14,15];
export function terrainMaskLabel(mask:number){return terrainSides.filter(s=>mask&s.bit).map(s=>s.label).join(' + ');}
export function interiorMembers(family:TileFamily){const borders=new Set(Object.values(family.borders??{}));return Object.entries(family.tiles).sort(([a,aw],[b,bw])=>(bw??0)-(aw??0)||(a<b?-1:a>b?1:0)).filter(([id,weight])=>weight!>0&&!borders.has(id as TileKind)).map(([id,weight])=>({id:id as TileKind,weight:weight!}));}

export type TileFamilies=Record<string,TileFamily>;
export function validateTileFamilies(value:unknown,tiles:Record<TileKind,string>):asserts value is TileFamilies|undefined {
 if(value===undefined)return;
 const fail=():never=>{throw Error('Familias de suelos no válidas. Revisa nombres, miembros y pesos.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>128)fail();
 const used=new Set<string>();
 for(const [id,family]of Object.entries(value as TileFamilies)){
  if(!/^family\.[a-zA-Z0-9_-]{1,80}$/.test(id)||!family||typeof family.name!=='string'||!family.name.trim()||family.name.length>120||!family.tiles||typeof family.tiles!=='object'||Array.isArray(family.tiles))fail();
  if(family.borders!==undefined){if(!family.borders||typeof family.borders!=='object'||Array.isArray(family.borders))fail();for(const [mask,tile]of Object.entries(family.borders)){if(!/^(?:[1-9]|1[0-5])$/.test(mask)||typeof tile!=='string'||!Object.hasOwn(family.tiles,tile)||!Object.hasOwn(tiles,tile)||family.tiles[tile]!==0)fail();}}
  if(family.borderAgainst!==undefined&&!Object.hasOwn(tiles,family.borderAgainst))fail();
  if(!interiorMembers(family).length)fail();
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
 for(const [id,family]of Object.entries(next)){if(family.borderAgainst===tile)delete family.borderAgainst;
  delete family.tiles[tile as TileKind];for(const [mask,id]of Object.entries(family.borders??{}))if(id===tile)delete family.borders![mask];if(family.borderAgainst===tile)delete family.borderAgainst;const members=Object.keys(family.tiles) as TileKind[];
  if(!members.length)delete next[id];
  else if(!interiorMembers(family).length){const first=members[0];for(const [mask,id]of Object.entries(family.borders??{}))if(id===first)delete family.borders![mask];family.tiles[first]=100;}
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
