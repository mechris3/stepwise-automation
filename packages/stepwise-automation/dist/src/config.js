"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineConfig = defineConfig;
exports.detectEngines = detectEngines;
exports.loadConfig = loadConfig;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/** Default journeys glob pattern (convention over configuration). */
const DEFAULT_JOURNEYS = './journeys/**/*.journey.ts';
/**
 * Identity function for type-safe config authoring.
 * Returns the config object unchanged.
 *
 * @param config - The stepwise config object
 * @returns The same config object (enables IDE autocompletion in config files)
 */
function defineConfig(config) {
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
function detectEngines() {
    const engines = [];
    const resolveOpts = { paths: [process.cwd()] };
    try {
        require.resolve('puppeteer', resolveOpts);
        engines.push('puppeteer');
    }
    catch {
        // Not installed
    }
    try {
        require.resolve('playwright', resolveOpts);
        engines.push('playwright');
    }
    catch {
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
async function loadConfig(configPath, _detectEngines = detectEngines) {
    let rawConfig = {};
    let configDir = process.cwd();
    if (configPath) {
        // Explicit path — must exist
        const resolvedPath = path.resolve(configPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Config file not found: ${resolvedPath}`);
        }
        const configModule = await Promise.resolve(`${resolvedPath}`).then(s => __importStar(require(s)));
        rawConfig = configModule.default || configModule;
        configDir = path.dirname(resolvedPath);
    }
    else {
        // Auto-discover config file — optional
        const candidates = [
            'stepwise.config.ts',
            'test-runner.config.ts',
        ];
        const found = candidates.find(c => fs.existsSync(path.resolve(process.cwd(), c)));
        if (found) {
            const resolvedPath = path.resolve(process.cwd(), found);
            const configModule = await Promise.resolve(`${resolvedPath}`).then(s => __importStar(require(s)));
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
        throw new Error(`Configured adapters [${configuredAdapters.join(', ')}] not installed. Available: [${installedEngines.join(', ')}]`);
    }
    // Resolve journeys path (default or explicit) relative to config dir
    const journeysRaw = rawConfig.journeys || DEFAULT_JOURNEYS;
    const resolvedJourneys = path.isAbsolute(journeysRaw)
        ? journeysRaw
        : path.resolve(configDir, journeysRaw);
    // Resolve testData hook paths
    let resolvedTestData = undefined;
    if (rawConfig.testData) {
        const hookNames = ['globalSetup', 'beforeEach', 'afterEach', 'globalTeardown'];
        const resolved = {};
        for (const hook of hookNames) {
            const raw = rawConfig.testData[hook];
            if (!raw)
                continue;
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
    const resolved = {
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
//# sourceMappingURL=config.js.map