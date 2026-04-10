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
exports.BaseAdapter = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ipc_1 = require("../utils/ipc");
/**
 * Base adapter class providing shared functionality for browser automation.
 *
 * Features:
 * - Action tracking and logging via JSON messages on stderr
 * - Breakpoint support (pauses at specified action indices)
 * - Pause/Resume control via signals, stdin, and file-based IPC
 * - Step mode execution (execute N actions then re-pause)
 * - Slow mode delays with IPC polling
 *
 * Both PuppeteerAdapter and PlaywrightAdapter extend this class.
 *
 * IPC layering:
 * - Puppeteer: SIGUSR1/SIGUSR2 signals (instant pause/resume) + stdin JSON (step/config)
 * - Playwright: file-based IPC only (signals/stdin unavailable in worker processes)
 * - File-based IPC: universal fallback polled in checkPauseState and addSlowModeDelay
 */
class BaseAdapter {
    // ── Static shared state across all adapter instances ──────────────────
    static downloadDir = path.join(os.tmpdir(), 'stepwise-downloads');
    static isPaused = false;
    static stepMode = false;
    static stepsRemaining = 0;
    static actionIndex = 0;
    static breakpoints = new Set();
    static signalsInitialized = false;
    static actionDelay = 0;
    static baseUrl = '';
    constructor() {
        // Read action delay from env var (standalone package — no settings import)
        const envDelay = parseInt(process.env.ACTION_DELAY || '0', 10);
        if (!isNaN(envDelay) && envDelay > 0) {
            BaseAdapter.actionDelay = envDelay;
            console.log(`🐌 Slow mode enabled: ${envDelay}ms delay between steps`);
        }
        // Read base URL from env var (set by TestExecutor from settings.targetUrl)
        if (process.env.TEST_DOMAIN) {
            BaseAdapter.baseUrl = process.env.TEST_DOMAIN.replace(/\/+$/, '');
        }
        // Set up signal handlers and stdin listener only once
        this.initializeSignalHandlers();
        // Initialize breakpoints from env var for each test run
        this.initializeBreakpoints();
    }
    /**
     * Initialize breakpoints from TEST_BREAKPOINTS environment variable.
     * Called in constructor for each test run.
     */
    initializeBreakpoints() {
        const breakpointsEnv = process.env.TEST_BREAKPOINTS;
        if (breakpointsEnv) {
            try {
                const breakpoints = JSON.parse(breakpointsEnv);
                if (Array.isArray(breakpoints) && breakpoints.length > 0) {
                    BaseAdapter.setBreakpoints(breakpoints);
                }
            }
            catch (error) {
                console.error('Failed to parse TEST_BREAKPOINTS:', error);
            }
        }
    }
    /**
     * Initialize IPC and signal handlers for pause/resume and step control.
     * Only sets up handlers once to avoid duplicate listeners.
     *
     * - stdin listener: Puppeteer uses this for step commands and config updates.
     *   Guarded — Playwright workers don't have a real stdin, so skip if unavailable.
     * - SIGUSR1/SIGUSR2: Puppeteer only. Wrapped in try/catch because Playwright
     *   worker processes don't support signals.
     * - File-based IPC: polled in checkPauseState (universal fallback).
     */
    initializeSignalHandlers() {
        if (BaseAdapter.signalsInitialized) {
            return;
        }
        BaseAdapter.signalsInitialized = true;
        // Clear any stale commands from a previous run
        (0, ipc_1.clearCommands)();
        // stdin listener — Puppeteer uses this for step commands and config updates.
        // Guard: Playwright workers don't have a real stdin, so skip if unavailable.
        if (process.stdin && typeof process.stdin.unref === 'function') {
            process.stdin.setEncoding('utf-8');
            process.stdin.on('data', (data) => {
                for (const line of data.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const msg = JSON.parse(trimmed);
                        switch (msg.type) {
                            case 'step':
                                BaseAdapter.stepMode = true;
                                BaseAdapter.stepsRemaining = msg.stepsRemaining || 1;
                                BaseAdapter.isPaused = false;
                                process.stderr.write('\n⏭️  Step mode enabled.\n\n');
                                break;
                            case 'resume':
                                BaseAdapter.isPaused = false;
                                BaseAdapter.stepMode = false;
                                process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'resume' }) + '\n');
                                process.stderr.write('\n▶️  Test execution resumed.\n\n');
                                break;
                            case 'config':
                                if (msg.actionDelay !== undefined) {
                                    BaseAdapter.actionDelay = msg.actionDelay;
                                }
                                if (msg.breakpoints !== undefined) {
                                    BaseAdapter.setBreakpoints(msg.breakpoints);
                                }
                                break;
                        }
                    }
                    catch {
                        // Not JSON, ignore
                    }
                }
            });
            process.stdin.resume();
            process.stdin.unref();
        }
        // Signal handlers — Puppeteer only. Idempotent, no toggling.
        // SIGUSR1 = pause (no-op if already paused)
        // SIGUSR2 = resume (no-op if not paused)
        // Wrapped in try/catch: Playwright workers don't support signals.
        try {
            process.on('SIGUSR1', () => {
                if (!BaseAdapter.isPaused) {
                    BaseAdapter.isPaused = true;
                    process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'pause' }) + '\n');
                    process.stderr.write('\n⏸️  Test execution paused. Click Resume to continue.\n\n');
                }
            });
            process.on('SIGUSR2', () => {
                if (BaseAdapter.isPaused) {
                    BaseAdapter.isPaused = false;
                    BaseAdapter.stepMode = false;
                    process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'resume' }) + '\n');
                    process.stderr.write('\n▶️  Test execution resumed.\n\n');
                }
            });
        }
        catch {
            // Signals not available in this environment (e.g. Playwright worker)
        }
    }
    /**
     * Checks pause state and waits if paused.
     * Polls file-based IPC for commands (works in both Puppeteer and Playwright).
     * Also responds to signal-based commands (Puppeteer only — handled by signal handlers above).
     */
    async checkPauseState() {
        // Poll for IPC commands — check once even if not paused
        const pollIpc = () => {
            const cmd = (0, ipc_1.readCommand)();
            if (!cmd)
                return;
            switch (cmd.type) {
                case 'pause':
                    BaseAdapter.isPaused = true;
                    process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'pause' }) + '\n');
                    process.stderr.write('\n⏸️  Test execution paused. Click Resume to continue.\n\n');
                    break;
                case 'resume':
                    BaseAdapter.isPaused = false;
                    BaseAdapter.stepMode = false;
                    process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'resume' }) + '\n');
                    process.stderr.write('\n▶️  Test execution resumed.\n\n');
                    break;
                case 'step':
                    BaseAdapter.stepMode = true;
                    BaseAdapter.stepsRemaining = cmd.stepsRemaining || 1;
                    BaseAdapter.isPaused = false;
                    process.stderr.write('\n⏭️  Step mode enabled.\n\n');
                    break;
                case 'config':
                    if (cmd.actionDelay !== undefined) {
                        BaseAdapter.actionDelay = cmd.actionDelay;
                    }
                    if (cmd.breakpoints !== undefined) {
                        BaseAdapter.setBreakpoints(cmd.breakpoints);
                    }
                    break;
            }
        };
        // Check for commands before waiting
        pollIpc();
        // Wait while paused, polling for resume/step commands every 100ms
        while (BaseAdapter.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100));
            pollIpc();
        }
    }
    /**
     * Adds slow mode delay if configured.
     * Polls for IPC commands during the delay in 50ms intervals
     * so pause takes effect promptly even during a long delay.
     */
    async addSlowModeDelay() {
        if (BaseAdapter.actionDelay > 0) {
            const interval = Math.min(BaseAdapter.actionDelay, 50);
            let remaining = BaseAdapter.actionDelay;
            while (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(interval, remaining)));
                remaining -= interval;
                await this.checkPauseState();
            }
        }
    }
    /**
     * Logs an action start and checks for breakpoints and step mode.
     *
     * - Increments actionIndex by exactly 1
     * - Writes JSON action start message to stderr with `[JSON]` prefix
     * - If actionIndex matches a breakpoint, writes breakpoint JSON and pauses
     * - Calls `checkPauseState` to block while paused
     * - Decrements step counter once per action; re-pauses when counter hits zero
     *
     * @param description - Human-readable description of the action (e.g. `"Click: #submit"`)
     */
    async logAndCheckAction(description) {
        BaseAdapter.actionIndex++;
        const index = BaseAdapter.actionIndex;
        // Send JSON message for action start
        process.stderr.write('[JSON]' + JSON.stringify({
            type: 'action',
            index,
            status: 'start',
            description,
        }) + '\n');
        // Check if this action has a breakpoint
        if (BaseAdapter.breakpoints.has(index)) {
            process.stderr.write('[JSON]' + JSON.stringify({
                type: 'action',
                index,
                status: 'breakpoint',
            }) + '\n');
            process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'pause' }) + '\n');
            process.stderr.write('\n⏸️  Test paused at breakpoint. Click Resume to continue.\n\n');
            BaseAdapter.isPaused = true;
        }
        await this.checkPauseState();
        // Decrement step counter once per action (not per poll cycle).
        // When the counter hits zero, re-pause and notify the UI.
        if (BaseAdapter.stepMode && BaseAdapter.stepsRemaining > 0) {
            BaseAdapter.stepsRemaining--;
        }
        if (BaseAdapter.stepMode && BaseAdapter.stepsRemaining === 0) {
            BaseAdapter.isPaused = true;
            process.stderr.write('[JSON]' + JSON.stringify({ type: 'ui-control', action: 'pause' }) + '\n');
            process.stderr.write('\n⏸️  Paused after step. Click Step to continue.\n\n');
        }
    }
    /**
     * Logs action completion with [JSON] prefix to stderr.
     */
    logActionComplete() {
        process.stderr.write('[JSON]' + JSON.stringify({
            type: 'action',
            index: BaseAdapter.actionIndex,
            status: 'complete',
        }) + '\n');
    }
    /**
     * Sets breakpoints for the test run.
     * Called from test runner before test execution, or from constructor via env var.
     *
     * @param breakpoints - Array of 1-based action indices to pause at
     */
    static setBreakpoints(breakpoints) {
        BaseAdapter.breakpoints = new Set(breakpoints);
        if (breakpoints.length > 0) {
            console.log(`[BREAKPOINTS:set] ${breakpoints.join(', ')}`);
        }
    }
    /**
     * Resets action index for a new test run.
     */
    static resetActionIndex() {
        BaseAdapter.actionIndex = 0;
    }
    /**
     * Resolve a URL against the configured baseUrl.
     * Absolute URLs (`http://`, `https://`) pass through unchanged.
     * Relative paths (starting with `/`) get baseUrl prepended.
     *
     * @param url - The URL or path to resolve
     * @returns Fully qualified URL string
     */
    resolveUrl(url) {
        if (/^https?:\/\//.test(url))
            return url;
        return BaseAdapter.baseUrl + (url.startsWith('/') ? url : '/' + url);
    }
    /**
     * Ensures the shared download directory exists, creating it if necessary.
     * @returns The absolute path to the download directory
     */
    ensureDownloadDir() {
        fs.mkdirSync(BaseAdapter.downloadDir, { recursive: true });
        return BaseAdapter.downloadDir;
    }
    /**
     * Derives the origin from a page URL. Returns null for non-HTTP URLs
     * (e.g. about:blank) so callers can skip origin-specific operations.
     * @param url - The current page URL
     * @returns The origin string (e.g. 'http://localhost:3000') or null
     */
    deriveOrigin(url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.origin;
            }
        }
        catch {
            // Invalid URL — fall through
        }
        return null;
    }
}
exports.BaseAdapter = BaseAdapter;
//# sourceMappingURL=base-adapter.js.map