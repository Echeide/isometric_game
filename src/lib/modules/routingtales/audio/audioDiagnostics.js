/** @type {null | ((stage: string, flags: Record<string, boolean | number>) => void)} */
let reporter = null;

/** @param {null | ((stage: string, flags: Record<string, boolean | number>) => void)} next */
export function setAudioDiagnosticReporter(next) { reporter = next; }

/** Only fixed stage names and numeric/boolean state; never media URLs or account data.
 * @param {string} stage
 * @param {Record<string, boolean | number>} [flags]
 */
export function traceAudio(stage, flags = {}) { reporter?.(stage, flags); }
