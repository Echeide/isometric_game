import {createPlannedImageService} from './character-images';
import {validateObjectImageRequest,objectImagePlan} from '../workshop/object-generation';
export const createObjectImageService=(fetcher:typeof fetch=fetch)=>createPlannedImageService(validateObjectImageRequest,objectImagePlan,fetcher);
