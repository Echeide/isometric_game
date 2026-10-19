// Only mounted game instances register here; server renders never retain a visitor.
let active:(()=>Promise<boolean>)|undefined;
export function registerActiveSave(flush:()=>Promise<boolean>){active=flush;return()=>{if(active===flush)active=undefined;};}
export async function flushActiveSave(){return await active?.()??true;}
