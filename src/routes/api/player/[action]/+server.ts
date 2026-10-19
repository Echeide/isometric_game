import {json,isHttpError,type RequestHandler} from '@sveltejs/kit';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
import {readLibraryBody} from '$lib/server/shared-library-api';
export const POST:RequestHandler=async event=>{
 try{
  const auth=platform().players,action=event.params.action;
  if(event.request.headers.get('origin')!==event.url.origin)throw new PlatformError(403,'La solicitud debe proceder de esta aplicación.');
  const body=JSON.parse(new TextDecoder().decode(await readLibraryBody(event.request,8192)));let token:string|undefined;
  if(action==='register')token=await auth.register(body.username,body.password,event.getClientAddress());
  else if(action==='login')token=await auth.login(body.username,body.password,event.getClientAddress());
  else if(action==='logout'){if(event.locals.player)await auth.logout(event.locals.player);event.cookies.delete('player_session',{path:'/'});}
  else throw new PlatformError(404,'Acción no válida.');
  if(token)event.cookies.set('player_session',token,{path:'/',httpOnly:true,sameSite:'lax',secure:event.url.protocol==='https:',maxAge:30*24*3600});
  return json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const status=e instanceof PlatformError||isHttpError(e)?e.status:e instanceof SyntaxError?400:503;return json({message:e instanceof PlatformError?e.message:isHttpError(e)?e.body.message:'No se pudo completar la operación.'},{status,headers:{'Cache-Control':'no-store'}});}
};
