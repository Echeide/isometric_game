/** Retain an observed audio end while the UI is suspended or not mounted. */
export function createAudioEndTracker(isVisible = () => true) {
    let endedTrackKey = "";
    const listeners = new Set(/** @type {Array<(trackKey: string) => void>} */ ([]));
    function flush() {
        if (!endedTrackKey || !isVisible()) return;
        for (const listener of listeners) listener(endedTrackKey);
    }
    return {
        record(/** @type {string} */ trackKey) { endedTrackKey = trackKey; flush(); },
        reset() { endedTrackKey = ""; },
        flush,
        subscribe(/** @type {(trackKey: string) => void} */ listener) {
            listeners.add(listener);
            queueMicrotask(flush);
            return () => listeners.delete(listener);
        },
    };
}
