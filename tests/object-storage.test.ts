import {it,expect,vi} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ObjectStorage,LocalObjects,S3Objects,configuredStorage,objectKey} from '../src/lib/server/platform/object-storage';
import {buildCartridge,digest} from '../src/lib/server/platform/cartridge';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {unpackAdventure} from '../src/lib/storage/adventure-package';
it('keeps legacy blobs readable, writes atomically and rejects traversal and replacement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'objects-'));try{
  const local=new LocalObjects(dir),storage=new ObjectStorage(local),bytes=new Uint8Array([1,2,3]),hash='a'.repeat(64);
  await local.put('blobs/'+hash,bytes,'image/png');expect(await storage.get({hash})).toEqual(bytes);
  const location=await storage.put('espacios/demo/aventuras/test/imagenes/a.png',bytes,'image/png');expect(await storage.get({hash,...location})).toEqual(bytes);
  await expect(local.put(location.storage_key,new Uint8Array([9]),'image/png')).rejects.toThrow('inmutable');expect(await storage.get({hash,...location})).toEqual(bytes);
  for(const key of ['../leak','/absolute','a/../b','a//b','a\\b'])expect(()=>objectKey(key)).toThrow();
  await expect(storage.get({hash,storage_backend:'missing',storage_key:'a.png'})).rejects.toThrow('proveedor');
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('sends bucket, content type and keys through the official S3 transport',async()=>{
 const bytes=new Uint8Array([2,3]),send=vi.fn().mockResolvedValue({Body:{transformToByteArray:async()=>bytes}}),backend=new S3Objects('r2','pixtories',{send} as any);
 await backend.put('espacios/a/aventuras/b/imagenes/c.png',bytes,'image/png');expect(send.mock.calls[0][0].input).toEqual({Bucket:'pixtories',Key:'espacios/a/aventuras/b/imagenes/c.png',Body:bytes,ContentType:'image/png'});
 expect(await backend.get('espacios/a/aventuras/b/imagenes/c.png')).toEqual(bytes);
 expect(send.mock.calls[1][0].input.Bucket).toBe('pixtories');
 send.mockRejectedValueOnce(Error('offline'));await expect(backend.get('valid.png')).rejects.toThrow();
});
it('requires a configured provider and a separate bucket name',()=>{
 expect(configuredStorage('/tmp/test',{}).active.id).toBe('local');
 expect(()=>configuredStorage('/tmp/test',{PLATFORM_STORAGE_ACTIVE:'r2'})).toThrow();
 expect(()=>configuredStorage('/tmp/test',{S3_ENDPOINT:'https://example.com/pixtories',S3_BUCKET:'pixtories',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'test'})).toThrow('endpoint');
});
it('builds a portable cartridge with builtins, integrity records and an importable ZIP',async()=>{
 const adventure=createAdventure([structuredClone(office)]),pack=structuredClone(graphics);pack.objects['pixel.key'].originalImage='asset:do-not-publish';
 const read=vi.fn(async(url:string)=>new Uint8Array(await readFile('static'+url)));
 const cartridge=await buildCartridge('release-test',adventure,pack,read);
 expect(read.mock.calls.some(([u])=>u==='asset:do-not-publish')).toBe(false);
 const imported=unpackAdventure(cartridge.files['cartucho.zip']);expect(imported.adventure.id).toBe(adventure.id);expect(Object.keys(imported.blobs).length).toBeGreaterThan(0);
 for(const [path,info]of Object.entries(cartridge.manifest.files)){expect(digest(cartridge.files[path])).toBe(info.sha256);expect(cartridge.files[path].length).toBe(info.bytes);}
 expect(new TextDecoder().decode(cartridge.files['graficos.json'])).not.toContain('/pixelart/');
 expect(cartridge.manifest.images[graphics.character.image!]).toMatch(/^assets\//);
});
it('reports linked media without fetching arbitrary external URLs',async()=>{
 const adventure=createAdventure([structuredClone(office)]);(adventure as any).chats=[{id:'linked',name:'Link',config:{url:'https://example.com/video.mp4'}}];
 const cartridge=await buildCartridge('release-test',adventure,graphics,async u=>new Uint8Array(await readFile('static'+u)));
 expect(cartridge.manifest.externalDependencies).toContain('https://example.com/video.mp4');
});
