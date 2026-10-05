import {validateVideoRequest as validate} from '../../../../../packages/character-generator/src/video';
import {platform} from '$lib/server/platform/runtime';
import {PlatformError} from '$lib/server/platform/auth';
import { allowCharacterApi } from '$lib/server/character-access';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { ImageServiceError, readImageBody } from '$lib/server/character-images';
import { characterVideos } from '$lib/server/character-video-service';
import { VideoServiceError, videoStatus } from '$lib/server/character-videos';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const GET: RequestHandler = async ({ url, getClientAddress, locals }) => {
  if (!allowCharacterApi(dev, dev ? getClientAddress() : '', url, undefined, locals.characterWorkshopAuthorized)) return json({ available: false, message: 'El vídeo por API solo está disponible en el taller local.' }, { headers });
  try { return json(url.searchParams.has('jobs') ? await characterVideos(locals.principal!).list(url.searchParams.get('projectId') ?? '') : videoStatus({ apiKey: env.MAGNIFIC_API_KEY }), { headers }); }
  catch { return json({ error: 'No se pudo leer el registro local de vídeos.' }, { status: 500, headers }); }
};
export const POST: RequestHandler = async ({ request, url, getClientAddress, locals }) => {
  if (!allowCharacterApi(dev, dev ? getClientAddress() : '', url, request.headers.get('origin'), locals.characterWorkshopAuthorized)) return json({ error: 'La generación solo está disponible desde el taller local.' }, { status: 403, headers });
  try { const body=validate(await readImageBody(request));if(!env.MAGNIFIC_API_KEY?.trim())throw new PlatformError(503,'Proveedor no configurado.');await platform().store.reserve(locals.principal!,'videos');return json(await characterVideos(locals.principal!).create(body, { apiKey: env.MAGNIFIC_API_KEY }), { headers }); }
  catch (e) { const known = e instanceof PlatformError || e instanceof VideoServiceError || e instanceof ImageServiceError; return json({ error: known ? e.message : 'No se pudo preparar el vídeo. Revisa las solicitudes guardadas antes de generar otro.' }, { status: known ? e.status : 500, headers }); }
};
