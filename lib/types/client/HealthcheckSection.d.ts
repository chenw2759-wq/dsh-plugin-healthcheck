/**
 * The 插件检测 settings section: scope picker + layer toggles + run button,
 * live findings list with severity badges and per-finding actions (repair /
 * rollback / copy prompt), and the run history. All writes confirm first —
 * the panel shows a two-step confirm before sending any mutation.
 * @module dsh-plugin-healthcheck/client/HealthcheckSection
 */
import { type ReactNode } from 'react';
import type { HealthcheckKey } from './locales.ts';
/** Props the section binds: locale reader + the shell's close affordance. */
export interface HealthcheckSectionProps {
    /** Locale reader for this section's copy. */
    t: (key: HealthcheckKey) => string;
    /** Close the settings panel (shell-owned). */
    close: () => void;
}
/**
 * Render the healthcheck section.
 * @param props - locale copy and the close affordance.
 */
export declare function HealthcheckSection(props: HealthcheckSectionProps): ReactNode;
//# sourceMappingURL=HealthcheckSection.d.ts.map