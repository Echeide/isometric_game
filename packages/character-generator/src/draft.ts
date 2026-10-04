import type { GeneratorSettings, Sources } from './types';
import type { CharacterBrief } from './prompts';
import type { ArtProject } from './generation';
import type { WizardCursor } from './wizard';
export interface CharacterDraft { version: 1; savedAt: number; settings: GeneratorSettings; brief: CharacterBrief; sources: Sources; art: ArtProject; navigation: WizardCursor }
/** IndexedDB keeps binary frames intact; no data is sent to a server. */
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('character-workshop-draft',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function readDraft(): Promise<CharacterDraft | undefined> {
  const db=await database();
  try {return await new Promise((resolve,reject)=>{
    const request=db.transaction('drafts','readonly').objectStore('drafts').get('latest');
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });} finally {db.close();}
}
export async function writeDraft(draft: CharacterDraft): Promise<void> {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft,'latest');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });} finally {db.close();}
}
