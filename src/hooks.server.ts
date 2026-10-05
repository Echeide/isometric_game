import type {Handle} from '@sveltejs/kit';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
import {isSuper} from '$lib/platform/types';
export const handle:Handle=async({event,resolve})=>{
 const path=event.url.pathname,privatePath=/^\/(admin|superadmin|account|editor|sprites|resources|adventure|characters|library|preview|api\/(platform|characters))(\/|$)/.test(path);
 const mutation=!['GET','HEAD','OPTIONS'].includes(event.request.method);
 try{
  if(mutation&&event.request.headers.get('origin')!==event.url.origin)throw new PlatformError(403,'La solicitud debe proceder de esta aplicación.');
  if(privatePath||event.cookies.get('platform_session')||path==='/login'||path.startsWith('/api/auth'))event.locals.principal=await platform().auth.principal(event.cookies.get('platform_session'));
  if(privatePath&&!event.locals.principal){if(path.startsWith('/api/'))throw new PlatformError(401,'Inicia sesión para continuar.');return new Response(null,{status:303,headers:{Location:'/login'}});}
  const p=event.locals.principal;
  if(p){event.locals.characterWorkshopAuthorized=true;if(path.startsWith('/superadmin')&&!isSuper(p))throw new PlatformError(403,'Acción exclusiva del superadmin.');if(/^\/(editor|sprites|resources|adventure|characters|library|preview|api\/characters\/(images|objects|videos))(\/|$)/.test(path)&&!p.tenant){if(path.startsWith('/api/'))throw new PlatformError(403,'Selecciona Entrar como un administrador.');return new Response(null,{status:303,headers:{Location:'/superadmin'}});}}
  const response=await resolve(event);if(privatePath||path.startsWith('/api/auth'))response.headers.set('Cache-Control','no-store');response.headers.set('X-Content-Type-Options','nosniff');return response;
 }catch(e){if(e instanceof PlatformError)return new Response(JSON.stringify({message:e.message,error:e.message}),{status:e.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});console.error('Platform request failed',e instanceof Error?e.message:'Unknown error');return new Response('El servicio de gestión no está disponible.',{status:503,headers:{'Cache-Control':'no-store'}});}
};
