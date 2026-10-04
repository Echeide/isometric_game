import {error} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {accessLibrary,libraryHeaders} from '$lib/server/shared-library-api';
import {unpackResource} from '$lib/workshop/shared-resource';
export const GET:RequestHandler=async event=>{
 const library=accessLibrary(event);let bytes:Uint8Array;try{bytes=await library.get(event.params.id);}catch{error(404,'No se encuentra el recurso.');}
 const image=event.url.searchParams.get('image');
 if(image!==null){if(!/^assets\/[0-9]+\.png$/.test(image))error(400,'Imagen no válida.');const file=unpackResource(bytes).files[image];if(!file)error(404,'No se encuentra la imagen.');return new Response(new Uint8Array(file),{headers:{...libraryHeaders,'Content-Type':'image/png'}});}
 return new Response(new Uint8Array(bytes),{headers:{...libraryHeaders,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${event.params.id}.sprite.zip"`}});
};
