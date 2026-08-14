/**
 * L0 static checkers — file-system level, no loading, no boot.
 * Each checker is a pure function over (home, profileDir, pluginRow) that
 * returns structured findings. Every finding carries a deterministic repair
 * action or a prepared prompt (see core/types).
 * @module dsh-plugin-healthcheck/host/checkers
 */
import type { CheckFinding } from '../core/types.ts';
import { type PluginRow } from './env.ts';
/** Context handed to every checker. */
export interface CheckerContext {
    home: string;
    profileDir: string;
    profile: string;
}
/**
 * C1 — files 白名单完整性（防 dsh-pet 复发）。
 * 多入口构建 + 固定文件名白名单 → 带哈希 chunk 被过滤 → ERR_MODULE_NOT_FOUND。
 */
export declare function checkFilesWhitelist(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/**
 * C2 — 依赖声明审计（防 link:/file: 坑）。
 */
export declare function checkDependencySpec(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/**
 * C3 — 高危副本检测（防模块双实例）。
 */
export declare function checkHighRiskCopies(ctx: CheckerContext, _row: PluginRow): CheckFinding[];
/**
 * C4 — 依赖可解析性（防 ERR_MODULE_NOT_FOUND）。
 */
export declare function checkDependencyResolvability(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/**
 * C5 — Windows 命令可用性（防 dsh-skin CLI not found 复发）。
 * 扫描插件对 execFile/spawn 的裸命令引用，验证注册表 PATH 中能找到真 .exe。
 */
export declare function checkWindowsCommands(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/**
 * C6 — lockfile 一致性（防"改 specifier 不重解析"）。
 */
export declare function checkLockfileConsistency(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/**
 * C7 — 禁用插件状态识别。被禁用的插件有两种情形：
 * 1. 二分排查遗留（如本次事故的 context-lens / dsh-memory）——已知有问题，
 *    应继续排查根因或移除，而不是带着 disabled 行长期运行；
 * 2. dsh-skin 管理的皮肤互斥（ui-skin-*）——正常机制，不告警。
 * 检查器只对第 1 类给出 warn：被禁用的插件仍在 profile 依赖里，占用磁盘、
 * 参与 install 的 peer 副本安装，且它的问题本身未被修复。
 */
export declare function checkDisabledPlugins(ctx: CheckerContext, row: PluginRow): CheckFinding[];
/** All L0 checkers in run order. */
export declare const L0_CHECKERS: readonly [typeof checkFilesWhitelist, typeof checkDependencySpec, typeof checkHighRiskCopies, typeof checkDependencyResolvability, typeof checkWindowsCommands, typeof checkLockfileConsistency, typeof checkDisabledPlugins];
/** Global L0 checks (profile-wide, not per plugin). */
export declare function checkGlobalL0(ctx: CheckerContext, rows: PluginRow[]): CheckFinding[];
//# sourceMappingURL=checkers.d.ts.map