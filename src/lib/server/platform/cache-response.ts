import {createHash} from 'node:crypto';

/** Call only after authorization and reading current data; validation never bypasses access checks. */
export function revalidatedJson(request:Request,value:unknown){
 const body=JSON.stringify(value),etag=`"${createHash('sha256').update(body).digest('hex')}"`;
 const headers={'ETag':etag,'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Cookie'};
 return new Response(request.headers.get('if-none-match')===etag?null:body,{status:request.headers.get('if-none-match')===etag?304:200,headers});
}
