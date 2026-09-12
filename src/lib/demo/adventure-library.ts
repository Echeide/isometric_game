import {insertEntity} from './editor';
import {connectMaps,createAdventure,parseAdventure,readAdventure,type Adventure} from './adventure';
import {readMaps} from './saved-maps';
import {office,outdoors} from './scenes';
export const LIBRARY_KEY='isometrico.adventures.v1';
export interface AdventureLibrary {version:1;activeId:string;adventures:Adventure[]}
export function parseLibrary(value:unknown):AdventureLibrary{
 const v=value as AdventureLibrary;
 if(!v||v.version!==1||!Array.isArray(v.adventures)||!v.adventures.length)throw new Error('Biblioteca de aventuras no válida.');
 const adventures=v.adventures.map(a=>parseAdventure(a));
 if(new Set(adventures.map(a=>a.id)).size!==adventures.length||!adventures.some(a=>a.id===v.activeId))throw new Error('Selección o identificadores de aventuras no válidos.');
 return {version:1,activeId:v.activeId,adventures};
}
export function loadAdventureLibrary(storage:Pick<Storage,'getItem'>&Partial<Pick<Storage,'setItem'>>,example=false):AdventureLibrary{
 const raw=storage.getItem(LIBRARY_KEY);if(raw!==null){const library=parseLibrary(JSON.parse(raw));const next={...library,adventures:library.adventures.map(a=>example?withInventoryExample(a):a)};if(example&&JSON.stringify(next)!==raw)storage.setItem?.(LIBRARY_KEY,JSON.stringify(next));return next;}
 let adventure=readAdventure(storage);
 if(!adventure){
  const legacy=readMaps(storage),maps=[structuredClone(legacy.maps.checkpoint??office),structuredClone(legacy.maps.routingtales??outdoors)];
  if(maps[0].id===maps[1].id)maps[1].id+='-outdoors';
  adventure=createAdventure(maps);adventure.startMap=maps[legacy.active==='routingtales'?1:0].id;
 }
 const library:AdventureLibrary={version:1,activeId:adventure.id,adventures:[example?withInventoryExample(adventure):adventure]};if(example)storage.setItem?.(LIBRARY_KEY,JSON.stringify(library));return library;
}
export function storeAdventure(storage:Pick<Storage,'getItem'|'setItem'>,value:unknown):AdventureLibrary{
 const adventure=parseAdventure(value),library=loadAdventureLibrary(storage);
 const exists=library.adventures.some(a=>a.id===adventure.id);
 const next=parseLibrary({...library,activeId:adventure.id,adventures:exists?library.adventures.map(a=>a.id===adventure.id?adventure:a):[...library.adventures,adventure]});
 storage.setItem(LIBRARY_KEY,JSON.stringify(next));return next;
}
export function selectAdventure(storage:Pick<Storage,'getItem'|'setItem'>,id:string):Adventure{
 const library=loadAdventureLibrary(storage),next=parseLibrary({...library,activeId:id});
 storage.setItem(LIBRARY_KEY,JSON.stringify(next));return next.adventures.find(a=>a.id===id)!;
}

/** One-time example upgrade, preserving edited maps. */
export function withInventoryExample(value:Adventure):Adventure{
 if(value.id!=='my-adventure'||value.inventoryExampleVersion||!value.maps.some(m=>m.id==='checkpoint')||!value.maps.some(m=>m.id==='routingtales'))return value;
 let a=structuredClone(value);
 const itemId='north-route-key',entityId='north-route-key-pickup';
 a.items=[...(a.items??[]).filter(i=>i.id!==itemId),{id:itemId,name:'Llave de la ruta del norte',description:'Abre la salida de Estudio central hacia La ruta del norte.',stackable:false}];
 if(!a.exits.some(e=>e.fromMap==='checkpoint'&&e.toMap==='routingtales'))a=connectMaps(a,'checkpoint','routingtales','north-route-exit');
 a.maps=a.maps.map(m=>{
  if(m.id!=='checkpoint')return m;
  let placed:typeof m|undefined;
  for(let y=m.height-1;y>=0&&!placed;y--)for(let x=0;x<m.width&&!placed;x++){
   if(m.entities.some(e=>x>=e.position.x&&y>=e.position.y&&x<e.position.x+(e.size?.x??1)&&y<e.position.y+(e.size?.y??1)))continue;
   try{placed=insertEntity(m,'goal',entityId,'pixel.key',{x,y});}catch{}
  }
  if(!placed)throw new Error('No hay una baldosa libre para la llave del ejemplo.');
  return {...placed,entities:placed.entities.map(e=>e.id===entityId?{...e,label:'Llave de la ruta del norte',solid:false,pickup:{itemId,quantity:1},interaction:{label:'Recoger llave',action:'inventory.collect',resourceId:itemId}}:m.entities.find(original=>original.id===e.id)??e)};
 });

 a.exits=a.exits.map(e=>e.fromMap==='checkpoint'&&e.toMap==='routingtales'?{...e,requirement:{itemId,quantity:1,consume:false}}:e);
 a.inventoryExampleVersion=1;return parseAdventure(a);
}
