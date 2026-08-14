/**
 * Dictionary namespace for the healthcheck settings section.
 * @module dsh-plugin-healthcheck/client/locales
 */

export type HealthcheckKey =
  | 'nav'
  | 'description'
  | 'scopeAll'
  | 'scopePlugin'
  | 'layerL0'
  | 'layerL1'
  | 'layerL2'
  | 'layerMalware'
  | 'start'
  | 'running'
  | 'stageL0'
  | 'stageL1'
  | 'stageL2'
  | 'stageMalware'
  | 'done'
  | 'error'
  | 'warn'
  | 'info'
  | 'none'
  | 'findings'
  | 'noFindings'
  | 'evidence'
  | 'repair'
  | 'rollback'
  | 'rollbackConfirm'
  | 'repairConfirm'
  | 'undoRollback'
  | 'copyPrompt'
  | 'promptCopied'
  | 'applySuccess'
  | 'applyFailed'
  | 'history'
  | 'historyEmpty'
  | 'plugin'
  | 'smokePassed'
  | 'smokeFailed'
  | 'busy'
  | 'ironRule'
  | 'malwareIronRule'
  | 'disabledBadge'

export const NS = 'plugin-healthcheck'

export const zh: Record<HealthcheckKey, string> = {
  nav: '插件检测',
  description: '安装新插件后先检测：静态检查 + 配置组合 + 隔离试跑，发现问题自动修复或回滚（不改 harness 源码）。',
  scopeAll: '全部插件',
  scopePlugin: '指定插件',
  layerL0: 'L0 静态检查',
  layerL1: 'L1 配置组合',
  layerL2: 'L2 隔离试跑',
  layerMalware: '木马扫描',
  start: '开始检测',
  running: '检测中…',
  stageL0: '静态检查：files 白名单 / 依赖声明 / 高危副本 / 依赖解析 / Windows 命令 / lockfile / 禁用插件',
  stageL1: '配置组合：bundle + profile + home 补丁层',
  stageL2: '隔离试跑：子进程完整 boot（约 10~60 秒）',
  stageMalware: '木马扫描：纯静态隔离（绝不执行插件代码）',
  done: '完成',
  error: '错误',
  warn: '警告',
  info: '信息',
  none: '无问题',
  findings: '检测结果',
  noFindings: '未发现问题 — 插件可以安全使用',
  evidence: '证据',
  repair: '一键修复',
  rollback: '自动回滚',
  rollbackConfirm: '将写入 home 层补丁禁用该插件（热重载生效，无需重启）。确认执行？',
  repairConfirm: '将执行确定修复（改插件代码/配置层，绝不改 harness）。确认执行？',
  undoRollback: '撤销回滚',
  copyPrompt: '复制提示词',
  promptCopied: '提示词已复制 — 开一个新会话粘贴给 agent 修复',
  applySuccess: '已应用',
  applyFailed: '执行失败',
  history: '检测历史',
  historyEmpty: '暂无记录',
  plugin: '插件',
  smokePassed: '试跑通过 — 全部插件激活',
  smokeFailed: '试跑失败 — 新插件会导致后端无法启动',
  busy: '已有检测在运行，请稍候',
  ironRule: '铁律：修复只改插件代码与配置层，严禁修改 harness 源码',
  malwareIronRule: '木马扫描为纯静态隔离执行：只读文件、绝不 import/运行插件代码；可疑插件先禁用隔离再人工复核',
  disabledBadge: '已禁用',
}

export const en: Record<HealthcheckKey, string> = {
  nav: 'Plugin healthcheck',
  description: 'Check newly installed plugins before they break the backend: static checks + config composition + isolated smoke boot. Fixes never touch harness source.',
  scopeAll: 'All plugins',
  scopePlugin: 'One plugin',
  layerL0: 'L0 static',
  layerL1: 'L1 config',
  layerL2: 'L2 smoke boot',
  layerMalware: 'Malware scan',
  start: 'Run check',
  running: 'Checking…',
  stageL0: 'Static: files whitelist / dep spec / risky copies / resolvability / Windows commands / lockfile / disabled plugins',
  stageL1: 'Config composition: bundle + profile + home patch layers',
  stageL2: 'Isolated smoke boot: full boot in a subprocess (~10–60s)',
  stageMalware: 'Malware scan: pure static, isolated — plugin code is never executed',
  done: 'Done',
  error: 'Error',
  warn: 'Warning',
  info: 'Info',
  none: 'All clear',
  findings: 'Findings',
  noFindings: 'No issues found — the plugin is safe to use',
  evidence: 'Evidence',
  repair: 'Repair',
  rollback: 'Roll back',
  rollbackConfirm: 'Write a disabled row into the home patch (hot-reloads, no restart). Confirm?',
  repairConfirm: 'Apply the deterministic fix (plugin code / config layer only, never harness). Confirm?',
  undoRollback: 'Undo rollback',
  copyPrompt: 'Copy prompt',
  promptCopied: 'Prompt copied — paste it into a new session for the agent to repair',
  applySuccess: 'Applied',
  applyFailed: 'Failed',
  history: 'History',
  historyEmpty: 'No records yet',
  plugin: 'Plugin',
  smokePassed: 'Smoke passed — every plugin activated',
  smokeFailed: 'Smoke failed — the new plugin would break backend startup',
  busy: 'A check is already running',
  ironRule: 'Iron rule: repairs touch plugin code and config layers only — never harness source',
  malwareIronRule: 'Malware scan is pure-static and isolated: files are only read, plugin code is never executed; quarantine suspicious plugins first, then review',
  disabledBadge: 'Disabled',
}
