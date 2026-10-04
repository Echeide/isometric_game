import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {accessLibrary,libraryHeaders as headers,readLibraryBody} from '$lib/server/shared-library-api';
import {LIBRARY_MAX} from '$lib/server/shared-library';
export const GET:RequestHandler=async event=>{const library=accessLibrary(event);try{return new Response(new Uint8Array(await library.export()),{headers:{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="biblioteca-sprites.zip"'}});}catch(e){return json({message:(e as Error).message},{status:400,headers});}};
export const POST:RequestHandler=async event=>{const library=accessLibrary(event),bytes=await readLibraryBody(event.request,LIBRARY_MAX);try{return json({count:await library.import(bytes)},{headers});}catch(e){return json({message:(e as Error).message},{status:400,headers});}};
