export const uiLocales=['es','en'] as const;
export type UiLocale=typeof uiLocales[number];
export const localeCookie='isometric_locale';
export function uiLocale(value:unknown):UiLocale|undefined{return value==='es'||value==='en'?value:undefined;}
/** Per-request resolution: never store a visitor's preference in server globals. */
export function requestLocale(cookie:unknown,acceptLanguage:string|null):UiLocale{
 const saved=uiLocale(cookie);if(saved)return saved;
 const preferred=(acceptLanguage??'').split(',').map((entry,index)=>{const [tag,...params]=entry.trim().split(';');const quality=params.find(p=>p.trim().startsWith('q='));return {locale:uiLocale(tag.toLowerCase().split('-')[0]),quality:quality?Number(quality.trim().slice(2)):1,index};}).filter(v=>v.locale&&Number.isFinite(v.quality)&&v.quality>0&&v.quality<=1).sort((a,b)=>b.quality-a.quality||a.index-b.index);
 return preferred[0]?.locale??'es';
}
export function languageName(locale:string){return ({es:'Español',en:'English'} as Record<string,string>)[locale]??locale;}
