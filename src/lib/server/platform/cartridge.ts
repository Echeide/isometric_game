import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import type {PixelArtPack} from '@isometrico/world';
import type {Adventure} from '../../demo/adventure';
import {imageUrls,mapImages} from '../../storage/local-adventures';
import {validatePack,validateCatalogGraphics,pngSize} from '../../storage/adventure-package';
import {publicAdventure,publicGraphics} from './publication-state';
export const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
/** Bounded parallel I/O; await all workers even when a transfer fails. */
export async function transferAll<T>(items:T[],transfer:(item:T,index:number)=>Promise<void>,parallel=4){
 let next=0,failed=false;
 const results=await Promise.allSettled(Array.from({length:Math.min(parallel,items.length)},async()=>{while(!failed&&next<items.length){const index=next++;try{await transfer(items[index],index);}catch(e){failed=true;throw e;}}}));
 const failure=results.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
}
export interface CartridgeManifest {
 kind:'isometric-cartridge';version:1;releaseId:string;adventureId:string;
 images:Record<string,string>;
 files:Record<string,{bytes:number;sha256:string}>;
 externalDependencies:string[];
}
/** Never fetch arbitrary content URLs. Linked videos/web pages remain explicit dependencies. */
function dependencies(value:unknown):string[]{const result=new Set<string>();const walk=(v:unknown)=>{if(typeof v==='string'){for(const match of v.matchAll(/https?:\/\/[^\s"'<>]+/g))result.add(match[0]);if(/^\/(?!\/)[^\s<>]+$/.test(v))result.add(v);for(const match of v.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g))result.add(match[1]);}else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(value);return [...result].sort();}
export async function buildCartridge(releaseId:string,adventure:Adventure,pack:PixelArtPack,read:(url:string)=>Promise<Uint8Array>){
 const definition=publicAdventure(adventure),graphics=publicGraphics(pack),files:Record<string,Uint8Array>={},images:Record<string,string>={};let total=0;
 validateCatalogGraphics(definition,graphics);
 await transferAll(imageUrls(graphics),async(url,i)=>{
  const bytes=await read(url);pngSize(bytes);if(bytes.length>10_000_000||(total+=bytes.length)>100_000_000)throw Error('El cartucho supera los límites de exportación.');
  const path=`assets/${i}.png`;images[url]=path;files[path]=bytes;
 });
 const portable=mapImages(graphics,u=>images[u]);validatePack(portable,files);
 const encode=(v:unknown)=>strToU8(JSON.stringify(v));
 const compatible=encode({kind:'isometric-adventure-package',version:1,adventure:definition,graphics:portable});if(compatible.length>10_000_000||Object.keys(files).length>=512)throw Error('La definición del cartucho supera los límites de importación.');
 const archive=zipSync({...files,'manifest.json':compatible},{level:0});if(archive.length>100_000_000)throw Error('El cartucho completo supera 100 MB.');
 files['aventura.json']=encode(definition);files['graficos.json']=encode(portable);files['cartucho.zip']=archive;
 const manifest:CartridgeManifest={kind:'isometric-cartridge',version:1,releaseId,adventureId:definition.id,images,externalDependencies:dependencies(definition),files:Object.fromEntries(Object.entries(files).map(([key,b])=>[key,{bytes:b.length,sha256:digest(b)}]))};
 files['manifiesto.json']=encode(manifest);
 return{manifest,files,bytes:Object.values(files).reduce((n,b)=>n+b.length,0)};
}
