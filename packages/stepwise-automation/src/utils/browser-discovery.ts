import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Represents a discovered Chromium-based browser on the system.
 */
export interface DiscoveredBrowser {
  name: string;
  executablePath: string;
  userDataDir?: string;
}

/**
 * Returns platform-specific browser installation candidates.
 * Each candidate includes the browser name, possible executable paths,
 * and the default user data directory for that browser.
 *
 * @returns Array of browser candidates for macOS, Windows, or Linux
 */
function getBrowserCandidates(): Array<{ name: string; paths: string[]; userDataDir?: string }> {
  const homedir = os.homedir();
  const platform = process.platform;

  if (platform === 'darwin') {
    return [
      {
        name: 'Google Chrome',
        paths: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
        userDataDir: path.join(homedir, 'Library/Application Support/Google/Chrome'),
      },
      {
        name: 'Brave Browser',
        paths: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
        userDataDir: path.join(homedir, 'Library/Application Support/BraveSoftware/Brave-Browser'),
      },
      {
        name: 'Microsoft Edge',
        paths: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
        userDataDir: path.join(homedir, 'Library/Application Support/Microsoft Edge'),
      },
      {
        name: 'Chromium',
        paths: ['/Applications/Chromium.app/Contents/MacOS/Chromium'],
        userDataDir: path.join(homedir, 'Library/Application Support/Chromium'),
      },
    ];
  }

  if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    return [
      {
        name: 'Google Chrome',
        paths: [
          path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ],
        userDataDir: path.join(localAppData, 'Google', 'Chrome', 'User Data'),
      },
      {
        name: 'Brave Browser',
        paths: [
          path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
          path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
          path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        ],
        userDataDir: path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'),
      },
      {
        name: 'Microsoft Edge',
        paths: [
          path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ],
        userDataDir: path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
      },
    ];
  }

  // Linux
  return [
    {
      name: 'Google Chrome',
      paths: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
      userDataDir: path.join(homedir, '.config/google-chrome'),
    },
    {
      name: 'Brave Browser',
      paths: ['/usr/bin/brave-browser', '/usr/bin/brave-browser-stable'],
      userDataDir: path.join(homedir, '.config/BraveSoftware/Brave-Browser'),
    },
    {
      name: 'Microsoft Edge',
      paths: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
      userDataDir: path.join(homedir, '.config/microsoft-edge'),
    },
    {
      name: 'Chromium',
      paths: ['/usr/bin/chromium', '/usr/bin/chromium-browser'],
      userDataDir: path.join(homedir, '.config/chromium'),
    },
  ];
}


/**
 * Attempts to get Puppeteer's bundled Chromium executable path.
 *
 * @returns Absolute path to bundled Chromium, or `undefined` if Puppeteer is not installed
 */
function getPuppeteerBundledChromium(): string | undefined {
  try {
    const puppeteer = require('puppeteer');
    return puppeteer.executablePath?.() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Auto-detect installed Chromium-based browsers at common OS paths.
 * Probes macOS, Windows, and Linux paths for Chrome, Brave, Edge, and Chromium.
 * Falls back to Puppeteer's bundled Chromium if no system browsers are found.
 *
 * @returns Array of discovered browsers, ordered by platform preference
 */
export function discoverBrowsers(): DiscoveredBrowser[] {
  const browsers: DiscoveredBrowser[] = [];
  const candidates = getBrowserCandidates();

  for (const candidate of candidates) {
    for (const executablePath of candidate.paths) {
      try {
        if (fs.existsSync(executablePath)) {
          browsers.push({
            name: candidate.name,
            executablePath,
            userDataDir: candidate.userDataDir,
          });
          break; // Found this browser, move to next candidate
        }
      } catch {
        // Skip inaccessible paths
      }
    }
  }

  // Fallback to Puppeteer's bundled Chromium if no system browsers found
  if (browsers.length === 0) {
    const bundledPath = getPuppeteerBundledChromium();
    if (bundledPath) {
      browsers.push({ name: 'Chromium (Puppeteer)', executablePath: bundledPath });
    }
  }

  return browsers;
}
