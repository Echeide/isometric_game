import {resolve} from 'node:path';
import {env} from '$env/dynamic/private';
import {createVideoService} from './character-videos';
import {tenant} from './platform/store';
import type {Principal} from '../platform/types';
const services=new Map<string,ReturnType<typeof createVideoService>>();
export function characterVideos(p:Principal){const id=tenant(p);let service=services.get(id);if(!service){service=createVideoService(resolve(env.PLATFORM_STORAGE_DIR||'.platform-storage','videos',id));services.set(id,service);}return service;}
