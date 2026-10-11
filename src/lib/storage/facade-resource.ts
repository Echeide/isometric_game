import {localAdventures,type AdventureRepository} from './local-adventures';
import {pngSize} from './adventure-package';
/** Append a reusable resource without saving the editor's unsaved map draft. */
export async function storeFacadeResource(adventureId:string,file:Blob,name:string,expectedRevision?:number,repository:AdventureRepository=localAdventures){
 if(file.size>10_000_000)throw Error('La imagen no puede superar 10 MB.');
 pngSize(new Uint8Array(await file.arrayBuffer()));
 const library=await repository.load(),adventure=library.adventures.find(a=>a.id===adventureId);
 if(!adventure)throw Error('No se encuentra la aventura.');
 if(expectedRevision!==undefined&&(adventure as {_revision?:number})._revision!==expectedRevision)throw Error('La aventura ha cambiado en otra sesión. Vuelve a cargarla antes de añadir imágenes.');
 const pack=await repository.pack(adventureId),id='custom.'+crypto.randomUUID(),asset=crypto.randomUUID();
 if(Object.keys(pack.facades??{}).length>=128)throw Error('La biblioteca admite hasta 128 fachadas.');
 const next={...pack,facades:{...pack.facades,[id]:{name:name.trim().slice(0,120)||'Fachada',image:'asset:'+asset}}};
 const saved=await repository.save(adventure,{pack:next,blobs:{[asset]:file}});
 return {id,revision:(saved.adventures.find(a=>a.id===adventureId) as {_revision?:number}|undefined)?._revision};
}
