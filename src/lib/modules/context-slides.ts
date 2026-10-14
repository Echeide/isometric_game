import type {ContextModule,ContextSlide} from './types';
import {isMediaUrl} from './routing';
export const MAX_CONTEXT_SLIDES=32;
export function contextSlides(module:ContextModule):ContextSlide[]{return module.slides??[{id:'legacy',title:module.title,text:module.text}];}
/** Svelte state proxies cannot be structured-cloned. Copy the authored fields
 * into plain independent slide objects before putting them in editor state. */
export function editableContextSlides(module:ContextModule):ContextSlide[]{return contextSlides(module).map(slide=>({id:slide.id,text:slide.text,...(slide.title!==undefined?{title:slide.title}:{}),...(slide.image!==undefined?{image:slide.image}:{})}));}
export function validateContext(module:ContextModule){
 if(typeof module.title!=='string'||!module.title.trim()||module.title.length>120||typeof module.text!=='string'||module.text.length>12000)throw Error('Título o texto de contexto no válido.');
 if(module.slides===undefined)return;
 if(!Array.isArray(module.slides)||!module.slides.length||module.slides.length>MAX_CONTEXT_SLIDES)throw Error('El contexto admite entre 1 y 32 diapositivas.');
 const ids=new Set<string>();let images=0;
 for(const slide of module.slides){
  if(!slide||typeof slide.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(slide.id)||ids.has(slide.id))throw Error('Las diapositivas necesitan identificadores únicos.');ids.add(slide.id);
  if(typeof slide.text!=='string'||slide.text.length>12000||slide.title!==undefined&&(typeof slide.title!=='string'||slide.title.length>120))throw Error('Título o texto de diapositiva no válido.');
  if(slide.image!==undefined&&(typeof slide.image!=='string'||!isMediaUrl(slide.image)||slide.image.startsWith('data:')&&!slide.image.startsWith('data:image/')))throw Error('Imagen de diapositiva no válida.');
  if(slide.image?.startsWith('data:'))images+=slide.image.length;
 }
 if(images>8_000_000)throw Error('Las imágenes del contexto superan 8 MB. Utiliza imágenes más pequeñas o una URL.');
}
export function contextReady(module:ContextModule){return !!module.title.trim()&&contextSlides(module).length>0&&contextSlides(module).every(slide=>!!slide.text.trim());}
/** Completing the context is allowed only after advancing from the final slide. */
export function advanceContextSlide(index:number,total:number){return index<total-1?{index:index+1,completed:false}:{index,completed:true};}
