<script>
    // @ts-nocheck — adapted legacy player; typed adapter validates content.
    import {translate as translateInterface} from "$lib/i18n/messages";
    export let interfaceLocale="es";
    const ui={text:(source,locale)=>translateInterface(source,locale)};
    import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
    import FadeImage from "../shared/FadeImage.svelte";
    import InteractiveImageReveal from "../shared/InteractiveImageReveal.svelte";
    import { audioPlayer } from "../audio/audioPlayer";
    import { createInfoAudioCompletionHandler } from "./audioCompletion.js";
    import { traceAudio } from "../audio/audioDiagnostics.js";
    import { createDetachedCompletion } from "../audio/detachedCompletion.js";
    import { createBackgroundInfoCompletion } from "../audio/completeInfoAudio.js";
    import { toast } from "../shared/toast";
    import {
        getPlayableMediaUrl,
        inferAudioFormat,
        isYouTubeUrl,
        youTubeId as parseYouTubeId,
    } from "../shared/media";
    import {
        EXTENDED_IMAGE_INTERACTION_MODES,
        normalizeImageInteractionConfig,
        normalizeImageInteractionMode,
        parseAspectRatio,
    } from "../shared/imageInteraction";

    /** @type {any} */
    export let module;
    export let playerAlias = "";
    export let completed = false;
    export let reviewMode = false;
    export let submitting = false;
    export let currentLang = "es";
    export let contentMode = false;
    /** @type {null | {objectiveId:string,lang:string,sideQuestScope:boolean}} */
    export let audioCompletionContext = null;
    let infoMounted = false;
    onMount(() => { infoMounted = true; return () => { infoMounted = false; }; });

    const dispatch = createEventDispatcher();
    /** @type {string | null} */
    let naturalImageAspectRatio = null;

    /** @param {any} value */
    function interpolateInfoText(value) {
        const text = String(value ?? "");
        const alias = String(playerAlias || "").trim();
        if (!text || !alias) return text;
        return text.replace(/\[alias\]/gi, alias);
    }

    /** @param {any} field */
    function getLocalized(field) {
        if (!field) return "";
        if (typeof field === "object")
            return interpolateInfoText(
                field[currentLang] ||
                field["es"] ||
                Object.values(field)[0] ||
                ""
            );
        return interpolateInfoText(field);
    }

    /** @param {any} content */
    function getModuleContentBody(content) {
        if (!content) return "";
        const nestedContent =
            getLocalized(content?.content) || getLocalized(content?.description);
        if (nestedContent) return nestedContent;
        return getLocalized(content);
    }

    /** @param {any} mediaUrl @param {string} lang */
    function getLocalizedMedia(mediaUrl, lang) {
        if (!mediaUrl) return "";
        if (typeof mediaUrl === "string") return mediaUrl;
        if (typeof mediaUrl === "object") {
            const langVal = mediaUrl[lang];
            if (typeof langVal === "string" && langVal) return langVal;
            const fallback = Object.values(mediaUrl).find(
                (v) => typeof v === "string" && v,
            );
            return fallback || "";
        }
        return "";
    }

    /** @param {string} value */
    function stripHtml(value) {
        return String(value || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\s+/g, " ")
            .trim();
    }

    /** @param {string} value @param {number} maxLength */
    function truncateText(value, maxLength = 72) {
        const text = String(value || "").trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength).trim()}...`;
    }

    /** @param {string} title @param {string} content */
    function buildModuleSubtitle(title, content) {
        const safeTitle = String(title || "").trim().toLowerCase();
        let summary = truncateText(stripHtml(content), 72);

        if (!summary) return "";

        if (safeTitle && summary.toLowerCase() === safeTitle) {
            return "";
        }

        if (safeTitle && summary.toLowerCase().startsWith(safeTitle)) {
            summary = summary.slice(String(title || "").trim().length).replace(
                /^[:\-.\s]+/,
                "",
            );
        }

        return summary.trim();
    }

    $: rawMediaUrl = String(
        getLocalizedMedia(module.content?.mediaUrl, currentLang) || "",
    );
    $: mediaUrl = getPlayableMediaUrl(rawMediaUrl);
    $: isVideo = rawMediaUrl && rawMediaUrl.match(/\.(mp4|webm|mov|m4v)(\?|#|$)/i);
    $: isAudio =
        rawMediaUrl && rawMediaUrl.match(/\.(mp3|wav|ogg|oga|m4a|aac|opus|weba)(\?|#|$)/i);
    $: isYouTube =
        rawMediaUrl && isYouTubeUrl(rawMediaUrl);
    $: youTubeId = isYouTube ? parseYouTubeId(rawMediaUrl) : "";
    $: rawAudioUrl = String(
        getLocalizedMedia(module.content?.audio, currentLang) || "",
    );
    $: audioUrl = getPlayableMediaUrl(rawAudioUrl);
    $: resolvedAudioUrl = isAudio ? mediaUrl : rawAudioUrl ? audioUrl : "";
    $: resolvedAudioFormat = (() => {
        if (isAudio) return inferAudioFormat(rawMediaUrl);
        return inferAudioFormat(rawAudioUrl);
    })();
    $: configuredImageAspectRatio = parseAspectRatio(
        module?.content?.imageAspectRatio || module?.imageAspectRatio,
        "",
    );
    $: imageAspectRatio = configuredImageAspectRatio || naturalImageAspectRatio;
    $: interactiveImageAspectRatio = imageAspectRatio || "16 / 9";
    $: imageInteractionMode = (() => {
        const raw = normalizeImageInteractionMode(
            module?.content?.imageInteractionMode,
            EXTENDED_IMAGE_INTERACTION_MODES,
        );
        if (raw !== "NONE") return raw;
        return module?.content?.interactiveReveal === true ? "TORCH" : "NONE";
    })();
    $: imageInteractionConfig = normalizeImageInteractionConfig({
        torchRadius: module?.content?.torchRadius,
        magnifierZoom: module?.content?.magnifierZoom,
        magnifierRadius: module?.content?.magnifierRadius,
        xrayRadius: module?.content?.xrayRadius,
        scratchRadius: module?.content?.scratchRadius,
    });
    $: xrayImage = String(module?.content?.xrayImage || "").trim();
    $: usesInteractiveImage =
        imageInteractionMode === "TORCH" ||
        imageInteractionMode === "MAGNIFIER" ||
        (["XRAY", "SCRATCH", "SLIDER"].includes(imageInteractionMode) &&
            !!xrayImage);
    $: moduleContent = getModuleContentBody(module.content);
    $: moduleTitle = getLocalized(module.content?.title) || ui.text("Audio del módulo",interfaceLocale);
    $: moduleSubtitle = buildModuleSubtitle(moduleTitle, moduleContent);
    $: activeAudioMatches = !!resolvedAudioUrl &&
        $audioPlayer.src === resolvedAudioUrl &&
        $audioPlayer.trackKey === inlineAudioTrackKey;
    $: inlineAudioTrackKey = resolvedAudioUrl
        ? `info:${module.id}:${resolvedAudioUrl}`
        : "";
    $: inlineAudioOwnsPlayer =
        !!inlineAudioTrackKey && $audioPlayer.trackKey === inlineAudioTrackKey;
    $: inlineAudioBusy =
        activeAudioMatches && ($audioPlayer.loading || $audioPlayer.starting);
    $: inlineAudioControlsReady =
        activeAudioMatches && $audioPlayer.ready && !inlineAudioBusy;
    $: inlineAudioGlobalBusy =
        $audioPlayer.loading || $audioPlayer.starting || audioToggleInFlight;

    /** @type {HTMLVideoElement | null} */
    let videoElement = null;
    /** @type {HTMLDivElement | null} */
    let inlineAudioWrapper = null;
    /** @type {HTMLDivElement | null} */
    let inlineAudioCard = null;
    /** @type {HTMLElement | Window | null} */
    let stickyScrollContainer = null;
    let isPlaying = false;
    let audioToggleInFlight = false;
    let inlineAudioIsSticky = false;
    let inlineAudioFixedTop = 0;
    let inlineAudioFixedLeft = 0;
    let inlineAudioFixedWidth = 0;
    let inlineAudioFixedStartTop = 0;
    let inlineAudioFixedStartScrollTop = 0;
    let inlineAudioHeight = 0;
    let inlineAudioLayoutFrame = 0;
    let inlineAudioLayoutRefreshKey = "";
    let inlineAudioStickyDispatchKey = "";
    /** @type {ResizeObserver | null} */
    let inlineAudioResizeObserver = null;
    let maxAudioListenPercent = 0;
    let maxVideoWatchPercent = 0;
    $: inlineAudioWrapperStyle =
        inlineAudioIsSticky && inlineAudioHeight > 0
            ? `top: 0; min-height: ${inlineAudioHeight}px;`
            : "top: 0;";
    $: inlineAudioFixedStyle = inlineAudioIsSticky
        ? `top: ${inlineAudioFixedTop}px; left: ${inlineAudioFixedLeft}px; width: ${inlineAudioFixedWidth}px;`
        : "";
    $: {
        const nextInlineAudioStickyDispatchKey = [
            module?.id || "",
            resolvedAudioUrl || "",
            inlineAudioIsSticky ? "sticky" : "inline",
        ].join("|");

        if (
            nextInlineAudioStickyDispatchKey !== inlineAudioStickyDispatchKey
        ) {
            inlineAudioStickyDispatchKey = nextInlineAudioStickyDispatchKey;
            dispatch("audioStickyChange", {
                moduleId: module?.id || null,
                isSticky: !!resolvedAudioUrl && inlineAudioIsSticky,
            });
        }
    }

    function togglePlay() {
        if (!videoElement) return;
        if (videoElement.paused) {
            videoElement.play();
        } else {
            videoElement.pause();
        }
    }

    /** @param {Event} event */
    function handleImageLoad(event) {
        const target = /** @type {HTMLImageElement | null} */ (
            event.currentTarget instanceof HTMLImageElement
                ? event.currentTarget
                : null
        );
        const width = Number(target?.naturalWidth || 0);
        const height = Number(target?.naturalHeight || 0);
        if (width > 0 && height > 0) {
            naturalImageAspectRatio = `${width} / ${height}`;
        }
    }

    function handleVideoTimeUpdate() {
        if (!videoElement || resolvedAudioUrl || reviewMode || completed) return;
        const duration = Number(videoElement.duration) || 0;
        const currentTime = Number(videoElement.currentTime) || 0;
        if (duration <= 0) return;

        const currentPercent = Math.min((currentTime / duration) * 100, 100);
        if (currentPercent > maxVideoWatchPercent) {
            maxVideoWatchPercent = currentPercent;
        }
    }

    function handleComplete() {
        if (!canCompleteModule) return;
        dispatch("complete", { moduleId: module.id, answer: "__info_read__" });
    }

    const completeEndedAudio = createInfoAudioCompletionHandler(
        () => ({ trackKey: inlineAudioTrackKey, completed, submitting, reviewMode, contentMode }),
        () => {
            traceAudio('info_dispatch');
            maxAudioListenPercent = 100;
            dispatch("complete", { moduleId: module.id, answer: "__info_read__" });
        },
    );
    let audioCompletionVisible = false;
    onMount(() => {
        const syncVisibility = () => { audioCompletionVisible = document.visibilityState === "visible"; };
        syncVisibility();
        traceAudio('info_mount', { completed, submitting, reviewMode, contentMode, visible: audioCompletionVisible });
        document.addEventListener("visibilitychange", syncVisibility);
        return () => document.removeEventListener("visibilitychange", syncVisibility);
    });
    // Reconsider a retained end when the module mounts or finishes submitting.
    $: if ($audioPlayer.endedTrackKey) traceAudio('info_end_state', {
        matches: inlineAudioTrackKey === $audioPlayer.endedTrackKey,
        completed, submitting, reviewMode, contentMode, visible: audioCompletionVisible,
    });
    // Explicit dependencies matter: the handler reads these through a closure.
    $: if (audioCompletionVisible && inlineAudioTrackKey && !completed && !submitting && !reviewMode && !contentMode && $audioPlayer.endedTrackKey) {
        completeEndedAudio($audioPlayer.endedTrackKey);
    }
    $: if (completed && !reviewMode && inlineAudioTrackKey && $audioPlayer.trackKey === inlineAudioTrackKey) {
        audioPlayer.close();
    }

    /** @param {number} seconds */
    function formatTime(seconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;
        return `${mins}:${String(secs).padStart(2, "0")}`;
    }

    /** @param {number} rate */
    function formatRate(rate) {
        const numericRate = Number(rate) || 1;
        return Number.isInteger(numericRate)
            ? `${numericRate}x`
            : `${numericRate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
    }

    async function handleAudioToggle() {
        if (!resolvedAudioUrl) return;
        if (audioToggleInFlight || inlineAudioGlobalBusy) return;

        if (activeAudioMatches) {
            audioPlayer.toggle();
            return;
        }

        audioToggleInFlight = true;
        try {
            const playingTrackKey = inlineAudioTrackKey;
            const saveBackground = audioCompletionContext ? createBackgroundInfoCompletion({...audioCompletionContext,moduleId:module.id}) : null;
            const completeBackground = audioCompletionContext ? createDetachedCompletion(
                () => !infoMounted && !completed && !reviewMode && !contentMode,
                async () => { if (await saveBackground?.()) audioPlayer.closeCompletedTrack(playingTrackKey); },
            ) : null;
            await audioPlayer.loadTrack({
                id: inlineAudioTrackKey,
                src: resolvedAudioUrl,
                format: resolvedAudioFormat,
                title: moduleTitle,
                subtitle: moduleSubtitle,
                image: String(module.content?.image || "").trim(),
                autoplay: true,
                onEnded: completeBackground ? () => { void completeBackground().catch(error => toast.error(error.message)); } : undefined,
            });
        } finally {
            audioToggleInFlight = false;
        }
    }

    /** @param {number} deltaSeconds */
    function handleInlineSkip(deltaSeconds) {
        if (!inlineAudioControlsReady) return;
        audioPlayer.skipBy(deltaSeconds);
    }

    /** @param {HTMLElement | null} node */
    function resolveStickyScrollContainer(node) {
        if (typeof window === "undefined" || !node) return null;

        let current = node.parentElement;
        while (current) {
            const styles = window.getComputedStyle(current);
            const overflowY = styles?.overflowY || "";
            if (overflowY === "auto" || overflowY === "scroll") {
                return current;
            }
            current = current.parentElement;
        }

        return window;
    }

    function updateInlineAudioFixedMetrics() {
        if (!inlineAudioWrapper || typeof window === "undefined") return;

        const wrapperRect = inlineAudioWrapper.getBoundingClientRect();
        const cardRect = inlineAudioCard?.getBoundingClientRect?.();
        const viewportWidth = Math.round(
            window.visualViewport?.width ||
                window.innerWidth ||
                document.documentElement.clientWidth ||
                wrapperRect.width ||
                0,
        );
        let nextLeft = Math.round(wrapperRect.left || 0);
        let nextWidth = Math.round(wrapperRect.width || 0);

        if (viewportWidth > 0) {
            if (nextWidth <= 0 || nextWidth > viewportWidth) {
                nextWidth = viewportWidth;
            }
            if (nextLeft < 0 || nextLeft + nextWidth > viewportWidth + 1) {
                const maxLeft = Math.max(0, viewportWidth - nextWidth);
                nextLeft = Math.max(0, Math.min(nextLeft, maxLeft));
                nextWidth = Math.max(0, Math.min(nextWidth, viewportWidth - nextLeft));
            }
        }

        inlineAudioFixedLeft = nextLeft;
        inlineAudioFixedWidth = nextWidth;
        inlineAudioHeight = Math.round(
            cardRect?.height ||
                inlineAudioCard?.offsetHeight ||
                inlineAudioWrapper.offsetHeight ||
                0,
        );
    }

    function updateInlineAudioStickyState() {
        if (!inlineAudioWrapper || typeof window === "undefined") {
            inlineAudioIsSticky = false;
            return;
        }

        updateInlineAudioFixedMetrics();
        const wrapperRect = inlineAudioWrapper.getBoundingClientRect();
        const containerElement =
            stickyScrollContainer &&
            stickyScrollContainer !== window &&
            "getBoundingClientRect" in stickyScrollContainer
                ? stickyScrollContainer
                : null;
        const thresholdTop = containerElement
            ? containerElement.getBoundingClientRect().top
            : 0;
        const headerMainBottom = document
            .querySelector(".objective-play-header-main")
            ?.getBoundingClientRect?.().bottom;
        const headerBottom = document
            .querySelector(".safe-area-top")
            ?.getBoundingClientRect?.().bottom;
        const stickyAnchorBottom = Math.round(
            headerMainBottom ?? headerBottom ?? thresholdTop,
        );
        const progressOverlapHeight = Math.max(
            0,
            Math.round(thresholdTop - stickyAnchorBottom),
        );
        const activationTop = Math.round(thresholdTop + progressOverlapHeight);
        const scrollTop = containerElement
            ? containerElement.scrollTop
            : window.scrollY || document.documentElement.scrollTop || 0;
        const shouldStick =
            scrollTop > 1 && wrapperRect.top <= activationTop + 1;

        if (!shouldStick) {
            inlineAudioIsSticky = false;
            inlineAudioFixedStartTop = 0;
            inlineAudioFixedStartScrollTop = 0;
            return;
        }

        if (!inlineAudioIsSticky) {
            inlineAudioFixedStartTop = Math.round(wrapperRect.top);
            inlineAudioFixedStartScrollTop = scrollTop;
        }

        const scrollDelta = scrollTop - inlineAudioFixedStartScrollTop;
        inlineAudioFixedTop = Math.max(
            0,
            stickyAnchorBottom,
            Math.min(
                inlineAudioFixedStartTop,
                Math.round(inlineAudioFixedStartTop - scrollDelta),
            ),
        );
        inlineAudioIsSticky = true;
    }

    async function scheduleInlineAudioLayoutUpdate() {
        if (typeof window === "undefined") return;
        await tick();

        if (inlineAudioLayoutFrame) {
            window.cancelAnimationFrame(inlineAudioLayoutFrame);
        }

        inlineAudioLayoutFrame = window.requestAnimationFrame(() => {
            updateInlineAudioStickyState();
            inlineAudioLayoutFrame = window.requestAnimationFrame(() => {
                updateInlineAudioStickyState();
                inlineAudioLayoutFrame = 0;
            });
        });
    }

    $: {
        const nextInlineAudioLayoutRefreshKey = [
            module?.id || "",
            resolvedAudioUrl || "",
            inlineAudioWrapper ? "wrapper" : "",
            inlineAudioCard ? "card" : "",
        ].join("|");

        if (nextInlineAudioLayoutRefreshKey !== inlineAudioLayoutRefreshKey) {
            inlineAudioLayoutRefreshKey = nextInlineAudioLayoutRefreshKey;
            if (resolvedAudioUrl) {
                void scheduleInlineAudioLayoutUpdate();
            }
        }
    }

    $: {
        if (inlineAudioOwnsPlayer) {
            audioPlayer.setInlineHost(inlineAudioTrackKey);
        } else if (inlineAudioTrackKey) {
            audioPlayer.clearInlineHost(inlineAudioTrackKey);
        }
    }

    $: requiredPlaybackPercent = (() => {
        const rawValue = Number(module.content?.requiredWatchPercent);
        if (!resolvedAudioUrl && !isVideo) return 0;
        if (!Number.isFinite(rawValue)) return 80;
        return Math.min(Math.max(rawValue, 0), 100);
    })();

    $: currentAudioListenPercent =
        activeAudioMatches && Number($audioPlayer.duration || 0) > 0
            ? Math.min(
                  (Number($audioPlayer.currentTime || 0) /
                      Number($audioPlayer.duration || 0)) *
                      100,
                  100,
              )
            : 0;

    $: if (inlineAudioTrackKey) {
        if (currentAudioListenPercent > maxAudioListenPercent) {
            maxAudioListenPercent = currentAudioListenPercent;
        }
    } else if (maxAudioListenPercent !== 0) {
        maxAudioListenPercent = 0;
    }

    $: if (!isVideo && maxVideoWatchPercent !== 0) {
        maxVideoWatchPercent = 0;
    }

    $: requiredPlaybackMode = resolvedAudioUrl
        ? "audio"
        : isVideo
          ? "video"
          : "";

    $: currentPlaybackPercent =
        requiredPlaybackMode === "audio"
            ? maxAudioListenPercent
            : requiredPlaybackMode === "video"
              ? maxVideoWatchPercent
              : 0;

    $: requiresPlaybackCompletion =
        !!requiredPlaybackMode &&
        !reviewMode &&
        !completed &&
        requiredPlaybackPercent > 0;

    $: playbackCompletionReady =
        !requiresPlaybackCompletion ||
        currentPlaybackPercent >= requiredPlaybackPercent;

    $: canCompleteModule = !requiresPlaybackCompletion || playbackCompletionReady;

    $: playbackProgressLabel = `${Math.min(
        Math.round(currentPlaybackPercent),
        100,
    )}%`;

    $: playbackRequirementLabel =
        requiredPlaybackMode === "audio"
            ? ui.text("Escucha",interfaceLocale)
            : requiredPlaybackMode === "video"
              ? ui.text("Visualiza",interfaceLocale)
              : ui.text("Reproduce",interfaceLocale);

    onDestroy(() => {
        if (
            stickyScrollContainer &&
            "removeEventListener" in stickyScrollContainer
        ) {
            stickyScrollContainer.removeEventListener(
                "scroll",
                updateInlineAudioStickyState,
            );
        }
        if (inlineAudioResizeObserver) {
            inlineAudioResizeObserver.disconnect();
            inlineAudioResizeObserver = null;
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", updateInlineAudioStickyState);
            window.visualViewport?.removeEventListener(
                "resize",
                updateInlineAudioStickyState,
            );
            if (inlineAudioLayoutFrame) {
                window.cancelAnimationFrame(inlineAudioLayoutFrame);
                inlineAudioLayoutFrame = 0;
            }
        }
        const didInlineTrackEnd =
            inlineAudioOwnsPlayer &&
            $audioPlayer.trackKey === inlineAudioTrackKey &&
            Number($audioPlayer.duration || 0) > 0 &&
            Number($audioPlayer.currentTime || 0) >=
                Number($audioPlayer.duration || 0) - 0.25;
        if (didInlineTrackEnd) {
            audioPlayer.close();
            return;
        }
        if (inlineAudioTrackKey) {
            // Keep playback in the header when leaving INFO. The user can
            // explicitly restore the floating controls from there.
            if ($audioPlayer.trackKey === inlineAudioTrackKey) {
                audioPlayer.minimize();
            }
            audioPlayer.clearInlineHost(inlineAudioTrackKey);
        }
        dispatch("audioStickyChange", {
            moduleId: module?.id || null,
            isSticky: false,
        });
    });

    onMount(() => {
        stickyScrollContainer = resolveStickyScrollContainer(inlineAudioWrapper);
        if (
            stickyScrollContainer &&
            "addEventListener" in stickyScrollContainer
        ) {
            stickyScrollContainer.addEventListener(
                "scroll",
                updateInlineAudioStickyState,
                { passive: true },
            );
        }

        if (typeof window !== "undefined") {
            window.addEventListener("resize", updateInlineAudioStickyState, {
                passive: true,
            });
            window.visualViewport?.addEventListener(
                "resize",
                updateInlineAudioStickyState,
                { passive: true },
            );
        }
        if (
            typeof ResizeObserver !== "undefined" &&
            (inlineAudioCard || inlineAudioWrapper)
        ) {
            inlineAudioResizeObserver = new ResizeObserver(
                updateInlineAudioFixedMetrics,
            );
            if (inlineAudioWrapper) {
                inlineAudioResizeObserver.observe(inlineAudioWrapper);
            }
            if (inlineAudioCard) {
                inlineAudioResizeObserver.observe(inlineAudioCard);
            }
        }
        updateInlineAudioStickyState();

        return () => {
            if (
                stickyScrollContainer &&
                "removeEventListener" in stickyScrollContainer
            ) {
                stickyScrollContainer.removeEventListener(
                    "scroll",
                    updateInlineAudioStickyState,
                );
            }
            if (inlineAudioResizeObserver) {
                inlineAudioResizeObserver.disconnect();
                inlineAudioResizeObserver = null;
            }
            if (typeof window !== "undefined") {
                window.removeEventListener(
                    "resize",
                    updateInlineAudioStickyState,
                );
                window.visualViewport?.removeEventListener(
                    "resize",
                    updateInlineAudioStickyState,
                );
                if (inlineAudioLayoutFrame) {
                    window.cancelAnimationFrame(inlineAudioLayoutFrame);
                    inlineAudioLayoutFrame = 0;
                }
            }
            stickyScrollContainer = null;
        };
    });

</script>

<!-- Hero: video / image / fallback -->
{#if isVideo}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="relative w-full bg-black group cursor-pointer"
        style="min-height: 200px; max-height: var(--app-viewport-60, 60vh);"
        on:click={togglePlay}
    >
        <!-- svelte-ignore a11y-media-has-caption -->
        <video
            bind:this={videoElement}
            class="w-full h-full object-contain"
            playsinline
            preload="metadata"
            src={mediaUrl}
            on:timeupdate={handleVideoTimeUpdate}
            on:play={() => (isPlaying = true)}
            on:pause={() => (isPlaying = false)}
            on:ended={() => {
                isPlaying = false;
                maxVideoWatchPercent = 100;
            }}
        >
            <track kind="captions" />
        </video>

        <!-- Overlay Play Button -->
        {#if !isPlaying}
            <div
                class="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity hover:bg-black/50"
            >
                <button
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

        {#if module.points > 0 && !completed}
            <div
                class="rt-chip absolute top-3 right-3 z-10 backdrop-blur-sm text-content-meta font-bold text-primary px-2.5 py-1 rounded-full shadow-sm"
            >
                +{module.points} pts
            </div>
        {/if}
    </div>
{:else if module.content?.image}
    <div class="relative w-full bg-[var(--rt-surface-soft)]">
        {#if usesInteractiveImage}
            <InteractiveImageReveal {interfaceLocale}
                baseImage={module.content.image}
                overlayImage={xrayImage}
                mode={imageInteractionMode}
                config={imageInteractionConfig}
                aspectRatio={interactiveImageAspectRatio}
                fit="cover"
                alt="Módulo"
            />
        {:else}
            <div
                class="relative w-full overflow-hidden"
                style={`aspect-ratio: ${imageAspectRatio || "16 / 9"};`}
            >
                <FadeImage
                    src={module.content.image}
                    alt="Módulo"
                    loading="eager"
                    wrapperClass="w-full h-full"
                    imageClass={imageAspectRatio ? "object-cover" : "object-contain"}
                    onLoad={handleImageLoad}
                />
            </div>
        {/if}
        {#if module.points > 0 && !completed}
            <div
                class="rt-chip absolute top-3 right-3 z-10 backdrop-blur-sm text-content-meta font-bold text-primary px-2.5 py-1 rounded-full shadow-sm"
            >
                +{module.points} pts
            </div>
        {/if}
    </div>
{/if}

<!-- Audio launcher -->
{#if resolvedAudioUrl}
    <div
        bind:this={inlineAudioWrapper}
        class={`sticky w-full ${inlineAudioIsSticky ? "z-[70]" : "z-30"}`}
        style={inlineAudioWrapperStyle}
    >
        <div
            bind:this={inlineAudioCard}
            class={`inline-audio-card relative border-y rt-theme-border bg-[var(--rt-surface-panel)] rt-text-primary transition-shadow duration-200 ${
                inlineAudioIsSticky
                    ? "is-fixed"
                    : ""
            }`}
            style={inlineAudioFixedStyle}
        >
            <div class="px-4 py-4">
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        on:click={() => handleInlineSkip(-10)}
                        class="flex h-10 w-10 items-center justify-center rounded-full rt-muted-surface rt-text-secondary transition-colors hover:bg-[var(--rt-surface-hover)] disabled:opacity-40"
                        aria-label={ui.text("Retroceder 10 segundos",interfaceLocale)}
                        disabled={!inlineAudioControlsReady}
                    >
                        <span class="text-content-meta font-bold">-10</span>
                    </button>

                    <button
                        type="button"
                        on:click={handleAudioToggle}
                        class="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-[1.03] disabled:opacity-50"
                        aria-label={activeAudioMatches && $audioPlayer.playing
                            ? ui.text("Pausar audio",interfaceLocale)
                            : ui.text("Reproducir audio",interfaceLocale)}
                        disabled={inlineAudioGlobalBusy}
                    >
                        {#if activeAudioMatches && $audioPlayer.playing}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                            </svg>
                        {:else}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="ml-0.5 h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        {/if}
                    </button>

                    <button
                        type="button"
                        on:click={() => handleInlineSkip(10)}
                        class="flex h-10 w-10 items-center justify-center rounded-full rt-muted-surface rt-text-secondary transition-colors hover:bg-[var(--rt-surface-hover)] disabled:opacity-40"
                        aria-label={ui.text("Avanzar 10 segundos",interfaceLocale)}
                        disabled={!inlineAudioControlsReady}
                    >
                        <span class="text-content-meta font-bold">+10</span>
                    </button>

                    <div class="min-w-0 flex-1 px-1">
                        {#if activeAudioMatches}
                            <div class="mb-2 flex items-center justify-end">
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        on:mousedown|stopPropagation
                                        on:click|stopPropagation={() => audioPlayer.cycleRate()}
                                        class="rounded-full border rt-theme-border bg-[var(--rt-surface-soft)] px-2.5 py-1 text-content-meta font-semibold rt-text-secondary transition-colors hover:bg-[var(--rt-surface-hover)] disabled:opacity-40"
                                        aria-label={ui.text("Cambiar velocidad",interfaceLocale)}
                                        disabled={inlineAudioGlobalBusy}
                                    >
                                        {formatRate($audioPlayer.rate)}
                                    </button>
                                    <button
                                        type="button"
                                        on:mousedown|stopPropagation
                                        on:click|stopPropagation={() => audioPlayer.toggleMuted()}
                                        class={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-150 ${
                                            $audioPlayer.muted
                                                ? "border-primary/20 bg-primary/10 text-primary"
                                                : "rt-theme-border bg-[var(--rt-surface-soft)] rt-text-secondary hover:bg-[var(--rt-surface-hover)]"
                                        }`}
                                        aria-label={$audioPlayer.muted ? ui.text("Activar sonido",interfaceLocale) : ui.text("Silenciar audio",interfaceLocale)}
                                        disabled={inlineAudioGlobalBusy}
                                    >
                                        {#if $audioPlayer.muted}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="1.9"
                                                    d="M11 5L6 9H3v6h3l5 4V5zm6 4l4 4m0-4l-4 4"
                                                />
                                            </svg>
                                        {:else}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="1.9"
                                                    d="M11 5L6 9H3v6h3l5 4V5zm4.5 3.5a5.5 5.5 0 010 7m2.5-10a9 9 0 010 13"
                                                />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>

                            <div class="h-2 rounded-full rt-muted-surface">
                                <div
                                    class="h-full rounded-full bg-primary transition-[width]"
                                    style={`width: ${$audioPlayer.duration > 0 ? Math.min(($audioPlayer.currentTime / $audioPlayer.duration) * 100, 100) : 0}%;`}
                                ></div>
                            </div>
                            <div
                                class="mt-1 flex items-center justify-between text-content-meta rt-text-muted"
                            >
                                <span>{formatTime($audioPlayer.currentTime)}</span>
                                <span>{formatTime($audioPlayer.duration)}</span>
                            </div>
                        {:else}
                            <div class="mb-2 flex items-center justify-end">
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        on:mousedown|stopPropagation
                                        on:click|stopPropagation={() => audioPlayer.cycleRate()}
                                        class="rounded-full border rt-theme-border bg-[var(--rt-surface-soft)] px-2.5 py-1 text-content-meta font-semibold rt-text-secondary transition-colors hover:bg-[var(--rt-surface-hover)] disabled:opacity-40"
                                        aria-label={ui.text("Cambiar velocidad",interfaceLocale)}
                                        disabled={inlineAudioGlobalBusy}
                                    >
                                        {formatRate($audioPlayer.rate)}
                                    </button>
                                    <button
                                        type="button"
                                        on:mousedown|stopPropagation
                                        on:click|stopPropagation={() => audioPlayer.toggleMuted()}
                                        class={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-150 ${
                                            $audioPlayer.muted
                                                ? "border-primary/20 bg-primary/10 text-primary"
                                                : "rt-theme-border bg-[var(--rt-surface-soft)] rt-text-secondary hover:bg-[var(--rt-surface-hover)]"
                                        }`}
                                        aria-label={$audioPlayer.muted ? ui.text("Activar sonido",interfaceLocale) : ui.text("Silenciar audio",interfaceLocale)}
                                        disabled={inlineAudioGlobalBusy}
                                    >
                                        {#if $audioPlayer.muted}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="1.9"
                                                    d="M11 5L6 9H3v6h3l5 4V5zm6 4l4 4m0-4l-4 4"
                                                />
                                            </svg>
                                        {:else}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="1.9"
                                                    d="M11 5L6 9H3v6h3l5 4V5zm4.5 3.5a5.5 5.5 0 010 7m2.5-10a9 9 0 010 13"
                                                />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>

                            <div class="h-2 rounded-full rt-muted-surface"></div>
                            <div
                                class="mt-1 flex items-center justify-between text-content-meta rt-text-muted"
                            >
                                <span>0:00</span>
                                <span>0:00</span>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Module Body -->
<div class="rt-readable-surface rt-text-secondary px-5 py-6 space-y-5">
    <!-- YouTube embed -->
    {#if isYouTube && youTubeId}
        <div class="aspect-video rounded-xl overflow-hidden">
            <iframe
                src="https://www.youtube.com/embed/{youTubeId}"
                title="Video"
                class="w-full h-full"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    {/if}

    <!-- Title -->
    {#if module.content?.title}
        {@const moduleTitle =
            typeof module.content.title === "object"
                ? module.content.title[currentLang] ||
                  module.content.title.es ||
                  ""
                : module.content.title || ""}
        {#if moduleTitle}
            <h3 class="text-content-card-title font-bold rt-text-primary mb-2">{moduleTitle}</h3>
        {/if}
    {/if}

    <!-- Text content (HTML) -->
    {#if moduleContent}
        <div
            class="module-info-content rt-rich-text rt-readable-content rt-text-secondary max-w-none [&_p]:m-0 [&_p+p]:mt-4 [&_ul]:my-4 [&_ol]:my-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li+li]:mt-1.5 [&_h1]:mt-5 [&_h1]:mb-3 [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:mt-4 [&_h3]:mb-2"
        >
            {@html moduleContent}
        </div>
    {/if}

    <!-- Interaction -->
    {#if contentMode}
        <!-- ficha editorial: sin progreso ni acciones de aventura -->
    {:else if reviewMode}
        <div class="rt-secondary-notice p-4 rounded-xl">
            <p class="text-content-caption font-medium flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-3a1 1 0 10-2 0 1 1 0 002 0zm-2 3a1 1 0 000 2v2a1 1 0 102 0v-2a1 1 0 100-2H9z"
                        clip-rule="evenodd"
                    />
                </svg>
                {ui.text("Modo consulta. Este contenido es solo de lectura.",interfaceLocale)}
            </p>
        </div>
    {:else if !completed}
        <div class="space-y-3">
            {#if requiresPlaybackCompletion && !playbackCompletionReady}
                <div
                    class="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-content-caption rt-text-secondary"
                >
                    <p class="font-bold text-primary">
                        {playbackRequirementLabel} {ui.text("al menos el",interfaceLocale)} {requiredPlaybackPercent}%
                        {ui.text("del",interfaceLocale)} {requiredPlaybackMode === "audio" ? "audio" : ui.text("vídeo",interfaceLocale)}
                        {ui.text("para continuar.",interfaceLocale)}
                    </p>
                    <p class="mt-1 text-content-meta font-semibold rt-text-muted">
                        {ui.text("Progreso actual:",interfaceLocale)} {playbackProgressLabel}
                    </p>
                </div>
            {/if}

            <button
                on:click={handleComplete}
                disabled={submitting || !canCompleteModule}
                class="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 disabled:opacity-40 transition-all active:scale-[0.98]"
            >
                {submitting ? ui.text("Continuando...",interfaceLocale) : ui.text("Continuar",interfaceLocale)}
            </button>
        </div>
    {:else}
        <div class="p-4 rounded-xl border border-green-400/30 bg-green-500/10">
            <p
                class="text-green-300 text-content-caption font-medium flex items-center gap-2"
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
                {ui.text("Módulo completado.",interfaceLocale)}
            </p>
        </div>
    {/if}
</div>

<style>
    .inline-audio-card.is-fixed {
        position: fixed;
        z-index: 70;
        box-shadow:
            inset 0 12px 14px -18px rgba(15, 23, 42, 0.58),
            0 14px 32px rgba(15, 23, 42, 0.14);
    }

    .inline-audio-card.is-fixed::before {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        height: 12px;
        pointer-events: none;
        background: linear-gradient(
            to bottom,
            rgba(15, 23, 42, 0.1),
            rgba(15, 23, 42, 0)
        );
    }

    .module-info-content :global(ul) {
        list-style: disc;
        padding-left: 1.5rem;
        margin: 0.75rem 0;
    }

    .module-info-content :global(ol) {
        list-style: decimal;
        padding-left: 1.5rem;
        margin: 0.75rem 0;
    }

    .module-info-content :global(li) {
        margin: 0.25rem 0;
    }

</style>
