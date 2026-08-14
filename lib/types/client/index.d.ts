/**
 * dsh-plugin-healthcheck — browser half: registers the 插件检测 settings
 * section (the left-bottom settings panel's navigation list). Failure
 * policy: every wiring failure is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module dsh-plugin-healthcheck/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type HealthcheckKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Plugin healthcheck section copy. */
        'plugin-healthcheck': HealthcheckKey;
    }
}
/** Required services. */
export declare const inject: string[];
/**
 * Apply the browser half: dictionaries, then one settings.section entry.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map