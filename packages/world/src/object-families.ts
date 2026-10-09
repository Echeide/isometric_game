import type {ObjectSprite} from './pixelart';
/** Editorial groups; each state still stores a concrete visual ID. */
export interface ObjectFamily {name:string;aspects:Record<string,string>}
export type ObjectFamilies=Record<string,ObjectFamily>;
export function objectFamilyId(families:ObjectFamilies,visual:string){return Object.keys(families).find(id=>Object.hasOwn(families[id].aspects,visual));}
export function detachObject(families:ObjectFamilies,visual:string):ObjectFamilies{
 const next:ObjectFamilies=JSON.parse(JSON.stringify(families));
 for(const [id,f]of Object.entries(next)){delete f.aspects[visual];if(!Object.keys(f.aspects).length)delete next[id];}
 return next;
}
export function appendObjectAspect(families:ObjectFamilies,base:string,visual:string,name:string,makeId:()=>string=()=>`family.${crypto.randomUUID()}`){
 const next=detachObject(families,visual);let id=objectFamilyId(next,base);
 if(!id){id=makeId();next[id]={name,aspects:{[base]:'Original'}};}
 next[id].aspects[visual]='Nuevo aspecto';return next;
}
export function validateObjectFamilies(value:unknown,objects:Record<string,ObjectSprite>):asserts value is ObjectFamilies|undefined{
 if(value===undefined)return;
 const fail=():never=>{throw Error('Familias de gráficos no válidas. Revisa sus nombres y aspectos.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>128)fail();
 const used=new Set<string>();
 for(const [id,f]of Object.entries(value as ObjectFamilies)){
  if(!/^family\.[a-zA-Z0-9_-]{1,80}$/.test(id)||!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>120||!f.aspects||typeof f.aspects!=='object'||Array.isArray(f.aspects))fail();
  const members=Object.entries(f.aspects);if(!members.length||members.length>256)fail();
  for(const [visual,label]of members){if(!Object.hasOwn(objects,visual)||used.has(visual)||typeof label!=='string'||!label.trim()||label.length>80)fail();used.add(visual);}
 }
}
