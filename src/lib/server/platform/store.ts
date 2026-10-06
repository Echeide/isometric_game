import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {PoolClient} from 'pg';
import type {PixelArtPack} from '@isometrico/world';
import {Database} from './database';
import {PlatformError,hashToken,hashPassword,audit} from './auth';
import {isSuper,defaultLimits,defaultPermissions,type Principal} from '../../platform/types';
import {parseAdventure,type Adventure} from '../../demo/adventure';
import {imageUrls,mapImages} from '../../storage/local-adventures';
import {validatePack,validateCatalogGraphics,pngSize} from '../../storage/adventure-package';
import {unpackResource,resourcePreview} from '../../workshop/shared-resource';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {publicGraphics,graphicsChanged} from './publication-state';
export function tenant(p:Principal){if(!p.tenant)throw new PlatformError(403,'Entra como un administrador para gestionar un espacio.');return p.tenant.id;}
export function superuser(p:Principal){if(!isSuper(p))throw new PlatformError(403,'Acción exclusiva del superadmin.');}
function name(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>120)throw new PlatformError(400,'Nombre no válido (1–120 caracteres).');return value.trim();}
const idValid=(id:string)=>/^[a-zA-Z0-9_-]{1,160}$/.test(id);
export class PlatformStore {
 constructor(readonly database:Database,readonly directory:string,readonly builtins:string){}
 private async put(bytes:Uint8Array){const hash=hashToken(Buffer.from(bytes).toString('base64'));await mkdir(join(this.directory,'blobs'),{recursive:true});await writeFile(join(this.directory,'blobs',hash),bytes,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});return hash;}
 private async bytes(hash:string){if(!/^[a-f0-9]{64}$/.test(hash))throw new PlatformError(404,'Archivo no disponible.');return new Uint8Array(await readFile(join(this.directory,'blobs',hash)));}
 private async lock(db:PoolClient,id:string){const t=(await db.query('SELECT * FROM platform_tenants WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!t?.enabled)throw new PlatformError(403,'Espacio desactivado.');return t;}
 private async storage(db:PoolClient,id:string,extra:number,max:number){const r=(await db.query("SELECT (SELECT coalesce(sum(bytes),0) FROM platform_assets WHERE tenant_id=$1)+(SELECT coalesce(sum(bytes),0) FROM platform_resources WHERE tenant_id=$1) AS bytes",[id])).rows[0];if(Number(r.bytes)+extra>max*1_000_000)throw new PlatformError(409,'Se ha alcanzado el límite de recursos guardados del espacio.');}
 async administration(p:Principal){superuser(p);return this.database.transaction(null,true,async db=>({tenants:(await db.query('SELECT * FROM platform_tenants ORDER BY created_at')).rows,users:(await db.query('SELECT id,username,role,tenant_id,enabled FROM platform_users ORDER BY username')).rows,audit:(await db.query('SELECT a.*,u.username AS actor_name,e.username AS effective_name FROM platform_audit a LEFT JOIN platform_users u ON u.id=a.actor_id LEFT JOIN platform_users e ON e.id=a.effective_id ORDER BY a.id DESC LIMIT 100')).rows}));}
 async configure(p:Principal,input:Record<string,any>){superuser(p);return this.database.transaction(null,true,async db=>{
  if(input.action==='tenant.create'){const id=randomUUID();await db.query('INSERT INTO platform_tenants(id,name,limits,permissions) VALUES($1,$2,$3,$4)',[id,name(input.name),defaultLimits,defaultPermissions]);await audit(db,p,input.action,id,id);return{id};}
  if(input.action==='tenant.update'){
   const limits={...defaultLimits,...input.limits},permissions={...defaultPermissions,...input.permissions};
   for(const k of Object.keys(defaultLimits))if(!Number.isInteger(limits[k])||limits[k]<0||limits[k]>1_000_000)throw new PlatformError(400,'Los límites deben ser enteros entre 0 y 1000000.');
   for(const k of Object.keys(defaultPermissions))if(typeof permissions[k]!=='boolean')throw new PlatformError(400,'Permisos no válidos.');
   if(typeof input.enabled!=='boolean')throw new PlatformError(400,'Estado no válido.');
   const r=await db.query('UPDATE platform_tenants SET name=$1,limits=$2,permissions=$3,enabled=$4 WHERE id=$5 RETURNING id',[name(input.name),limits,permissions,input.enabled,input.id]);if(!r.rowCount)throw new PlatformError(404,'Espacio no encontrado.');await audit(db,p,input.action,input.id,input.id);return{};
  }
  if(input.action==='user.create'){
   const username=name(input.username).toLowerCase();if(!/^[a-z0-9_.@-]{3,120}$/.test(username))throw new PlatformError(400,'Usa letras sin acentos, números, puntos o guiones.');
   if(!(await db.query('SELECT id FROM platform_tenants WHERE id=$1',[input.tenantId])).rowCount)throw new PlatformError(404,'Espacio no encontrado.');
   const id=randomUUID(),password=await hashPassword(input.password);if((await db.query('SELECT id FROM platform_users WHERE username=$1',[username])).rowCount)throw new PlatformError(409,'Ese usuario ya existe.');await db.query("INSERT INTO platform_users(id,username,password_hash,role,tenant_id) VALUES($1,$2,$3,'admin',$4)",[id,username,password,input.tenantId]);await audit(db,p,input.action,id,input.tenantId);return{id};
  }
  if(input.action==='user.update'||input.action==='user.password'){
   const u=(await db.query("SELECT * FROM platform_users WHERE id=$1 AND role='admin' FOR UPDATE",[input.id])).rows[0];if(!u)throw new PlatformError(404,'Administrador no encontrado.');
   if(input.action==='user.password')await db.query('UPDATE platform_users SET password_hash=$1 WHERE id=$2',[await hashPassword(input.password),input.id]);
   else{if(typeof input.enabled!=='boolean')throw new PlatformError(400,'Estado no válido.');await db.query('UPDATE platform_users SET enabled=$1 WHERE id=$2',[input.enabled,input.id]);}
   await db.query('DELETE FROM platform_sessions WHERE actor_id=$1',[input.id]);await audit(db,p,input.action,input.id,u.tenant_id);return{};
  }
  throw new PlatformError(400,'Acción no válida.');
 });}
 async list(p:Principal){const t=tenant(p);return this.database.transaction(t,false,async db=>({version:1,activeId:'',adventures:(await db.query('SELECT definition,revision FROM platform_adventures WHERE tenant_id=$1 ORDER BY updated_at DESC',[t])).rows.map(r=>({...r.definition,_revision:r.revision})),publications:(await db.query(`
  SELECT p.slug,p.adventure_id,p.active,p.published_at,
   a.definition IS DISTINCT FROM p.definition AS definition_changed,
   CASE WHEN p.active AND a.definition=p.definition THEN a.graphics END AS current_graphics,
   CASE WHEN p.active AND a.definition=p.definition THEN p.graphics END AS published_graphics
  FROM platform_publications p LEFT JOIN platform_adventures a ON a.tenant_id=p.tenant_id AND a.id=p.adventure_id
  WHERE p.tenant_id=$1`,[t])).rows.map(r=>({slug:r.slug,adventure_id:r.adventure_id,active:r.active,published_at:r.published_at,hasUnpublishedChanges:!!r.active&&(r.definition_changed||graphicsChanged(r.current_graphics,r.published_graphics))})),usage:(await db.query("SELECT kind,used FROM platform_usage WHERE tenant_id=$1 AND month=to_char(now(),'YYYY-MM')",[t])).rows}));}
 async adventure(p:Principal,id:string){return this.database.transaction(tenant(p),false,async db=>{const a=(await db.query('SELECT * FROM platform_adventures WHERE tenant_id=$1 AND id=$2',[tenant(p),id])).rows[0];if(!a)throw new PlatformError(404,'Aventura no encontrada.');return a;});}
 async asset(p:Principal,id:string){return this.database.transaction(tenant(p),false,async db=>{const a=(await db.query('SELECT hash FROM platform_assets WHERE tenant_id=$1 AND id=$2',[tenant(p),id])).rows[0];if(!a)throw new PlatformError(404,'Archivo no disponible.');return this.bytes(a.hash);});}
 async save(p:Principal,value:unknown,pack:PixelArtPack|undefined,blobs:Record<string,Uint8Array>,revision:number){
  const t=tenant(p),adventure=parseAdventure(value);if(!idValid(adventure.id)||JSON.stringify(adventure).length>10_000_000)throw new PlatformError(400,'Aventura no válida.');delete (adventure as any)._revision;
  return this.database.transaction(t,false,async db=>{
   const space=await this.lock(db,t),old=(await db.query('SELECT graphics,revision FROM platform_adventures WHERE tenant_id=$1 AND id=$2',[t,adventure.id])).rows[0];
   if((old?.revision??0)!==revision)throw new PlatformError(409,'Otra sesión modificó esta aventura. Exporta tus cambios y vuelve a cargarla antes de guardar.');
   if(!old&&Number((await db.query('SELECT count(*) AS n FROM platform_adventures WHERE tenant_id=$1',[t])).rows[0].n)>=space.limits.adventures)throw new PlatformError(409,'Límite de aventuras alcanzado.');
   const graphics=pack??old?.graphics;if(!graphics)throw new PlatformError(400,'Faltan los gráficos.');
   const files:Record<string,Uint8Array>={},paths=new Map<string,string>(),assets:Array<{id:string;hash:string;bytes:number}>=[];let extra=0,total=0;
   for(const [i,url] of imageUrls(graphics).entries()){
    let bytes:Uint8Array;
    if(url.startsWith('asset:')){const id=url.slice(6);if(!idValid(id))throw new PlatformError(400,'Identificador de imagen no válido.');const prior=(await db.query('SELECT hash FROM platform_assets WHERE tenant_id=$1 AND id=$2',[t,id])).rows[0];bytes=blobs[id]??(prior?await this.bytes(prior.hash):new Uint8Array());pngSize(bytes);const hash=hashToken(Buffer.from(bytes).toString('base64'));if(prior&&hash!==prior.hash)throw new PlatformError(409,'Las imágenes guardadas son inmutables. Usa un nuevo identificador.');if(!prior){assets.push({id,hash,bytes:bytes.length});extra+=bytes.length;}}
    else{if(!/^\/pixelart\/[a-zA-Z0-9_./-]+\.png$/.test(url)||url.includes('..'))throw new PlatformError(400,'Origen de imagen no admitido.');bytes=new Uint8Array(await readFile(join(this.builtins,url.slice(10))));}
    if(bytes.length>20_000_000||(total+=bytes.length)>100_000_000)throw new PlatformError(413,'Los recursos superan 100 MB.');const path=`assets/${i}.png`;paths.set(url,path);files[path]=bytes;
   }
   validatePack(mapImages(graphics,u=>paths.get(u)!),files);validateCatalogGraphics(adventure,graphics);await this.storage(db,t,extra,space.limits.storageMB);
   for(const a of assets){await this.put(blobs[a.id]);await db.query('INSERT INTO platform_assets(tenant_id,id,hash,bytes) VALUES($1,$2,$3,$4)',[t,a.id,a.hash,a.bytes]);}
   const r=await db.query('INSERT INTO platform_adventures(tenant_id,id,definition,graphics) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,id) DO UPDATE SET definition=$3,graphics=$4,revision=platform_adventures.revision+1,updated_at=now() RETURNING revision',[t,adventure.id,adventure,graphics]);await audit(db,p,'adventure.save',adventure.id);return{revision:r.rows[0].revision};
  });
 }
 async reserve(p:Principal,kind:'images'|'videos'){const t=tenant(p);return this.database.transaction(t,false,async db=>{const space=await this.lock(db,t);if(!space.permissions[kind])throw new PlatformError(403,'Tu espacio no tiene permiso para esta generación.');const r=await db.query("SELECT used FROM platform_usage WHERE tenant_id=$1 AND month=to_char(now(),'YYYY-MM') AND kind=$2",[t,kind]);if((r.rows[0]?.used??0)>=space.limits[kind])throw new PlatformError(429,'Se ha alcanzado el límite mensual de generaciones.');await db.query("INSERT INTO platform_usage(tenant_id,month,kind,used) VALUES($1,to_char(now(),'YYYY-MM'),$2,1) ON CONFLICT(tenant_id,month,kind) DO UPDATE SET used=platform_usage.used+1",[t,kind]);await audit(db,p,'generation.'+kind);});}
 async publish(p:Principal,id:string,active:boolean){const t=tenant(p);return this.database.transaction(t,false,async db=>{const space=await this.lock(db,t);if(!space.permissions.publish)throw new PlatformError(403,'Tu espacio no tiene permiso para publicar.');
  if(!active){await db.query('UPDATE platform_publications SET active=false WHERE tenant_id=$1 AND adventure_id=$2',[t,id]);await audit(db,p,'adventure.withdraw',id);return{};}
  const a=(await db.query('SELECT * FROM platform_adventures WHERE tenant_id=$1 AND id=$2',[t,id])).rows[0];if(!a)throw new PlatformError(404,'Aventura no encontrada.');const old=(await db.query('SELECT * FROM platform_publications WHERE tenant_id=$1 AND adventure_id=$2',[t,id])).rows[0];
  const count=Number((await db.query('SELECT count(*) AS n FROM platform_publications WHERE tenant_id=$1 AND active',[t])).rows[0].n);if(!old?.active&&count>=space.limits.published)throw new PlatformError(409,'Límite de aventuras publicadas alcanzado.');
  const graphics=publicGraphics(a.graphics);
  const slug=old?.slug??randomUUID(),version=randomUUID(),assetIds=imageUrls(graphics).filter(u=>u.startsWith('asset:')).map(u=>u.slice(6));
  await db.query('INSERT INTO platform_releases(id,slug,tenant_id,definition,graphics,asset_ids) VALUES($1,$2,$3,$4,$5,$6)',[version,slug,t,a.definition,graphics,JSON.stringify(assetIds)]);
  await db.query('INSERT INTO platform_publications(slug,tenant_id,adventure_id,name,definition,graphics,asset_ids,release_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,adventure_id) DO UPDATE SET name=$4,definition=$5,graphics=$6,asset_ids=$7,release_id=$8,active=true,published_at=now()',[slug,t,id,a.definition.name,a.definition,graphics,JSON.stringify(assetIds),version]);await audit(db,p,'adventure.publish',id);return{slug};
 });}
 async publicList(){return this.database.transaction(null,false,async db=>(await db.query('SELECT p.slug,p.name,p.description,t.name AS "tenantName",p.published_at AS "publishedAt" FROM platform_publications p JOIN platform_tenants t ON t.id=p.tenant_id WHERE p.active AND t.enabled ORDER BY p.published_at DESC')).rows);}
 async published(slug:string){return this.database.transaction(null,false,async db=>{const r=(await db.query('SELECT r.* FROM platform_publications p JOIN platform_tenants t ON t.id=p.tenant_id JOIN platform_releases r ON r.id=p.release_id WHERE p.slug=$1 AND p.active AND t.enabled',[slug])).rows[0];if(!r)throw new PlatformError(404,'Aventura no publicada.');return{key:r.slug,adventure:r.definition,graphics:mapImages(r.graphics,u=>u.startsWith('asset:')?`/api/public/assets/${r.id}/${u.slice(6)}.png`:u)};});}
 async publicAsset(release:string,id:string){return this.database.transaction(null,true,async db=>{const r=(await db.query('SELECT a.hash FROM platform_releases r JOIN platform_publications p ON p.slug=r.slug JOIN platform_tenants t ON t.id=r.tenant_id JOIN platform_assets a ON a.tenant_id=r.tenant_id AND a.id=$2 WHERE r.id=$1 AND p.active AND t.enabled AND r.asset_ids ? $2',[release,id])).rows[0];if(!r)throw new PlatformError(404,'Archivo no disponible.');return this.bytes(r.hash);});}
 async resourceList(p:Principal,scope='tenant',owner?:string){if(owner)superuser(p);const t=owner??p.tenant?.id??null;if(scope==='tenant'&&!t)throw new PlatformError(403,'Selecciona un espacio.');return this.database.transaction(t,isSuper(p),async db=>(await db.query("SELECT summary FROM platform_resources WHERE visible AND (scope='global' AND $1='global' OR scope='tenant' AND tenant_id=$2 AND $1='tenant') ORDER BY created_at DESC",[scope,t])).rows.map(r=>r.summary));}
 async resource(p:Principal,id:string){return this.database.transaction(p.tenant?.id??null,isSuper(p),async db=>{const r=(await db.query('SELECT * FROM platform_resources WHERE id=$1 AND visible',[id])).rows[0];if(!r)throw new PlatformError(404,'Recurso no disponible.');return this.bytes(r.hash);});}
 async saveResource(p:Principal,bytes:Uint8Array,global=false,source?:string){if(global)superuser(p);const t=global?null:tenant(p),{resource}=unpackResource(bytes),hash=hashToken(Buffer.from(bytes).toString('base64')),id=hashToken((t??'global')+hash),preview=resourcePreview(resource),summary={id,version:1,name:resource.name,kind:resource.kind,category:resource.category,image:preview.image,frame:preview.frame,createdAt:new Date().toISOString()};return this.database.transaction(t,global,async db=>{
  const space=t?await this.lock(db,t):null;const old=(await db.query('SELECT summary FROM platform_resources WHERE id=$1',[id])).rows[0];if(old){if(global)await db.query('UPDATE platform_resources SET visible=true WHERE id=$1',[id]);return old.summary;}
  if(space)await this.storage(db,t!,bytes.length,space.limits.storageMB);await this.put(bytes);await db.query('INSERT INTO platform_resources(id,tenant_id,scope,summary,hash,bytes,source_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,t,global?'global':'tenant',summary,hash,bytes.length,source??null]);await audit(db,p,global?'resource.promote':'resource.save',id,t??undefined);return summary;
 });}
 async promote(p:Principal,id:string){superuser(p);return this.saveResource(p,await this.resource(p,id),true,id);}
 async withdrawResource(p:Principal,id:string){superuser(p);await this.database.transaction(null,true,async db=>{await db.query("UPDATE platform_resources SET visible=false WHERE id=$1 AND scope='global'",[id]);await audit(db,p,'resource.withdraw',id);});}
 async exportResources(p:Principal,scope:string){const files:Record<string,Uint8Array>={'library.json':strToU8(JSON.stringify({format:'isometric-library',version:1}))};let total=0;for(const r of await this.resourceList(p,scope)){const b=await this.resource(p,r.id);if((total+=b.length)>190_000_000)throw new PlatformError(413,'Descarga los recursos por separado: más de 190 MB.');const {createHash}=await import('node:crypto');files[`resources/${createHash('sha256').update(b).digest('hex')}.zip`]=b;}return zipSync(files,{level:0});}
 async importResources(p:Principal,bytes:Uint8Array){let total=0,count=0;const files=unzipSync(bytes,{filter:f=>{if(++count>257||(total+=f.originalSize)>200_000_000||!(/^(library\.json|resources\/[a-f0-9]{64}\.zip)$/.test(f.name)))throw new PlatformError(400,'Archivo de biblioteca no válido.');return true;}});const manifest=JSON.parse(strFromU8(files['library.json']));if(manifest.format!=='isometric-library'||manifest.version!==1)throw new PlatformError(400,'Biblioteca no válida.');const resources=Object.entries(files).filter(([k])=>k!=='library.json');for(const [,b]of resources)unpackResource(b);for(const [,b]of resources)await this.saveResource(p,b);return resources.length;}
}
