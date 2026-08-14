/**
 * L2 end-to-end integration test — boots the REAL web profile in a subprocess
 * through the smoke runner. Skipped by default (slow, touches the real
 * profile); run with RUN_HEALTHCHECK_E2E=1.
 *
 * The runner writes a `.healthcheck-overlay-<pid>.yml` into the profile dir
 * and removes it on completion via cleanupSmokeOverlay.
 */

import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveHome } from '../src/host/env.ts'
import { cleanupSmokeOverlay, runSmokeBoot } from '../src/host/verify.ts'

const RUN_E2E = process.env.RUN_HEALTHCHECK_E2E === '1'
const describeE2E = RUN_E2E ? describe : describe.skip

describeE2E('L2 smoke boot (real web profile)', () => {
  it('boots the full tree in a subprocess and activates every entry', async () => {
    const home = resolveHome()
    const result = await runSmokeBoot('web', home, 120_000)
    expect(result.ok).toBe(true)
  }, 180_000)

  it('cleans up its overlay file', async () => {
    const home = resolveHome()
    cleanupSmokeOverlay(home, 'web')
    expect(existsSync(join(home, 'profiles', 'web', `.healthcheck-overlay-${process.pid}.yml`))).toBe(false)
  })
})
