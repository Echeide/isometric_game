import type {OriginalSource, Sources} from './types';
export function originalBytes(sources:Sources):number {
  return Object.values(sources).flatMap(d=>Object.values(d)).reduce((n,c)=>n+(c?.original?.files.reduce((sum,f)=>sum+f.size,0)??0),0);
}
export function validateOriginal(source:OriginalSource, samples:number):void {
  if(!source || !['images','sheet','video'].includes(source.kind) || !Array.isArray(source.files) || source.files.length!== (source.kind==='images'?samples:1) || source.files.some(f=>!(f instanceof Blob)||f.size===0||f.size>100*1024*1024))throw new Error('Fuente original no válida.');
  if(source.kind==='video' && (!Number.isFinite(source.start)||source.start<0))throw new Error('Inicio del vídeo original no válido.');
  if(source.kind==='sheet' && (![source.columns,source.rows].every(n=>Number.isInteger(n)&&n>0&&n<=180)||!Number.isInteger(source.row)||source.row<0||source.row>=source.rows||source.columns!==samples))throw new Error('Cuadrícula del original no válida.');
}
