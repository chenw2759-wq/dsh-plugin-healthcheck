/**
 * Browser client for the host /healthcheck/* routes: typed JSON envelope
 * calls. Same-origin relative fetch (the page and the routes share the
 * webserver), mirroring the aionui-panel api discipline.
 * @module dsh-plugin-healthcheck/client/api
 */
import type { CheckFinding, Envelope, HistoryRecord, SmokeResult } from '../core/types.ts';
/** One installed plugin row for the scope picker. */
export interface InventoryRow {
    name: string;
    spec: string;
    bundle: boolean;
    /** Whether a patch layer currently disables the plugin. */
    disabled: boolean;
    /** The layers that disabled it (home/profile). */
    disabledBy: string[];
}
/** One run-status poll snapshot. */
export interface RunStatus {
    stage: 'l0' | 'l1' | 'l2' | 'malware' | 'done';
    finished: boolean;
    findings: CheckFinding[];
    smoke?: SmokeResult;
    error?: string;
}
/** Typed healthcheck operations over the wire. */
export declare class HealthcheckApi {
    /** List installed plugins for the scope picker. */
    inventory(): Promise<Envelope<InventoryRow[]>>;
    /** Start a check run; returns its runId. */
    run(payload: {
        profile?: string;
        plugin?: string;
        layers?: string[];
    }): Promise<Envelope<{
        runId: string;
    }>>;
    /** Poll one run's live state. */
    status(runId: string): Promise<Envelope<RunStatus>>;
    /** Apply one deterministic repair (the panel confirms first). */
    repair(repair: CheckFinding['repair'], confirmed: boolean): Promise<Envelope<{
        applied: boolean;
        message: string;
    }>>;
    /** Write a disabled row into the home patch (the panel confirms first). */
    rollback(pluginId: string, confirmed: boolean): Promise<Envelope<{
        applied: boolean;
        message: string;
    }>>;
    /** Remove the healthcheck rollback rows for one plugin. */
    undoRollback(pluginId: string): Promise<Envelope<{
        applied: boolean;
        message: string;
    }>>;
    /** Read the persisted run history. */
    history(): Promise<Envelope<HistoryRecord[]>>;
}
//# sourceMappingURL=api.d.ts.map