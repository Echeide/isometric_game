import { createHash, timingSafeEqual } from 'node:crypto';
import { allowLocalImages } from './character-images';

export interface WorkshopAccess { user?: string; password?: string; origin?: string }
export function workshopAccessConfigured(config: WorkshopAccess) {
  if (!config.user || config.user.includes(':') || !config.password || config.password.length < 10 || !config.origin) return false;
  try { const origin = new URL(config.origin); return origin.protocol === 'https:' && origin.origin === config.origin && !origin.username && !origin.password; }
  catch { return false; }
}
export function authorizeWorkshop(config: WorkshopAccess, url: URL, authorization: string | null) {
  if (!workshopAccessConfigured(config) || url.origin !== config.origin || !authorization || authorization.length > 1024 || !/^Basic [A-Za-z0-9+/]+=*$/i.test(authorization)) return false;
  const actual = Buffer.from(authorization.slice(6), 'base64');
  const expected = Buffer.from(`${config.user}:${config.password}`, 'utf8');
  const digest = (value: Uint8Array) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}
export function allowCharacterApi(dev: boolean, address: string, url: URL, origin: string | null | undefined, authenticated = false) {
  return dev ? allowLocalImages(true, address, url, origin) : authenticated && url.protocol === 'https:' && (origin === undefined || origin === url.origin);
}
