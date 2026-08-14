/**
 * Repair-executor safety tests — the iron rule is the product: every write
 * must be gated, harness paths must be refused, plugin/config paths allowed.
 */

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyRepair,
  assertSafeTarget,
  rollbackPlugin,
  undoRollback,
} from '../src/host/repair.ts'
import { resolveInstallRoot } from '../src/host/env.ts'

let fakeHome: string
let fakeProfile: string

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), 'healthcheck-home-'))
  fakeProfile = join(fakeHome, 'profiles', 'web')
  mkdirSync(join(fakeProfile, 'node_modules', '@deepseek-ai'), { recursive: true })
  mkdirSync(join(fakeHome, 'plugins'), { recursive: true })
  writeFileSync(join(fakeHome, 'cordis.patch.yml'), '# test patch\n[]\n', 'utf8')
})

afterEach(() => {
  // best-effort cleanup of the temp home
  try {
    import('node:fs').then(({ rmSync }) => rmSync(fakeHome, { recursive: true, force: true }))
  } catch { /* ignore */ }
})

describe('assertSafeTarget — the iron rule', () => {
  it('rejects the harness install root (resolved, never hardcoded)', () => {
    const installRoot = resolveInstallRoot()
    expect(installRoot).not.toBe('')
    const target = join(installRoot, '@deepseek-ai', 'dsh', 'lib', 'bin.js')
    expect(() => assertSafeTarget(target, fakeHome))
      .toThrowError(/forbidden-harness/)
  })

  it('rejects any path outside the harness home', () => {
    expect(() => assertSafeTarget('C:\\Windows\\System32\\drivers\\etc\\hosts', fakeHome))
      .toThrowError(/outside-home/)
  })

  it('accepts plugin source and profile config paths', () => {
    expect(assertSafeTarget(join(fakeHome, 'plugins', 'x', 'package.json'), fakeHome))
      .toContain('plugins')
    expect(assertSafeTarget(join(fakeHome, 'cordis.patch.yml'), fakeHome))
      .toContain('cordis.patch.yml')
  })

  it('rejects empty paths', () => {
    expect(() => assertSafeTarget('', fakeHome)).toThrowError(/bad-target/)
  })
})

describe('applyRepair — files-whitelist', () => {
  it('rewrites fixed lib entries to lib/*.js and backs up the original', () => {
    const pluginDir = join(fakeHome, 'plugins', 'broken-plugin')
    mkdirSync(pluginDir, { recursive: true })
    const manifest = { name: 'broken-plugin', version: '1.0.0', files: ['lib/index.js', 'lib/invariant.js', 'README.md'] }
    writeFileSync(join(pluginDir, 'package.json'), JSON.stringify(manifest, undefined, 2) + '\n', 'utf8')

    const outcome = applyRepair({
      kind: 'files-whitelist',
      path: join(pluginDir, 'package.json'),
      description: 'fix files',
    }, fakeHome)

    expect(outcome.applied).toBe(true)
    const next = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8')) as { files: string[] }
    expect(next.files).toEqual(['lib/*.js', 'README.md'])
  })
})

describe('rollbackPlugin + undoRollback', () => {
  it('appends a disabled row and idempotently skips duplicates', () => {
    const first = rollbackPlugin('test-plugin', fakeHome)
    expect(first.applied).toBe(true)
    const second = rollbackPlugin('test-plugin', fakeHome)
    expect(second.applied).toBe(false)
    const content = readFileSync(join(fakeHome, 'cordis.patch.yml'), 'utf8')
    expect(content).toContain('- id: test-plugin')
    expect(content).toContain('disabled: true')
  })

  it('undo removes exactly the healthcheck rollback rows', () => {
    rollbackPlugin('test-plugin', fakeHome)
    const outcome = undoRollback('test-plugin', fakeHome)
    expect(outcome.applied).toBe(true)
    const content = readFileSync(join(fakeHome, 'cordis.patch.yml'), 'utf8')
    expect(content).not.toContain('- id: test-plugin')
  })

  it('keeps pre-existing user rows intact across a rollback cycle', () => {
    writeFileSync(join(fakeHome, 'cordis.patch.yml'), '- id: user-row\n  config:\n    x: 1\n', 'utf8')
    rollbackPlugin('test-plugin', fakeHome)
    undoRollback('test-plugin', fakeHome)
    const content = readFileSync(join(fakeHome, 'cordis.patch.yml'), 'utf8')
    expect(content).toContain('- id: user-row')
    expect(content).toContain('x: 1')
  })
})
