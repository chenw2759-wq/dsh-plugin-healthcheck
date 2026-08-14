/**
 * Shared wire/type layer between the host checkers and the browser panel.
 * Pure types + pure helpers only — no runtime identity (Symbol/class) that
 * bundling would duplicate. Mirrors the aionui-panel core/types discipline.
 * @module dsh-plugin-healthcheck/core/types
 */
/** Build an ok envelope. */
export function okEnvelope(value) {
    return { ok: true, value };
}
/** Build a failure envelope. */
export function failEnvelope(code, message) {
    return { ok: false, error: { code, message } };
}
/** Rank severities for run summaries. */
export function severityRank(severity) {
    return severity === 'error' ? 2 : severity === 'warn' ? 1 : 0;
}
