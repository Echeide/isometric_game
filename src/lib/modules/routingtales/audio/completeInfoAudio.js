/** Completion goes through the owning Isometric adventure; no third-party account or API. */
/** @param {{complete?:()=>boolean|Promise<boolean>}} context */
export function createBackgroundInfoCompletion(context){return async()=>context.complete?context.complete():false;}
