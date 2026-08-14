/**
 * @deepseek-ai/dsh-plugin-healthcheck — host half: the /healthcheck/* routes
 * (check-run service, repair executor with the harness-source write ban, and
 * auto-rollback into the home patch), plus the system-prompt announcement so
 * agents know the 插件检测 panel exists and how to cooperate with it.
 *
 * 铁律：本插件的修复执行器严禁修改 harness 源码（安装目录），只允许修改
 * 插件代码（~/.dsh/plugins/**）与配置层（~/.dsh/profiles/**、
 * ~/.dsh/cordis.patch.yml）。写路径全部经 repair.assertSafeTarget 门禁。
 * @module dsh-plugin-healthcheck
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { registerHealthcheckRoutes } from './host/routes.ts'

/** Required services: the route registry and the prompt band. */
export const inject = ['webServer', 'systemPrompt']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 230

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const HEALTHCHECK_GUIDANCE = '本机已安装 dsh-plugin-healthcheck 插件（DSH 插件健康检查）：设置面板（左下角设置）内有「插件检测」向导 — L0 静态检查（files 白名单/依赖声明/高危副本/依赖可解析/Windows 命令/lockfile 一致性）+ L1 配置组合检查 + L2 隔离试跑（子进程完整 boot 验证新插件不会导致后端启动失败）。能力：检测可调用工具（node 解析/注册表 PATH/进程检查等）；发现即给出修复 — 确定性修复自动执行（改 files/删副本，应用前弹确认）、试跑失败自动回滚（写 ~/.dsh/cordis.patch.yml 的 disabled 行，HMR 热生效无需重启）、复杂问题打包预制提示词交给 agent 修复。铁律：修复只允许改插件代码与配置层，严禁修改 harness 源码（M:\\dsh\\node_modules）。用户提到「插件检测 / 健康检查 / 插件检测向导」时即指本插件，请据此协作。'

/**
 * Mount the check-run routes and the prompt announcement.
 * @param ctx - context carrying webServer and systemPrompt.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => registerHealthcheckRoutes(ctx), 'dsh-plugin-healthcheck: /healthcheck routes')
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'plugin:healthcheck',
    order: SECTION_ORDER,
    text: HEALTHCHECK_GUIDANCE,
  }), 'dsh-plugin-healthcheck: prompt section')
}
