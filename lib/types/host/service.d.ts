/**
 * The check-run service: orchestrates L0 (six checkers, per plugin + global),
 * L1 (config composition) and L2 (isolated smoke boot) into one run with
 * progress, and persists the history record.
 * @module dsh-plugin-healthcheck/host/service
 */
import type { CheckFinding, CheckLayer, SmokeResult } from '../core/types.ts';
import { type PluginRow } from './env.ts';
/** One run's live state (polled by the panel). */
export interface RunState {
    runId: string;
    profile: string;
    home: string;
    stage: CheckLayer | 'done';
    layers: CheckLayer[];
    findings: CheckFinding[];
    smoke?: SmokeResult;
    startedAt: string;
    finished: boolean;
    error?: string;
}
/** Scope of a run: every plugin or one named plugin. */
export interface RunRequest {
    profile?: string;
    /** Plugin filter; undefined = all plugins. */
    plugin?: string;
    /** Layers to run; undefined = all three + malware. */
    layers?: CheckLayer[];
}
/** Kick off a run in the background and return its id. */
export declare function startRun(request: RunRequest): string;
/** Read one run state (undefined once pruned). */
export declare function getRun(runId: string): RunState | undefined;
/** Read persisted history. */
export declare function getHistory(): unknown[];
/** Human summary of the plugin inventory (for the panel header). */
export declare function inventorySummary(): {
    total: number;
    bundles: number;
};
export type { PluginRow };
//# sourceMappingURL=service.d.ts.map