"use strict";
/**
 * Single Puppeteer journey runner.
 *
 * This is the script spawned by TestExecutor for each Puppeteer journey.
 * It reads configuration from the consuming project's config file,
 * launches a Puppeteer browser, instantiates PuppeteerAdapter, dynamically
 * imports the journey module, and calls its default export.
 *
 * Environment variables (set by TestExecutor):
 *   TEST_DOMAIN, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, ACTION_DELAY,
 *   BROWSER_PATH, KEEP_BROWSER_OPEN, DEVTOOLS, REDUX_DEVTOOLS_PATH,
 *   TEST_BREAKPOINTS
 */
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
const path = __importStar(require("path"));
const config_1 = require("../../config");
const puppeteer_adapter_1 = require("../../adapters/puppeteer-adapter");
const base_adapter_1 = require("../../adapters/base-adapter");
const browser_discovery_1 = require("../../utils/browser-discovery");
const journey_discovery_1 = require("../../server/journey-discovery");
const redux_devtools_1 = require("../../utils/redux-devtools");
// ── Parse args ──────────────────────────────────────────────────────────
const journeyName = process.argv[2];
if (!journeyName) {
    console.error('❌ Error: Journey name is required');
    console.error('Usage: run-journey.ts <journey-name>');
    process.exit(1);
}
// ── Read env vars ───────────────────────────────────────────────────────
const envViewportWidth = parseInt(process.env.VIEWPORT_WIDTH || '1280', 10);
const envViewportHeight = parseInt(process.env.VIEWPORT_HEIGHT || '720', 10);
const envDevtools = process.env.DEVTOOLS === 'true';
const envKeepOpen = process.env.KEEP_BROWSER_OPEN === 'true';
const envBrowserPath = process.env.BROWSER_PATH || '';
const envUserDataDir = process.env.USER_DATA_DIR || '';
const envReduxDevToolsPath = process.env.REDUX_DEVTOOLS_PATH || '';
const envTestDomain = process.env.TEST_DOMAIN || '';
// ── Main ────────────────────────────────────────────────────────────────
async function main() {
    // Dynamically require puppeteer (optional peer dependency).
    // We use require() + createRequire() to resolve from the consuming project's
    // node_modules (via NODE_PATH), since dynamic import() uses ESM resolution
    // which doesn't respect NODE_PATH.
    const { createRequire } = await Promise.resolve().then(() => __importStar(require('module')));
    const consumerRequire = createRequire(path.join(process.cwd(), 'package.json'));
    const puppeteer = consumerRequire('puppeteer');
    // Load consuming project config
    const config = await (0, config_1.loadConfig)();
    // Resolve browser executable path:
    // 1. BROWSER_PATH env var (from UI live config)
    // 2. config.browser.executablePath (from config file)
    // 3. discoverBrowsers() fallback (auto-detect installed browsers)
    let executablePath = envBrowserPath || config.browser?.executablePath || undefined;
    // Resolve browser executable path and user data dir:
    // 1. BROWSER_PATH env var (from UI live config)
    // 2. config.browser.executablePath (from config file)
    // 3. discoverBrowsers() fallback (auto-detect installed browsers)
    let userDataDir = envUserDataDir || config.browser?.userDataDir;
    if (!executablePath) {
        const browsers = (0, browser_discovery_1.discoverBrowsers)();
        if (browsers.length > 0) {
            executablePath = browsers[0].executablePath;
            if (!userDataDir && browsers[0].userDataDir) {
                userDataDir = browsers[0].userDataDir;
            }
            console.log(`[Browser] Auto-detected: ${browsers[0].name} at ${executablePath}`);
        }
    }
    // Resolve Redux DevTools extension path
    const extensionPath = envReduxDevToolsPath || config.devtools?.reduxPath || (0, redux_devtools_1.findReduxDevToolsExtension)();
    const extensionArgs = extensionPath
        ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
        : [];
    // DevTools args
    const devtoolsArgs = envDevtools ? ['--auto-open-devtools-for-tabs'] : [];
    // Read cached chrome offset from previous runs (avoids visible resize flash).
    // Falls back to a reasonable default (0x150) on first run.
    const cacheFile = path.join(require('os').tmpdir(), 'stepwise-chrome-offset.json');
    let cachedChromeW = 0;
    let cachedChromeH = 150;
    try {
        const cached = JSON.parse(require('fs').readFileSync(cacheFile, 'utf-8'));
        if (cached.w > 0 && cached.h > 0) {
            cachedChromeW = cached.w;
            cachedChromeH = cached.h;
        }
    }
    catch {
        // No cache yet — use defaults
    }
    // Launch browser
    // Use defaultViewport: null so the page fills the window naturally (no CSS emulation).
    // --window-size uses the cached chrome offset so the window opens at the right size.
    const browser = await puppeteer.launch({
        headless: config.browser?.headless ?? false,
        executablePath,
        userDataDir,
        defaultViewport: null,
        timeout: 30000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-session-crashed-bubble',
            '--disable-infobars',
            '--no-first-run',
            '--no-default-browser-check',
            '--hide-crash-restore-bubble',
            '--no-restore-state',
            ...extensionArgs,
            ...devtoolsArgs,
            `--window-size=${envViewportWidth + cachedChromeW},${envViewportHeight + cachedChromeH}`,
        ],
    });
    // Close any restored tabs from the previous session (userDataDir loads the full profile)
    const existingPages = await browser.pages();
    const page = await browser.newPage();
    for (const p of existingPages) {
        if (p !== page) {
            await p.close().catch(() => { });
        }
    }
    // Measure the actual chrome offset via CDP and correct the window size if needed.
    // Also cache the offset for future launches so the next run opens at the right size.
    try {
        const cdpSession = await page.createCDPSession();
        await cdpSession.send('Emulation.clearDeviceMetricsOverride');
        const { windowId } = await cdpSession.send('Browser.getWindowForTarget');
        // Brief pause to let the window settle at its initial size
        await new Promise(r => setTimeout(r, 100));
        // Measure actual inner dimensions
        const metrics = await page.evaluate(() => ({
            innerWidth: globalThis.innerWidth,
            innerHeight: globalThis.innerHeight,
        }));
        // If the viewport doesn't match, measure chrome offset and resize
        if (metrics.innerWidth !== envViewportWidth || metrics.innerHeight !== envViewportHeight) {
            const { bounds } = await cdpSession.send('Browser.getWindowBounds', { windowId });
            const chromeW = (bounds.width ?? 0) - metrics.innerWidth;
            const chromeH = (bounds.height ?? 0) - metrics.innerHeight;
            await cdpSession.send('Browser.setWindowBounds', {
                windowId,
                bounds: {
                    width: envViewportWidth + chromeW,
                    height: envViewportHeight + chromeH,
                    windowState: 'normal',
                },
            });
            // Cache the measured offset for next launch
            try {
                require('fs').writeFileSync(cacheFile, JSON.stringify({ w: chromeW, h: chromeH }));
            }
            catch {
                // Non-critical — cache write failure is fine
            }
        }
        await cdpSession.detach();
    }
    catch (err) {
        console.warn('[Viewport] CDP resize failed, falling back to --window-size:', err);
    }
    // Reset adapter state and create adapter
    base_adapter_1.BaseAdapter.resetActionIndex();
    const adapter = new puppeteer_adapter_1.PuppeteerAdapter(page);
    // Resolve journey file path:
    // 1. Use STEPWISE_JOURNEY_PATH env var if set (pre-resolved by TestExecutor)
    // 2. Fall back to loadConfig() + getJourneyById() discovery (CLI run command)
    const envJourneyPath = process.env.STEPWISE_JOURNEY_PATH;
    let journey;
    if (envJourneyPath) {
        // Use pre-resolved path from parent process — skip journey re-discovery
        journey = { id: journeyName, name: journeyName, path: envJourneyPath };
    }
    else {
        // Fallback: discover journey via config glob (backward compatibility)
        const discovered = await (0, journey_discovery_1.getJourneyById)(journeyName, config);
        if (!discovered) {
            throw new Error(`Journey not found: "${journeyName}". Check your journeys glob pattern in config.`);
        }
        journey = discovered;
    }
    console.log(`🚀 Running journey: ${journey.name} (${journey.path})`);
    // Dynamically import and execute the journey module
    const journeyModule = await Promise.resolve(`${journey.path}`).then(s => __importStar(require(s)));
    // Support both class-based journeys (with execute()) and function-based journeys.
    // Class-based: export class MyJourney { constructor(adapter) {} async execute() {} }
    // Function-based: export default async function(adapter) {}
    const defaultExport = journeyModule.default;
    if (defaultExport && typeof defaultExport === 'function') {
        // Check if it's a class constructor (has prototype.execute)
        if (defaultExport.prototype && typeof defaultExport.prototype.execute === 'function') {
            const instance = new defaultExport(adapter);
            await instance.execute();
        }
        else {
            // Plain function
            await defaultExport(adapter);
        }
    }
    else {
        // No default export — look for any exported class with execute()
        const exportedClasses = Object.values(journeyModule).filter((exp) => typeof exp === 'function' && exp.prototype && typeof exp.prototype.execute === 'function');
        if (exportedClasses.length > 0) {
            const JourneyClass = exportedClasses[0];
            const instance = new JourneyClass(adapter);
            await instance.execute();
        }
        else {
            // Fallback: try any exported function
            const exportedFns = Object.values(journeyModule).filter((exp) => typeof exp === 'function');
            if (exportedFns.length > 0) {
                await exportedFns[0](adapter);
            }
            else {
                throw new Error(`Journey "${journeyName}" does not export a class with execute() or a default function. ` +
                    `Available exports: ${Object.keys(journeyModule).join(', ')}`);
            }
        }
    }
    console.log(`✅ Journey "${journey.name}" completed successfully`);
    // Close browser unless keep-open is requested
    if (!envKeepOpen) {
        await browser.close();
    }
    else {
        console.log('\n🔍 Browser kept open (KEEP_BROWSER_OPEN=true). Close manually or press Ctrl+C.\n');
        await new Promise(() => { });
    }
}
main()
    .then(() => process.exit(0))
    .catch(async (error) => {
    console.error('\n❌ Journey failed:\n');
    console.error(error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
        console.error(error.stack);
    }
    // If keep-open is set, don't exit — let the user inspect the browser state
    if (envKeepOpen) {
        console.log('\n🔍 Browser kept open after failure (KEEP_BROWSER_OPEN=true). Close manually or press Ctrl+C.\n');
        await new Promise(() => { });
    }
    process.exit(1);
});
//# sourceMappingURL=run-journey.js.map