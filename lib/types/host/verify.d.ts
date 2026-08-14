/**
 * L1 config-composition check — reuses the base's own patch algorithm
 * (composeEntries + applyEntryPatches) so the check can never drift from what
 * boot mounts, and L2 isolated smoke boot — a subprocess that boots the full
 * profile tree exactly like the real backend (webserver port offset to avoid
 * conflict) and reports activation through assertEntriesActivated.
 * @module dsh-plugin-healthcheck/host/verify
 */
import type { CheckFinding, SmokeResult } from '../core/types.ts';
/**
 * L1 — compose the profile's patch layers through the base algorithm and
 * audit the result: parse failures, row-id conflicts, and disable targets
 * that no longer exist.
 */
export declare function checkConfigComposition(profile: string, home: string): Promise<CheckFinding[]>;
/** Default smoke timeout (ms) — generous for cold boots with many bundles. */
export declare const SMOKE_TIMEOUT_MS = 90000;
/**
 * L2 — boot the whole profile tree in an isolated subprocess. The overlay
 * offsets the webserver port to 0 (OS-assigned) so the smoke boot never
 * fights the running backend for the real port. Success = every enabled
 * entry activated (assertEntriesActivated inside the runner).
 */
export declare function runSmokeBoot(profile: string, home: string, timeoutMs?: number): Promise<SmokeResult>;
/** Remove the smoke overlay file (best effort). */
export declare function cleanupSmokeOverlay(home: string, profile: string): void;
//# sourceMappingURL=verify.d.ts.map