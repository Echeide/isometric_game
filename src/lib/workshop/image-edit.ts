import type {ObjectSprite} from '@isometrico/world';
import {pngSize} from '$lib/storage/adventure-package';

export const editorChannel = 'isometrico-piskel-v1';
export const editorRevision = 'frames-2';
export type ImageEditSession = {blob:Blob;name:string;width:number;height:number;frames?:number;fps?:number};

export function validateEditorLoaded(data:{frames?:unknown;width?:unknown;height?:unknown}, expected:ImageEditSession) {
 const frames=expected.frames ?? 1;
 if(data.frames!==frames || data.width!==expected.width/frames || data.height!==expected.height) {
  throw new Error('Piskel no ha separado correctamente los fotogramas. Cierra el editor y vuelve a abrirlo con la versión actual del taller.');
 }
}

export async function validateEditedImage(blob:Blob, expected:{width:number;height:number}) {
 if (!(blob instanceof Blob) || blob.size > 10_000_000) throw new Error('El PNG editado no puede superar 10 MB.');
 const size = pngSize(new Uint8Array(await blob.arrayBuffer()));
 if (size.width !== expected.width || size.height !== expected.height) throw new Error('El retoque debe conservar el tamaño de la imagen original.');
 return size;
}

/** Only the source changes: crop, world dimensions, pivot and NPC clips stay intact. */
export function withEditedImage(item:ObjectSprite, image:string):ObjectSprite {
 return {...item, originalImage:item.originalImage ?? item.image, image};
}
