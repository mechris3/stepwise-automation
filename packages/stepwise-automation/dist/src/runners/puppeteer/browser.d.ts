/**
 * Browser launch configuration for Puppeteer runner.
 *
 * Provides reusable browser lifecycle helpers:
 * - Crash state cleanup (prevents "Chrome didn't shut down correctly" dialog)
 * - Session tab cleanup (prevents "Restore pages?" dialog)
 * - Persistent profiles via userDataDir + profileDir
 * - Configurable executable path
 * - Viewport sizing via CDP (measures actual chrome offset)
 */
import type { BrowserConfig } from '../../config';
/** Options for launching a Puppeteer browser, overriding config defaults. */
export interface LaunchOptions {
    /** Absolute path to the browser executable. */
    executablePath?: string;
    /** Whether to open Chrome DevTools on launch. */
    devtools?: boolean;
    /** Desired content area width in pixels. */
    viewportWidth?: number;
    /** Desired content area height in pixels. */
    viewportHeight?: number;
    /** Chrome CLI args for loading extensions (e.g. `--load-extension=...`). */
    extensionArgs?: string[];
}
/**
 * Cleans up crash state from the browser profile's Preferences file.
 * Removes "Crashed" exit_type to prevent the "Chrome didn't shut down correctly" dialog.
 * Also cleans Session/Tabs files to prevent the "Restore pages?" dialog.
 *
 * @param userDataDir - Absolute path to the browser's user data directory
 * @param profileDir - Profile subdirectory name (e.g. `"Default"`)
 */
export declare function cleanupCrashState(userDataDir: string, profileDir: string): void;
/**
 * Closes all browser tabs except the first one.
 * Useful after launch when the browser may restore multiple tabs.
 *
 * @param browser - A Puppeteer `Browser` instance
 */
export declare function closeExtraTabs(browser: any): Promise<void>;
/**
 * Launches a Puppeteer browser with full configuration:
 * - Crash state cleanup before launch
 * - Session tab cleanup before launch
 * - Persistent profile via userDataDir + profileDir
 * - Configurable executable path
 * - Viewport sizing via CDP to get pixel-perfect content area
 *
 * @param config - BrowserConfig from the consuming project's config file
 * @param options - Launch-time overrides (executable path, devtools, viewport, extensions)
 * @returns The launched Puppeteer Browser instance
 */
export declare function launchBrowser(config: BrowserConfig, options?: LaunchOptions): Promise<any>;
//# sourceMappingURL=browser.d.ts.map