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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
/** Known cordis Service classes that REQUIRE config when constructed directly. */
const CONFIG_REQUIRED_SERVICES = [
    'SandboxedFileSystem',
];
/** File extensions scanned. */
const SCAN_EXT = /\.(ts|tsx|js|mjs|cjs)$/i;
/** Directories skipped. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'lib/types', '.dsh', 'tests', 'test', '__tests__', 'fixtures', 'lib']);
/** Strip `// line` and `/* block *​/` comments from one line (approx, good enough for heuristic). */
function stripComments(line) {
    return line
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:"'\\])\/\/.*$/g, '$1');
}
/** Cordis core methods/props that never need inject declaration. */
const CORE_MEMBERS = new Set([
    'plugin', 'isolate', 'effect', 'provide', 'get', 'on', 'emit', 'once', 'off',
    'slots', 'locale', 'loader', 'appExit', 'baseUrl', 'model', 'schema', 'logger',
    'settings', 'scope', 'store', 'state', 'config', 'fiber', 'runtime',
]);
/**
 * Known harness service vocabulary — E3 only flags `ctx.<svc>` when the name
 * looks like a real harness/plugin service (camelCase, known prefix or a
 * plugin-provided service), NOT a tool-local context (`ctx.run`, `ctx.repoDir`)
 * which is a plain local object and never a cordis injection.
 */
const SERVICE_LIKE_PREFIX = new Set([
    'fs', 'shell', 'session', 'storage', 'tools', 'webServer', 'systemPrompt',
    'sandboxPolicy', 'agent', 'agents', 'llm', 'workspace', 'subprocess', 'cmdline',
    'invariants', 'attachment', 'compaction', 'subagent', 'workflow', 'sessions',
    'projects', 'directoryPicker', 'apiProxy', 'connection', 'settings', 'model',
]);
/** Read `export const inject = [...]` from a plugin's source files. */
function readInject(root) {
    const inject = new Set();
    const files = collectFiles(root);
    for (const file of files) {
        let content;
        try {
            content = readFileSync(file, 'utf8');
        }
        catch {
            continue;
        }
        const match = /\bexport\s+const\s+inject\s*=\s*\[([^\]]*)\]/.exec(content);
        if (match === null)
            continue;
        for (const key of match[1].matchAll(/['"]([^'"]+)['"]/g))
            inject.add(key[1]);
    }
    return [...inject];
}
/** Walk the plugin tree for scannable source files. */
function collectFiles(root) {
    const files = [];
    const walk = (dir, depth) => {
        if (depth > 6)
            return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name))
                    walk(path, depth + 1);
                continue;
            }
            if (SCAN_EXT.test(entry.name))
                files.push(path);
        }
    };
    walk(root, 0);
    return files;
}
/**
 * E1 — `ctx.plugin(...)` 后同步取服务。`plugin()` 只调度一个异步 fiber，
 * 返回后立即 `localCtx.fs`（或 `ctx.get('fs')`）必然拿不到（隔离 key 对不上
 * 或服务尚未激活）——正是 "cannot get property X without inject" 的源头。
 */
function detectAsyncPluginThenSync(root) {
    const hits = [];
    for (const file of collectFiles(root)) {
        let content;
        try {
            content = readFileSync(file, 'utf8');
        }
        catch {
            continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const codeLine = stripComments(lines[i]);
            // Match `ctx.plugin(X)` / `localCtx.plugin(X)` (not preceded by await).
            const pluginCall = /(?<!await\s)(?:ctx|localCtx|hostCtx|scope)\.plugin\s*\(/.exec(codeLine);
            if (pluginCall === null)
                continue;
            // Look ahead a few lines for a synchronous service read (no await).
            for (let j = i + 1; j <= i + 6 && j < lines.length; j++) {
                const ahead = stripComments(lines[j]);
                if (ahead === '')
                    continue;
                if (/\bawait\b/.test(ahead))
                    break; // awaited later — the pattern is legit
                const syncRead = /(?:ctx|localCtx|hostCtx)\.(?:fs|subprocess|shell|session|storage|tools|webServer|systemPrompt|sandboxPolicy)\b/.exec(ahead);
                if (syncRead !== null) {
                    hits.push({
                        code: 'async-plugin-then-sync',
                        file: relativeTo(root, file),
                        line: i + 1,
                        snippet: `${codeLine.trim()} → ${ahead.trim()}`,
                        detail: `ctx.plugin() 是异步的，随后第 ${j + 1} 行同步访问 ${syncRead[0]} 必然拿不到服务（"cannot get property without inject"）。应改用同步构造：const svc = new Service(ctx, config) 并持有实例引用，或用 ctx.isolate() 后 await。`,
                    });
                    break;
                }
            }
        }
    }
    return hits;
}
/**
 * E2 — 直接 `new` 一个需要 config 的 cordis Service 但没传 config。
 * 直接 new 不走 cordis 的 config 默认值填充，服务构造器读配置字段会
 * "reading 'xxx'"。
 */
function detectNewServiceNoConfig(root) {
    const hits = [];
    for (const file of collectFiles(root)) {
        let content;
        try {
            content = readFileSync(file, 'utf8');
        }
        catch {
            continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const codeLine = stripComments(lines[i]);
            for (const service of CONFIG_REQUIRED_SERVICES) {
                const match = new RegExp(`\\bnew\\s+${service}\\s*\\(`).exec(codeLine);
                if (match === null)
                    continue;
                // Count top-level args: if only one arg (ctx), config is missing.
                const rest = codeLine.slice(match.index + match[0].length);
                const args = rest.split(/,(?![^()]*\()/);
                if (args.length <= 1) {
                    hits.push({
                        code: 'new-service-no-config',
                        file: relativeTo(root, file),
                        line: i + 1,
                        snippet: codeLine.trim(),
                        detail: `${service} 直接 new 时缺 config（直接 new 不走 cordis config 默认值填充）→ 读取配置字段时 "reading 'diffBasisMaxBytes'"。应传入与部署默认一致的 config，如 { cwd, diffBasisMaxBytes: 10 * 1024 * 1024 }。`,
                    });
                }
                break;
            }
        }
    }
    return hits;
}
/**
 * E3 — inject 缺失检测：`export const inject` 声明的服务里缺少构造时
 * 消费的提供方。最直接的信号：`ctx.<service>` 访问但 inject 未声明。
 * 只匹配 `ctx.<svc>.<member>` 形态（明确的属性访问），跳过核心 API 与
 * 注释、声明行，降低误报。
 */
function detectInjectMissing(root, info) {
    const hits = [];
    for (const file of collectFiles(root)) {
        let content;
        try {
            content = readFileSync(file, 'utf8');
        }
        catch {
            continue;
        }
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const codeLine = stripComments(lines[i]);
            // Skip the inject declaration itself and known core methods.
            if (/\bexport\s+const\s+inject\b/.test(codeLine))
                continue;
            // A service read: `ctx.<svc>` used as a value — followed by `.`, `(`,
            // `,`, `;`, `]`, `)`, or end of line (assignment, arg, member access).
            const match = /\b(?:ctx|localCtx|hostCtx)\.([a-zA-Z][a-zA-Z0-9]*)\s*(?=[.(,;\])]|\s*$)/.exec(codeLine);
            if (match === null)
                continue;
            const service = match[1];
            if (CORE_MEMBERS.has(service) || info.inject.includes(service))
                continue;
            // Only flag names that look like a real harness service. A tool-local
            // context (`ctx.run`, `ctx.repoDir`, `ctx.git`) is a plain local object
            // and never an inject declaration — flagging it is noise.
            if (![...SERVICE_LIKE_PREFIX].some((prefix) => service === prefix || service.startsWith(prefix + ':'))) {
                continue;
            }
            hits.push({
                code: 'inject-missing-service',
                file: relativeTo(root, file),
                line: i + 1,
                snippet: codeLine.trim(),
                detail: `访问 ctx.${service} 但 inject 未声明 "${service}"（声明: ${info.inject.join(', ') || '(空)'}）→ 加载期 "cannot get property \"${service}\" without inject"。若该服务由当前插件自己 provide 则忽略此条。`,
            });
        }
    }
    return hits;
}
function relativeTo(root, file) {
    return file.startsWith(root) ? file.slice(root.length).replace(/^[/\\]/, '') : file;
}
/**
 * C9 — 运行全部 cordis 用法检查（E1/E2/E3），聚合为 findings。
 */
export function checkCordisUsage(root, pluginName) {
    if (root === '')
        return [];
    const info = { root, inject: readInject(root) };
    const hits = [
        ...detectAsyncPluginThenSync(root),
        ...detectNewServiceNoConfig(root),
        ...detectInjectMissing(root, info),
    ];
    if (hits.length === 0)
        return [];
    const findings = [];
    for (const hit of hits) {
        findings.push({
            layer: 'l0',
            code: hit.code,
            severity: 'warn',
            plugin: pluginName,
            message: `${pluginName} 检测到 cordis 用法风险（${hit.detail.slice(0, 60)}…）`,
            evidence: [`${hit.file}:${hit.line}`, hit.snippet],
            fixKind: 'prompt',
            prompt: `你是 DSH 插件的修复助手。铁律：只允许修改插件代码与配置层（~/.dsh/plugins/**、~/.dsh/profiles/**、~/.dsh/cordis.patch.yml），严禁修改 harness 源码。

【cordis 用法问题】${pluginName} — ${hit.code}
${hit.detail}

【证据】${hit.file}:${hit.line}
${hit.snippet}

【修复方向】
1. 若为 E1（ctx.plugin() 后同步取服务）：改用同步构造 —— const svc = new Service(ctx, config)，持有实例引用直接使用；隔离作用域用 ctx.isolate() 且 await 其 plugin 结果后再取服务。
2. 若为 E2（new Service 缺 config）：补上与部署默认一致的 config（对照 harness 内同服务的默认行）。
3. 若为 E3（inject 缺服务）：在 export const inject = [...] 补上缺失的服务名；若该服务由插件自身 provide 则忽略。
4. 修完运行「插件检测」的 L2 隔离试跑确认能完整 boot。`,
        });
    }
    return findings;
}
