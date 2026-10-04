import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {accessLibrary,libraryHeaders as headers,readLibraryBody} from '$lib/server/shared-library-api';
import {RESOURCE_MAX} from '$lib/workshop/shared-resource';
export const GET:RequestHandler=async event=>json(await accessLibrary(event).list(),{headers});
export const POST:RequestHandler=async event=>{const library=accessLibrary(event),body=await readLibraryBody(event.request,RESOURCE_MAX);try{return json(await library.save(body),{headers,status:201});}catch(e){return json({message:e instanceof Error?e.message:'No se pudo guardar el recurso.'},{status:400,headers});}};
