import {mkdir,readFile,writeFile,link,unlink} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';

export interface ObjectBackend {
 id:string;
 get(key:string):Promise<Uint8Array>;
 put(key:string,bytes:Uint8Array,contentType:string):Promise<void>;
}
export interface ObjectLocation {storage_backend?:string|null;storage_key?:string|null;hash:string}
export function objectKey(key:string){
 if(!key||key.length>1024||key.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-zA-Z0-9_.\/-]+$/.test(key))throw Error('Ruta de almacenamiento no válida.');
 return key;
}
export class LocalObjects implements ObjectBackend {
 readonly id='local';
 constructor(readonly directory:string){}
 private path(key:string){const base=resolve(this.directory),path=resolve(base,objectKey(key));if(!path.startsWith(base+sep))throw Error('Ruta no válida.');return path;}
 async get(key:string){return new Uint8Array(await readFile(this.path(key)));}
 async put(key:string,bytes:Uint8Array,_contentType:string){
  const path=this.path(key);await mkdir(dirname(path),{recursive:true});
  const temp=path+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,bytes,{flag:'wx',mode:0o600});
   try{await link(temp,path);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(!Buffer.from(await this.get(key)).equals(Buffer.from(bytes)))throw Error('No se puede sustituir un archivo inmutable.');}
  }finally{await unlink(temp).catch(()=>{});}
 }
}
export class S3Objects implements ObjectBackend {
 constructor(readonly id:string,readonly bucket:string,readonly client:S3Client){}
 async get(key:string){const valid=objectKey(key);try{const response=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:valid}),{abortSignal:AbortSignal.timeout(60_000)});if(!response.Body)throw Error();return await response.Body.transformToByteArray();}catch{throw Error('No se pudo leer el archivo del proveedor S3.');}}
 async put(key:string,bytes:Uint8Array,contentType:string){const valid=objectKey(key);try{await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:valid,Body:bytes,ContentType:contentType}),{abortSignal:AbortSignal.timeout(60_000)});}catch{throw Error('No se pudo guardar el archivo en el proveedor S3.');}}
}
export class ObjectStorage {
 private backends:Map<string,ObjectBackend>;
 constructor(readonly active:ObjectBackend,others:ObjectBackend[]=[]){this.backends=new Map();for(const backend of [active,...others]){if(!/^[a-zA-Z0-9_-]+$/.test(backend.id))throw Error('Identificador de almacenamiento no válido.');if(this.backends.has(backend.id)&&this.backends.get(backend.id)!==backend)throw Error('Proveedor duplicado.');this.backends.set(backend.id,backend);}}
 backend(id:string){const backend=this.backends.get(id);if(!backend)throw Error('Falta configurar el proveedor de un archivo guardado.');return backend;}
 async get(location:ObjectLocation){if(!location.storage_key){if(!/^[a-f0-9]{64}$/.test(location.hash))throw Error('Archivo no válido.');return this.backend('local').get('blobs/'+location.hash);}return this.backend(location.storage_backend??'local').get(location.storage_key);}
 async put(key:string,bytes:Uint8Array,type:string){await this.active.put(key,bytes,type);return{storage_backend:this.active.id,storage_key:key};}
}
type Profile={id:string;endpoint:string;bucket:string;region?:string;accessKeyId:string;secretAccessKey:string};
export function configuredStorage(directory:string,env:Record<string,string|undefined>){
 const local=new LocalObjects(directory),backends:ObjectBackend[]=[local];
 let profiles:Profile[]=[];try{if(env.PLATFORM_STORAGE_PROFILES)profiles=JSON.parse(env.PLATFORM_STORAGE_PROFILES);}catch{throw Error('Perfiles de almacenamiento: JSON privado no válido.');}
 if(!Array.isArray(profiles))throw Error('PLATFORM_STORAGE_PROFILES debe ser una lista.');
 if(env.S3_ENDPOINT||env.S3_BUCKET||env.S3_ACCESS_KEY_ID||env.S3_SECRET_ACCESS_KEY){profiles.push({id:env.S3_STORAGE_ID||'r2',endpoint:env.S3_ENDPOINT!,bucket:env.S3_BUCKET!,region:env.S3_REGION||'auto',accessKeyId:env.S3_ACCESS_KEY_ID!,secretAccessKey:env.S3_SECRET_ACCESS_KEY!});}
 for(const p of profiles){
  if(!p.id||!p.endpoint||!p.bucket||!p.accessKeyId||!p.secretAccessKey)throw Error('Completa la configuración privada S3.');
  const endpoint=new URL(p.endpoint);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')throw Error('El endpoint S3 debe ser HTTPS y no incluir el bucket.');
  backends.push(new S3Objects(p.id,p.bucket,new S3Client({endpoint:p.endpoint,region:p.region||'auto',credentials:{accessKeyId:p.accessKeyId,secretAccessKey:p.secretAccessKey},maxAttempts:3})));
 }
 const id=env.PLATFORM_STORAGE_ACTIVE||'local',active=backends.find(b=>b.id===id);if(!active)throw Error('Proveedor activo sin configurar.');
 return new ObjectStorage(active,backends.filter(b=>b!==active));
}
