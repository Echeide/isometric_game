import { imagePlan, pngData, validateImageRequest, type ImageResult } from '../../../packages/character-generator/src/generation';

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-sunburst';
const MODELS = new Set([DEFAULT_IMAGE_MODEL, 'gpt-image-2.5-flare', 'gpt-image-2']);
export class ImageServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface ImageConfig { apiKey?: string; model?: string }
export function imageStatus(config: ImageConfig) {
  const model = config.model?.trim() || DEFAULT_IMAGE_MODEL;
  return { available: !!config.apiKey?.trim() && MODELS.has(model), model,
    message: !config.apiKey?.trim() ? 'Para activar esta ayuda, configura OPENAI_API_KEY en el archivo .env del servidor y reinicia la aplicación.' : !MODELS.has(model) ? 'OPENAI_IMAGE_MODEL debe ser gpt-image-2.5-sunburst, gpt-image-2.5-flare o gpt-image-2.' : 'API configurada. Cada generación utiliza tu cuenta de OpenAI.' };
}
/** This demo has no accounts: keep the paid endpoint in local development only. */
export function allowLocalImages(dev: boolean, address: string, url: URL, origin?: string | null) {
  const host = url.hostname;
  return dev && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) && ['localhost', '127.0.0.1', '[::1]'].includes(host) && (origin === undefined || origin === url.origin);
}
export async function readImageBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ImageServiceError(415, 'Envía una solicitud JSON.');
  const max = 2_800_000;
  if (Number(request.headers.get('content-length')) > max || !request.body) throw new ImageServiceError(413, 'La solicitud de imagen es demasiado grande.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > max) { await reader.cancel(); throw new ImageServiceError(413, 'La solicitud de imagen es demasiado grande.'); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ImageServiceError(400, 'JSON no válido.'); }
}
export function createImageService(fetcher: typeof fetch = fetch) {
  let running = false;
  return async (value: unknown, config: ImageConfig, signal?: AbortSignal): Promise<ImageResult> => {
    if (!imageStatus(config).available) throw new ImageServiceError(503, imageStatus(config).message);
    let request;
    try { request = validateImageRequest(value); } catch (e) { throw new ImageServiceError(400, (e as Error).message); }
    if (running) throw new ImageServiceError(429, 'Hay una generación en curso. Espera a que termine.');
    const plan = imagePlan(request), model = imageStatus(config).model;
    const fields = { model, prompt: plan.prompt, n: 1, size: plan.size, quality: request.quality, background: 'opaque', output_format: 'png' };
    let body: BodyInit, endpoint: string;
    const headers: Record<string, string> = { Authorization: `Bearer ${config.apiKey!.trim()}` };
    if (request.reference) {
      endpoint = 'edits'; const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
      form.append('image[]', new Blob([new Uint8Array(pngData(request.reference))], { type: 'image/png' }), 'reference.png');
      body = form;
    } else { endpoint = 'generations'; headers['Content-Type'] = 'application/json'; body = JSON.stringify(fields); }
    running = true;
    const timeout = AbortSignal.timeout(180_000);
    try {
      const response = await fetcher(`https://api.openai.com/v1/images/${endpoint}`, { method: 'POST', headers, body, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!response.ok) {
        await response.body?.cancel();
        const message = response.status === 401 ? 'OpenAI no acepta la clave configurada. Revísala en el servidor.'
          : response.status === 403 ? 'La cuenta no tiene acceso al modelo de imágenes. Revisa sus permisos y la verificación de la organización.'
          : response.status === 429 ? 'OpenAI ha alcanzado el límite de uso o saldo. Revisa tu cuenta antes de intentarlo de nuevo.'
          : response.status === 400 ? 'OpenAI no pudo aceptar la solicitud. Revisa la descripción y las condiciones del modelo.'
          : 'OpenAI no pudo completar la imagen. No se ha reintentado automáticamente.';
        throw new ImageServiceError(response.status === 429 ? 429 : 502, message);
      }
      const result = await response.json();
      const encoded = result?.data?.[0]?.b64_json;
      if (typeof encoded !== 'string' || encoded.length > 28_000_000) throw new ImageServiceError(502, 'OpenAI no devolvió una imagen PNG válida.');
      const image = `data:image/png;base64,${encoded}`;
      try { pngData(image, 20_000_000); } catch { throw new ImageServiceError(502, 'OpenAI devolvió una imagen con formato o dimensiones no válidos.'); }
      return { image, model, prompt: plan.prompt, columns: plan.columns, rows: plan.rows, frames: plan.frames };
    } catch (error) {
      if (error instanceof ImageServiceError) throw error;
      if (timeout.aborted || signal?.aborted) throw new ImageServiceError(504, 'La generación se interrumpió o tardó demasiado. OpenAI podría haber procesado la solicitud; no se reintenta automáticamente.');
      throw new ImageServiceError(502, 'No se pudo conectar con OpenAI. Comprueba la conexión del servidor.');
    } finally { running = false; }
  };
}
