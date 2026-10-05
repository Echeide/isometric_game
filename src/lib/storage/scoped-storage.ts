/** Browser drafts/progress never cross the active account or public adventure boundary. */
export function scopedStorage(source:()=>Storage,scope:()=>string):Storage {
 const prefix=()=>scope()+':';
 const keys=()=>Array.from({length:source().length},(_,i)=>source().key(i)).filter((k):k is string=>!!k&&k.startsWith(prefix()));
 return {get length(){return keys().length;},key:index=>keys()[index]?.slice(prefix().length)??null,getItem:key=>source().getItem(prefix()+key),setItem:(key,value)=>source().setItem(prefix()+key,value),removeItem:key=>source().removeItem(prefix()+key),clear:()=>keys().forEach(key=>source().removeItem(key))};
}
