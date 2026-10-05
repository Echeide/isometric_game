import {platform} from '$lib/server/platform/runtime';
export const load=async()=>{try{return{adventures:await platform().store.publicList(),error:''};}catch{return{adventures:[],error:'El catálogo aún no está disponible.'};}};
