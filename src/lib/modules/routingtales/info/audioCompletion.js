/**
 * Complete only the INFO module owning the audio that has just ended.
 * @param {() => { trackKey: string, completed: boolean, submitting: boolean, reviewMode: boolean, contentMode: boolean }} getState
 * @param {() => void} complete
 */
export function createInfoAudioCompletionHandler(getState, complete) {
    const handled = new Set();
    return (/** @type {string} */ endedTrackKey) => {
        const state = getState();
        if (!state.trackKey || endedTrackKey !== state.trackKey ||
            state.completed || state.submitting || state.reviewMode || state.contentMode ||
            handled.has(endedTrackKey)) return;
        handled.add(endedTrackKey);
        complete();
    };
}
