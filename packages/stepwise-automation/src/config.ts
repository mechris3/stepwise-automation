import * as path from 'path';
import * as fs from 'fs';

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
  defaultViewport?: { width: number; height: number };
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
  devtools?: { redux?: boolean; reduxPath?: string };
  /** Dashboard server configuration. */
  server?: { port?: number };
}

/**
 * Resolved config returned by `loadConfig()` — `journeys` is always a string.
 * All optional fields from `StepwiseConfig` have been merged with defaults.
 */
export interface ResolvedConfig extends StepwiseConfig {
  /** Absolute path to the resolved journeys glob pattern. */
  journeys: string;
}

/** Default journeys glob pattern (convention over configuration). */
const DEFAULT_JOURNEYS = './journeys/**/*.journey.ts';

/**
 * Identity function for type-safe config authoring.
 * Returns the config object unchanged.
 *
 * @param config - The stepwise config object
 * @returns The same config object (enables IDE autocompletion in config files)
 */
export function defineConfig(config: StepwiseConfig): StepwiseConfig {
  return config;
}

/**
 * Detects which browser engines are installed by attempting `require.resolve`.
 * Resolves from the consuming project's CWD so that npm-linked usage works.
 * Returns engines in deterministic order: `['puppeteer', 'playwright']`.
 * Never throws — catches resolution errors silently.
 *
 * @returns Array of installed engine names
 */
export function detectEngines(): ('puppeteer' | 'playwright')[] {
  const engines: ('puppeteer' | 'playwright')[] = [];
  const resolveOpts = { paths: [process.cwd()] };

  try {
    require.resolve('puppeteer', resolveOpts);
    engines.push('puppeteer');
  } catch {
    // Not installed
  }

  try {
    require.resolve('playwright', resolveOpts);
    engines.push('playwright');
  } catch {
    // Not installed
  }

  return engines;
}

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
export async function loadConfig(
  configPath?: string,
  _detectEngines: () => ('puppeteer' | 'playwright')[] = detectEngines,
): Promise<ResolvedConfig> {
  let rawConfig: StepwiseConfig = {};
  let configDir = process.cwd();

  if (configPath) {
    // Explicit path — must exist
    const resolvedPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }
    const configModule = await import(resolvedPath);
    rawConfig = configModule.default || configModule;
    configDir = path.dirname(resolvedPath);
  } else {
    // Auto-discover config file — optional
    const candidates = [
      'stepwise.config.ts',
      'test-runner.config.ts',
    ];
    const found = candidates.find(c => fs.existsSync(path.resolve(process.cwd(), c)));
    if (found) {
      const resolvedPath = path.resolve(process.cwd(), found);
      const configModule = await import(resolvedPath);
      rawConfig = configModule.default || configModule;
      configDir = path.dirname(resolvedPath);
    }
    // No config file found — use all defaults (no error)
  }

  // Validate journeys if explicitly provided as empty/whitespace
  if (rawConfig.journeys !== undefined) {
    if (typeof rawConfig.journeys !== 'string' || rawConfig.journeys.trim() === '') {
      throw new Error('journeys must be a non-empty string');
    }
  }

  // Detect installed engines
  const installedEngines = _detectEngines();
  if (installedEngines.length === 0) {
    throw new Error('No browser engine found. Install puppeteer or playwright.');
  }

  // Validate configured adapters against installed engines
  const configuredAdapters = rawConfig.adapters || installedEngines;
  const validAdapters = configuredAdapters.filter(a => installedEngines.includes(a));
  if (validAdapters.length === 0) {
    throw new Error(
      `Configured adapters [${configuredAdapters.join(', ')}] not installed. Available: [${installedEngines.join(', ')}]`
    );
  }

  // Resolve journeys path (default or explicit) relative to config dir
  const journeysRaw = rawConfig.journeys || DEFAULT_JOURNEYS;
  const resolvedJourneys = path.isAbsolute(journeysRaw)
    ? journeysRaw
    : path.resolve(configDir, journeysRaw);

  // Resolve testData hook paths
  let resolvedTestData: StepwiseConfig['testData'] = undefined;
  if (rawConfig.testData) {
    const hookNames = ['globalSetup', 'beforeEach', 'afterEach', 'globalTeardown'] as const;
    const resolved: Record<string, string | undefined> = {};

    for (const hook of hookNames) {
      const raw = rawConfig.testData[hook];
      if (!raw) continue;

      const resolvedPath = path.isAbsolute(raw)
        ? raw
        : path.resolve(configDir, raw);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`testData.${hook} file not found: ${resolvedPath}`);
      }
      resolved[hook] = resolvedPath;
    }

    resolvedTestData = {
      globalSetup: resolved.globalSetup,
      beforeEach: resolved.beforeEach,
      afterEach: resolved.afterEach,
      globalTeardown: resolved.globalTeardown,
    };
  }

  // Merge defaults
  const resolved: ResolvedConfig = {
    ...rawConfig,
    journeys: resolvedJourneys,
    adapters: validAdapters,
    testData: resolvedTestData,
    browser: {
      defaultViewport: { width: 1280, height: 720 },
      headless: false,
      profileDir: 'Default',
      ...rawConfig.browser,
    },
    server: { port: 3001, ...rawConfig.server },
  };

  return resolved;
}
