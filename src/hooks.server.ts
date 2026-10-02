import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { authorizeWorkshop, workshopAccessConfigured } from '$lib/server/character-access';

export const handle: Handle = async ({ event, resolve }) => {
  if (!dev && /^\/(characters|api\/characters)(\/|$)/.test(event.url.pathname)) {
    const config = { user: env.CHARACTER_WORKSHOP_USER, password: env.CHARACTER_WORKSHOP_PASSWORD, origin: env.ORIGIN };
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (!workshopAccessConfigured(config)) return new Response('El taller privado aún no está configurado en el servidor.', { status: 503, headers });
    if (!authorizeWorkshop(config, event.url, event.request.headers.get('authorization'))) return new Response('Introduce las credenciales del taller para continuar.', { status: 401, headers: { ...headers, 'WWW-Authenticate': 'Basic realm="Taller de personajes", charset="UTF-8"' } });
    event.locals.characterWorkshopAuthorized = true;
    const response = await resolve(event);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  return resolve(event);
};
