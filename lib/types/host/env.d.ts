/**
 * Host environment resolution: harness home, profile directory, plugin
 * inventory, and the harness install anchor. Pure path logic — no writes.
 * @module dsh-plugin-healthcheck/host/env
 */
/** Packages whose duplicate presence in the profile tree breaks module identity. */
export declare const HIGH_RISK_PACKAGES: readonly ["cordis", "cosmokit", "dsh-tools", "schemastery", "dsh-credentials", "dsh-home-paths"];
/** Resolve the harness home exactly as the dsh launcher does. */
export declare function resolveHome(): string;
/**
 * Locate the harness install root (M:\dsh\node_modules). Resolution goes
 * through the maintained flat fallback `$DSH_HOME/profiles/node_modules`
 * FIRST — that directory is healed by the launcher to point at the real
 * installation, and consulting it before any profile-local node_modules
 * makes the answer immune to the very duplicate-copy state this plugin
 * detects (a copy inside web/node_modules would otherwise hijack the root).
 * Falls back to module resolution of dsh-app-boot.
 */
export declare function resolveInstallRoot(home?: string): string;
/** The dsh app's package.json (install anchor for loadProfile). */
export declare function resolveInstallAnchor(): string;
/** The web profile directory. */
export declare function resolveProfileDir(name: string, home?: string): string;
/** The user plugin-source directory. */
export declare function resolvePluginsDir(home?: string): string;
/** The home-level patch file (highest-priority user layer). */
export declare function resolveHomePatch(home?: string): string;
/** The healthcheck history store directory. */
export declare function resolveHistoryDir(home?: string): string;
/** One installed plugin row from the profile manifest. */
export interface PluginRow {
    /** Dependency key (package name). */
    name: string;
    /** The raw specifier (file:/link:/registry range). */
    spec: string;
    /** Whether it is listed as a bundle layer. */
    bundle: boolean;
    /** Installed directory inside the profile (realpath'd). */
    installedDir: string;
    /** Source directory for file:/link: specs. */
    sourceDir?: string;
    /** Registry range for registry specs. */
    range?: string;
    /** Whether any patch layer disables this plugin's loader row. */
    disabled?: boolean;
    /** The layer(s) that disabled it (home / profile / skin-managed). */
    disabledBy?: string[];
}
/**
 * Read the profile manifest and resolve every plugin dependency row.
 * Missing installs are reported with installedDir = ''.
 */
export declare function listProfilePlugins(profile: string, home?: string): PluginRow[];
/**
 * Collect the loader row ids one plugin inserts through its bundle patch
 * (its cordis.patch.yml `insert` rows). Falls back to the package name.
 */
export declare function collectPluginRowIds(row: {
    name: string;
    sourceDir?: string;
    installedDir: string;
}, profileDir: string): string[];
/**
 * Collect disabled:true row ids from the home patch and the profile patch.
 * Returns a map of row id → list of disabling layers.
 */
export declare function collectDisabledRows(profile: string, home?: string): Map<string, string[]>;
//# sourceMappingURL=env.d.ts.map