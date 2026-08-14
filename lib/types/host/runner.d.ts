/**
 * L2 smoke-boot runner — the subprocess entry (lib/runner.js). Boots the full
 * profile tree through the base's own boot() so the check is identical to the
 * real startup path: loadProfile → composeEntries → boot → the base's
 * assertEntriesActivated audit. Exit 0 = every enabled entry activated;
 * exit non-zero = structured diagnostics on stderr.
 *
 * argv: <profile> <home> <overlayPatchPath>
 * @module dsh-plugin-healthcheck/host/runner
 */
export {};
//# sourceMappingURL=runner.d.ts.map