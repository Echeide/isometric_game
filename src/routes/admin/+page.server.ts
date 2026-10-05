import {redirect} from '@sveltejs/kit';
export const load=({locals}:import('./$types').PageServerLoadEvent)=>{if(!locals.principal?.tenant)redirect(303,'/superadmin');};
