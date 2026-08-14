/**
 * /healthcheck/* route layer: JSON envelope for the panel. Read paths are
 * unrestricted (they only report); every write path (repair / rollback)
 * requires `confirmed: true` in the payload — the panel shows the confirm
 * dialog BEFORE sending, and the route double-checks.
 * @module dsh-plugin-healthcheck/host/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { Envelope, RepairAction } from '../core/types.ts'
import { failEnvelope, okEnvelope } from '../core/types.ts'
import { listProfilePlugins, resolveHome } from './env.ts'
import { applyRepair, rollbackPlugin, undoRollback } from './repair.ts'
import { getHistory, getRun, startRun } from './service.ts'

const BAD_REQUEST = { code: 'bad-request', message: 'malformed request' } as const

/** Read a JSON request body into an unknown value; null when unparseable. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    chunks.push(buffer)
    total += buffer.length
    if (total > 1 << 20) return null
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function field(payload: unknown, key: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined
  return (payload as Record<string, unknown>)[key]
}

function stringField(payload: unknown, key: string): string | null {
  const value = field(payload, key)
  return typeof value === 'string' && value !== '' ? value : null
}

function stringArrayField(payload: unknown, key: string): string[] | null {
  const value = field(payload, key)
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value as string[]
}

function json(res: ServerResponse, envelope: Envelope<unknown>, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(envelope))
}

/** Register the /healthcheck routes on the shared webserver. */
export function registerHealthcheckRoutes(ctx: Context): () => void {
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://x')
    const pathname = url.pathname

    if (pathname === '/healthcheck/inventory' && req.method === 'GET') {
      const rows = listProfilePlugins('web', resolveHome())
      json(res, okEnvelope(rows.map((row) => ({
        name: row.name,
        spec: row.spec,
        bundle: row.bundle,
        disabled: row.disabled === true,
        disabledBy: row.disabledBy ?? [],
      }))))
      return
    }

    if (pathname === '/healthcheck/run' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      if (payload === null) {
        json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400)
        return
      }
      const layers = stringArrayField(payload, 'layers')
      if (layers === null) {
        json(res, failEnvelope(BAD_REQUEST.code, 'layers must be a string array'), 400)
        return
      }
      const validLayers = new Set(['l0', 'l1', 'l2', 'malware'])
      if (layers.some((layer) => !validLayers.has(layer))) {
        json(res, failEnvelope(BAD_REQUEST.code, `layers must be one of ${[...validLayers].join('/')}`), 400)
        return
      }
      const runId = startRun({
        profile: stringField(payload, 'profile') ?? 'web',
        plugin: stringField(payload, 'plugin') ?? undefined,
        layers: layers.length > 0 ? layers as ('l0' | 'l1' | 'l2' | 'malware')[] : undefined,
      })
      json(res, okEnvelope({ runId }))
      return
    }

    if (pathname === '/healthcheck/status' && req.method === 'GET') {
      const runId = url.searchParams.get('runId')
      if (runId === null) {
        json(res, failEnvelope(BAD_REQUEST.code, 'runId query is required'), 400)
        return
      }
      const state = getRun(runId)
      if (state === undefined) {
        json(res, failEnvelope('run-unknown', 'run id not found (finished runs are pruned)'), 404)
        return
      }
      json(res, okEnvelope({
        stage: state.stage,
        finished: state.finished,
        findings: state.findings,
        smoke: state.smoke,
        error: state.error,
      }))
      return
    }

    if (pathname === '/healthcheck/repair' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      if (payload === null) {
        json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400)
        return
      }
      const action = field(payload, 'repair') as RepairAction | undefined
      if (typeof action !== 'object' || action === null || typeof action.kind !== 'string') {
        json(res, failEnvelope(BAD_REQUEST.code, 'repair action is required'), 400)
        return
      }
      const confirmed = field(payload, 'confirmed') === true
      if (!confirmed) {
        json(res, failEnvelope('confirm-required', '修复必须先在界面确认（confirmed: true）'), 400)
        return
      }
      try {
        json(res, okEnvelope(applyRepair(action, resolveHome())))
      } catch (error) {
        json(res, failEnvelope('repair-failed', error instanceof Error ? error.message : String(error)), 409)
      }
      return
    }

    if (pathname === '/healthcheck/rollback' && req.method === 'POST') {
      const payload = await readJsonBody(req)
      if (payload === null) {
        json(res, failEnvelope(BAD_REQUEST.code, BAD_REQUEST.message), 400)
        return
      }
      const pluginId = stringField(payload, 'pluginId')
      if (pluginId === null) {
        json(res, failEnvelope(BAD_REQUEST.code, 'pluginId is required'), 400)
        return
      }
      const confirmed = field(payload, 'confirmed') === true
      if (!confirmed) {
        json(res, failEnvelope('confirm-required', '回滚必须先在界面确认（confirmed: true）'), 400)
        return
      }
      try {
        json(res, okEnvelope(rollbackPlugin(pluginId, resolveHome())))
      } catch (error) {
        json(res, failEnvelope('rollback-failed', error instanceof Error ? error.message : String(error)), 409)
      }
      return
    }

    if (pathname === '/healthcheck/rollback' && req.method === 'DELETE') {
      const pluginId = url.searchParams.get('pluginId')
      if (pluginId === null) {
        json(res, failEnvelope(BAD_REQUEST.code, 'pluginId query is required'), 400)
        return
      }
      try {
        json(res, okEnvelope(undoRollback(pluginId, resolveHome())))
      } catch (error) {
        json(res, failEnvelope('rollback-failed', error instanceof Error ? error.message : String(error)), 409)
      }
      return
    }

    if (pathname === '/healthcheck/history' && req.method === 'GET') {
      json(res, okEnvelope(getHistory()))
      return
    }

    res.writeHead(404)
    res.end()
  }

  return ctx.webServer.register({ kind: 'prefix', path: '/healthcheck', handler })
}
