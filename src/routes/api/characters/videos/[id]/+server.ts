import { allowCharacterApi } from '$lib/server/character-access';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { characterVideos } from '$lib/server/character-video-service';
import { VideoServiceError } from '$lib/server/character-videos';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const GET: RequestHandler = async ({ url, params, getClientAddress, locals }) => {
  if (!allowCharacterApi(dev, dev ? getClientAddress() : '', url, undefined, locals.characterWorkshopAuthorized)) return json({ error: 'El vídeo solo está disponible desde el taller local.' }, { status: 403, headers });
  try {
    const config = { apiKey: env.MAGNIFIC_API_KEY };
    if (url.searchParams.has('video')) return new Response(new Uint8Array(await characterVideos.video(params.id!, config)), { headers: { ...headers, 'Content-Type': 'video/mp4' } });
    return json(await characterVideos.poll(params.id!, config), { headers });
  } catch (e) { const known = e instanceof VideoServiceError; return json({ error: known ? e.message : 'No se pudo recuperar el vídeo. Puedes volver a consultar sin generar otro.' }, { status: known ? e.status : 500, headers }); }
};
