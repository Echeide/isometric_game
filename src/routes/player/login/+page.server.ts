import {playerReturnPath} from '$lib/player/types';
export const load=({url}:import('./$types').PageServerLoadEvent)=>({next:playerReturnPath(url.searchParams.get('next')),register:url.searchParams.get('register')==='1'});
