/** Keep a completion handler alive independently of the module's UI.
 * @param {() => boolean} shouldComplete
 * @param {() => Promise<void>} complete
 */
export function createDetachedCompletion(shouldComplete, complete) {
    let done = false;
    let pending = false;
    return async () => {
        if (done || pending || !shouldComplete()) return;
        pending = true;
        try { await complete(); done = true; }
        finally { pending = false; }
    };
}
