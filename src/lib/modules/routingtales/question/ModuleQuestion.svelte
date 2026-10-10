<script>
    // @ts-nocheck
    import {translate as translateInterface} from "$lib/i18n/messages";
    export let interfaceLocale="es";
    const ui={text:(source,locale)=>translateInterface(source,locale)};
    import { createEventDispatcher } from "svelte";
    import { fly } from "svelte/transition";
    import { onDestroy } from "svelte";
    import FadeImage from "../shared/FadeImage.svelte";
    import InteractiveImageReveal from "../shared/InteractiveImageReveal.svelte";
    import { getPlayableMediaUrl, isYouTubeUrl, youTubeId as parseYouTubeId } from "../shared/media";
    import {
        EXTENDED_IMAGE_INTERACTION_MODES,
        normalizeImageInteractionConfig,
        normalizeImageInteractionMode,
        parseAspectRatio,
    } from "../shared/imageInteraction";
    import {
        getLocalizedHintText,
        normalizeModuleHints,
        normalizeUsedHintIds,
    } from "../shared/moduleHints.js";

    /** @type {any} */
    export let module;
    export let completed = false;
    export let reviewMode = false;
    export let savedResponse = null;
    export let submitting = false;
    export let currentLang = "es";
    export let persistedHintIds = [];
    export let checkpointAttempt = null;

    const dispatch = createEventDispatcher();

    let answer = "";
    let wrongAnswer = false;
    let revealedHintIds = [];
    let lastPersistedHintSignature = "";
    let slotInputs = [];
    let slotChars = [];
    let dialValues = [];
    let letterDialValues = [];
    let letterDialSignature = "";
    let orderTiles = [];
    let orderSignature = "";
    let orderDragTileId = null;
    let orderPointerId = null;
    let orderPointerDragging = false;
    let orderDropTargetTileId = null;
    let orderLocked = false;
    let orderSolvedFlash = false;
    let orderSolvedFlashTimeout = null;
    let answerInteractionEl = null;
    let keyboardRevealTimers = [];
    let keyboardRevealFrame = null;
    /** @type {((event: Event) => void) | null} */
    let keyboardViewportResizeHandler = null;
    let slotFocusRestoreFrame = null;
    let suppressKeyboardRevealUntil = 0;

    // Penalty tracking
    export let failures = 0;
    export let hintUsed = false;

    /** @param {any} field */
    function getLocalized(field) {
        if (!field) return "";
        if (typeof field === "object")
            return (
                field[currentLang] ||
                field["es"] ||
                Object.values(field)[0] ||
                ""
            );
        return field;
    }

    /** @param {any} mediaUrl @param {string} lang */
    function getLocalizedMedia(mediaUrl, lang) {
        if (!mediaUrl) return "";
        if (typeof mediaUrl === "string") return mediaUrl.trim();
        if (typeof mediaUrl === "object" && !Array.isArray(mediaUrl)) {
            const langVal =
                typeof mediaUrl[lang] === "string"
                    ? mediaUrl[lang].trim()
                    : "";
            if (langVal) return langVal;
            const fallback = Object.values(mediaUrl)
                .map((v) => (typeof v === "string" ? v.trim() : ""))
                .find(Boolean);
            return fallback || "";
        }
        return "";
    }

    $: rawMediaUrl = String(
        getLocalizedMedia(module.content?.mediaUrl, currentLang) || "",
    );
    $: mediaUrl = getPlayableMediaUrl(rawMediaUrl);
    $: isVideo = rawMediaUrl && (rawMediaUrl.startsWith("data:video/") || rawMediaUrl.match(/\.(mp4|webm|mov)(\?|$)/i));
    $: isAudio =
        rawMediaUrl && (rawMediaUrl.startsWith("data:audio/") || rawMediaUrl.match(/\.(mp3|wav|ogg|m4a|aac)(\?|$)/i));
    $: isYouTube = rawMediaUrl && isYouTubeUrl(rawMediaUrl);
    $: youTubeId = isYouTube ? parseYouTubeId(rawMediaUrl) : "";
    $: rawAudioUrl =
        getLocalizedMedia(module.content?.audio, currentLang) ||
        getLocalizedMedia(module.content?.audioUrl, currentLang);
    $: audioUrl = rawAudioUrl ? getPlayableMediaUrl(rawAudioUrl) : "";
    $: moduleHints = normalizeModuleHints(module?.content || {}).filter((hint) =>
        getLocalizedHintText(hint, currentLang).trim(),
    );
    $: currentHintIds = moduleHints.map((hint) => String(hint.id));
    $: persistedHintSignature = JSON.stringify(
        Array.isArray(persistedHintIds) ? persistedHintIds : [],
    );
    $: if (persistedHintSignature !== lastPersistedHintSignature) {
        lastPersistedHintSignature = persistedHintSignature;
        const restoredHintIds = normalizeUsedHintIds(
            persistedHintIds,
            moduleHints,
            false,
        );
        revealedHintIds = Array.from(
            new Set([...revealedHintIds, ...restoredHintIds]),
        );
    }
    $: {
        const nextRevealedHintIds = revealedHintIds.filter((id) =>
            currentHintIds.includes(id),
        );
        if (nextRevealedHintIds.length !== revealedHintIds.length) {
            revealedHintIds = nextRevealedHintIds;
        }
        hintUsed = revealedHintIds.length > 0;
    }
    $: visibleHints = moduleHints.slice(0, revealedHintIds.length);
    $: nextHint = moduleHints[revealedHintIds.length] || null;
    $: answerMode = (() => {
        const raw = String(module?.content?.answerMode || "TEXT").toUpperCase();
        return [
            "TEXT",
            "LETTER_SLOTS",
            "NUMERIC_DIAL",
            "LETTER_DIAL",
            "LETTER_ORDER",
        ].includes(raw)
            ? raw
            : "TEXT";
    })();
    $: imageInteractionMode = (() => {
        const raw = normalizeImageInteractionMode(
            module?.content?.imageInteractionMode,
            EXTENDED_IMAGE_INTERACTION_MODES,
        );
        if (raw !== "NONE") return raw;
        return module?.content?.interactiveReveal === true ? "TORCH" : "NONE";
    })();
    $: interactiveReveal = imageInteractionMode === "TORCH";
    $: isMagnifierMode = imageInteractionMode === "MAGNIFIER";
    $: isXrayMode = imageInteractionMode === "XRAY";
    $: isScratchMode = imageInteractionMode === "SCRATCH";
    $: isSliderMode = imageInteractionMode === "SLIDER";
    $: usesInteractiveQuestionImage =
        interactiveReveal ||
        isMagnifierMode ||
        ((isXrayMode || isScratchMode || isSliderMode) && !!xrayImage);
    $: imageInteractionConfig = normalizeImageInteractionConfig({
        torchRadius: module?.content?.torchRadius,
        magnifierZoom: module?.content?.magnifierZoom,
        magnifierRadius: module?.content?.magnifierRadius,
        xrayRadius: module?.content?.xrayRadius,
    });
    $: xrayImage = String(module?.content?.xrayImage || "").trim();
    $: slotLength = (() => {
        const configured = Number(module?.content?.slotLength);
        if (Number.isFinite(configured) && configured > 0) {
            return Math.max(2, Math.min(32, Math.floor(configured)));
        }
        const base = extractFirstAnswer(getLocalized(module.content?.answer));
        const cleaned = normalizeSlotText(base);
        if (cleaned.length > 0)
            return Math.max(2, Math.min(32, cleaned.length));
        // Fallback: server-provided hint (offline mode, answer stripped)
        const hint = Number(module?.content?.answerLength);
        if (Number.isFinite(hint) && hint > 0)
            return Math.max(2, Math.min(32, hint));
        return 6;
    })();
    $: numericDigits = (() => {
        const first = extractFirstAnswer(getLocalized(module.content?.answer));
        const digitsOnly = String(first).replace(/\D/g, "");
        if (digitsOnly.length > 0)
            return Math.max(2, Math.min(10, digitsOnly.length));
        // Fallback: server-provided hint (offline mode, answer stripped)
        const hint = Number(module?.content?.answerDigitCount);
        if (Number.isFinite(hint) && hint > 0)
            return Math.max(2, Math.min(10, hint));
        return 4;
    })();
    $: if (answerMode === "LETTER_SLOTS" && slotChars.length !== slotLength) {
        slotChars = Array.from(
            { length: slotLength },
            (_, i) => slotChars[i] || "",
        );
    }
    $: if (
        answerMode === "NUMERIC_DIAL" &&
        dialValues.length !== numericDigits
    ) {
        dialValues = Array.from({ length: numericDigits }, (_, i) =>
            Number.isFinite(Number(dialValues[i])) ? Number(dialValues[i]) : 0,
        );
    }
    $: letterDialAlphabetBase = (() => {
        const base = normalizeSlotText(
            extractFirstAnswer(getLocalized(module.content?.answer)),
        );
        const unique = Array.from(new Set(base.split("").filter(Boolean)));
        const hintedAlphabet = Array.isArray(module?.content?.answerAlphabet)
            ? module.content.answerAlphabet
                  .map((char) => normalizeSlotText(char).slice(0, 1))
                  .filter(Boolean)
            : [];
        return unique.length > 0
            ? unique
            : hintedAlphabet.length > 0
              ? Array.from(new Set(hintedAlphabet))
              : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    })();
    $: letterDialAlphabet = getStableShuffledLetters(
        letterDialAlphabetBase,
        getLetterDialShuffleSeed(letterDialAlphabetBase),
    );
    $: letterDialLength = (() => {
        const base = normalizeSlotText(
            extractFirstAnswer(getLocalized(module.content?.answer)),
        );
        if (base.length > 0) return Math.max(1, Math.min(32, base.length));
        const hint = Number(module?.content?.answerLength);
        if (Number.isFinite(hint) && hint > 0)
            return Math.max(1, Math.min(32, hint));
        return 6;
    })();
    $: if (answerMode === "LETTER_DIAL") {
        const signature = `${letterDialLength}|${letterDialAlphabet.join("")}`;
        const hasInvalidValue = letterDialValues.some(
            (value) => !letterDialAlphabet.includes(String(value || "")),
        );
        if (
            letterDialSignature !== signature ||
            letterDialValues.length !== letterDialLength ||
            hasInvalidValue
        ) {
            letterDialSignature = signature;
            letterDialValues = Array.from({ length: letterDialLength }, (_, i) =>
                letterDialAlphabet.includes(String(letterDialValues[i] || ""))
                    ? String(letterDialValues[i])
                    : String(letterDialAlphabet[0] || "A"),
            );
        }
    } else if (letterDialSignature) {
        letterDialSignature = "";
    }
    $: orderAnswerText = normalizeSlotText(
        extractFirstAnswer(getLocalized(module.content?.answer)),
    );
    $: orderTargetLength = Math.max(
        1,
        Math.min(32, Number(module?.content?.answerLength) || 3),
    );
    $: orderHintedLetters = Array.isArray(module?.content?.answerLetters)
        ? module.content.answerLetters
              .map((char) => normalizeSlotText(char).slice(0, 1))
              .filter(Boolean)
        : [];
    $: orderTargetWord = (() => {
        if (orderAnswerText) return orderAnswerText;
        if (orderHintedLetters.length > 0) {
            const lettersPool = orderHintedLetters.slice(0, orderTargetLength);
            if (lettersPool.length >= orderTargetLength) {
                return lettersPool.join("");
            }
            return lettersPool
                .concat(
                    Array.from(
                        { length: orderTargetLength - lettersPool.length },
                        () => lettersPool[0] || "A",
                    ),
                )
                .join("");
        }
        const hintedAlphabet = Array.isArray(module?.content?.answerAlphabet)
            ? module.content.answerAlphabet
                  .map((char) => normalizeSlotText(char).slice(0, 1))
                  .filter(Boolean)
            : [];
        if (hintedAlphabet.length > 0) {
            const uniqueAlphabet = Array.from(new Set(hintedAlphabet));
            return Array.from(
                { length: orderTargetLength },
                (_, idx) => uniqueAlphabet[idx % uniqueAlphabet.length],
            ).join("");
        }
        return "A".repeat(orderTargetLength);
    })();
    $: orderStableSignature = (() => {
        if (orderAnswerText) return `answer:${orderAnswerText}`;
        const stableLetters = [...orderTargetWord].sort().join("");
        return `letters:${stableLetters}`;
    })();
    $: if (answerMode === "LETTER_ORDER") {
        const signature = `${module?.id || ""}|${orderStableSignature}|${currentLang}`;
        if (orderSignature !== signature) {
            resetLetterOrder();
            orderSignature = signature;
        }
    }
    $: orderCurrentAnswer =
        answerMode === "LETTER_ORDER"
            ? orderTiles.map((tile) => tile.char).join("")
            : "";
    $: orderSolvedAnswer =
        normalizeSlotText(reviewAnswer) || orderTargetWord;
    $: if (
        answerMode === "LETTER_ORDER" &&
        (completed || reviewMode) &&
        !orderLocked
    ) {
        orderLocked = true;
        wrongAnswer = false;
        triggerOrderSolvedFlash();
    }
    $: if (
        answerMode === "LETTER_ORDER" &&
        !completed &&
        !reviewMode &&
        orderLocked
    ) {
        orderLocked = false;
        clearOrderSolvedFlash();
    }
    $: canSubmitAnswer = (() => {
        if (answerMode === "LETTER_SLOTS") {
            return slotChars.every((c) => String(c || "").trim().length > 0);
        }
        if (answerMode === "LETTER_ORDER") {
            return orderTiles.length > 0;
        }
        if (answerMode === "LETTER_DIAL") {
            return letterDialValues.length > 0;
        }
        if (answerMode === "NUMERIC_DIAL") {
            return dialValues.length > 0;
        }
        return answer.trim().length > 0;
    })();
    $: imageAspectRatio = parseAspectRatio(
        module?.content?.imageAspectRatio || module?.imageAspectRatio,
        "16 / 9",
    );

    /** @type {HTMLVideoElement | null} */
    let videoElement = null;
    let isPlaying = false;
    $: reviewAnswer = (() => {
        if (savedResponse == null) return "";
        if (typeof savedResponse === "string") return savedResponse;
        if (typeof savedResponse === "object") {
            if (typeof savedResponse.answer === "string")
                return savedResponse.answer;
            if (typeof savedResponse.value === "string")
                return savedResponse.value;
        }
        return String(savedResponse || "");
    })();
    $: reviewChars = Array.from(
        (reviewAnswer || "").padEnd(slotLength, " ").slice(0, slotLength),
    );

    function togglePlay() {
        if (!videoElement) return;
        if (videoElement.paused) {
            videoElement.play();
        } else {
            videoElement.pause();
        }
    }

    function extractFirstAnswer(raw) {
        const text = String(raw || "");
        return text.split("|")[0]?.trim() || "";
    }

    function normalizeSlotText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase();
    }

    function hashStringToUint32(value) {
        let hash = 2166136261;
        const text = String(value || "");
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function createSeededRandom(seedText) {
        let seed = hashStringToUint32(seedText) || 1;
        return () => {
            seed += 0x6d2b79f5;
            let t = seed;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function getLetterDialShuffleSeed(alphabet) {
        const baseAnswer = normalizeSlotText(
            extractFirstAnswer(getLocalized(module.content?.answer)),
        );
        const normalizedAlphabet = Array.from(
            new Set((alphabet || []).filter(Boolean)),
        )
            .sort()
            .join("");
        return [
            "LETTER_DIAL",
            module?.id || module?.localId || module?.tempId || "",
            currentLang || "es",
            baseAnswer || normalizedAlphabet,
        ].join("|");
    }

    function getStableShuffledLetters(letters, seedText) {
        const uniqueLetters = Array.from(
            new Set((letters || []).filter(Boolean)),
        ).sort();
        if (uniqueLetters.length <= 1) return uniqueLetters;

        const shuffled = [...uniqueLetters];
        const random = createSeededRandom(seedText);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const originalOrder = uniqueLetters.join("");
        if (shuffled.join("") === originalOrder) {
            const offset =
                (hashStringToUint32(`${seedText}|fallback`) %
                    (uniqueLetters.length - 1)) +
                1;
            return shuffled.slice(offset).concat(shuffled.slice(0, offset));
        }

        return shuffled;
    }

    function setSlotChar(index, value) {
        const next = normalizeSlotText(value).slice(-1);
        slotChars[index] = next;
        slotChars = [...slotChars];
    }

    function handleSlotInput(index, event) {
        setSlotChar(index, event.target.value);
        if (slotChars[index] && slotInputs[index + 1]) {
            focusSlotInputWithoutScroll(slotInputs[index + 1]);
        }
    }

    function handleSlotKeydown(index, event) {
        if (
            event.key === "Backspace" &&
            !slotChars[index] &&
            slotInputs[index - 1]
        ) {
            focusSlotInputWithoutScroll(slotInputs[index - 1]);
        }
        if (event.key === "Enter") handleSubmit();
    }

    function clearKeyboardRevealTimers() {
        if (keyboardRevealFrame !== null) {
            window.cancelAnimationFrame(keyboardRevealFrame);
            keyboardRevealFrame = null;
        }
        keyboardRevealTimers.forEach((timer) => window.clearTimeout(timer));
        keyboardRevealTimers = [];
        if (keyboardViewportResizeHandler) {
            window.visualViewport?.removeEventListener(
                "resize",
                keyboardViewportResizeHandler,
            );
            window.removeEventListener("resize", keyboardViewportResizeHandler);
            window.removeEventListener("keyboardDidShow", keyboardViewportResizeHandler);
            keyboardViewportResizeHandler = null;
        }
    }

    function isKeyboardEditableTarget(target) {
        if (!(target instanceof HTMLElement)) return false;
        if (target.isContentEditable) return true;
        const tag = String(target.tagName || "").toUpperCase();
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }

    /** @param {HTMLElement | null | undefined} element */
    function findModuleScrollFrame(element) {
        return element?.closest?.(".module-scroll-frame") ?? null;
    }

    function getCurrentDocumentScrollTop() {
        if (typeof document === "undefined") return 0;
        const scroller = document.scrollingElement || document.documentElement;
        return Math.max(0, Math.round(window.scrollY || scroller?.scrollTop || 0));
    }

    function restoreSlotFocusScroll(snapshot) {
        if (!snapshot) return;
        if (snapshot.scrollFrame instanceof HTMLElement) {
            snapshot.scrollFrame.scrollTop = snapshot.scrollTop;
        }

        window.scrollTo({
            top: snapshot.documentScrollTop,
            left: snapshot.documentScrollLeft,
            behavior: "auto",
        });
        const scroller = document.scrollingElement || document.documentElement;
        if (scroller) scroller.scrollTop = snapshot.documentScrollTop;
    }

    function focusSlotInputWithoutScroll(input) {
        if (!(input instanceof HTMLElement)) return;
        if (typeof window === "undefined") {
            input.focus();
            input.select?.();
            return;
        }

        if (slotFocusRestoreFrame !== null) {
            window.cancelAnimationFrame(slotFocusRestoreFrame);
            slotFocusRestoreFrame = null;
        }

        const scrollFrame = findModuleScrollFrame(input);
        const snapshot = {
            scrollFrame,
            scrollTop:
                scrollFrame instanceof HTMLElement
                    ? Math.max(0, Math.round(scrollFrame.scrollTop || 0))
                    : 0,
            documentScrollTop: getCurrentDocumentScrollTop(),
            documentScrollLeft: Math.max(0, Math.round(window.scrollX || 0)),
        };

        suppressKeyboardRevealUntil =
            (typeof performance !== "undefined" ? performance.now() : Date.now()) +
            300;

        try {
            input.focus({ preventScroll: true });
        } catch {
            input.focus();
        }
        input.select?.();

        restoreSlotFocusScroll(snapshot);
        slotFocusRestoreFrame = window.requestAnimationFrame(() => {
            restoreSlotFocusScroll(snapshot);
            slotFocusRestoreFrame = null;
        });
    }

    /**
     * @param {HTMLElement} element
     * @param {HTMLElement} container
     */
    function scrollFocusedInputIntoScrollFrame(element, container) {
        const visualViewport = window.visualViewport;
        const elementRect = element.getBoundingClientRect();
        const visibleTop = Math.round(visualViewport?.offsetTop || 0);
        const containerRect = container.getBoundingClientRect();
        const visibleBottom = Math.min(containerRect.bottom, Math.round(
            visualViewport
                ? visualViewport.offsetTop + visualViewport.height
                : window.innerHeight,
        ));
        const topPadding = 16;
        const bottomPadding = 24;

        if (
            elementRect.top >= visibleTop + topPadding &&
            elementRect.bottom <= visibleBottom - bottomPadding
        ) {
            return;
        }

        // Solo desplazar hacia abajo si el teclado tapa el input.
        if (elementRect.bottom > visibleBottom - bottomPadding) {
            container.scrollTop +=
                elementRect.bottom - (visibleBottom - bottomPadding);
        }
    }

    function revealFocusedAnswerControl(fallbackTarget = null) {
        if (typeof document === "undefined") return;
        const focused =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : fallbackTarget;
        const target = isKeyboardEditableTarget(focused)
            ? focused
            : fallbackTarget;
        if (!(target instanceof HTMLElement)) return;

        const scrollFrame = findModuleScrollFrame(target);
        if (!(scrollFrame instanceof HTMLElement)) return;

        scrollFocusedInputIntoScrollFrame(target, scrollFrame);
    }

    function handleAnswerFocusIn(event) {
        if (typeof window === "undefined") return;
        const target =
            event?.target instanceof HTMLElement ? event.target : null;
        if (!isKeyboardEditableTarget(target)) return;

        const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now < suppressKeyboardRevealUntil) {
            clearKeyboardRevealTimers();
            return;
        }

        clearKeyboardRevealTimers();

        // Resize events arrive before the shell has applied its new height.
        // Measure after layout, including the final native keyboard animation.
        const reveal = () => {
            if (keyboardRevealFrame !== null) window.cancelAnimationFrame(keyboardRevealFrame);
            keyboardRevealFrame = window.requestAnimationFrame(() => {
                keyboardRevealFrame = null;
                if (answerInteractionEl?.contains(document.activeElement)) {
                    revealFocusedAnswerControl();
                }
            });
        };
        const onViewportResize = () => reveal();
        keyboardViewportResizeHandler = onViewportResize;

        keyboardRevealTimers = [
            window.setTimeout(reveal, 180),
            window.setTimeout(reveal, 450),
            window.setTimeout(clearKeyboardRevealTimers, 1200),
        ];
        window.visualViewport?.addEventListener("resize", onViewportResize, {
            passive: true,
        });
        window.addEventListener("resize", onViewportResize, { passive: true });
        window.addEventListener("keyboardDidShow", onViewportResize);
    }

    function rotateDial(index, delta) {
        const current = Number(dialValues[index]) || 0;
        dialValues[index] = (current + delta + 10) % 10;
        dialValues = [...dialValues];
    }

    function rotateLetterDial(index, delta) {
        const alphabet = letterDialAlphabet;
        const current = String(letterDialValues[index] || alphabet[0] || "A");
        const pos = Math.max(0, alphabet.indexOf(current));
        const nextPos = (pos + delta + alphabet.length) % alphabet.length;
        letterDialValues[index] = alphabet[nextPos];
        letterDialValues = [...letterDialValues];
    }

    function shuffleArray(items) {
        const arr = [...items];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function resetLetterOrder() {
        const baseTiles = orderTargetWord.split("").map((char, idx) => ({
            id: `${idx}-${char}`,
            char,
        }));
        let shuffled = shuffleArray(baseTiles);
        let guard = 0;
        while (
            baseTiles.length > 1 &&
            shuffled.map((tile) => tile.char).join("") === orderTargetWord &&
            guard < 8
        ) {
            shuffled = shuffleArray(baseTiles);
            guard += 1;
        }
        orderTiles = shuffled;
        orderDragTileId = null;
        orderPointerId = null;
        orderPointerDragging = false;
        orderDropTargetTileId = null;
        orderLocked = false;
        clearOrderSolvedFlash();
    }

    function moveOrderTile(dragId, targetId) {
        if (orderLocked || reviewMode || completed || submitting) return;
        if (!dragId || !targetId || dragId === targetId) return;
        const from = orderTiles.findIndex((t) => t.id === dragId);
        const to = orderTiles.findIndex((t) => t.id === targetId);
        if (from < 0 || to < 0) return;
        const next = [...orderTiles];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        orderTiles = next;
    }

    function getOrderTileIdFromPoint(clientX, clientY) {
        if (typeof document === "undefined") return null;
        const target = document.elementFromPoint(clientX, clientY);
        const tile = target?.closest?.("[data-order-tile-id]");
        return tile?.getAttribute?.("data-order-tile-id") || null;
    }

    function handleOrderPointerDown(tileId, event) {
        if (reviewMode || completed || submitting || orderLocked) return;
        if (event.button !== undefined && event.button !== 0) return;
        detachOrderPointerListeners();
        orderDragTileId = tileId;
        orderPointerId = event.pointerId ?? null;
        orderPointerDragging = true;
        orderDropTargetTileId = null;
        attachOrderPointerListeners();
        event.preventDefault();
    }

    function handleOrderPointerMove(event) {
        if (!orderPointerDragging || !orderDragTileId) return;
        if (
            orderPointerId !== null &&
            event.pointerId !== undefined &&
            event.pointerId !== orderPointerId
        ) {
            return;
        }
        const targetTileId = getOrderTileIdFromPoint(
            event.clientX,
            event.clientY,
        );
        orderDropTargetTileId =
            targetTileId && targetTileId !== orderDragTileId
                ? targetTileId
                : null;
        event.preventDefault();
    }

    function handleOrderPointerUp(event) {
        if (!orderPointerDragging || !orderDragTileId) return;
        if (
            orderPointerId !== null &&
            event.pointerId !== undefined &&
            event.pointerId !== orderPointerId
        ) {
            return;
        }
        const targetTileId =
            orderDropTargetTileId ||
            getOrderTileIdFromPoint(event.clientX, event.clientY);
        if (targetTileId && targetTileId !== orderDragTileId) {
            moveOrderTile(orderDragTileId, targetTileId);
        }
        detachOrderPointerListeners();
        orderPointerId = null;
        orderPointerDragging = false;
        orderDropTargetTileId = null;
        orderDragTileId = null;
    }

    function attachOrderPointerListeners() {
        if (typeof window === "undefined") return;
        window.addEventListener("pointermove", handleOrderPointerMove, {
            passive: false,
        });
        window.addEventListener("pointerup", handleOrderPointerUp, {
            passive: false,
        });
        window.addEventListener("pointercancel", handleOrderPointerUp, {
            passive: false,
        });
    }

    function detachOrderPointerListeners() {
        if (typeof window === "undefined") return;
        window.removeEventListener("pointermove", handleOrderPointerMove);
        window.removeEventListener("pointerup", handleOrderPointerUp);
        window.removeEventListener("pointercancel", handleOrderPointerUp);
    }

    function clearOrderSolvedFlash() {
        if (orderSolvedFlashTimeout) {
            clearTimeout(orderSolvedFlashTimeout);
            orderSolvedFlashTimeout = null;
        }
        orderSolvedFlash = false;
    }

    function triggerOrderSolvedFlash() {
        clearOrderSolvedFlash();
        orderSolvedFlash = true;
        orderSolvedFlashTimeout = setTimeout(() => {
            orderSolvedFlash = false;
            orderSolvedFlashTimeout = null;
        }, 700);
    }

    function getCurrentAnswer() {
        if (answerMode === "LETTER_SLOTS") {
            return slotChars.join("");
        }
        if (answerMode === "LETTER_DIAL") {
            return letterDialValues.join("");
        }
        if (answerMode === "LETTER_ORDER") {
            return orderTiles.map((tile) => tile.char).join("");
        }
        if (answerMode === "NUMERIC_DIAL") {
            return dialValues.map((v) => String(v)).join("");
        }
        return answer.trim();
    }

    function handleSubmit() {
        const userAnswer = getCurrentAnswer();
        if (!userAnswer.trim()) return;
        const usedHintIds = normalizeUsedHintIds(
            revealedHintIds,
            moduleHints,
            hintUsed,
        );
        wrongAnswer = false;
        dispatch("complete", {
            moduleId: module.id,
            answer: userAnswer,
            failures,
            hintUsed: usedHintIds.length > 0,
            hintsUsed: usedHintIds,
        });
    }

    function revealHint(hint) {
        const id = String(hint?.id || "");
        if (!id) return;
        if (!revealedHintIds.includes(id)) {
            const nextHintIds = [...revealedHintIds, id];
            revealedHintIds = nextHintIds;
            if (typeof checkpointAttempt === "function") {
                void checkpointAttempt({
                    version: 1,
                    hintsUsed: nextHintIds,
                });
            }
        }
    }

    // Called from parent when answer is wrong
    export function setWrongAnswer() {
        wrongAnswer = true;
        failures++;
    }

    onDestroy(() => {
        detachOrderPointerListeners();
        clearOrderSolvedFlash();
        clearKeyboardRevealTimers();
        if (slotFocusRestoreFrame !== null) {
            cancelAnimationFrame(slotFocusRestoreFrame);
            slotFocusRestoreFrame = null;
        }
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
            on:play={() => (isPlaying = true)}
            on:pause={() => (isPlaying = false)}
            on:ended={() => (isPlaying = false)}
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
                class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-bold text-primary px-2.5 py-1 rounded-full shadow-sm z-10"
            >
                +{module.points} pts
            </div>
        {/if}
    </div>
{:else if module.content?.image}
    <div class="relative w-full bg-gray-200">
        {#if usesInteractiveQuestionImage}
            <InteractiveImageReveal {interfaceLocale}
                baseImage={module.content.image}
                overlayImage={xrayImage}
                mode={imageInteractionMode}
                config={imageInteractionConfig}
                aspectRatio={imageAspectRatio}
                fit="cover"
                alt="Módulo"
            />
        {:else}
            <div
                class="relative w-full overflow-hidden"
                style={`aspect-ratio: ${imageAspectRatio};`}
            >
                <FadeImage
                    src={module.content.image}
                    alt="Módulo"
                    loading="eager"
                    wrapperClass="w-full h-full"
                    imageClass="object-cover"
                />
            </div>
        {/if}
        {#if module.points > 0 && !completed}
            <div
                class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-bold text-primary px-2.5 py-1 rounded-full shadow-sm z-20"
            >
                +{module.points} pts
            </div>
        {/if}
    </div>
{/if}

<!-- Audio player -->
{#if isAudio}
    <div class="px-5 pt-4 pb-0">
        <audio controls class="w-full">
            <source src={mediaUrl} />
            {ui.text("Tu navegador no soporta audio.",interfaceLocale)}
        </audio>
    </div>
{:else if audioUrl}
    <div class="px-5 pt-4 pb-0">
        <audio controls class="w-full">
            <source src={audioUrl} type="audio/mpeg" />
        </audio>
    </div>
{/if}

<!-- Module Body -->
<div class="module-question-surface rt-readable-surface px-5 py-6 space-y-5">
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
            <h3 class="module-question-title text-xl font-bold mb-2">{moduleTitle}</h3>
        {/if}
    {/if}

    <!-- Question text (HTML) -->
    {#if getLocalized(module.content)}
        <div
            class="module-question-content rt-rich-text rt-readable-content prose prose-sm max-w-none [&_p]:m-0 [&_p+p]:mt-4 [&_ul]:my-4 [&_ol]:my-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li+li]:mt-1.5 [&_h1]:mt-5 [&_h1]:mb-3 [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:mt-4 [&_h3]:mb-2"
        >
            {@html getLocalized(module.content)}
        </div>
    {/if}

    <!-- Question interaction (not completed) -->
    {#if reviewMode}
        <div class="space-y-3 pt-2">
            <div class="rt-secondary-notice p-3.5 rounded-xl text-sm">
                {ui.text("Estás revisando tu respuesta guardada. No se pueden enviar cambios ni ganar puntos.",interfaceLocale)}
            </div>
            {#if answerMode === "LETTER_SLOTS"}
                <div class="slot-grid">
                    {#each reviewChars as ch}
                        <input
                            value={ch.trim()}
                            maxlength="1"
                            class="slot-input text-base sm:text-[15px]"
                            disabled
                        />
                    {/each}
                </div>
            {:else if answerMode === "NUMERIC_DIAL" || answerMode === "LETTER_DIAL"}
                <div class="dial-row">
                    {#each Array.from(reviewAnswer || "") as char}
                        <div class="dial-col">
                            <div class="dial-digit opacity-80">{char}</div>
                        </div>
                    {/each}
                </div>
            {:else if answerMode === "LETTER_ORDER"}
                <div class="space-y-3">
                    <div class="order-board">
                        {#each Array.from(reviewAnswer || "") as char, idx}
                            <div class="order-tile" data-review-id={idx}>
                                {char}
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <input
                    type="text"
                    value={reviewAnswer}
                    readonly
                    class="answer-text-input answer-text-input-review w-full p-3.5 rounded-xl outline-none text-base sm:text-[15px]"
                />
            {/if}
        </div>
    {:else if !completed}
        <div
            bind:this={answerInteractionEl}
            class="space-y-3 pt-2"
            on:focusin={handleAnswerFocusIn}
        >
            {#if answerMode === "LETTER_SLOTS"}
                <div class="slot-grid">
                    {#each slotChars as ch, idx}
                        <input
                            bind:this={slotInputs[idx]}
                            aria-label={ui.text("Letra ",interfaceLocale)+(idx+1)}
                            value={ch}
                            maxlength="1"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="none"
                            spellcheck="false"
                            class="slot-input keyboard-safe-field {wrongAnswer
                                ? 'slot-input-wrong'
                                : ''}"
                            on:input={(e) => handleSlotInput(idx, e)}
                            on:keydown={(e) => handleSlotKeydown(idx, e)}
                        />
                    {/each}
                </div>
            {:else if answerMode === "NUMERIC_DIAL"}
                <div class="dial-row">
                    {#each dialValues as digit, idx}
                        <div class="dial-col">
                            <button
                                type="button"
                                class="dial-btn"
                                on:click={() => rotateDial(idx, 1)}
                            >
                                ▲
                            </button>
                            <div
                                class="dial-digit {wrongAnswer
                                    ? 'dial-digit-wrong'
                                    : ''}"
                            >
                                {digit}
                            </div>
                            <button
                                type="button"
                                class="dial-btn"
                                on:click={() => rotateDial(idx, -1)}
                            >
                                ▼
                            </button>
                        </div>
                    {/each}
                </div>
            {:else if answerMode === "LETTER_DIAL"}
                <div class="dial-row">
                    {#each letterDialValues as letter, idx}
                        <div class="dial-col">
                            <button
                                type="button"
                                class="dial-btn"
                                on:click={() => rotateLetterDial(idx, 1)}
                            >
                                ▲
                            </button>
                            <div
                                class="dial-digit {wrongAnswer
                                    ? 'dial-digit-wrong'
                                    : ''}"
                            >
                                {letter}
                            </div>
                            <button
                                type="button"
                                class="dial-btn"
                                on:click={() => rotateLetterDial(idx, -1)}
                            >
                                ▼
                            </button>
                        </div>
                    {/each}
                </div>
            {:else if answerMode === "LETTER_ORDER"}
                <div class="space-y-3">
                    <p class="question-helper-text text-xs {orderLocked
                        ? 'question-helper-success font-semibold'
                        : ''}">
                        {#if orderLocked}
                            {ui.text("Palabra correcta. Letras bloqueadas.",interfaceLocale)}
                        {:else}
                            {ui.text("Arrastra los cuadrados para ordenar las letras correctamente y luego pulsa continuar para comprobarla.",interfaceLocale)}
                        {/if}
                    </p>
                    <div
                        class="order-board {orderSolvedFlash
                            ? 'order-board-solved'
                            : ''}"
                    >
                        {#each orderTiles as tile (tile.id)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="order-tile {orderDragTileId === tile.id
                                    ? 'order-tile-dragging'
                                    : ''} {orderDropTargetTileId === tile.id
                                    ? 'order-tile-drop-target'
                                    : ''} {orderLocked
                                    ? 'order-tile-locked'
                                    : ''}"
                                data-order-tile-id={tile.id}
                                on:pointerdown={(e) =>
                                    handleOrderPointerDown(tile.id, e)}
                            >
                                {tile.char}
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <input
                    type="text"
                    bind:value={answer}
                    aria-label={ui.text("Tu respuesta",interfaceLocale)}
                    placeholder={ui.text("Escribe tu respuesta...",interfaceLocale)}
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="none"
                    spellcheck="false"
                    class="answer-text-input keyboard-safe-field w-full p-3.5 rounded-xl focus:ring-0 outline-none transition-all text-base sm:text-[15px]
                        {wrongAnswer
                        ? 'answer-text-input-wrong'
                        : ''}"
                    on:keydown={(e) => {
                        if (e.key === "Enter") handleSubmit();
                    }}
                />
            {/if}

            {#if wrongAnswer}
                <p
                    class="text-red-500 text-sm font-medium flex items-center gap-1"
                    in:fly={{ y: -5, duration: 200 }}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    {ui.text("Respuesta incorrecta. ¡Inténtalo de nuevo!",interfaceLocale)}
                </p>
            {/if}

            <!-- Hints -->
            {#if moduleHints.length > 0}
                <div class="space-y-2">
                    {#each visibleHints as hint, hintIndex (hint.id)}
                        <div
                            class="module-hint-card p-3.5 rounded-xl text-sm"
                            in:fly={{ y: -5, duration: 200 }}
                        >
                            <div
                                class="mb-1 flex items-center justify-between gap-3 text-xs font-bold uppercase text-primary"
                            >
                                <span>{ui.text("Pista",interfaceLocale)} {hintIndex + 1}</span>
                                <span class="module-hint-penalty shrink-0">
                                    -{hint.penaltyPercent}%
                                </span>
                            </div>
                            {getLocalizedHintText(hint, currentLang)}
                        </div>
                    {/each}
                    {#if nextHint}
                        <button
                            type="button"
                            on:click={() => revealHint(nextHint)}
                            class="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1.5 transition-colors"
                        >
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
                                    stroke-width="2"
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                            {ui.text("Ver pista",interfaceLocale)} {revealedHintIds.length + 1}
                            <span class="module-hint-penalty text-xs">
                                (-{nextHint.penaltyPercent}%)
                            </span>
                        </button>
                    {/if}
                </div>
            {/if}

            <button
                on:click={handleSubmit}
                disabled={submitting || !canSubmitAnswer || orderLocked}
                class="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
            >
                {submitting
                    ? ui.text("Enviando...",interfaceLocale)
                    : answerMode === "LETTER_ORDER"
                      ? ui.text("Continuar",interfaceLocale)
                      : ui.text("Enviar Respuesta",interfaceLocale)}
            </button>
        </div>
    {:else}
        <!-- Completed state -->
        <div class="module-success-card p-4 rounded-xl space-y-3">
            {#if answerMode === "LETTER_ORDER"}
                <div class="order-board">
                    {#each Array.from(orderSolvedAnswer) as char, idx}
                        <div class="order-tile order-tile-locked" data-complete-id={idx}>
                            {char}
                        </div>
                    {/each}
                </div>
            {/if}
            <p
                class="module-success-text text-sm font-medium flex items-center gap-2"
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
                {#if answerMode === "LETTER_ORDER"}
                    {ui.text("Palabra correcta. Letras bloqueadas.",interfaceLocale)}
                {:else}
                    {ui.text("¡Respuesta correcta! Módulo completado.",interfaceLocale)}
                {/if}
            </p>
        </div>
    {/if}
</div>

<style>
    .module-question-surface {
        color: var(--rt-text-secondary, #374151);
    }

    .module-question-title {
        color: var(--rt-text-primary, #111827);
    }

    .module-question-content {
        color: var(--rt-text-secondary, #374151);
    }

    .module-question-content :global(p),
    .module-question-content :global(li),
    .module-question-content :global(span),
    .module-question-content :global(div),
    .module-question-content :global(blockquote) {
        color: var(--rt-text-secondary, #374151) !important;
    }

    .module-question-content :global(h1),
    .module-question-content :global(h2),
    .module-question-content :global(h3),
    .module-question-content :global(h4),
    .module-question-content :global(strong) {
        color: var(--rt-text-primary, #111827) !important;
    }

    .module-question-content :global(a) {
        color: var(--color-primary, #f59e0b) !important;
    }

    .module-question-content :global(ul) {
        list-style: disc;
        padding-left: 1.5rem;
        margin: 0.75rem 0;
    }

    .module-question-content :global(ol) {
        list-style: decimal;
        padding-left: 1.5rem;
        margin: 0.75rem 0;
    }

    .module-question-content :global(li) {
        margin: 0.25rem 0;
    }

    .answer-text-input {
        border: 2px solid var(--rt-border-subtle, #e5e7eb);
        background: var(--rt-surface-card, #ffffff);
        color: var(--rt-text-primary, #111827);
        caret-color: var(--color-primary, #f59e0b);
    }

    .answer-text-input::placeholder {
        color: var(--rt-text-muted, #6b7280);
    }

    .answer-text-input:focus {
        border-color: var(--color-primary, #f59e0b);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #f59e0b) 20%, transparent);
    }

    .answer-text-input-review {
        background: var(--rt-surface-soft, #f9fafb);
        color: var(--rt-text-secondary, #374151);
    }

    .answer-text-input-wrong {
        border-color: #f87171;
        background: color-mix(in srgb, #ef4444 10%, var(--rt-surface-card, #ffffff));
    }

    .question-helper-text {
        color: var(--rt-text-muted, #6b7280);
    }

    .question-helper-success {
        color: #047857;
    }

    :global(:root[data-rt-theme="dark"]) .question-helper-success {
        color: #86efac;
    }

    .module-hint-card {
        border: 1px solid color-mix(in srgb, var(--color-primary, #f59e0b) 26%, var(--rt-border-subtle, #e5e7eb));
        background: color-mix(in srgb, var(--color-primary, #f59e0b) 10%, var(--rt-surface-card, #ffffff));
        color: var(--rt-text-secondary, #374151);
    }

    .module-hint-penalty {
        color: var(--rt-text-muted, #6b7280);
    }

    .module-success-card {
        border: 1px solid color-mix(in srgb, #10b981 30%, var(--rt-border-subtle, #e5e7eb));
        background: color-mix(in srgb, #10b981 12%, var(--rt-surface-card, #ffffff));
    }

    .module-success-text {
        color: #047857;
    }

    :global(:root[data-rt-theme="dark"]) .module-success-text {
        color: #86efac;
    }

    .keyboard-safe-field {
        scroll-margin-bottom: calc(
            var(--app-footer-height, 5rem) + 2rem
        );
        scroll-margin-top: 1rem;
    }

    .slot-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(2.2rem, 1fr));
        gap: 0.45rem;
    }

    .slot-input {
        height: 3rem;
        border: 2px solid var(--rt-border-subtle, #e5e7eb);
        border-radius: 0.75rem;
        text-align: center;
        font-size: 1.2rem;
        font-weight: 700;
        text-transform: uppercase;
        background: var(--rt-surface-card, #ffffff);
        color: var(--rt-text-primary, #111827);
        caret-color: var(--color-primary, #f59e0b);
        outline: none;
    }

    .slot-input:focus {
        border-color: var(--color-primary, #f59e0b);
    }

    .slot-input-wrong {
        border-color: #f87171;
        background: color-mix(in srgb, #ef4444 10%, var(--rt-surface-card, #ffffff));
        color: var(--rt-text-primary, #111827);
    }

    .dial-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(3.4rem, 1fr));
        gap: 0.5rem;
    }

    .dial-col {
        border: 2px solid var(--rt-border-subtle, #e5e7eb);
        border-radius: 0.75rem;
        overflow: hidden;
        background: var(--rt-surface-card, #ffffff);
        color: var(--rt-text-primary, #111827);
        display: grid;
        grid-template-rows: auto 1fr auto;
    }

    .dial-btn {
        border: 0;
        background: var(--rt-surface-soft, #f8fafc);
        color: var(--rt-text-secondary, #374151);
        font-weight: 700;
        height: 2rem;
        transition:
            background-color 0.15s ease,
            color 0.15s ease;
    }

    .dial-btn:hover,
    .dial-btn:focus-visible {
        background: var(--rt-surface-hover, #f1f5f9);
        color: var(--rt-text-primary, #111827);
    }

    .dial-digit {
        display: grid;
        place-items: center;
        font-size: 1.6rem;
        font-weight: 800;
        min-height: 3rem;
        color: var(--rt-text-primary, #111827);
    }

    .dial-digit-wrong {
        background: color-mix(in srgb, #ef4444 10%, var(--rt-surface-card, #ffffff));
        color: #b91c1c;
    }

    :global(:root[data-rt-theme="dark"]) .dial-digit-wrong {
        color: #fca5a5;
    }

    .order-board {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
        gap: 0.5rem;
        touch-action: none;
        transition:
            box-shadow 180ms ease,
            transform 180ms ease;
    }

    .order-board-solved {
        animation: order-solved-flash 700ms ease;
    }

    .order-tile {
        height: 3rem;
        border: 2px solid var(--rt-border-subtle, #d1d5db);
        border-radius: 0.75rem;
        background: var(--rt-surface-card, #ffffff);
        color: var(--rt-text-primary, #111827);
        display: grid;
        place-items: center;
        font-size: 1.25rem;
        font-weight: 800;
        user-select: none;
        cursor: grab;
        transition:
            transform 140ms ease,
            border-color 140ms ease,
            background-color 140ms ease,
            box-shadow 140ms ease;
    }

    .order-tile:active {
        cursor: grabbing;
    }

    .order-tile-dragging {
        opacity: 0.5;
        border-color: var(--color-primary, #f59e0b);
        box-shadow: 0 8px 24px rgb(245 158 11 / 0.2);
    }

    .order-tile-drop-target {
        border-color: var(--color-primary, #f59e0b);
        background: color-mix(in srgb, var(--color-primary, #f59e0b) 14%, var(--rt-surface-card, #ffffff));
        transform: translateY(-2px);
    }

    .order-tile-locked {
        cursor: default;
        border-color: #10b981;
        background: color-mix(in srgb, #10b981 14%, var(--rt-surface-card, #ffffff));
        color: #047857;
        box-shadow: 0 0 0 1px rgb(16 185 129 / 0.12);
    }

    :global(:root[data-rt-theme="dark"]) .order-tile-locked {
        color: #86efac;
    }

    @keyframes order-solved-flash {
        0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgb(16 185 129 / 0);
        }
        35% {
            transform: scale(1.015);
            box-shadow: 0 0 0.9rem rgb(16 185 129 / 0.28);
        }
        100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgb(16 185 129 / 0);
        }
    }
</style>
