// Fixture replicating the dsh-ssh-workspace cordis bug (pre-fix):
// ctx.plugin() is async, then sync localCtx.fs read fails.
import { SandboxedFileSystem } from '@deepseek-ai/dsh-fs-sandbox'

export const name = 'cordis-bug-fs'
export const inject = ['sshWorkspaceCore']

export function apply(ctx) {
  const localCtx = ctx.isolate('fs')
  ctx.plugin(SandboxedFileSystem)
  // BUG E1: plugin() is async — this sync read cannot work.
  const localFs = localCtx.fs
  // BUG E2: if constructed directly, config is missing.
  const otherFs = new SandboxedFileSystem(localCtx)
  return localFs
}
