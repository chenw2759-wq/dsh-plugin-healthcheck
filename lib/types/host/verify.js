/**
 * L1 config-composition check — reuses the base's own patch algorithm
 * (composeEntries + applyEntryPatches) so the check can never drift from what
 * boot mounts, and L2 isolated smoke boot — a subprocess that boots the full
 * profile tree exactly like the real backend (webserver port offset to avoid
 * conflict) and reports activation through assertEntriesActivated.
 * @module dsh-plugin-healthcheck/host/verify
 */
import { spawn } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHomePatch, resolveInstallAnchor } from "./env.js";
/** The L1 finding factory. */
function l1Finding(code, severity, message, evidence = []) {
    return { layer: 'l1', code, severity, message, evidence, fixKind: 'prompt' };
}
/**
 * L1 — compose the profile's patch layers through the base algorithm and
 * audit the result: parse failures, row-id conflicts, and disable targets
 * that no longer exist.
 */
export async function checkConfigComposition(profile, home) {
    const { loadProfile, composeEntries, loadOptionalPatches } = await import('@deepseek-ai/dsh-app-boot');
    const findings = [];
    let composed;
    try {
        const loaded = loadProfile('dsh-healthcheck', profile, resolveInstallAnchor(), home);
        const bundlePatches = loaded.layers.flatMap((layer) => layer.patches);
        const profilePatches = loaded.patches;
        const homePatches = loadOptionalPatches('dsh-healthcheck', resolveHomePatch(home)) ?? [];
        const warns = [];
        composed = composeEntries([bundlePatches, profilePatches, homePatches], (message) => warns.push(message));
        for (const warn of warns) {
            findings.push(l1Finding('patch-skipped', 'warn', warn));
        }
    }
    catch (error) {
        findings.push(l1Finding('config-compose-failed', 'error', `配置树组合失败：${error instanceof Error ? error.message : String(error)}`));
        return findings;
    }
    // Row-id conflicts: two rows with the same id → last one silently wins.
    const ids = new Map();
    for (const row of composed) {
        if (typeof row.id === 'string')
            ids.set(row.id, (ids.get(row.id) ?? 0) + 1);
    }
    for (const [id, count] of ids) {
        if (count > 1) {
            findings.push(l1Finding('duplicate-row-id', 'error', `组合配置中行 id "${id}" 出现 ${count} 次 — 后加载的层会静默覆盖先加载的层`, [`id: ${id}`]));
        }
    }
    findings.push(l1Finding('config-compose-ok', 'info', `配置树组合成功：${composed.length} 行（bundle 层 ${findings.length > 0 ? '有告警' : '无告警'}）`));
    return findings;
}
/**
 * Resolve the runner entry. In the built profile copy it is lib/runner.js
 * beside the bundled host module; under vitest the source module resolves
 * it to lib/runner.js relative to the package root.
 */
function resolveRunnerPath() {
    const candidates = [
        fileURLToPath(new URL('./runner.js', import.meta.url)),
        fileURLToPath(new URL('../../lib/runner.js', import.meta.url)),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return candidates[0];
}
/** Default smoke timeout (ms) — generous for cold boots with many bundles. */
export const SMOKE_TIMEOUT_MS = 90_000;
/**
 * L2 — boot the whole profile tree in an isolated subprocess. The overlay
 * offsets the webserver port to 0 (OS-assigned) so the smoke boot never
 * fights the running backend for the real port. Success = every enabled
 * entry activated (assertEntriesActivated inside the runner).
 */
export function runSmokeBoot(profile, home, timeoutMs = SMOKE_TIMEOUT_MS) {
    const overlayPath = writeSmokeOverlay(home, profile);
    const runnerPath = resolveRunnerPath();
    const started = Date.now();
    return new Promise((resolvePromise) => {
        const child = spawn(process.execPath, [runnerPath, profile, home, overlayPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (ok, stage, error) => {
            if (settled)
                return;
            settled = true;
            cleanupSmokeOverlay(home, profile);
            resolvePromise({ ok, durationMs: Date.now() - started, stage, error });
        };
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', (error) => finish(false, 'spawn', error.message));
        child.on('exit', (code) => {
            if (code === 0) {
                finish(true);
            }
            else {
                const detail = stderr.trim() || stdout.trim();
                finish(false, `exit ${String(code)}`, detail.slice(-4000));
            }
        });
        setTimeout(() => {
            if (!settled) {
                try {
                    child.kill();
                }
                catch { /* already gone */ }
                finish(false, 'timeout', `smoke boot exceeded ${timeoutMs}ms (hang risk — a plugin init never settled)`);
            }
        }, timeoutMs);
    });
}
/** Write a temp overlay that offsets the webserver port to 0. */
function writeSmokeOverlay(home, profile) {
    const path = join(home, 'profiles', profile, `.healthcheck-overlay-${process.pid}.yml`);
    const overlay = `# healthcheck smoke overlay — port 0 lets the smoke boot bind an
# OS-assigned port, so it never conflicts with the running backend.
- id: webserver
  config:
    host: 127.0.0.1
    port: 0
`;
    writeFileSync(path, overlay, 'utf8');
    return path;
}
/** Remove the smoke overlay file (best effort). */
export function cleanupSmokeOverlay(home, profile) {
    const path = join(home, 'profiles', profile, `.healthcheck-overlay-${process.pid}.yml`);
    try {
        unlinkSync(path);
    }
    catch {
        // best effort
    }
}
