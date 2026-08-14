/**
 * dsh-plugin-healthcheck — browser half: registers the 插件检测 settings
 * section (the left-bottom settings panel's navigation list). Failure
 * policy: every wiring failure is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module dsh-plugin-healthcheck/client
 */
import { HealthcheckSection } from "./HealthcheckSection.js";
import { NS, en, zh } from "./locales.js";
/** Required services. */
export const inject = ['slots', 'locale'];
/**
 * Apply the browser half: dictionaries, then one settings.section entry.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-healthcheck: dictionaries');
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'plugin-healthcheck',
        order: 80,
        label: () => ctx.locale.bind(NS)('nav'),
        locale: NS,
    }, HealthcheckSection));
}
