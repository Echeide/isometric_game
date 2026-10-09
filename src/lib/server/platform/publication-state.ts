import type {PixelArtPack} from '@isometrico/world';

/** Use exactly the same playable graphics for publication and pending-change detection. */
export function publicGraphics(pack:PixelArtPack):PixelArtPack {
 const graphics=structuredClone(pack);
 delete graphics.resourceOrigins;delete graphics.tileOriginalImages;delete graphics.paletteOriginalImages;delete graphics.tileFamilies;delete graphics.objectFamilies;
 for(const object of Object.values(graphics.objects)){
  delete object.originalImage;delete object.generationImage;
  for(const key of Object.keys(object))if(/prompt|generation|source/i.test(key))delete (object as unknown as Record<string,unknown>)[key];
 }
 return graphics;
}

function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}

/** JSON object order and private originals are irrelevant to what the public plays. */
export function graphicsChanged(current:PixelArtPack,published:PixelArtPack):boolean {
 return canonical(publicGraphics(current))!==canonical(publicGraphics(published));
}
