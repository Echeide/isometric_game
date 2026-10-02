import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { createVideoService } from './character-videos';

export const characterVideos = createVideoService(resolve(env.CHARACTER_VIDEO_JOBS_DIR || '.character-video-jobs'));
