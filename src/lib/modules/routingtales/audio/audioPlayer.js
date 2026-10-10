// @ts-nocheck
import { browser } from "$app/environment";
import { get, writable } from "svelte/store";
import { createAudioEndTracker } from "./audioEndTracker.js";
import { traceAudio } from "./audioDiagnostics.js";

const RATE_STEPS = [1, 1.25, 1.5, 2];
const MUTED_STORAGE_KEY = "isometrico_module_audio_muted";
const RATE_STORAGE_KEY = "isometrico_module_audio_rate";
const POSITION_STORAGE_PREFIX = "isometrico_module_audio_position:";
const PROGRESS_SYNC_INTERVAL_MS = 180;
const POSITION_PERSIST_INTERVAL_MS = 1200;
const SEEK_SYNC_DELAY_MS = 80;
const SEEK_SETTLE_GRACE_MS = 1200;
const SKIP_ACTION_COOLDOWN_MS = 220;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * @param {string} key
 * @param {number} fallback
 */
function readNumberStorage(key, fallback) {
    if (!browser) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null || raw === "") return fallback;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

/**
 * @param {string} key
 * @param {number} value
 */
function writeNumberStorage(key, value) {
    if (!browser) return;
    try {
        window.localStorage.setItem(key, String(value));
    } catch {
        // Ignore storage failures in private mode.
    }
}

/**
 * @param {string} key
 * @param {boolean} fallback
 */
function readBooleanStorage(key, fallback) {
    if (!browser) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null || raw === "") return fallback;
        return raw === "true" || raw === "1";
    } catch {
        return fallback;
    }
}

/**
 * @param {string} key
 * @param {boolean} value
 */
function writeBooleanStorage(key, value) {
    if (!browser) return;
    try {
        window.localStorage.setItem(key, value ? "true" : "false");
    } catch {
        // Ignore storage failures in private mode.
    }
}

/**
 * @param {string} trackKey
 */
function readTrackPosition(trackKey) {
    if (!browser || !trackKey) return 0;
    try {
        const raw = window.sessionStorage.getItem(
            `${POSITION_STORAGE_PREFIX}${trackKey}`,
        );
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

/**
 * @param {string} trackKey
 * @param {number} position
 */
function writeTrackPosition(trackKey, position) {
    if (!browser || !trackKey) return;
    try {
        if (!Number.isFinite(position) || position <= 0) {
            window.sessionStorage.removeItem(
                `${POSITION_STORAGE_PREFIX}${trackKey}`,
            );
            return;
        }
        window.sessionStorage.setItem(
            `${POSITION_STORAGE_PREFIX}${trackKey}`,
            String(position),
        );
    } catch {
        // Ignore storage failures in private mode.
    }
}

function createDefaultState() {
    return {
        visible: false,
        minimized: false,
        inlineHostKey: "",
        inlineActive: false,
        loading: false,
        starting: false,
        ready: false,
        playing: false,
        src: "",
        title: "",
        subtitle: "",
        image: "",
        trackKey: "",
        endedTrackKey: "",
        currentTime: 0,
        duration: 0,
        volume: 1,
        muted: readBooleanStorage(MUTED_STORAGE_KEY, false),
        rate: RATE_STEPS.includes(readNumberStorage(RATE_STORAGE_KEY, 1))
            ? readNumberStorage(RATE_STORAGE_KEY, 1)
            : 1,
        error: "",
    };
}

function createAudioPlayerStore() {
    const store = writable(createDefaultState());
    const { subscribe, update, set } = store;
    const endTracker = createAudioEndTracker(() => browser && document.visibilityState === "visible");

    /** @param {(trackKey: string) => void} listener */
    function onEnded(listener) {
        return endTracker.subscribe(listener);
    }

    /** @type {any} */
    let HowlCtor = null;
    /** @type {any} */
    let sound = null;
    let progressFrame = 0;
    let seekSyncTimer = 0;
    let activeTrackKey = "";
    let lastUiSyncAt = 0;
    let lastPositionPersistAt = 0;
    let loadSequence = 0;
    /** @type {number | null} */
    let pendingSeekTime = null;
    let pendingSeekStartedAt = 0;
    let lastSkipActionAt = 0;
    let removeNativeEndListener = () => {};
    let removeTrackCompletion = () => {};

    function reconcilePlayback() {
        if (!browser || document.visibilityState !== "visible") return;
        // HTML5 media may finish while WebKit suspends the JS callback.
        // Never infer completion from wall-clock time or a paused position.
        const node = sound?._sounds?.[0]?._node;
        if (node?.ended === true && activeTrackKey) {
            update((current) => ({ ...current, playing: false, starting: false, currentTime: current.duration, endedTrackKey: activeTrackKey }));
            endTracker.record(activeTrackKey);
        }
        endTracker.flush();
    }
    if (browser) document.addEventListener("visibilitychange", reconcilePlayback);

    function getNowMs() {
        return browser && typeof performance !== "undefined"
            ? performance.now()
            : Date.now();
    }

    /** @param {number} target */
    function setPendingSeek(target) {
        pendingSeekTime = target;
        pendingSeekStartedAt = getNowMs();
    }

    function clearPendingSeek() {
        pendingSeekTime = null;
        pendingSeekStartedAt = 0;
    }

    function hasPendingSeek() {
        return pendingSeekTime !== null && Number.isFinite(pendingSeekTime);
    }

    function cancelProgressLoop() {
        if (!browser || !progressFrame) return;
        cancelAnimationFrame(progressFrame);
        progressFrame = 0;
    }

    function cancelSeekSyncTimer() {
        if (!browser || !seekSyncTimer) return;
        clearTimeout(seekSyncTimer);
        seekSyncTimer = 0;
    }

    /**
     * @param {{ force?: boolean, persist?: boolean }} [options]
     */
    function syncProgress(options = {}) {
        if (!sound) return;
        const { force = false, persist = true } = options;
        const now = getNowMs();
        const duration = Number(sound.duration?.() || 0);
        const rawCurrentTime = Number(sound.seek?.() || 0);
        let currentTime = Number.isFinite(rawCurrentTime) ? rawCurrentTime : 0;
        if (hasPendingSeek()) {
            const target = Number(pendingSeekTime);
            const actualCaughtUp =
                Number.isFinite(rawCurrentTime) &&
                Math.abs(rawCurrentTime - target) <= 0.35;
            const stillSettling =
                now - pendingSeekStartedAt <= SEEK_SETTLE_GRACE_MS;

            if (actualCaughtUp) {
                clearPendingSeek();
                currentTime = rawCurrentTime;
            } else if (stillSettling) {
                currentTime = target;
            } else {
                clearPendingSeek();
            }
        }

        if (force || now - lastUiSyncAt >= PROGRESS_SYNC_INTERVAL_MS) {
            update((state) => ({
                ...state,
                duration: Number.isFinite(duration) ? duration : 0,
                currentTime: Number.isFinite(currentTime) ? currentTime : 0,
            }));
            lastUiSyncAt = now;
        }

        if (
            persist &&
            activeTrackKey &&
            Number.isFinite(duration) &&
            duration > 0 &&
            Number.isFinite(currentTime) &&
            (force || now - lastPositionPersistAt >= POSITION_PERSIST_INTERVAL_MS)
        ) {
            writeTrackPosition(
                activeTrackKey,
                currentTime >= duration - 0.75 ? 0 : currentTime,
            );
            lastPositionPersistAt = now;
        }
    }

    function startProgressLoop() {
        cancelProgressLoop();
        if (!browser) return;

        const tick = () => {
            if (!sound) {
                cancelProgressLoop();
                return;
            }

            const state = get(store);
            syncProgress();

            if (state.playing) {
                progressFrame = requestAnimationFrame(tick);
            } else {
                cancelProgressLoop();
            }
        };

        progressFrame = requestAnimationFrame(tick);
    }

    function destroySound() {
        removeTrackCompletion();
        removeTrackCompletion = () => {};
        removeNativeEndListener();
        removeNativeEndListener = () => {};
        cancelProgressLoop();
        cancelSeekSyncTimer();
        if (!sound) return;
        try {
            sound.off();
            sound.unload();
        } catch {
            // Ignore teardown edge-cases from underlying media element.
        }
        sound = null;
        activeTrackKey = "";
        clearPendingSeek();
        lastSkipActionAt = 0;
        lastUiSyncAt = 0;
        lastPositionPersistAt = 0;
    }

    async function ensureHowler() {
        if (!browser) return null;
        if (HowlCtor) return HowlCtor;
        const mod = await import("howler");
        HowlCtor = mod.Howl;
        return HowlCtor;
    }

    /**
     * @param {{
     *   id?: string,
     *   src: string,
     *   format?: string,
     *   title?: string,
     *   subtitle?: string,
     *   image?: string,
     *   autoplay?: boolean
     *   onEnded?: () => void
     * }} track
     */
    async function loadTrack({
        id,
        src,
        format = "",
        title = "",
        subtitle = "",
        image = "",
        autoplay = true,
        onEnded: completeTrack,
    }) {
        if (!browser || !src) return;

        const normalizedSrc = String(src).trim();
        if (!normalizedSrc) return;

        const trackKey = String(id || normalizedSrc);
        const state = get(store);
        const normalizedFormat = String(format || "").trim().toLowerCase();

        if (sound && state.src === normalizedSrc && state.trackKey === trackKey) {
            removeTrackCompletion();
            removeTrackCompletion = completeTrack ? endTracker.subscribe(key => { if(key===trackKey)completeTrack(); }) : () => {};
            update((current) => ({
                ...current,
                visible: true,
                minimized: false,
                inlineActive: current.inlineHostKey === trackKey,
                title: title || current.title,
                subtitle: subtitle || current.subtitle,
                image: image || current.image,
                trackKey,
                error: "",
            }));
            activeTrackKey = trackKey;

            if (autoplay && !state.playing && !state.starting && !state.loading) {
                update((current) => ({
                    ...current,
                    starting: true,
                }));
                try {
                    sound.play();
                } catch (error) {
                    update((current) => ({
                        ...current,
                        starting: false,
                        error: "No se pudo reanudar el audio.",
                    }));
                }
            }
            return;
        }

        const requestId = ++loadSequence;
        const Howl = await ensureHowler();
        if (requestId !== loadSequence) return;
        if (!Howl) return;

        destroySound();
        endTracker.reset();
        activeTrackKey = trackKey;
        removeTrackCompletion = completeTrack ? endTracker.subscribe(key => { if(key===trackKey)completeTrack(); }) : () => {};

        update((current) => ({
            ...current,
            visible: true,
            minimized: false,
            inlineActive: current.inlineHostKey === trackKey,
            loading: true,
            starting: false,
            ready: false,
            playing: false,
            src: normalizedSrc,
            title,
            subtitle,
            image,
            trackKey,
            currentTime: 0,
            endedTrackKey: "",
            duration: 0,
            error: "",
        }));

        const finishTrack = () => {
            traceAudio('media_end', { currentSound: sound === nextSound, currentRequest: requestId === loadSequence });
            if (sound !== nextSound || requestId !== loadSequence) return;
            clearPendingSeek();
            update((current) => ({ ...current, starting: false, playing: false, currentTime: current.duration, endedTrackKey: trackKey }));
            writeTrackPosition(trackKey, 0);
            cancelProgressLoop();
            endTracker.record(trackKey);
        };
        const nextSound = new Howl({
            src: [normalizedSrc],
            ...(normalizedFormat ? { format: [normalizedFormat] } : {}),
            html5: true,
            preload: true,
            volume: 1,
            rate: state.rate,
            onload: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                // Capture the actual HTML5 end before Howler resets the node to 0.
                // The library callback remains a fallback for other playback paths.
                const node = nextSound._sounds?.[0]?._node;
                if (node?.addEventListener) {
                    removeNativeEndListener();
                    node.addEventListener("ended", finishTrack, true);
                    removeNativeEndListener = () => node.removeEventListener("ended", finishTrack, true);
                }

                const duration = Number(nextSound.duration?.() || 0);
                const savedPosition = readTrackPosition(trackKey);

                if (
                    Number.isFinite(savedPosition) &&
                    savedPosition > 0 &&
                    Number.isFinite(duration) &&
                    savedPosition < Math.max(duration - 1, 0.5)
                ) {
                    try {
                        nextSound.seek(savedPosition);
                    } catch {
                        // Ignore seek issues on partially buffered audio.
                    }
                }

                update((current) => ({
                    ...current,
                    loading: false,
                    ready: true,
                    duration: Number.isFinite(duration) ? duration : 0,
                    currentTime: Number(nextSound.seek?.() || 0),
                }));

                if (autoplay) {
                    update((current) => ({
                        ...current,
                        starting: true,
                    }));
                    try {
                        nextSound.play();
                    } catch {
                        update((current) => ({
                            ...current,
                            starting: false,
                            error: "No se pudo iniciar el audio.",
                        }));
                    }
                }
            },
            onplay: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                endTracker.reset();
                update((current) => ({
                    ...current,
                    endedTrackKey: "",
                    loading: false,
                    starting: false,
                    ready: true,
                    playing: true,
                    error: "",
                }));
                syncProgress({ force: true });
                startProgressLoop();
            },
            onpause: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                update((current) => ({
                    ...current,
                    starting: false,
                    playing: false,
                }));
                syncProgress({ force: true });
                cancelProgressLoop();
            },
            onstop: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                update((current) => ({
                    ...current,
                    starting: false,
                    playing: false,
                }));
                syncProgress({ force: true });
                cancelProgressLoop();
            },
            onend: finishTrack,
            onseek: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                syncProgress({ force: true });
            },
            onloaderror: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                update((current) => ({
                    ...current,
                    loading: false,
                    starting: false,
                    ready: false,
                    playing: false,
                    error: "No se pudo cargar el audio.",
                }));
            },
            onplayerror: () => {
                if (sound !== nextSound || requestId !== loadSequence) return;
                update((current) => ({
                    ...current,
                    loading: false,
                    starting: false,
                    playing: false,
                    error: "Tu navegador bloqueó la reproducción automática.",
                }));
            },
        });

        sound = nextSound;
        sound.mute(state.muted);

        if (!autoplay) {
            update((current) => ({
                ...current,
                loading: false,
            }));
        }
    }

    function play() {
        const state = get(store);
        if (!sound || state.loading || state.playing || state.starting) return;
        update((current) => ({
            ...current,
            starting: true,
        }));
        try {
            sound.play();
        } catch {
            update((current) => ({
                ...current,
                starting: false,
                error: "No se pudo reproducir el audio.",
            }));
        }
    }

    function pause() {
        const state = get(store);
        if (!sound || state.loading || state.starting || !state.playing) return;
        sound.pause();
    }

    function toggle() {
        const state = get(store);
        if (!sound) return;
        if (state.loading || state.starting) return;
        if (state.playing) {
            pause();
        } else {
            play();
        }
    }

    /**
     * @param {number | string} nextTime
     */
    function seekTo(nextTime) {
        const state = get(store);
        if (!sound || !state.ready || state.loading) return;
        const duration = Number(sound.duration?.() || state.duration || 0);
        if (!Number.isFinite(duration) || duration <= 0) return;

        const target = clamp(Number(nextTime) || 0, 0, duration);
        setPendingSeek(target);
        update((current) => ({
            ...current,
            duration,
            currentTime: target,
        }));
        if (activeTrackKey) {
            writeTrackPosition(
                activeTrackKey,
                target >= duration - 0.75 ? 0 : target,
            );
        }

        try {
            sound.seek(target);
            cancelSeekSyncTimer();
            if (browser) {
                seekSyncTimer = window.setTimeout(() => {
                    seekSyncTimer = 0;
                    syncProgress({ force: true });
                }, SEEK_SYNC_DELAY_MS);
            } else {
                syncProgress({ force: true });
            }
        } catch {
            clearPendingSeek();
            // Ignore invalid seek attempts.
        }
    }

    /**
     * @param {number} deltaSeconds
     */
    function skipBy(deltaSeconds) {
        const state = get(store);
        if (!sound || !state.ready || state.loading) return;
        const now = getNowMs();
        if (now - lastSkipActionAt < SKIP_ACTION_COOLDOWN_MS) return;
        lastSkipActionAt = now;

        let currentTime = hasPendingSeek() ? Number(pendingSeekTime) : NaN;
        if (!Number.isFinite(currentTime)) {
            currentTime = Number(state.currentTime);
        }
        if (!Number.isFinite(currentTime)) {
            try {
                currentTime = Number(sound.seek?.());
            } catch {
                currentTime = 0;
            }
        }
        if (!Number.isFinite(currentTime)) currentTime = Number(state.currentTime || 0);

        seekTo(currentTime + Number(deltaSeconds || 0));
    }

    /**
     * @param {boolean} nextMuted
     */
    function setMuted(nextMuted) {
        const currentState = get(store);
        if (currentState.loading) return;
        const muted = !!nextMuted;
        writeBooleanStorage(MUTED_STORAGE_KEY, muted);
        update((state) => ({
            ...state,
            volume: 1,
            muted,
        }));
        if (sound) {
            sound.volume(1);
            sound.mute(muted);
        }
    }

    function toggleMuted() {
        const { muted } = get(store);
        setMuted(!muted);
    }

    /**
     * @param {number | string} nextRate
     */
    function setRate(nextRate) {
        const currentState = get(store);
        if (currentState.loading) return;
        const rate = RATE_STEPS.includes(Number(nextRate))
            ? Number(nextRate)
            : 1;
        writeNumberStorage(RATE_STORAGE_KEY, rate);
        update((state) => ({
            ...state,
            rate,
        }));
        if (sound) {
            sound.rate(rate);
        }
    }

    function cycleRate() {
        const { loading, rate } = get(store);
        if (loading) return;
        const currentIndex = RATE_STEPS.findIndex((step) => step === rate);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % RATE_STEPS.length : 0;
        setRate(RATE_STEPS[nextIndex]);
    }

    function close() {
        destroySound();
        endTracker.reset();
        set(createDefaultState());
    }

    /** Do not dismiss a different track started while completion was saving.
     * @param {string} trackKey
     */
    function closeCompletedTrack(trackKey) {
        const state = get(store);
        if (state.trackKey === trackKey && state.endedTrackKey === trackKey && !state.playing) close();
    }

    /**
     * @param {string} trackKey
     */
    function setInlineHost(trackKey) {
        const normalizedTrackKey = String(trackKey || "").trim();
        update((state) => ({
            ...state,
            inlineHostKey: normalizedTrackKey,
            inlineActive:
                !!normalizedTrackKey && state.trackKey === normalizedTrackKey,
        }));
    }

    /**
     * @param {string} [trackKey]
     */
    function clearInlineHost(trackKey = "") {
        const normalizedTrackKey = String(trackKey || "").trim();
        update((state) => {
            if (
                normalizedTrackKey &&
                state.inlineHostKey &&
                state.inlineHostKey !== normalizedTrackKey
            ) {
                return state;
            }

            return {
                ...state,
                inlineHostKey: "",
                inlineActive: false,
            };
        });
    }

    function minimize() {
        const state = get(store);
        if (!state.src && !state.trackKey) return;
        update((current) => ({
            ...current,
            visible: false,
            minimized: true,
        }));
    }

    function restore() {
        const state = get(store);
        if (!state.src && !state.trackKey) return;
        update((current) => ({
            ...current,
            visible: true,
            minimized: false,
        }));
    }

    return {
        subscribe,
        onEnded,
        reconcilePlayback,
        loadTrack,
        play,
        pause,
        toggle,
        seekTo,
        skipBy,
        setMuted,
        toggleMuted,
        setRate,
        cycleRate,
        minimize,
        restore,
        close,
        closeCompletedTrack,
        setInlineHost,
        clearInlineHost,
    };
}

export const audioPlayer = createAudioPlayerStore();
