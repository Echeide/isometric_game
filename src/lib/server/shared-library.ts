import {mkdir,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {unpackResource,resourcePreview,type SharedSummary} from '../workshop/shared-resource';
export const LIBRARY_MAX=200_000_000;
const validId=(id:string)=>/^[a-f0-9]{64}$/.test(id);
export class SharedLibrary {
 private queue:Promise<unknown>=Promise.resolve();
 constructor(readonly directory:string){}
 async list():Promise<SharedSummary[]>{await mkdir(this.directory,{recursive:true});const names=await readdir(this.directory);return (await Promise.all(names.filter(validId).map(async id=>JSON.parse(await readFile(join(this.directory,id,'summary.json'),'utf8')) as SharedSummary))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 async get(id:string){if(!validId(id))throw Error('Identificador no válido.');return new Uint8Array(await readFile(join(this.directory,id,'resource.zip')));}
 async save(input:Uint8Array){
  // Copy before queuing so callers cannot mutate the validated payload.
  const bytes=new Uint8Array(input),{resource}=unpackResource(bytes),id=createHash('sha256').update(bytes).digest('hex');
  const operation=this.queue.then(async()=>{
   const existing=await this.list(),found=existing.find(e=>e.id===id);if(found)return found;
   if(existing.length>=256)throw Error('La biblioteca admite hasta 256 recursos. Exporta una copia antes de reorganizarla.');
   const preview=resourcePreview(resource),summary:SharedSummary={id,version:1,name:resource.name,kind:resource.kind,category:resource.category,createdAt:new Date().toISOString(),image:preview.image,frame:preview.frame};
   const temp=join(this.directory,`.pending-${randomUUID()}`);await mkdir(temp);
   try{await writeFile(join(temp,'resource.zip'),bytes);await writeFile(join(temp,'summary.json'),JSON.stringify(summary));await rename(temp,join(this.directory,id));}finally{await rm(temp,{recursive:true,force:true});}
   return summary;
  });this.queue=operation.catch(()=>{});return operation;
 }
 async export(){const entries=await this.list(),files:Record<string,Uint8Array>={};let total=0;for(const e of entries){const data=await this.get(e.id);if((total+=data.length)>LIBRARY_MAX)throw Error('La biblioteca supera 200 MB: descarga los recursos por separado.');files[`resources/${e.id}.zip`]=data;}files['library.json']=new TextEncoder().encode(JSON.stringify({format:'isometric-library',version:1}));const bytes=zipSync(files,{level:0});if(bytes.length>LIBRARY_MAX)throw Error('La biblioteca supera 200 MB.');return bytes;}
 async import(bytes:Uint8Array){
  if(bytes.length>LIBRARY_MAX)throw Error('El ZIP supera 200 MB.');let total=0,count=0;
  const files=unzipSync(bytes,{filter:f=>{if(++count>257||(total+=f.originalSize)>LIBRARY_MAX||!(/^(library\.json|resources\/[a-f0-9]{64}\.zip)$/.test(f.name)))throw Error('ZIP de biblioteca no válido.');return true;}});
  const manifest=JSON.parse(new TextDecoder().decode(files['library.json']));if(manifest.format!=='isometric-library'||manifest.version!==1)throw Error('Versión de biblioteca no compatible.');
  const resources=Object.entries(files).filter(([path])=>path!=='library.json');
  for(const [path,data]of resources){unpackResource(data);if(path!==`resources/${createHash('sha256').update(data).digest('hex')}.zip`)throw Error('El recurso no coincide con su identificador.');}
  const existing=await this.list();if(new Set([...existing.map(e=>e.id),...resources.map(([p])=>p.slice(10,-4))]).size>256)throw Error('La importación supera 256 recursos.');
  for(const [,data]of resources)await this.save(data);return resources.length;
 }
}
