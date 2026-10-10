import type {ObjectFamilies,TileFamilies,VisualAsset} from '@isometrico/world';
import {groupWorkshopObjects,groupWorkshopTiles,resourceSearchText,type ResourceEntry,type ResourceKind} from './resources';

export type CatalogCategory='all'|VisualAsset['category'];
export const catalogCategories=[{id:'all',label:'Todas las categorías'},{id:'office',label:'Oficina'},{id:'nature',label:'Naturaleza'},{id:'urban',label:'Urbano'},{id:'people',label:'Personajes'}] as const;
export const catalogKinds=[{id:'object',label:'Objetos'},{id:'npc',label:'PNJ'},{id:'player',label:'Jugador'},{id:'tile',label:'Suelos'}] as const;
export const catalogText=resourceSearchText;
/** Both editors filter the same entries before grouping, keeping concrete visual IDs. */
export function resourceCatalog(entries:ResourceEntry[],options:{kind:ResourceKind;query?:string;category?:CatalogCategory;objectFamilies?:ObjectFamilies;tileFamilies?:TileFamilies}){
 const {kind,query='',category='all',objectFamilies={},tileFamilies={}}=options;
 const eligible=entries.filter(entry=>entry.kind===kind&&(kind==='tile'||category==='all'||entry.category===category));
 const result=kind==='object'?groupWorkshopObjects(eligible,objectFamilies,query):kind==='tile'?groupWorkshopTiles(eligible,tileFamilies,query):{groups:[],ungrouped:eligible.filter(entry=>catalogText(entry.name).includes(catalogText(query)))};
 return {...result,count:result.ungrouped.length+result.groups.reduce((sum,group)=>sum+group.entries.length,0)};
}
