/**
 * Live HTTP-surface e2e: boots the real web profile in-process with the
 * webserver on port 0, then exercises the /healthcheck routes over HTTP —
 * inventory, run (L0+L1), status polling, and history. Opt-in via
 * RUN_HEALTHCHECK_E2E=1 (same switch as the smoke spec).
 */

import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveHome } from '../src/host/env.ts'

const RUN_E2E = process.env.RUN_HEALTHCHECK_E2E === '1'
const describeE2E = RUN_E2E ? describe : describe.skip

interface Booted {
  ctx: { fiber: { dispose: () => Promise<void> }; get: (name: string) => unknown }
  port: number
}

async function bootLive(): Promise<Booted> {
  const home = resolveHome()
  const appBoot = await import('@deepseek-ai/dsh-app-boot')
  const { loadProfile, boot, loadOptionalPatches, loadOverlayPatches, PROFILE_PATCH_FILENAME } = appBoot
  const { provideCmdline } = await import('@deepseek-ai/dsh-cmdline')

  const installAnchor = join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  const loaded = loadProfile('healthcheck-live', 'web', installAnchor, home)
  const overlayPath = join(loaded.dir, '.live-overlay.yml')
  writeFileSync(overlayPath, '- id: webserver\n  config:\n    host: 127.0.0.1\n    port: 0\n', 'utf8')
  const patches = [
    ...loaded.layers.flatMap((layer) => layer.patches),
    ...loaded.patches,
    ...(loadOptionalPatches('healthcheck-live', join(home, PROFILE_PATCH_FILENAME)) ?? []),
    ...loadOverlayPatches('healthcheck-live', overlayPath),
  ]
  const rootConfig = join(loaded.dir, 'cordis.yml')
  writeFileSync(rootConfig, '[]\n', 'utf8')

  const ctx = await boot('healthcheck-live', rootConfig, patches, (hostCtx) => {
    provideCmdline(hostCtx, { args: [], exit: () => {} })
  }) as unknown as Booted['ctx']
  // The webserver exposes its bound port as `listenedPort` (the `port`
  // getter may be absent on the running instance shape).
  const webserver = ctx.get('webServer') as { listenedPort?: number } | undefined
  return { ctx, port: typeof webserver?.listenedPort === 'number' ? webserver.listenedPort : livePortFromLog }
}

/** Parsed lazily from the last captured 'dsh web: http://...' stdout line. */
let livePortFromLog = 0
process.stdout.on('data', (chunk: Buffer) => {
  const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(chunk.toString())
  if (match !== null) livePortFromLog = Number(match[1])
})

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url)
  const text = await response.text()
  let body: unknown = null
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = text.slice(0, 120)
  }
  return { status: response.status, body }
}

describeE2E('live /healthcheck routes', () => {
  it('inventory, run (L0+L1), status, history round-trip', async () => {
    const live = await bootLive()
    try {
      expect(live.port).toBeGreaterThan(0)
      const base = `http://127.0.0.1:${live.port}`

      const inventory = await getJson(`${base}/healthcheck/inventory`)
      const inventoryEnvelope = inventory.body as { ok: boolean; value: unknown[] }
      expect(inventoryEnvelope.ok).toBe(true)
      expect(Array.isArray(inventoryEnvelope.value)).toBe(true)

      const runResponse = await fetch(`${base}/healthcheck/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layers: ['l0', 'l1'] }),
      })
      const runText = await runResponse.text()
      const run = JSON.parse(runText) as { ok: boolean; value: { runId: string } }
      expect(run.ok).toBe(true)

      let status = { ok: false, value: { finished: false, stage: '' } }
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const snapshot = await getJson(`${base}/healthcheck/status?runId=${encodeURIComponent(run.value.runId)}`)
        const envelope = snapshot.body as { ok: boolean; value: { finished: boolean; stage: string } }
        status = envelope
        if (!envelope.ok || envelope.value.finished) break
      }
      expect(status.ok).toBe(true)
      expect(status.value.finished).toBe(true)

      const history = await getJson(`${base}/healthcheck/history`)
      const historyEnvelope = history.body as { ok: boolean; value: unknown[] }
      expect(historyEnvelope.ok).toBe(true)
      expect(Array.isArray(historyEnvelope.value)).toBe(true)
    } finally {
      await live.ctx.fiber.dispose()
    }
  }, 180_000)
})
