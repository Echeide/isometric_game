import {env} from '$env/dynamic/private';
import {dev} from '$app/environment';
import {resolve} from 'node:path';
import {error,type RequestEvent} from '@sveltejs/kit';
import {allowCharacterApi} from './character-access';
import {SharedLibrary} from './shared-library';
let library:SharedLibrary|undefined;
export function accessLibrary(event:RequestEvent){
 if(!allowCharacterApi(dev,dev?event.getClientAddress():'',event.url,event.request.method==='GET'?undefined:event.request.headers.get('origin'),event.locals.characterWorkshopAuthorized))error(403,'Accede al taller privado para utilizar la biblioteca.');
 const directory=env.SPRITE_LIBRARY_DIR||(dev?resolve('.sprite-library'):'');
 if(!directory)error(503,'Configura SPRITE_LIBRARY_DIR en un almacenamiento persistente del servidor.');
 return library??=new SharedLibrary(directory);
}
export const libraryHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function readLibraryBody(request:Request,max:number){
 if(Number(request.headers.get('content-length'))>max)error(413,'El archivo supera el límite permitido.');
 const reader=request.body?.getReader();if(!reader)error(400,'Falta el archivo.');const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;if((size+=value.length)>max){await reader.cancel();error(413,'El archivo supera el límite permitido.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}
