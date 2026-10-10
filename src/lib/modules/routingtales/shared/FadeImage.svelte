<script>
    // @ts-nocheck — legacy player copied from RoutingTales; typed adapter validates its payload.
    export let src = "";
    export let alt = "";
    export let wrapperClass = "";
    export let imageClass = "";
    export let placeholderClass = "bg-gray-200 animate-pulse";
    /** @type {"lazy" | "eager"} */
    export let loading = "lazy";
    /** @type {"async" | "auto" | "sync"} */
    export let decoding = "async";
    export let fallbackSrc = "";
    /** @type {((event: Event) => void) | null} */
    export let onLoad = null;
    /** @type {(() => void) | null} */
    export let onError = null;

    let loaded = false;
    let lastSrc = "";
    let currentSrc = "";
    let fallbackApplied = false;

    $: if (src !== lastSrc) {
        lastSrc = src;
        currentSrc = src;
        loaded = !src;
        fallbackApplied = false;
    }

    function handleError() {
        if (!fallbackApplied && fallbackSrc && fallbackSrc !== currentSrc) {
            fallbackApplied = true;
            currentSrc = fallbackSrc;
            return;
        }
        loaded = true;
        if (typeof onError === "function") {
            onError();
        }
    }

    /** @param {Event} event */
    function handleLoad(event) {
        if (typeof onLoad === "function") {
            onLoad(event);
        }
        loaded = true;
    }
</script>

<div class={`overflow-hidden ${wrapperClass}`.trim()} style="position:{wrapperClass.includes('absolute') ? 'absolute' : 'relative'}">
    {#if !loaded}
        <div class={`absolute inset-0 ${placeholderClass}`.trim()}></div>
    {/if}

    {#if currentSrc}
        <img
            src={currentSrc}
            {alt}
            {loading}
            {decoding}
            class={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${loaded ? "opacity-100" : "opacity-0"} ${imageClass}`.trim()}
            on:load={handleLoad}
            on:error={handleError}
        />
    {/if}

    <slot />
</div>
