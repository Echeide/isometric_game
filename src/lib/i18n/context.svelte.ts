import {getContext,setContext} from 'svelte';
import {translate} from './messages';
import {localeCookie,uiLocale,type UiLocale} from './locale';
const key=Symbol.for('isometric.interface-language');
export function createInterfaceLanguage(initial:UiLocale='es'){
 let locale=$state<UiLocale>(initial);
 const context={get locale(){return locale;},text:(source:string,inputs:Record<string,string|number>={})=>translate(source,locale,inputs),set(value:string){const next=uiLocale(value);if(!next)return;locale=next;if(typeof document!=='undefined'){document.documentElement.lang=next;document.cookie=`${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}}};
 setContext(key,context);return context;
}
export function interfaceLanguage():ReturnType<typeof createInterfaceLanguage>{return getContext(key)??{locale:'es',text:(source:string,inputs:Record<string,string|number>={})=>translate(source,'es',inputs),set(){}};}
