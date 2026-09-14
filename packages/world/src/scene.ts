import {environments} from './environments';
import {levelAt,stairAt} from './elevation';
import {isTileKind} from './types';
import {hasTile,wallCells,wallKey,sceneWalls} from './walls';
import type { Cell, WorldScene } from './types';
import { footprint, walkable, createNavigator, interactionCells, cellKey } from './navigation';
export type ObjectCategory='office'|'nature'|'urban'|'people';
export interface VisualAsset {id:string;kind:import('./types').EntityKind;label:string;category:ObjectCategory;size:Cell;color?:number}
export type VisualCatalogOverrides=Record<string,Partial<Pick<VisualAsset,'label'|'category'>>>;
export const isCustomVisual=(id:unknown):id is string=>typeof id==='string'&&/^custom\.[a-zA-Z0-9_-]{1,80}$/.test(id);
export function validateCustomCatalog(value:unknown):VisualAsset[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>128)throw new Error('El catálogo admite hasta 128 recursos propios.');
 const ids=new Set<string>();
 for(const a of value){
  if(!a||!isCustomVisual(a.id)||ids.has(a.id)||!['object','person'].includes(a.kind)||typeof a.label!=='string'||!a.label.trim()||a.label.length>120||!['office','nature','urban','people'].includes(a.category)||!a.size||![a.size.x,a.size.y].every(n=>Number.isInteger(n)&&n>=1&&n<=16))throw new Error('Entrada de catálogo no válida.');
  ids.add(a.id);
 }
 return JSON.parse(JSON.stringify(value));
}
export const visualCatalog:readonly VisualAsset[] = [
 {id:'pixel.plant',kind:'plant',label:'Planta · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.sofa',kind:'sofa',label:'Sofá · Pixel',category:'office',size:{x:1,y:3}},
 {id:'pixel.table',kind:'table',label:'Mesa · Pixel',category:'office',size:{x:2,y:1}},
 {id:'pixel.board',kind:'board',label:'Panel · Pixel',category:'office',size:{x:3,y:1}},
 {id:'pixel.goal',kind:'goal',label:'Bandera · Pixel',category:'urban',size:{x:1,y:1}},
 {id:'pixel.key',kind:'goal',label:'Llave',category:'urban',size:{x:1,y:1}},
 {id:'pixel.desk',kind:'desk',label:'Escritorio · Pixel',category:'office',size:{x:2,y:1}},
 {id:'pixel.tree',kind:'tree',label:'Árbol · Roble · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.person',kind:'person',label:'Explorador · Pixel',category:'people',size:{x:1,y:1},color:0x728da5},
 {id:'pixel.cabinet',kind:'cabinet',label:'Archivador · Pixel',category:'office',size:{x:1,y:1}},
 {id:'pixel.bookshelf',kind:'bookshelf',label:'Estantería · Pixel',category:'office',size:{x:1,y:1}},
 {id:'pixel.printer',kind:'printer',label:'Impresora · Pixel',category:'office',size:{x:1,y:1}},
 {id:'pixel.chair',kind:'chair',label:'Silla · Pixel',category:'office',size:{x:1,y:1}},
 {id:'pixel.bench',kind:'bench',label:'Banco · Pixel',category:'urban',size:{x:2,y:1}},
 {id:'pixel.bin',kind:'bin',label:'Papelera · Pixel',category:'urban',size:{x:1,y:1}},
 {id:'pixel.bollard',kind:'bollard',label:'Bolardo · Pixel',category:'urban',size:{x:1,y:1}},
 {id:'pixel.lamp',kind:'lamp',label:'Farola · Pixel',category:'urban',size:{x:1,y:1}},
 {id:'pixel.rock',kind:'rock',label:'Roca · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.bush',kind:'bush',label:'Arbusto · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.flowers',kind:'flowers',label:'Flores · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.pine',kind:'pine',label:'Pino · Pixel',category:'nature',size:{x:1,y:1}},
 {id:'pixel.person-lucia',kind:'person',label:'Lucía · Pixel',category:'people',size:{x:1,y:1},color:0xce936a},
 {id:'pixel.person-marcos',kind:'person',label:'Marcos · Pixel',category:'people',size:{x:1,y:1},color:0x819582},
];
/** Base resources retain their identity and geometry; the host can customize catalogue metadata. */
export function validateCatalogOverrides(value:unknown):VisualCatalogOverrides{
 if(value===undefined)return {};
 const fail=():never=>{throw new Error('Personalización del catálogo base no válida.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>visualCatalog.length)return fail();
 for(const [id,entry]of Object.entries(value)){
  if(!visualCatalog.some(a=>a.id===id)||!entry||typeof entry!=='object'||Array.isArray(entry))return fail();
  if(Object.keys(entry).some(k=>k!=='label'&&k!=='category'))return fail();
  if('label' in entry&&(typeof entry.label!=='string'||!entry.label.trim()||entry.label.length>120))return fail();
  if('category' in entry&&!['office','nature','urban','people'].includes(entry.category))return fail();
 }
 return JSON.parse(JSON.stringify(value));
}
export function resolveVisualCatalog(custom:readonly VisualAsset[]=[],overrides:VisualCatalogOverrides={}):VisualAsset[]{
 return [...visualCatalog.map(a=>({...a,label:overrides[a.id]?.label??a.label,category:overrides[a.id]?.category??a.category,size:{...a.size}})),...custom.map(a=>({...a,size:{...a.size}}))];
}
/** Validate external data before allocating a renderer or changing the active map. */
export function parseScene(value: unknown, options:{allowUnreachable?:boolean}={}): WorldScene {
 const fail=(message:string):never=>{throw new Error(message);};
 if(!value||typeof value!=='object'||Array.isArray(value))return fail('El mapa debe ser un objeto JSON.');
 const v=value as Record<string,unknown>;
 if(v.schemaVersion!==1)return fail('Versión de mapa no compatible. Se requiere schemaVersion: 1.');
 if(typeof v.id!=='string'||!v.id.trim()||typeof v.name!=='string'||!v.name.trim())return fail('El mapa necesita id y nombre.');
 if(typeof v.theme!=='string'||!Object.hasOwn(environments,v.theme))return fail('Entorno no válido.');
 const dimension=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=64;
 if(!dimension(v.width)||!dimension(v.height))return fail('Las dimensiones deben estar entre 1 y 64 casillas.');
 const point=(p:unknown):p is Cell=>!!p&&typeof p==='object'&&Number.isInteger((p as Cell).x)&&Number.isInteger((p as Cell).y)&&(p as Cell).x>=0&&(p as Cell).y>=0&&(p as Cell).x<(v.width as number)&&(p as Cell).y<(v.height as number);
 if(!point(v.spawn))return fail('La entrada debe estar dentro del mapa.');
 if(!Array.isArray(v.entities)||v.entities.length>512)return fail('Se requiere una lista de hasta 512 objetos.');
 if(v.blocked!==undefined&&(!Array.isArray(v.blocked)||!v.blocked.every(point)))return fail('Hay obstáculos fuera del mapa.');
 if(v.tiles!==undefined){
  if(!v.tiles||typeof v.tiles!=='object'||Array.isArray(v.tiles))return fail('Suelo no válido.');
  for(const [key,tile] of Object.entries(v.tiles)){
   const [x,y]=key.split(',').map(Number);
   if(key!==`${x},${y}`||!point({x,y})||(tile!=='void'&&!isTileKind(tile)))return fail(`Baldosa no válida: ${key}.`);
  }
 }
 for(const field of ['elevations','stairs'] as const){
  const data=v[field];if(data===undefined)continue;
  if(!data||typeof data!=='object'||Array.isArray(data))return fail('Alturas o escaleras no válidas.');
  for(const [key,value] of Object.entries(data)){
   const [x,y]=key.split(',').map(Number);
   if(key!==`${x},${y}`||!point({x,y})||(v.tiles as Record<string,string>|undefined)?.[key]==='void')return fail('La altura o escalera necesita una baldosa.');
   if(field==='elevations'?typeof value!=='number'||!Number.isInteger(value)||value< -2||value>2:!['ne','se','sw','nw'].includes(value))return fail('Usa alturas de −2 a 2 y una orientación válida.');
  }
 }
 const ids=new Set<string>();
 for(const raw of v.entities){
  if(!raw||typeof raw!=='object')return fail('Objeto no válido.');
  const e=raw as Record<string,unknown>;
  if(typeof e.id!=='string'||!e.id.trim()||ids.has(e.id))return fail('Los objetos necesitan identificadores únicos.');ids.add(e.id);
  if(typeof e.label!=='string'||!e.label.trim())return fail(`Falta el nombre de ${e.id}.`);
  if(e.kind!=='object'&&!visualCatalog.some(a=>a.kind===e.kind))return fail(`Tipo de objeto desconocido: ${e.id}.`);
  const custom=isCustomVisual(e.visualId)&&['object','person'].includes(e.kind as string);
  if(e.kind==='object'&&!custom)return fail('Un objeto propio necesita su recurso gráfico.');
  if(!custom&&e.visualId!==undefined&&e.visualId!==`builtin.${e.kind}`&&!visualCatalog.some(a=>a.id===e.visualId&&a.kind===e.kind))return fail(`Recurso visual no compatible: ${e.id}.`);
  if(!point(e.position))return fail(`Posición no válida: ${e.id}.`);
  if(e.size!==undefined&&(!e.size||typeof e.size!=='object'||!dimension((e.size as Cell).x)||!dimension((e.size as Cell).y)))return fail(`Tamaño no válido: ${e.id}.`);
  for(const flag of ['solid','completed','flipX'])if(e[flag]!==undefined&&typeof e[flag]!=='boolean')return fail(`Valor ${flag} no válido: ${e.id}.`);
  if(e.description!==undefined&&typeof e.description!=='string')return fail('Descripción no válida.');
  if(e.color!==undefined&&(typeof e.color!=='number'||!Number.isInteger(e.color)||e.color<0||e.color>0xffffff))return fail(`Color no válido: ${e.id}.`);
  if(e.pickup!==undefined){const p=e.pickup as {itemId:string;quantity:number};if(!p||typeof p.itemId!=='string'||!p.itemId.trim()||!Number.isSafeInteger(p.quantity)||p.quantity<1)return fail('Recogible no válido.');}
  if(e.interaction!==undefined){const a=e.interaction as Record<string,unknown>;if(!a||typeof a!=='object'||!['label','action','resourceId'].every(k=>typeof a[k]==='string'&&(a[k] as string).trim()))return fail(`Interacción no válida: ${e.id}.`);}
  if(e.interactionPoints!==undefined&&(!Array.isArray(e.interactionPoints)||!e.interactionPoints.length||!e.interactionPoints.every(point)))return fail(`Puntos de interacción no válidos: ${e.id}.`);
  if(e.seat!==undefined){const seat=e.seat as Record<string,unknown>;if(!seat||typeof seat!=='object'||!point(seat.cell)||!['ne','se','sw','nw'].includes(seat.facing as string))return fail(`Asiento no válido: ${e.id}.`);}
 }
 const scene=JSON.parse(JSON.stringify(v)) as WorldScene;
 for(const e of scene.entities)if(e.visualId===undefined||e.visualId===`builtin.${e.kind}`)e.visualId=`pixel.${e.kind}`;
 if(scene.walls!==undefined){
  if(!Array.isArray(scene.walls)||scene.walls.length>8320)return fail('Paredes no válidas.');
  const seen=new Set<string>();
  for(const w of scene.walls){
   if(!w||!['x','y'].includes(w.axis)||!['wall','door'].includes(w.kind)||!Number.isInteger(w.x)||!Number.isInteger(w.y)||w.x<0||w.y<0||w.x>scene.width-(w.axis==='x'?1:0)||w.y>scene.height-(w.axis==='y'?1:0))return fail('Pared fuera del mapa.');
   if(w.material!==undefined&&!['white','glass','stone','cobble'].includes(w.material))return fail('Acabado de pared no válido.');
   if(seen.has(wallKey(w)))return fail('Pared duplicada.');seen.add(wallKey(w));
   if(!wallCells(w).some(p=>hasTile(scene,p)))return fail('La pared necesita una baldosa de apoyo.');
   if(w.exitId!==undefined&&(w.kind!=='door'||!scene.entities.some(e=>e.id===w.exitId&&e.interaction?.action==='adventure.exit')))return fail('Destino de puerta no válido.');
   if(w.exitId){const e=scene.entities.find(e=>e.id===w.exitId)!;if(!wallCells(w).some(p=>p.x===e.position.x&&p.y===e.position.y))return fail('La salida debe permanecer junto a su puerta.');}
  }
 }
 for(const e of scene.entities)if(e.interaction?.action==='adventure.exit')e.solid=false;
 for(const key of Object.keys(scene.stairs??{}))if((scene.elevations?.[key]??0)>=2)return fail('La escalera debe comenzar por debajo del nivel 2.');
 const occupied=new Set((scene.blocked??[]).map(cellKey));
 for(const e of scene.entities){for(const p of footprint(e)){if(!hasTile(scene,p))return fail(`Mueve ${e.label} antes de eliminar su baldosa.`);if(!point(p))return fail(`El objeto ${e.label} sale del mapa.`);if(e.solid!==false){if(occupied.has(cellKey(p)))return fail(`El objeto ${e.label} se solapa con un obstáculo.`);occupied.add(cellKey(p));}}}
 for(const e of scene.entities){
  for(const p of [...(e.interactionPoints??[]),...(e.seat?[e.seat.cell]:[])])if(!hasTile(scene,p))return fail(`Mueve el acceso de ${e.label} antes de eliminar su baldosa.`);
  if(e.seat&&(levelAt(scene,e.seat.cell)!==levelAt(scene,e.position)||stairAt(scene,e.seat.cell)))return fail(`El asiento de ${e.label} necesita suelo plano a la altura del objeto.`);
  const cells=footprint(e);
  if(cells.some(p=>levelAt(scene,p)!==levelAt(scene,e.position)||stairAt(scene,p)))return fail(`El objeto ${e.label} necesita suelo plano a una misma altura.`);
  if(sceneWalls(scene).some(w=>wallCells(w).every(p=>cells.some(c=>c.x===p.x&&c.y===p.y))))return fail(`La pared atraviesa ${e.label}.`);
 }
 if(!walkable(scene,scene.spawn))return fail('La entrada está bloqueada.');
 const reachable=options.allowUnreachable?null:createNavigator(scene).reachableFrom(scene.spawn);
 for(const e of scene.entities){
  if(reachable&&e.interaction&&!interactionCells(scene,e).some(p=>reachable.has(cellKey(p))))return fail(`No se puede llegar a ${e.label}.`);
  if(reachable&&e.seat&&!reachable.has(cellKey(e.seat.cell)))return fail(`No se puede llegar al asiento de ${e.label}.`);
 }
 return scene;
}
