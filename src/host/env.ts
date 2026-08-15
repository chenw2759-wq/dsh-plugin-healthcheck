/**
 * Host environment resolution: harness home, profile directory, plugin
 * inventory, and the harness install anchor. Pure path logic — no writes.
 * @module dsh-plugin-healthcheck/host/env
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'

/** Packages whose duplicate presence in the profile tree breaks module identity. */
export const HIGH_RISK_PACKAGES = [
  'cordis',
  'cosmokit',
  'dsh-tools',
  'schemastery',
  'dsh-credentials',
  'dsh-home-paths',
] as const

/** Resolve the harness home exactly as the dsh launcher does. */
export function resolveHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/**
 * Locate the harness install root (M:\dsh\node_modules). Resolution goes
 * through the maintained flat fallback `$DSH_HOME/profiles/node_modules`
 * FIRST — that directory is healed by the launcher to point at the real
 * installation, and consulting it before any profile-local node_modules
 * makes the answer immune to the very duplicate-copy state this plugin
 * detects (a copy inside web/node_modules would otherwise hijack the root).
 * Falls back to module resolution of dsh-app-boot.
 */
export function resolveInstallRoot(home = resolveHome()): string {
  const fallbackCandidate = join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  try {
    if (existsSync(fallbackCandidate)) {
      const real = realpathSync(fallbackCandidate)
      return resolve(dirname(real), '..', '..')
    }
  } catch {
    // fall through to module resolution
  }
  const require = createRequire(import.meta.url)
  const appBootPackage = require.resolve('@deepseek-ai/dsh-app-boot/package.json')
  return resolve(dirname(appBootPackage), '..', '..')
}

/** The dsh app's package.json (install anchor for loadProfile). */
export function resolveInstallAnchor(): string {
  return join(resolveInstallRoot(), '@deepseek-ai', 'dsh', 'package.json')
}

/** The web profile directory. */
export function resolveProfileDir(name: string, home = resolveHome()): string {
  return join(home, 'profiles', name)
}

/** The user plugin-source directory. */
export function resolvePluginsDir(home = resolveHome()): string {
  return join(home, 'plugins')
}

/** The home-level patch file (highest-priority user layer). */
export function resolveHomePatch(home = resolveHome()): string {
  return join(home, 'cordis.patch.yml')
}

/** The healthcheck history store directory. */
export function resolveHistoryDir(home = resolveHome()): string {
  return join(home, 'storages', 'healthcheck')
}

/** One installed plugin row from the profile manifest. */
export interface PluginRow {
  /** Dependency key (package name). */
  name: string
  /** The raw specifier (file:/link:/registry range, or 'builtin'). */
  spec: string
  /** Whether it is listed as a bundle layer. */
  bundle: boolean
  /** Whether it is a harness built-in bundle (not a profile dependency). */
  builtin?: boolean
  /** Installed directory inside the profile (realpath'd). */
  installedDir: string
  /** Source directory for file:/link: specs. */
  sourceDir?: string
  /** Registry range for registry specs. */
  range?: string
  /** Whether any patch layer disables this plugin's loader row. */
  disabled?: boolean
  /** The layer(s) that disabled it (home / profile / skin-managed). */
  disabledBy?: string[]
}

/**
 * Read the profile manifest and resolve every plugin dependency row.
 * Missing installs are reported with installedDir = ''.
 */
export function listProfilePlugins(profile: string, home = resolveHome()): PluginRow[] {
  const dir = resolveProfileDir(profile, home)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) return []
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const bundles = new Set(manifest.dsh?.profile?.bundles ?? [])
  const disabledRows = collectDisabledRows(profile, home)
  const rows: PluginRow[] = []
  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    const installedDir = realInstalledDir(join(dir, 'node_modules', name))
    const row: PluginRow = { name, spec, bundle: bundles.has(name), installedDir }
    if (spec.startsWith('file:') || spec.startsWith('link:')) {
      row.sourceDir = spec.slice(spec.indexOf(':') + 1)
    } else {
      row.range = spec
    }
    // A plugin is disabled when any patch layer targets one of its loader
    // row ids with disabled: true. Row ids come from the plugin's own
    // cordis.patch.yml inserts (the bundle layer), falling back to the
    // package name — row ids are what the home patch actually targets.
    const rowIds = collectPluginRowIds(row, dir)
    const by: string[] = []
    for (const id of rowIds) {
      const layers = disabledRows.get(id)
      if (layers !== undefined) by.push(...layers)
    }
    if (by.length > 0) {
      row.disabled = true
      row.disabledBy = [...new Set(by)]
    }
    rows.push(row)
  }
  return rows
}

/**
 * Collect the loader row ids one plugin inserts through its bundle patch
 * (its cordis.patch.yml `insert` rows). Falls back to the package name.
 */
export function collectPluginRowIds(row: { name: string; sourceDir?: string; installedDir: string }, profileDir: string): string[] {
  const ids = new Set<string>()
  ids.add(row.name)
  const roots = [row.sourceDir, row.installedDir].filter((root): root is string => root !== undefined && root !== '')
  for (const root of roots) {
    const patchPath = join(root, 'cordis.patch.yml')
    if (!existsSync(patchPath)) continue
    let text: string
    try {
      text = readFileSync(patchPath, 'utf8')
    } catch {
      continue
    }
    // Match `- id: <id>` anywhere inside an insert block (plus top-level rows).
    for (const match of text.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)) {
      ids.add(match[1])
    }
  }
  return [...ids]
}

/**
 * Collect disabled:true row ids from the home patch and the profile patch.
 * Returns a map of row id → list of disabling layers.
 */
export function collectDisabledRows(profile: string, home = resolveHome()): Map<string, string[]> {
  const result = new Map<string, string[]>()
  const readLayer = (path: string, label: string): void => {
    if (!existsSync(path)) return
    let text: string
    try {
      text = readFileSync(path, 'utf8')
    } catch {
      return
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const match = /^\s*-\s+id:\s*(\S+)\s*$/.exec(lines[i])
      if (match === null) continue
      const ahead = lines.slice(i + 1, i + 4).join('\n')
      if (/disabled:\s*true/.test(ahead)) {
        const id = match[1]
        const layers = result.get(id) ?? []
        layers.push(label)
        result.set(id, layers)
      }
    }
  }
  readLayer(resolveHomePatch(home), 'home')
  readLayer(join(resolveProfileDir(profile, home), 'cordis.patch.yml'), 'profile')
  return result
}

/** Realpath an installed package dir; '' when absent or unreadable. */
function realInstalledDir(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return ''
  }
}

/**
 * Scan the harness install's @deepseek-ai scope for every package — these are
 * the BUILT-IN modules the web profile can load (the settings 插件 page lists
 * ~190 of them from the Loader), which profile dependencies never mention.
 * The healthcheck scope picker should offer them too, so "全部插件" matches
 * what the user sees elsewhere. Every scoped package is listed (not only
 * dsh.bundle declarers): dsh-base/dsh-web-app insert many rows whose module
 * packages never declare a bundle manifest themselves.
 */
export function listBuiltinBundles(home = resolveHome()): PluginRow[] {
  const scopeDir = join(resolveInstallRoot(), '@deepseek-ai')
  if (!existsSync(scopeDir)) return []
  const rows: PluginRow[] = []
  for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgDir = join(scopeDir, entry.name)
    if (!existsSync(join(pkgDir, 'package.json'))) continue
    rows.push({
      name: `@deepseek-ai/${entry.name}`,
      spec: 'builtin',
      bundle: true,
      installedDir: pkgDir,
      builtin: true,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}
