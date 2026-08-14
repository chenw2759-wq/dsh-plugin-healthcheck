/**
 * Repair executor + auto-rollback — the ONLY code in this plugin allowed to
 * write files.
 *
 * 铁律（HARD RULE）：修复执行器严禁修改 harness 源码（安装目录
 * M:\dsh\node_modules 及任何 @deepseek-ai 安装本体），只允许修改：
 *   1. 插件自己的代码（~/.dsh/plugins/**）
 *   2. 配置层（~/.dsh/profiles/**、~/.dsh/cordis.patch.yml）
 * 每个写路径在执行前经 assertSafeTarget 门禁，realpath 后必须落在 home 内
 * 且不在安装根内，否则拒绝。
 * @module dsh-plugin-healthcheck/host/repair
 */

import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import type { HealthcheckError, RepairAction } from '../core/types.ts'
import { resolveHome, resolveHomePatch, resolveInstallRoot, type PluginRow } from './env.ts'

/** One applied repair outcome. */
export interface RepairOutcome {
  action: 'files-whitelist' | 'remove-copies' | 'write-patch' | 'none'
  applied: boolean
  message: string
}

/**
 * The write gate. Canonicalizes the target and refuses anything outside the
 * harness home or inside the harness install root. This is the safety
 * boundary between "repairing a plugin" and "modifying harness source".
 */
export function assertSafeTarget(path: string, home = resolveHome()): string {
  if (typeof path !== 'string' || path === '') throw repairError('bad-target', 'empty repair path')
  const installRoot = resolveInstallRoot()
  let canonical = ''
  let probe = resolve(path)
  try {
    // Realpath the deepest existing ancestor (the leaf may not exist yet).
    while (true) {
      try {
        canonical = resolve(realpathSync(probe))
        break
      } catch {
        const parent = dirname(probe)
        if (parent === probe) throw new Error('unresolvable')
        probe = parent
      }
    }
    // Fold the non-existent tail back onto the canonical ancestor.
    const tail = resolve(path).slice(probe.length).replace(/^[/\\]/, '')
    canonical = tail === '' ? canonical : join(canonical, tail)
  } catch {
    throw repairError('bad-target', `path does not resolve on disk: ${path}`)
  }
  const normalizedHome = resolve(home).toLowerCase()
  const normalizedInstall = resolve(installRoot).toLowerCase()
  // The iron rule fires FIRST: harness paths are always refused, no matter
  // which home the check runs under.
  if (canonical.toLowerCase().startsWith(normalizedInstall)) {
    throw repairError('forbidden-harness', `铁律：禁止修改 harness 源码/安装本体：${path}`)
  }
  if (!canonical.toLowerCase().startsWith(normalizedHome)) {
    throw repairError('outside-home', `refusing to write outside the harness home: ${path}`)
  }
  return canonical
}

function repairError(code: string, message: string): HealthcheckError & Error {
  const error = new Error(`[${code}] ${message}`) as HealthcheckError & Error
  error.code = code
  return error
}

/** Execute one deterministic repair action under the safety gate. */
export function applyRepair(action: RepairAction, home = resolveHome()): RepairOutcome {
  switch (action.kind) {
    case 'files-whitelist': {
      if (action.path === undefined) return { action: 'files-whitelist', applied: false, message: 'missing target path' }
      return repairFilesWhitelist(action.path, home)
    }
    case 'remove-copies': {
      if (action.path === undefined) return { action: 'remove-copies', applied: false, message: 'missing target path' }
      return repairRemoveCopies(action.path, home)
    }
    case 'none': return { action: 'none', applied: false, message: action.description }
    default: return { action: action.kind, applied: false, message: 'unknown action kind' }
  }
}

/** Rewrite a plugin package.json files field to lib/*.js (with backup). */
function repairFilesWhitelist(path: string, home: string): RepairOutcome {
  const target = assertSafeTarget(path, home)
  const raw = readFileSync(target, 'utf8')
  const manifest = JSON.parse(raw) as { files?: string[] }
  if (!Array.isArray(manifest.files)) {
    return { action: 'files-whitelist', applied: false, message: `${target} 没有 files 字段` }
  }
  const next = manifest.files.map((f) => (/^lib\/[^*/]+\.[a-z]+$/.test(f) ? 'lib/*.js' : f))
  const deduped = [...new Set(next)]
  if (JSON.stringify(deduped) === JSON.stringify(manifest.files)) {
    return { action: 'files-whitelist', applied: false, message: `${target} 的 files 无需修改` }
  }
  renameSync(target, `${target}.bak-${Date.now()}`)
  manifest.files = deduped
  writeFileSync(target, JSON.stringify(manifest, undefined, 2) + '\n', 'utf8')
  return {
    action: 'files-whitelist',
    applied: true,
    message: `已把 ${target} 的 files 白名单改为通配（原文件备份为 .bak-*）：${deduped.join(', ')}`,
  }
}

/** Delete a dangerous harness copy (only when it is still a real dir). */
function repairRemoveCopies(path: string, home: string): RepairOutcome {
  const target = assertSafeTarget(path, home)
  let stat
  try {
    stat = lstatSync(target)
  } catch {
    return { action: 'remove-copies', applied: false, message: `${target} 已不存在` }
  }
  if (stat.isSymbolicLink()) {
    return { action: 'remove-copies', applied: false, message: `${target} 现在是软链（健康状态），无需删除` }
  }
  rmSync(target, { recursive: true, force: true })
  return { action: 'remove-copies', applied: true, message: `已删除危险副本 ${target}（插件将从共享层软链解析）` }
}

/**
 * Auto-rollback: append `- id: <id>\n  disabled: true` to the home patch
 * (HMR hot-applies it in the running backend within seconds). Idempotent:
 * an existing disabled row for the id is left untouched. Validated by parsing
 * the result with the include plugin's schema before replacing the file.
 */
export function rollbackPlugin(pluginId: string, home = resolveHome()): RepairOutcome {
  const target = assertSafeTarget(resolveHomePatch(home), home)
  const content = readFileSync(target, 'utf8')
  if (hasDisabledRow(content, pluginId)) {
    return { action: 'write-patch', applied: false, message: `${pluginId} 已在 home 层禁用，无需重复写入` }
  }
  const block = `# healthcheck auto-rollback ${new Date().toISOString()}\n- id: ${pluginId}\n  disabled: true\n`
  let appended: string
  // Three shapes of the top-level list, in order of how the real patch file
  // looks: a bare block sequence (append), an empty flow list [] (replace
  // with a block sequence), or a non-empty flow list (parse-and-dump — the
  // only shape that loses comments, and only as a fallback).
  if (/\[\s*\]\s*$/.test(content)) {
    appended = content.replace(/\[\s*\]\s*$/, block + '\n')
  } else if (/\s*\]\s*$/.test(content)) {
    let parsed: unknown
    try {
      parsed = yaml.load(content, { schema: entryListSchema })
    } catch {
      parsed = undefined
    }
    if (!Array.isArray(parsed)) {
      return { action: 'write-patch', applied: false, message: `回滚写入失败：无法解析 ${target} 的顶层列表（未改动任何文件）` }
    }
    parsed.push({ id: pluginId, disabled: true })
    appended = yaml.dump(parsed, { schema: entryListSchema, noRefs: true }) + '\n'
  } else {
    appended = content.replace(/\s*$/, '') + '\n\n' + block
  }
  try {
    yaml.load(appended, { schema: entryListSchema })
  } catch (error) {
    return {
      action: 'write-patch', applied: false,
      message: `回滚写入校验失败（未改动任何文件）：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  renameSync(target, `${target}.bak-${Date.now()}`)
  writeFileSync(target, appended, 'utf8')
  return { action: 'write-patch', applied: true, message: `已在 ${target} 禁用 ${pluginId} — 运行中的后端将热重载生效（无需重启）` }
}

/** Undo a healthcheck rollback: remove the auto-rollback rows for one id. */
export function undoRollback(pluginId: string, home = resolveHome()): RepairOutcome {
  const target = assertSafeTarget(resolveHomePatch(home), home)
  const content = readFileSync(target, 'utf8')
  const marker = /^# healthcheck auto-rollback .*$\n- id: [^\n]+\n  disabled: true\n/gm
  let removed = 0
  const next = content.replace(marker, (block) => {
    if (!block.includes(`- id: ${pluginId}\n`)) return block
    removed += 1
    return ''
  })
  if (removed === 0) {
    return { action: 'write-patch', applied: false, message: `${pluginId} 没有可撤销的 healthcheck 回滚记录` }
  }
  renameSync(target, `${target}.bak-${Date.now()}`)
  writeFileSync(target, next.replace(/\n{3,}/g, '\n\n'), 'utf8')
  return { action: 'write-patch', applied: true, message: `已撤销 ${pluginId} 的回滚（${removed} 行）— 热重载生效` }
}

/** Whether the patch text already carries a disabled row for the id. */
function hasDisabledRow(content: string, pluginId: string): boolean {
  const rows = content.split('\n')
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].trim() === `- id: ${pluginId}`) {
      const ahead = rows.slice(i + 1, i + 4).join('\n')
      if (/disabled:\s*true/.test(ahead)) return true
    }
  }
  return false
}

/** Persist the run history (last N records). */
export function appendHistory(record: unknown, home = resolveHome(), keep = 20): void {
  const dir = join(home, 'storages', 'healthcheck')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'history.json')
  let list: unknown[] = []
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (Array.isArray(parsed)) list = parsed
  } catch {
    // first run
  }
  list.unshift(record)
  writeFileSync(file, JSON.stringify(list.slice(0, keep), undefined, 2) + '\n', 'utf8')
}

/** Read the persisted run history. */
export function readHistory(home = resolveHome()): unknown[] {
  const file = join(home, 'storages', 'healthcheck', 'history.json')
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Find one plugin row by name among the profile inventory. */
export function findPluginRow(rows: PluginRow[], name: string): PluginRow | undefined {
  return rows.find((row) => row.name === name)
}
