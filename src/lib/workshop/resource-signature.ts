/** JSON storage can reorder object keys; array order and values remain meaningful. */
export function resourceSignature(value:unknown):string{
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)??'null';
}
