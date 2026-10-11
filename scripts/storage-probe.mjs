// Server-only S3 probe. The small verification file is retained in the bucket.
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
const {S3_ENDPOINT,S3_BUCKET,S3_REGION,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY}=process.env;
if(!S3_ENDPOINT||!S3_BUCKET||!S3_ACCESS_KEY_ID||!S3_SECRET_ACCESS_KEY)throw Error('Completa las variables privadas S3 antes de comprobar la conexión.');
const client=new S3Client({endpoint:S3_ENDPOINT,region:S3_REGION||'auto',credentials:{accessKeyId:S3_ACCESS_KEY_ID,secretAccessKey:S3_SECRET_ACCESS_KEY},maxAttempts:2});
const key=`sistema/comprobaciones/${randomUUID()}.json`,bytes=Buffer.from(JSON.stringify({kind:'isometric-storage-probe',createdAt:new Date().toISOString()}));
try{
 await client.send(new PutObjectCommand({Bucket:S3_BUCKET,Key:key,Body:bytes,ContentType:'application/json'}),{abortSignal:AbortSignal.timeout(30_000)});
 const r=await client.send(new GetObjectCommand({Bucket:S3_BUCKET,Key:key}),{abortSignal:AbortSignal.timeout(30_000)});
 if(!r.Body||!Buffer.from(await r.Body.transformToByteArray()).equals(bytes))throw Error('La copia no coincide.');
 console.log(`Lectura y escritura S3 verificadas: ${S3_BUCKET}/${key}`);
}catch(e){console.error('No se pudo verificar S3. Revisa endpoint, bucket y permisos del token.',e?.name||'');process.exitCode=1;}finally{client.destroy();}
