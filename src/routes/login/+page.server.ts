import {playerReturnPath} from '$lib/player/types';
export const load=({url}:import('./$types').PageServerLoadEvent)=>({next:url.searchParams.has('next')?playerReturnPath(url.searchParams.get('next')):'/admin'});
