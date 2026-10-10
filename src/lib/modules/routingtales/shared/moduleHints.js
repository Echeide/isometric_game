// @ts-nocheck
export const MAX_MODULE_PENALTY_PERCENT = 40;
export const DEFAULT_HINT_PENALTY_STEP_PERCENT = 5;

function clampPercent(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(MAX_MODULE_PENALTY_PERCENT, Math.round(numeric)));
}

function normalizeLocalizedText(value) {
    if (!value) return {};
    if (typeof value === "string") return { es: value };
    if (typeof value !== "object") return {};

    return Object.fromEntries(
        Object.entries(value)
            .filter(([lang]) => typeof lang === "string" && lang.trim())
            .map(([lang, text]) => [lang, text == null ? "" : String(text)]),
    );
}

function hasLocalizedText(value) {
    return Object.values(normalizeLocalizedText(value)).some((text) =>
        String(text || "").trim(),
    );
}

export function getDefaultHintPenaltyPercent(index = 0) {
    return clampPercent(
        (Math.max(0, Number(index) || 0) + 1) *
            DEFAULT_HINT_PENALTY_STEP_PERCENT,
        DEFAULT_HINT_PENALTY_STEP_PERCENT,
    );
}

export function getLocalizedHintText(hint, lang = "es") {
    const text = normalizeLocalizedText(hint?.text ?? hint);
    return (
        text[lang] ||
        text.es ||
        Object.values(text).find((value) => String(value || "").trim()) ||
        ""
    );
}

export function createModuleHint(index = 0, overrides = {}) {
    return {
        id: String(overrides.id || `hint-${Date.now()}-${index + 1}`),
        text: normalizeLocalizedText(
            overrides.text ??
                overrides.content ??
                overrides.value ??
                overrides.hint ??
                {},
        ),
        penaltyPercent: clampPercent(
            overrides.penaltyPercent ?? overrides.penalty,
            getDefaultHintPenaltyPercent(index),
        ),
    };
}

export function normalizeModuleHints(content = {}, options = {}) {
    const includeEmpty = options.includeEmpty === true;
    const rawHints = Array.isArray(content?.hints) ? content.hints : [];

    const normalized = rawHints
        .map((hint, index) => {
            const text =
                hint && typeof hint === "object" && !Array.isArray(hint)
                    ? normalizeLocalizedText(
                          hint.text ??
                              hint.content ??
                              hint.value ??
                              hint.hint ??
                              {},
                      )
                    : normalizeLocalizedText(hint);
            return {
                id: String(
                    hint && typeof hint === "object" && hint.id
                        ? hint.id
                        : `hint-${index + 1}`,
                ),
                text,
                penaltyPercent: clampPercent(
                    hint && typeof hint === "object"
                        ? hint.penaltyPercent ?? hint.penalty
                        : undefined,
                    getDefaultHintPenaltyPercent(index),
                ),
            };
        })
        .filter((hint) => includeEmpty || hasLocalizedText(hint.text));

    if (normalized.length > 0) return normalized;

    const legacyText = normalizeLocalizedText(content?.hint);
    if (includeEmpty || hasLocalizedText(legacyText)) {
        return [
            {
                id: "hint-1",
                text: legacyText,
                penaltyPercent: DEFAULT_HINT_PENALTY_STEP_PERCENT,
            },
        ];
    }

    return [];
}

/**
 * @param {unknown} rawUsedHintIds
 * @param {Array<{ id?: string }>} [hints]
 * @param {boolean} [legacyHintUsed]
 * @returns {string[]}
 */
export function normalizeUsedHintIds(rawUsedHintIds, hints = [], legacyHintUsed = false) {
    const availableIds = new Set(
        (Array.isArray(hints) ? hints : [])
            .map((hint) => String(hint?.id || ""))
            .filter(Boolean),
    );
    const rawIds = Array.isArray(rawUsedHintIds)
        ? rawUsedHintIds
        : typeof rawUsedHintIds === "string"
          ? [rawUsedHintIds]
          : [];

    const ids = rawIds
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .filter((id) => availableIds.size === 0 || availableIds.has(id));

    if (ids.length === 0 && legacyHintUsed === true) {
        const firstHintId = String(hints?.[0]?.id || "").trim();
        if (firstHintId) return [firstHintId];
    }

    return ids;
}

/**
 * @param {Record<string, any>} [content]
 * @param {string[]} [usedHintIds]
 * @param {boolean} [legacyHintUsed]
 */
export function getHintsPenaltyPercent(content = {}, usedHintIds = [], legacyHintUsed = false) {
    const hints = normalizeModuleHints(content);
    const ids = normalizeUsedHintIds(usedHintIds, hints, legacyHintUsed);
    const usedIds = new Set(ids);
    const total = hints.reduce((sum, hint) => {
        if (!usedIds.has(String(hint.id))) return sum;
        return sum + clampPercent(hint.penaltyPercent, 0);
    }, 0);

    return clampPercent(total, 0);
}

/**
 * @param {{
 *   content?: Record<string, any>,
 *   failures?: number,
 *   hintsUsed?: string[],
 *   hintUsed?: boolean
 * }} [params]
 */
export function getModulePenaltyPercent({
    content = {},
    failures = 0,
    hintsUsed = [],
    hintUsed = false,
} = {}) {
    const hintPenalty = getHintsPenaltyPercent(content, hintsUsed, hintUsed);
    const failurePenalty =
        Math.max(0, Number(failures) || 0) * DEFAULT_HINT_PENALTY_STEP_PERCENT * 2;
    return clampPercent(hintPenalty + failurePenalty, 0);
}
