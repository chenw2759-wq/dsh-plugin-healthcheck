/**
 * L2 smoke-boot runner — the subprocess entry (lib/runner.js). Boots the full
 * profile tree through the base's own boot() so the check is identical to the
 * real startup path: loadProfile → composeEntries → boot → the base's
 * assertEntriesActivated audit. Exit 0 = every enabled entry activated;
 * exit non-zero = structured diagnostics on stderr.
 *
 * argv: <profile> <home> <overlayPatchPath>
 * @module dsh-plugin-healthcheck/host/runner
 */

import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const [profileArg, homeArg, overlayArg] = process.argv.slice(2)
if (profileArg === undefined || homeArg === undefined || overlayArg === undefined) {
  process.stderr.write('runner: usage: node runner.js <profile> <home> <overlay>\n')
  process.exit(2)
}

const PROFILE_ROOT_CONFIG = '# healthcheck smoke root — empty entry list, same as profile boot\n[]\n'

let exitCode = 0
try {
  const appBoot = await import('@deepseek-ai/dsh-app-boot')
  const { loadProfile, boot, loadOptionalPatches, loadOverlayPatches, PROFILE_PATCH_FILENAME } = appBoot
  const { provideCmdline } = await import('@deepseek-ai/dsh-cmdline')

  // The dsh app install anchor, resolved through the maintained flat fallback
  // (profiles/node_modules/@deepseek-ai/dsh is a symlink to the installation).
  const installAnchor = join(homeArg, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  const loaded = loadProfile('dsh-healthcheck', profileArg, installAnchor, homeArg)

  // Recreate the exact layer stack profile-boot composes: bundle layers in
  // order, the profile's own patch file, the home-level patch, then overlays.
  const bundlePatches = loaded.layers.flatMap((layer) => layer.patches)
  const profilePatches = loaded.patches
  const homePatches = loadOptionalPatches('dsh-healthcheck', join(homeArg, PROFILE_PATCH_FILENAME)) ?? []
  const overlays = [overlayArg].flatMap((file) => loadOverlayPatches('dsh-healthcheck', file))
  const patches = [
    ...bundlePatches,
    ...profilePatches,
    ...homePatches,
    ...overlays,
  ]

  // The root config must exist on disk: the Loader anchors baseUrl at the
  // profile directory (the same 'cordis.yml' file profile-boot rewrites every
  // boot — the filename is fixed by the dsh launcher).
  const rootConfig = join(loaded.dir, 'cordis.yml')
  writeFileSync(rootConfig, PROFILE_ROOT_CONFIG, 'utf8')

  await boot('dsh-healthcheck', rootConfig, patches, (hostCtx) => {
    // The web profile's startup row injects cmdlineArgs (same seam
    // profile-boot provides before the tree mounts); without it every
    // webStartup-dependent row stays pending and the smoke boot false-fails.
    provideCmdline(hostCtx, { args: [], exit: (code) => { process.exitCode = code } })
  })
  // boot() already ran assertEntriesActivated — reaching here means the whole
  // tree is active. Dispose and report success.
  process.stdout.write('healthcheck-smoke: ok — all entries activated\n')
  exitCode = 0
} catch (error) {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`healthcheck-smoke: failed\n${message}\n`)
  exitCode = 1
}

// Bounded exit: a wedged tree must not linger (the parent also has a kill
// timer, this is the in-process backstop).
process.exit(exitCode)
