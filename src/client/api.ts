/**
 * Browser client for the host /healthcheck/* routes: typed JSON envelope
 * calls. Same-origin relative fetch (the page and the routes share the
 * webserver), mirroring the aionui-panel api discipline.
 * @module dsh-plugin-healthcheck/client/api
 */

import type { CheckFinding, Envelope, HealthcheckError, HistoryRecord, SmokeResult } from '../core/types.ts'

/** Transport failure (fetch threw or the response was not JSON). */
const TRANSPORT_ERROR: HealthcheckError = { code: 'internal', message: 'healthcheck route unavailable' }

/** POST one JSON payload and decode the envelope; never throws. */
async function post<T>(path: string, payload: Record<string, unknown>): Promise<Envelope<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, error: TRANSPORT_ERROR }
  }
  try {
    const envelope = await response.json() as unknown
    if (typeof envelope !== 'object' || envelope === null) return { ok: false, error: TRANSPORT_ERROR }
    const record = envelope as Record<string, unknown>
    if (record.ok === true) return { ok: true, value: record.value as T }
    return { ok: false, error: (record.error as HealthcheckError | undefined) ?? TRANSPORT_ERROR }
  } catch {
    return { ok: false, error: TRANSPORT_ERROR }
  }
}

/** GET one JSON envelope. */
async function get<T>(path: string): Promise<Envelope<T>> {
  let response: Response
  try {
    response = await fetch(path)
  } catch {
    return { ok: false, error: TRANSPORT_ERROR }
  }
  try {
    const envelope = await response.json() as unknown
    if (typeof envelope !== 'object' || envelope === null) return { ok: false, error: TRANSPORT_ERROR }
    const record = envelope as Record<string, unknown>
    if (record.ok === true) return { ok: true, value: record.value as T }
    return { ok: false, error: (record.error as HealthcheckError | undefined) ?? TRANSPORT_ERROR }
  } catch {
    return { ok: false, error: TRANSPORT_ERROR }
  }
}

/** One installed plugin row for the scope picker. */
export interface InventoryRow {
  name: string
  spec: string
  bundle: boolean
  /** Whether the plugin is a harness built-in bundle (not a profile dep). */
  builtin: boolean
  /** Whether a patch layer currently disables the plugin. */
  disabled: boolean
  /** The layers that disabled it (home/profile). */
  disabledBy: string[]
}

/** The full plugin inventory: user profile plugins + harness built-ins. */
export interface Inventory {
  profile: InventoryRow[]
  builtin: InventoryRow[]
  counts: { profile: number; builtin: number; total: number }
}

/** One run-status poll snapshot. */
export interface RunStatus {
  stage: 'l0' | 'l1' | 'l2' | 'malware' | 'done'
  finished: boolean
  findings: CheckFinding[]
  smoke?: SmokeResult
  error?: string
}

/** Typed healthcheck operations over the wire. */
export class HealthcheckApi {
  /** List installed plugins for the scope picker. */
  inventory(): Promise<Envelope<Inventory>> {
    return get<Inventory>('/healthcheck/inventory')
  }

  /** Start a check run; returns its runId. */
  run(payload: { profile?: string; plugin?: string; layers?: string[] }): Promise<Envelope<{ runId: string }>> {
    return post<{ runId: string }>('/healthcheck/run', payload)
  }

  /** Poll one run's live state. */
  status(runId: string): Promise<Envelope<RunStatus>> {
    return get<RunStatus>(`/healthcheck/status?runId=${encodeURIComponent(runId)}`)
  }

  /** Apply one deterministic repair (the panel confirms first). */
  repair(repair: CheckFinding['repair'], confirmed: boolean): Promise<Envelope<{ applied: boolean; message: string }>> {
    return post<{ applied: boolean; message: string }>('/healthcheck/repair', { repair, confirmed })
  }

  /** Write a disabled row into the home patch (the panel confirms first). */
  rollback(pluginId: string, confirmed: boolean): Promise<Envelope<{ applied: boolean; message: string }>> {
    return post<{ applied: boolean; message: string }>('/healthcheck/rollback', { pluginId, confirmed })
  }

  /** Remove the healthcheck rollback rows for one plugin. */
  async undoRollback(pluginId: string): Promise<Envelope<{ applied: boolean; message: string }>> {
    let response: Response
    try {
      response = await fetch(`/healthcheck/rollback?pluginId=${encodeURIComponent(pluginId)}`, { method: 'DELETE' })
    } catch {
      return { ok: false, error: TRANSPORT_ERROR }
    }
    try {
      const envelope = await response.json() as unknown
      if (typeof envelope !== 'object' || envelope === null) return { ok: false, error: TRANSPORT_ERROR }
      const record = envelope as Record<string, unknown>
      if (record.ok === true) return { ok: true, value: record.value as { applied: boolean; message: string } }
      return { ok: false, error: (record.error as HealthcheckError | undefined) ?? TRANSPORT_ERROR }
    } catch {
      return { ok: false, error: TRANSPORT_ERROR }
    }
  }

  /** Read the persisted run history. */
  history(): Promise<Envelope<HistoryRecord[]>> {
    return get<HistoryRecord[]>('/healthcheck/history')
  }
}
