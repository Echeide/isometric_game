import {json,type RequestHandler} from '@sveltejs/kit';
import {readLibraryBody} from '$lib/server/shared-library-api';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
export const POST:RequestHandler=async event=>{
 try{const {auth}=platform(),p=event.locals.principal,action=event.params.action,body=JSON.parse(new TextDecoder().decode(await readLibraryBody(event.request,8192)));let token:string|undefined;
 if(action==='login')token=await auth.login(body.username,body.password,event.getClientAddress());
 else{if(!p)throw new PlatformError(401,'Inicia sesión.');if(action==='logout'){await auth.logout(p);event.cookies.delete('platform_session',{path:'/'});}else if(action==='impersonate')token=await auth.impersonate(p,body.userId??null);else if(action==='password')await auth.changePassword(p,body.current,body.password);else throw new PlatformError(404,'Acción no válida.');}
 if(token)event.cookies.set('platform_session',token,{path:'/',httpOnly:true,sameSite:'lax',secure:event.url.protocol==='https:',maxAge:8*3600});return json({ok:true});
 }catch(e){return json({message:e instanceof PlatformError?e.message:'No se pudo completar la operación.'},{status:e instanceof PlatformError?e.status:400});}
};
