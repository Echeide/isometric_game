import type { Cell, WorldScene } from './types';
import { footprint, walkable, findPath, interactionCells, cellKey } from './navigation';
export const visualCatalog = [
 {id:'pixel.plant',kind:'plant',label:'Planta · Pixel'}, {id:'pixel.sofa',kind:'sofa',label:'Sofá · Pixel'},
 {id:'pixel.table',kind:'table',label:'Mesa · Pixel'}, {id:'pixel.board',kind:'board',label:'Panel · Pixel'},
 {id:'pixel.goal',kind:'goal',label:'Bandera · Pixel'},
 {id:'pixel.desk',kind:'desk',label:'Escritorio · Pixel'}, {id:'pixel.tree',kind:'tree',label:'Roble · Pixel'},
 {id:'pixel.person',kind:'person',label:'Personaje · Pixel'},
 {id:'builtin.desk',kind:'desk',label:'Escritorio'}, {id:'builtin.board',kind:'board',label:'Panel'},
 {id:'builtin.person',kind:'person',label:'Personaje'}, {id:'builtin.plant',kind:'plant',label:'Planta'},
 {id:'builtin.sofa',kind:'sofa',label:'Sofá'}, {id:'builtin.table',kind:'table',label:'Mesa'},
 {id:'builtin.goal',kind:'goal',label:'Bandera'}, {id:'builtin.tree',kind:'tree',label:'Árbol'}
] as const;
/** Validate external data before allocating a renderer or changing the active map. */
export function parseScene(value: unknown): WorldScene {
 const fail=(message:string):never=>{throw new Error(message);};
 if(!value||typeof value!=='object'||Array.isArray(value))return fail('El mapa debe ser un objeto JSON.');
 const v=value as Record<string,unknown>;
 if(v.schemaVersion!==1)return fail('Versión de mapa no compatible. Se requiere schemaVersion: 1.');
 if(typeof v.id!=='string'||!v.id.trim()||typeof v.name!=='string'||!v.name.trim())return fail('El mapa necesita id y nombre.');
 if(v.theme!=='office'&&v.theme!=='outdoors')return fail('El tema debe ser office u outdoors.');
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
   if(key!==`${x},${y}`||!point({x,y})||!['office','grass','path'].includes(tile as string))return fail(`Baldosa no válida: ${key}.`);
  }
 }
 const ids=new Set<string>();
 for(const raw of v.entities){
  if(!raw||typeof raw!=='object')return fail('Objeto no válido.');
  const e=raw as Record<string,unknown>;
  if(typeof e.id!=='string'||!e.id.trim()||ids.has(e.id))return fail('Los objetos necesitan identificadores únicos.');ids.add(e.id);
  if(typeof e.label!=='string'||!e.label.trim())return fail(`Falta el nombre de ${e.id}.`);
  if(!visualCatalog.some(a=>a.kind===e.kind))return fail(`Tipo de objeto desconocido: ${e.id}.`);
  if(e.visualId!==undefined&&!visualCatalog.some(a=>a.id===e.visualId&&a.kind===e.kind))return fail(`Recurso visual no compatible: ${e.id}.`);
  if(!point(e.position))return fail(`Posición no válida: ${e.id}.`);
  if(e.size!==undefined&&(!e.size||typeof e.size!=='object'||!dimension((e.size as Cell).x)||!dimension((e.size as Cell).y)))return fail(`Tamaño no válido: ${e.id}.`);
  for(const flag of ['solid','completed','flipX'])if(e[flag]!==undefined&&typeof e[flag]!=='boolean')return fail(`Valor ${flag} no válido: ${e.id}.`);
  if(e.color!==undefined&&(typeof e.color!=='number'||!Number.isInteger(e.color)||e.color<0||e.color>0xffffff))return fail(`Color no válido: ${e.id}.`);
  if(e.interaction!==undefined){const a=e.interaction as Record<string,unknown>;if(!a||typeof a!=='object'||!['label','action','resourceId'].every(k=>typeof a[k]==='string'&&(a[k] as string).trim()))return fail(`Interacción no válida: ${e.id}.`);}
  if(e.interactionPoints!==undefined&&(!Array.isArray(e.interactionPoints)||!e.interactionPoints.length||!e.interactionPoints.every(point)))return fail(`Puntos de interacción no válidos: ${e.id}.`);
  if(e.seat!==undefined){const seat=e.seat as Record<string,unknown>;if(!seat||typeof seat!=='object'||!point(seat.cell)||!['ne','se','sw','nw'].includes(seat.facing as string))return fail(`Asiento no válido: ${e.id}.`);}
 }
 const scene=JSON.parse(JSON.stringify(v)) as WorldScene;
 const occupied=new Set((scene.blocked??[]).map(cellKey));
 for(const e of scene.entities){for(const p of footprint(e)){if(!point(p))return fail(`El objeto ${e.label} sale del mapa.`);if(e.solid!==false){if(occupied.has(cellKey(p)))return fail(`El objeto ${e.label} se solapa con un obstáculo.`);occupied.add(cellKey(p));}}}
 if(!walkable(scene,scene.spawn))return fail('La entrada está bloqueada.');
 for(const e of scene.entities){
  if(e.interaction&&findPath(scene,scene.spawn,interactionCells(scene,e))===null)return fail(`No se puede llegar a ${e.label}.`);
  if(e.seat&&findPath(scene,scene.spawn,[e.seat.cell])===null)return fail(`No se puede llegar al asiento de ${e.label}.`);
 }
 return scene;
}
