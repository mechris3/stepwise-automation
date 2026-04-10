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

import * as fs from 'fs';
import * as path from 'path';
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
export function cleanupCrashState(userDataDir: string, profileDir: string): void {
  const profilePath = path.join(userDataDir, profileDir);

  // Fix "Chrome didn't shut down correctly" by clearing Crashed exit_type
  const prefsPath = path.join(profilePath, 'Preferences');
  try {
    if (fs.existsSync(prefsPath)) {
      const raw = fs.readFileSync(prefsPath, 'utf-8');
      const prefs = JSON.parse(raw);

      if (prefs.profile?.exit_type === 'Crashed') {
        prefs.profile.exit_type = 'Normal';
      }

      fs.writeFileSync(prefsPath, JSON.stringify(prefs), 'utf-8');
    }
  } catch {
    // Silent fail — preferences file may be locked or malformed
  }

  // Remove Session/Tabs files to prevent "Restore pages?" dialog
  const sessionsPath = path.join(profilePath, 'Sessions');
  try {
    if (fs.existsSync(sessionsPath)) {
      fs.rmSync(sessionsPath, { recursive: true, force: true });
    }
  } catch {
    // Silent fail
  }
}

/**
 * Closes all browser tabs except the first one.
 * Useful after launch when the browser may restore multiple tabs.
 *
 * @param browser - A Puppeteer `Browser` instance
 */
export async function closeExtraTabs(browser: any): Promise<void> {
  try {
    const pages = await browser.pages();
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
  } catch {
    // Silent fail — pages may already be closed
  }
}


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
export async function launchBrowser(config: BrowserConfig, options?: LaunchOptions): Promise<any> {
  // Dynamic import — puppeteer is an optional peer dependency.
  // @ts-ignore — resolved at runtime in the consuming project
  const puppeteer = (await import('puppeteer')).default;

  const userDataDir = config.userDataDir;
  const profileDir = config.profileDir || 'Default';

  // Pre-launch cleanup if using a persistent profile
  if (userDataDir) {
    cleanupCrashState(userDataDir, profileDir);
  }

  const executablePath = options?.executablePath || config.executablePath;
  const devtools = options?.devtools ?? false;
  const viewportWidth = options?.viewportWidth ?? config.defaultViewport?.width ?? 1280;
  const viewportHeight = options?.viewportHeight ?? config.defaultViewport?.height ?? 720;
  const extensionArgs = options?.extensionArgs ?? [];

  // Window sizing — add chrome offset so the content area matches the requested viewport
  const chromeHeightOffset = 150;
  const windowWidth = viewportWidth;
  const windowHeight = viewportHeight + chromeHeightOffset;

  const devtoolsArgs = devtools ? ['--auto-open-devtools-for-tabs'] : [];

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-session-crashed-bubble',
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-crash-restore-bubble',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--noerrdialogs',
    `--profile-directory=${profileDir}`,
    ...extensionArgs,
    ...devtoolsArgs,
    `--window-size=${windowWidth},${windowHeight}`,
  ];

  const browser = await puppeteer.launch({
    headless: config.headless ?? false,
    executablePath,
    userDataDir,
    defaultViewport: null,
    timeout: 30000,
    args: launchArgs,
  });

  // Resize the window via CDP so the viewport matches the requested dimensions exactly.
  // With defaultViewport: null, the viewport equals the window content area.
  // We measure the actual chrome height and compensate.
  try {
    const pages = await browser.pages();
    const page = pages[0];
    if (page) {
      const cdpSession = await page.createCDPSession();

      // Clear any persisted device emulation from a previous session
      await cdpSession.send('Emulation.clearDeviceMetricsOverride');

      // Get the current window
      const { windowId } = await cdpSession.send('Browser.getWindowForTarget');

      // Set window to a reference size to measure chrome offset
      const refSize = 1000;
      await cdpSession.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width: refSize, height: refSize, windowState: 'normal' },
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      // Measure actual bounds and viewport at reference size
      const { bounds: actualBounds } = await cdpSession.send('Browser.getWindowBounds', { windowId });
      const metrics = await page.evaluate(() => {
        const w = globalThis as any;
        return { innerWidth: w.innerWidth, innerHeight: w.innerHeight };
      });

      // Calculate chrome offsets from the actual bounds
      const chromeW = (actualBounds.width ?? refSize) - metrics.innerWidth;
      const chromeH = (actualBounds.height ?? refSize) - metrics.innerHeight;

      // Set the window to the exact size needed for the desired viewport
      await cdpSession.send('Browser.setWindowBounds', {
        windowId,
        bounds: {
          width: viewportWidth + chromeW,
          height: viewportHeight + chromeH,
          windowState: 'normal',
        },
      });

      await cdpSession.detach();
    }
  } catch {
    // CDP sizing is best-effort — fall back to the --window-size arg
  }

  // Close extra tabs that may have been restored from a previous session
  await closeExtraTabs(browser);

  return browser;
}
