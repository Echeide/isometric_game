// @ts-nocheck
export const BASE_IMAGE_INTERACTION_MODES = [
    "NONE",
    "TORCH",
    "MAGNIFIER",
    "XRAY",
];

export const EXTENDED_IMAGE_INTERACTION_MODES = [
    ...BASE_IMAGE_INTERACTION_MODES,
    "SCRATCH",
    "SLIDER",
];

export const DEFAULT_IMAGE_INTERACTION_CONFIG = Object.freeze({
    torchRadius: 130,
    magnifierZoom: 2,
    magnifierRadius: 120,
    xrayRadius: 120,
    scratchRadius: 56,
});

export function clampInteractionNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

export function normalizeImageInteractionMode(
    value,
    allowedModes = BASE_IMAGE_INTERACTION_MODES,
) {
    const raw = String(value || "").trim().toUpperCase();
    return allowedModes.includes(raw) ? raw : "NONE";
}

export function normalizeImageInteractionConfig(rawConfig) {
    const config =
        rawConfig && typeof rawConfig === "object" ? rawConfig : {};

    return {
        torchRadius: clampInteractionNumber(
            config.torchRadius,
            40,
            320,
            DEFAULT_IMAGE_INTERACTION_CONFIG.torchRadius,
        ),
        magnifierZoom: clampInteractionNumber(
            config.magnifierZoom,
            1.2,
            4,
            DEFAULT_IMAGE_INTERACTION_CONFIG.magnifierZoom,
        ),
        magnifierRadius: clampInteractionNumber(
            config.magnifierRadius,
            60,
            240,
            DEFAULT_IMAGE_INTERACTION_CONFIG.magnifierRadius,
        ),
        xrayRadius: clampInteractionNumber(
            config.xrayRadius,
            60,
            260,
            DEFAULT_IMAGE_INTERACTION_CONFIG.xrayRadius,
        ),
        scratchRadius: clampInteractionNumber(
            config.scratchRadius,
            20,
            120,
            DEFAULT_IMAGE_INTERACTION_CONFIG.scratchRadius,
        ),
    };
}

export function getImageInteractionModeLabel(mode) {
    switch (String(mode || "").toUpperCase()) {
        case "TORCH":
            return "Linterna";
        case "MAGNIFIER":
            return "Lupa";
        case "XRAY":
            return "Rayos X";
        case "SCRATCH":
            return "Rasca";
        case "SLIDER":
            return "Dividir";
        default:
            return "Sin efecto";
    }
}

export function parseAspectRatio(value, fallback = "16 / 9") {
    const raw = String(value || "").trim();
    if (!raw) return fallback;
    const [a, b] = raw.includes(":") ? raw.split(":") : raw.split("/");
    const left = Number(a);
    const right = Number(b);
    if (
        Number.isFinite(left) &&
        Number.isFinite(right) &&
        left > 0 &&
        right > 0
    ) {
        return `${left} / ${right}`;
    }
    return fallback;
}
