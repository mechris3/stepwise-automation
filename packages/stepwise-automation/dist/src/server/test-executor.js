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
exports.TestExecutor = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const breakpoint_storage_1 = require("./breakpoint-storage");
const settings_storage_1 = require("./settings-storage");
const journey_discovery_1 = require("./journey-discovery");
const ipc_1 = require("../utils/ipc");
const browser_discovery_1 = require("../utils/browser-discovery");
/**
 * Orchestrates journey execution by spawning child processes, managing
 * pause/resume/step control, and broadcasting progress over WebSocket.
 *
 * Supports both Puppeteer (signals + stdin IPC) and Playwright (file-based IPC).
 */
class TestExecutor {
    config;
    wsManager;
    tool;
    liveConfig;
    currentProcess = null;
    startTime = 0;
    stopped = false;
    /**
     * @param config - Resolved stepwise config from the consuming project
     * @param wsManager - WebSocket manager for broadcasting progress to the dashboard
     * @param tool - Browser engine to use (`'puppeteer'` or `'playwright'`)
     * @param liveConfig - Mutable config overrides from the dashboard UI
     */
    constructor(config, wsManager, tool, liveConfig = {}) {
        this.config = config;
        this.wsManager = wsManager;
        this.tool = tool;
        this.liveConfig = liveConfig;
    }
    /**
     * Run journeys sequentially. Broadcasts `run-start` before the first journey
     * and `run-end` after all complete (or after stop/failure).
     * Kills existing browser instances before the first journey and between
     * consecutive journeys. Runs lifecycle hooks (globalSetup, beforeEach,
     * afterEach, globalTeardown) if configured.
     *
     * @param journeys - Array of journey IDs to execute
     * @param runConfig - Optional live config overrides from the dashboard
     */
    async run(journeys, runConfig) {
        this.stopped = false;
        if (runConfig) {
            this.liveConfig = { ...this.liveConfig, ...runConfig };
        }
        this.wsManager.broadcast({ type: 'run-start', journeys, tool: this.tool });
        // Kill any existing browser instances to avoid userDataDir lock conflicts
        await this.killExistingBrowser();
        // Run globalSetup once before all journeys
        await this.runHook('globalSetup');
        const results = [];
        for (let i = 0; i < journeys.length; i++) {
            if (this.stopped)
                break;
            const journey = journeys[i];
            // Kill lingering browser between consecutive journeys
            if (i > 0) {
                await this.killExistingBrowser();
            }
            // Run beforeEach before every journey
            await this.runHook('beforeEach');
            console.log(`[TestExecutor] Starting journey ${i + 1}/${journeys.length}: ${journey}`);
            try {
                await this.runSingleJourney(journey, journeys.length);
                console.log(`[TestExecutor] Journey ${journey} passed`);
                results.push({ journey, status: 'passed' });
            }
            catch (error) {
                if (this.stopped)
                    break;
                console.error(`[TestExecutor] Journey ${journey} failed:`, error);
                results.push({ journey, status: 'failed' });
                // Run afterEach even on failure
                await this.runHook('afterEach');
                break;
            }
            // Run afterEach after every journey
            await this.runHook('afterEach');
        }
        // Run globalTeardown once after all journeys
        await this.runHook('globalTeardown');
        console.log(`[TestExecutor] Run complete. ${results.length}/${journeys.length} journeys executed.`);
        this.wsManager.broadcast({ type: 'run-end', results });
    }
    /**
     * Spawn and monitor a single journey child process.
     *
     * @param journey - The journey ID to run
     * @param totalJourneys - Total number of journeys in this batch (used for keep-open logic)
     * @returns Resolves on exit code 0, rejects otherwise
     */
    async runSingleJourney(journey, totalJourneys) {
        // Discover the journey's absolute file path using the already-resolved config
        // before spawning the child process — fail fast if the journey is not found
        const discoveredJourney = await (0, journey_discovery_1.getJourneyById)(journey, this.config);
        if (!discoveredJourney) {
            throw new Error(`Journey not found: "${journey}". The parent process could not discover this journey using the resolved config. ` +
                `Check your journeys glob pattern: ${this.config.journeys}`);
        }
        return new Promise((resolve, reject) => {
            this.startTime = Date.now();
            const isPuppeteer = this.tool === 'puppeteer';
            // Resolve runner path relative to this file's compiled location (dist/src/server/)
            // The TS source files are at src/runners/puppeteer/ and src/runners/playwright/
            // We go up from dist/src/server/ to package root, then into src/
            const packageRoot = path.resolve(__dirname, '../../..');
            const runnerScript = isPuppeteer
                ? path.join(packageRoot, 'src/runners/puppeteer/run-journey.ts')
                : path.join(packageRoot, 'src/runners/playwright/all-journeys.spec.ts');
            // Build command and args per engine
            // Puppeteer: use node with tsx loaders for both CJS and ESM
            //   --require tsx/cjs  → hooks require() calls (CJS)
            //   --import tsx/esm   → hooks import() calls (ESM) — needed for config & journey loading
            //   Both use fully resolved paths so they work regardless of cwd
            // Playwright: use npx to invoke the consuming project's playwright
            const tsxEsmPath = 'file://' + require.resolve('tsx/esm');
            const command = isPuppeteer ? process.execPath : 'npx';
            const playwrightConfigPath = path.join(packageRoot, 'src/runners/playwright/playwright.config.ts');
            const args = isPuppeteer
                ? ['--require', require.resolve('tsx/cjs'), '--import', tsxEsmPath, runnerScript, journey]
                : ['playwright', 'test', '--config', playwrightConfigPath, '--grep', journey];
            // Gather breakpoints for this journey — prefer in-memory, fall back to file
            let breakpoints = (0, breakpoint_storage_1.getBreakpoints)(journey);
            if (breakpoints.length === 0) {
                breakpoints = (0, settings_storage_1.getFileBreakpoints)(journey);
                if (breakpoints.length > 0)
                    (0, breakpoint_storage_1.setBreakpoints)(journey, breakpoints);
            }
            // Merge static config with live config overrides
            const currentConfig = { ...this.liveConfig };
            const keepOpen = currentConfig.keepBrowserOpen && totalJourneys === 1;
            const env = {
                ...process.env,
                // Ensure peer dependencies (puppeteer, playwright) resolve from the consuming project
                NODE_PATH: path.join(process.cwd(), 'node_modules'),
                TEST_BREAKPOINTS: JSON.stringify(breakpoints),
                TEST_DOMAIN: currentConfig.testDomain || '',
                VIEWPORT_WIDTH: (currentConfig.viewportWidth || this.config.browser?.defaultViewport?.width || 1280).toString(),
                VIEWPORT_HEIGHT: (currentConfig.viewportHeight || this.config.browser?.defaultViewport?.height || 720).toString(),
                ACTION_DELAY: (currentConfig.actionDelay || 0).toString(),
                DEVTOOLS: currentConfig.devtools ? 'true' : 'false',
                KEEP_BROWSER_OPEN: keepOpen ? 'true' : 'false',
                // Pass pre-resolved journey path so the child process doesn't need to re-discover
                STEPWISE_JOURNEY_PATH: discoveredJourney.path,
                STEPWISE_JOURNEYS_GLOB: this.config.journeys,
                ...(currentConfig.browserPath ? { BROWSER_PATH: currentConfig.browserPath } : {}),
                ...(currentConfig.userDataDir ? { USER_DATA_DIR: currentConfig.userDataDir } : {}),
                ...(currentConfig.reduxDevToolsPath ? { REDUX_DEVTOOLS_PATH: currentConfig.reduxDevToolsPath } : {}),
            };
            this.wsManager.broadcast({ type: 'test-start', journey, tool: this.tool });
            // Spawn with stdio ['pipe','pipe','pipe'] so stdin is available for Puppeteer commands
            this.currentProcess = (0, child_process_1.spawn)(command, args, {
                env,
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: !isPuppeteer, // shell needed for npx (Playwright) on macOS
            });
            // stdout → broadcast as log messages
            this.currentProcess.stdout?.on('data', (data) => {
                const message = data.toString();
                this.wsManager.broadcast({ type: 'log', message, journey, tool: this.tool });
            });
            // stderr → parse [JSON] prefixed lines as structured messages, rest as errors
            this.currentProcess.stderr?.on('data', (data) => {
                const raw = data.toString();
                const lines = raw.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    if (trimmed.startsWith('[JSON]')) {
                        // Validate JSON is parseable, then broadcast the raw line
                        // so the frontend can extract it via [JSON] prefix regex
                        try {
                            JSON.parse(trimmed.slice('[JSON]'.length));
                        }
                        catch {
                            // Malformed JSON — still broadcast as-is
                        }
                        this.wsManager.broadcast({ type: 'error', message: trimmed, journey, tool: this.tool });
                    }
                    else {
                        this.wsManager.broadcast({ type: 'error', message: trimmed, journey, tool: this.tool });
                    }
                }
            });
            this.currentProcess.on('close', (code) => {
                const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
                console.log(`[TestExecutor] Journey ${journey} process exited with code ${code} (${duration}s)`);
                this.wsManager.broadcast({
                    type: 'test-end',
                    journey,
                    tool: this.tool,
                    status: code === 0 ? 'passed' : 'failed',
                    duration,
                });
                this.currentProcess = null;
                code === 0 ? resolve() : reject(new Error(`Exit code ${code}`));
            });
            this.currentProcess.on('error', (err) => {
                console.error(`[TestExecutor] Failed to spawn process for ${journey}:`, err);
                this.currentProcess = null;
                reject(err);
            });
        });
    }
    /**
     * Run a configured test data lifecycle hook by name.
     * Logs errors but does not stop the run.
     *
     * @param hookName - One of 'globalSetup', 'beforeEach', 'afterEach', 'globalTeardown'
     */
    async runHook(hookName) {
        const hookPath = this.config.testData?.[hookName];
        if (!hookPath)
            return;
        try {
            console.log(`[TestExecutor] Running ${hookName}...`);
            // Use jiti to transparently handle both .ts and .js hook files
            const { createJiti } = require('jiti');
            const jiti = createJiti(__filename);
            const hookModule = jiti(hookPath);
            const hookFn = hookModule.default || hookModule[hookName] || hookModule;
            if (typeof hookFn === 'function') {
                await hookFn();
            }
            console.log(`[TestExecutor] ${hookName} complete`);
        }
        catch (error) {
            console.error(`[TestExecutor] ${hookName} failed:`, error);
            // Continue — hooks never stop the run
        }
    }
    /**
     * Kill any existing browser instances that match the configured browser.
     * Derives the process name from the configured/discovered browser path —
     * never hardcodes a browser name.
     */
    async killExistingBrowser() {
        // Resolve the browser executable path from live config, static config, or auto-discovery
        const browserPath = this.liveConfig.browserPath ||
            this.config.browser?.executablePath ||
            (0, browser_discovery_1.discoverBrowsers)()[0]?.executablePath;
        if (!browserPath) {
            console.log('[TestExecutor] No browser path found — skipping kill');
            return;
        }
        // Extract the process name from the full executable path
        // macOS app bundles: /Applications/Brave Browser.app/Contents/MacOS/Brave Browser → "Brave Browser"
        // Linux/Windows: /usr/bin/google-chrome → "google-chrome"  or  chrome.exe → "chrome.exe"
        const processName = path.basename(browserPath);
        const platform = process.platform;
        try {
            if (platform === 'win32') {
                (0, child_process_1.execSync)(`taskkill /F /IM "${processName}"`, { stdio: 'ignore' });
            }
            else if (platform === 'darwin') {
                // macOS: killall handles names with spaces better than pkill
                (0, child_process_1.execSync)(`killall "${processName}"`, { stdio: 'ignore' });
            }
            else {
                // Linux: pkill with exact match
                (0, child_process_1.execSync)(`pkill -x "${processName}"`, { stdio: 'ignore' });
            }
            console.log(`[TestExecutor] Killed existing "${processName}" processes`);
        }
        catch {
            // Exit code 1 means no matching processes — that's fine
        }
        // Remove stale SingletonLock if a userDataDir is configured
        const userDataDir = this.liveConfig.userDataDir ||
            this.config.browser?.userDataDir ||
            (0, browser_discovery_1.discoverBrowsers)()[0]?.userDataDir;
        if (userDataDir) {
            const lockFile = path.join(userDataDir, 'SingletonLock');
            try {
                if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                    console.log(`[TestExecutor] Removed stale ${lockFile}`);
                }
            }
            catch {
                // May not have permission — that's okay
            }
        }
        // Give the OS time to release resources
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    /**
     * Stop test execution — kills the current process and prevents further journeys.
     */
    stop() {
        this.stopped = true;
        (0, ipc_1.clearCommands)();
        if (this.currentProcess) {
            this.currentProcess.kill('SIGKILL');
            this.currentProcess = null;
        }
    }
    /**
     * Pause test execution.
     * Puppeteer: SIGUSR1 signal for instant response.
     * Playwright: file-based IPC (signals don't reach worker processes).
     */
    pause() {
        console.log('[TestExecutor] Sending pause command');
        if (this.tool === 'puppeteer' && this.currentProcess?.pid) {
            try {
                process.kill(this.currentProcess.pid, 'SIGUSR1');
            }
            catch {
                // Process may have already exited
            }
        }
        else {
            (0, ipc_1.writeCommand)({ type: 'pause' });
        }
    }
    /**
     * Resume test execution.
     * Puppeteer: SIGUSR2 signal (dedicated resume, idempotent).
     * Playwright: file-based IPC (signals don't reach worker processes).
     */
    resume() {
        console.log('[TestExecutor] Sending resume command');
        if (this.tool === 'puppeteer' && this.currentProcess?.pid) {
            try {
                process.kill(this.currentProcess.pid, 'SIGUSR2');
            }
            catch {
                // Process may have already exited
            }
        }
        else {
            (0, ipc_1.writeCommand)({ type: 'resume' });
        }
    }
    /**
     * Step forward N actions.
     * Puppeteer: stdin JSON (instant delivery, supports count).
     * Playwright: file-based IPC.
     *
     * @param count - Number of actions to execute before re-pausing (default 1)
     */
    step(count = 1) {
        console.log(`[TestExecutor] Sending step command (${count} steps)`);
        if (this.tool === 'puppeteer' && this.currentProcess?.stdin?.writable) {
            this.currentProcess.stdin.write(JSON.stringify({ type: 'step', stepsRemaining: count }) + '\n');
        }
        else {
            (0, ipc_1.writeCommand)({ type: 'step', stepsRemaining: count });
        }
    }
    /**
     * Send a live config update to the running child process via IPC.
     * Uses file-based IPC as primary channel, stdin as fallback for Puppeteer.
     *
     * @param config - Partial RunConfig with the fields to update
     */
    sendConfig(config) {
        (0, ipc_1.writeCommand)({ type: 'config', ...config });
        // Also try stdin for backward compatibility with Puppeteer
        if (this.currentProcess?.stdin?.writable) {
            this.currentProcess.stdin.write(JSON.stringify({ type: 'config', ...config }) + '\n');
        }
    }
    /**
     * Check if tests are currently running.
     *
     * @returns `true` if a child process is active
     */
    isRunning() {
        return this.currentProcess !== null;
    }
}
exports.TestExecutor = TestExecutor;
//# sourceMappingURL=test-executor.js.map