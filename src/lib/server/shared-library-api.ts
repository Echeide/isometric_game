import {error,type RequestEvent} from '@sveltejs/kit';
import {platform} from './platform/runtime';
export function accessLibrary(event:RequestEvent){const p=event.locals.principal;if(!p)error(401,'Inicia sesión.');if(event.request.method!=='GET'&&event.request.headers.get('origin')!==event.url.origin)error(403,'Origen no permitido.');const store=platform().store,scope=event.url.searchParams.get('scope')??'tenant';return {list:()=>store.resourceList(p,scope),get:(id:string)=>store.resource(p,id),save:(b:Uint8Array)=>store.saveResource(p,b),export:()=>store.exportResources(p,scope),import:(b:Uint8Array)=>store.importResources(p,b)};}
export const libraryHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function readLibraryBody(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)error(413,'El archivo supera el límite permitido.');
 const reader=request.body?.getReader();if(!reader)error(400,'Falta el archivo.');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if((size+=value.length)>max){await reader.cancel();error(413,'El archivo supera el límite permitido.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}
