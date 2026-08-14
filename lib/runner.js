import { writeFileSync } from "node:fs";
import { join } from "node:path";
//#region src/host/runner.ts
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
const [profileArg, homeArg, overlayArg] = process.argv.slice(2);
if (profileArg === void 0 || homeArg === void 0 || overlayArg === void 0) {
	process.stderr.write("runner: usage: node runner.js <profile> <home> <overlay>\n");
	process.exit(2);
}
const PROFILE_ROOT_CONFIG = "# healthcheck smoke root — empty entry list, same as profile boot\n[]\n";
let exitCode = 0;
try {
	const { loadProfile, boot, loadOptionalPatches, loadOverlayPatches, PROFILE_PATCH_FILENAME } = await import("@deepseek-ai/dsh-app-boot");
	const { provideCmdline } = await import("@deepseek-ai/dsh-cmdline");
	const loaded = loadProfile("dsh-healthcheck", profileArg, join(homeArg, "profiles", "node_modules", "@deepseek-ai", "dsh", "package.json"), homeArg);
	const bundlePatches = loaded.layers.flatMap((layer) => layer.patches);
	const profilePatches = loaded.patches;
	const homePatches = loadOptionalPatches("dsh-healthcheck", join(homeArg, PROFILE_PATCH_FILENAME)) ?? [];
	const overlays = [overlayArg].flatMap((file) => loadOverlayPatches("dsh-healthcheck", file));
	const patches = [
		...bundlePatches,
		...profilePatches,
		...homePatches,
		...overlays
	];
	const rootConfig = join(loaded.dir, "cordis.yml");
	writeFileSync(rootConfig, PROFILE_ROOT_CONFIG, "utf8");
	await boot("dsh-healthcheck", rootConfig, patches, (hostCtx) => {
		provideCmdline(hostCtx, {
			args: [],
			exit: (code) => {
				process.exitCode = code;
			}
		});
	});
	process.stdout.write("healthcheck-smoke: ok — all entries activated\n");
	exitCode = 0;
} catch (error) {
	const message = error instanceof Error ? error.stack ?? error.message : String(error);
	process.stderr.write(`healthcheck-smoke: failed\n${message}\n`);
	exitCode = 1;
}
process.exit(exitCode);
//#endregion
export {};
