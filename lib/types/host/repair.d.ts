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
import type { RepairAction } from '../core/types.ts';
import { type PluginRow } from './env.ts';
/** One applied repair outcome. */
export interface RepairOutcome {
    action: 'files-whitelist' | 'remove-copies' | 'write-patch' | 'none';
    applied: boolean;
    message: string;
}
/**
 * The write gate. Canonicalizes the target and refuses anything outside the
 * harness home or inside the harness install root. This is the safety
 * boundary between "repairing a plugin" and "modifying harness source".
 */
export declare function assertSafeTarget(path: string, home?: string): string;
/** Execute one deterministic repair action under the safety gate. */
export declare function applyRepair(action: RepairAction, home?: string): RepairOutcome;
/**
 * Auto-rollback: append `- id: <id>\n  disabled: true` to the home patch
 * (HMR hot-applies it in the running backend within seconds). Idempotent:
 * an existing disabled row for the id is left untouched. Validated by parsing
 * the result with the include plugin's schema before replacing the file.
 */
export declare function rollbackPlugin(pluginId: string, home?: string): RepairOutcome;
/** Undo a healthcheck rollback: remove the auto-rollback rows for one id. */
export declare function undoRollback(pluginId: string, home?: string): RepairOutcome;
/** Persist the run history (last N records). */
export declare function appendHistory(record: unknown, home?: string, keep?: number): void;
/** Read the persisted run history. */
export declare function readHistory(home?: string): unknown[];
/** Find one plugin row by name among the profile inventory. */
export declare function findPluginRow(rows: PluginRow[], name: string): PluginRow | undefined;
//# sourceMappingURL=repair.d.ts.map