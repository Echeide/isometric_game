<script>
    // @ts-nocheck — legacy player copied from RoutingTales; typed adapter validates its payload.
    import { onMount, onDestroy, createEventDispatcher } from "svelte";
    import {safeModuleHtml} from "../../rich-text";

    /** @type {string} */
    export let interfaceLocale = "es";
    export let readOnly = false;
    import {translate} from "$lib/i18n/messages";
    export let value = "";
    export let label = "Contenido enriquecido";
    /** @type {string} */
    export let placeholder = "Escribe aquí...";
    /** @type {"basic" | "enhanced"} */
    export let toolbarMode = "basic";

    const dispatch = createEventDispatcher();

    const basicToolbar = [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
    ];
    const enhancedToolbar = [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline"],
        ["blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
    ];

    $: toolbarConfig =
        toolbarMode === "enhanced" ? enhancedToolbar : basicToolbar;

    /** @type {HTMLDivElement | null} */
    let editorContainer = null;
    /** @type {any} */
    let quill = null;
    let internalUpdate = false;

    import "quill/dist/quill.snow.css";

    onMount(async () => {
        const Quill = (await import("quill")).default;
        if (!editorContainer) return;

        quill = new Quill(editorContainer, {
            theme: "snow",
            readOnly,
            placeholder:translate(placeholder,interfaceLocale),
            modules: {
                toolbar: readOnly?false:toolbarConfig,
            },
        });

        quill.root.setAttribute("role", "textbox");
        quill.root.setAttribute("aria-label", translate(label,interfaceLocale));
        quill.root.setAttribute("aria-multiline", "true");

        // Set initial content
        if (value) {
            quill.clipboard.dangerouslyPasteHTML(safeModuleHtml(value), "silent");
        }

        // Listen for text changes
        quill.on("text-change", () => {
            if (internalUpdate) return;
            const html = quill.root.innerHTML;
            // Quill uses <p><br></p> for empty content
            const cleanValue = html === "<p><br></p>" ? "" : html;
            dispatch("change", cleanValue);
        });
    });

    onDestroy(() => {
        if (quill) {
            quill = null;
        }
    });

    $: if(quill){quill.enable(!readOnly);quill.root.setAttribute("aria-readonly",String(readOnly));quill.root.setAttribute("aria-label",translate(label,interfaceLocale));quill.root.setAttribute("data-placeholder",translate(placeholder,interfaceLocale));}

    // Watch for external value changes (e.g. language switch)
    $: if (quill && value !== undefined) {
        const currentHtml = quill.root.innerHTML;
        const normalizedCurrent =
            currentHtml === "<p><br></p>" ? "" : currentHtml;
        if (normalizedCurrent !== value) {
            internalUpdate = true;
            quill.clipboard.dangerouslyPasteHTML(safeModuleHtml(value || ""), "silent");
            internalUpdate = false;
        }
    }
</script>

<div class="rich-text-editor">
    <div bind:this={editorContainer}></div>
</div>

<style>
    .rich-text-editor {
        border: 1px solid var(--rt-border-subtle, #e5e7eb);
        border-radius: 0.75rem;
        overflow: hidden;
        background: var(--rt-surface-card, #f9fafb);
        color: var(--rt-text-primary, #111827);
        transition: all 0.2s;
    }

    .rich-text-editor:focus-within {
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 0 0 2px
            color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent);
    }

    /* Quill toolbar styling */
    .rich-text-editor :global(.ql-toolbar) {
        border: none !important;
        border-bottom: 1px solid var(--rt-border-subtle, #e5e7eb) !important;
        background: var(--rt-surface-soft, #f3f4f6);
        padding: 6px 8px !important;
    }

    .rich-text-editor :global(.ql-toolbar .ql-picker-label),
    .rich-text-editor :global(.ql-toolbar .ql-picker-item) {
        color: var(--rt-text-secondary, #4b5563);
    }

    .rich-text-editor :global(.ql-toolbar .ql-picker.ql-header) {
        width: 5.5rem;
    }

    .rich-text-editor :global(.ql-toolbar .ql-stroke) {
        stroke: var(--rt-text-muted, #6b7280);
    }

    .rich-text-editor :global(.ql-toolbar .ql-fill) {
        fill: var(--rt-text-muted, #6b7280);
    }

    .rich-text-editor :global(.ql-toolbar button:hover .ql-stroke) {
        stroke: var(--color-primary, #3b82f6);
    }

    .rich-text-editor :global(.ql-toolbar button:hover .ql-fill) {
        fill: var(--color-primary, #3b82f6);
    }

    .rich-text-editor :global(.ql-toolbar button.ql-active .ql-stroke) {
        stroke: var(--color-primary, #3b82f6);
    }

    .rich-text-editor :global(.ql-toolbar button.ql-active .ql-fill) {
        fill: var(--color-primary, #3b82f6);
    }

    /* Editor content area */
    .rich-text-editor :global(.ql-container) {
        border: none !important;
        background: var(--rt-surface-card, #ffffff);
        font-family: inherit;
        font-size: 0.875rem;
    }

    .rich-text-editor :global(.ql-editor) {
        min-height: 100px;
        padding: 12px 16px;
        color: var(--rt-text-secondary, #374151);
        line-height: 1.6;
    }

    .rich-text-editor :global(.ql-editor.ql-blank::before) {
        color: var(--rt-text-muted, #9ca3af);
        font-style: normal;
    }

    /* Content formatting */
    .rich-text-editor :global(.ql-editor p) {
        margin-bottom: 0.5em;
    }

    .rich-text-editor :global(.ql-editor h2) {
        margin: 1rem 0 0.5rem;
        color: var(--rt-text-primary, #111827);
        font-size: 1.125rem;
        font-weight: 700;
        line-height: 1.3;
    }

    .rich-text-editor :global(.ql-editor h3) {
        margin: 0.875rem 0 0.45rem;
        color: var(--rt-text-primary, #1f2937);
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.35;
    }

    .rich-text-editor :global(.ql-editor blockquote) {
        margin: 1rem 0;
        border-left: 3px solid var(--color-primary, #3b82f6);
        border-radius: 0 0.75rem 0.75rem 0;
        background: color-mix(
            in srgb,
            var(--color-primary, #3b82f6) 8%,
            var(--rt-surface-soft, white)
        );
        padding: 0.75rem 1rem;
        color: var(--rt-text-secondary, #4b5563);
        font-style: italic;
    }

    .rich-text-editor :global(.ql-editor blockquote + blockquote) {
        margin-top: -1rem;
        border-top-right-radius: 0;
        padding-top: 0.35rem;
    }

    .rich-text-editor :global(.ql-editor blockquote:has(+ blockquote)) {
        border-bottom-right-radius: 0;
        padding-bottom: 0.35rem;
    }

    .rich-text-editor
        :global(.ql-editor blockquote + blockquote:not(:has(+ blockquote))) {
        border-bottom-right-radius: 0.75rem;
        padding-bottom: 0.75rem;
    }

    .rich-text-editor :global(.ql-editor ul),
    .rich-text-editor :global(.ql-editor ol) {
        padding-left: 1.5em;
    }

    .rich-text-editor :global(.ql-editor a) {
        color: var(--color-primary, #3b82f6);
        text-decoration: underline;
    }

    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: rgb(0, 0, 0)"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: black"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: #000"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color:#000"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: rgb(17, 24, 39)"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: rgb(31, 41, 55)"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: rgb(55, 65, 81)"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor [style*="color: rgb(75, 85, 99)"]) {
        color: var(--rt-text-secondary, #cbd5e1) !important;
    }

    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h1 [style*="color:"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h2 [style*="color:"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h3 [style*="color:"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h4 [style*="color:"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h5 [style*="color:"]),
    :global(:root[data-rt-theme="dark"] .rich-text-editor .ql-editor h6 [style*="color:"]) {
        color: var(--rt-text-primary, #f8fafc) !important;
    }

    .rich-text-editor :global(.ql-picker-options) {
        border-color: var(--rt-border-subtle, #e5e7eb) !important;
        background: var(--rt-surface-card, #ffffff) !important;
        box-shadow: var(--rt-shadow-floating, 0 10px 28px rgb(15 23 42 / 0.14));
    }

    .rich-text-editor :global(.ql-toolbar button:hover),
    .rich-text-editor :global(.ql-toolbar .ql-picker-label:hover) {
        background: var(--rt-surface-hover, #e5e7eb);
    }
</style>
