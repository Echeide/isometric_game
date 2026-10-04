import { allowCharacterApi } from '$lib/server/character-access';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { imageStatus, ImageServiceError, readImageBody } from '$lib/server/character-images';
import { createObjectImageService } from '$lib/server/object-images';
const generate = createObjectImageService();
const config = () => ({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_IMAGE_MODEL });
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const GET: RequestHandler = ({ url, getClientAddress, locals }) => {
  if (!allowCharacterApi(dev, dev ? getClientAddress() : '', url, undefined, locals.characterWorkshopAuthorized)) return json({ available: false, message: 'Esta ayuda está habilitada únicamente en el taller local. El despliegue necesita autenticación del anfitrión.' }, { headers });
  return json(imageStatus(config()), { headers });
};
export const POST: RequestHandler = async ({ request, url, getClientAddress, locals }) => {
  if (!allowCharacterApi(dev, dev ? getClientAddress() : '', url, request.headers.get('origin'), locals.characterWorkshopAuthorized)) return json({ error: 'La generación solo está disponible desde el taller local.' }, { status: 403, headers });
  try { return json(await generate(await readImageBody(request), config(), request.signal), { headers }); }
  catch (error) { const known = error instanceof ImageServiceError; return json({ error: known ? error.message : 'No se pudo preparar la solicitud de imagen.' }, { status: known ? error.status : 500, headers }); }
};
