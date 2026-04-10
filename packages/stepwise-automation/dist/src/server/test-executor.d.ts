import { WebSocketManager } from './websocket';
import { ResolvedConfig } from '../config';
/** Live configuration passed from the dashboard UI to the test runner. */
export interface RunConfig {
    /** Browser content area width in pixels. */
    viewportWidth?: number;
    /** Browser content area height in pixels. */
    viewportHeight?: number;
    /** Whether to open Chrome DevTools on launch. */
    devtools?: boolean;
    /** Keep the browser open after the journey completes (single-journey runs only). */
    keepBrowserOpen?: boolean;
    /** Delay in milliseconds between each adapter action (slow mode). */
    actionDelay?: number;
    /** Absolute path to the browser executable. */
    browserPath?: string;
    /** Absolute path to the browser user data directory (profile). */
    userDataDir?: string;
    /** Base URL of the application under test (from UI settings). */
    testDomain?: string;
    /** Absolute path to the Redux DevTools extension directory. */
    reduxDevToolsPath?: string;
    /** Additional arbitrary config fields forwarded to the child process. */
    [key: string]: any;
}
/**
 * Orchestrates journey execution by spawning child processes, managing
 * pause/resume/step control, and broadcasting progress over WebSocket.
 *
 * Supports both Puppeteer (signals + stdin IPC) and Playwright (file-based IPC).
 */
export declare class TestExecutor {
    private config;
    private wsManager;
    private tool;
    private liveConfig;
    private currentProcess;
    private startTime;
    private stopped;
    /**
     * @param config - Resolved stepwise config from the consuming project
     * @param wsManager - WebSocket manager for broadcasting progress to the dashboard
     * @param tool - Browser engine to use (`'puppeteer'` or `'playwright'`)
     * @param liveConfig - Mutable config overrides from the dashboard UI
     */
    constructor(config: ResolvedConfig, wsManager: WebSocketManager, tool: 'puppeteer' | 'playwright', liveConfig?: Record<string, any>);
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
    run(journeys: string[], runConfig?: RunConfig): Promise<void>;
    /**
     * Spawn and monitor a single journey child process.
     *
     * @param journey - The journey ID to run
     * @param totalJourneys - Total number of journeys in this batch (used for keep-open logic)
     * @returns Resolves on exit code 0, rejects otherwise
     */
    private runSingleJourney;
    /**
     * Run a configured test data lifecycle hook by name.
     * Logs errors but does not stop the run.
     *
     * @param hookName - One of 'globalSetup', 'beforeEach', 'afterEach', 'globalTeardown'
     */
    private runHook;
    /**
     * Kill any existing browser instances that match the configured browser.
     * Derives the process name from the configured/discovered browser path —
     * never hardcodes a browser name.
     */
    private killExistingBrowser;
    /**
     * Stop test execution — kills the current process and prevents further journeys.
     */
    stop(): void;
    /**
     * Pause test execution.
     * Puppeteer: SIGUSR1 signal for instant response.
     * Playwright: file-based IPC (signals don't reach worker processes).
     */
    pause(): void;
    /**
     * Resume test execution.
     * Puppeteer: SIGUSR2 signal (dedicated resume, idempotent).
     * Playwright: file-based IPC (signals don't reach worker processes).
     */
    resume(): void;
    /**
     * Step forward N actions.
     * Puppeteer: stdin JSON (instant delivery, supports count).
     * Playwright: file-based IPC.
     *
     * @param count - Number of actions to execute before re-pausing (default 1)
     */
    step(count?: number): void;
    /**
     * Send a live config update to the running child process via IPC.
     * Uses file-based IPC as primary channel, stdin as fallback for Puppeteer.
     *
     * @param config - Partial RunConfig with the fields to update
     */
    sendConfig(config: Partial<RunConfig>): void;
    /**
     * Check if tests are currently running.
     *
     * @returns `true` if a child process is active
     */
    isRunning(): boolean;
}
//# sourceMappingURL=test-executor.d.ts.map