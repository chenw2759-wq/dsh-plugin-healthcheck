/**
 * The check-run service: orchestrates L0 (six checkers, per plugin + global),
 * L1 (config composition) and L2 (isolated smoke boot) into one run with
 * progress, and persists the history record.
 * @module dsh-plugin-healthcheck/host/service
 */

import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { CheckFinding, CheckLayer, HistoryRecord, SmokeResult } from '../core/types.ts'
import { L0_CHECKERS, checkGlobalL0, checkHighRiskCopies } from './checkers.ts'
import { listProfilePlugins, resolveHome, type PluginRow } from './env.ts'
import { scanPluginForMalware } from './malware.ts'
import { appendHistory, readHistory } from './repair.ts'
import { checkConfigComposition, runSmokeBoot } from './verify.ts'

/** One run's live state (polled by the panel). */
export interface RunState {
  runId: string
  profile: string
  home: string
  stage: CheckLayer | 'done'
  layers: CheckLayer[]
  findings: CheckFinding[]
  smoke?: SmokeResult
  startedAt: string
  finished: boolean
  error?: string
}

/** In-flight runs keyed by runId. */
const runs = new Map<string, RunState>()

/** Scope of a run: every plugin or one named plugin. */
export interface RunRequest {
  profile?: string
  /** Plugin filter; undefined = all plugins. */
  plugin?: string
  /** Layers to run; undefined = all three + malware. */
  layers?: CheckLayer[]
}

/** Kick off a run in the background and return its id. */
export function startRun(request: RunRequest): string {
  const home = resolveHome()
  const profile = request.profile ?? 'web'
  const layers = request.layers ?? ['l0', 'l1', 'l2', 'malware']
  const runId = randomUUID()
  const state: RunState = {
    runId, profile, home, stage: 'l0', layers, findings: [], startedAt: new Date().toISOString(), finished: false,
  }
  runs.set(runId, state)
  void executeRun(state, request.plugin)
  return runId
}

/** Read one run state (undefined once pruned). */
export function getRun(runId: string): RunState | undefined {
  return runs.get(runId)
}

/** Read persisted history. */
export function getHistory(): unknown[] {
  return readHistory(resolveHome())
}

/** Prune finished runs older than an hour. */
function pruneRuns(): void {
  const cutoff = Date.now() - 3_600_000
  for (const [id, state] of runs) {
    if (state.finished && Date.parse(state.startedAt) < cutoff) runs.delete(id)
  }
}

/** Execute one run through its layers, then persist the history. */
async function executeRun(state: RunState, pluginFilter: string | undefined): Promise<void> {
  try {
    const rows = listProfilePlugins(state.profile, state.home)
    const scoped = pluginFilter !== undefined ? rows.filter((row) => row.name === pluginFilter) : rows

    if (state.layers.includes('l0')) {
      state.stage = 'l0'
      const ctx = { home: state.home, profileDir: join(state.home, 'profiles', state.profile), profile: state.profile }
      // Per-plugin checkers: everything EXCEPT the global high-risk-copies
      // scan, which runs once in checkGlobalL0 (running it per row would
      // duplicate each finding once per installed plugin).
      const perPlugin = L0_CHECKERS.filter((checker) => checker !== checkHighRiskCopies)
      for (const row of scoped) {
        for (const checker of perPlugin) {
          state.findings.push(...checker(ctx, row))
        }
      }
      state.findings.push(...checkGlobalL0(ctx, rows))
    }

    // Dedicated malware layer: pure static isolated scan (never executes
    // plugin code). Runs standalone when 'malware' is requested, so a
    // security scan does not need the heavier layers.
    if (state.layers.includes('malware')) {
      state.stage = 'malware'
      for (const row of scoped) {
        // Self-exclusion: the scanner's own pattern library and prompt
        // templates contain the signature strings — scanning itself is
        // meaningless noise.
        if (row.name === 'dsh-plugin-healthcheck') continue
        const scanRoot = row.sourceDir ?? (row.installedDir !== '' ? row.installedDir : '')
        state.findings.push(...scanPluginForMalware(scanRoot, row.name))
      }
    }

    if (state.layers.includes('l1')) {
      state.stage = 'l1'
      state.findings.push(...await checkConfigComposition(state.profile, state.home))
    }

    if (state.layers.includes('l2')) {
      state.stage = 'l2'
      state.smoke = await runSmokeBoot(state.profile, state.home)
      if (!state.smoke.ok) {
        state.findings.push({
          layer: 'l2',
          code: 'smoke-failed',
          severity: 'error',
          message: `隔离试跑失败（${state.smoke.stage ?? 'unknown'}）：新插件会导致后端无法启动`,
          evidence: state.smoke.error !== undefined ? [state.smoke.error] : [],
          fixKind: 'rollback',
          rollbackId: pluginFilter,
        })
      }
    }

    state.stage = 'done'
    state.finished = true
    appendHistory(buildHistoryRecord(state), state.home)
    pruneRuns()
  } catch (error) {
    state.stage = 'done'
    state.finished = true
    state.error = error instanceof Error ? error.message : String(error)
    appendHistory(buildHistoryRecord(state), state.home)
  }
}

/** Fold one run state into a persisted history record. */
function buildHistoryRecord(state: RunState): HistoryRecord {
  const errors = state.findings.filter((f) => f.severity === 'error')
  const warnings = state.findings.filter((f) => f.severity === 'warn')
  return {
    id: state.runId,
    at: state.startedAt,
    profile: state.profile,
    layers: state.layers,
    worst: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : state.findings.length > 0 ? 'info' : 'none',
    errors: errors.length,
    warnings: warnings.length,
    smoke: state.smoke,
    summary: state.findings.slice(0, 10).map((f) => f.message),
  }
}

/** Human summary of the plugin inventory (for the panel header). */
export function inventorySummary(): { total: number; bundles: number } {
  const rows = listProfilePlugins('web', resolveHome())
  return { total: rows.length, bundles: rows.filter((r) => r.bundle).length }
}

export type { PluginRow }
