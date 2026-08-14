/**
 * C9 — cordis 用法检测器测试。fixture 复刻 dsh-ssh-workspace 事故的三类模式。
 */

import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCordisUsage } from '../src/host/cordis.ts'

const FIXTURES = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

describe('C9 cordis usage detection', () => {
  it('catches async ctx.plugin() followed by sync service read (E1)', () => {
    const findings = checkCordisUsage(join(FIXTURES, 'cordis-bug-plugin'), 'cordis-bug-plugin')
    const hit = findings.find((f) => f.code === 'async-plugin-then-sync')
    expect(hit).toBeDefined()
    expect(hit?.severity).toBe('warn')
    expect(hit?.message).toContain('cordis')
  })

  it('catches direct new Service without config (E2)', () => {
    const findings = checkCordisUsage(join(FIXTURES, 'cordis-bug-plugin'), 'cordis-bug-plugin')
    const hit = findings.find((f) => f.code === 'new-service-no-config')
    expect(hit).toBeDefined()
    expect(hit?.prompt).toContain('diffBasisMaxBytes')
  })

  it('flags inject references to undeclared services (E3)', () => {
    const findings = checkCordisUsage(join(FIXTURES, 'cordis-bug-plugin'), 'cordis-bug-plugin')
    const hit = findings.find((f) => f.code === 'inject-missing-service')
    expect(hit).toBeDefined()
    expect(hit?.evidence.join('\n')).toContain('fs.ts')
  })

  it('stays quiet on the clean fixture', () => {
    const findings = checkCordisUsage(join(FIXTURES, 'good-plugin'), 'good-plugin')
    expect(findings).toHaveLength(0)
  })
})
