// Local media adapter: browser playback uses the configured URL, without RoutingTales APIs.
/** @param {string} url */
export function getPlayableMediaUrl(url){return typeof url==='string'?url.trim():'';}
export const rewriteToCanonicalDirectMediaUrl=getPlayableMediaUrl;
export const isTrustedDirectMediaUrl=()=>false;
/** @param {string} value */
export function isYouTubeUrl(value){try{const h=new URL(value).hostname.toLowerCase();return ['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be'].includes(h);}catch{return false;}}
/** @param {string} value */
export function inferAudioFormat(value){if(value.startsWith('data:audio/'))return value.match(/^data:audio\/([^;]+)/)?.[1]?.replace('mpeg','mp3')??'';return String(value).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]??'';}
/** @param {string} value */
export function youTubeId(value){try{const u=new URL(value);return u.hostname==='youtu.be'?u.pathname.slice(1).split('/')[0]:u.searchParams.get('v')??u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1]??'';}catch{return '';}}
