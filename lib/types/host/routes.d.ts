/**
 * /healthcheck/* route layer: JSON envelope for the panel. Read paths are
 * unrestricted (they only report); every write path (repair / rollback)
 * requires `confirmed: true` in the payload — the panel shows the confirm
 * dialog BEFORE sending, and the route double-checks.
 * @module dsh-plugin-healthcheck/host/routes
 */
import type { Context } from '@deepseek-ai/cordis';
/** Register the /healthcheck routes on the shared webserver. */
export declare function registerHealthcheckRoutes(ctx: Context): () => void;
//# sourceMappingURL=routes.d.ts.map