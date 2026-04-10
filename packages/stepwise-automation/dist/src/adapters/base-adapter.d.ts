import { BrowserAdapter, DownloadResult } from './browser-adapter.interface';
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
export declare abstract class BaseAdapter implements BrowserAdapter {
    protected static downloadDir: string;
    private static isPaused;
    private static stepMode;
    private static stepsRemaining;
    private static actionIndex;
    private static breakpoints;
    private static signalsInitialized;
    private static actionDelay;
    private static baseUrl;
    constructor();
    /**
     * Initialize breakpoints from TEST_BREAKPOINTS environment variable.
     * Called in constructor for each test run.
     */
    private initializeBreakpoints;
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
    private initializeSignalHandlers;
    /**
     * Checks pause state and waits if paused.
     * Polls file-based IPC for commands (works in both Puppeteer and Playwright).
     * Also responds to signal-based commands (Puppeteer only — handled by signal handlers above).
     */
    protected checkPauseState(): Promise<void>;
    /**
     * Adds slow mode delay if configured.
     * Polls for IPC commands during the delay in 50ms intervals
     * so pause takes effect promptly even during a long delay.
     */
    protected addSlowModeDelay(): Promise<void>;
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
    protected logAndCheckAction(description: string): Promise<void>;
    /**
     * Logs action completion with [JSON] prefix to stderr.
     */
    protected logActionComplete(): void;
    /**
     * Sets breakpoints for the test run.
     * Called from test runner before test execution, or from constructor via env var.
     *
     * @param breakpoints - Array of 1-based action indices to pause at
     */
    static setBreakpoints(breakpoints: number[]): void;
    /**
     * Resets action index for a new test run.
     */
    static resetActionIndex(): void;
    /**
     * Resolve a URL against the configured baseUrl.
     * Absolute URLs (`http://`, `https://`) pass through unchanged.
     * Relative paths (starting with `/`) get baseUrl prepended.
     *
     * @param url - The URL or path to resolve
     * @returns Fully qualified URL string
     */
    protected resolveUrl(url: string): string;
    /**
     * Ensures the shared download directory exists, creating it if necessary.
     * @returns The absolute path to the download directory
     */
    protected ensureDownloadDir(): string;
    /**
     * Derives the origin from a page URL. Returns null for non-HTTP URLs
     * (e.g. about:blank) so callers can skip origin-specific operations.
     * @param url - The current page URL
     * @returns The origin string (e.g. 'http://localhost:3000') or null
     */
    protected deriveOrigin(url: string): string | null;
    abstract click(selector: string): Promise<void>;
    abstract fill(selector: string, value: string): Promise<void>;
    abstract waitForSelector(selector: string): Promise<void>;
    abstract isVisible(selector: string): Promise<boolean>;
    abstract clickAndWaitForNavigation(selector: string): Promise<void>;
    abstract waitForTimeout(ms: number): Promise<void>;
    abstract isDisabled(selector: string): Promise<boolean>;
    abstract getText(selector: string): Promise<string>;
    abstract getInputValue(selector: string): Promise<string>;
    abstract countElements(selector: string): Promise<number>;
    abstract readClipboard(): Promise<string>;
    abstract getCurrentUrl(): Promise<string>;
    abstract waitForHidden(selector: string): Promise<void>;
    abstract getAttribute(selector: string, attribute: string): Promise<string | null>;
    abstract evaluate(script: string): Promise<any>;
    abstract evaluate<T>(script: () => T): Promise<T>;
    abstract evaluate(script: string | (() => any)): Promise<any>;
    abstract goto(url: string): Promise<void>;
    abstract clearSession(origin?: string): Promise<void>;
    abstract uploadFile(selector: string, filePath: string): Promise<void>;
    abstract selectByIndex(selector: string, index: number): Promise<void>;
    abstract selectByValue(selector: string, value: string): Promise<void>;
    abstract selectByText(selector: string, text: string, exact?: boolean): Promise<void>;
    abstract clickAndDownload(selector: string): Promise<DownloadResult>;
    abstract clearDownloads(): Promise<void>;
}
//# sourceMappingURL=base-adapter.d.ts.map