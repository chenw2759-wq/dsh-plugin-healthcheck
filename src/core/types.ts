/**
 * Shared wire/type layer between the host checkers and the browser panel.
 * Pure types + pure helpers only — no runtime identity (Symbol/class) that
 * bundling would duplicate. Mirrors the aionui-panel core/types discipline.
 * @module dsh-plugin-healthcheck/core/types
 */

/** Severity of one finding. */
export type Severity = 'error' | 'warn' | 'info'

/** Which check layer produced the finding. */
export type CheckLayer = 'l0' | 'l1' | 'l2' | 'malware'

/** How a finding can be fixed: deterministically, by rollback, by prompt, or not at all. */
export type FixKind = 'auto' | 'rollback' | 'prompt' | 'none'

/** One deterministic repair action the host executor may apply. */
export interface RepairAction {
  /** Action kind the executor understands. */
  kind: 'files-whitelist' | 'remove-copies' | 'none'
  /** Absolute file path the action writes (for confirmation display). */
  path?: string
  /** What the action will do, human-readable (shown in the confirm dialog). */
  description: string
}

/** One finding produced by a checker. */
export interface CheckFinding {
  /** Which layer produced it. */
  layer: CheckLayer
  /** Stable machine code, e.g. `files-missing-chunk`. */
  code: string
  severity: Severity
  /** Plugin package name this finding is about, when scoped. */
  plugin?: string
  /** Human-readable one-line problem. */
  message: string
  /** Evidence (paths, timestamps, command output) backing the finding. */
  evidence?: string[]
  /** How to fix it. */
  fixKind: FixKind
  /** Deterministic action, present exactly when fixKind is 'auto'. */
  repair?: RepairAction
  /** The prepared repair prompt, present exactly when fixKind is 'prompt'. */
  prompt?: string
  /** Rollback target (plugin row id), present exactly when fixKind is 'rollback'. */
  rollbackId?: string
}

/** Progress event streamed to the panel while a run is in flight. */
export interface RunProgress {
  /** Layer currently running ('l0' | 'l1' | 'l2' | 'malware' | 'done'). */
  stage: CheckLayer | 'done'
  /** Findings produced so far (each stage appends). */
  findings: CheckFinding[]
}

/** Result of the L2 smoke boot. */
export interface SmokeResult {
  /** Whether the smoke boot passed (tree activated). */
  ok: boolean
  /** How long the subprocess boot took, in ms. */
  durationMs: number
  /** Stage it failed at, when it failed. */
  stage?: string
  /** Diagnostics (stderr tail / structured error), when it failed. */
  error?: string
}

/** One history record persisted under ~/.dsh/storages/healthcheck/. */
export interface HistoryRecord {
  /** Run id. */
  id: string
  /** ISO timestamp of the run start. */
  at: string
  /** Profile checked. */
  profile: string
  /** Layers requested. */
  layers: CheckLayer[]
  /** Highest severity reached in this run. */
  worst: Severity | 'none'
  /** Error count. */
  errors: number
  /** Warning count. */
  warnings: number
  /** L2 smoke outcome, when l2 was requested. */
  smoke?: SmokeResult
  /** Human summary of the worst findings. */
  summary: string[]
}

/** JSON envelope shared by every /healthcheck route. */
export type Envelope<T> = { ok: true; value: T } | { ok: false; error: HealthcheckError }

/** Stable error shape for route responses. */
export interface HealthcheckError {
  code: string
  message: string
}

/** Build an ok envelope. */
export function okEnvelope<T>(value: T): Envelope<T> {
  return { ok: true, value }
}

/** Build a failure envelope. */
export function failEnvelope(code: string, message: string): Envelope<never> {
  return { ok: false, error: { code, message } }
}

/** Rank severities for run summaries. */
export function severityRank(severity: Severity): number {
  return severity === 'error' ? 2 : severity === 'warn' ? 1 : 0
}
