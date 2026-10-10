<script>
    // @ts-nocheck — adapted legacy player; typed adapter validates content.
    import {translate as translateInterface} from "$lib/i18n/messages";
    export let interfaceLocale="es";
    const ui={text:(source,locale)=>translateInterface(source,locale)};
    import { createEventDispatcher, onDestroy, tick } from "svelte";
    import { createVideoSource } from "./videoSource";
    import {
        getPlayableMediaUrl,
        isTrustedDirectMediaUrl,
        isYouTubeUrl,
        youTubeId as parseYouTubeId,
        rewriteToCanonicalDirectMediaUrl,
    } from "../shared/media";

    /** @type {any} */
    export let module;
    export let completed = false;
    export let reviewMode = false;
    export let submitting = false;
    export let currentLang = "es";
    export let contentMode = false;
    export let checkpointAttempt = null;
    export let persistedPercent = 0;
    export let persistedMediaTime = 0;

    const dispatch = createEventDispatcher();
    const VIDEO_LOAD_TIMEOUT_MS = 10_000;

    let watchPercent = persistedPercent;
    /** @type {HTMLVideoElement | null} */
    let videoElement = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    let trackingInterval = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let videoLoadTimeout = null;
    let autoCompleted = false;
    let isPlaying = false;
    let completionReady = persistedPercent >= (module.content?.requiredWatchPercent || 80);
    let useNativeControls = false;
    let usingProxyFallback = false;
    let hlsPlaybackFailed = false;
    let playbackErrorMessage = "";
    let videoFrameReady = false;
    let videoLoading = false;
    let videoLoadFailed = false;
    let videoLoadAttempt = 0;
    let playbackRequested = false;
    let skipConfirmationOpen = false;
    let disposed = false;
    // Binding updates happen on the next Svelte flush. Track the active source
    // explicitly so events/promises from a retiring element are ignored immediately.
    /** @type {WeakMap<HTMLVideoElement, string>} */
    const elementSources = new WeakMap();
    /** @type {WeakMap<HTMLVideoElement, { source: string, ready: Promise<void> }>} */
    const elementSourceReadiness = new WeakMap();
    /** @param {HTMLVideoElement | null} node */
    function isActiveVideo(node) {
        return !disposed && !!node && node === videoElement &&
            elementSources.get(node) === videoUrl;
    }
    $: replayCompleted = completed && !reviewMode;

    /** @param {any} field */
    function getLocalized(field) {
        if (!field) return "";
        if (typeof field === "object") {
            const direct =
                field[currentLang] ||
                field["es"] ||
                field["en"] ||
                Object.values(field).find(
                    (value) => typeof value === "string" && value.trim(),
                ) ||
                Object.values(field)[0] ||
                "";
            return typeof direct === "string" ? direct : "";
        }
        return field;
    }

    $: rawVideoUrl = getLocalized(
        module.content?.videoUrl || module.content?.mediaUrl,
    );
    $: directVideoUrl = rawVideoUrl
        ? rewriteToCanonicalDirectMediaUrl(rawVideoUrl)
        : "";
    $: proxiedVideoUrl = getPlayableMediaUrl(rawVideoUrl);
    $: baseVideoUrl =
        usingProxyFallback && proxiedVideoUrl
            ? proxiedVideoUrl
            : directVideoUrl || proxiedVideoUrl;
    $: hlsVideoUrl =
        !hlsPlaybackFailed && !isYouTube
            ? buildManagedHlsCandidateUrl(baseVideoUrl)
            : "";
    $: videoUrl = hlsVideoUrl || baseVideoUrl;
    $: requiredPercent = module.content?.requiredWatchPercent || 80;
    $: isYouTube =
        rawVideoUrl && isYouTubeUrl(rawVideoUrl);
    $: youTubeId = isYouTube ? parseYouTubeId(rawVideoUrl) : "";

    /** @param {HTMLVideoElement} node */
    function setInlinePlaybackAttributes(node) {
        node.setAttribute("playsinline", "");
        node.setAttribute("webkit-playsinline", "");
    }

    function handleTimeUpdate() {
        if (!videoElement || autoCompleted || replayCompleted || reviewMode)
            return;
        const duration = videoElement.duration;
        const currentTime = Number(videoElement.currentTime) || 0;
        if (duration > 0) {
            watchPercent = Math.round(
                (currentTime / duration) * 100,
            );
            checkpointAttempt?.({watchPercent: Math.max(watchPercent, persistedPercent), mediaTime: currentTime});
            if (watchPercent >= requiredPercent) {
                completionReady = true;
            }
        }
    }

    function completeVideoModule(answer = "__video_watched__") {
        if (autoCompleted || replayCompleted || reviewMode) return;
        autoCompleted = true;
        clearVideoLoadTimeout();
        dispatch("complete", {
            moduleId: module.id,
            answer,
        });
    }

    function clearVideoLoadTimeout() {
        if (videoLoadTimeout !== null) {
            clearTimeout(videoLoadTimeout);
            videoLoadTimeout = null;
        }
    }

    /** @param {string} sourceUrl */
    function armVideoLoadTimeout(sourceUrl) {
        clearVideoLoadTimeout();
        if (
            !playbackRequested ||
            videoFrameReady ||
            videoLoadFailed ||
            replayCompleted ||
            reviewMode
        ) {
            return;
        }

        videoLoading = true;
        const node = videoElement;
        videoLoadTimeout = setTimeout(() => {
            videoLoadTimeout = null;
            if (!isActiveVideo(node) || sourceUrl !== videoUrl) return;
            if (
                videoFrameReady ||
                (videoElement && videoElement.readyState >= 2)
            ) {
                markVideoFrameReady();
                return;
            }

            if (isHlsUrl(sourceUrl) && !hlsPlaybackFailed) {
                void fallbackFromHls("timeout");
                return;
            }

            markVideoLoadFailed("timeout");
        }, VIDEO_LOAD_TIMEOUT_MS);
    }

    /** @param {string} reason */
    function markVideoLoadFailed(reason) {
        clearVideoLoadTimeout();
        videoLoading = false;
        videoLoadFailed = true;
        skipConfirmationOpen = false;
        console.error("ModuleVideo exhausted playback sources:", {
            moduleId: module?.id,
            videoUrl: rawVideoUrl,
            activeVideoUrl: videoUrl,
            reason,
            lang: currentLang,
            readyState: videoElement?.readyState,
            networkState: videoElement?.networkState,
            mediaError: videoElement?.error,
        });
    }

    /** @param {string} reason */
    async function fallbackFromHls(reason) {
        if (hlsPlaybackFailed) return;
        clearVideoLoadTimeout();
        hlsPlaybackFailed = true;
        isPlaying = false;
        videoFrameReady = false;
        videoLoadFailed = false;
        playbackErrorMessage = "";
        videoLoading = playbackRequested;
        console.warn("ModuleVideo switching from HLS to original video:", {
            moduleId: module?.id,
            videoUrl: rawVideoUrl,
            reason,
        });
        await tick();
        if (playbackRequested && !videoLoadFailed) {
            await requestVideoPlayback();
        }
    }

    async function fallbackToProxy() {
        if (usingProxyFallback) return;
        clearVideoLoadTimeout();
        usingProxyFallback = true;
        isPlaying = false;
        videoFrameReady = false;
        videoLoadFailed = false;
        videoLoading = playbackRequested;
        await tick();
        if (playbackRequested && !videoLoadFailed) {
            await requestVideoPlayback();
        }
    }

    async function requestVideoPlayback() {
        const node = videoElement;
        const source = videoUrl;
        if (!node || !isActiveVideo(node)) return;
        playbackRequested = true;
        videoLoadFailed = false;
        skipConfirmationOpen = false;
        playbackErrorMessage = "";
        armVideoLoadTimeout(videoUrl);
        try {
            const sourceReadiness = elementSourceReadiness.get(node);
            if (sourceReadiness?.source === source) {
                await sourceReadiness.ready;
                // A failed HLS setup can schedule its MP4 replacement while the
                // source promise is resolving. Let that Svelte update finish
                // before deciding whether this playback request is still current.
                await tick();
            }
            if (!isActiveVideo(node) || source !== videoUrl) return;
            await node.play();
        } catch (error) {
            if (!isActiveVideo(node) || source !== videoUrl) return;
            const errorName = error instanceof Error ? error.name : "";
            if (errorName === "AbortError") return;
            useNativeControls = true;
            if (errorName === "NotAllowedError") {
                clearVideoLoadTimeout();
                videoLoading = false;
                playbackErrorMessage =
                    ui.text("Pulsa reproducir en los controles del vídeo para iniciarlo.",interfaceLocale);
            }
            console.error("ModuleVideo play error:", {
                moduleId: module?.id,
                videoUrl: rawVideoUrl,
                lang: currentLang,
                error,
                readyState: node.readyState,
                networkState: node.networkState,
                mediaError: node.error,
            });
        }
    }

    function replayVideo() {
        if (!videoElement) return;
        videoElement.currentTime = 0;
        requestVideoPlayback();
    }

    function togglePlay() {
        if (!videoElement || videoLoadFailed) return;
        if (useNativeControls) return;
        if (videoElement.paused) {
            requestVideoPlayback();
        } else {
            videoElement.pause();
        }
    }

    /** @param {Event} event */
    async function handleVideoError(event) {
        const node = event.currentTarget;
        if (!(node instanceof HTMLVideoElement) || !isActiveVideo(node) || !node.error) return;
        const failedSource = normalizeComparableMediaUrl(
            event?.currentTarget instanceof HTMLVideoElement
                ? event.currentTarget.currentSrc
                : "",
        );
        const expectedSource = normalizeComparableMediaUrl(videoUrl);
        if (
            failedSource &&
            expectedSource &&
            failedSource !== expectedSource &&
            !isHlsUrl(videoUrl)
        ) {
            return;
        }

        videoFrameReady = false;
        if (isHlsUrl(videoUrl) && !hlsPlaybackFailed) {
            await fallbackFromHls("media-error");
            return;
        }

        const canFallbackToProxy =
            !usingProxyFallback && proxiedVideoUrl && proxiedVideoUrl !== videoUrl;

        console.error("ModuleVideo load error:", {
            moduleId: module?.id,
            videoUrl: rawVideoUrl,
            activeVideoUrl: videoUrl,
            proxiedVideoUrl,
            usingProxyFallback,
            lang: currentLang,
            mediaError: videoElement?.error,
        });

        if (canFallbackToProxy) {
            await fallbackToProxy();
            return;
        }

        markVideoLoadFailed("media-error");
    }

    /** @param {Event} [event] */
    function markVideoFrameReady(event) {
        if (event && !isActiveVideo(/** @type {HTMLVideoElement} */ (event.currentTarget))) return;
        if (!videoElement || videoElement.readyState < 2) return;
        clearVideoLoadTimeout();
        videoFrameReady = true;
        videoLoading = false;
        videoLoadFailed = false;
        skipConfirmationOpen = false;
    }

    /** @param {Event} event */
    function handlePlay(event) {
        if (!isActiveVideo(/** @type {HTMLVideoElement} */ (event.currentTarget))) return;
        isPlaying = true;
        playbackErrorMessage = "";
        armVideoLoadTimeout(videoUrl);
    }

    /** @param {Event} event */
    function handlePause(event) {
        if (!isActiveVideo(/** @type {HTMLVideoElement} */ (event.currentTarget))) return;
        isPlaying = false;
    }

    /** @param {Event} event */
    function restorePosition(event){const node=event.currentTarget;if(isActiveVideo(node)&&persistedMediaTime>0&&persistedMediaTime<node.duration)node.currentTime=persistedMediaTime;}

    function handleEnded(event) {
        if (!isActiveVideo(/** @type {HTMLVideoElement} */ (event.currentTarget))) return;
        isPlaying = false;
        watchPercent = 100;
        checkpointAttempt?.({watchPercent:100,mediaTime:videoElement?.duration||0});
        completionReady = true;
    }

    /** @param {string} url */
    function normalizeComparableMediaUrl(url) {
        const value = String(url || "").trim();
        if (!value) return "";
        try {
            return new URL(
                value,
                typeof window !== "undefined" ? window.location.href : undefined,
            ).href;
        } catch {
            return value;
        }
    }

    async function retryVideoLoad() {
        if (submitting || autoCompleted) return;
        clearVideoLoadTimeout();
        isPlaying = false;
        videoFrameReady = false;
        videoLoading = true;
        videoLoadFailed = false;
        playbackRequested = false;
        skipConfirmationOpen = false;
        playbackErrorMessage = "";
        useNativeControls = false;
        usingProxyFallback = false;
        hlsPlaybackFailed = false;
        videoLoadAttempt += 1;
        await tick();
        await requestVideoPlayback();
    }

    function requestSkipVideo() {
        if (!videoLoadFailed || submitting || autoCompleted) return;
        skipConfirmationOpen = true;
    }

    function cancelSkipVideo() {
        skipConfirmationOpen = false;
    }

    function confirmSkipVideo() {
        if (!videoLoadFailed || submitting || autoCompleted) return;
        skipConfirmationOpen = false;
        completeVideoModule("__video_skipped_load_error__");
    }

    /** @param {string} url */
    function isHlsUrl(url) {
        return /\.m3u8(?:[?#]|$)/i.test(String(url || ""));
    }

    /** @param {string} url */
    function isLikelyDirectVideoUrl(url) {
        if (!url || !/^https?:\/\//i.test(url)) return false;
        if (!isTrustedDirectMediaUrl(url)) return false;
        try {
            const parsed = new URL(url);
            return /\.(mp4|m4v|mov|webm|mkv)$/i.test(parsed.pathname);
        } catch {
            return false;
        }
    }

    /** @param {string} url */
    function buildManagedHlsCandidateUrl(url) {
        if (!isLikelyDirectVideoUrl(url)) return "";
        try {
            const parsed = new URL(url);
            parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/hls/master.m3u8`;
            parsed.search = "";
            parsed.hash = "";
            return parsed.toString();
        } catch {
            return "";
        }
    }

    /** @param {HTMLVideoElement} node @param {string} sourceUrl */
    function setupVideoSource(node, sourceUrl) {
        let revision = 0;
        /** @type {ReturnType<typeof createVideoSource> | null} */
        let controller = null;

        /** @param {string} nextSourceUrl */
        function applySource(nextSourceUrl) {
            const normalizedSource = String(nextSourceUrl || "").trim();
            const sourceRevision = ++revision;

            // Retire the old controller before advertising the replacement as
            // active. Synchronous teardown events must not be attributed to it.
            elementSources.delete(node);
            elementSourceReadiness.delete(node);
            controller?.destroy();
            controller = null;

            if (disposed || !normalizedSource) return;

            elementSources.set(node, normalizedSource);
            const nextController = createVideoSource(node, normalizedSource, {
                onHlsFailure: (reason) => {
                    if (
                        !disposed &&
                        sourceRevision === revision &&
                        elementSources.get(node) === normalizedSource &&
                        normalizedSource === videoUrl
                    ) {
                        void fallbackFromHls(reason);
                    }
                },
            });
            controller = nextController;
            elementSourceReadiness.set(node, {
                source: normalizedSource,
                ready: nextController.ready,
            });
        }

        applySource(sourceUrl);
        return {
            update: applySource,
            destroy() {
                revision += 1;
                elementSources.delete(node);
                elementSourceReadiness.delete(node);
                controller?.destroy();
                controller = null;
            },
        };
    }

    onDestroy(() => {
        disposed = true;
        if (trackingInterval) clearInterval(trackingInterval);
        clearVideoLoadTimeout();
    });

    $: if (rawVideoUrl) {
        useNativeControls = false;
        usingProxyFallback = false;
        hlsPlaybackFailed = false;
        playbackErrorMessage = "";
        videoLoading = false;
        videoLoadFailed = false;
        playbackRequested = false;
        skipConfirmationOpen = false;
    }

    $: if (videoUrl) {
        videoFrameReady = false;
    }
</script>

<!-- Video Player -->
{#if isYouTube && youTubeId}
    <div class="relative w-full bg-black">
        <div class="aspect-video">
            <iframe
                src="https://www.youtube.com/embed/{youTubeId}?enablejsapi=1"
                title="Video"
                class="w-full h-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    </div>
{:else if videoUrl}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="relative w-full overflow-hidden bg-black group cursor-pointer"
        style="aspect-ratio: 3 / 4; max-height: var(--app-viewport-70, 70vh);"
        on:click={togglePlay}
    >
        {#key videoLoadAttempt}
            <!-- svelte-ignore a11y-media-has-caption -->
            <video
                bind:this={videoElement}
                class="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ease-out {videoFrameReady ||
                useNativeControls
                    ? 'opacity-100'
                    : 'opacity-0'}"
                controls={useNativeControls}
                use:setupVideoSource={videoUrl}
                use:setInlinePlaybackAttributes
                playsinline
                preload="metadata"
                on:loadedmetadata={restorePosition}
                on:loadeddata={markVideoFrameReady}
                on:canplay={markVideoFrameReady}
                on:timeupdate={handleTimeUpdate}
                on:error={handleVideoError}
                on:play={handlePlay}
                on:pause={handlePause}
                on:ended={handleEnded}
            ></video>
        {/key}

        <!-- Overlay Play Button -->
        {#if videoLoadFailed}
            <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-10 w-10 text-amber-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l5.58 9.92c.75 1.334-.213 2.981-1.742 2.981H4.42c-1.53 0-2.493-1.647-1.743-2.98l5.58-9.921zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                    />
                </svg>
                <p class="max-w-xs text-sm font-semibold">
                    {ui.text("No hemos podido cargar el vídeo en este dispositivo.",interfaceLocale)}
                </p>
            </div>
        {:else if !isPlaying && !useNativeControls}
            <div
                class="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity hover:bg-black/50"
            >
                <button
                    type="button"
                    on:click|stopPropagation={() => requestVideoPlayback()}
                    aria-label={ui.text("Reproducir vídeo",interfaceLocale)}
                    class="bg-primary/90 text-white p-4 rounded-full shadow-lg shadow-black/50 backdrop-blur-sm transform transition-transform hover:scale-110 active:scale-95"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-10 w-10 ml-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clip-rule="evenodd"
                        />
                    </svg>
                </button>
            </div>
        {/if}

        {#if videoLoading && !videoFrameReady && !videoLoadFailed}
            <div
                class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center"
            >
                <div
                    class="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
                >
                    <span
                        class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
                        aria-hidden="true"
                    ></span>
                    {ui.text("Preparando vídeo…",interfaceLocale)}
                </div>
            </div>
        {/if}
    </div>
{:else if module.content?.image}
    <div class="rt-skeleton relative w-full h-52">
        <img
            src={module.content.image}
            alt="Módulo"
            class="w-full h-full object-cover"
        />
    </div>
{/if}

<!-- Body -->
<div class="rt-readable-surface px-5 py-6 space-y-5">
    <!-- Title -->
    {#if module.content?.title}
        {@const moduleTitle = getLocalized(module.content.title)}
        {#if moduleTitle}
            <h3 class="text-xl font-bold text-[var(--rt-text-primary)] mb-2">{moduleTitle}</h3>
        {/if}
    {/if}

    <!-- Description -->
    {#if getLocalized(module.content?.content)}
        <div
            class="module-video-content rt-rich-text rt-readable-content leading-relaxed text-[15px] prose prose-sm max-w-none"
        >
            {@html getLocalized(module.content?.content)}
        </div>
    {/if}

    {#if playbackErrorMessage}
        <div role="alert" class="video-warning rounded-xl border p-3 text-sm font-medium">
            {playbackErrorMessage}
        </div>
    {/if}

    {#if videoLoadFailed && !contentMode && !replayCompleted && !reviewMode && !isYouTube}
        <div class="video-warning space-y-3 rounded-xl border p-4" aria-live="polite">
            {#if skipConfirmationOpen}
                <div class="space-y-1">
                    <p class="text-sm font-bold">{ui.text("¿Saltar el vídeo?",interfaceLocale)}</p>
                    <p class="text-sm text-[var(--rt-text-secondary)]">
                        {ui.text("El módulo se marcará como completado y continuarás con la aventura.",interfaceLocale)}
                    </p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        on:click={cancelSkipVideo}
                        disabled={submitting || autoCompleted}
                        class="video-secondary-action rounded-xl border px-3 py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-[0.98]"
                    >
                        {ui.text("Cancelar",interfaceLocale)}
                    </button>
                    <button
                        type="button"
                        on:click={confirmSkipVideo}
                        disabled={submitting || autoCompleted}
                        class="video-primary-action rounded-xl px-3 py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-[0.98]"
                    >
                        {submitting || autoCompleted ? ui.text("Continuando…",interfaceLocale) : ui.text("Sí, saltar",interfaceLocale)}
                    </button>
                </div>
            {:else}
                <p class="text-sm font-medium">
                    {ui.text("Puedes volver a intentar la carga o continuar sin reproducirlo.",interfaceLocale)}
                </p>
                <div class="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        on:click={retryVideoLoad}
                        disabled={submitting || autoCompleted}
                        class="video-primary-action rounded-xl px-3 py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-[0.98]"
                    >
                        {ui.text("Reintentar",interfaceLocale)}
                    </button>
                    <button
                        type="button"
                        on:click={requestSkipVideo}
                        disabled={submitting || autoCompleted}
                        class="video-secondary-action rounded-xl border px-3 py-3 text-sm font-bold transition-all disabled:opacity-40 active:scale-[0.98]"
                    >
                        {ui.text("Saltar",interfaceLocale)}
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Progress bar -->
    {#if !contentMode && !replayCompleted && !reviewMode && !isYouTube && !videoLoadFailed}
        <div class="space-y-3">
            <div class="flex justify-between text-xs text-[var(--rt-text-muted)]">
                <span>{ui.text("Debe visualizar al menos el",interfaceLocale)} {requiredPercent}{ui.text("% del vídeo",interfaceLocale)}</span>
                <span
                    class={watchPercent >= requiredPercent
                        ? "text-green-600 font-bold"
                        : ""}>{watchPercent}%</span
                >
            </div>
            <div class="rt-skeleton w-full h-2 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-300 {watchPercent >=
                    requiredPercent
                        ? 'bg-green-500'
                        : 'bg-primary'}"
                    style="width: {Math.min(watchPercent, 100)}%"
                ></div>
            </div>

            {#if completionReady}
                <div class="grid grid-cols-2 gap-3 pt-1">
                    <button
                        on:click={replayVideo}
                        class="py-3.5 bg-[var(--rt-surface-soft)] text-[var(--rt-text-secondary)] font-bold rounded-xl border border-[var(--rt-border-subtle)] hover:bg-[var(--rt-surface-hover)] transition-all active:scale-[0.98]"
                    >
                        {ui.text("Repetir",interfaceLocale)}
                    </button>
                    <button
                        on:click={() => completeVideoModule()}
                        disabled={submitting}
                        class="py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98]"
                    >
                        {submitting ? ui.text("Continuando...",interfaceLocale) : ui.text("Continuar",interfaceLocale)}
                    </button>
                </div>
            {/if}
        </div>
    {:else if !contentMode && isYouTube && !replayCompleted && !reviewMode}
        <!-- YouTube: manual complete since we can't track progress -->
        <button
            on:click={() =>
                dispatch("complete", {
                    moduleId: module.id,
                    answer: "__video_watched__",
                })}
            disabled={submitting}
            class="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98]"
        >
            {submitting ? "Completando..." : ui.text("He visto el vídeo",interfaceLocale)}
        </button>
    {/if}

    {#if !contentMode && replayCompleted}
        <div class="p-4 bg-green-50 rounded-xl border border-green-100">
            <p
                class="text-green-700 text-sm font-medium flex items-center gap-2"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"
                    />
                </svg>
                {ui.text("Vídeo completado. +",interfaceLocale)}{module.points} {ui.text("puntos.",interfaceLocale)}
            </p>
        </div>
    {/if}

    {#if !contentMode && reviewMode}
        <div class="rt-secondary-notice p-4 rounded-xl">
            <p class="text-sm font-medium">
                {ui.text("Vídeo disponible en modo consulta. Puedes verlo de nuevo sin puntuar.",interfaceLocale)}
            </p>
        </div>
    {/if}

</div>

<style>
    .video-warning {
        background: color-mix(in srgb, #f59e0b 10%, var(--rt-surface-card, #fff));
        border-color: color-mix(in srgb, #f59e0b 40%, var(--rt-border-subtle, #e5e7eb));
        color: var(--rt-text-primary, #111827);
    }

    .video-secondary-action {
        background: var(--rt-surface-soft, #f3f4f6);
        border-color: var(--rt-text-muted, #64748b);
        color: var(--rt-text-primary, #111827);
    }

    .video-secondary-action:hover:not(:disabled) {
        background: var(--rt-surface-hover, #f3f4f6);
    }

    .video-primary-action {
        background: var(--rt-text-primary, #111827);
        color: var(--rt-surface-card, #fff);
    }

    .video-secondary-action:focus-visible,
    .video-primary-action:focus-visible {
        outline: 2px solid var(--color-primary, #f59e0b);
        outline-offset: 2px;
    }

    .module-video-content {
        color: var(--rt-text-secondary);
    }

    .module-video-content :global(:where(p, li, span, div, blockquote, em, u, small)) {
        color: inherit !important;
    }

    .module-video-content :global(:where(h1, h2, h3, h4, h5, h6, strong)) {
        color: var(--rt-text-primary) !important;
    }

    .module-video-content :global(a) {
        color: var(--color-primary, #f59e0b) !important;
    }
</style>
