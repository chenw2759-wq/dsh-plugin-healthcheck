/**
 * dsh-plugin-healthcheck — browser half: registers the 插件检测 settings
 * section (the left-bottom settings panel's navigation list). Failure
 * policy: every wiring failure is logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws.
 * @module dsh-plugin-healthcheck/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings-surface SlotMap merge ('settings.section').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { HealthcheckSection } from './HealthcheckSection.tsx'
import { NS, en, zh, type HealthcheckKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Plugin healthcheck section copy. */
    'plugin-healthcheck': HealthcheckKey
  }
}

/** Required services. */
export const inject = ['slots', 'locale']

/**
 * Apply the browser half: dictionaries, then one settings.section entry.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-healthcheck: dictionaries')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugin-healthcheck',
    order: 80,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
  }, HealthcheckSection))
}
