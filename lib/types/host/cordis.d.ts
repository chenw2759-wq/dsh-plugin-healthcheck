/**
 * C9 — cordis 用法检测（纯静态）。
 *
 * 针对本次 dsh-ssh-workspace 事故的三类 cordis 用法错误：
 *   E1  `ctx.plugin()` 是异步的，之后立即同步取 `localCtx.<service>` 拿不到
 *       → "cannot get property \"fs\" without inject"
 *   E2  直接 `new` 一个需要 config 的 cordis Service 但没传 config
 *       → "reading 'diffBasisMaxBytes'"
 *   E3  代码访问的服务不在 `inject` 数组里
 *       → "cannot get property \"sandboxPolicy\" without inject"（加载期）
 *
 * 与 C8 木马扫描同铁律：只 readFile，绝不 import/执行插件代码。
 * 静态启发式，可能误报——命中时给出 warn + 指向 L2 隔离试跑做权威确认。
 * @module dsh-plugin-healthcheck/host/cordis
 */
import type { CheckFinding } from '../core/types.ts';
/**
 * C9 — 运行全部 cordis 用法检查（E1/E2/E3），聚合为 findings。
 */
export declare function checkCordisUsage(root: string, pluginName: string): CheckFinding[];
//# sourceMappingURL=cordis.d.ts.map