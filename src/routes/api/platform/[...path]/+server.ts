import {json,type RequestEvent,type RequestHandler} from '@sveltejs/kit';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
import {revalidatedJson} from '$lib/server/platform/cache-response';
import {readLibraryBody} from '$lib/server/shared-library-api';
const handle:RequestHandler=async event=>{
 try{return await route(event);}catch(e){return json({message:e instanceof PlatformError?e.message:((e as NodeJS.ErrnoException).code?'No se pudo completar la operación.':e instanceof Error?e.message:'Operación no disponible.')},{status:e instanceof PlatformError?e.status:400});}
};
async function body(e:RequestEvent){return JSON.parse(new TextDecoder().decode(await readLibraryBody(e.request,32768)));}
async function route(e:RequestEvent){const p=e.locals.principal;if(!p)throw new PlatformError(401,'Inicia sesión.');const {store}=platform(),path=e.params.path??'',post=e.request.method==='POST';
 if(path==='management')return json(post?await store.configure(p,await body(e)):await store.administration(p));
 if(path==='adventures')return revalidatedJson(e.request,await store.list(p));
 const parts=path.split('/');
 if(parts[0]==='adventures'&&parts.length===2){
  if(!post)return revalidatedJson(e.request,await store.adventure(p,parts[1]));
  const raw=await readLibraryBody(e.request,120_000_000);const form=await new Response(new Uint8Array(raw),{headers:{'Content-Type':e.request.headers.get('content-type')??''}}).formData();
  const data=JSON.parse(String(form.get('manifest'))),blobs:Record<string,Uint8Array>={};for(const [key,value]of form.entries())if(key!=='manifest'&&value instanceof File)blobs[key]=new Uint8Array(await value.arrayBuffer());
  if(data.adventure.id!==parts[1]||!Number.isInteger(data.revision)||data.revision<0)throw new PlatformError(400,'Versión no válida.');return json(await store.save(p,data.adventure,data.pack,blobs,data.revision));
 }
 if(parts[0]==='assets'&&parts.length===2&&!post)return new Response(new Uint8Array(await store.asset(p,parts[1])),{headers:{'Content-Type':'image/png'}});
 if(path==='publish'&&post){const b=await body(e);if(typeof b.active!=='boolean')throw new PlatformError(400,'Estado no válido.');return json(await store.publish(p,b.id,b.active));}
 if(path==='resources'&&!post)return json(await store.resourceList(p,e.url.searchParams.get('scope')??'tenant',e.url.searchParams.get('tenant')??undefined));
 if(path==='promote'&&post)return json(await store.promote(p,(await body(e)).id));
 if(path==='withdraw-resource'&&post){await store.withdrawResource(p,(await body(e)).id);return json({ok:true});}
 throw new PlatformError(404,'Ruta no encontrada.');
}
export const GET=handle;export const POST=handle;
