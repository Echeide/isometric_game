import {createPlannedImageService} from './character-images';
import {validateTileImageRequest,tileImagePlan} from '../workshop/tile-generation';
export const createTileImageService=(fetcher:typeof fetch=fetch)=>createPlannedImageService(validateTileImageRequest,tileImagePlan,fetcher);
