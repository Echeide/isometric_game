import {getContext} from 'svelte';
/** Optional host contract: standalone packages do not depend on application dictionaries. */
export interface InterfaceLanguage{readonly locale:string;text:(source:string,inputs?:Record<string,string|number>)=>string}
export function interfaceLanguage():InterfaceLanguage{return getContext<InterfaceLanguage>(Symbol.for('isometric.interface-language'))??{locale:'es',text:(source,inputs={})=>source.replace(/\{(\w+)\}/g,(match,key)=>String(inputs[key]??match))};}
