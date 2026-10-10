import {writable} from 'svelte/store';
export const notices=writable(/** @type {string[]} */([]));
/** @param {string} message */
function reportError(message){notices.update(v=>[...v,String(message)].slice(-3));}
export const toast={error:reportError,clear(){notices.set([]);}};
