<script>
    // @ts-nocheck
    import {translate as translateInterface} from "$lib/i18n/messages";
    export let interfaceLocale="es";
    const ui={text:(source,locale)=>translateInterface(source,locale)};
    import { onDestroy } from "svelte";
    import { createEventDispatcher } from "svelte";
    import {
        EXTENDED_IMAGE_INTERACTION_MODES,
        normalizeImageInteractionConfig,
        normalizeImageInteractionMode,
        parseAspectRatio,
    } from "./imageInteraction";

    export let baseImage = "";
    export let overlayImage = "";
    export let mode = "NONE";
    export let config = {};
    export let aspectRatio = "16 / 9";
    export let fit = "cover";
    export let alt = ui.text("Imagen interactiva",interfaceLocale);
    export let disabled = false;
    export let wrapperClass = "";
    export let scratchFallbackColor = "rgb(107, 114, 128)";

    const dispatch = createEventDispatcher();

    $: normalizedMode = disabled
        ? "NONE"
        : normalizeImageInteractionMode(mode, EXTENDED_IMAGE_INTERACTION_MODES);
    $: normalizedConfig = normalizeImageInteractionConfig(config);
    $: resolvedAspectRatio = parseAspectRatio(aspectRatio, "16 / 9");
    $: resolvedFit =
        fit === "contain" || fit === "cover" ? fit : "cover";
    $: resolvedMode =
        normalizedMode === "SCRATCH"
            ? overlayImage
                ? "SCRATCH"
                : "NONE"
            : ["XRAY", "SLIDER"].includes(normalizedMode) &&
                (!overlayImage || !baseImage)
              ? "NONE"
              : normalizedMode;
    $: isTorchMode = resolvedMode === "TORCH";
    $: isMagnifierMode = resolvedMode === "MAGNIFIER";
    $: isXrayMode = resolvedMode === "XRAY";
    $: isScratchMode = resolvedMode === "SCRATCH";
    $: isSliderMode = resolvedMode === "SLIDER";
    $: lensImage = isXrayMode ? overlayImage : baseImage;

    let revealWrapEl;
    let revealMaskCanvas;
    let torchEl;
    let magnifierEl;
    let scratchCanvas;

    let revealActive = false;
    let revealX = -999;
    let revealY = -999;
    let revealScale = 1;
    let revealAnimation = null;
    let revealResizeBound = null;
    let revealPointerDown = false;
    let isTouchDevice = false;
    let magnifierVisible = false;
    let scratchScale = 1;
    let scratchPointerDown = false;
    let scratchImageLoaded = false;
    let scratchBaseImg = null;
    let scratchProgressCanvas = null;
    let scratchResizeBound = null;
    let scratchProgressRaf = null;
    let lastScratchProgress = -1;
    let sliderPosition = 50;
    let sliderDragging = false;
    let imagePreloadKey = "";
    let imagesReady = true;
    let legacyTouchMouseBlockUntil = 0;

    function getRequiredImageSources() {
        const sources = [];
        if (isSliderMode || isScratchMode || isXrayMode) {
            if (overlayImage) sources.push(overlayImage);
            if (baseImage) sources.push(baseImage);
        } else if (baseImage) {
            sources.push(baseImage);
        }
        return Array.from(new Set(sources.filter(Boolean)));
    }

    function preloadImage(src) {
        return new Promise((resolve) => {
            if (typeof Image === "undefined" || !src) {
                resolve();
                return;
            }
            const img = new Image();
            img.decoding = "async";
            img.onload = resolve;
            img.onerror = resolve;
            img.src = src;
        });
    }

    function preloadRequiredImages(sources) {
        const key = sources.join("|");
        if (key === imagePreloadKey) return;
        imagePreloadKey = key;
        if (sources.length === 0 || typeof Image === "undefined") {
            imagesReady = true;
            return;
        }

        imagesReady = false;
        Promise.all(sources.map(preloadImage)).then(() => {
            if (imagePreloadKey === key) {
                imagesReady = true;
            }
        });
    }

    function resizeRevealCanvas() {
        if (!revealMaskCanvas || !revealWrapEl) return;
        const rect = revealWrapEl.getBoundingClientRect();
        const rawDpr =
            typeof window !== "undefined" && window.devicePixelRatio
                ? window.devicePixelRatio
                : 1;
        const cappedDpr = isTouchDevice ? Math.min(rawDpr, 1.5) : rawDpr;
        revealScale = cappedDpr;
        revealMaskCanvas.width = Math.max(
            1,
            Math.floor(rect.width * cappedDpr),
        );
        revealMaskCanvas.height = Math.max(
            1,
            Math.floor(rect.height * cappedDpr),
        );
    }

    function drawRevealMask(flicker = 1) {
        if (!revealMaskCanvas) return;
        const ctx = revealMaskCanvas.getContext("2d");
        if (!ctx) return;
        const w = revealMaskCanvas.width;
        const h = revealMaskCanvas.height;
        const r = normalizedConfig.torchRadius * revealScale * flicker;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, w, h);

        if (revealActive) {
            ctx.globalCompositeOperation = "destination-out";
            const g = ctx.createRadialGradient(
                revealX,
                revealY,
                r * 0.08,
                revealX,
                revealY,
                r,
            );
            g.addColorStop(0, "rgba(0,0,0,1)");
            g.addColorStop(0.35, "rgba(0,0,0,.98)");
            g.addColorStop(0.6, "rgba(0,0,0,.7)");
            g.addColorStop(0.82, "rgba(0,0,0,.3)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(revealX, revealY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
    }

    function loopReveal() {
        const flicker = revealActive ? 1 + (Math.random() - 0.5) * 0.04 : 1;
        drawRevealMask(flicker);
        revealAnimation = requestAnimationFrame(loopReveal);
    }

    function ensureRevealLoop() {
        if (!isTorchMode || !baseImage || !revealWrapEl || !revealMaskCanvas) {
            if (revealAnimation) {
                cancelAnimationFrame(revealAnimation);
                revealAnimation = null;
            }
            return;
        }
        if (typeof window !== "undefined") {
            isTouchDevice =
                "ontouchstart" in window ||
                (navigator &&
                    typeof navigator.maxTouchPoints === "number" &&
                    navigator.maxTouchPoints > 0);
        }
        resizeRevealCanvas();
        if (revealAnimation) {
            cancelAnimationFrame(revealAnimation);
            revealAnimation = null;
        }
        if (!isTouchDevice) {
            loopReveal();
        } else {
            drawRevealMask(1);
        }
    }

    function toCanvasPoint(clientX, clientY) {
        if (!revealMaskCanvas) return { x: -999, y: -999 };
        const rect = revealMaskCanvas.getBoundingClientRect();
        const scaleX = revealMaskCanvas.width / Math.max(1, rect.width);
        const scaleY = revealMaskCanvas.height / Math.max(1, rect.height);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    function getTouchTargetLift(pointerType, radius) {
        return pointerType === "touch" ? radius * 0.42 : 0;
    }

    function moveReveal(clientX, clientY, pointerType = "") {
        if (!revealWrapEl || !torchEl) return;
        const touchLift = getTouchTargetLift(
            pointerType,
            normalizedConfig.torchRadius * revealScale,
        );
        const p = toCanvasPoint(clientX, clientY - touchLift);
        const wrapRect = revealWrapEl.getBoundingClientRect();
        revealX = p.x;
        revealY = p.y;
        revealActive = true;
        torchEl.style.display = "block";
        torchEl.style.left = `${clientX - wrapRect.left}px`;
        torchEl.style.top = `${clientY - wrapRect.top - touchLift}px`;
    }

    function moveLens(clientX, clientY, pointerType = "") {
        if (!revealWrapEl || !magnifierEl || !lensImage) return;
        const rect = revealWrapEl.getBoundingClientRect();
        const radius = isXrayMode
            ? normalizedConfig.xrayRadius
            : normalizedConfig.magnifierRadius;
        const touchLift = getTouchTargetLift(pointerType, radius);
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const y = Math.max(
            0,
            Math.min(rect.height, clientY - rect.top - touchLift),
        );

        magnifierVisible = true;
        magnifierEl.style.display = "block";
        magnifierEl.style.width = `${radius * 2}px`;
        magnifierEl.style.height = `${radius * 2}px`;
        magnifierEl.style.left = `${x}px`;
        magnifierEl.style.top = `${y}px`;

        if (isXrayMode) {
            magnifierEl.style.backgroundSize = `${rect.width}px ${rect.height}px`;
            magnifierEl.style.backgroundPosition = `${-x + radius}px ${-y + radius}px`;
        } else {
            magnifierEl.style.backgroundSize = `${rect.width * normalizedConfig.magnifierZoom}px ${rect.height * normalizedConfig.magnifierZoom}px`;
            magnifierEl.style.backgroundPosition = `${-x * normalizedConfig.magnifierZoom + radius}px ${-y * normalizedConfig.magnifierZoom + radius}px`;
        }
    }

    function drawImageCoverToCanvas(ctx, img, w, h) {
        const scale = Math.max(w / img.width, h / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const dx = (w - drawW) / 2;
        const dy = (h - drawH) / 2;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, dx, dy, drawW, drawH);
    }

    function hasPointerEventSupport() {
        return typeof window !== "undefined" && "PointerEvent" in window;
    }

    function getLegacyPointerType(event) {
        return event?.type?.startsWith("touch") ? "touch" : "mouse";
    }

    function preventLegacyTouchDefault(event, pointerType) {
        if (pointerType === "touch") {
            legacyTouchMouseBlockUntil = Date.now() + 700;
            if (event?.cancelable) event.preventDefault();
        }
    }

    function shouldHandleLegacyInput(event) {
        if (hasPointerEventSupport()) return false;
        const pointerType = getLegacyPointerType(event);
        if (
            pointerType === "mouse" &&
            Date.now() < legacyTouchMouseBlockUntil
        ) {
            return false;
        }
        return true;
    }

    function getLegacyInputPoint(event) {
        const pointerType = getLegacyPointerType(event);
        if (pointerType === "touch") {
            return event?.touches?.[0] || event?.changedTouches?.[0] || null;
        }
        return event;
    }

    function getLegacyInput(event) {
        if (!shouldHandleLegacyInput(event)) return null;
        const pointerType = getLegacyPointerType(event);
        const point = getLegacyInputPoint(event);
        if (!point) return null;
        preventLegacyTouchDefault(event, pointerType);
        return {
            clientX: point.clientX,
            clientY: point.clientY,
            pointerType,
        };
    }

    function finishLegacyInput(event) {
        if (!shouldHandleLegacyInput(event)) return false;
        preventLegacyTouchDefault(event, getLegacyPointerType(event));
        return true;
    }

    function toScratchPoint(clientX, clientY) {
        if (!scratchCanvas) return { x: -999, y: -999 };
        const rect = scratchCanvas.getBoundingClientRect();
        const scaleX = scratchCanvas.width / Math.max(1, rect.width);
        const scaleY = scratchCanvas.height / Math.max(1, rect.height);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    function drawSoftScratchBrush(ctx, x, y, radius) {
        const innerRadius = Math.max(0, radius * 0.58);
        const gradient = ctx.createRadialGradient(
            x,
            y,
            innerRadius,
            x,
            y,
            radius,
        );
        gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
        gradient.addColorStop(0.62, "rgba(0, 0, 0, 0.62)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    function scratchAt(clientX, clientY) {
        if (!scratchCanvas || !scratchImageLoaded) return;
        const ctx = scratchCanvas.getContext("2d");
        if (!ctx) return;
        const p = toScratchPoint(clientX, clientY);
        const r = normalizedConfig.scratchRadius * scratchScale;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        drawSoftScratchBrush(ctx, p.x, p.y, r);
        ctx.restore();
        scratchProgressAt(p.x, p.y, r);
        scheduleScratchProgressMeasure();
    }

    function resetScratchProgressCanvas(width, height) {
        if (typeof document === "undefined") return;
        scratchProgressCanvas = document.createElement("canvas");
        scratchProgressCanvas.width = Math.max(1, width);
        scratchProgressCanvas.height = Math.max(1, height);
        const ctx = scratchProgressCanvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillRect(0, 0, scratchProgressCanvas.width, scratchProgressCanvas.height);
    }

    function ensureScratchProgressCanvas() {
        if (!scratchCanvas) return null;
        if (
            !scratchProgressCanvas ||
            scratchProgressCanvas.width !== scratchCanvas.width ||
            scratchProgressCanvas.height !== scratchCanvas.height
        ) {
            resetScratchProgressCanvas(scratchCanvas.width, scratchCanvas.height);
        }
        return scratchProgressCanvas;
    }

    function scratchProgressAt(x, y, radius) {
        const progressCanvas = ensureScratchProgressCanvas();
        if (!progressCanvas) return;
        const ctx = progressCanvas.getContext("2d");
        if (!ctx) return;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        drawSoftScratchBrush(ctx, x, y, radius);
        ctx.restore();
    }

    function measureScratchProgress() {
        scratchProgressRaf = null;
        if (!scratchCanvas || !scratchImageLoaded) return;
        const progressCanvas = ensureScratchProgressCanvas();
        if (!progressCanvas) return;
        const ctx = progressCanvas.getContext("2d");
        if (!ctx) return;

        const { width, height } = progressCanvas;
        if (!width || !height) return;

        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, width, height);
        } catch {
            return;
        }
        const pixels = imageData.data;
        let clearedWeight = 0;

        for (let index = 3; index < pixels.length; index += 4) {
            clearedWeight += 255 - pixels[index];
        }

        const maxWeight = (pixels.length / 4) * 255;
        const nextProgress =
            maxWeight > 0 ? Math.max(0, Math.min(1, clearedWeight / maxWeight)) : 0;

        if (Math.abs(nextProgress - lastScratchProgress) < 0.01) return;
        lastScratchProgress = nextProgress;
        dispatch("scratchprogress", {
            progress: nextProgress,
            percent: Math.round(nextProgress * 100),
        });
    }

    function scheduleScratchProgressMeasure() {
        if (scratchProgressRaf) return;
        scratchProgressRaf = requestAnimationFrame(() =>
            measureScratchProgress(),
        );
    }

    function resizeScratchCanvas() {
        if (!scratchCanvas || !revealWrapEl) return;
        const rect = revealWrapEl.getBoundingClientRect();
        const rawDpr =
            typeof window !== "undefined" && window.devicePixelRatio
                ? window.devicePixelRatio
                : 1;
        scratchScale = Math.min(rawDpr, 2);
        const w = Math.max(1, Math.floor(rect.width * scratchScale));
        const h = Math.max(1, Math.floor(rect.height * scratchScale));
        scratchCanvas.width = w;
        scratchCanvas.height = h;
        resetScratchProgressCanvas(w, h);
        const ctx = scratchCanvas.getContext("2d");
        if (!ctx) return;
        if (scratchBaseImg) {
            drawImageCoverToCanvas(ctx, scratchBaseImg, w, h);
            return;
        }
        ctx.fillStyle = scratchFallbackColor;
        ctx.fillRect(0, 0, w, h);
        scheduleScratchProgressMeasure();
    }

    function ensureScratchLayer() {
        if (
            !isScratchMode ||
            !overlayImage ||
            !scratchCanvas ||
            !revealWrapEl
        )
            return;
        if (!baseImage) {
            const rect = revealWrapEl.getBoundingClientRect();
            const w = Math.max(1, Math.floor(rect.width * scratchScale));
            const h = Math.max(1, Math.floor(rect.height * scratchScale));
            scratchCanvas.width = w;
            scratchCanvas.height = h;
            resetScratchProgressCanvas(w, h);
            const ctx = scratchCanvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = scratchFallbackColor;
            ctx.fillRect(0, 0, w, h);
            scratchImageLoaded = true;
            scratchBaseImg = null;
            lastScratchProgress = -1;
            scheduleScratchProgressMeasure();
            return;
        }
        const img = new Image();
        img.onload = () => {
            scratchBaseImg = img;
            scratchImageLoaded = true;
            lastScratchProgress = -1;
            resizeScratchCanvas();
        };
        img.onerror = () => {
            if (!scratchCanvas || !revealWrapEl) return;
            const rect = revealWrapEl.getBoundingClientRect();
            const w = Math.max(1, Math.floor(rect.width * scratchScale));
            const h = Math.max(1, Math.floor(rect.height * scratchScale));
            scratchCanvas.width = w;
            scratchCanvas.height = h;
            resetScratchProgressCanvas(w, h);
            const ctx = scratchCanvas.getContext("2d");
            if (!ctx) return;
            ctx.fillStyle = scratchFallbackColor;
            ctx.fillRect(0, 0, w, h);
            scratchImageLoaded = true;
            scratchBaseImg = null;
            lastScratchProgress = -1;
            scheduleScratchProgressMeasure();
        };
        img.src = baseImage;
    }

    function handleScratchPointerDown(event) {
        if (!isScratchMode || !scratchCanvas) return;
        scratchPointerDown = true;
        if (scratchCanvas.setPointerCapture) {
            try {
                scratchCanvas.setPointerCapture(event.pointerId);
            } catch {
                // ignore
            }
        }
        scratchAt(event.clientX, event.clientY);
    }

    function handleScratchPointerMove(event) {
        if (!scratchPointerDown) return;
        scratchAt(event.clientX, event.clientY);
    }

    function handleScratchPointerUp(event) {
        scratchPointerDown = false;
        if (scratchCanvas?.releasePointerCapture) {
            try {
                scratchCanvas.releasePointerCapture(event.pointerId);
            } catch {
                // ignore
            }
        }
    }

    function handleScratchLegacyStart(event) {
        if (!isScratchMode || !scratchCanvas) return;
        const input = getLegacyInput(event);
        if (!input) return;
        scratchPointerDown = true;
        scratchAt(input.clientX, input.clientY);
    }

    function handleScratchLegacyMove(event) {
        if (!scratchPointerDown) return;
        const input = getLegacyInput(event);
        if (!input) return;
        scratchAt(input.clientX, input.clientY);
    }

    function handleScratchLegacyEnd(event) {
        if (!finishLegacyInput(event)) return;
        scratchPointerDown = false;
    }

    function updateSliderFromClientX(clientX) {
        if (!revealWrapEl) return;
        const rect = revealWrapEl.getBoundingClientRect();
        const rel = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
        sliderPosition = Math.max(0, Math.min(100, rel));
    }

    function handleSliderPointerDown(event) {
        sliderDragging = true;
        updateSliderFromClientX(event.clientX);
    }

    function handleSliderPointerMove(event) {
        if (!sliderDragging) return;
        updateSliderFromClientX(event.clientX);
    }

    function handleSliderPointerUp() {
        sliderDragging = false;
    }

    function handleSliderLegacyStart(event) {
        const input = getLegacyInput(event);
        if (!input) return;
        sliderDragging = true;
        updateSliderFromClientX(input.clientX);
    }

    function handleSliderLegacyMove(event) {
        if (!sliderDragging) return;
        const input = getLegacyInput(event);
        if (!input) return;
        updateSliderFromClientX(input.clientX);
    }

    function handleSliderLegacyEnd(event) {
        if (!finishLegacyInput(event)) return;
        sliderDragging = false;
    }

    function handleRevealLeave() {
        revealActive = false;
        magnifierVisible = false;
        if (torchEl) torchEl.style.display = "none";
        if (magnifierEl) magnifierEl.style.display = "none";
        sliderDragging = false;
    }

    function handlePointerDown(event) {
        if (resolvedMode === "NONE") return;
        revealPointerDown = true;
        if (revealMaskCanvas?.setPointerCapture && isTorchMode) {
            try {
                revealMaskCanvas.setPointerCapture(event.pointerId);
            } catch {
                // ignore
            }
        }
        if (isTorchMode) {
            moveReveal(event.clientX, event.clientY, event.pointerType);
        } else {
            moveLens(event.clientX, event.clientY, event.pointerType);
        }
    }

    function handlePointerMove(event) {
        if (isTorchMode) {
            if (!revealPointerDown) return;
            moveReveal(event.clientX, event.clientY, event.pointerType);
            if (event.pointerType === "touch") {
                drawRevealMask(1);
            }
            return;
        }

        if (event.pointerType === "touch" && !revealPointerDown) return;
        moveLens(event.clientX, event.clientY, event.pointerType);
    }

    function handlePointerUp(event) {
        revealPointerDown = false;
        if (revealMaskCanvas?.releasePointerCapture && isTorchMode) {
            try {
                revealMaskCanvas.releasePointerCapture(event.pointerId);
            } catch {
                // ignore
            }
        }
        handleRevealLeave();
    }

    function handleLegacyRevealStart(event) {
        if (resolvedMode === "NONE") return;
        const input = getLegacyInput(event);
        if (!input) return;
        revealPointerDown = true;
        if (isTorchMode) {
            moveReveal(input.clientX, input.clientY, input.pointerType);
        } else {
            moveLens(input.clientX, input.clientY, input.pointerType);
        }
    }

    function handleLegacyRevealMove(event) {
        const input = getLegacyInput(event);
        if (!input) return;

        if (isTorchMode) {
            if (!revealPointerDown) return;
            moveReveal(input.clientX, input.clientY, input.pointerType);
            if (input.pointerType === "touch") {
                drawRevealMask(1);
            }
            return;
        }

        if (input.pointerType === "touch" && !revealPointerDown) return;
        moveLens(input.clientX, input.clientY, input.pointerType);
    }

    function handleLegacyRevealEnd(event) {
        if (!finishLegacyInput(event)) return;
        revealPointerDown = false;
        handleRevealLeave();
    }

    $: if (
        resolvedMode !== "NONE" &&
        (baseImage || (isScratchMode && overlayImage))
    ) {
        setTimeout(() => {
            if (typeof window === "undefined") return;
            if (!revealResizeBound) {
                revealResizeBound = () => {
                    if (isTorchMode) resizeRevealCanvas();
                };
                window.addEventListener("resize", revealResizeBound);
            }
            if (isTorchMode) {
                ensureRevealLoop();
            } else if (revealAnimation) {
                cancelAnimationFrame(revealAnimation);
                revealAnimation = null;
            }
            if (isScratchMode) {
                if (!scratchResizeBound) {
                    scratchResizeBound = () => resizeScratchCanvas();
                    window.addEventListener("resize", scratchResizeBound);
                }
                ensureScratchLayer();
            }
        }, 0);
    } else if (revealResizeBound) {
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", revealResizeBound);
        }
        revealResizeBound = null;
        handleRevealLeave();
        if (revealAnimation) {
            cancelAnimationFrame(revealAnimation);
            revealAnimation = null;
        }
    }

    $: if (!isScratchMode && scratchResizeBound) {
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", scratchResizeBound);
        }
        scratchResizeBound = null;
        scratchPointerDown = false;
        scratchImageLoaded = false;
        scratchProgressCanvas = null;
        lastScratchProgress = -1;
    }

    $: preloadRequiredImages(getRequiredImageSources());

    onDestroy(() => {
        if (revealResizeBound && typeof window !== "undefined") {
            window.removeEventListener("resize", revealResizeBound);
            revealResizeBound = null;
        }
        if (scratchResizeBound && typeof window !== "undefined") {
            window.removeEventListener("resize", scratchResizeBound);
            scratchResizeBound = null;
        }
        if (scratchProgressRaf) {
            cancelAnimationFrame(scratchProgressRaf);
            scratchProgressRaf = null;
        }
        if (revealAnimation) {
            cancelAnimationFrame(revealAnimation);
            revealAnimation = null;
        }
    });
</script>

<div
    bind:this={revealWrapEl}
    class={`interactive-reveal-wrap relative w-full overflow-hidden ${isMagnifierMode || isXrayMode ? "interactive-reveal-wrap-lens" : ""} ${imagesReady ? "is-loaded" : "is-loading"} ${wrapperClass}`.trim()}
    style={`aspect-ratio: ${resolvedAspectRatio};`}
    aria-busy={!imagesReady}
>
    <div class={`interactive-reveal-loading ${imagesReady ? "is-hidden" : ""}`.trim()} aria-hidden="true"></div>

    {#if isSliderMode}
        <img
            src={overlayImage}
            alt={alt}
            class={`h-full w-full ${resolvedFit === "contain" ? "object-contain" : "object-cover"}`}
            draggable="false"
        />
        <div
            class="interactive-reveal-slider-top"
            style={`clip-path: inset(0 ${100 - sliderPosition}% 0 0);`}
        >
            <img
                src={baseImage}
                alt={alt}
                class={`interactive-reveal-slider-top-image ${resolvedFit === "contain" ? "object-contain" : "object-cover"}`}
                draggable="false"
            />
        </div>
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="interactive-reveal-slider-hit"
            on:pointerdown={handleSliderPointerDown}
            on:pointermove={handleSliderPointerMove}
            on:pointerup={handleSliderPointerUp}
            on:pointerleave={handleSliderPointerUp}
            on:pointercancel={handleSliderPointerUp}
            on:touchstart|nonpassive={handleSliderLegacyStart}
            on:touchmove|nonpassive={handleSliderLegacyMove}
            on:touchend|nonpassive={handleSliderLegacyEnd}
            on:touchcancel|nonpassive={handleSliderLegacyEnd}
            on:mousedown={handleSliderLegacyStart}
            on:mousemove={handleSliderLegacyMove}
            on:mouseup={handleSliderLegacyEnd}
            on:mouseleave={handleSliderLegacyEnd}
        >
            <div
                class="interactive-reveal-slider-line"
                style={`left:${sliderPosition}%;`}
            >
                <div class="interactive-reveal-slider-knob">↔</div>
            </div>
        </div>
    {:else if isScratchMode}
        <img
            src={overlayImage}
            alt={alt}
            class={`h-full w-full ${resolvedFit === "contain" ? "object-contain" : "object-cover"}`}
            draggable="false"
        />
        <canvas
            bind:this={scratchCanvas}
            class="interactive-reveal-scratch-canvas"
            on:pointerdown={handleScratchPointerDown}
            on:pointermove={handleScratchPointerMove}
            on:pointerup={handleScratchPointerUp}
            on:pointerleave={handleScratchPointerUp}
            on:pointercancel={handleScratchPointerUp}
            on:touchstart|nonpassive={handleScratchLegacyStart}
            on:touchmove|nonpassive={handleScratchLegacyMove}
            on:touchend|nonpassive={handleScratchLegacyEnd}
            on:touchcancel|nonpassive={handleScratchLegacyEnd}
            on:mousedown={handleScratchLegacyStart}
            on:mousemove={handleScratchLegacyMove}
            on:mouseup={handleScratchLegacyEnd}
            on:mouseleave={handleScratchLegacyEnd}
        ></canvas>
    {:else}
        <img
            src={baseImage}
            alt={alt}
            class={`h-full w-full ${resolvedFit === "contain" ? "object-contain" : "object-cover"}`}
            draggable="false"
        />
    {/if}

    {#if isTorchMode}
        <canvas
            bind:this={revealMaskCanvas}
            class="interactive-reveal-mask"
            on:pointerdown={handlePointerDown}
            on:pointermove={handlePointerMove}
            on:pointerup={handlePointerUp}
            on:pointerleave={handlePointerUp}
            on:pointercancel={handlePointerUp}
            on:touchstart|nonpassive={handleLegacyRevealStart}
            on:touchmove|nonpassive={handleLegacyRevealMove}
            on:touchend|nonpassive={handleLegacyRevealEnd}
            on:touchcancel|nonpassive={handleLegacyRevealEnd}
            on:mousedown={handleLegacyRevealStart}
            on:mousemove={handleLegacyRevealMove}
            on:mouseup={handleLegacyRevealEnd}
            on:mouseleave={handleLegacyRevealEnd}
        ></canvas>
        <div
            bind:this={torchEl}
            class="interactive-reveal-torch"
        ></div>
    {:else if isMagnifierMode || isXrayMode}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="interactive-reveal-hit"
            on:pointerdown={handlePointerDown}
            on:pointermove={handlePointerMove}
            on:pointerup={handlePointerUp}
            on:pointerleave={handlePointerUp}
            on:pointercancel={handlePointerUp}
            on:touchstart|nonpassive={handleLegacyRevealStart}
            on:touchmove|nonpassive={handleLegacyRevealMove}
            on:touchend|nonpassive={handleLegacyRevealEnd}
            on:touchcancel|nonpassive={handleLegacyRevealEnd}
            on:mousedown={handleLegacyRevealStart}
            on:mousemove={handleLegacyRevealMove}
            on:mouseup={handleLegacyRevealEnd}
            on:mouseleave={handleLegacyRevealEnd}
        >
            <div
                bind:this={magnifierEl}
                class="interactive-reveal-lens"
                style={`background-image: url('${lensImage}'); display: ${magnifierVisible ? "block" : "none"};`}
            ></div>
        </div>
    {/if}
</div>

<style>
    .interactive-reveal-wrap {
        -ms-touch-action: none;
        touch-action: none;
        cursor: none;
        background: #e5e7eb;
    }

    .interactive-reveal-wrap-lens {
        cursor: crosshair;
    }

    .interactive-reveal-wrap img,
    .interactive-reveal-mask,
    .interactive-reveal-scratch-canvas,
    .interactive-reveal-slider-hit,
    .interactive-reveal-slider-top {
        transition: opacity 360ms ease;
    }

    .interactive-reveal-wrap.is-loading {
        cursor: default;
        pointer-events: none;
    }

    .interactive-reveal-wrap.is-loading img,
    .interactive-reveal-wrap.is-loading .interactive-reveal-mask,
    .interactive-reveal-wrap.is-loading .interactive-reveal-scratch-canvas,
    .interactive-reveal-wrap.is-loading .interactive-reveal-slider-hit,
    .interactive-reveal-wrap.is-loading .interactive-reveal-slider-top {
        opacity: 0;
    }

    .interactive-reveal-loading {
        position: absolute;
        inset: 0;
        z-index: 10;
        background:
            linear-gradient(
                90deg,
                rgba(255, 255, 255, 0) 0%,
                rgba(255, 255, 255, 0.38) 50%,
                rgba(255, 255, 255, 0) 100%
            ),
            #e5e7eb;
        background-size: 200% 100%;
        opacity: 1;
        transition:
            opacity 360ms ease,
            visibility 360ms ease;
        visibility: visible;
        animation: interactive-reveal-loading 1.15s ease-in-out infinite;
    }

    .interactive-reveal-loading.is-hidden {
        opacity: 0;
        visibility: hidden;
        animation: none;
    }

    .interactive-reveal-mask {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
    }

    .interactive-reveal-scratch-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        -ms-touch-action: none;
        touch-action: none;
    }

    .interactive-reveal-slider-top {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
    }

    .interactive-reveal-slider-top-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .interactive-reveal-slider-hit {
        position: absolute;
        inset: 0;
        z-index: 3;
        -ms-touch-action: none;
        touch-action: none;
    }

    .interactive-reveal-slider-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28);
        transform: translateX(-50%);
    }

    .interactive-reveal-slider-knob {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 34px;
        height: 34px;
        border-radius: 9999px;
        display: grid;
        place-items: center;
        font-size: 14px;
        font-weight: 700;
        color: #111827;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
        user-select: none;
    }

    .interactive-reveal-torch {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 3;
        display: none;
        width: 1px;
        height: 1px;
        opacity: 0;
    }

    .interactive-reveal-hit {
        position: absolute;
        inset: 0;
        z-index: 2;
        -ms-touch-action: none;
        touch-action: none;
    }

    .interactive-reveal-lens {
        position: absolute;
        transform: translate(-50%, -50%);
        border-radius: 9999px;
        border: 3px solid rgba(255, 255, 255, 0.9);
        box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.3),
            0 8px 20px rgba(0, 0, 0, 0.35);
        background-repeat: no-repeat;
        pointer-events: none;
    }

    @keyframes interactive-reveal-loading {
        from {
            background-position: 200% 0;
        }
        to {
            background-position: -200% 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .interactive-reveal-wrap img,
        .interactive-reveal-mask,
        .interactive-reveal-scratch-canvas,
        .interactive-reveal-slider-hit,
        .interactive-reveal-slider-top,
        .interactive-reveal-loading {
            transition: none;
        }

        .interactive-reveal-loading {
            animation-duration: 2s;
        }
    }
</style>
