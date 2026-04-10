import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserAdapter, DownloadResult } from './browser-adapter.interface';
import { readCommand, clearCommands } from '../utils/ipc';

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
export abstract class BaseAdapter implements BrowserAdapter {

  // ── Static shared state across all adapter instances ──────────────────
  protected static downloadDir: string = path.join(os.tmpdir(), 'stepwise-downloads');
  private static isPaused: boolean = false;
  private static stepMode: boolean = false;
  private static stepsRemaining: number = 0;
  private static actionIndex: number = 0;
  private static breakpoints: Set<number> = new Set();
  private static signalsInitialized: boolean = false;
  private static actionDelay: number = 0;
  private static baseUrl: string = '';

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
  private initializeBreakpoints(): void {
    const breakpointsEnv = process.env.TEST_BREAKPOINTS;
    if (breakpointsEnv) {
      try {
        const breakpoints = JSON.parse(breakpointsEnv);
        if (Array.isArray(breakpoints) && breakpoints.length > 0) {
          BaseAdapter.setBreakpoints(breakpoints);
        }
      } catch (error) {
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
  private initializeSignalHandlers(): void {
    if (BaseAdapter.signalsInitialized) {
      return;
    }

    BaseAdapter.signalsInitialized = true;

    // Clear any stale commands from a previous run
    clearCommands();

    // stdin listener — Puppeteer uses this for step commands and config updates.
    // Guard: Playwright workers don't have a real stdin, so skip if unavailable.
    if (process.stdin && typeof process.stdin.unref === 'function') {
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', (data: string) => {
        for (const line of data.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
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
          } catch {
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
    } catch {
      // Signals not available in this environment (e.g. Playwright worker)
    }
  }

  /**
   * Checks pause state and waits if paused.
   * Polls file-based IPC for commands (works in both Puppeteer and Playwright).
   * Also responds to signal-based commands (Puppeteer only — handled by signal handlers above).
   */
  protected async checkPauseState(): Promise<void> {
    // Poll for IPC commands — check once even if not paused
    const pollIpc = () => {
      const cmd = readCommand();
      if (!cmd) return;

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
  protected async addSlowModeDelay(): Promise<void> {
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
  protected async logAndCheckAction(description: string): Promise<void> {
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
  protected logActionComplete(): void {
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
  static setBreakpoints(breakpoints: number[]): void {
    BaseAdapter.breakpoints = new Set(breakpoints);
    if (breakpoints.length > 0) {
      console.log(`[BREAKPOINTS:set] ${breakpoints.join(', ')}`);
    }
  }

  /**
   * Resets action index for a new test run.
   */
  static resetActionIndex(): void {
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
  protected resolveUrl(url: string): string {
    if (/^https?:\/\//.test(url)) return url;
    return BaseAdapter.baseUrl + (url.startsWith('/') ? url : '/' + url);
  }

  /**
   * Ensures the shared download directory exists, creating it if necessary.
   * @returns The absolute path to the download directory
   */
  protected ensureDownloadDir(): string {
    fs.mkdirSync(BaseAdapter.downloadDir, { recursive: true });
    return BaseAdapter.downloadDir;
  }

  /**
   * Derives the origin from a page URL. Returns null for non-HTTP URLs
   * (e.g. about:blank) so callers can skip origin-specific operations.
   * @param url - The current page URL
   * @returns The origin string (e.g. 'http://localhost:3000') or null
   */
  protected deriveOrigin(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Invalid URL — fall through
    }
    return null;
  }

  // ── Abstract methods — implemented by PuppeteerAdapter / PlaywrightAdapter ──
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
