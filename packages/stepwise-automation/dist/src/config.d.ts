/**
 * Browser configuration options.
 */
export interface BrowserConfig {
    /** Absolute path to the browser executable (overrides auto-detection). */
    executablePath?: string;
    /** Absolute path to the browser's user data directory (persistent profile). */
    userDataDir?: string;
    /** Profile subdirectory name within `userDataDir` (e.g. `"Default"`). */
    profileDir?: string;
    /** Default viewport dimensions for the browser content area. */
    defaultViewport?: {
        width: number;
        height: number;
    };
    /** Whether to launch the browser in headless mode. */
    headless?: boolean;
}
/**
 * Configuration for the stepwise automation test runner.
 * All fields are optional — sensible defaults are applied by `loadConfig()`.
 */
export interface StepwiseConfig {
    /** Glob pattern for journey files. Defaults to `'./journeys/**\/*.journey.ts'`. */
    journeys?: string;
    /** Test data lifecycle hooks — all paths are resolved relative to the config file. */
    testData?: {
        /** Module called once before all journeys start. */
        globalSetup?: string;
        /** Module called before each individual journey. */
        beforeEach?: string;
        /** Module called after each individual journey. */
        afterEach?: string;
        /** Module called once after all journeys complete. */
        globalTeardown?: string;
    };
    /** Browser launch configuration. */
    browser?: BrowserConfig;
    /** Ordered list of browser engines to use. Filtered against installed engines. */
    adapters?: ('puppeteer' | 'playwright')[];
    /** DevTools extension configuration. */
    devtools?: {
        redux?: boolean;
        reduxPath?: string;
    };
    /** Dashboard server configuration. */
    server?: {
        port?: number;
    };
}
/**
 * Resolved config returned by `loadConfig()` — `journeys` is always a string.
 * All optional fields from `StepwiseConfig` have been merged with defaults.
 */
export interface ResolvedConfig extends StepwiseConfig {
    /** Absolute path to the resolved journeys glob pattern. */
    journeys: string;
}
/**
 * Identity function for type-safe config authoring.
 * Returns the config object unchanged.
 *
 * @param config - The stepwise config object
 * @returns The same config object (enables IDE autocompletion in config files)
 */
export declare function defineConfig(config: StepwiseConfig): StepwiseConfig;
/**
 * Detects which browser engines are installed by attempting `require.resolve`.
 * Resolves from the consuming project's CWD so that npm-linked usage works.
 * Returns engines in deterministic order: `['puppeteer', 'playwright']`.
 * Never throws — catches resolution errors silently.
 *
 * @returns Array of installed engine names
 */
export declare function detectEngines(): ('puppeteer' | 'playwright')[];
/**
 * Loads, validates, and resolves the consuming project's config file.
 *
 * - Config file is optional — if not found, all defaults are used
 * - journeys is optional — defaults to './journeys/**\/*.journey.ts'
 * - If journeys is provided as explicit empty string, throws
 * - Merges defaults for optional fields
 * - Filters configured adapters against installed engines
 * - Resolves relative paths relative to config file directory (or CWD if no config file)
 * - Validates testData hook files exist if specified
 *
 * @param configPath - Optional explicit path to config file
 * @returns Fully resolved StepwiseConfig with defaults merged
 */
export declare function loadConfig(configPath?: string, _detectEngines?: () => ('puppeteer' | 'playwright')[]): Promise<ResolvedConfig>;
//# sourceMappingURL=config.d.ts.map