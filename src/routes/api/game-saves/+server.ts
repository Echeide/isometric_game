import {json,isHttpError,type RequestHandler} from '@sveltejs/kit';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
import {GameSaveError} from '$lib/server/platform/game-saves';
import {readLibraryBody} from '$lib/server/shared-library-api';
const handle:RequestHandler=async event=>{
 try{
  if(!event.locals.principal&&!event.locals.player)throw new GameSaveError(401,'Inicia sesión para sincronizar tu partida.','unauthorized');
  const query=event.url.searchParams,context={publication:query.get('publication'),adventure:query.get('adventure'),release:query.get('release'),account:query.get('account'),tenant:query.get('tenant')},service=platform().saves;
  if(event.request.method==='GET')return json(await service.read(event.locals.principal,event.locals.player,context),{headers:{'Cache-Control':'no-store'}});
  if(event.request.headers.get('origin')!==event.url.origin)throw new PlatformError(403,'La solicitud debe proceder de esta aplicación.');
  const body=JSON.parse(new TextDecoder().decode(await readLibraryBody(event.request,1_100_000)));
  return json(await service.write(event.locals.principal,event.locals.player,context,body),{headers:{'Cache-Control':'no-store'}});
 }catch(e){const status=e instanceof PlatformError||isHttpError(e)?e.status:e instanceof SyntaxError?400:503;return json({message:e instanceof PlatformError?e.message:isHttpError(e)?e.body.message:'No se pudo sincronizar la partida.',code:e instanceof GameSaveError?e.code:undefined},{status,headers:{'Cache-Control':'no-store'}});}
};
export const GET=handle;export const POST=handle;
