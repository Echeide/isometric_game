import DOMPurify from 'dompurify';
/** Called only in the browser, before rendering copied HTML players or initializing Quill. */
export function safeModuleHtml(value:string){return DOMPurify.sanitize(value,{USE_PROFILES:{html:true},FORBID_TAGS:['style','form','input','button','iframe','video','audio'],FORBID_ATTR:['style']});}
