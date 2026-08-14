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
import type { Context } from '@deepseek-ai/cordis';
/** Required services: the route registry and the prompt band. */
export declare const inject: string[];
/** Model-facing announcement: plugin presence, capabilities, and limits. */
export declare const HEALTHCHECK_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-plugin-healthcheck \u63D2\u4EF6\uFF08DSH \u63D2\u4EF6\u5065\u5EB7\u68C0\u67E5\uFF09\uFF1A\u8BBE\u7F6E\u9762\u677F\uFF08\u5DE6\u4E0B\u89D2\u8BBE\u7F6E\uFF09\u5185\u6709\u300C\u63D2\u4EF6\u68C0\u6D4B\u300D\u5411\u5BFC \u2014 L0 \u9759\u6001\u68C0\u67E5\uFF08files \u767D\u540D\u5355/\u4F9D\u8D56\u58F0\u660E/\u9AD8\u5371\u526F\u672C/\u4F9D\u8D56\u53EF\u89E3\u6790/Windows \u547D\u4EE4/lockfile \u4E00\u81F4\u6027\uFF09+ L1 \u914D\u7F6E\u7EC4\u5408\u68C0\u67E5 + L2 \u9694\u79BB\u8BD5\u8DD1\uFF08\u5B50\u8FDB\u7A0B\u5B8C\u6574 boot \u9A8C\u8BC1\u65B0\u63D2\u4EF6\u4E0D\u4F1A\u5BFC\u81F4\u540E\u7AEF\u542F\u52A8\u5931\u8D25\uFF09\u3002\u80FD\u529B\uFF1A\u68C0\u6D4B\u53EF\u8C03\u7528\u5DE5\u5177\uFF08node \u89E3\u6790/\u6CE8\u518C\u8868 PATH/\u8FDB\u7A0B\u68C0\u67E5\u7B49\uFF09\uFF1B\u53D1\u73B0\u5373\u7ED9\u51FA\u4FEE\u590D \u2014 \u786E\u5B9A\u6027\u4FEE\u590D\u81EA\u52A8\u6267\u884C\uFF08\u6539 files/\u5220\u526F\u672C\uFF0C\u5E94\u7528\u524D\u5F39\u786E\u8BA4\uFF09\u3001\u8BD5\u8DD1\u5931\u8D25\u81EA\u52A8\u56DE\u6EDA\uFF08\u5199 ~/.dsh/cordis.patch.yml \u7684 disabled \u884C\uFF0CHMR \u70ED\u751F\u6548\u65E0\u9700\u91CD\u542F\uFF09\u3001\u590D\u6742\u95EE\u9898\u6253\u5305\u9884\u5236\u63D0\u793A\u8BCD\u4EA4\u7ED9 agent \u4FEE\u590D\u3002\u94C1\u5F8B\uFF1A\u4FEE\u590D\u53EA\u5141\u8BB8\u6539\u63D2\u4EF6\u4EE3\u7801\u4E0E\u914D\u7F6E\u5C42\uFF0C\u4E25\u7981\u4FEE\u6539 harness \u6E90\u7801\uFF08M:\\dsh\\node_modules\uFF09\u3002\u7528\u6237\u63D0\u5230\u300C\u63D2\u4EF6\u68C0\u6D4B / \u5065\u5EB7\u68C0\u67E5 / \u63D2\u4EF6\u68C0\u6D4B\u5411\u5BFC\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
/**
 * Mount the check-run routes and the prompt announcement.
 * @param ctx - context carrying webServer and systemPrompt.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map